import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";

import { planTrip, type PlanInput } from "../src/services/plan-service.js";
import { AppError } from "../src/utils/app-error.js";
import { UpstreamError } from "../src/utils/upstream-error.js";

// These tests replace global fetch, so no request reaches Geoapify or the
// Python service and no API quota is used. Requests are told apart by URL.

type LonLat = [number, number];

const STOCKHOLM: LonLat = [18.07, 59.33];
const LINKOPING: LonLat = [15.62, 58.41];
const GOTHENBURG: LonLat = [11.97, 57.71];
const MALMO: LonLat = [13.0, 55.6];

function destination(id: string, location: LonLat) {
  return { id, name: id, location };
}

function planInput(points: LonLat[], options: Partial<PlanInput["options"]> = {}): PlanInput {
  return {
    destinations: points.map((point, index) => destination(`d${index}`, point)),
    options: {
      optimizeOrder: false,
      roundTrip: false,
      maxDrivingSeconds: 14_400,
      accommodationTypes: ["hotel"],
      ...options,
    },
  };
}

// Geoapify's routing format: one line per leg. `originalIndexes` is only
// present when stops were optimized.
function routingBody(points: LonLat[], legSeconds: number[], originalIndexes?: number[]) {
  const lines = points.slice(0, -1).map((point, index) => [point, points[index + 1]]);
  return {
    features: [{
      geometry: { type: "MultiLineString", coordinates: lines },
      properties: {
        distance: 1000 * legSeconds.length,
        time: legSeconds.reduce((sum, seconds) => sum + seconds, 0),
        legs: legSeconds.map((time) => ({ distance: 1000, time })),
        ...(originalIndexes ? { waypoints: originalIndexes.map((original_index) => ({ original_index })) } : {}),
      },
    }],
  };
}

const hotelBody = {
  features: [{
    geometry: { coordinates: [15.6, 58.4] },
    properties: { place_id: "hotel-1", name: "Hotel Example", formatted: "Storgatan 1" },
  }],
};

type Handlers = {
  routing: (url: URL) => Response;
  places?: () => Response;
  breakPoints?: () => Response;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

function mockServices(t: TestContext, handlers: Handlers) {
  t.mock.method(console, "warn", () => undefined);
  t.mock.method(console, "log", () => undefined);
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.pathname.endsWith("/routing")) return handlers.routing(url);
    if (url.pathname.endsWith("/places")) return handlers.places?.() ?? json(hotelBody);
    if (url.pathname.endsWith("/find-break-points")) {
      return handlers.breakPoints?.() ?? json({ breakPoints: [] });
    }
    throw new Error(`Unexpected request to ${url}`);
  });
  return calls;
}

const oneBreakPoint = () => json({
  breakPoints: [{ legIndex: 0, location: [16.5, 58.9], cumulativeSeconds: 14_400 }],
});

test("plan returns the route, a break point and accommodation for it", async (t) => {
  mockServices(t, {
    routing: () => json(routingBody([STOCKHOLM, GOTHENBURG, MALMO], [20_000, 3_600])),
    breakPoints: oneBreakPoint,
  });

  const result = await planTrip(planInput([STOCKHOLM, GOTHENBURG, MALMO]));

  assert.equal(result.route.legs.length, 2);
  assert.equal(result.breakPoints.length, 1);
  assert.equal(result.breakPoints[0]?.accommodation[0]?.name, "Hotel Example");
  assert.equal(result.breakPoints[0]?.accommodationRadiusMeters, 10_000);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.orderOptimized, false);
});

test("plan still returns the route with a warning when the Python service fails", async (t) => {
  mockServices(t, {
    routing: () => json(routingBody([STOCKHOLM, MALMO], [20_000])),
    breakPoints: () => json({ error: "down" }, 503),
  });

  const result = await planTrip(planInput([STOCKHOLM, MALMO]));

  assert.equal(result.route.legs.length, 1);
  assert.deepEqual(result.breakPoints, []);
  assert.deepEqual(result.warnings.map((w) => w.code), ["BREAK_POINTS_UNAVAILABLE"]);
});

test("a failed accommodation search gives an empty list and a warning, not an error", async (t) => {
  mockServices(t, {
    routing: () => json(routingBody([STOCKHOLM, MALMO], [20_000])),
    breakPoints: oneBreakPoint,
    places: () => json({ error: "down" }, 500),
  });

  const result = await planTrip(planInput([STOCKHOLM, MALMO]));

  assert.equal(result.breakPoints.length, 1);
  assert.deepEqual(result.breakPoints[0]?.accommodation, []);
  assert.deepEqual(result.warnings.map((w) => w.code), ["ACCOMMODATION_UNAVAILABLE"]);
});

test("a failed routing request fails the whole plan", async (t) => {
  mockServices(t, { routing: () => json({ error: "down" }, 500) });

  await assert.rejects(planTrip(planInput([STOCKHOLM, MALMO])), UpstreamError);
});

// A routing mock where any request that includes one of the `unreachable`
// points answers 400, like Geoapify does when there is no road connection
function routingWithUnreachable(unreachable: LonLat[], legSeconds = 3_600) {
  return (url: URL) => {
    const waypoints = (url.searchParams.get("waypoints") ?? "").split("|");
    const hasUnreachable = unreachable.some(([lon, lat]) => waypoints.includes(`${lat},${lon}`));
    if (hasUnreachable) return json({ error: "no route" }, 400);
    const points = waypoints.map((pair) => {
      const [lat, lon] = pair.split(",").map(Number);
      return [lon!, lat!] as LonLat;
    });
    return json(routingBody(points, points.slice(1).map(() => legSeconds)));
  };
}

test("a stop with no road connection is named in the ROUTE_NOT_FOUND details", async (t) => {
  const island: LonLat = [19.0, 57.5];
  mockServices(t, { routing: routingWithUnreachable([island]) });

  await assert.rejects(
    planTrip(planInput([STOCKHOLM, island, MALMO])),
    (error: AppError) => {
      assert.equal(error.code, "ROUTE_NOT_FOUND");
      assert.equal(error.status, 422);
      assert.deepEqual(error.details, { destinationIds: ["d1"] });
      return true;
    },
  );
});

test("an unreachable first or last stop is named too", async (t) => {
  const island: LonLat = [19.0, 57.5];
  mockServices(t, { routing: routingWithUnreachable([island]) });

  await assert.rejects(
    planTrip(planInput([island, STOCKHOLM, MALMO])),
    (error: AppError) => {
      assert.deepEqual(error.details, { destinationIds: ["d0"] });
      return true;
    },
  );
});

test("when only a pair can be tested, both stops of the failed leg are named", async (t) => {
  const island: LonLat = [19.0, 57.5];
  mockServices(t, { routing: routingWithUnreachable([island]) });

  await assert.rejects(
    planTrip(planInput([STOCKHOLM, island])),
    (error: AppError) => {
      assert.deepEqual(error.details, { destinationIds: ["d0", "d1"] });
      return true;
    },
  );
});

test("an unreachable stop in a round trip is named once", async (t) => {
  const island: LonLat = [19.0, 57.5];
  mockServices(t, { routing: routingWithUnreachable([island]) });

  await assert.rejects(
    planTrip(planInput([island, STOCKHOLM, MALMO], { roundTrip: true })),
    (error: AppError) => {
      assert.deepEqual(error.details, { destinationIds: ["d0"] });
      return true;
    },
  );
});

test("ROUTE_NOT_FOUND falls back to the generic error when the leg checks hit a rate limit", async (t) => {
  // The full route says 400, every single-leg check says 429
  mockServices(t, {
    routing: (url) => json({ error: "x" }, (url.searchParams.get("waypoints") ?? "").split("|").length > 2 ? 400 : 429),
  });

  await assert.rejects(
    planTrip(planInput([STOCKHOLM, LINKOPING, MALMO])),
    (error: UpstreamError) => error instanceof UpstreamError && error.kind === "NO_ROUTE",
  );
});

test("an optimized order sets order, inputIndex and orderOptimized", async (t) => {
  // Entered: Stockholm, Malmo, Linkoping, Gothenburg. Geoapify drives them as
  // input indexes 0, 2, 1, 3. The first and last stay in place.
  const entered = [STOCKHOLM, MALMO, LINKOPING, GOTHENBURG];
  const driven = [STOCKHOLM, LINKOPING, MALMO, GOTHENBURG];
  const calls = mockServices(t, {
    routing: () => json(routingBody(driven, [3_600, 3_600, 3_600], [0, 2, 1, 3])),
  });

  const result = await planTrip(planInput(entered, { optimizeOrder: true }));

  assert.equal(calls.find((url) => url.pathname.endsWith("/routing"))?.searchParams.get("optimize_stops"), "true");
  assert.equal(result.orderOptimized, true);
  assert.deepEqual(result.destinations.map((d) => d.id), ["d0", "d2", "d1", "d3"]);
  assert.deepEqual(result.destinations.map((d) => d.order), [0, 1, 2, 3]);
  assert.deepEqual(result.destinations.map((d) => d.inputIndex), [0, 2, 1, 3]);
});

test("an unchanged order from the optimizer gives orderOptimized false", async (t) => {
  const points = [STOCKHOLM, LINKOPING, MALMO, GOTHENBURG];
  mockServices(t, {
    routing: () => json(routingBody(points, [3_600, 3_600, 3_600], [0, 1, 2, 3])),
  });

  const result = await planTrip(planInput(points, { optimizeOrder: true }));

  assert.equal(result.orderOptimized, false);
});

test("a failed optimization falls back to the given order with a warning", async (t) => {
  const points = [STOCKHOLM, LINKOPING, MALMO, GOTHENBURG];
  mockServices(t, {
    routing: (url) => url.searchParams.get("optimize_stops")
      ? json({ error: "timeout" }, 500)
      : json(routingBody(points, [3_600, 3_600, 3_600])),
  });

  const result = await planTrip(planInput(points, { optimizeOrder: true }));

  assert.equal(result.orderOptimized, false);
  assert.deepEqual(result.destinations.map((d) => d.inputIndex), [0, 1, 2, 3]);
  assert.deepEqual(result.warnings.map((w) => w.code), ["ORDER_OPTIMIZATION_UNAVAILABLE"]);
});
