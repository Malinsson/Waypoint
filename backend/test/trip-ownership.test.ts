import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";

import { Trip } from "../src/models/trip.js";
import {
  clearTripRating,
  completeTrip,
  deleteTrip,
  getTrip,
  listTrips,
  rateTrip,
  renameTrip,
  updateTrip,
} from "../src/services/trip-service.js";

// The database returns nothing when a trip exists but belongs to someone
// else, because every query filters on userId. These tests fake that "nothing"
// and check two things: the caller's id is in the filter, and the service
// answers 404 TRIP_NOT_FOUND (not 403, so ids cannot be probed).

const userA = "64b8f1e2c9e77a0012345678";
const tripOfB = "64b8f1e2c9e77a0012345679";

type Filter = { _id?: { toString(): string }; userId?: { toString(): string } };

function expectNotFound(error: unknown) {
  assert.equal(error instanceof Error && "status" in error ? error.status : undefined, 404);
  assert.equal(error instanceof Error && "code" in error ? error.code : undefined, "TRIP_NOT_FOUND");
  return true;
}

function assertScopedToUser(filter: Filter | undefined) {
  assert.equal(filter?.userId?.toString(), userA);
  assert.equal(filter?._id?.toString(), tripOfB);
}

function mockFindOneReturningNothing(t: TestContext) {
  const filters: Filter[] = [];
  // Supports both `await Trip.findOne()` and `.populate().lean()` chains
  t.mock.method(Trip, "findOne", (filter: Filter) => {
    filters.push(filter);
    const chain = {
      populate: () => chain,
      lean: async () => null,
      then: (resolve: (value: null) => void) => resolve(null),
    };
    return chain;
  });
  return filters;
}

test("getTrip does not return another user's trip", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(getTrip(userA, tripOfB), expectNotFound);
  assertScopedToUser(filters[0]);
});

test("renameTrip cannot rename another user's trip", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(renameTrip(userA, tripOfB, "Mine now"), expectNotFound);
  assertScopedToUser(filters[0]);
});

test("completeTrip cannot complete another user's trip", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(completeTrip(userA, tripOfB), expectNotFound);
  assertScopedToUser(filters[0]);
});

test("updateTrip cannot replace another user's trip", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(
    updateTrip(userA, tripOfB, {
      destinations: [],
      route: {},
      roundTrip: false,
      breakpoints: [],
      maxDrivingHours: 6,
      accommodationPreference: { types: ["hotel"] },
    }),
    expectNotFound,
  );
  assertScopedToUser(filters[0]);
});

test("rateTrip and clearTripRating cannot touch another user's trip", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(rateTrip(userA, tripOfB, { kind: "trip" }, { stars: 5 }), expectNotFound);
  await assert.rejects(clearTripRating(userA, tripOfB, { kind: "trip" }), expectNotFound);
  assert.equal(filters.length, 2);
  filters.forEach(assertScopedToUser);
});

test("deleteTrip cannot delete another user's trip", async (t) => {
  const filters: Filter[] = [];
  t.mock.method(Trip, "deleteOne", async (filter: Filter) => {
    filters.push(filter);
    return { deletedCount: 0 };
  });

  await assert.rejects(deleteTrip(userA, tripOfB), expectNotFound);
  assertScopedToUser(filters[0]);
});

// Fakes Trip.find and Trip.countDocuments and records what the service asked for.
function mockTripList(t: TestContext, total: number) {
  const calls = { filters: [] as Filter[], countFilters: [] as Filter[], sort: undefined as unknown, skip: -1, limit: -1 };
  t.mock.method(Trip, "find", (filter: Filter) => {
    calls.filters.push(filter);
    const chain = {
      sort: (sort: unknown) => { calls.sort = sort; return chain; },
      skip: (n: number) => { calls.skip = n; return chain; },
      limit: (n: number) => { calls.limit = n; return chain; },
      populate: () => chain,
      lean: async () => [],
    };
    return chain;
  });
  t.mock.method(Trip, "countDocuments", async (filter: Filter) => {
    calls.countFilters.push(filter);
    return total;
  });
  return calls;
}

test("listTrips only asks for the caller's trips, in both the page and the count", async (t) => {
  const calls = mockTripList(t, 0);

  await listTrips(userA, { page: 1, limit: 10 });

  assert.equal(calls.filters[0]?.userId?.toString(), userA);
  assert.equal(calls.countFilters[0]?.userId?.toString(), userA);
});

test("listTrips returns the first page newest first", async (t) => {
  const calls = mockTripList(t, 25);

  const result = await listTrips(userA, { page: 1, limit: 10 });

  assert.deepEqual(calls.sort, { updatedAt: -1, _id: -1 });
  assert.equal(calls.skip, 0);
  assert.equal(calls.limit, 10);
  assert.equal(result.total, 25);
  assert.equal(result.hasMore, true);
});

test("listTrips skips earlier pages and reports the last page as final", async (t) => {
  const calls = mockTripList(t, 25);

  const result = await listTrips(userA, { page: 3, limit: 10 });

  assert.equal(calls.skip, 20);
  assert.equal(result.hasMore, false);
});

test("a malformed trip id is rejected with 400 before the database is queried", async (t) => {
  const filters = mockFindOneReturningNothing(t);
  await assert.rejects(getTrip(userA, "not-an-id"), (error: unknown) => {
    assert.equal(error instanceof Error && "status" in error ? error.status : undefined, 400);
    return true;
  });
  assert.equal(filters.length, 0);
});
