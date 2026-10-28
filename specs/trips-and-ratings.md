# Spec: Trips and Ratings

Status: draft v2 (adapted to the Mongoose `Location` and `User` models). Items marked **[ASSUMPTION]** were not in the handoff documents and must be confirmed against `CLAUDE.md`, `specs/auth.md` and `specs/trip-planning.md` before coding. If code and spec disagree, ask the owner which one applies.

## 1. Purpose

A logged-in user can save a planned trip, reopen and edit it later, delete it, and rate the places they used on it (stops and accommodation). Ratings are private to the user in v1.

## 2. Scope (MoSCoW)

**Must**
- Save a trip produced by the planning flow (`trip-planning.md`).
- List, open, rename and delete own trips.
- Rate a place on a saved trip (1-5, optional comment). One rating per user per place per trip.

**Should**
- Update and delete an existing rating.
- Show the user's rating next to the place when reopening a trip.

**Could**
- Re-run planning on a saved trip with a changed driving limit.
- Aggregate ratings across users (needs a stable place identity, see open questions).

**Won't (v1)**
- Sharing trips with other users, public trips, comments from others, photo uploads.

## 3. Dependencies

- `specs/auth.md`: every endpoint below requires an authenticated user. The authenticated user id comes from the session/token, never from the request body or URL.
- `specs/trip-planning.md`: defines the plan result that a trip stores (destinations, route, breakpoints). Do not redefine those shapes here; reuse them.
- Coordinates are always `location: [lon, lat]` (see `CLAUDE.md`).
- Default driving limit is 6 hours per day. A logged-in user may override it. The override is stored on the trip (see 4.1). The `User` model has no driving-limit field; adding a per-user default is out of scope for v1.

## 4. Data model (Mongoose, MongoDB Atlas)

### 4.0 Location (existing model, shared catalog)

`Location` becomes the stable place identity (`_id`, optional `wikidataId`). It is a shared catalog: no `userId`, created only by the server when a trip is saved, never through a client-facing endpoint. Ratings and (later) favorites point at it.

Required changes to the existing model:
- Remove `optional: true` on `wikidataId`. It is not a Mongoose option and is silently ignored. An optional field is simply one without `required`.
- Add a unique sparse index on `wikidataId`: `locationSchema.index({ wikidataId: 1 }, { unique: true, sparse: true })`.
- `address` is `required`, but Wikidata suggestions have a description, not an address. Decide: make it optional, or fill it with a fallback (see open questions). Do not let a save fail for this reason.
- `name` (max 80) and `address` (max 200): truncate in the mapper instead of failing the whole save.

Upsert rule (server side, when saving a trip): if `wikidataId` exists, `findOneAndUpdate({ wikidataId }, ..., { upsert: true })`. Otherwise match on exact (`name`, `latitude`, `longitude`) and create if missing. Duplicates between sources with slightly different coordinates are accepted in v1.

Coordinates: `Location` stores `latitude` and `longitude`; the API contract uses `location: [lon, lat]`. Convert in one pair of mapper functions (`toLocationDoc`, `toApiLocation`) and nowhere else.

### 4.1 Trip

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId, ref `User`, required, immutable | Owner. |
| `name` | string, 1-100, trimmed | Default: "Origin to Destination". |
| `destinations` | array of `{ locationId: ObjectId ref Location },   rating: { 
    stars: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
  },` | Array order is the trip order. No `kind`. |
| `route` | Mixed | Snapshot of the planning result (geometry, total distance, total duration). |
| `breakpoints` | array of `{ latitude: number, longitude: number, locationId?: ObjectId ref Location }` | Snapshot from the Python service. `locationId` is set only when the stop is a named place (for example a chosen accommodation). Only entries with a `locationId` can be rated. |
| `drivingLimitHours` | number, 1-12 | Value used when the plan was made. |
| `accommodationPreferences` | object | `types` is an ordered list, same shape as in planning. |
| `totalRating` | object | `{ stars: number, min: 1, max: 5 }, comment: string, max 1000, trimmed, optional }`. Set by the user, optional |
| `createdAt`, `updatedAt` | Date | `timestamps: true`. |
| `completedAt` | Date | Optional. Set when the user marks the trip as completed. |

Index: `{ userId: 1, updatedAt: -1 }`.

Decision: store the plan as a snapshot. Opening a trip must not call Geoapify, Wikidata or the Python service. Keep `route` small (a document is limited to 16 MB, and the Express body limit in section 6 applies first).

### 4.2 Seperate Rating (could)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId, ref `User`, required, immutable | Owner. |
| `tripId` | ObjectId, ref `Trip`, required | Must belong to the same user. |
| `locationId` | ObjectId, ref `Location`, required | Must be one of the trip's `destinations[].locationId` or `breakpoints[].locationId`. |
| `stars` | integer, 1-5, required | |
| `comment` | string, max 1000, trimmed, optional | Plain text. |
| `createdAt`, `updatedAt` | Date | `timestamps: true`. |

Indexes:
- `ratingSchema.index({ userId: 1, tripId: 1, locationId: 1 }, { unique: true })`. This is what enforces one rating per place, not application code.
- `ratingSchema.index({ tripId: 1 })` for loading a trip's ratings.

The place name is not copied into the rating. Read it from `Location.name` (populate).

Deletion: MongoDB has no cascade. The trip-delete service deletes the trip's ratings (`deleteMany({ tripId, userId })`) and then the trip. Atlas supports transactions; use one if the project already does, otherwise delete ratings first, so a failure never leaves orphan ratings pointing at a missing trip.

Cross-user aggregation (Could) is now possible because `Location` is shared: group ratings by `locationId`. Out of scope for v1.

## 5. API

All paths are under `/api`. All require authentication. JSON in and out. Errors use the standard shape in `CLAUDE.md`. Route params that are ObjectIds are checked with `Types.ObjectId.isValid`; a malformed id returns 400.

### Trips

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/trips` | Save a trip | 201 + trip |
| `GET` | `/trips` | List own trips (summary) | 200 |
| `GET` | `/trips/:id` | Get one own trip, with ratings | 200 |
| `PATCH` | `/trips/:id` | Rename (only `name` in v1) | 200 + trip |
| `DELETE` | `/trips/:id` | Delete trip and its ratings | 204 |
| `PUT` | `/trips/:id/rating` | Create or replace own rating | 201 (created) or 200 (replaced) |
| `POST` | `/trips/:id/complete` | Mark trip as completed | 200 |

- `POST /trips` body: `name?`, `destinations` (each `{ name, address?, location: [lon, lat], wikidataId?, rating? }`), `route`, `breakpoints`, `drivingLimitHours`, `accommodationPreferences`, `totalRating`, `completedAt`. The server upserts the Locations (4.0), stores their ids, and sets `userId` and timestamps. Ignore any client-supplied `_id`, `userId`, `locationId` or timestamps.
- `GET /trips` returns per trip: `id`, `name`, `createdAt`, `updatedAt`, first and last destination name, total distance and duration, rating count. Sorted by `updatedAt` descending. `limit` (default 20, max 50) and `cursor` (`_id`/`updatedAt` based).
- `GET /trips/:id` returns the trip with `Location` populated (converted to `location: [lon, lat]`) and `ratings: Rating[]`.

### Ratings (could)

| Method | Path | Purpose | Success |
|---|---|---|---|
| `PUT` | `/trips/:id/ratings/:locationId` | Create or replace own rating | 201 (created) or 200 (replaced) |
| `DELETE` | `/trips/:id/ratings/:locationId` | Remove own rating | 204 |

- `PUT` body: `stars` (required), `comment?`. Implement as `findOneAndUpdate({ userId, tripId, locationId }, ..., { upsert: true })`; use `includeResultMetadata` (or `rawResult` on older Mongoose) to tell 201 from 200.
- The trip is loaded with `{ _id: id, userId }` first. If `locationId` is not among its locations, return 404 `PLACE_NOT_FOUND`.

### Error cases

| Case | Status | Code |
|---|---|---|
| Not authenticated | 401 | `UNAUTHENTICATED` |
| Trip does not exist **or belongs to another user** | 404 | `TRIP_NOT_FOUND` |
| Invalid body or malformed id | 400 | `VALIDATION_ERROR` |
| `locationId` not part of the trip | 404 | `PLACE_NOT_FOUND` |
| Trip limit reached (section 7) | 409 | `TRIP_LIMIT_REACHED` |
| Trip already completed | 409 | `TRIP_ALREADY_COMPLETED` |
| Rating submitted for incomplete trip | 409 | `TRIP_NOT_COMPLETED` |

Return 404, not 403, for another user's trip, so ids cannot be probed.

## 6. Validation and security

- Validate every body on the server with a schema (use the validation library already in the project, or ask before adding one).
- Reject unknown fields on `POST /trips` and `PUT` rating, or strip them. Pick one and apply it consistently.
- `stars` must be an integer 1-5. `drivingLimitHours` must be a number in 1-12.
- Cap the size of `route` and `breakpoints` (reject bodies over a fixed byte limit set in Express) so a client cannot store arbitrary large data.
- Every query is scoped by `userId` from the auth context. Never fetch by `id` alone and check ownership afterwards.
- Comments are plain text. The frontend renders them as text (no `dangerouslySetInnerHTML`).
- Do not log comment text or full routes at info level.

## 7. Limits

- Max trips per user: 50.
- Max ratings per trip: bounded by the number of places in the trip, so no separate limit.

## 8. Frontend

- **My trips page** (`/trips`): list from `GET /trips`, empty state, delete with confirmation, click opens the trip.
- **Trip page** (`/trips/:id`): shows the stored plan (map, breakpoints) without calling external services. Each breakpoint and destination has a star control and an optional comment field as well as a total rating and completed status.
- **Save button** on the plan result: calls `POST /trips`, shows success or error, disabled while saving to prevent double submit. If the user is not logged in, prompt to log in and keep the plan in memory.
- Star control: keyboard accessible, labelled with ARIA (for example "Rate 3 out of 5"), shows the current value, allows clearing.
- Optimistic updates are optional. If used, roll back on error and show a message.
- States for every call: loading, error, empty. Use `AbortController` on fetches that can be superseded.
- Types are duplicated by hand between backend and frontend with a sync comment (project convention).

## 9. Tests

Backend (use the project's existing test setup):
- Create, list, get, rename, delete a trip.
- Another user cannot read, rename, delete or rate my trip (expect 404).
- Unauthenticated requests return 401.
- Client-supplied `userId` and `id` are ignored.
- Rating: `stars` 0, 6, 3.5 and a missing value are rejected; 1000+ char comment is rejected.
- `PUT` twice for the same place leaves exactly one rating (and returns 201 then 200). Also test the unique index directly (make sure indexes are built before the test runs, for example `await Rating.init()`).
- Saving two trips with the same `wikidataId` reuses one `Location`.
- A `locationId` that is not part of the trip returns 404; a malformed id returns 400.
- Deleting a trip removes its ratings.
- Trip limit returns 409.
- Marking a trip as completed sets `completedAt`. Trying to mark an incomplete trip returns 409. Trying to mark a completed trip again returns 409.

Frontend (Vitest, jsdom, Testing Library):
- Star control: click and keyboard set the value, ARIA label correct, clear works.
- Save button disabled while saving; error message shown on failure.
- My trips page shows empty state and list.

## 10. Definition of Done for this feature

- All tests above pass.
- Manual check: save a trip, reload, reopen it with no external calls (check the network tab), rate a stop, log in as a second user and confirm the trip is not visible.
- `/code-review` run and findings handled.
- `CLAUDE.md` API table updated with the new endpoints.
- Commit message `feat: trips and ratings`, one step per session.

## 11. Suggested build order (one Claude Code step each)

1. Mongoose models (`Trip`, `Rating`), the `Location` fixes from 4.0, indexes, the coordinate mapper and the Location upsert helper, with tests.
2. Trip endpoints (`POST`, `GET` list, `GET` one, `PATCH`, `DELETE`) with ownership scoping and tests.
3. Rating endpoints with tests.
4. Frontend: save button on the plan result.
5. Frontend: My trips page and trip page.
6. Frontend: star control and rating UI.

## 12. Open questions

- `Location.address` is required but Wikidata results have no address. Make it optional, or fall back to the description or "Name, country"?
- Do accommodation results in `specs/accommodation.md` become `Location` documents? This decides whether breakpoints get a `locationId` and can be rated.
- Should the trip store a "per-user default driving limit" later (needs a field on `User`)?
- Trip limit of 50: keep, change or drop?