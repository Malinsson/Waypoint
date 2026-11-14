# Waypoint

Waypoint is a road-trip planner. Enter several destinations, see the driving
route on an interactive map, and get suggested places to stay (hotel, hostel,
camping, parking) near the point where a leg exceeds the driving-time limit.

This is a five-week degree project built solo with AI assistance (Claude Code),
following spec-driven development: [CLAUDE.md](./CLAUDE.md) and
[specs/](./specs/) are the living specification.

## Features

**Without an account (guests)**

- Add, remove and reorder destinations, with address autocomplete (Geoapify and
  Wikidata landmarks, merged).
- Use the browser's location as a start point, with manual address fallback.
- Route drawn on an OpenLayers map.
- Break points where a leg exceeds the driving limit (calculated by the Python
  service).
- Accommodation suggestions at each break point, filtered by type preference.

**With an account**

- Register, log in, change password, profile with stats.
- Save, edit, rename and delete trips; mark a trip as completed.
- Rate a completed trip, its destinations and its stops.
- Favorite places, organised in lists.

Example demo route: Stockholm → Gothenburg → Malmö.

## Architecture

```text
Browser (React + TypeScript + OpenLayers)
              |
              v   REST/JSON
       Express API  ------>  MongoDB Atlas (Mongoose)
         |      \
         |       +------>  Geoapify (geocode, route, places)
         |       +------>  Wikidata (landmark suggestions)
         v
 Python/Flask service: break-point calculation
```

- The frontend only talks to Express. Map tiles are loaded directly from
  OpenStreetMap, and the Geolocation API stays in the browser.
- All external calls go through `GeoapifyFacade` and `WikidataFacade`, which
  return our own normalized types.
- The Python service is stateless: input in, break points out, no database.
- API keys and secrets live only in the backend.

## Technology

| Layer | Choice |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, OpenLayers |
| Backend | Node.js, Express, TypeScript, Zod, Mongoose |
| Database | MongoDB Atlas |
| Geo service | Python, Flask (gunicorn in production) |
| External APIs | Geoapify, Wikidata |
| Auth | JWT + bcrypt, optional for guests |
| Hosting | Vercel (frontend), Render (backend and geo service) |

## Repository structure

```text
.
├── backend/       Express API (routes, controllers, services, models)
├── frontend/      React app (pages, components, api client, hooks)
├── geo-service/   Flask break-point service and pytest tests
├── specs/         Feature specifications
├── bash-tests/    Throwaway scripts used to compare places providers
├── CLAUDE.md      Project specification and working guidelines
└── README.md
```

Each folder is its own project with its own dependencies. Run install and
start commands inside the right folder, not in the repository root.

## Local development

You need Node.js, Python 3, a MongoDB Atlas connection string and a Geoapify
API key. Start all three services; the frontend needs the backend, and the
backend needs the geo service for planning.

### Backend

```bash
cd backend
cp .env.example .env   # then fill in the values
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with file watching (tsx) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run backend tests (`node:test`) |
| `npm run report:suggestions` | Dev only. Uses real quota: 18 Geoapify and up to 36 Wikidata requests per run |

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Run Vitest tests |

### Geo service

```bash
cd geo-service
python -m venv venv
# Windows PowerShell: venv\Scripts\Activate.ps1
# macOS/Linux:        source venv/bin/activate
pip install -r requirements.txt
flask --app app run --port 5000
```

Tests: `pip install -r requirements-dev.txt`, then `pytest`.

## Environment variables

Real values go in git-ignored `.env` files. Each project has a committed
`.env.example`.

### Backend

```env
PORT=3000
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
GEOAPIFY_API_KEY=
WIKIDATA_USER_AGENT=Waypoint/0.1 (contact: your@mail.com)
GEO_SERVICE_URL=http://localhost:5000
GEOSERVICE_API_KEY=
CORS_ORIGIN=http://localhost:5173
```

### Frontend

```env
VITE_API_URL=http://localhost:3000
```

### Geo service

```env
GEO_SERVICE_KEY=
```

`GEOSERVICE_API_KEY` (backend) and `GEO_SERVICE_KEY` (geo service) must hold the
same value. The geo service checks it on incoming requests.

## API endpoints

Auth: `-` public, `opt` works for guests, `req` login required. Errors use one
shape: `{ "error": { "code": "STRING", "message": "..." } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | - | Health check |
| POST | `/api/geocode` | opt | Address to coordinates |
| GET | `/api/geocode/autocomplete` | opt | Suggestions while typing |
| POST | `/api/accommodation/search` | opt | Accommodation near a point |
| POST | `/api/trips/plan` | opt | Plan route and stops (not saved) |
| POST | `/api/auth/register` | - | Create account |
| POST | `/api/auth/login` | - | Log in, returns JWT |
| GET | `/api/auth/me` | req | Current user |
| GET | `/api/auth/stats` | req | Profile statistics |
| POST | `/api/auth/change-password` | req | Change password |
| POST, GET | `/api/trips` | req | Save a trip, list my trips |
| GET, PATCH, PUT, DELETE | `/api/trips/:id` | req | Read, update, replace, delete a trip |
| POST | `/api/trips/:id/complete` | req | Mark a trip as completed |
| PUT, DELETE | `/api/trips/:id/rating` | req | Set or clear a rating |
| GET, POST | `/api/favorites` | req | List or add favorite places |
| DELETE | `/api/favorites/:id` | req | Remove a favorite |
| POST | `/api/favorites/lists` | req | Create a favorite list |
| GET, PATCH, DELETE | `/api/favorites/lists/:listId` | req | Read, rename, delete a list |
| POST, DELETE | `/api/favorites/lists/:listId/locations` | req | Add or remove a place in a list |

Every trip and favorite query is filtered on the authenticated user; this is
covered by tests (`backend/test/trip-ownership.test.ts`).

## Testing

- **Backend:** `node:test` covering planning, accommodation, autocomplete,
  Wikidata and Geoapify facades, rate limiting, trip validation, ownership,
  completion and ratings.
- **Frontend:** Vitest for the API client and the autocomplete hook.
- **Geo service:** pytest for break-point calculation, geometry, validation and
  the HTTP API.

## Known limitations

- Geoapify's free tier is limited (about 3000 requests/day).
- Camping and parking data in OpenStreetMap is inconsistent outside cities.
- Wikidata has no API key and unknown rate limits, so requests are restrained
  and sent with a descriptive User-Agent.
- Browser geolocation can be inaccurate, especially on laptops.
- Render free services sleep after inactivity, so the first request can be slow.
- Full UI test coverage is outside the project scope.
- Not built (by design): OAuth, email verification, password reset, booking,
  admin roles, offline mode.

See [CLAUDE.md](./CLAUDE.md) for the full specification and
[specs/](./specs/) for feature-level requirements.
