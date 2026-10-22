import "./helpers/test-env.js";
import { before, after, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../src/app.js";

// The real app on a random port. Only the outside world is faked: requests
// to Geoapify and Wikidata are recorded and answered by the test, while the
// test's own requests to localhost go through the real fetch.
const realFetch = globalThis.fetch;
let server: Server;
let baseUrl: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(() => {
  // fetch keeps connections open for reuse, and close() would wait for them
  server.closeAllConnections();
  server.close();
});

// `answer` decides the response for each upstream host
function fakeUpstreams(t: TestContext, answer: (url: URL) => Response): URL[] {
  const upstreamCalls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "localhost") return realFetch(input, init);
    upstreamCalls.push(url);
    return answer(url);
  });
  // The error handler and the orchestration log failures; keep test output clean
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "warn", () => {});
  return upstreamCalls;
}

const isGeoapify = (url: URL) => url.hostname === "api.geoapify.com";

test("invalid input gives 400 and never reaches Geoapify or Wikidata", async (t) => {
  const upstreamCalls = fakeUpstreams(t, () => new Response("{}", { status: 200 }));

  for (const search of ["?text=ab", "?text=Liseberg&lat=57.7"]) {
    const response = await fetch(`${baseUrl}/api/geocode/autocomplete${search}`);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
  }
  assert.equal(upstreamCalls.length, 0);
});

test("both sources fail with Geoapify rate limited: 503 UPSTREAM_RATE_LIMITED", async (t) => {
  const upstreamCalls = fakeUpstreams(t, (url) =>
    isGeoapify(url) ? new Response("quota", { status: 429 }) : new Response("down", { status: 500 }),
  );

  const response = await fetch(`${baseUrl}/api/geocode/autocomplete?text=Liseberg`);
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UPSTREAM_RATE_LIMITED");
  // Both sources were really asked
  assert.equal(upstreamCalls.some(isGeoapify), true);
  assert.equal(
    upstreamCalls.some((url) => url.hostname === "www.wikidata.org"),
    true,
  );
});

test("both sources fail for other reasons: 503 UPSTREAM_UNAVAILABLE", async (t) => {
  fakeUpstreams(t, () => new Response("down", { status: 500 }));

  const response = await fetch(`${baseUrl}/api/geocode/autocomplete?text=Liseberg`);
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "UPSTREAM_UNAVAILABLE");
});

test("text with a digit and Geoapify failing: 503 with the right code, Wikidata never asked", async (t) => {
  for (const [status, code] of [
    [429, "UPSTREAM_RATE_LIMITED"],
    [500, "UPSTREAM_UNAVAILABLE"],
  ] as const) {
    const upstreamCalls = fakeUpstreams(t, () => new Response("failed", { status }));

    const response = await fetch(`${baseUrl}/api/geocode/autocomplete?text=Drottninggatan%201`);
    assert.equal(response.status, 503);
    const body = (await response.json()) as Record<string, unknown>;
    // The error shape only: no results and no partial flag
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.equal((body.error as { code: string }).code, code);
    assert.equal(
      upstreamCalls.some((url) => url.hostname === "www.wikidata.org"),
      false,
    );
    assert.equal(upstreamCalls.filter(isGeoapify).length, 1);
  }
});
