import { Router } from "express";
import { plan, saveTrip, listTrips, getTrip, updateTrip, deleteTrip } from "../controllers/trip-controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

export const tripRouter = Router();

// Planning works for guests and logged-in users alike and saves nothing
tripRouter.post("/plan", optionalAuth, plan);
tripRouter.post("/", requireAuth, saveTrip);
tripRouter.get("/", requireAuth, listTrips);
tripRouter.get("/:id", requireAuth, getTrip);
tripRouter.patch("/:id", requireAuth, updateTrip);
tripRouter.delete("/:id", requireAuth, deleteTrip);
