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
- As a guest, I see suggestions while I type a destination, so I don't have to guess the exact spelling (Should).
- As a guest, I can search for landmarks and tourist attractions by name, not only addresses and cities (Should).
- As a guest, I can pick a suggestion with the mouse or the keyboard (Should).

## Acceptance criteria

Destinations and geocoding
- [ ] [Must] The user can add at least 2 and at most 10 destinations.
- [ ] [Must] Typing an address and submitting calls `POST /api/geocode` and shows up to 5 candidate matches. Choosing one adds the destination with its coordinates and shows a numbered marker on the map immediately.
- [ ] [Must] If no match is found, the user sees "We could not find that address" and nothing is added.
- [ ] [Must] A destination can be removed, and the markers and numbering update.
- [ ] [Should] The start can be filled from the browser's location (see Geolocation below).

Autocomplete
- [ ] [Should] After the user has typed at least 3 characters and paused for about 300 ms, up to 5 suggestions are shown in a dropdown under the field.
- [ ] [Should] Suggestions include addresses, cities, and points of interest (landmarks, attractions). Each has a label and an icon based on its `kind`.
- [ ] [Should] Choosing a suggestion adds the destination directly with its coordinates. No second geocoding request is made.
- [ ] [Should] The dropdown works with the keyboard: arrow up/down moves the highlight, Enter selects, Escape closes it.
- [ ] [Should] If the user keeps typing, responses to older requests are ignored or cancelled, so outdated suggestions never replace newer ones.
- [ ] [Should] If there are no matches, the dropdown shows "No results".
- [ ] [Should] If the suggestion request fails (network error, rate limit, service down), the field still works: the user can press Enter to run the normal geocode search (`POST /api/geocode`), and a short message explains that suggestions are unavailable.
- [ ] [Should] Suggestions are biased towards the current map center when it is known, so nearby places rank higher.
- [ ] [Should] The suggestion endpoint is rate limited, so that a burst of typing cannot use up the daily Geoapify quota.
- [ ] [Should] The dropdown uses correct combobox semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, options with `role="option"`) so that it works with screen readers.
- [ ] [Could] Recently chosen places are shown when the field is focused and empty.

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

Places (accommodation and attractions)
- [ ] [Must] Accommodation near a break point is found with the Geoapify Places API, through the Facade only. No other code calls Places.
- [ ] [Must] Results are normalized to our own `Accommodation` type (not raw Geoapify features), sorted by distance from the break point, with at most 5 results.
- [ ] [Must] Places without a name are dropped, and duplicates (same Geoapify place id) are removed.
- [ ] [Must] If no places are found within 10 km, one retry is made with 25 km. If still nothing is found, the result is an empty list, not an error.
- [ ] [Must] A failed Places request never fails the whole plan: the break point is returned with an empty list and an `ACCOMMODATION_UNAVAILABLE` warning.
- [ ] [Must] The distance shown to the user is labeled as straight-line distance from the stop ("about 3 km from the stop"), not driving distance.
- [ ] [Should] When several accommodation types are requested, they are searched in one request per break point (several categories in one call), and each result gets its `type` from the categories in the response.
- [ ] [Should] A plan creates at most 10 accommodation searches in total. If the route has more break points, accommodation is searched for the first 10 and a `TOO_MANY_BREAK_POINTS` warning is added.
- [ ] [Could] `POST /api/places/attractions` returns sights and tourist attractions around a point. A "Sights nearby" button on a destination shows them in a list with an "Add as stop" action.

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


### GET /api/geocode/autocomplete

Auth: `optionalAuth`. Rate limited per IP (see Configuration).

Query parameters:
- `text` (required): the text typed so far, trimmed, 3-200 characters.
- `lat`, `lon` (optional, both or neither): map center used as a ranking bias.
- `lang` (optional): two-letter language code, default `sv`.

Response 200:
````json
{
  "results": [
    { "label": "Liseberg, Gothenburg, Sweden", "location": [11.9916, 57.6955], "kind": "poi" },
    { "label": "Lisebergsgatan, Gothenburg, Sweden", "location": [11.9890, 57.6951], "kind": "address" }
  ]
}
````

An empty `results` array (not an error) means nothing matched.

Errors: 400 `VALIDATION_ERROR`, 429 `RATE_LIMITED`, 503 `UPSTREAM_UNAVAILABLE`, 503 `UPSTREAM_RATE_LIMITED`.

### Change to POST /api/geocode

Each result now also carries `kind`, so that both endpoints return the same type:

````json
{ "label": "...", "location": [11.99, 57.69], "kind": "address" }
````

`kind` is one of `address`, `city`, `poi`. The Facade maps Geoapify's result types to these three values. Landmarks and attractions are not filtered out (do not restrict the search to addresses or cities only).

### Change to the plan response (accommodation items)

Each accommodation item now also carries an `id` (the Geoapify place id, so it can later be stored as a favorite) and an optional `address`:

````json
{
  "id": "51a3...",
  "name": "Hotel Example",
  "type": "hotel",
  "location": [15.61, 58.41],
  "distanceMeters": 900,
  "address": "Storgatan 1, Jonkoping"
}
````

`distanceMeters` is the straight-line distance from the break point, not a driving distance.

New warning code: `TOO_MANY_BREAK_POINTS`.

### POST /api/places/attractions (Could)

Auth: `optionalAuth`. Rate limited per IP (same mechanism as the autocomplete endpoint).

Request:
````json
{
  "location": [11.9746, 57.7089],
  "radiusMeters": 5000,
  "limit": 20,
  "lang": "sv"
}
````

Response 200:
````json
{
  "results": [
    {
      "id": "7c1e...",
      "name": "Liseberg",
      "kind": "attraction",
      "location": [11.9916, 57.6955],
      "distanceMeters": 2100,
      "categories": ["tourism", "tourism.attraction"]
    }
  ]
}
````

An empty `results` array (not an error) means nothing was found. Errors: 400 `VALIDATION_ERROR`, 429 `RATE_LIMITED`, 503 `UPSTREAM_UNAVAILABLE`, 503 `UPSTREAM_RATE_LIMITED`.

When the user adds a result as a stop, the destination gets `kind: "poi"` and keeps its `id`.

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

type GeocodeResult = { label: string; location: LonLat; kind: 'address' | 'city' | 'poi' };

interface GeoapifyFacade {
  // geocode now returns GeocodeResult[] instead of { label, location }[]
  geocode(query: string): Promise<GeocodeResult[]>;
  autocomplete(
    text: string,
    options?: { bias?: LonLat; lang?: string; limit?: number }
  ): Promise<GeocodeResult[]>;
  // getRoute and findAccommodation unchanged
}

type AccommodationType = 'hotel' | 'hostel' | 'camping' | 'parking';

interface Accommodation {
  id: string;                 // Geoapify place id
  name: string;
  type: AccommodationType;
  location: LonLat;
  distanceMeters: number;     // straight line from the search point
  address?: string;
}

interface Place {
  id: string;
  name: string;
  kind: 'attraction';
  location: LonLat;
  distanceMeters: number;
  categories: string[];
}

interface GeoapifyFacade {
  // existing: geocode, autocomplete, getRoute
  findAccommodation(point: LonLat, radiusMeters: number, types: AccommodationType[]): Promise<Accommodation[]>;
  findAttractions(point: LonLat, radiusMeters: number, limit?: number): Promise<Place[]>;   // Could
}
```

Notes for the implementation (details stay inside the Facade):
- Geoapify's routing request has an option to reorder the intermediate stops. According to the Geoapify documentation, the first and last waypoint stay fixed and only the stops in between are reordered. Check the current documentation for the exact parameter and response fields when implementing.
- The routing request takes waypoints as `latitude,longitude` while our code and the response use `[longitude, latitude]`. Convert in the Facade only, and nowhere else.
- Map the order Geoapify reports back to indices of the input array, so the rest of the code only sees `waypointOrder`.
- `autocomplete` uses Geoapify's autocomplete endpoint, which is built for partial input, while `geocode` uses the regular search endpoint. Both return the same normalized type, and `geocode` and `autocomplete` share the code that maps Geoapify results to `kind`.
- The API key stays in the backend. The browser never calls Geoapify, and Geoapify's own autocomplete package (which expects the key in the browser) is not used.
- Places is a separate Geoapify API from geocoding: `GET /v2/places` with `categories` (required), `filter`, `bias`, `limit`, `lang`, and an optional `name` filter. The Facade builds the query and hides all of this.
- Search area and ranking: `filter` limits results to a circle around the point, and `bias=proximity:<lon>,<lat>` ranks by closeness. Check the current documentation for the exact filter syntax before implementing. Coordinates in these parameters are written longitude first.
- The distance returned by Places is measured in a straight line from the bias point. Do not present it as driving distance.
- Categories are hierarchical: asking for `accommodation` returns all its subcategories, and asking for `accommodation.hotel` only hotels. Prefer the narrow categories from the table below, so that results match what the user asked for.
- The Facade maps categories in the response back to our `AccommodationType`. A place with several categories gets the first match in the order of the user's preference.
- Normalization: drop places without a name, remove duplicates by place id, sort by distance, apply the limit.
- Use one request for all requested types (several categories in one call) to save quota.

## Category mapping

Source of truth is Geoapify’s category list. Verify each value there before relying on it.

| Our type | Geoapify category | Notes |
|---|---|---|
| `hotel` | `accommodation.hotel` | Start narrow. Add `accommodation.guest_house` and `accommodation.motel` if too few results are found (see Open questions) |
| `hostel` | `accommodation.hostel` | |
| `camping` | `camping.camp_site` | Check whether `camping.caravan_site` should be included for motorhomes |
| `parking` | `parking.cars` | Does not say whether overnight stays are allowed. Treat as a known limitation, see below |
| attraction (Could) | `tourism.sights`, `tourism.attraction` | Parent categories include their subcategories |

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
- `/api/geocode/autocomplete`: `text` trimmed string of 3-200 characters; `lat` and `lon` numbers in range and given together; `lang` a two-letter code.
- `/api/places/attractions`: `location` two numbers in range, `radiusMeters` 500-25000 (default 5000), `limit` 1-50 (default 20), `lang` a two-letter code (default `sv`).

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

## Configuration

- Rate limit for `/api/geocode/autocomplete`: start with 60 requests per minute per IP, returned as 429 `RATE_LIMITED`. Tune when testing.
- Frontend: debounce 300 ms, minimum 3 characters, maximum 5 suggestions.
- Search radius: 10 km first, one retry at 25 km. Maximum 5 accommodation results per break point.
- At most 10 accommodation searches per plan.
- Timeout for each Places request: 10 seconds.
- Attractions: default radius 5 km, default limit 20, maximum radius 25 km, maximum limit 50.

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
- **Search field:** a single field with a dropdown. While a request is running, show a small spinner inside the field. The dropdown closes on Escape, on selection, and when the field loses focus.
- **Suggestions list:** each row shows an icon for `kind` (address, city, point of interest) and the label. The highlighted row is visible and follows the arrow keys.
- **Selecting:** adds the destination at once and clears the field, with a numbered marker on the map. No extra "confirm" step is needed.
- **Enter without a selection:** runs the normal `POST /api/geocode` search and shows the candidate list from the existing flow.
- **Cancelling requests:** every new keystroke cancels the previous request (`AbortController`). A request that finishes after a newer one has started is ignored.
- **Waking the backend:** when the Plan page opens, the frontend sends a quiet `GET /api/health` in the background, so that a sleeping Render service is already awake when the user starts typing.
- **Fallback message:** if suggestions fail, show a small line under the field ("Suggestions are unavailable, press Enter to search"), not an error banner.
- **Accommodation list:** under each break point, show up to 5 places with name, type icon, and "about X km from the stop". The distance label is clear that it is a straight line.
- **Empty state:** "No accommodation found nearby" with no error styling. If the search failed, show the warning instead ("Accommodation could not be loaded for this stop").
- **Too many break points:** a short notice says accommodation is shown for the first 10 stops only.
- **Highlighting:** clicking a place highlights its marker, and clicking a marker highlights the list item.
- **Sights nearby (Could):** a small button on each destination opens a list of attractions around it. Each row has name, distance, and an "Add as stop" button. Adding a stop does not re-plan automatically, the user presses "Plan trip" again.

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
- Backend asleep (Render cold start): the first suggestion request can take a long time. The user can keep typing and press Enter. The background wake-up request on page load reduces the chance of this.
- Slow network: older requests are cancelled, and the dropdown keeps showing the previous suggestions or a spinner, never mixed results from different texts.
- User types very fast, then pastes a long address: debounce means only the final text is sent.
- Text shorter than 3 characters: no request is sent, the dropdown is closed.
- Text contains special characters (a-ring, a-umlaut, o-umlaut, apostrophes, ampersands): must be URL-encoded when the frontend calls the backend and when the Facade calls Geoapify.
- Same place shown twice with different labels: show both, but remove exact duplicates (same label and coordinates).
- Geoapify daily quota is used up: the endpoint returns 503 `UPSTREAM_RATE_LIMITED`, the field falls back to Enter-to-search, and the message explains it.
- Rate limit hit (429): the field falls back to Enter-to-search for a short while and does not retry in a tight loop.
- User selects a suggestion and then edits the text: the already added destination is unchanged, and the field starts a new search.
- Browser autofill or password managers suggesting their own values: set `autocomplete="off"` on the field so it does not clash with our dropdown.
- A suggestion with a point of interest outside the area Geoapify can route in: it is still added, and the route request returns `ROUTE_NOT_FOUND` later, as usual.
- Places returns a place without a name: dropped. If all results are dropped, treat it as "no results" and retry with the larger radius.
- Same place returned twice: removed by place id.
- A place has several accommodation categories: it gets one `type`, chosen by the user's preference order.
- Break point in a very remote area: empty list after both radii, shown with the empty-state message.
- A long route with a short driving limit gives many break points: capped at 10 searches, with the `TOO_MANY_BREAK_POINTS` warning.
- Geoapify quota exceeded during a plan: the accommodation part is skipped with a warning, and the route and break points are still returned.
- Places returns an unexpected shape: the Facade throws a typed error, which the orchestration turns into `ACCOMMODATION_UNAVAILABLE`.
- Parking results: the category does not guarantee that overnight parking is allowed. Show the type label "Parking" without claiming that sleeping there is allowed.
- Place names in another script or language: shown as returned. `lang` only affects languages Geoapify supports.
- The same attraction found near two neighboring destinations: allowed in both lists.

## Tests

Automated (Should):
- Zod validation: too few or too many destinations, missing both `location` and `address`, missing or duplicated `id`, out-of-range coordinates, bad `maxDrivingHours`.
- Plan orchestration with a mocked Facade and a mocked Python client: success, Python failure gives a warning with a route, accommodation failure gives a warning, routing failure gives an error.
- Ordering with a mocked Facade: a changed `waypointOrder` produces the right `order` and `inputIndex`, the first and last destinations stay in place, and an unchanged order gives `orderOptimized: false`.
- Optimization failure: the plan falls back to the given order and returns an `ORDER_OPTIMIZATION_UNAVAILABLE` warning.
- Facade tests with recorded sample responses (so tests do not use up the Geoapify quota), including the mapping from Geoapify's reported order to input indices.
- Zod validation of the autocomplete query: too short text, text too long, only one of `lat`/`lon`, out-of-range coordinates.
- Facade `autocomplete` with a recorded Geoapify response: results are mapped to `kind` correctly, the limit is respected, and exact duplicates are removed.
- Rate limiting: the 61st request in a minute from one IP returns 429 (use a low limit in the test configuration).
- Frontend: a hook or component test that checks the debounce, the minimum length, and that a stale response does not overwrite a newer one (use fake timers and a mocked API).
- Facade `findAccommodation` with a recorded Places response: categories map to the right `type`, unnamed places are dropped, duplicates removed, results sorted by distance, limit applied.
- Query building: the generated request contains the right categories, a longitude-first filter and bias, the limit, and the language. Test this by inspecting the URL the Facade would call, without sending it.
- Orchestration with a mocked Facade: empty result at 10 km triggers one retry at 25 km, an empty result at 25 km gives an empty list, a Facade error gives an `ACCOMMODATION_UNAVAILABLE` warning, and more than 10 break points gives `TOO_MANY_BREAK_POINTS` and exactly 10 searches.
- Zod validation for `/api/places/attractions` (Could).

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
- Type "Lisebe" and see Liseberg among the suggestions. Type a street and see addresses. Type a city and see the city.
- Use only the keyboard: type, arrow down, Enter, and see the destination added.
- Throttle the network in the browser's developer tools and check that old results never replace new ones.
- Stop the backend and check that the field still works with Enter and shows the fallback message.
- Type quickly for a minute and check that the rate limit protects the quota without breaking the field.
- Check the number of Geoapify requests used after a normal planning session and compare it with the daily quota.
- Plan a route with a break point near a town and check that hotels appear and sit close to the stop on the map.
- Plan a route through a sparsely populated area and check that the retry at 25 km happens and that an empty list shows the empty-state message.
- Use a wrong key and check that the route is still returned with a warning.
- Check that no result without a name is shown, and that distances are labeled as straight-line.
- (Could) Search sights near Gothenburg and check that well-known attractions appear. Do not assume that a specific one is always present.

## Out of scope

- Optimization with several vehicles, time windows, capacities, or other operational constraints (Geoapify's Route Planner API)
- Alternative routes, avoid tolls or ferries, other transport modes
- Distance-based limits (time only in the MVP; a distance limit is a Could)
- Multi-day itineraries with arrival times, opening hours, prices, availability, or booking
- Live traffic
- Dragging the route or waypoints on the map
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
- How does Geoapify count autocomplete requests against the daily credit quota? Check the pricing page before changing debounce or minimum length.
- What are good rate limit values? 60 per minute per IP is a guess. Check against real typing behavior.
- How well do landmarks rank next to street addresses? If attractions are buried, consider two groups in the dropdown ("Places" and "Addresses") or a small toggle before the field.
- Which Geoapify result types map to `poi`? Check real responses and adjust the mapping in the Facade.
- Should suggestions be restricted to a country or region by default (for example Sweden or Europe)? Decide after testing ambiguous names.
- Should `hotel` include `accommodation.guest_house` and `accommodation.motel`? Test on a few real routes and compare the results with only `accommodation.hotel`.
- Which category covers motorhome pitches (`camping.caravan_site`?), and does Geoapify have any way to tell that overnight parking is allowed? Check the category and condition lists. If not, remove `parking` from the MVP or label it clearly.
- What is the exact filter syntax for a circle around a point, and how many credits does a Places request cost compared with geocoding? Check the documentation and pricing page before fixing the limit of 10 searches per plan.
- Does `distanceMeters` need a driving-distance version? Straight-line may mislead near water or across mountains. Revisit if testing shows odd results.
- Should the break point be moved to the nearest town before searching, so that results are more useful? This belongs to the Could list in `python-service.md`.
- Should attraction results be cached by rounded coordinates to save quota? Decide only if the quota becomes a problem.

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
- Why autocomplete goes through Express instead of using Geoapify's browser package directly, and what the trade-off is (API key exposure and quota control versus extra latency and cold starts).
- What debounce is, why minimum length and a request limit matter for the quota, and why stale responses must be ignored or cancelled (race conditions).
- How the rate limit protects the quota, and why it returns 429.
- Why selecting a suggestion needs no second geocoding request.
- What `kind` is, and why both endpoints return the same normalized type.
- How the Places API differs from the Geocoding API (search by category and area instead of by text).
- What hierarchical categories mean, and why the Facade uses narrow categories.
- Why distance from Places is a straight line, and what that means for the user.
- Why several types are searched in one request, and why the number of searches per plan is capped.
- Why a Places failure gives a warning, not an error.
- Why the Facade, and not the controller, maps Geoapify categories to our own types.

## Definition of Done

Follow the Definition of Done in `CLAUDE.md`. For this spec specifically, also confirm:
- [ ] The demo script from `CLAUDE.md` (Stockholm, Gothenburg, Malmo) works in the deployed version.
- [ ] No Geoapify key appears in the browser's network tab or in the repository.
- [ ] Every failure case in Edge cases that is marked as handled has been triggered at least once by hand.
- [ ] Marker numbers, list numbers, legs, and break points all match after an optimized plan and after a manual move.
- [ ] Suggestions work with mouse and keyboard in the deployed version, including after the backend has been asleep.
- [ ] The Geoapify key does not appear in the browser's network tab while typing.
- [ ] A normal planning session stays well below the daily Geoapify quota.
- [ ] The category names used in the Facade have been checked against Geoapify's current category list.
- [ ] A real route shows hotels near its break points in the deployed version, and the empty-state and warning cases have been triggered at least once by hand.
- [ ] A normal planning session (including the 25 km retry) stays well below the daily Geoapify quota.