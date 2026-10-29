import { z } from "zod";
import { config } from "../config/env.js";
import type { GeoServiceInput, GeoServiceResult } from "./geoservice-service.js";
import { UpstreamError } from "../utils/upstream-error.js";

const TIMEOUT_MS = 60_000;
const SERVICE_URL = config.geoServiceUrl.replace(/\/+$/, "");

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

export async function resolveBreakPoints(input: GeoServiceInput): Promise<GeoServiceResult> {
  const requestBody = breakpointsRequestSchema.parse(input);
  let response: Response;

  try {
    response = await fetch(`${SERVICE_URL}/find-break-points`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": config.geoserviceApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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
export async function checkHealth(): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`${SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return false;
  }

  if (!response.ok) {
    return false;
  }

  return true;
}

