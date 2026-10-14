import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { healthRouter } from "./routes/health-routes.js";
import { authRouter } from "./routes/auth-routes.js";
import { geocodeRouter } from "./routes/geocode-routes.js";
import { tripRouter } from "./routes/trip-routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/geocode", geocodeRouter);
app.use("/api/trips", tripRouter);

// Must come after all routes, otherwise they would catch requests first
app.use(notFoundHandler);
app.use(errorHandler);
