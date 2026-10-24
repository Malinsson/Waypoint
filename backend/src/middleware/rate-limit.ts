import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";

type Counter = { count: number; windowStart: number };

// Fixed-window limiter: each IP may make `max` requests per `windowMs`.
// When a window has passed, that IP's count starts again from zero.
// Counts live in memory, so they reset on restart and are not shared
// between server instances. Good enough for one small Render service.
export function rateLimit(options: { windowMs: number; max: number }): RequestHandler {
  const counters = new Map<string, Counter>();
  let lastCleanup = Date.now();

  return (req, _res, next) => {
    const now = Date.now();

    // Remove finished windows now and then, so IPs that never come back
    // do not stay in memory forever
    if (now - lastCleanup > options.windowMs) {
      for (const [ip, counter] of counters) {
        if (now - counter.windowStart >= options.windowMs) counters.delete(ip);
      }
      lastCleanup = now;
    }

    // req.ip is only the real client address because app.ts sets "trust proxy"
    const ip = req.ip ?? "unknown";
    const counter = counters.get(ip);

    if (!counter || now - counter.windowStart >= options.windowMs) {
      counters.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }

    counter.count += 1;
    if (counter.count > options.max) {
      next(new AppError(429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again."));
      return;
    }
    next();
  };
}
