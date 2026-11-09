// @ts-expect-error Node.js type definitions are not included in this project.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AccommodationFinderFactory,
  findAccommodation,
  selectAccommodations,
  type SearchPlaces,
} from "../src/services/accommodation-service.js";

const point: [number, number] = [18, 59];

function place(id: string, name: string, lon: number, lat: number) {
  return { id, name, location: [lon, lat] as [number, number], address: `${name} address` };
}

test("selection alternates types, skips empty types, and sorts the display list", () => {
  const result = selectAccommodations(new Map([
    ["hotel", [
      { ...place("h1", "Hotel 1", 18.01, 59), type: "hotel", distanceMeters: 1000 },
      { ...place("h2", "Hotel 2", 18.02, 59), type: "hotel", distanceMeters: 2000 },
      { ...place("h3", "Hotel 3", 18.03, 59), type: "hotel", distanceMeters: 3000 },
    ]],
    ["camping", [
      { ...place("c1", "Camp 1", 18.04, 59), type: "camping", distanceMeters: 4000 },
      { ...place("c2", "Camp 2", 18.08, 59), type: "camping", distanceMeters: 8000 },
    ]],
  ]), ["hotel", "camping"]);
  assert.deepEqual(result.map((item) => item.id), ["h1", "h2", "h3", "c1", "c2"]);
});

test("the first selected type owns duplicate places", async () => {
  const searchPlaces: SearchPlaces = async (categories) => categories[0] === "accommodation.hotel"
    ? [place("same", "Hotel", 18.01, 59)]
    : [place("same", "Hotel", 18.01, 59), place("camp", "Camp", 18.02, 59)];
  const result = await findAccommodation(point, ["hotel", "camping"], searchPlaces);
  assert.deepEqual(result.accommodation.map((item) => [item.id, item.type]), [
    ["same", "hotel"],
    ["camp", "camping"],
  ]);
});

test("finder drops unnamed places, sorts by distance, and passes its category", async () => {
  let categories: string[] = [];
  const finder = AccommodationFinderFactory.get("hotel", async (requested) => {
    categories = requested;
    return [place("far", "Far", 18.1, 59), place("unnamed", "", 18.01, 59), place("near", "Near", 18.001, 59)];
  });
  const result = await finder.search(point, 10_000);
  assert.deepEqual(categories, ["accommodation.hotel"]);
  assert.deepEqual(result.map((item) => item.id), ["near", "far"]);
});

test("empty first search retries once at 25 km", async () => {
  const radii: number[] = [];
  const result = await findAccommodation(point, ["hotel"], async (_categories, _point, radius) => {
    radii.push(radius);
    return [];
  });
  assert.deepEqual(radii, [10_000, 25_000]);
  assert.equal(result.accommodation.length, 0);
  assert.equal(result.radiusMeters, 25_000);
});
