import { z } from "zod";
import { config } from "../config/env.js";
import type { GeocodeResult, LonLat, PlaceKind, RouteResult } from "../types/geo.js";
import { UpstreamError, type UpstreamErrorKind } from "../utils/upstream-error.js";

// Facade: the only file that knows Geoapify's URLs, parameters, API key and
// response shapes. The rest of the backend only sees our own types, so the
// provider could be swapped without touching anything else.

const BASE_URL = "https://api.geoapify.com/v1";
const TIMEOUT_MS = 10_000;
// Stop optimization is much slower than plain routing (measured 13 s for 4
// and 25-29 s for 5 Swedish cities), so only that request gets more time
const OPTIMIZE_TIMEOUT_MS = 45_000;
const MAX_GEOCODE_RESULTS = 5;

// Zod schemas for the parts of Geoapify's responses we use. If Geoapify
// ever changes its format we get a clear error instead of `undefined` deep
// inside our code.
const geocodeResponseSchema = z.object({
  results: z.array(
    z.object({
      formatted: z.string(),
      lon: z.number(),
      lat: z.number(),
      // Optional so one result without a type does not fail the whole search
      result_type: z.string().optional(),
    }),
  ),
});

// Points may carry extra values (e.g. elevation), so only require two
const pointSchema = z.array(z.number()).min(2);

const routingResponseSchema = z.object({
  features: z
    .array(
      z.object({
        // One line per leg, already in [lon, lat] order
        geometry: z.object({
          type: z.literal("MultiLineString"),
          coordinates: z.array(z.array(pointSchema)),
        }),
        properties: z.object({
          distance: z.number(),
          time: z.number(),
          legs: z.array(z.object({ distance: z.number(), time: z.number() })),
          // Only returned with optimize_stops. `original_index` is the
          // position the waypoint had in our request.
          waypoints: z.array(z.object({ original_index: z.number().int() })).optional(),
        }),
      }),
    )
    .min(1),
});

// Sends a GET request and returns the parsed JSON. Every failure becomes an
// UpstreamError, so callers never deal with fetch or HTTP details.
// `kindByStatus` lets a caller give a specific status its own meaning.
async function getJson(
  path: string,
  params: Record<string, string>,
  kindByStatus: Partial<Record<number, UpstreamErrorKind>> = {},
  timeoutMs: number = TIMEOUT_MS,
): Promise<unknown> {
  // URL/searchParams encode every value, so addresses with å, ä, ö or
  // apostrophes are sent correctly
  const url = new URL(BASE_URL + path);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set("apiKey", config.geoapifyApiKey);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    // Network failure or timeout. Only the path is logged, never the full
    // URL, because the URL contains the API key.
    const reason = err instanceof Error ? err.message : String(err);
    throw new UpstreamError("UNAVAILABLE", `Geoapify ${path} request failed: ${reason}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const kind = kindByStatus[response.status] ?? (response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE");
    throw new UpstreamError(kind, `Geoapify ${path} returned ${response.status}: ${body.slice(0, 300)}`);
  }

  try {
    return await response.json();
  } catch {
    throw new UpstreamError("UNAVAILABLE", `Geoapify ${path} returned invalid JSON`);
  }
}

function parseResponse<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new UpstreamError("UNAVAILABLE", `Geoapify ${path} returned an unexpected shape: ${result.error.message}`);
  }
  return result.data;
}

function toLonLat(point: number[]): LonLat {
  // pointSchema guarantees at least two numbers
  return [point[0]!, point[1]!];
}

// Geoapify's result types grouped into our three kinds. Anything not listed
// (e.g. "unknown", or a type Geoapify adds later) counts as a point of interest,
// so landmarks are never dropped. Shared with autocomplete later.
const ADDRESS_TYPES = new Set(["building", "street", "amenity", "postcode"]);
const CITY_TYPES = new Set(["city", "suburb", "district", "county", "state", "country"]);

function toPlaceKind(resultType: string | undefined): PlaceKind {
  if (resultType && ADDRESS_TYPES.has(resultType)) return "address";
  if (resultType && CITY_TYPES.has(resultType)) return "city";
  return "poi";
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const data = await getJson("/geocode/search", {
    text: query,
    limit: String(MAX_GEOCODE_RESULTS),
    format: "json",
  });
  const { results } = parseResponse(geocodeResponseSchema, data, "/geocode/search");
  return results.map((result) => ({
    label: result.formatted,
    location: [result.lon, result.lat],
    kind: toPlaceKind(result.result_type),
  }));
}

// True if `order` contains each index 0..n-1 exactly once and keeps the
// first and last waypoint in place, as Geoapify promises
function isValidWaypointOrder(order: number[], waypointCount: number): boolean {
  const sorted = [...order].sort((a, b) => a - b);
  return (
    order.length === waypointCount &&
    sorted.every((value, index) => value === index) &&
    order[0] === 0 &&
    order[order.length - 1] === waypointCount - 1
  );
}

export async function getRoute(
  waypoints: LonLat[],
  options: { optimizeStops?: boolean } = {},
): Promise<RouteResult> {
  const params: Record<string, string> = {
    // Geoapify wants "lat,lon|lat,lon": the one place we flip the order
    waypoints: waypoints.map(([lon, lat]) => `${lat},${lon}`).join("|"),
    mode: "drive",
  };
  if (options.optimizeStops) params.optimize_stops = "true";

  // Geoapify answers 400 when no drivable route connects the points
  // (e.g. across the sea). Our input is already validated, so a 400 here
  // means "no route" rather than a bad request.
  const timeoutMs = options.optimizeStops ? OPTIMIZE_TIMEOUT_MS : TIMEOUT_MS;
  const data = await getJson("/routing", params, { 400: "NO_ROUTE" }, timeoutMs);
  const { features } = parseResponse(routingResponseSchema, data, "/routing");
  const route = features[0]!; // .min(1) in the schema guarantees one

  const lines = route.geometry.coordinates;
  if (lines.length !== route.properties.legs.length) {
    throw new UpstreamError("UNAVAILABLE", "Geoapify /routing returned a different number of lines and legs");
  }

  const legs = route.properties.legs.map((leg, index) => ({
    distanceMeters: Math.round(leg.distance),
    durationSeconds: Math.round(leg.time),
    coordinates: lines[index]!.map(toLonLat),
  }));

  const identityOrder = waypoints.map((_, index) => index);
  const waypointOrder = route.properties.waypoints?.map((waypoint) => waypoint.original_index) ?? identityOrder;
  if (!isValidWaypointOrder(waypointOrder, waypoints.length)) {
    throw new UpstreamError("UNAVAILABLE", `Geoapify /routing returned an invalid waypoint order: ${waypointOrder}`);
  }

  return {
    distanceMeters: Math.round(route.properties.distance),
    durationSeconds: Math.round(route.properties.time),
    geometry: {
      type: "LineString",
      // One continuous line for the map. The point where two legs meet
      // appears twice, which is harmless when drawing.
      coordinates: legs.flatMap((leg) => leg.coordinates),
    },
    legs,
    waypointOrder,
  };
}
