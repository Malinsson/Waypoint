import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

import { Location } from "../src/models/location.js";
import { Trip } from "../src/models/trip.js";
import { FavoriteList } from "../src/models/favorite-list.js";
import { findOrCreateLocation } from "../src/services/location-service.js";
import { createFavorite, deleteFavorite } from "../src/services/favorites-service.js";
import { updateTrip } from "../src/services/trip-service.js";

// Location is shared by all users. These tests use fakes for the database and
// check what the services ask it to do.

const userId = "64b8f1e2c9e77a0012345678";
const tripId = "64b8f1e2c9e77a0012345679";

type Update = { $set?: unknown; $setOnInsert?: Record<string, unknown> };

// A fake Location.findOneAndUpdate that records every call and answers with
// a stable id per place, like a real upsert would
function mockLocations(t: TestContext) {
  const calls: { filter: unknown; update: Update }[] = [];
  const ids = new Map<string, Types.ObjectId>();
  t.mock.method(Location, "findOneAndUpdate", async (filter: Record<string, unknown>, update: Update) => {
    calls.push({ filter, update });
    const key = JSON.stringify(filter);
    if (!ids.has(key)) ids.set(key, new Types.ObjectId());
    return { _id: ids.get(key) };
  });
  return { calls, idOf: (filter: unknown) => ids.get(JSON.stringify(filter)) };
}

// --- findOrCreateLocation ---

test("an existing place is never modified: the update only sets values on insert", async (t) => {
  const { calls } = mockLocations(t);

  await findOrCreateLocation({ name: "Fake Liseberg", longitude: 1, latitude: 2, wikidataId: "Q1413270" });

  assert.deepEqual(calls[0]?.filter, { wikidataId: "Q1413270" });
  assert.equal(calls[0]?.update.$set, undefined);
  assert.equal(calls[0]?.update.$setOnInsert?.name, "Fake Liseberg");
});

test("a place without a wikidataId is looked up by name and coordinates", async (t) => {
  const { calls } = mockLocations(t);

  await findOrCreateLocation({ name: "Home", longitude: 18, latitude: 59 });

  assert.deepEqual(calls[0]?.filter, { name: "Home", longitude: 18, latitude: 59 });
});

test("when two requests insert the same wikidataId, the loser reads the winner's place", async (t) => {
  const winner = { _id: new Types.ObjectId() };
  let attempts = 0;
  t.mock.method(Location, "findOneAndUpdate", async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    return winner;
  });

  const location = await findOrCreateLocation({ name: "Liseberg", longitude: 1, latitude: 2, wikidataId: "Q1" });

  assert.equal(location, winner);
  assert.equal(attempts, 2);
});

// --- favorites ---

test("favoriting a place does not create a second copy of a shared place", async (t) => {
  const { calls, idOf } = mockLocations(t);
  const list = { name: "Favorites", locations: [] as Types.ObjectId[], save: async () => undefined };
  t.mock.method(FavoriteList, "findOneAndUpdate", async () => list);
  const place = { name: "Liseberg", description: undefined, longitude: 1, latitude: 2, wikidataId: "Q1" };

  await createFavorite(userId, place);
  // The second save of the same place is refused with 409
  await assert.rejects(
    createFavorite(userId, place),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "ALREADY_IN_LIST",
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]?.filter, { wikidataId: "Q1" });
  // Saved once, even though it was favorited twice
  assert.deepEqual(list.locations, [idOf({ wikidataId: "Q1" })]);
});

test("removing a favorite leaves the shared place in the database", async (t) => {
  const placeId = new Types.ObjectId();
  const deleted: unknown[] = [];
  t.mock.method(FavoriteList, "findOneAndUpdate", async () => ({ _id: new Types.ObjectId() }));
  t.mock.method(FavoriteList, "updateOne", async () => ({ modifiedCount: 1 }));
  t.mock.method(Location, "findByIdAndDelete", async (id: unknown) => { deleted.push(id); });
  t.mock.method(Location, "deleteOne", async (filter: unknown) => { deleted.push(filter); });

  await deleteFavorite(userId, placeId.toString());

  assert.deepEqual(deleted, []);
});

// --- updateTrip keeps ratings ---

const placeA = new Types.ObjectId();
const placeB = new Types.ObjectId();

function destination(name: string, longitude: number) {
  return { name, location: [longitude, 59] as [number, number] };
}

function mockTripForUpdate(t: TestContext, locationIds: Map<string, Types.ObjectId>) {
  const trip = {
    name: "Old",
    destinations: [
      { locationId: placeA, rating: { stars: 4, comment: "Nice" } },
      { locationId: placeB },
      { locationId: placeA, rating: { stars: 2 } },
    ] as { locationId: Types.ObjectId; rating?: { stars: number; comment?: string } }[],
    breakpoints: [{ longitude: 15.1, latitude: 58.1, rating: { stars: 5 } }] as { longitude: number; latitude: number; rating?: { stars: number } }[],
    route: {},
    roundTrip: false,
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
    save: async () => undefined,
  };
  t.mock.method(Trip, "findOne", async () => trip);
  t.mock.method(Location, "findOneAndUpdate", async (filter: { name: string }) => ({ _id: locationIds.get(filter.name) }));
  return trip;
}

function planInput(destinations: ReturnType<typeof destination>[], breakpoints: { longitude: number; latitude: number }[]) {
  return {
    destinations,
    route: {},
    roundTrip: false,
    breakpoints,
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
  };
}

test("updateTrip keeps a destination's rating when the same place is still on the trip", async (t) => {
  const trip = mockTripForUpdate(t, new Map([["A", placeA], ["B", placeB]]));

  // B and A swapped places and the second visit to A is gone
  await updateTrip(userId, tripId, planInput([destination("B", 1), destination("A", 2)], [{ longitude: 15.1, latitude: 58.1 }]));

  assert.deepEqual(trip.destinations.map((d) => [d.locationId, d.rating]), [
    [placeB, undefined],
    [placeA, { stars: 4, comment: "Nice" }],
  ]);
});

test("updateTrip matches the nth visit of a place to the nth visit before (round trip)", async (t) => {
  const trip = mockTripForUpdate(t, new Map([["A", placeA], ["B", placeB]]));

  await updateTrip(userId, tripId, planInput([destination("A", 1), destination("B", 2), destination("A", 1)], []));

  assert.deepEqual(trip.destinations.map((d) => d.rating), [{ stars: 4, comment: "Nice" }, undefined, { stars: 2 }]);
});

test("updateTrip keeps stop ratings when every stop is where it was", async (t) => {
  const trip = mockTripForUpdate(t, new Map([["A", placeA], ["B", placeB]]));

  await updateTrip(userId, tripId, planInput([destination("A", 1), destination("B", 2)], [{ longitude: 15.1, latitude: 58.1 }]));

  assert.deepEqual(trip.breakpoints[0]?.rating, { stars: 5 });
});

test("updateTrip drops all stop ratings when the plan's stops changed", async (t) => {
  const trip = mockTripForUpdate(t, new Map([["A", placeA], ["B", placeB]]));

  await updateTrip(userId, tripId, planInput([destination("A", 1), destination("B", 2)], [{ longitude: 16.5, latitude: 58.1 }]));

  assert.equal(trip.breakpoints[0]?.rating, undefined);
});

test("updateTrip rejects a bad accommodation selection before creating any place", async (t) => {
  const { calls } = mockLocations(t);
  t.mock.method(Trip, "findOne", async () => ({ destinations: [], breakpoints: [] }));

  await assert.rejects(
    updateTrip(userId, tripId, {
      ...planInput([destination("A", 1), destination("B", 2)], []),
      breakpoints: [{ longitude: 1, latitude: 2, accommodation: [], selectedAccommodationId: "missing" }],
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "INVALID_BREAKPOINT_SELECTION",
  );
  assert.equal(calls.length, 0);
});
