import type { Request, Response } from "express";
import { z } from "zod";
import { geocode } from "../services/geoapify-facade.js";

const geocodeSchema = z.object({
  query: z
    .string("Query is required")
    .trim()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must be at most 200 characters"),
});

// An empty `results` array is a normal answer ("nothing found"), not an error
export async function geocodeAddress(req: Request, res: Response) {
  const { query } = geocodeSchema.parse(req.body);
  const results = await geocode(query);
  res.json({ results });
}
