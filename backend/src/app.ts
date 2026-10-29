import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { healthRouter } from "./routes/health-routes.js";
import { authRouter } from "./routes/auth-routes.js";
import { geocodeRouter } from "./routes/geocode-routes.js";
import { tripRouter } from "./routes/trip-routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";
import { favoriteRouter } from "./routes/favorites-routes.js";

export const app = express();

// Render puts one proxy in front of the app. Trusting it makes req.ip the
// real client address instead of the proxy's, which the rate limiter needs.
app.set("trust proxy", 1);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/trips", tripRouter);
app.use("/api/favorites", favoriteRouter);

app.get("/api/live", (_req, res) => {
  res.json({ status: "ok" })
})

// Must come after all routes, otherwise they would catch requests first
app.use(notFoundHandler);
app.use(errorHandler);
