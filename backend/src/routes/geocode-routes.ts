import { Router } from "express";
import { autocompleteAddress, geocodeAddress } from "../controllers/geocode-controller.js";
import { optionalAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";

export const geocodeRouter = Router();

// Autocomplete fires while the user types, and each call costs upstream
// quota, so it is limited per IP. 60 per minute is a starting guess.
const autocompleteLimiter = rateLimit({ windowMs: 60_000, max: 60 });

// Works for guests and logged-in users alike
geocodeRouter.post("/", optionalAuth, geocodeAddress);
geocodeRouter.get("/autocomplete", autocompleteLimiter, optionalAuth, autocompleteAddress);
