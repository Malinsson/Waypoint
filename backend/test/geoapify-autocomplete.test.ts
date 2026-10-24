import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { autocomplete } from "../src/services/geoapify-facade.js";
import { PLACE_KINDS } from "../src/types/geo.js";

type RawResult = { place_id: string; formatted: string; lon: number; lat: number; result_type?: string };

// A real Geoapify response for "Liseberg", saved once so the tests use no quota
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/geoapify-autocomplete-liseberg.json", import.meta.url), "utf8"),
) as { results: RawResult[] };

// Replaces fetch for one test: answers with `body` and records the URL asked for
function mockFetch(t: TestContext, body: unknown): { urls: URL[] } {
  const calls = { urls: [] as URL[] };
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    calls.urls.push(url);
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return calls;
}

test("maps a recorded response to Suggestions", async (t) => {
  mockFetch(t, fixture);
  const suggestions = await autocomplete("Liseberg");

  assert.ok(suggestions.length > 0, "the fixture should contain at least one result");
  for (const suggestion of suggestions) {
    const raw = fixture.results.find((result) => `geo:${result.place_id}` === suggestion.id);
    assert.ok(raw, `id ${suggestion.id} should be "geo:" + a place_id from the response`);
    assert.equal(suggestion.label, raw.formatted);
    // Longitude first, as everywhere in our code
    assert.deepEqual(suggestion.location, [raw.lon, raw.lat]);
    assert.equal(suggestion.source, "geoapify");
    assert.ok(PLACE_KINDS.includes(suggestion.kind));
  }
});

test("removes exact duplicates (same label and location)", async (t) => {
  const first = fixture.results[0]!;
  mockFetch(t, { results: [...fixture.results, { ...first }] });
  const suggestions = await autocomplete("Liseberg");

  const copies = suggestions.filter(
    (suggestion) =>
      suggestion.label === first.formatted &&
      suggestion.location[0] === first.lon &&
      suggestion.location[1] === first.lat,
  );
  assert.equal(copies.length, 1);
});

test("maps Geoapify result types to our three kinds", async (t) => {
  // Hand-made items, one per mapping group, to pin down the mapping exactly
  const item = (place_id: string, result_type?: string) => ({
    place_id,
    formatted: `Place ${place_id}`,
    lon: 11.99,
    lat: 57.69,
    ...(result_type && { result_type }),
  });
  mockFetch(t, {
    results: [item("1", "street"), item("2", "city"), item("3", "amenity"), item("4", "unknown"), item("5")],
  });
  const kinds = (await autocomplete("test")).map((suggestion) => suggestion.kind);

  assert.deepEqual(kinds, ["address", "city", "address", "poi", "poi"]);
});

test("sends limit, lang and format, and no bias unless asked", async (t) => {
  const calls = mockFetch(t, { results: [] });
  await autocomplete("Liseberg");

  const url = calls.urls[0]!;
  assert.equal(url.pathname, "/v1/geocode/autocomplete");
  assert.equal(url.searchParams.get("text"), "Liseberg");
  assert.equal(url.searchParams.get("limit"), "6");
  assert.equal(url.searchParams.get("lang"), "en");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.has("bias"), false);
});

test("writes the bias longitude first", async (t) => {
  const calls = mockFetch(t, { results: [] });
  await autocomplete("Liseberg", { bias: [11.99, 57.69], lang: "sv" });

  const url = calls.urls[0]!;
  assert.equal(url.searchParams.get("bias"), "proximity:11.99,57.69");
  assert.equal(url.searchParams.get("lang"), "sv");
});
