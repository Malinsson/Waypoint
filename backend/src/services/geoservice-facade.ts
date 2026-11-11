import { z } from "zod";
import { config } from "../config/env.js";
import type { GeoServiceInput, GeoServiceResult } from "./geoservice-service.js";
import { UpstreamError } from "../utils/upstream-error.js";

const TIMEOUT_MS = 60_000;
const SERVICE_URL = config.geoServiceUrl.replace(/\/+$/, "");

// Render's free tier answers 429/502/503/504 while an instance is waking up or
// overloaded, so those are worth retrying. Other 4xx (wrong key, bad request)
// would fail the same way again. Two retries, so three attempts in total.
const RETRY_DELAYS_MS = [3_000, 6_000];
const MAX_RETRY_AFTER_MS = 10_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Uses the server's Retry-After (in seconds) when it sends one, capped so a
// user is never kept waiting for long
function delayBeforeRetry(response: Response | null, defaultMs: number): number {
  const seconds = Number(response?.headers.get("Retry-After"));
  if (!Number.isFinite(seconds) || seconds <= 0) return defaultMs;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

// Network errors and timeouts are retried too: a cold start often shows up as
// a refused connection. After the last attempt the final response is returned
// (or the final error thrown), so callers handle failure exactly as before.
async function fetchWithRetry(
  url: string,
  init: () => RequestInit,
  retryDelaysMs: number[],
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const retriesLeft = attempt < retryDelaysMs.length;
    let response: Response | null = null;
    try {
      response = await fetch(url, init());
      if (!RETRYABLE_STATUSES.has(response.status) || !retriesLeft) return response;
    } catch (error) {
      if (!retriesLeft) throw error;
    }
    await wait(delayBeforeRetry(response, retryDelaysMs[attempt]!));
  }
}

const breakpointsRequestSchema = z.object({
  legs: z.array(
    z.object({
      coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
      durationSeconds: z.number().min(0).max(1_000_000),
      distanceMeters: z.number().min(0),
    }),
  ),
  maxDrivingSeconds: z.number().min(1).max(1_000_000),
});

const breakpointsResponseSchema = z.object({
  breakPoints: z.array(
    z.object({
      legIndex: z.number().int().nonnegative(),
      location: z.tuple([z.number(), z.number()]),
      cumulativeSeconds: z.number().int().positive(),
    }),
  ),
});

export async function resolveBreakPoints(
  input: GeoServiceInput,
  retryDelaysMs: number[] = RETRY_DELAYS_MS,
): Promise<GeoServiceResult> {
  const requestBody = breakpointsRequestSchema.parse(input);
  let response: Response;

  try {
    // init is a function so every attempt gets a fresh timeout signal
    response = await fetchWithRetry(`${SERVICE_URL}/find-break-points`, () => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": config.geoserviceApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }), retryDelaysMs);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UpstreamError("UNAVAILABLE", `Geoservice request failed: ${reason}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const kind = response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
    throw new UpstreamError(
      kind,
      `Geoservice returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
      console.error("Geoservice fetch failed:", reason);
    throw new UpstreamError("UNAVAILABLE", `Geoservice returned invalid JSON: ${reason}`);
  }

  try {
    return breakpointsResponseSchema.parse(data);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UpstreamError("UNAVAILABLE", `Geoservice returned an unexpected response: ${reason}`);
  }
}

// Health check to wake up the geoservice and verify that it is reachable. Returns true if the service is reachable, false otherwise.
export async function checkHealth(retryDelaysMs: number[] = RETRY_DELAYS_MS): Promise<boolean> {
  let response: Response;
  try {
    response = await fetchWithRetry(`${SERVICE_URL}/health`, () => ({
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }), retryDelaysMs);
  } catch (error) {
    return false;
  }

  if (!response.ok) {
    return false;
  }

  return true;
}

