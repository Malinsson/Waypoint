# Waypoint

Waypoint is a road-trip planner that helps users plan multi-stop driving
routes. Enter several destinations, view the route on an interactive map, and
get a suggested stopping point with nearby accommodation when a driving leg
exceeds the configured limit.

This is a five-week degree project built with React, TypeScript, Node.js,
Express, MongoDB, and a small Python service for calculating break points.

## MVP

A visitor should be able to:

- Add and remove multiple destinations.
- Geocode destination addresses.
- Generate and display a driving route on an OpenLayers map.
- Calculate a break point when a route leg exceeds the driving-time limit.
- See at least one nearby accommodation suggestion.
- Complete the core planning flow without creating an account.

Example demo route: Stockholm → Gothenburg → Malmo.

## Architecture

```text
React + OpenLayers frontend
              |
              v
       Express REST API
          /          \
         v            v
 MongoDB/Mongoose   Geoapify
         |
         v
 Python/Flask break-point service
```

The frontend communicates only with the Express API. Express coordinates
geocoding, routing, break-point calculation, and accommodation searches.
External API keys and other secrets stay in the backend.

## Technology

- **Frontend:** React, TypeScript, Vite, React Router, OpenLayers
- **Backend:** Node.js, Express, TypeScript, Zod, Mongoose
- **Database:** MongoDB Atlas
- **Geo service:** Python, Flask
- **External services:** Geoapify, with Overpass as a possible fallback
- **Authentication:** Optional JWT and bcrypt authentication
- **Deployment:** Vercel (frontend), Render (backend and geo service)

## Repository structure

```text
.
├── backend/       Express API and MongoDB integration
├── frontend/      React application and map UI
├── geo-service/   Flask service for break-point calculations
├── specs/         Feature specifications
├── CLAUDE.md      Project specification and development guidelines
└── README.md
```

Each application has its own dependencies. Install and run commands from the
relevant directory rather than from the repository root.

## Local development

### Backend

```bash
cd backend
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Other useful commands:

```bash
npm run build
npm run lint
```

### Python service

Create and activate a virtual environment, install the requirements, and start
the Flask service:

```bash
cd geo-service
python -m venv venv
# Windows PowerShell
venv\Scripts\Activate.ps1
pip install -r requirements.txt
flask --app app run --port 5000
```

## Environment variables

Create a `.env` file in `backend/` and keep real values out of version
control. Use `.env.example` files for documented placeholders.

### Backend

```env
PORT=3000
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
GEOAPIFY_API_KEY=
GEO_SERVICE_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173
```

### Frontend

```env
VITE_API_URL=http://localhost:3000
```

## Main API endpoints

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Check that the API is running |
| POST | `/api/geocode` | Optional | Convert an address to coordinates |
| POST | `/api/trips/plan` | Optional | Plan a route and find suggested stops |
| POST | `/api/auth/register` | Public | Create an account |
| POST | `/api/auth/login` | Public | Log in and receive a JWT |
| GET | `/api/auth/me` | Required | Get the current user |
| POST | `/api/trips` | Required | Save a planned trip |
| GET | `/api/trips` | Required | List the user's saved trips |
| GET/ PATCH/ DELETE | `/api/trips/:id` | Required | Manage one saved trip |
| GET/ POST/ DELETE | `/api/favorites` | Required | Manage favorite places |

Planning and geocoding work for guests. Saving trips, favorites, and ratings
requires an authenticated user.

## Project status

The implementation is planned in five stages:

1. Set up the repository, health endpoint, frontend, map, and initial
   deployment.
2. Add destinations, geocoding, routing, and saved-trip models.
3. Add the Python break-point service and complete the guest MVP.
4. Add accommodation preferences, favorites, and ratings.
5. Polish error states, test the full flow, and prepare the final deployment
   and presentation.

## Known limitations

- Geoapify has a limited free-tier quota.
- Camping and parking data can be inconsistent outside cities.
- Browser geolocation may be inaccurate, especially on laptops.
- Full UI test coverage is outside the current project scope.

See [CLAUDE.md](./CLAUDE.md) for the complete project specification and
[specs/](./specs/) for feature-specific requirements.
