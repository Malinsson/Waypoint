// GeoJSON order: longitude first. Used everywhere in our own code; the
// Facade converts to Geoapify's "latitude,longitude" only at the edge.
export type LonLat = [lon: number, lat: number];

export type GeocodeResult = {
  label: string;
  location: LonLat;
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
