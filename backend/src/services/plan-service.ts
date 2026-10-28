import type { AccommodationType, LonLat, RouteResult } from "../types/geo.js";
import { AppError } from "../utils/app-error.js";
import { geocode, getRoute } from "./geoapify-facade.js";

// With 3 waypoints the single stop in between cannot move, so optimizing
// would change nothing (and Geoapify charges extra for it)
const MIN_WAYPOINTS_TO_OPTIMIZE = 4;

// Raw input from the frontend
export type DestinationInput = {
  id: string;
  name?: string | undefined;
  location?: LonLat | undefined;
  address?: string | undefined;
  description?: string | undefined;
  wikidataId?: string | undefined;
};

export type PlanInput = {
  destinations: DestinationInput[];
  options: {
    optimizeOrder: boolean;
    // Validated now so the API contract is final; used once break points
    // and accommodation are added
    maxDrivingHours: number;
    accommodationTypes: AccommodationType[];
  };
};

export type Warning = { code: string; message: string };

type LocatedDestination = { 
  id: string; 
  name?: string | undefined; 
  location: LonLat;
  description?: string | undefined;
  wikidataId?: string | undefined; 
};

export type PlanResult = {
  destinations: (LocatedDestination & { order: number; inputIndex: number })[];
  orderOptimized: boolean;
  route: {
    distanceMeters: number;
    durationSeconds: number;
    geometry: RouteResult["geometry"];
    legs: { fromIndex: number; toIndex: number; distanceMeters: number; durationSeconds: number }[];
  };
  breakPoints: never[];
  warnings: Warning[];
};

// Destinations given only as an address are geocoded here. One at a time,
// so if several fail the error always points at the first one.
async function resolveLocations(destinations: DestinationInput[]): Promise<LocatedDestination[]> {
  const located: LocatedDestination[] = [];

  for (const [index, destination] of destinations.entries()) {
    if (destination.location) {
      located.push({ id: destination.id, name: destination.name, location: destination.location, description: destination.description, wikidataId: destination.wikidataId });
      continue;
    }

    // Zod guarantees an address when there is no location
    const address = destination.address ?? "";
    const [bestMatch] = await geocode(address);
    if (!bestMatch) {
      throw new AppError(422, "GEOCODING_FAILED", `We could not find the address "${address}"`, {
        destinationIndex: index,
      });
    }
    located.push({ id: destination.id, name: destination.name ?? bestMatch.label, location: bestMatch.location });
  }

  return located;
}

// Optimization is a bonus: if it fails, plan in the given order with a
// warning. A failure of the plain route request is a real error, because
// without a route there is nothing to show.
async function getRouteInBestOrder(
  waypoints: LonLat[],
  optimizeOrder: boolean,
  warnings: Warning[],
): Promise<RouteResult> {
  if (!optimizeOrder || waypoints.length < MIN_WAYPOINTS_TO_OPTIMIZE) {
    return getRoute(waypoints);
  }

  try {
    return await getRoute(waypoints, { optimizeStops: true });
  } catch (err) {
    console.warn("Order optimization failed, falling back to the given order:", err);
    warnings.push({
      code: "ORDER_OPTIMIZATION_UNAVAILABLE",
      message: "We could not optimize the order of your stops, so they are visited in the order you entered.",
    });
    return getRoute(waypoints);
  }
}

export async function planTrip(input: PlanInput): Promise<PlanResult> {
  const warnings: Warning[] = [];

  const located = await resolveLocations(input.destinations);
  const route = await getRouteInBestOrder(
    located.map((destination) => destination.location),
    input.options.optimizeOrder,
    warnings,
  );

  // waypointOrder[order] = inputIndex. Rebuild the list in the order that
  // was actually driven, remembering where each item was in the request.
  const destinations = route.waypointOrder.map((inputIndex, order) => {
    const destination = located[inputIndex];
    if (!destination) {
      // The Facade validates the order, so this would be a bug
      throw new Error(`Waypoint order refers to missing destination ${inputIndex}`);
    }
    return { ...destination, order, inputIndex };
  });

  // Only true if something actually moved
  const orderOptimized = route.waypointOrder.some((inputIndex, order) => inputIndex !== order);

  return {
    destinations,
    orderOptimized,
    route: {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      geometry: route.geometry,
      // Leg i goes from destination `order` i to i + 1
      legs: route.legs.map((leg, index) => ({
        fromIndex: index,
        toIndex: index + 1,
        distanceMeters: leg.distanceMeters,
        durationSeconds: leg.durationSeconds,
      })),
    },
    // Filled in by the Python service in the next step
    breakPoints: [],
    warnings,
  };
}
