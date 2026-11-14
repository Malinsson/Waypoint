import type { AccommodationType, LonLat, RouteResult } from "../types/geo.js";
import { AppError } from "../utils/app-error.js";
import { UpstreamError } from "../utils/upstream-error.js";
import { findAccommodation, geocode, getRoute } from "./geoapify-facade.js";
import { findBreakPoints } from "./geoservice-service.js";

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
    roundTrip: boolean;
    // Validated now so the API contract is final; used once break points
    // and accommodation are added
    maxDrivingSeconds: number;
    accommodationTypes: AccommodationType[];
  };
};

export type Warning = { code: string; message: string };

type BreakPoints = Awaited<ReturnType<typeof findBreakPoints>>["breakPoints"];

class AccommodationRequestBudget {
  private used = 0;
  private active = 0;
  private readonly queue: (() => void)[] = [];

  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.used >= 30) return undefined;
    if (this.active >= 3) await new Promise<void>((resolve) => this.queue.push(resolve));
    if (this.used >= 30) {
      this.queue.shift()?.();
      return undefined;
    }
    this.used += 1;
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

type LocatedDestination = { 
  id: string; 
  name?: string | undefined; 
  location: LonLat;
  description?: string | undefined;
  wikidataId?: string | undefined; 
};

export type PlanResult = {
  destinations: (LocatedDestination & { order: number; inputIndex: number })[];
  roundTrip: boolean;
  orderOptimized: boolean;
  route: {
    distanceMeters: number;
    durationSeconds: number;
    geometry: RouteResult["geometry"];
    legs: { fromIndex: number; toIndex: number; distanceMeters: number; durationSeconds: number }[];
  };
  breakPoints: (BreakPoints[number] & {
    accommodationRadiusMeters: number;
    accommodation: Awaited<ReturnType<typeof findAccommodation>>["accommodation"];
  })[];
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

// Geoapify only says "no route" for the whole request, never which stop is
// the problem. So each leg is routed on its own (extra requests, but only
// when planning has already failed). Returns the ids of the stops the user
// should fix, or null if the cause could not be narrowed down.
async function findUnreachableIds(stops: LocatedDestination[]): Promise<string[] | null> {
  const legResults = await Promise.allSettled(
    stops.slice(0, -1).map((stop, index) => getRoute([stop.location, stops[index + 1]!.location])),
  );

  // A rate limit or timeout says nothing about the stops, so give up
  const legFailed: boolean[] = [];
  for (const result of legResults) {
    if (result.status === "rejected") {
      const isNoRoute = result.reason instanceof UpstreamError && result.reason.kind === "NO_ROUTE";
      if (!isNoRoute) return null;
    }
    legFailed.push(result.status === "rejected");
  }
  if (!legFailed.includes(true)) return null;

  // Leg i connects stop i and stop i + 1. A stop with a working leg is
  // reachable, so it is never blamed.
  const hasWorkingLeg = (stopIndex: number) =>
    legFailed[stopIndex - 1] === false || legFailed[stopIndex] === false;

  // A middle stop whose two legs both fail is the clear culprit
  const culpritIndexes = new Set<number>();
  for (let index = 1; index < stops.length - 1; index++) {
    if (legFailed[index - 1] && legFailed[index]) culpritIndexes.add(index);
  }

  // A failed leg that no culprit explains (e.g. the first stop, or a pair of
  // stops) is ambiguous, so point at each end that has no working leg
  legFailed.forEach((failed, index) => {
    if (!failed || culpritIndexes.has(index) || culpritIndexes.has(index + 1)) return;
    for (const stopIndex of [index, index + 1]) {
      if (!hasWorkingLeg(stopIndex)) culpritIndexes.add(stopIndex);
    }
  });

  // The return stop of a round trip is the first destination again
  const ids = [...culpritIndexes].map((index) => stops[index]!.id.replace(/-return$/, ""));
  return [...new Set(ids)];
}

export async function planTrip(input: PlanInput): Promise<PlanResult> {
  const warnings: Warning[] = [];

  const located = await resolveLocations(input.destinations);
  const routeDestinations = input.options.roundTrip && located[0]
    ? [...located, { ...located[0], id: `${located[0].id}-return` }]
    : located;
  let route: RouteResult;
  try {
    route = await getRouteInBestOrder(
      routeDestinations.map((destination) => destination.location),
      input.options.optimizeOrder,
      warnings,
    );
  } catch (error) {
    if (!(error instanceof UpstreamError) || error.kind !== "NO_ROUTE") throw error;
    const destinationIds = await findUnreachableIds(routeDestinations);
    if (!destinationIds) throw error;
    throw new AppError(
      422,
      "ROUTE_NOT_FOUND",
      "We could not find a driving route between your destinations. Check that they are connected by road.",
      { destinationIds },
    );
  }

  // waypointOrder[order] = inputIndex. Rebuild the list in the order that
  // was actually driven, remembering where each item was in the request.
  const destinations = route.waypointOrder.map((inputIndex, order) => {
    const destination = routeDestinations[inputIndex];
    if (!destination) {
      // The Facade validates the order, so this would be a bug
      throw new Error(`Waypoint order refers to missing destination ${inputIndex}`);
    }
    return { ...destination, order, inputIndex };
  });

  // Only true if something actually moved
  const orderOptimized = route.waypointOrder.some((inputIndex, order) => inputIndex !== order);
  let breakPoints: BreakPoints = [];
  try {
    const result = await findBreakPoints({
      legs: route.legs.map((leg) => ({
        coordinates: leg.coordinates,
        durationSeconds: leg.durationSeconds,
        distanceMeters: leg.distanceMeters,
      })),
      maxDrivingSeconds: input.options.maxDrivingSeconds,
    });
    breakPoints = result.breakPoints;
  } catch (error) {
    // Any failure counts, not only UpstreamError: the request is checked with
    // Zod before it is sent, so an odd leg from the router (e.g. one point)
    // throws a ZodError. Break points are a bonus, so the route is still returned.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("Break-point service unavailable:", reason);
    warnings.push({
      code: "BREAK_POINTS_UNAVAILABLE",
      message: "We created the route, but stop suggestions are temporarily unavailable.",
    });
  }

  const budget = new AccommodationRequestBudget();
  const accommodationWarnings = new Set<string>();
  const accommodationBreakPoints = await Promise.all(breakPoints.map(async (breakPoint, index) => {
    if (index >= 10) {
      return { ...breakPoint, accommodationRadiusMeters: 10_000, accommodation: [] };
    }
    const result = await findAccommodation(breakPoint.location, input.options.accommodationTypes, budget);
    if (result.unavailable) accommodationWarnings.add("ACCOMMODATION_UNAVAILABLE");
    if (result.partial) accommodationWarnings.add("ACCOMMODATION_PARTIAL");
    if (result.limitReached) accommodationWarnings.add("ACCOMMODATION_LIMIT_REACHED");
    return { ...breakPoint, accommodationRadiusMeters: result.radiusMeters, accommodation: result.accommodation };
  }));
  if (breakPoints.length > 10) accommodationWarnings.add("TOO_MANY_BREAK_POINTS");
  if (accommodationWarnings.has("ACCOMMODATION_UNAVAILABLE")) {
    warnings.push({ code: "ACCOMMODATION_UNAVAILABLE", message: "Accommodation suggestions are temporarily unavailable." });
  }
  if (accommodationWarnings.has("ACCOMMODATION_PARTIAL")) {
    warnings.push({ code: "ACCOMMODATION_PARTIAL", message: "Some accommodation types could not be loaded." });
  }
  if (accommodationWarnings.has("ACCOMMODATION_LIMIT_REACHED")) {
    warnings.push({ code: "ACCOMMODATION_LIMIT_REACHED", message: "The accommodation search limit was reached; some stops have no suggestions." });
  }
  if (accommodationWarnings.has("TOO_MANY_BREAK_POINTS")) {
    warnings.push({ code: "TOO_MANY_BREAK_POINTS", message: "Accommodation was searched for the first 10 stops only." });
  }

  return {
    destinations,
    roundTrip: input.options.roundTrip,
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
    breakPoints: accommodationBreakPoints,
    warnings,
  };
}
