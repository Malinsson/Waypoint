import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSuggestions } from "../src/services/suggestions.js";
import type { LonLat, PlaceKind, Suggestion } from "../src/types/geo.js";

function geo(label: string, location: LonLat, kind: PlaceKind = "address"): Suggestion {
  return { id: `geo:${label}`, label, location, kind, source: "geoapify" };
}

function wd(label: string, location: LonLat, description?: string): Suggestion {
  return { id: `wd:${label}`, label, location, kind: "poi", source: "wikidata", ...(description && { description }) };
}

const labels = (list: Suggestion[]) => list.map((suggestion) => suggestion.label);

// Real coordinates from the recorded fixtures:
// Geoapify's only result for "Liseberg" was the suburb in Stockholm
const geoLisebergStockholm = geo("Liseberg, 125 35 Stockholm, Sweden", [18.0250638, 59.284689], "city");
// Wikidata's Q4357031, the same district (about 40 m from Geoapify's point)
const wdLisebergStockholm = wd("Liseberg", [18.0247, 59.285], "urban district in Stockholm, Sweden");
// Wikidata's Q1413270, the amusement park in Gothenburg (about 393 km away)
const wdLisebergPark = wd("Liseberg", [11.99, 57.695555555556], "amusement park in Gothenburg, Sweden");

// Places far apart from each other, so they never merge by accident
const A: LonLat = [11.97, 57.71];
const B: LonLat = [13.0, 55.6];
const C: LonLat = [18.07, 59.33];
const D: LonLat = [15.62, 58.41];
const E: LonLat = [17.64, 59.86];

// --- Rule 1: cleaning ---

test("removes exact duplicates and invalid entries inside each list", () => {
  const result = mergeSuggestions(
    [geo("Storgatan 1, Malmö", B), geo("Storgatan 1, Malmö", B), geo("", A), geo("Bad", [0, 95])],
    [wd("Uppsala Cathedral", E), wd("Uppsala Cathedral", E), wd("   ", C)],
    8,
  );
  assert.deepEqual(labels(result), ["Uppsala Cathedral", "Storgatan 1, Malmö"]);
});

// --- Rules 2-3: cross-source duplicates ---

test("merges the same place from both lists, taking the right fields from each side", () => {
  const [merged, ...others] = mergeSuggestions([geoLisebergStockholm], [wdLisebergStockholm], 8);

  assert.deepEqual(others, []);
  assert.deepEqual(merged, {
    id: wdLisebergStockholm.id,
    label: "Liseberg",
    description: "urban district in Stockholm, Sweden",
    location: geoLisebergStockholm.location,
    kind: "city",
    source: "both",
  });
});

test("a merged pair is a poi when Geoapify says address", () => {
  // Geoapify labels named places such as museums as "address"
  const [merged] = mergeSuggestions(
    [geo("Vasa Museum, Galärvarvsvägen 14, Stockholm", [18.0915, 59.328], "address")],
    [wd("Vasa Museum", [18.0916, 59.3281], "maritime museum in Stockholm")],
    8,
  );
  assert.equal(merged!.source, "both");
  assert.equal(merged!.kind, "poi");
});

test("a merged pair keeps city when Geoapify says city", () => {
  const [merged] = mergeSuggestions([geo("Malmö, Sweden", MALMO, "city")], [wd("Malmö", MALMO)], 8);
  assert.equal(merged!.source, "both");
  assert.equal(merged!.kind, "city");
});

test("does not merge the same name far apart (Liseberg park vs Liseberg district)", () => {
  const result = mergeSuggestions([geoLisebergStockholm], [wdLisebergPark], 8);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((suggestion) => suggestion.source),
    ["wikidata", "geoapify"],
  );
});

// A point `km` straight north of `point`. Along a meridian one degree of
// latitude is the same length everywhere, so the distance is exact.
function north([lon, lat]: LonLat, km: number): LonLat {
  return [lon, lat + (km * 1000 * 180) / (Math.PI * 6_371_000)];
}

const MALMO: LonLat = [13.0038, 55.605];
const AARHUS: LonLat = [10.2039, 56.1629];
const STOCKHOLM: LonLat = [18.0686, 59.3293];

// Distances below come from the suggestion report: the same place was
// 2.4 km (Malmö) and 9.7 km (Aarhus Municipality) apart in the two sources,
// and the counties 29.1 km apart

test("merges a same-name pair 2.4 km apart", () => {
  const result = mergeSuggestions([geo("Malmö, Sweden", north(MALMO, 2.4), "city")], [wd("Malmö", MALMO)], 8);
  assert.deepEqual(
    result.map((suggestion) => suggestion.source),
    ["both"],
  );
});

test("merges a same-name pair 9.7 km apart", () => {
  const result = mergeSuggestions(
    [geo("Aarhus Municipality, Denmark", north(AARHUS, 9.7), "city")],
    [wd("Aarhus Municipality", AARHUS)],
    8,
  );
  assert.deepEqual(
    result.map((suggestion) => suggestion.source),
    ["both"],
  );
});

test("does not merge a same-name pair 29.1 km apart", () => {
  const result = mergeSuggestions(
    [geo("Stockholm County, Sweden", north(STOCKHOLM, 29.1), "city")],
    [wd("Stockholm County", STOCKHOLM)],
    8,
  );
  assert.deepEqual(
    result.map((suggestion) => suggestion.source),
    ["wikidata", "geoapify"],
  );
});

test("15 km is the limit: 14.9 km apart merges, 15.1 km apart does not", () => {
  const near = mergeSuggestions([geo("Testplats", north(STOCKHOLM, 14.9))], [wd("Testplats", STOCKHOLM)], 8);
  assert.equal(near.length, 1);
  assert.equal(near[0]!.source, "both");

  const far = mergeSuggestions([geo("Testplats", north(STOCKHOLM, 15.1))], [wd("Testplats", STOCKHOLM)], 8);
  assert.equal(far.length, 2);
});

test("pairs the nearest Wikidata candidate, even when it is listed second", () => {
  const geoAarhus = geo("Aarhus, Denmark", AARHUS, "city");
  const farther = wd("AARhus", north(AARHUS, 1.8), "listed first, 1.8 km away");
  const nearer = wd("Aarhus", north(AARHUS, 0.8), "listed second, 0.8 km away");

  const result = mergeSuggestions([geoAarhus], [farther, nearer], 8);

  // The nearer one is merged; the farther one stays a Wikidata-only row
  assert.deepEqual(
    result.map((suggestion) => [suggestion.description, suggestion.source]),
    [
      ["listed first, 1.8 km away", "wikidata"],
      ["listed second, 0.8 km away", "both"],
    ],
  );
});

test("pairs one Wikidata entry with its nearest Geoapify candidate, one-to-one", () => {
  const fartherGeo = geo("Aarhus, Region Midtjylland", north(AARHUS, 1.5), "address");
  const nearerGeo = geo("Aarhus, Denmark", north(AARHUS, 0.5), "city");

  const result = mergeSuggestions([fartherGeo, nearerGeo], [wd("Aarhus", AARHUS)], 8);

  // Merged with the nearer one (its location and kind), and the farther
  // Geoapify entry is not used a second time
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    id: "wd:Aarhus",
    label: "Aarhus",
    location: nearerGeo.location,
    kind: "city",
    source: "both",
  });
  assert.deepEqual(result[1], fartherGeo);
});

// --- Rule 4: order ---

test("a merged entry keeps its Wikidata position instead of moving to the top", () => {
  const result = mergeSuggestions(
    [geo("Only Geo", A), geo("Second, Somewhere", D), geo("First, Somewhere", C)],
    [wd("Only Wd", B), wd("First", C), wd("Second", D)],
    8,
  );
  // Wikidata stream: Only Wd, First (merged), Second (merged); Geoapify rest: Only Geo
  assert.deepEqual(labels(result), ["Only Wd", "Only Geo", "First", "Second"]);
  assert.deepEqual(
    result.map((suggestion) => suggestion.source),
    ["wikidata", "geoapify", "both", "both"],
  );
});

// Regression: "merged first" put the Stockholm district ahead of the
// amusement park when searching for "Liseberg"
test("regression (a): the amusement park stays first, the merged district second", () => {
  const result = mergeSuggestions([geoLisebergStockholm], [wdLisebergPark, wdLisebergStockholm], 8);

  assert.deepEqual(
    result.map((suggestion) => [suggestion.description, suggestion.source]),
    [
      ["amusement park in Gothenburg, Sweden", "wikidata"],
      ["urban district in Stockholm, Sweden", "both"],
    ],
  );
});

test("regression (b): a merged entry at position 4 in Wikidata stays at position 4", () => {
  // Geoapify has only the matching entry, so nothing alternates in between
  const result = mergeSuggestions(
    [geo("Fourth, Somewhere", D)],
    [wd("W1", A), wd("W2", B), wd("W3", C), wd("Fourth", D), wd("W5", E)],
    8,
  );
  assert.deepEqual(labels(result), ["W1", "W2", "W3", "Fourth", "W5"]);
  assert.equal(result[3]!.source, "both");
});

// W4m and Gm are the same place: equal normalized name, about 10 m apart
const W4m = wd("Fourth Place", [15.62, 58.41]);
const Gm = geo("Fourth place, Linköping, Sweden", [15.6201, 58.4101]);

test("regression (b2): merged W4m stays last in Wikidata's stream while the rest alternates", () => {
  const result = mergeSuggestions(
    [Gm, geo("G1", A), geo("G2", B)],
    [wd("W1", C), wd("W2", E), wd("W3", [10, 60]), W4m],
    8,
  );
  assert.deepEqual(labels(result), ["W1", "G1", "W2", "G2", "W3", "Fourth Place"]);
  assert.equal(result[5]!.source, "both");
});

test("alternates starting with Wikidata, then the rest of the longer list", () => {
  const result = mergeSuggestions(
    [geo("G1", A), geo("G2", B)],
    [wd("W1", C), wd("W2", D), wd("W3", E), wd("W4", [10, 60])],
    8,
  );
  assert.deepEqual(labels(result), ["W1", "G1", "W2", "G2", "W3", "W4"]);
});

// --- Rule 5: cut ---

test("cuts the list to max", () => {
  const geoList = Array.from({ length: 5 }, (_, index) => geo(`G${index + 1}`, [10 + index, 60]));
  const wdList = Array.from({ length: 5 }, (_, index) => wd(`W${index + 1}`, [10 + index, 50]));

  const result = mergeSuggestions(geoList, wdList, 8);
  assert.deepEqual(labels(result), ["W1", "G1", "W2", "G2", "W3", "G3", "W4", "G4"]);
});

test("handles empty lists on one or both sides", () => {
  assert.deepEqual(labels(mergeSuggestions([geo("G1", A)], [], 8)), ["G1"]);
  assert.deepEqual(labels(mergeSuggestions([], [wd("W1", A)], 8)), ["W1"]);
  assert.deepEqual(mergeSuggestions([], [], 8), []);
});

// --- Purity ---

// Freezes an object and everything inside it, so any change throws
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("does not change its inputs and gives the same output for the same input", () => {
  const geoList = deepFreeze([geoLisebergStockholm, geo("G1", A), geo("G1", A)]);
  const wdList = deepFreeze([wdLisebergPark, wdLisebergStockholm, wd("W1", B)]);
  const geoBefore = structuredClone(geoList);
  const wdBefore = structuredClone(wdList);

  const first = mergeSuggestions(geoList, wdList, 8);
  const second = mergeSuggestions(geoList, wdList, 8);

  assert.deepEqual(geoList, geoBefore);
  assert.deepEqual(wdList, wdBefore);
  assert.deepEqual(first, second);
});

// --- Name normalization ---

const TROMSO: LonLat = [18.9553, 69.6496];
const BODO: LonLat = [14.4049, 67.2804];

// True if the two names, at the same place, are merged into one entry
function sameName(geoapifyLabel: string, wikidataLabel: string, location: LonLat): boolean {
  const result = mergeSuggestions([geo(geoapifyLabel, location)], [wd(wikidataLabel, location)], 8);
  return result.length === 1 && result[0]!.source === "both";
}

test('treats "Tromsø" and "Tromso" as the same name', () => {
  assert.equal(sameName("Tromsø, Troms, Norway", "Tromso", TROMSO), true);
});

test('treats "Bodø" and "Bodo" as the same name', () => {
  assert.equal(sameName("Bodø, Nordland, Norway", "Bodo", BODO), true);
});

test("Swedish å, ä and ö still match their plain letters", () => {
  assert.equal(sameName("Göteborg, Sweden", "Goteborg", A), true);
  assert.equal(sameName("Malmö, Sweden", "Malmo", B), true);
  assert.equal(sameName("Västerås, Sweden", "Vasteras", E), true);
  assert.equal(sameName("Åre, Sweden", "Are", D), true);
  // Different letters stay different names
  assert.equal(sameName("Malmö, Sweden", "Malma", B), false);
});

test("normalization is symmetric: the special letter can be on either side", () => {
  for (const [special, plain, location] of [
    ["Tromsø", "Tromso", TROMSO],
    ["Bodø", "Bodo", BODO],
    ["Göteborg", "Goteborg", A],
  ] as const) {
    assert.equal(sameName(`${special}, X`, plain, location), true, `${special} (Geoapify) vs ${plain} (Wikidata)`);
    assert.equal(sameName(`${plain}, X`, special, location), true, `${plain} (Geoapify) vs ${special} (Wikidata)`);
  }
});
