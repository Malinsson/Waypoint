import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { search } from "../controllers/accommodation-controller.js";

export const accommodationRouter = Router();

accommodationRouter.post("/search", optionalAuth, rateLimit({ windowMs: 60_000, max: 30 }), search);
