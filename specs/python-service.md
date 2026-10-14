# Python Service (geo-service)

Status: draft. Priority: Must (this is the Python component required by the project, and the part that makes the "where should I stop?" idea work). Built in week 3. Related: `CLAUDE.md`, `specs/trip-planning.md` (calls this service and defines the break point rules), `specs/accommodation.md`.

## Purpose

A small, stateless Flask microservice that does one geographic calculation: given the legs of a driving route and a driving-time limit, find the points on the route where the user should stop. Express calls it over REST/JSON after the route and its final order are known, then searches for accommodation around each returned point.

The service has no database, no user data, no external API calls, and no knowledge of Geoapify. It takes numbers in and gives numbers out, which makes it easy to test and easy to explain.

## Who uses it

- Only the Express backend, over HTTP. The browser never calls it.
- Because of that, CORS is **not** enabled.

## Acceptance criteria

Core behavior
- [ ] [Must] `POST /find-break-points` returns, for every leg longer than the driving limit, a break point after each full multiple of the limit that falls strictly inside the leg.
- [ ] [Must] A leg at or below the limit returns no break points.
- [ ] [Must] The driving-time counter resets at each leg boundary (each destination). A 5 hour leg followed by a 2 hour leg with a 4 hour limit gives one break point, in the first leg.
- [ ] [Must] Each returned break point lies on the route line of its leg (within 1 meter), in `[longitude, latitude]` order.
- [ ] [Must] The response lists break points in route order: by `legIndex`, then by `cumulativeSeconds`.
- [ ] [Must] An empty list of legs returns an empty list of break points (not an error).

Robustness
- [ ] [Must] Invalid input returns 400 `VALIDATION_ERROR` with a readable message, never a stack trace or an HTML error page.
- [ ] [Must] Every error response is JSON in the shape from `CLAUDE.md`.
- [ ] [Must] `GET /health` returns 200 and does not require the service key.
- [ ] [Must] Degenerate input (a leg whose points are all identical, repeated consecutive points) does not crash and does not divide by zero.
- [ ] [Should] A leg with up to 50,000 coordinates is handled in under 1 second.
- [ ] [Should] When `GEO_SERVICE_KEY` is set, requests without the correct `X-Service-Key` header get 401 `UNAUTHORIZED`.
- [ ] [Should] Logs never contain coordinates.

Quality
- [ ] [Must] The calculation lives in a pure function that can be tested without Flask.
- [ ] [Must] Automated tests with known inputs and outputs (see Tests) pass.
- [ ] [Must] The service is deployed on Render and reached successfully from the deployed Express backend.

## API

All errors use the shape from `CLAUDE.md`: `{ "error": { "code": "STRING", "message": "Human readable" } }`.

Coordinates are `[longitude, latitude]` everywhere, the same as GeoJSON and the rest of the project.

### POST /find-break-points

Auth: header `X-Service-Key` (see Security).

Request:
```json
{
  "legs": [
    {
      "durationSeconds": 36000,
      "distanceMeters": 1111950,
      "coordinates": [[0.0, 0.0], [10.0, 0.0]]
    }
  ],
  "maxDrivingSeconds": 14400
}
```

Response 200:
```json
{
  "breakPoints": [
    { "legIndex": 0, "location": [4.0, 0.0], "cumulativeSeconds": 14400 },
    { "legIndex": 0, "location": [8.0, 0.0], "cumulativeSeconds": 28800 }
  ]
}
```

Field meaning:
- `legIndex`: index into the request's `legs` array, so it matches `fromIndex`/`toIndex` in the plan response from `trip-planning.md`.
- `location`: `[longitude, latitude]` of the break point on the route line.
- `cumulativeSeconds`: driving seconds since the **start of that leg**. It is called "cumulative" because it accumulates along the leg, and it resets to zero at the next leg.

This example uses a straight line along the equator, where one degree of longitude is a constant distance. That makes the expected answer exact (longitude 4.0 after 40 percent of the time, 8.0 after 80 percent), and it is a good first test.

Changes from the draft in `CLAUDE.md`: the break point now uses `location: [lon, lat]` instead of separate `lon` and `lat` fields, to match the coordinate convention in the rest of the project. Update `CLAUDE.md` when this spec is accepted.

Errors:
- 400 `VALIDATION_ERROR`: body is not valid JSON, or fails validation.
- 401 `UNAUTHORIZED`: missing or wrong `X-Service-Key` (only when the key is configured).
- 413 `PAYLOAD_TOO_LARGE`: request body above the configured limit.
- 500 `INTERNAL_ERROR`: unexpected failure, generic message only.

### GET /health

Auth: none. Response 200: `{ "status": "ok" }`. Used by Render's health check, and optionally by Express to wake the service up (see Cold starts).

## Algorithm

Input: a list of legs and `maxDrivingSeconds`. For each leg, independently:

1. Round `durationSeconds` to the nearest whole second.
2. If `duration <= maxDrivingSeconds`, the leg has no break points. Go to the next leg.
3. Compute the length of the route line: for each pair of consecutive points, the distance with the haversine formula, summed into a list of cumulative distances along the line. Call the total `lineLength`. If `lineLength` is zero, skip the leg.
4. For `k = 1, 2, 3, ...` while `k * maxDrivingSeconds < duration`:
   - `fraction = (k * maxDrivingSeconds) / duration`
   - `targetDistance = fraction * lineLength`
   - Find the segment of the line that contains `targetDistance`, and interpolate linearly inside that segment to get the point.
   - Emit `{ legIndex, location, cumulativeSeconds: k * maxDrivingSeconds }`.

The comparison in step 4 is strict, so a leg that takes exactly `k * maxDrivingSeconds` seconds gets no break point at its very end: the user arrives at the destination at that moment.

Pseudocode (Python-flavored):

```python
def find_break_points(legs, max_driving_seconds):
    result = []
    for leg_index, leg in enumerate(legs):
        duration = round(leg["durationSeconds"])
        if duration <= max_driving_seconds:
            continue
        cumulative = cumulative_distances(leg["coordinates"])
        line_length = cumulative[-1]
        if line_length == 0:
            continue
        k = 1
        while k * max_driving_seconds < duration:
            fraction = (k * max_driving_seconds) / duration
            point = point_at_distance(leg["coordinates"], cumulative, fraction * line_length)
            result.append({
                "legIndex": leg_index,
                "location": point,
                "cumulativeSeconds": k * max_driving_seconds,
            })
            k += 1
    return result
```

Helper functions, kept in a separate module:
- `haversine_meters(a, b)`: great-circle distance between two `[lon, lat]` points, with Earth radius 6,371,008.8 m.
- `cumulative_distances(coordinates)`: list of distances from the first point to each point, starting with `0.0`.
- `point_at_distance(coordinates, cumulative, target)`: finds the segment and interpolates inside it. Repeated consecutive points (segment length zero) must not cause a division by zero.

### Assumption: constant speed along the leg

The service only knows the total duration of a leg, not how the time is spread along it. It therefore assumes a constant speed, so that "40 percent of the time" means "40 percent of the distance". This is wrong when a leg mixes slow and fast roads, for example a city start followed by a long motorway. The error is acceptable for suggesting where to look for a place to sleep, and it is documented as a known limitation. A more accurate version is a Could (see Open questions).

### Interpolation inside a segment

Segments from a routing API are short (typically meters to a few kilometers), so linear interpolation of longitude and latitude inside a segment is accurate enough. Do not interpolate across a long straight segment of hundreds of kilometers if the input can contain one (the equator example above is exact only because it lies on the equator).

## Data and validation

The service has no stored data. Validation is done by hand, in one function, using only the standard library (no extra validation dependency).

- Body must be a JSON object with `legs` (list) and `maxDrivingSeconds`.
- `maxDrivingSeconds`: a number from 3600 to 43200 (1 to 12 hours), the same range as Express validates.
- `legs`: a list of 0 to 20 items. (The project allows 10 destinations, plus an optional round trip, so at most 10 legs are expected. The limit of 20 leaves room.)
- Each leg is an object with:
  - `durationSeconds`: a number, 0 or more.
  - `distanceMeters`: optional, a number, 0 or more. Accepted but not used in version 1.
  - `coordinates`: a list of 2 to 50,000 points, each a list of two numbers, longitude from -180 to 180 and latitude from -90 to 90.
- Reject `NaN`, infinity, booleans passed as numbers, and unknown value types.
- Maximum request body size: 5 MB (`MAX_CONTENT_LENGTH`).

The error message names the failing field, for example `legs[2].coordinates must contain at least 2 points`.

## Folder structure

```
geo-service/
├── app.py                 # Flask app: routes, error handlers, key check
├── breakpoints.py         # find_break_points (pure function)
├── geo.py                 # haversine_meters, cumulative_distances, point_at_distance
├── validation.py          # validate_request(body) -> cleaned data or raises ValidationError
├── tests/
│   ├── test_geo.py
│   ├── test_breakpoints.py
│   └── test_api.py
├── requirements.txt       # flask, gunicorn
├── requirements-dev.txt   # pytest
└── .env.example
```

Keep the logic in `breakpoints.py` and `geo.py` free of any Flask import, so it can be tested and explained on its own. `app.py` only reads the request, calls `validate_request`, calls `find_break_points`, and returns JSON.

Dependencies: keep them minimal. Flask for the web server and gunicorn for running it on Render. Implement haversine with the standard `math` module instead of adding `geopy` or `shapely`: it is about ten lines, it removes a dependency, and it is easier to explain at the exam. Ask before adding anything else.

## Configuration

| Variable | Purpose | Local default |
|---|---|---|
| `PORT` | Port to listen on (Render sets it) | `5000` |
| `GEO_SERVICE_KEY` | Shared secret that Express must send | empty (check disabled, with a startup warning) |
| `MAX_CONTENT_LENGTH` | Request size limit in bytes | `5242880` |

Add `GEO_SERVICE_KEY` to the backend's `.env` and `.env.example` as well, so Express can send it. Keep real values out of git.

## Security

- The service holds no secrets or user data, but it is reachable on a public URL when deployed, and it uses CPU. A shared secret keeps strangers from using it.
- Express sends the key in the `X-Service-Key` header. The service compares it with `hmac.compare_digest` (a constant-time comparison) and returns 401 on a mismatch.
- When `GEO_SERVICE_KEY` is not set (local development), skip the check and print a warning at startup.
- `/health` does not require the key.
- Do not log coordinates. They can reveal where a person is travelling. Log at most the number of legs, the number of break points found, and how long the calculation took.
- Never return stack traces. Register error handlers so that 400, 404, 405, 413, and 500 all return the JSON error shape.

## How Express calls it

A small client module in the backend (`services/geoServiceClient.ts`), used by the plan orchestration in `trip-planning.md`:

- Sends `POST {GEO_SERVICE_URL}/find-break-points` with the legs from the route result for the **final order**, the driving limit in seconds, and the `X-Service-Key` header.
- Timeout: 30 seconds, because a sleeping Render service can take a long time to wake up.
- Validates the response shape with Zod before using it.
- On any failure (timeout, connection refused, non-2xx, bad shape), it does not throw to the user. It returns "unavailable", and the plan continues with `breakPoints: []` and a `BREAK_POINTS_UNAVAILABLE` warning.
- Never forwards the raw error text from the service to the browser.

### Cold starts

Render's free web services sleep after a period of inactivity and take a while to wake up on the next request. Two mitigations, both optional:
- A **Could**: when the user opens the Plan page, Express (or the frontend, through Express) sends a quick `GET /health` to the Python service in the background, so it is awake by the time the user presses "Plan trip".
- Before a demo, open the `/health` URL a few minutes in advance.

## Deployment

- Render web service, Root Directory `geo-service`.
- Build command: `pip install -r requirements.txt`.
- Start command: `gunicorn app:app`.
- Health check path: `/health`.
- Environment variables: `GEO_SERVICE_KEY` (the same value as in the backend), and optionally `MAX_CONTENT_LENGTH`.
- Set the Python version explicitly in the platform settings so that local and deployed versions match.
- Locally: create a virtual environment, install requirements, and run `flask --app app run --port 5000`.

## Edge cases

- Empty `legs` list: return `{ "breakPoints": [] }`.
- All legs under the limit: return an empty list.
- A leg of exactly `k` times the limit: no break point at its end.
- A leg that is only a little over the limit (for example 4 h 01 min with a 4 h limit): one break point, very close to the end of the leg.
- A very long leg (for example 30 hours): several break points, one per full multiple of the limit that falls inside the leg.
- A leg with `durationSeconds` of 0 but coordinates present: no break points.
- A leg whose coordinates are all the same point: skipped, no error.
- Repeated consecutive points inside a leg: handled without division by zero.
- `distanceMeters` does not match the length of the line: ignored. The placement uses the line itself.
- Floating point durations (for example `14400.4`): rounded to whole seconds before comparing.
- Coordinates given as `[lat, lon]` by mistake: cannot be detected reliably. Validation only checks ranges, and a latitude above 90 is rejected. The convention is enforced by tests and by the Facade conversion in Express.
- Very large request body: 413, not a crash.
- Route crossing the antimeridian (longitude jump from 179 to -179): out of scope, the project is for roads in Europe.
- Non-JSON body or wrong content type: 400.
- Wrong HTTP method on a route: 405 in JSON.

## Tests

Automated, with `pytest`, run from `geo-service/` (Must unless marked):

`test_geo.py`
- `haversine_meters` between two points a known distance apart (for example one degree of longitude on the equator is about 111.19 km), within 0.1 percent.
- `cumulative_distances` starts at 0 and grows with each point.
- `point_at_distance` at 0 returns the first point, at the total length returns the last point, and halfway on the equator line returns the midpoint.
- Repeated consecutive points do not break `point_at_distance`.

`test_breakpoints.py`
- The equator example: a 10 hour leg from `[0, 0]` to `[10, 0]` with a 4 hour limit gives break points near longitude 4.0 and 8.0, with `cumulativeSeconds` 14400 and 28800.
- A leg of exactly 4 hours with a 4 hour limit gives none.
- A leg of 3 h 59 min gives none. A leg of 4 h 01 min gives exactly one, close to the end.
- Two legs of 5 h and 2 h with a 4 hour limit give one break point, in leg 0, because the counter resets.
- Several legs: `legIndex` values are correct and the output is in route order.
- A bent line (several segments): each returned point's distance along the line equals the expected fraction times the line length, within 1 meter.
- Empty `legs` gives an empty list.
- A degenerate leg (identical points) gives no break points and no exception.
- (Should) A leg with 50,000 coordinates finishes in under 1 second.

`test_api.py`
- 200 with the equator example, and the response shape matches this spec.
- 400 for: invalid JSON, missing `legs`, missing `maxDrivingSeconds`, `maxDrivingSeconds` out of range, a leg with one point, a coordinate out of range, a string where a number is expected.
- 401 when `GEO_SERVICE_KEY` is set and the header is missing or wrong, and 200 when it is correct.
- `/health` returns 200 without the key.
- A wrong method returns 405 in the JSON error shape.

Manual:
- Call the endpoint with `curl` or a REST client using the equator example, locally and on the deployed URL.
- Take a real route from Geoapify (for example Stockholm to Malmo), send it, and check on the map that the break point lies on the route at a sensible place.
- Stop the service and confirm that the Express plan still returns a route with the warning.
- Let the deployed service sleep, then plan a trip, and confirm that the first request still succeeds (slowly) within the timeout.

## Suggested build order (new to Python)

1. Set up the virtual environment and write `geo.py` with `haversine_meters`, plus its tests. Run them with `pytest`.
2. Write `cumulative_distances` and `point_at_distance`, with tests.
3. Write `find_break_points`, with the tests above. The equator test comes first.
4. Write `validation.py`.
5. Add Flask: `/health`, then `/find-break-points`, with the API tests.
6. Add the key check and the JSON error handlers.
7. Deploy to Render, then connect Express through `geoServiceClient.ts`.

Doing the pure logic with tests before touching Flask keeps the learning small: you only need to understand Python syntax and a little geometry before you need to understand web servers.

## Out of scope

- Database access, user accounts, or any stored state
- Calling Geoapify or any other external service
- Routing, geocoding, and accommodation search (those are in Express and the Facade)
- Machine learning, clustering, or route optimization (a possible Could, see below)
- Distance-based limits (version 1 uses time only)
- Handling of the antimeridian or polar routes
- Rate limiting, request queues, or caching

## Could (later)

- **More accurate placement:** if the Facade also passes the per-step durations and distances from Geoapify's response, place break points by time using those steps instead of assuming constant speed.
- **Distance limit:** accept an optional `maxDrivingMeters` and place break points by whichever limit is reached first.
- **Snap to a place:** after finding a point, move it to a nearby town or exit so that the suggested stop is somewhere sensible. This probably belongs in Express with the accommodation search.
- **Fully free ordering:** a second endpoint, `POST /optimize-order`, that takes a time or distance matrix and returns the best visiting order. See the "Fully free ordering" section in `trip-planning.md`. This would be a good report topic (the traveling salesman problem) and gets its own spec if built.

## Open questions

- How large is the error from the constant-speed assumption on a real route? Compare the break point position with Geoapify's step-by-step times on one or two long routes, and decide if the Could for step-based placement is worth building.
- Should break points be spaced evenly (as now), or should the last stretch before a destination be shorter so the user does not get a stop right before arriving? Current decision: keep it simple, as now. Revisit if it looks odd on real routes.
- Is the 30 second timeout from Express sensible on the free Render tier? Measure a cold start and adjust.
- Is the shared-secret header enough, or is it overkill for this project? It is cheap to build and easy to explain, so the current decision is to keep it as a Should.
- Should the response include extra fields, such as the distance along the leg, for easier debugging? Add only if testing shows a need.

## Things I must be able to explain (oral exam)

- Why this is a separate microservice and not a function inside Express (and what a script would have meant instead).
- What a pure function is, and why it makes the logic easy to test.
- What the haversine formula calculates, and why we do not just use straight-line distance on longitude and latitude.
- How a point is found at a given distance along a line made of many segments.
- What the constant-speed assumption is, why it is wrong sometimes, and why it is still acceptable here.
- Why break points use a strict comparison, and why the counter resets at each leg.
- Why the service is stateless and has no CORS, and why Express sends a shared key.
- What happens in the whole plan flow when this service is down or asleep.
- The difference between running with `flask run` locally and `gunicorn` in production.

## Definition of Done

Follow the Definition of Done in `CLAUDE.md`. For this spec specifically, also confirm:
- [ ] All `pytest` tests pass, including the equator example and the "counter resets between legs" case.
- [ ] A real route (Stockholm to Malmo or similar) produces break points that visibly lie on the route.
- [ ] No coordinates appear in the logs, locally or on Render.
- [ ] The deployed service answers `/health`, rejects a wrong `X-Service-Key`, and is called successfully from the deployed Express backend, including after a cold start.
- [ ] The contract in `CLAUDE.md` is updated to match this spec (`location: [lon, lat]`, `GEO_SERVICE_KEY`).