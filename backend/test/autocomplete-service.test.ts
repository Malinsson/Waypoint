import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getSuggestions, type SuggestionSources } from "../src/services/autocomplete-service.js";
import type { Suggestion } from "../src/types/geo.js";
import { UpstreamError } from "../src/utils/upstream-error.js";

// Real coordinates from the recorded fixtures
const geoLisebergStockholm: Suggestion = {
  id: "geo:514150c9",
  label: "Liseberg, 125 35 Stockholm, Sweden",
  location: [18.0250638, 59.284689],
  kind: "city",
  source: "geoapify",
};
const wdLisebergStockholm: Suggestion = {
  id: "wd:Q4357031",
  label: "Liseberg",
  description: "urban district in Stockholm, Sweden",
  location: [18.0247, 59.285],
  kind: "poi",
  source: "wikidata",
};
const wdLisebergPark: Suggestion = {
  id: "wd:Q1413270",
  label: "Liseberg",
  description: "amusement park in Gothenburg, Sweden",
  location: [11.99, 57.695555555556],
  kind: "poi",
  source: "wikidata",
};

const query = { text: "Liseberg", lang: "en" };

type Behavior = Suggestion[] | Error | "hang";

// Fake Facades. "hang" never answers and ignores the signal, like a
// source that has stopped responding.
function fakeSources(t: TestContext, geoapify: Behavior, wikidata: Behavior, timeoutMs = 1_000) {
  const fake = (behavior: Behavior) =>
    t.mock.fn(async (): Promise<Suggestion[]> => {
      if (behavior === "hang") return new Promise<never>(() => {});
      if (behavior instanceof Error) throw behavior;
      return behavior;
    });
  const sources = {
    geoapify: fake(geoapify),
    wikidata: fake(wikidata),
    timeoutMs,
  };
  return sources;
}

// The cast is only for the fakes' simpler signatures
const asSources = (sources: ReturnType<typeof fakeSources>) => sources as unknown as SuggestionSources;

test("both succeed: results are merged and partial is false", async (t) => {
  const sources = fakeSources(t, [geoLisebergStockholm], [wdLisebergPark, wdLisebergStockholm]);
  const response = await getSuggestions(query, asSources(sources));

  assert.equal(response.partial, false);
  // The park keeps Wikidata's first place; the Stockholm pair is merged
  // and stays second, where Wikidata ranked it
  assert.deepEqual(
    response.results.map((suggestion) => [suggestion.id, suggestion.source]),
    [
      ["wd:Q1413270", "wikidata"],
      ["wd:Q4357031", "both"],
    ],
  );

  // Each source was asked for up to 6 candidates, with a signal
  for (const fake of [sources.geoapify, sources.wikidata]) {
    const [text, options] = fake.mock.calls[0]!.arguments as unknown as [string, { limit: number; signal: AbortSignal }];
    assert.equal(text, "Liseberg");
    assert.equal(options.limit, 6);
    assert.ok(options.signal instanceof AbortSignal);
  }
});

test("only Wikidata fails: Geoapify's results, partial is true", async (t) => {
  t.mock.method(console, "warn", () => {});
  const sources = fakeSources(t, [geoLisebergStockholm], new UpstreamError("UNAVAILABLE", "down"));
  const response = await getSuggestions(query, asSources(sources));

  assert.equal(response.partial, true);
  assert.deepEqual(response.results, [geoLisebergStockholm]);
});

test("only Geoapify fails: Wikidata's results, partial is true", async (t) => {
  t.mock.method(console, "warn", () => {});
  const sources = fakeSources(t, new UpstreamError("UNAVAILABLE", "down"), [wdLisebergPark]);
  const response = await getSuggestions(query, asSources(sources));

  assert.equal(response.partial, true);
  assert.deepEqual(response.results, [wdLisebergPark]);
});

test("both fail and Geoapify is rate limited: RATE_LIMITED", async (t) => {
  t.mock.method(console, "warn", () => {});
  const sources = fakeSources(
    t,
    new UpstreamError("RATE_LIMITED", "quota"),
    new UpstreamError("UNAVAILABLE", "down"),
  );
  await assert.rejects(
    getSuggestions(query, asSources(sources)),
    (err) => err instanceof UpstreamError && err.kind === "RATE_LIMITED",
  );
});

test("both fail for other reasons: UNAVAILABLE, even if only Wikidata is rate limited", async (t) => {
  t.mock.method(console, "warn", () => {});
  const sources = fakeSources(
    t,
    new UpstreamError("UNAVAILABLE", "down"),
    new UpstreamError("RATE_LIMITED", "slow down"),
  );
  await assert.rejects(
    getSuggestions(query, asSources(sources)),
    (err) => err instanceof UpstreamError && err.kind === "UNAVAILABLE",
  );
});

test("a source that exceeds its timeout counts as failed", async (t) => {
  t.mock.method(console, "warn", () => {});
  // A short injected timeout keeps the test fast
  const sources = fakeSources(t, "hang", [wdLisebergPark], 50);
  const response = await getSuggestions(query, asSources(sources));

  assert.equal(response.partial, true);
  assert.deepEqual(response.results, [wdLisebergPark]);
  // The signal Geoapify got has fired, so a real request would be cancelled
  const [, options] = sources.geoapify.mock.calls[0]!.arguments as unknown as [string, { signal: AbortSignal }];
  assert.equal(options.signal.aborted, true);
});

test("logs which source failed and why", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const sources = fakeSources(t, [geoLisebergStockholm], new UpstreamError("UNAVAILABLE", "Wikidata search returned 500"));
  await getSuggestions(query, asSources(sources));

  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0]!.arguments[0], "Suggestion source wikidata failed: Wikidata search returned 500");
});

// --- The digit rule: an address is looked up in Geoapify only ---

test("text with a digit: only Geoapify is asked, partial is false", async (t) => {
  const sources = fakeSources(t, [geoLisebergStockholm], [wdLisebergPark]);
  const response = await getSuggestions({ text: "Drottninggatan 1", lang: "en" }, asSources(sources));

  assert.equal(sources.wikidata.mock.callCount(), 0);
  assert.equal(sources.geoapify.mock.callCount(), 1);
  assert.equal(response.partial, false);
  assert.deepEqual(response.results, [geoLisebergStockholm]);
});

test("text without a digit: both sources are asked", async (t) => {
  const sources = fakeSources(t, [geoLisebergStockholm], [wdLisebergPark]);
  await getSuggestions(query, asSources(sources));

  assert.equal(sources.geoapify.mock.callCount(), 1);
  assert.equal(sources.wikidata.mock.callCount(), 1);
});

test("text with a digit and Geoapify failing: an error, not an empty partial list", async (t) => {
  t.mock.method(console, "warn", () => {});
  for (const kind of ["RATE_LIMITED", "UNAVAILABLE"] as const) {
    const sources = fakeSources(t, new UpstreamError(kind, "failed"), [wdLisebergPark]);
    await assert.rejects(
      getSuggestions({ text: "Drottninggatan 1", lang: "en" }, asSources(sources)),
      (err) => err instanceof UpstreamError && err.kind === kind,
    );
    assert.equal(sources.wikidata.mock.callCount(), 0);
  }
});
