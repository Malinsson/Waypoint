import "./helpers/test-env.js";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { checkHealth, resolveBreakPoints } from "../src/services/geoservice-facade.js";
import { UpstreamError } from "../src/utils/upstream-error.js";

const input = {
  legs: [{ coordinates: [[18.07, 59.33], [17.9, 59.1]] as [number, number][], durationSeconds: 100, distanceMeters: 1000 }],
  maxDrivingSeconds: 50,
};
const okBody = { breakPoints: [{ legIndex: 0, location: [18, 59], cumulativeSeconds: 50 }] };
// No real waiting in tests: two retries, zero delay
const NO_DELAY = [0, 0];

// Replaces fetch for one test with the given responses, in order.
// An Error in the list is thrown instead of returned. Returns the call count.
function mockFetch(t: TestContext, answers: (Response | Error)[]) {
  const state = { calls: 0 };
  t.mock.method(globalThis, "fetch", async () => {
    const answer = answers[state.calls++];
    if (!answer) throw new Error("fetch called more often than expected");
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return state;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("a 429 followed by a 200 returns the break points", async (t) => {
  const state = mockFetch(t, [json({}, 429), json(okBody)]);
  const result = await resolveBreakPoints(input, NO_DELAY);
  assert.equal(state.calls, 2);
  assert.equal(result.breakPoints.length, 1);
});

test("a network error is retried", async (t) => {
  const state = mockFetch(t, [new TypeError("fetch failed"), json(okBody)]);
  await resolveBreakPoints(input, NO_DELAY);
  assert.equal(state.calls, 2);
});

test("three 429s in a row give up with an UpstreamError", async (t) => {
  const state = mockFetch(t, [json({}, 429), json({}, 429), json({}, 429)]);
  await assert.rejects(
    resolveBreakPoints(input, NO_DELAY),
    (error) => error instanceof UpstreamError && error.kind === "RATE_LIMITED",
  );
  assert.equal(state.calls, 3);
});

test("a 401 is not retried, because retrying cannot fix a wrong key", async (t) => {
  const state = mockFetch(t, [json({ error: { code: "UNAUTHORIZED" } }, 401)]);
  await assert.rejects(resolveBreakPoints(input, NO_DELAY), UpstreamError);
  assert.equal(state.calls, 1);
});

test("health check retries while the service wakes up", async (t) => {
  const state = mockFetch(t, [json({}, 503), json({ status: "ok" })]);
  assert.equal(await checkHealth(NO_DELAY), true);
  assert.equal(state.calls, 2);
});

test("health check reports false when the service stays down", async (t) => {
  mockFetch(t, [new Error("down"), new Error("down"), new Error("down")]);
  assert.equal(await checkHealth(NO_DELAY), false);
});
