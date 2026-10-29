import { Router } from "express";
import { isDbConnected } from "../config/db.js";
import { checkHealth } from "../services/geoservice-facade.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const geoserviceIsRunning = await checkHealth();

  res.json({
    status: "ok",
    database: isDbConnected() ? "connected" : "disconnected",
    geoservice: geoserviceIsRunning ? "running" : "unavailable",
  });
});
