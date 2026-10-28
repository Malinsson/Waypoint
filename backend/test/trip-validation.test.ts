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
  const duplicates = [{ location: [18.0686, 59.3293] }, { location: [18.0686001, 59.3293001] }];
  assert.equal(hasDuplicateDestinations(duplicates), true);
});
