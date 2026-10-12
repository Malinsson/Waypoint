import { Router } from "express";
import { isDbConnected } from "../config/db.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    database: isDbConnected() ? "connected" : "disconnected",
  });
});
