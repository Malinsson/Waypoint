# Accommodation Suggestions

Status: draft. Priority: Must for hotels (MVP), Should for hostels and camping and for choosing types, Could for parking and the other extras. Built in weeks 3-4. Related: `CLAUDE.md`, `specs/trip-planning.md` (calls this logic for every break point and defines the Places basics), `specs/python-service.md` (produces the break points), `specs/favorites.md`, `specs/trips-and-ratings.md`.

## Purpose

For each break point on a route, suggest a few places to stay nearby, matching what the user prefers: hotel, hostel, camping, or parking. This is the part of the app that turns "you should stop here" into something useful. The app only suggests places. It does not book, show prices, or check availability.

## User stories

- As a guest, I see hotel suggestions near each stop on my route (MVP).
- As a guest, I can choose which kinds of accommodation I want: hotel, hostel, camping, parking (Should).
- As a guest, I see how far each suggestion is from the stop, and what kind of place it is.
- As a guest, I can click a suggestion to see it on the map and read its name, type, and address.
- As a guest, I am told clearly when nothing was found near a stop, instead of seeing an empty list with no explanation.
- As a logged-in user, I can save a suggested place as a favorite (Should, see `favorites.md`).
- As a guest, I can see that the suggestions are not bookings and that I need to check availability myself.

## Acceptance criteria

Core (MVP)
- [ ] [Must] Every break point has an `accommodation` list with up to 5 hotels, found through the Geoapify Places API via the Facade.
- [ ] [Must] Each suggestion has an id, a name, a type, a location, a distance from the stop, and, when available, an address.
- [ ] [Must] Places without a name are never shown, and the same place never appears twice.
- [ ] [Must] If nothing is found within 10 km, the search is repeated once with 25 km. If it is still empty, the break point is returned with an empty list and the UI says "No accommodation found nearby".
- [ ] [Must] A failed search never fails the whole plan (warning only, see `trip-planning.md`).
- [ ] [Must] The UI says that distances are straight-line distances from the stop and that suggestions are not bookings.

Types and preferences
- [ ] [Should] The user can select one or more of `hotel`, `hostel`, `camping`. At least one must be selected, and `hotel` is the default.
- [ ] [Should] Every selected type is searched with its own request, so that a type with few places is not crowded out by one with many.
- [ ] [Should] When several types are selected, the (up to 5) results are picked in turns across the selected types, nearest first within each type, so that every selected type that has results is represented.
- [ ] [Should] The final list is sorted by distance from the stop, with a type icon on every row and on the map marker.
- [ ] [Should] If some types fail but others succeed, the successful results are shown together with an `ACCOMMODATION_PARTIAL` warning.
- [ ] [Should] Choosing the accommodation types happens in the options panel before planning, and the choice is stored with a saved trip.
- [ ] [Could] `parking` as a fourth type, with a clear label that overnight parking may not be allowed.
- [ ] [Could] A type can be changed for a single stop ("Show camping instead") without re-planning the whole trip.
- [ ] [Could] Filter chips on the map to hide or show types after planning.

Limits and quota
- [ ] [Should] Accommodation is searched for at most 10 break points per plan (see `TOO_MANY_BREAK_POINTS` in `trip-planning.md`).
- [ ] [Should] A plan makes at most 30 Places requests in total. Past that, remaining break points get an `ACCOMMODATION_LIMIT_REACHED` warning and an empty list.
- [ ] [Should] No more than 3 Places requests run at the same time.
- [ ] [Could] Results are cached for a day by rounded coordinates, type, and radius, so replanning the same route does not use more quota.

## How a search works (per break point)

Input: a break point `[lon, lat]`, the selected types in order, and a radius (10 km first).

1. For each selected type, in parallel, the matching **finder** asks the Facade for places in that type's categories within the radius (limit 20). Each finder returns normalized `Accommodation` items: named places only, no duplicates, sorted by distance.
2. If the total number of results over all types is 0 and the radius was 10 km, repeat step 1 once with 25 km. (The retry happens only when everything is empty, to save quota.)
3. Remove places that appear under more than one type (same place id). Keep the type that comes first in the user's order.
4. Pick up to 5 results in turns: take the nearest unused result from the first type, then from the second type, and so on, repeating until 5 results are picked or all types are used up. A type with no results is skipped.
5. Sort the final list by distance from the stop.
6. Return the list together with the radius that produced it (10 000 or 25 000 meters).

Example: types `[hotel, camping]`, with 4 hotels (nearest at 1, 2, 3, 9 km) and 2 campsites (4 km and 8 km). Picked in turns: hotel 1 km, camping 4 km, hotel 2 km, camping 8 km, hotel 3 km. Displayed in order of distance: 1, 2, 3, 4, 8 km.

With one type the method degenerates to "the 5 nearest places of that type".

## Types and categories

| Our type | Geoapify category | Priority | Notes |
|---|---|---|---|
| `hotel` | `accommodation.hotel` | Must | Add `accommodation.guest_house` and `accommodation.motel` if too few results (see Open questions) |
| `hostel` | `accommodation.hostel` | Should | |
| `camping` | `camping.camp_site` | Should | Check `camping.caravan_site` for motorhome pitches |
| `parking` | `parking.cars` | Could | Geoapify does not say whether overnight stays are allowed |

Categories are hierarchical (a parent includes its children), so use the narrow categories from the table. Verify every value in Geoapify's current category list before relying on it. The table is the single source of truth in the code (one place that maps a type to its categories).

## Design: finders and the Factory

This is where the Factory pattern from `CLAUDE.md` is used.

```ts
type LonLat = [number, number];
type AccommodationType = 'hotel' | 'hostel' | 'camping' | 'parking';

interface Accommodation {
  id: string;                 // Geoapify place id
  name: string;
  type: AccommodationType;
  location: LonLat;
  distanceMeters: number;     // straight line from the stop
  address?: string;
}

interface AccommodationFinder {
  readonly type: AccommodationType;
  readonly categories: string[];
  search(point: LonLat, radiusMeters: number): Promise<Accommodation[]>;
}

class AccommodationFinderFactory {
  static get(type: AccommodationType): AccommodationFinder;
}
```

- Each finder knows its type and categories and how to turn a Places feature into an `Accommodation` (name, address, distance, type).
- Finders do **not** call Geoapify themselves. They receive a `searchPlaces(categories, point, radius, limit)` function from the Facade (a plain function passed in, no framework needed). This keeps the Facade the only code that talks to Geoapify, and lets tests pass a fake function.
- `GeoapifyFacade.findAccommodation(point, radiusMeters, types)` runs the steps from "How a search works" above: gets the finders from the factory, runs them in parallel, merges, retries, and returns the result.
- The selection step (steps 3-5) is a **pure function**: it takes lists of results per type and returns the final list. This makes it easy to test with the example above.

Adding a new type later means a new finder class plus a line in the factory and in the category table. Nothing else changes.

## API

### Change to the plan request

`options.accommodationTypes` is an ordered array of `AccommodationType`. The order is used for tie-breaking and for the turn order in step 4. In the UI the order is the fixed order of the checkboxes (hotel, hostel, camping, parking). A user-defined order is a Could.

Validation: array of 1-4 distinct allowed values, default `["hotel"]`. MVP: only `hotel` is accepted, the others return 400 until they are implemented.

### Change to the plan response (per break point)

````json
{
  "legIndex": 0,
  "location": [15.6, 58.4],
  "cumulativeSeconds": 14400,
  "accommodationRadiusMeters": 10000,
  "accommodation": [
    {
      "id": "51a3...",
      "name": "Hotel Example",
      "type": "hotel",
      "location": [15.61, 58.41],
      "distanceMeters": 900,
      "address": "Storgatan 1, Jonkoping"
    }
  ]
}
````

`accommodationRadiusMeters` tells the UI which radius produced the result (10 000 or 25 000), so that it can say "within 25 km" when the wider search was needed.

New warning codes:
- `ACCOMMODATION_PARTIAL`: some selected types failed and the rest succeeded.
- `ACCOMMODATION_LIMIT_REACHED`: the per-plan request limit was hit.

(`ACCOMMODATION_UNAVAILABLE` and `TOO_MANY_BREAK_POINTS` are already defined in `trip-planning.md`.)

### POST /api/accommodation/search (Could)

Auth: `optionalAuth`. Rate limited per IP.

Searches one point without re-planning, used by "Show camping instead" and "Show more".

Request:
````json
{ "location": [15.6, 58.4], "types": ["camping"], "radiusMeters": 10000 }
````

Response 200:
````json
{ "accommodationRadiusMeters": 10000, "accommodation": [] }
````

Validation: `location` two numbers in range, `types` 1-4 distinct allowed values, `radiusMeters` 1000-50000 (default 10000). Errors: 400 `VALIDATION_ERROR`, 429 `RATE_LIMITED`, 503 `UPSTREAM_UNAVAILABLE`, 503 `UPSTREAM_RATE_LIMITED`.

## Data

Nothing from this flow is stored on its own. When a trip is saved (`trips-and-ratings.md`), it stores:
- `accommodationPreferences.types`: the ordered array of selected types.
- For each break point, a **snapshot** of the suggestions shown (id, name, type, location), because the live data can change later.

A favorite (`favorites.md`) stores the same fields plus the provider and the Geoapify place id.

## UI behavior

- **Options panel:** a row of checkboxes with icons (Hotel, Hostel, Camping, Parking). MVP: only Hotel exists, so the control is hidden or shown as a single fixed choice. At least one box must remain checked.
- **Under each break point:** a list of up to 5 rows with a type icon, the name, and "about X km from the stop". A short line states that distances are straight lines and that places are suggestions, not bookings.
- **Radius note:** if the 25 km search was needed, show "Nothing within 10 km. Showing places within 25 km."
- **Empty state:** "No accommodation found nearby", without error styling. If the search failed, show the warning text instead ("Accommodation could not be loaded for this stop").
- **Map:** accommodation markers with a type icon, visually different from destinations and break points. Clicking a row highlights its marker and the other way around.
- **Popup on a marker:** name, type, distance, address. For logged-in users a "Save as favorite" button. For guests the same button opens the login prompt from `specs/auth.md`.
- **Parking (Could):** the label reads "Parking" and the popup says "Check local rules for overnight stays."
- **Filter chips (Could):** toggles above the map to hide or show each type.
- **Change type per stop (Could):** a small "Show other types" control on a break point calls `POST /api/accommodation/search`.
- **Loading:** while a plan is running, accommodation is part of the same loading state. The Could endpoints show a small spinner on the stop.

## Edge cases

- All selected types return nothing at 10 km and at 25 km: empty list, empty-state message.
- One selected type returns nothing but others do: shown without any error. The missing type is simply absent. (Optionally say "No campsites within 10 km".)
- A place appears under two categories (for example a hotel that is also tagged as a guest house): shown once, with the type that is first in the user's order.
- A very dense area (a city center with dozens of hotels): only the 5 nearest are shown. The 20-result limit per type is enough for the turn-based pick.
- One type crowds out another in a dense area: each type has its own request, so a campsite 8 km away is still found even if there are many hotels within 2 km.
- Break point in a lake, forest, or on a bridge: the search uses straight-line distance, so results can be on the other side of water. Known limitation.
- Many break points: only the first 10 are searched, and the warning explains it.
- Request budget exceeded (30 per plan): the remaining stops get an empty list and `ACCOMMODATION_LIMIT_REACHED`.
- One of several parallel requests fails or times out: the others are kept, and `ACCOMMODATION_PARTIAL` is added.
- Geoapify quota is used up: all accommodation is skipped with `ACCOMMODATION_UNAVAILABLE`, and the route and break points are still returned.
- Places returns a place with a missing or empty name, or with missing coordinates: dropped.
- Places returns an unexpected shape: the Facade throws a typed error, which becomes a warning.
- The user selects `parking` and there are no results in an area: shown as an empty list for that type, like any other.
- The same break point is searched twice in one plan (two break points very close together): allowed. With caching (Could) the second search is free.
- The user changes the accommodation types and presses "Plan trip" again: break points are recalculated as before, and accommodation is searched again with the new types.

## Tests

Automated (Should unless marked):
- Selection function (pure): the worked example above gives the expected five places and the expected display order. One type gives the 5 nearest. A type with no results is skipped. A place under two types is kept once, under the first type in the user's order. Fewer than 5 results in total returns them all.
- Finders: with a recorded Places response, each finder maps its categories to its type, drops unnamed places, sorts by distance, and builds the address when available.
- Factory: returns the right finder for each type and throws a clear error for an unknown type.
- Facade `findAccommodation` with a fake `searchPlaces`: empty at 10 km triggers exactly one retry at 25 km, still empty gives an empty list, one failing type gives the others plus a partial marker, and the request budget stops further searches.
- Validation: `accommodationTypes` with an empty array, duplicates, an unknown value, or a type that is not enabled yet gives 400.
- (Must) Orchestration: a Facade failure gives `ACCOMMODATION_UNAVAILABLE` and the route and break points are still returned.

Manual:
- A real route with a stop near a town shows hotels close to the stop on the map.
- Choose hotel and camping: both types appear in a dense area and both icons show.
- A route through a sparsely populated area triggers the 25 km retry and the radius note.
- A wrong Geoapify key gives a warning and the route is still returned.
- Several break points in a row stay inside the request budget, and the limit warning appears when forced.
- (Could) Try parking in a few places and look at what it returns before deciding whether to keep it.

## Out of scope

- Booking, prices, availability, reviews, photos, opening hours, and contact details
- Ranking by quality, star rating, or popularity
- Driving distance or travel time from the stop to each place (distances are straight lines)
- Accommodation filters through Geoapify conditions (for example wheelchair access or pets), which is a possible Could
- Accommodation along the route between break points
- Using any data source other than Geoapify Places (Overpass remains a fallback idea, see `CLAUDE.md`)

## Known limitations (to mention in the report)

- The data comes from OpenStreetMap through Geoapify, so coverage and quality vary, especially for camping and parking outside cities.
- Distances are straight lines. Near water or mountains the real driving distance can be much longer.
- There is no way to be sure that overnight parking is allowed. The type is therefore only a Could, with a warning label.
- Suggestions do not show whether a place is open or has free rooms.

## Open questions

- Should `hotel` include `accommodation.guest_house` and `accommodation.motel`? Compare results on a few real routes with and without them.
- Which category covers motorhome pitches (`camping.caravan_site`?), and is there any condition that tells overnight parking is allowed? If not, consider dropping `parking` entirely.
- Per-type requests are chosen for correctness. Is the quota cost acceptable? Check how many credits a Places request costs and measure a normal session. If it is too high, consider one combined request with a larger limit, and accept that dense types can crowd out sparse ones. (This also affects the line about one request for all types in `trip-planning.md`, see below.)
- Is a 10 km radius, then 25 km, right in sparsely populated areas? Try routes in northern Sweden. A per-type radius could be better for camping.
- Should the first radius be smaller in cities (for example 5 km) so that suggestions are closer? Decide after testing.
- Should the order of the types matter more than just for the turn order (for example "show hotels first, camping only if no hotels")? The current design treats the selected types as equally wanted.
- Should break points be moved to the nearest town before searching? This would improve results and belongs to the Could list in `python-service.md`.
- Is the cap of 10 searched break points and 30 requests per plan sensible? Adjust after measuring.
- Are place names returned in the language set by `lang`? Check with Swedish names.

## Changes needed in other specs

- `trip-planning.md`, Acceptance criteria: the line "When several accommodation types are requested, they are searched in one request per break point (several categories in one call)" should become "one request per selected type", because of the crowding-out problem described above. Update "Facade notes" the same way ("Use one request for all requested types").
- `trip-planning.md`, Plan response: add `accommodationRadiusMeters` on each break point, and the new warning codes `ACCOMMODATION_PARTIAL` and `ACCOMMODATION_LIMIT_REACHED`.
- `trip-planning.md`, "Accommodation search (summary)": the result list is picked in turns across types and then sorted by distance (it is still sorted by distance in the end).
- `CLAUDE.md`, Trip model: `accommodationPreferences.types` is an ordered array.
- `CLAUDE.md`, Design patterns: the Factory is `AccommodationFinderFactory.get(type)`, as described here.

## Things I must be able to explain (oral exam)

- Where the Factory pattern is used and what problem it solves here (a new type means a new finder and one line in the factory).
- Why the Facade is still the only code that talks to Geoapify, and why finders get a search function passed in.
- Why each type has its own request (crowding out), and what that costs in quota.
- How the turn-based selection works and why a plain "nearest 5 of everything" would be worse.
- Why the 25 km retry only happens when everything is empty.
- Why distances are straight lines, and what that means for the user.
- Why a failure here gives a warning, not an error.
- Why the selection function is pure, and how that helps testing.
- What the data limitations are (OpenStreetMap coverage, parking rules).

## Definition of Done

Follow the Definition of Done in `CLAUDE.md`. For this spec specifically, also confirm:
- [ ] Every Geoapify category used has been checked against the current category list.
- [ ] A real route in the deployed version shows suggestions near its break points, and the empty, retry, partial, and failure cases have each been triggered once by hand.
- [ ] A normal planning session (including retries and several types) stays well below the daily Geoapify quota.
- [ ] The selection function has tests for the worked example, and the Facade tests use a fake search function, so tests never use real quota.
- [ ] The notice that suggestions are not bookings is visible in the UI.