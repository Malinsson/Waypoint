import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { rateLimit } from "../src/middleware/rate-limit.js";
import { errorHandler } from "../src/middleware/error-handler.js";

test("allows max requests per window, then answers 429 until the window has passed", async (t) => {
  // A tiny app with a low limit and a short window, so the test runs fast
  const app = express();
  app.get("/limited", rateLimit({ windowMs: 300, max: 2 }), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);

  // Port 0 lets the operating system pick any free port
  const server = app.listen(0);
  // fetch keeps connections open for reuse, and close() would wait for them
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/limited`;

  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url)).status, 200);

  const blocked = await fetch(url);
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), {
    error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment and try again." },
  });

  // After the window the same client may send requests again
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal((await fetch(url)).status, 200);
});
