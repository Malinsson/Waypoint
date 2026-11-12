import "./helpers/test-env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasDuplicateDestinations,
  planSchema,
  tripInputSchema,
} from "../src/controllers/trip-controller.js";

test("plan schema rejects duplicate destination coordinates", () => {
  const result = planSchema.safeParse({
    destinations: [
      { id: "first", name: "Stockholm", location: [18.0686, 59.3293] },
      { id: "second", name: "Stockholm again", location: [18.0686, 59.3293] },
    ],
    options: {
      optimizeOrder: false,
      maxDrivingHours: 6,
      accommodationTypes: ["hotel"],
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /already added that destination/i);
  }
});

test("plan schema accepts max driving seconds in the supported range", () => {
  const result = planSchema.safeParse({
    destinations: [
      { id: "first", name: "Stockholm", location: [18.0686, 59.3293] },
      { id: "second", name: "Gothenburg", location: [11.9746, 57.7089] },
    ],
    options: { maxDrivingSeconds: 18_000, accommodationTypes: ["hotel"] },
  });
  assert.equal(result.success, true);
});

test("plan schema rejects non-hour and out-of-range driving limits", () => {
  for (const maxDrivingSeconds of [3_601, 57_601]) {
    const result = planSchema.safeParse({
      destinations: [
        { id: "first", name: "Stockholm", location: [18.0686, 59.3293] },
        { id: "second", name: "Gothenburg", location: [11.9746, 57.7089] },
      ],
      options: { maxDrivingSeconds, accommodationTypes: ["hotel"] },
    });
    assert.equal(result.success, false);
  }
});

test("saved trip schema rejects duplicate destination coordinates", () => {
  const result = tripInputSchema.safeParse({
    name: "Weekend trip",
    destinations: [
      { name: "Gothenburg", location: [11.9746, 57.7089] },
      { name: "Gothenburg", location: [11.9746, 57.7089] },
    ],
    route: { type: "LineString", coordinates: [[11.9746, 57.7089], [18.0686, 59.3293]] },
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /already added that destination/i);
  }
});

test("duplicate helper tolerates tiny coordinate drift from the same place", () => {
  const duplicates: { location: [number, number] }[] = [
    { location: [18.0686, 59.3293] },
    { location: [18.0686001, 59.3293001] },
  ];
  assert.equal(hasDuplicateDestinations(duplicates), true);
});

test("saved round trip accepts the same first and last destination", () => {
  const result = tripInputSchema.safeParse({
    name: "Round trip",
    destinations: [
      { name: "Stockholm", location: [18.0686, 59.3293] },
      { name: "Gothenburg", location: [11.9746, 57.7089] },
      { name: "Stockholm", location: [18.0686, 59.3293] },
    ],
    roundTrip: true,
    route: { type: "LineString", coordinates: [] },
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
  });

  assert.equal(result.success, true);
});

test("saved duplicate destinations remain invalid without round trip", () => {
  const result = tripInputSchema.safeParse({
    name: "Not a round trip",
    destinations: [
      { name: "Stockholm", location: [18.0686, 59.3293] },
      { name: "Gothenburg", location: [11.9746, 57.7089] },
      { name: "Stockholm", location: [18.0686, 59.3293] },
    ],
    route: { type: "LineString", coordinates: [] },
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
  });

  assert.equal(result.success, false);
});

// Distinct places along a line so the duplicate check does not interfere.
function makeDestinations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Stop ${i}`,
    location: [10 + i, 55 + i * 0.5] as [number, number],
  }));
}

function savedTrip(destinations: ReturnType<typeof makeDestinations>, roundTrip: boolean) {
  return {
    name: "Long trip",
    destinations,
    roundTrip,
    route: { type: "LineString", coordinates: [] },
    maxDrivingHours: 6,
    accommodationPreference: { types: ["hotel"] },
  };
}

test("saved round trip accepts 10 destinations plus the closing stop", () => {
  const stops = makeDestinations(10);
  const closed = [...stops, stops[0]];
  assert.equal(tripInputSchema.safeParse(savedTrip(closed, true)).success, true);
});

test("saved trip rejects 11 destinations without round trip", () => {
  const result = tripInputSchema.safeParse(savedTrip(makeDestinations(11), false));
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error.issues[0].message, /at most 10 destinations/i);
  }
});

test("saved round trip rejects more than 11 destinations", () => {
  const stops = makeDestinations(11);
  const closed = [...stops, stops[0]];
  assert.equal(tripInputSchema.safeParse(savedTrip(closed, true)).success, false);
});
