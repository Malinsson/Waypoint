import { Router } from "express";
import { plan } from "../controllers/trip-controller.js";
import { optionalAuth } from "../middleware/auth.js";

export const tripRouter = Router();

// Planning works for guests and logged-in users alike and saves nothing
tripRouter.post("/plan", optionalAuth, plan);
