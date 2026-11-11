import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";

import { Trip } from "../src/models/trip.js";
import { ratingBodySchema, ratingQuerySchema } from "../src/controllers/trip-controller.js";
import { clearTripRating, rateTrip } from "../src/services/trip-service.js";

const userId = "64b8f1e2c9e77a0012345678";
const tripId = "64b8f1e2c9e77a0012345679";

function mockTrip(t: TestContext, completedAt?: Date) {
  const writes: { path: string; value: unknown }[] = [];
  const trip = {
    completedAt,
    destinations: [{}, {}],
    breakpoints: [{}],
    set: (path: string, value: unknown) => { writes.push({ path, value }); },
    save: async () => undefined,
  };
  t.mock.method(Trip, "findOne", async () => trip);
  return writes;
}

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

// --- Validation: what the request body may contain ---

test("rating body accepts stars 1-5 for the whole trip", () => {
  const parsed = ratingBodySchema.parse({ target: "trip", stars: 4, comment: " Great " });
  assert.deepEqual(parsed.target, { kind: "trip" });
  assert.deepEqual(parsed.rating, { stars: 4, comment: "Great" });
});

test("rating body rejects 0, 6, 3.5 and a missing value", () => {
  for (const stars of [0, 6, 3.5, undefined]) {
    assert.equal(ratingBodySchema.safeParse({ target: "trip", stars }).success, false, `stars ${stars}`);
  }
});

test("rating body rejects a comment over 1000 characters but accepts exactly 1000", () => {
  assert.equal(ratingBodySchema.safeParse({ target: "trip", stars: 3, comment: "x".repeat(1001) }).success, false);
  assert.equal(ratingBodySchema.safeParse({ target: "trip", stars: 3, comment: "x".repeat(1000) }).success, true);
});

test("destination and stop ratings need an index", () => {
  assert.equal(ratingBodySchema.safeParse({ target: "destination", stars: 3 }).success, false);
  assert.equal(ratingBodySchema.safeParse({ target: "breakpoint", stars: 3, index: -1 }).success, false);
  assert.deepEqual(
    ratingBodySchema.parse({ target: "destination", index: 1, stars: 3 }).target,
    { kind: "destination", index: 1 },
  );
});

test("delete query reads the index from a string", () => {
  assert.deepEqual(ratingQuerySchema.parse({ target: "breakpoint", index: "0" }), { kind: "breakpoint", index: 0 });
  assert.equal(ratingQuerySchema.safeParse({ target: "breakpoint" }).success, false);
});

// --- Service: when a rating is allowed and where it is written ---

test("rating a trip that is not completed returns 409 TRIP_NOT_COMPLETED", async (t) => {
  const writes = mockTrip(t);
  await assert.rejects(rateTrip(userId, tripId, { kind: "trip" }, { stars: 5 }), (error: unknown) => {
    assert.equal(error instanceof Error && "status" in error ? error.status : undefined, 409);
    assert.equal(errorCode(error), "TRIP_NOT_COMPLETED");
    return true;
  });
  assert.equal(writes.length, 0);
});

test("a completed trip stores the total rating, a destination rating and a stop rating", async (t) => {
  const writes = mockTrip(t, new Date());

  await rateTrip(userId, tripId, { kind: "trip" }, { stars: 5, comment: "Lovely" });
  await rateTrip(userId, tripId, { kind: "destination", index: 1 }, { stars: 3 });
  await rateTrip(userId, tripId, { kind: "breakpoint", index: 0 }, { stars: 2 });

  assert.deepEqual(writes, [
    { path: "totalRating", value: { stars: 5, comment: "Lovely" } },
    { path: "destinations.1.rating", value: { stars: 3 } },
    { path: "breakpoints.0.rating", value: { stars: 2 } },
  ]);
});

test("rating a place that is not on the trip returns 404 PLACE_NOT_FOUND", async (t) => {
  const writes = mockTrip(t, new Date());
  await assert.rejects(
    rateTrip(userId, tripId, { kind: "destination", index: 2 }, { stars: 4 }),
    (error: unknown) => errorCode(error) === "PLACE_NOT_FOUND",
  );
  assert.equal(writes.length, 0);
});

test("clearing a rating removes the value", async (t) => {
  const writes = mockTrip(t, new Date());
  await clearTripRating(userId, tripId, { kind: "destination", index: 0 });
  assert.deepEqual(writes, [{ path: "destinations.0.rating", value: undefined }]);
});

test("the trip schema keeps comments up to 1000 characters", () => {
  const trip = new Trip({
    userId,
    name: "Test",
    route: {},
    maxDrivingHours: 6,
    totalRating: { stars: 4, comment: "x".repeat(1000) },
  });
  assert.equal(trip.validateSync(), undefined);
});
