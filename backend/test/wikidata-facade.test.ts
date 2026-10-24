import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildEntitiesParams,
  buildSearchParams,
  sanitizeSearchText,
  searchPlaces,
} from "../src/services/wikidata-facade.js";
import { UpstreamError } from "../src/utils/upstream-error.js";

// `any` on purpose: fixtures are raw Wikidata JSON that the tests dig into
// freely; the Facade's own Zod schemas are what is being tested
function fixture(name: string): any {
  return JSON.parse(readFileSync(new URL(`./fixtures/wikidata/${name}`, import.meta.url), "utf8"));
}

// Recorded from the real API (search for "Liseberg", then its six ids)
const searchLiseberg = fixture("search-liseberg.json");
const entitiesLiseberg = fixture("entities-liseberg.json");

// A search response listing these ids, for fixtures with other entities
function searchFor(...ids: string[]) {
  return { query: { search: ids.map((title) => ({ title })) } };
}

type Call = { url: URL; init: RequestInit | undefined };

// Replaces fetch for one test. Answers the search and the entities request
// from the given bodies, picked by the `action` parameter, and records
// every request so the test can inspect it.
function mockWikidata(t: TestContext, search: unknown, entities: unknown): Call[] {
  const calls: Call[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL, init?: RequestInit) => {
    calls.push({ url, init });
    const body = url.searchParams.get("action") === "query" ? search : entities;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return calls;
}

const entity = (id: string) => entitiesLiseberg.entities[id];
const recordedLonLat = (id: string) => {
  const value = entity(id).claims.P625[0].mainsnak.datavalue.value;
  return [value.longitude, value.latitude];
};

// --- Mapping (recorded fixtures) ---

test("maps label, description, id, kind and source from the recorded entities", async (t) => {
  mockWikidata(t, searchLiseberg, entitiesLiseberg);
  const [first] = await searchPlaces("Liseberg");

  assert.deepEqual(first, {
    id: "wd:Q1413270",
    label: "Liseberg",
    description: "amusement park in Gothenburg, Sweden",
    location: recordedLonLat("Q1413270"),
    kind: "poi",
    source: "wikidata",
  });
});

test("puts longitude first: [lon, lat]", async (t) => {
  mockWikidata(t, searchLiseberg, entitiesLiseberg);
  const [first] = await searchPlaces("Liseberg");

  // Recorded: latitude 57.6955..., longitude 11.99
  assert.equal(first!.location[0], 11.99);
  assert.equal(first!.location[1], 57.695555555556);
});

test("keeps the search ranking, and leaves out a missing description", async (t) => {
  mockWikidata(t, searchLiseberg, entitiesLiseberg);
  const suggestions = await searchPlaces("Liseberg");

  const expectedOrder = searchLiseberg.query.search.map((hit: { title: string }) => `wd:${hit.title}`);
  assert.deepEqual(
    suggestions.map((suggestion) => suggestion.id),
    expectedOrder,
  );
  // Q10549127 has no English description in the recording
  const hall = suggestions.find((suggestion) => suggestion.id === "wd:Q10549127")!;
  assert.equal("description" in hall, false);
});

test("drops an entity that has no coordinates at all", async (t) => {
  // Recorded: Q111 (the planet Mars) has no P625 statement
  mockWikidata(t, searchFor("Q111"), fixture("entities-other-globe.json"));
  assert.deepEqual(await searchPlaces("Mars"), []);
});

// --- Coordinate rules (synthetic fixtures, see their _synthetic note) ---

test("drops coordinates on another globe (synthetic)", async (t) => {
  mockWikidata(t, searchFor("Q4357031"), fixture("synthetic-entities-other-globe.json"));
  assert.deepEqual(await searchPlaces("Liseberg"), []);
});

test("chooses the preferred statement, otherwise the first that is not deprecated (synthetic)", async (t) => {
  mockWikidata(t, searchFor("Q1413270", "Q124515558"), fixture("synthetic-entities-ranks.json"));
  const [park, oceana] = await searchPlaces("Liseberg");

  // Order in the file: deprecated (1,1), normal (2,2), preferred (real place)
  assert.deepEqual(park!.location, [11.99, 57.695555555556]);
  // Order in the file: deprecated (1,1), normal (real place)
  assert.deepEqual(oceana!.location, [11.994916666666667, 57.6904]);
});

test("drops an entity without a label in the requested language (synthetic)", async (t) => {
  mockWikidata(t, searchLiseberg, fixture("synthetic-entities-missing-label.json"));
  const ids = (await searchPlaces("Liseberg")).map((suggestion) => suggestion.id);

  assert.equal(ids.includes("wd:Q4357031"), false);
  assert.equal(ids.length, 5);
});

// --- Query building (requests are captured, nothing is sent) ---

test("search request: text plus haswbstatement:P625, namespace 0, limit, JSON", async (t) => {
  const calls = mockWikidata(t, searchLiseberg, entitiesLiseberg);
  await searchPlaces("Liseberg", { limit: 4 });

  const params = calls[0]!.url.searchParams;
  assert.equal(calls[0]!.url.origin + calls[0]!.url.pathname, "https://www.wikidata.org/w/api.php");
  assert.equal(params.get("action"), "query");
  assert.equal(params.get("list"), "search");
  assert.equal(params.get("srsearch"), "Liseberg haswbstatement:P625");
  assert.equal(params.get("srnamespace"), "0");
  assert.equal(params.get("srlimit"), "4");
  assert.equal(params.get("format"), "json");
});

test("entities request: one request, ids joined with |, labels/descriptions/claims, language", async (t) => {
  const calls = mockWikidata(t, searchLiseberg, entitiesLiseberg);
  await searchPlaces("Liseberg", { lang: "sv" });

  assert.equal(calls.length, 2);
  const params = calls[1]!.url.searchParams;
  assert.equal(params.get("action"), "wbgetentities");
  assert.equal(params.get("ids"), "Q1413270|Q4357031|Q124515558|Q116766958|Q10549127|Q6558743");
  assert.equal(params.get("props"), "labels|descriptions|claims");
  assert.equal(params.get("languages"), "sv");
});

test("both requests send the User-Agent from config", async (t) => {
  const calls = mockWikidata(t, searchLiseberg, entitiesLiseberg);
  await searchPlaces("Liseberg");

  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get("User-Agent"), process.env.WIKIDATA_USER_AGENT);
  }
});

test("neutralizes quotes, colons and pipes in the user's text", () => {
  assert.equal(sanitizeSearchText('Lise"berg haswbstatement:P31|x'), "Lise berg haswbstatement P31 x");

  // Only our own keyword is left in the query
  const srsearch = buildSearchParams(sanitizeSearchText('"Liseberg" haswbstatement:P31'), 6).srsearch!;
  assert.equal(srsearch, "Liseberg haswbstatement P31 haswbstatement:P625");
  assert.equal(srsearch.match(/:/g)?.length, 1);
});

test("the build helpers produce the documented parameters", () => {
  assert.deepEqual(buildEntitiesParams(["Q1", "Q2"], "en"), {
    action: "wbgetentities",
    ids: "Q1|Q2",
    props: "labels|descriptions|claims",
    languages: "en",
    format: "json",
  });
});

test("sends nothing when the text is only special characters", async (t) => {
  const calls = mockWikidata(t, searchLiseberg, entitiesLiseberg);
  assert.deepEqual(await searchPlaces('":|'), []);
  assert.equal(calls.length, 0);
});

test("makes no second request when the search finds nothing", async (t) => {
  const calls = mockWikidata(t, searchFor(), entitiesLiseberg);
  assert.deepEqual(await searchPlaces("xqzxqz"), []);
  assert.equal(calls.length, 1);
});

// --- Cancelling and errors ---

test("passes the caller's AbortSignal on to both requests", async (t) => {
  const calls = mockWikidata(t, searchLiseberg, entitiesLiseberg);
  const controller = new AbortController();
  await searchPlaces("Liseberg", { signal: controller.signal });

  // The signal fetch gets also carries the timeout, so it is combined
  // rather than the same object: aborting ours must abort theirs
  controller.abort();
  for (const call of calls) {
    assert.equal(call.init?.signal?.aborted, true);
  }
});

test("throws UpstreamError for a network error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(searchPlaces("Liseberg"), UpstreamError);
});

test("throws UpstreamError for a non-200 response, RATE_LIMITED for 429", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("down", { status: 500 }));
  await assert.rejects(searchPlaces("Liseberg"), (err) => err instanceof UpstreamError && err.kind === "UNAVAILABLE");

  fetchMock.mock.mockImplementation(async () => new Response("slow down", { status: 429 }));
  await assert.rejects(searchPlaces("Liseberg"), (err) => err instanceof UpstreamError && err.kind === "RATE_LIMITED");
});

test("throws UpstreamError for an unexpected shape, including an API error sent with status 200", async (t) => {
  mockWikidata(t, { error: { code: "badvalue", info: "Unrecognized value" } }, entitiesLiseberg);
  await assert.rejects(searchPlaces("Liseberg"), UpstreamError);
});
