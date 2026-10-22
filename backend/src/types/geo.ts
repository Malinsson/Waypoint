// GeoJSON order: longitude first. Used everywhere in our own code; the
// Facade converts to Geoapify's "latitude,longitude" only at the edge.
export type LonLat = [lon: number, lat: number];

// Our own coarse category for a search result, used for icons in the UI.
// The Facade maps the provider's much finer result types to these three.
export const PLACE_KINDS = ["address", "city", "poi"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export type GeocodeResult = {
  label: string;
  location: LonLat;
  kind: PlaceKind;
};

// One row in the autocomplete dropdown. Both Facades produce this type, so
// the merge step can compare results without knowing where they came from.
export type Suggestion = GeocodeResult & {
  // Prefixed by source ("geo:<place id>" or "wd:<Q-id>") so ids never collide
  id: string;
  description?: string;
  // "both" is only set when merging a Geoapify and a Wikidata result
  source: "geoapify" | "wikidata" | "both";
};

export type RouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  // The leg's own line, kept for the break-point calculation later
  coordinates: LonLat[];
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: "LineString"; coordinates: LonLat[] };
  legs: RouteLeg[];
  // For each position in the route, the index of that waypoint in the input
  // array. Equals [0, 1, 2, ...] when the order was not changed.
  waypointOrder: number[];
};

export const ACCOMMODATION_TYPES = ["hotel", "hostel", "camping", "parking"] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];
