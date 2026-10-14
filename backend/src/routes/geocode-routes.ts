import { Router } from "express";
import { geocodeAddress } from "../controllers/geocode-controller.js";
import { optionalAuth } from "../middleware/auth.js";

export const geocodeRouter = Router();

// Works for guests and logged-in users alike
geocodeRouter.post("/", optionalAuth, geocodeAddress);
