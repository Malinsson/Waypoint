import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";

import { Trip } from "../src/models/trip.js";
import { completeTrip } from "../src/services/trip-service.js";

const userId = "64b8f1e2c9e77a0012345678";
const tripId = "64b8f1e2c9e77a0012345679";

function createMockTrip(completedAt?: Date) {
  return {
    completedAt,
    save: async () => undefined,
  };
}

function mockOwnedTrip(t: TestContext, trip: ReturnType<typeof createMockTrip>) {
  t.mock.method(Trip, "findOne", async () => trip);
}

test("completeTrip stores the completion timestamp", async (t) => {
  const trip = createMockTrip();
  mockOwnedTrip(t, trip);
  const startedAt = new Date();

  const result = await completeTrip(userId, tripId);
  const finishedAt = new Date();

  assert.equal(result, trip);
  assert.ok(trip.completedAt instanceof Date);
  assert.ok(trip.completedAt >= startedAt);
  assert.ok(trip.completedAt <= finishedAt);
});

test("completeTrip rejects a trip that is already completed", async (t) => {
  const completedAt = new Date("2026-11-08T08:00:00.000Z");
  const trip = createMockTrip(completedAt);
  mockOwnedTrip(t, trip);

  await assert.rejects(
    completeTrip(userId, tripId),
    (error: unknown) => {
      assert.equal(error instanceof Error && "status" in error ? error.status : undefined, 409);
      assert.equal(error instanceof Error && "code" in error ? error.code : undefined, "TRIP_ALREADY_COMPLETED");
      return true;
    },
  );
});
