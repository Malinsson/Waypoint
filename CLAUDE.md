# Waypoint

Degree project, 5 weeks, built solo with AI assistance (Claude Code). The user enters several destinations, the app generates a driving route on an interactive map, and when a leg exceeds a time/distance limit it suggests places to stay (hotel, hostel, camping, parking) near the point where the user should stop.

This file is the living specification for the project. Detailed specs for individual features live in `specs/`. If code and spec disagree, ask me which one is right before changing either.

---

## How to work with me

- **Spec-driven, small steps.** Work on one feature or one layer at a time. Do not scaffold the whole stack in one go.
- **Plan before coding.** For anything larger than a small fix, give a short plan first (files to touch, approach) and wait for my go-ahead.
- **I must be able to explain every line.** This is examined orally. Keep code simple, prefer readable over clever, and briefly explain non-obvious parts (especially auth, data models, and cross-service calls).
- **No scope creep.** Only build what the current task asks for. Do not add features, abstractions, or dependencies that were not requested. If you think something is missing, say so instead of adding it.
- **Ask before adding a dependency.** Prefer the standard library, built-in browser APIs, and packages already installed.
- **Never touch secrets.** Do not read, print, or commit `.env` files or API keys.
- **Show your work.** After a change, tell me what you changed, how to run or verify it, and anything you were unsure about.
- **Check against the Definition of Done** (below) before you say a task is finished.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite), React Router |
| Map | OpenLayers (`ol` npm package) |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB Atlas via Mongoose |
| Geo service | Python + Flask (separate microservice, REST/JSON) |
| External APIs | Geoapify (geocoding, routing, places); Overpass API as optional fallback |
| Auth | JWT + bcrypt, authentication is optional for guests |
| Validation | Zod (backend request validation) |
| Hosting | Frontend: Vercel. Backend + Python service: Render. DB: MongoDB Atlas |

---

## Architecture

```
Browser (React + TS + OpenLayers)
        |
        v   REST/JSON
Express API  ------>  MongoDB Atlas (Mongoose)
   |   \
   |    +---------->  Geoapify (geocode, route, places)
   v
Python service (Flask): break-point calculation
```

Rules:

1. **The frontend only talks to Express.** Never call Geoapify, the Python service, or MongoDB directly from the browser. The one exception is the browser Geolocation API, which stays in the frontend; the resulting coordinates are sent to Express like any other input.
2. **All external API calls go through the Facade** (see Design patterns). No `fetch` to Geoapify scattered around the code.
3. **Express orchestrates.** The Python service is stateless and has no database access. Express sends it data and receives a result.
4. **API keys and secrets live only in the backend**, loaded from environment variables.

### Request flow for planning a trip

1. Frontend sends destinations (addresses or coordinates) to `POST /api/trips/plan`.
2. Express geocodes addresses through the Geoapify Facade.
3. Express requests a route through the Facade.
4. Express sends route legs plus the driving-time limit to the Python service, which returns break points.
5. For each break point, Express asks the Facade for accommodation matching the user's preferences.
6. Express returns the full plan. Nothing is saved unless the user is logged in and explicitly saves it.

---

## Repository structure

```
roadtrip-planner/
├── CLAUDE.md
├── specs/                # one spec per feature area (auth, trips, python-service, ...)
├── .gitignore
├── frontend/             # React + TS (Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── api/          # typed client for the Express API
│       ├── context/      # AuthContext etc.
│       └── types/
├── backend/              # Express + TS
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── models/       # Mongoose schemas
│       ├── middleware/   # auth, validation, error handling
│       ├── services/     # GeoapifyFacade, accommodation finders, python client
│       ├── config/       # env loading, db connection (singleton)
│       └── index.ts
└── geo-service/          # Flask
    ├── app.py
    └── requirements.txt
```

Each folder is its own project with its own dependencies. Run `npm install` / `pip install` inside the right folder, not in the repo root.

---

## Commands

Update this section as soon as scripts exist.

```bash
# Backend
cd backend && npm run dev        # tsx watch src/index.ts
cd backend && npm run build      # tsc
cd backend && npm test

# Frontend
cd frontend && npm run dev       # Vite dev server
cd frontend && npm run build
cd frontend && npm run lint

# Python service
cd geo-service && source venv/bin/activate && flask --app app run --port 5000
```

---

## Environment variables

Real values go in `.env` (git-ignored). Keep `.env.example` files committed with empty values.

Backend:
```
PORT=3000
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
GEOAPIFY_API_KEY=
GEO_SERVICE_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173
```

Frontend:
```
VITE_API_URL=http://localhost:3000
```

---

## Data models (draft, refine in `specs/`)

**User**: `email` (unique), `passwordHash`, `displayName`, `createdAt`

**Trip**: `owner` (ref User), `title`, `status` (`planned` | `completed`), `destinations[]`, `route` (GeoJSON LineString), `legs[]` (distance, duration), `accommodationPreferences` (`types[]`), `suggestedStops[]`, `rating` (1-5, optional), `createdAt`

**Destination** (subdocument of Trip): `name`, `location` (GeoJSON Point), `order`, `rating` (optional)

**Favorite**: `owner` (ref User), `name`, `type` (hotel | hostel | camping | parking | other), `location` (GeoJSON Point), `source` (provider and external id), `createdAt`

Coordinates: store GeoJSON order `[longitude, latitude]` everywhere. Convert only at the edge (OpenLayers with `fromLonLat`, Geoapify parameters). Mixing up lat/lon is the most likely geo bug, so be explicit in variable names.

---

## API surface (draft)

Auth column: `-` public, `opt` optional auth (works for guests), `req` login required.

| Method | Path | Auth | Purpose | Priority |
|---|---|---|---|---|
| GET | `/api/health` | - | Health check | Must |
| POST | `/api/geocode` | opt | Address to coordinates | Must |
| POST | `/api/trips/plan` | opt | Full planning flow, not saved | Must |
| POST | `/api/auth/register` | - | Create account | Should |
| POST | `/api/auth/login` | - | Returns JWT | Should |
| GET | `/api/auth/me` | req | Current user | Should |
| POST | `/api/trips` | req | Save a planned trip | Should |
| GET | `/api/trips` | req | List my trips | Should |
| GET/PATCH/DELETE | `/api/trips/:id` | req | Read, update, delete a trip | Should |
| PATCH | `/api/trips/:id/complete` | req | Mark completed, rate trip and places | Should |
| GET/POST/DELETE | `/api/favorites` | req | Manage favorite places | Should |

Error responses use one consistent shape: `{ "error": { "code": "STRING", "message": "Human readable" } }` with appropriate HTTP status codes.

### Python service contract (draft, finalize in `specs/python-service.md`)

`POST /find-break-points`

Request:
```json
{
  "legs": [
    { "durationSeconds": 14400, "distanceMeters": 380000,
      "coordinates": [[18.07, 59.33], [17.9, 59.1]] }
  ],
  "maxDrivingSeconds": 14400
}
```

Response:
```json
{
  "breakPoints": [
    { "legIndex": 0, "lon": 15.6, "lat": 58.4, "cumulativeSeconds": 14400 }
  ]
}
```

Keep this service pure: input in, result out, easy to unit test with known coordinates.

---

## Authentication rules

- Passwords are hashed with bcrypt. Never store or log plain-text passwords.
- JWT is sent as `Authorization: Bearer <token>`.
- Two middlewares:
  - `optionalAuth`: sets `req.user` if a valid token is present, otherwise continues as guest. An invalid token is treated as guest, not as an error.
  - `requireAuth`: returns 401 if there is no authenticated user.
- Core planning (geocode, plan) uses `optionalAuth`. Saving trips, favorites, and ratings use `requireAuth`.
- Every query for trips or favorites must filter on the authenticated user. A user must never be able to read or modify another user's data. Write a test for this.
- Frontend: guests see a clear "Log in to save" prompt where a feature needs an account, never a raw 401 error.

---

## Design patterns

- **Facade**: `GeoapifyFacade` exposes `geocode()`, `getRoute()`, `findAccommodation()`. It hides URLs, keys, parameters, and response shapes, and is the only place that knows about Geoapify (so Places can be swapped for Overpass without touching the rest).
- **Factory**: `AccommodationFinderFactory.get(type)` returns the right finder for `hotel`, `hostel`, `camping`, or `parking`. Each finder knows its own category or tag and how to parse results.
- **Singleton**: database connection and loaded configuration are created once and shared.

Use patterns where they solve a real problem here. Do not add more patterns or layers than these.

---

## Code conventions

- TypeScript strict mode. No `any` unless justified with a comment.
- Share request/response types between layers where practical; otherwise keep them in each project's `types/` folder.
- Validate all request bodies and query params in Express with Zod before using them.
- Controllers stay thin: parse, call a service, return a response. Business logic lives in `services/`.
- Use `async/await`, and wrap async route handlers so errors reach the central error-handling middleware.
- Naming: `camelCase` for variables/functions, `PascalCase` for components/classes/types, `kebab-case` for file names except React components (`PascalCase.tsx`).
- External API calls need timeouts and clear error handling (invalid address, rate limit, service down). The user should always see an understandable message.
- Comments explain why, not what. No commented-out code.
- Python: type hints, small functions, PEP 8.

---

## Testing

- **Must:** manual test of the happy path and at least one failure case for every feature.
- **Should:** automated tests for the auth flow (including the "cannot access other users' data" case) and the Python break-point calculation (known input, known output).
- **Can skip:** full UI test coverage. Document it as a known limitation.
- When writing tests, tell me what each one verifies.

---

## Git

- Small, frequent commits on a working branch. Message format: `type: short description` (`feat`, `fix`, `refactor`, `docs`, `chore`).
- `main` should always build and be deployable.
- `.gitignore` must include: `node_modules/`, `dist/`, `.env`, `venv/`, `__pycache__/`.
- Push to GitHub at least daily.

---

## Scope (MoSCoW)

**Must have**
- Add and remove multiple destinations via a form
- Geocode destinations (Geoapify)
- Generate a route and show it on an OpenLayers map
- Calculate break points when a leg exceeds the time limit (Python service)
- Suggest at least one type of accommodation at each break point
- Express + MongoDB/Mongoose backend with REST API
- Core flow works fully without an account
- Basic error handling

**Should have**
- Optional registration and login
- Save trips for logged-in users
- Favorite places
- Accommodation type preference (hotel, hostel, camping, parking)
- Use browser geolocation as start point, with manual address fallback
- Mark a trip as completed and rate the trip and individual places

**Could have**
- Simplified co-travelers: the owner adds existing registered users to a trip, who then get read and rate access only
- Filter map markers by accommodation type
- Overpass fallback when Geoapify quota is close to the limit
- Guest favorites in localStorage, migrated on registration
- Share a trip via link

**Won't have (this time)**
- OAuth or social login
- Email verification, password reset
- Roles or admin permissions
- Booking functionality (suggestions only)
- Full invitation system, notifications
- Multi-language support, offline mode

---

## MVP

A visitor with no account can: enter several destinations, see them geocoded and a route on the map, see where the first break point falls when a leg exceeds the limit, and see at least one accommodation suggestion there. Target: working and deployed by end of week 3.

Demo script that must work end to end: enter Stockholm, Gothenburg, Malmo, see the route, see "stop after X hours" with a nearby accommodation suggestion.

---

## Definition of Done

For every feature or task:

- [ ] Works according to the spec, not just "looks right"
- [ ] Happy path tested manually in the browser, start to finish
- [ ] At least one failure case handled and tested (invalid address, API down, Python service down)
- [ ] I can explain the code
- [ ] No secrets in code; keys live in environment variables
- [ ] Reviewed (`/code-review`) and the results read through
- [ ] Committed with a clear message, and the TypeScript build passes

For every larger milestone (MVP, end of week 3, final):

- [ ] Deployed and verified in production (Vercel + Render), not only locally
- [ ] The full user flow tested from scratch in the deployed version

Before saying a task is done, go through this list and tell me which items you verified and which I need to check myself.

---

## Deployment

- Frontend: Vercel, Root Directory `frontend`.
- Backend: Render web service, Root Directory `backend`.
- Python service: Render web service, Root Directory `geo-service`.
- Database: MongoDB Atlas (free M0 cluster).
- Set all environment variables in each platform's dashboard. Set `CORS_ORIGIN` to the deployed frontend URL.
- Render free services sleep after inactivity, so the first request can be slow. Wake them before demos.
- Deploy a minimal "hello world" version in week 1 and re-verify at every milestone.

---

## Plan (5 weeks)

1. **Week 1:** Repo, Express + Atlas connection, React skeleton, OpenLayers map, `/api/health` end to end, first deploy. Start auth in parallel.
2. **Week 2:** Destinations form, geocoding, routing, route on the map, trip model and endpoints.
3. **Week 3:** Python service and break-point logic, Express integration, geolocation, error handling. MVP complete and deployed.
4. **Week 4:** Accommodation suggestions and preferences, favorites, ratings, Facade/Factory cleanup. Cut scope here if the core is not stable.
5. **Week 5:** Polish, error and empty states, full test pass, report, presentation. Reserve at least 2 days with no new features.

---

## Known risks and limitations

- Scope creep is the biggest risk. Respect the Won't-have list.
- OpenStreetMap data for camping and parking is inconsistent outside cities. Document it rather than over-engineering around it.
- Geoapify free tier is limited (about 3000 requests/day). Cache where sensible, mock during development, keep Overpass as fallback.
- Cross-service integration (Express, Python, external APIs) is where unexpected bugs appear. Define contracts before coding both sides.
- Browser geolocation accuracy varies a lot (laptops especially).

---

## Report notes

The project follows spec-driven development: this file and `specs/` act as the living specification that guides AI-assisted code generation with Claude Code. Design choices to describe in the report: monorepo, all external calls behind a Facade, Python as a stateless microservice, optional authentication, and the known limitations above.