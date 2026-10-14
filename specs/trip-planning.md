# Trip Planning (core flow)

Status: draft (v2, adds automatic stop ordering and manual reordering). Priority: Must for the core flow, Should for order optimization and reordering, Could for fully free ordering. Built in weeks 2-3 (destinations, geocoding, route in week 2; break points, accommodation, and ordering in week 3-4). This is the MVP. Related: `CLAUDE.md`, `specs/python-service.md`, `specs/accommodation.md`, `specs/auth.md`, `specs/trips-and-ratings.md`.

## Purpose

A visitor enters several destinations in any order, sees them on a map, and gets a driving route. The app can reorder the stops in between to find a better visiting order, and the user can always reorder them by hand. When a leg of the route is longer than the user's driving limit, the app shows where to stop and suggests places to stay near that point. The whole flow works without an account and does not save anything.

The MVP must work with the simplest behavior: visit the destinations in the order they were entered. Ordering optimization is added on top without changing the rest of the flow.

## User stories

- As a guest, I can add destinations by typing an address and confirming the match shown to me.
- As a guest, I can enter my destinations in any order and let the app work out a better visiting order (Should).
- As a guest, I can easily move a destination up or down, and the app then respects my order (Should).
- As a guest, I can switch between "Optimize order" and "Keep my order" (Should).
- As a guest, I can see that the app reordered my stops, and go back to the order I entered (Should).
- As a guest, I can remove a destination.
- As a guest, I can set how many hours I am willing to drive in one stretch (Should; default 6).
- As a guest, I can press "Plan trip" and see the route, distance, and driving time per leg on the map.
- As a guest, I see where I should stop on long legs and a few accommodation suggestions near each stop.
- As a guest, I get a clear message if an address cannot be found, no route exists, or a service is down.
- As a guest, I can start a new plan from scratch with one click.
- As a logged-in user the flow is identical, plus a "Save trip" button (see `trips-and-ratings.md`).

## Acceptance criteria

Destinations and geocoding
- [ ] [Must] The user can add at least 2 and at most 10 destinations.
- [ ] [Must] Typing an address and submitting calls `POST /api/geocode` and shows up to 5 candidate matches. Choosing one adds the destination with its coordinates and shows a numbered marker on the map immediately.
- [ ] [Must] If no match is found, the user sees "We could not find that address" and nothing is added.
- [ ] [Must] A destination can be removed, and the markers and numbering update.
- [ ] [Should] The start can be filled from the browser's location (see Geolocation below).

Ordering
- [ ] [Must] Without optimization, destinations are visited in exactly the order shown in the list. The first is the start and the last is the end.
- [ ] [Should] Each destination can be moved up or down with buttons. The list and the numbered map markers update immediately. (Drag and drop is a Could.)
- [ ] [Should] An "Optimize order" toggle is on by default. With it on, the first and last destinations stay fixed and the destinations in between may be reordered by the app.
- [ ] [Should] After planning with optimization, the list and markers are shown in the order that was actually used, and a notice says that the order was changed.
- [ ] [Should] The notice has a "Use my order instead" action that re-plans with optimization off, using the order the user originally entered.
- [ ] [Should] When the user moves a destination manually, the toggle switches to "Keep my order" automatically, and the next plan uses the list order as it is.
- [ ] [Should] With fewer than 3 destinations there is nothing to optimize, so the toggle is disabled and the plan uses the given order.
- [ ] [Should] If optimization fails, the route is still planned in the given order and a warning is shown.
- [ ] [Should] Break points and accommodation are always computed for the final order, never for the entered order.
- [ ] [Could] A "Round trip" option adds the start point as the final destination.
- [ ] [Could] Drag and drop reordering.
- [ ] [Could] Fully free ordering where even the start and end may move (see Fully free ordering).

Planning
- [ ] [Must] "Plan trip" is disabled until there are at least 2 destinations.
- [ ] [Must] `POST /api/trips/plan` returns the route geometry, total distance and duration, and per-leg distance and duration.
- [ ] [Must] The route is drawn on the map and the view is fitted to the whole route.
- [ ] [Must] For every leg whose duration exceeds the driving limit, at least one break point is returned (calculated by the Python service).
- [ ] [Must] Break points are shown on the map with a marker that is visually distinct from destination markers.
- [ ] [Must] Each break point has at least one accommodation suggestion when one exists within the search radius (MVP: hotels only).
- [ ] [Must] If no accommodation is found, the break point is still shown with a message "No accommodation found nearby". This is not treated as an error.
- [ ] [Should] The driving limit is adjustable (1-16 hours, default 6), and changing it and re-planning changes the break points.
- [ ] [Should] If the Python service or the accommodation search fails, the route is still returned with a warning instead of failing the whole request.
- [ ] [Should] Clicking a leg, break point, or accommodation in the list highlights it on the map.

Errors and states
- [ ] [Must] A loading state is shown while planning. The button is disabled to prevent double submits.
- [ ] [Must] Invalid input returns 400 `VALIDATION_ERROR`. An address that cannot be geocoded returns 422 `GEOCODING_FAILED` with the index of the failing destination. A pair of points with no drivable route returns 422 `ROUTE_NOT_FOUND`.
- [ ] [Must] Every user-visible error is in plain language. No stack traces, API keys, or raw upstream messages reach the browser.
- [ ] [Must] The flow works identically for guests and logged-in users.

## API

All errors use the shape from `CLAUDE.md`: `{ "error": { "code": "STRING", "message": "Human readable" } }`.

Coordinates are always GeoJSON order `[longitude, latitude]`.

### POST /api/geocode

Auth: `optionalAuth`.

Request:
```json
{ "query": "Drottninggatan 1, Stockholm" }
```

Response 200:
```json
{
  "results": [
    { "label": "Drottninggatan 1, 111 51 Stockholm, Sweden", "location": [18.0686, 59.3293] }
  ]
}
```

An empty `results` array (not an error) means nothing was found. Errors: 400 `VALIDATION_ERROR`, 503 `UPSTREAM_UNAVAILABLE`, 503 `UPSTREAM_RATE_LIMITED`.

### POST /api/trips/plan

Auth: `optionalAuth`. Does not save anything.

The order of the `destinations` array is the **input order**. Each destination carries a client-generated `id` so the frontend can match it to the response, because the order in the response may differ.

Request:
```json
{
  "destinations": [
    { "id": "d1", "name": "Stockholm", "location": [18.0686, 59.3293] },
    { "id": "d2", "name": "Malmo", "location": [13.0038, 55.6050] },
    { "id": "d3", "name": "Gothenburg", "address": "Gothenburg, Sweden" },
    { "id": "d4", "name": "Linkoping", "location": [15.6214, 58.4108] }
  ],
  "options": {
    "optimizeOrder": true,
    "roundTrip": false,
    "maxDrivingHours": 6,
    "accommodationTypes": ["hotel"]
  }
}
```

Each destination has either `location` or `address`. If only `address` is given, Express geocodes it first and fails with 422 `GEOCODING_FAILED` if there is no match.

`optimizeOrder` defaults to `false` in the API (explicit is better for the MVP). The frontend sends `true` by default once the toggle exists.

Response 200 (shape; the exact numbers depend on the route):
```json
{
  "destinations": [
    { "id": "d1", "order": 0, "inputIndex": 0, "name": "Stockholm", "location": [18.0686, 59.3293] },
    { "id": "d4", "order": 1, "inputIndex": 3, "name": "Linkoping", "location": [15.6214, 58.4108] },
    { "id": "d3", "order": 2, "inputIndex": 2, "name": "Gothenburg", "location": [11.9746, 57.7089] },
    { "id": "d2", "order": 3, "inputIndex": 1, "name": "Malmo", "location": [13.0038, 55.6050] }
  ],
  "orderOptimized": true,
  "route": {
    "distanceMeters": 0,
    "durationSeconds": 0,
    "geometry": { "type": "LineString", "coordinates": [[18.07, 59.33]] },
    "legs": [
      { "fromIndex": 0, "toIndex": 1, "distanceMeters": 0, "durationSeconds": 0 }
    ]
  },
  "breakPoints": [
    {
      "legIndex": 0,
      "location": [15.6, 58.4],
      "cumulativeSeconds": 14400,
      "accommodation": [
        { "name": "Hotel Example", "type": "hotel", "location": [15.61, 58.41], "distanceMeters": 900 }
      ]
    }
  ],
  "warnings": []
}
```

Field meaning:
- `order`: position in the order that was used for the route. Marker numbers, legs (`fromIndex`, `toIndex`), and break points (`legIndex`) all refer to `order`.
- `inputIndex`: position in the request array. Used to restore the user's own order.
- `orderOptimized`: `true` only if the app actually reordered something. It is `false` when optimization was not requested, was not possible, or failed.
- `warnings`: a list of `{ "code": "...", "message": "..." }`, for example `BREAK_POINTS_UNAVAILABLE`, `ACCOMMODATION_UNAVAILABLE`, or `ORDER_OPTIMIZATION_UNAVAILABLE`.

Errors: 400 `VALIDATION_ERROR`, 422 `GEOCODING_FAILED`, 422 `ROUTE_NOT_FOUND`, 503 `UPSTREAM_UNAVAILABLE`, 503 `UPSTREAM_RATE_LIMITED`.

### Orchestration inside Express

1. Validate the body with Zod.
2. Geocode any destination that only has an address (Facade).
3. If `roundTrip` is true, append a copy of the first destination as the last one.
4. Request the route for all waypoints (Facade). If `optimizeOrder` is true and there are at least 3 waypoints, ask the Facade to optimize the intermediate stops. The first and last stay fixed. The Facade returns the route together with the order that was used.
   - If the optimization request fails, repeat the request without optimization and add an `ORDER_OPTIMIZATION_UNAVAILABLE` warning.
   - If the plain routing request fails, the whole request fails: without a route there is nothing to show.
5. Build the `destinations` array in the order used, with `order` and `inputIndex` for each.
6. Send the legs (for the final order) and the driving limit to the Python service (`specs/python-service.md`). If this fails, continue with `breakPoints: []` and add a `BREAK_POINTS_UNAVAILABLE` warning.
7. For each break point, ask the Facade for accommodation matching the requested types (`specs/accommodation.md`). If this fails for a break point, return it with an empty list and an `ACCOMMODATION_UNAVAILABLE` warning.
8. Return the combined result.

### Facade interface (backend)

The Facade returns **our own normalized types**, never raw Geoapify responses.

```ts
type LonLat = [number, number];

interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: LonLat[] };
  legs: { distanceMeters: number; durationSeconds: number; coordinates: LonLat[] }[];
  // For each position in the route, the index of that waypoint in the input array.
  // Equals [0, 1, 2, ...] when the order was not changed.
  waypointOrder: number[];
}

interface GeoapifyFacade {
  geocode(query: string): Promise<{ label: string; location: LonLat }[]>;
  getRoute(waypoints: LonLat[], options?: { optimizeStops?: boolean }): Promise<RouteResult>;
  findAccommodation(point: LonLat, radiusMeters: number, types: AccommodationType[]): Promise<Accommodation[]>;
}
```

Notes for the implementation (details stay inside the Facade):
- Geoapify's routing request has an option to reorder the intermediate stops. According to the Geoapify documentation, the first and last waypoint stay fixed and only the stops in between are reordered. Check the current documentation for the exact parameter and response fields when implementing.
- The routing request takes waypoints as `latitude,longitude` while our code and the response use `[longitude, latitude]`. Convert in the Facade only, and nowhere else.
- Map the order Geoapify reports back to indices of the input array, so the rest of the code only sees `waypointOrder`.

## Data

This flow does not persist anything. The plan response is transient. The saved version of a plan (`Trip`) is defined in `specs/trips-and-ratings.md`, and it must store the final order.

Validation (Zod):
- `destinations`: array of 2-10 items (with `roundTrip`, the extra last waypoint is added by the server after validation).
- Each destination: `id` (non-empty string, unique within the request, max 50 characters), and `location` (two numbers, longitude -180 to 180, latitude -90 to 90) **or** `address` (trimmed string, 1-200 characters). `name` is optional (1-100 characters).
- `options.optimizeOrder`: boolean, default `false`.
- `options.roundTrip`: boolean, default `false`.
- `options.maxDrivingHours`: number from 1 to 16, default 6.
- `options.accommodationTypes`: array of allowed types, default `["hotel"]`.
- `/api/geocode` `query`: trimmed string, 2-200 characters.

## Ordering rules

- The array order of the request is the input order. Without optimization it is also the route order.
- With optimization, the first and last destinations never move. Only the ones between them can change position.
- Optimization needs at least 3 destinations, because with 2 there is nothing in between.
- The user's manual order always wins: after a manual move, the next plan is sent with `optimizeOrder: false`, and the list order is used as it is.
- The frontend keeps a snapshot of the order the user entered (the `inputIndex` values). "Use my order instead" re-plans with `optimizeOrder: false` using that snapshot order.
- After a response, the frontend replaces its list with the response order. A new plan then treats the displayed order as the new input order.

## Break point rules (summary, details in `python-service.md`)

- Driving time is measured **per leg** (between two consecutive destinations in the final order). The counter resets at each destination, on the assumption that the user rests or stays at a destination.
- If a leg takes longer than the limit, a break point is placed after each full multiple of the limit that falls strictly inside the leg. Example: a 10 hour leg with a 4 hour limit gets break points at 4 h and 8 h.
- A leg that is exactly at or below the limit gets no break point.
- Each break point is a coordinate on the route line, not necessarily near a town. Accommodation is then searched around it.
- Because the order can change, break points are always computed after the order is decided.

## Accommodation search (summary, details in `accommodation.md`)

- Default search radius: 10 km around the break point. If nothing is found, retry once with 25 km.
- Return at most 5 results per break point, sorted by distance.
- MVP: `hotel` only. Other types are added in `accommodation.md` (Should).

## Fully free ordering (Could)

Geoapify's stop optimization keeps the first and last waypoint fixed. If the user should be able to enter any set of places and let the app also choose the start and the end, this is not enough. The alternative is to fetch a distance and time matrix between all points (Geoapify Route Matrix API) and compute the best visiting order ourselves, for example in the Python service. With at most 10 destinations, trying all orders is possible, and a simple heuristic is also an option. This is the classic traveling salesman problem and a good topic for the report.

This is a Could. Only consider it after week 4 and only if the core flow and the Should items are stable. It would need its own spec (`specs/route-ordering.md`) and a new Python endpoint.

## UI behavior

Layout: the Plan page has a side panel (destinations, options, results) and a large map. On narrow screens the panel sits above the map.

- **Add destination:** one text field plus an "Add" button. After submitting, show candidate matches as a short list. Selecting one adds it. Show a small inline spinner while geocoding.
- **Destination list:** numbered, each item with a remove button and up/down buttons. Every item has a stable client-side `id`. Marker numbers on the map match the list. A short hint explains: "The first is your start and the last is your end. Stops in between can be reordered."
- **Options:** the "Optimize order / Keep my order" toggle, the driving limit input (hours), and the accommodation type (MVP: fixed to hotel). A "Round trip" checkbox is a Could.
- **Manual move:** moving an item switches the toggle to "Keep my order". The map markers renumber at once, and the route is only recalculated when the user presses "Plan trip" again.
- **Plan button:** disabled with fewer than 2 destinations or while loading.
- **Reorder notice:** after a response with `orderOptimized: true`, show "We reordered your stops" with a "Use my order instead" button.
- **Results:** a total summary (distance, driving time), then each leg with distance and time, with break points listed under the leg they belong to, each with its accommodation list.
- **Map:** destination markers (numbered by final order), route line, break point markers, accommodation markers. Fit the view to the route extent after planning. Convert coordinates with `fromLonLat` when passing them to OpenLayers.
- **Empty state:** before any destinations are added, show a short instruction ("Add at least two destinations to plan your trip").
- **Warnings:** shown as a non-blocking notice above the results.
- **Errors:** shown as a banner with a "Try again" action. The entered destinations are kept.
- **Start over:** clears destinations, route, and results.
- **State:** held in React state. A page reload loses it (storing it in `sessionStorage` is a Could).
- **Save button:** visible to everyone. For guests it opens the login prompt from `specs/auth.md`.
- **Geolocation (Should):** a "Use my location" button next to the first destination. If permission is denied or the position is unavailable, show a message and let the user type an address instead.

## Edge cases

- The same destination added twice in a row: allowed, but the leg has zero length and no break point. Show it without error, or warn (decide when building, not important for MVP).
- Two destinations that are very close: valid route, no break points.
- Destinations separated by sea or with no road connection: Geoapify returns no route, so respond 422 `ROUTE_NOT_FOUND`.
- Destination outside the area Geoapify can route in: treat the same as above.
- Optimization with 2 destinations: skipped, `orderOptimized` is `false`, no warning.
- Optimization with 3 destinations (one stop in between): nothing can change, `orderOptimized` is `false`.
- Optimization returns the same order the user entered: `orderOptimized` is `false`, no notice is shown.
- Optimization request fails or is not available (limit on the number of stops, quota, upstream error): fall back to the given order with an `ORDER_OPTIMIZATION_UNAVAILABLE` warning.
- Result order is not stable between calls (two plans of the same input give different orders): note it and prefer the order used in the most recent response. Check during testing.
- Destination ids are missing or duplicated: 400 `VALIDATION_ERROR`.
- The user moves destinations around after a plan and presses "Plan trip" again: the new request uses the displayed order and re-numbers `inputIndex`.
- "Use my order instead" after several manual changes: restores the order the user entered in the last request, not an older one.
- Round trip with only 2 destinations: valid, a route there and back.
- Geoapify returns an unexpected shape: the Facade throws a typed error, and the controller maps it to 503 `UPSTREAM_UNAVAILABLE`.
- Geoapify daily quota exceeded: 503 `UPSTREAM_RATE_LIMITED` with a friendly message.
- Upstream call hangs: each external call has a 10 second timeout. Exception: the optimized routing request (`optimize_stops`) gets 45 seconds, because Geoapify measured 13 s for 4 and 25-29 s for 5 Swedish cities. If it times out, the plan falls back to the given order with a warning. The frontend's loading state must account for waits of up to about a minute.
- Python service asleep (Render cold start): the first call can be slow, so allow a longer timeout for it (for example 30 seconds) and still fall back to a warning.
- Python service down: plan still succeeds with a warning and no break points.
- Very long route: the Python service must handle thousands of coordinates without issues.
- A break point lands in an area with no accommodation: shown with an empty-state message.
- User double-clicks "Plan trip": ignore the second request while one is running.
- Address with unusual characters (a-ring, a-umlaut, o-umlaut, apostrophes): must be passed URL-encoded to Geoapify.

## Tests

Automated (Should):
- Zod validation: too few or too many destinations, missing both `location` and `address`, missing or duplicated `id`, out-of-range coordinates, bad `maxDrivingHours`.
- Plan orchestration with a mocked Facade and a mocked Python client: success, Python failure gives a warning with a route, accommodation failure gives a warning, routing failure gives an error.
- Ordering with a mocked Facade: a changed `waypointOrder` produces the right `order` and `inputIndex`, the first and last destinations stay in place, and an unchanged order gives `orderOptimized: false`.
- Optimization failure: the plan falls back to the given order and returns an `ORDER_OPTIMIZATION_UNAVAILABLE` warning.
- Facade tests with recorded sample responses (so tests do not use up the Geoapify quota), including the mapping from Geoapify's reported order to input indices.

Manual (Must unless marked):
- Happy path: Stockholm, Gothenburg, Malmo. The route appears, long legs show break points, break points show hotel suggestions.
- Invalid address: nothing is added and a clear message appears.
- Two destinations only, then remove one: plan button is disabled.
- Change the driving limit to 2 and to 10 and re-plan: break points change accordingly.
- Stop the Python service: the route still shows, with a warning.
- Use a wrong Geoapify key locally: the user sees a friendly error, and the key is not exposed.
- Repeat the happy path in the deployed version.
- (Should) Enter 5 destinations in a clearly bad order, plan with optimization on and then off, and compare the totals. The optimized route should not be worse. Record the numbers for the report.
- (Should) Move a destination manually and check that the toggle switches, the markers renumber, and the next plan keeps that order.
- (Should) Press "Use my order instead" after an optimized plan and check that the original order returns.

## Out of scope

- Optimization with several vehicles, time windows, capacities, or other operational constraints (Geoapify's Route Planner API)
- Alternative routes, avoid tolls or ferries, other transport modes
- Distance-based limits (time only in the MVP; a distance limit is a Could)
- Multi-day itineraries with arrival times, opening hours, prices, availability, or booking
- Live traffic
- Dragging the route or waypoints on the map
- Autocomplete as you type (a Could, mind the Geoapify quota)
- Saving, favorites, ratings (other specs)

## Open questions

- Should the driving-time counter reset at destinations, or continue across the whole trip? Current decision: reset per leg (see Break point rules). Revisit if it feels wrong when testing.
- What does Geoapify's stop optimization minimize, driving time or distance? Verify with a few real routes before the UI or the report calls the result the "fastest" order. Until it is verified, the UI label says "Optimize order".
- What are the limits of the stop optimization (maximum number of stops) and how does it count against the daily quota? Check the Geoapify documentation and test with 10 destinations.
- Is the result deterministic? If two identical requests can return different orders, decide how the UI should behave.
- Should "Optimize order" be on by default? Current decision: yes. Reconsider if testers find the reordering surprising.
- Is a 10 km search radius sensible in sparsely populated areas? Check with a real route in northern Sweden and adjust.
- Should geocoding be biased towards Sweden or Europe? Check how Geoapify ranks results for ambiguous place names and decide.
- Cache geocoding results (in memory or in MongoDB) to save quota? Decide only if the quota becomes a problem.
- Is 10 destinations a sensible maximum? It limits quota use and keeps the UI simple.

## Things I must be able to explain (oral exam)

- What geocoding is, and why coordinates are `[longitude, latitude]` in GeoJSON but often `latitude,longitude` in everyday APIs.
- Why Express orchestrates the whole flow instead of the browser calling Geoapify and the Python service directly.
- What the Facade hides, and how it would let us swap Geoapify Places for Overpass.
- Why a failure in the Python service or the accommodation search produces a partial result with a warning, while a routing failure is an error.
- How a break point is computed along the route line.
- What the traveling salesman problem is, and why the first and last stops are fixed in the simple version.
- Why the response needs both `order` and `inputIndex`, and what would break without client-side ids.
- Why collecting the user's order and optimizing it are two separate steps.
- Why the planning endpoints use `optionalAuth`.

## Definition of Done

Follow the Definition of Done in `CLAUDE.md`. For this spec specifically, also confirm:
- [ ] The demo script from `CLAUDE.md` (Stockholm, Gothenburg, Malmo) works in the deployed version.
- [ ] No Geoapify key appears in the browser's network tab or in the repository.
- [ ] Every failure case in Edge cases that is marked as handled has been triggered at least once by hand.
- [ ] Marker numbers, list numbers, legs, and break points all match after an optimized plan and after a manual move.