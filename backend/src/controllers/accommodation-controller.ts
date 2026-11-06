import type { Request, Response } from "express";
import { z } from "zod";
import { findAccommodation } from "../services/geoapify-facade.js";
import { ACCOMMODATION_TYPES } from "../types/geo.js";

const requestSchema = z.object({
  location: z.tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ]),
  types: z.array(z.enum(ACCOMMODATION_TYPES)).min(1).max(4)
    .refine((types) => new Set(types).size === types.length, "Accommodation types must be distinct"),
  radiusMeters: z.number().min(1_000).max(50_000).default(10_000),
});

export async function search(req: Request, res: Response) {
  const input = requestSchema.parse(req.body);
  const result = await findAccommodation(input.location, input.types, undefined, input.radiusMeters);
  res.json({
    accommodationRadiusMeters: result.radiusMeters,
    accommodation: result.accommodation,
  });
}
