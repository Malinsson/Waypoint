import type { Request, Response } from "express";
import { z } from "zod";
import { planTrip } from "../services/plan-service.js";
import { ACCOMMODATION_TYPES } from "../types/geo.js";

// [longitude, latitude], the same order as GeoJSON
const lonLatSchema = z.tuple([
  z.number("Longitude must be a number").min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  z.number("Latitude must be a number").min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
]);

const destinationSchema = z
  .object({
    id: z.string("Destination id is required").trim().min(1, "Destination id is required").max(50, "Destination id is too long"),
    name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name must be at most 100 characters").optional(),
    location: lonLatSchema.optional(),
    address: z.string().trim().min(1, "Address cannot be empty").max(200, "Address must be at most 200 characters").optional(),
  })
  .refine((destination) => destination.location || destination.address, "Each destination needs a location or an address");

const planSchema = z.object({
  destinations: z
    .array(destinationSchema, "Destinations are required")
    .min(2, "Add at least 2 destinations")
    .max(10, "You can add at most 10 destinations")
    // The frontend matches the response to its list by id, so ids must be unique
    .refine((destinations) => new Set(destinations.map((d) => d.id)).size === destinations.length, "Destination ids must be unique"),
  options: z
    .object({
      optimizeOrder: z.boolean().default(false),
      maxDrivingHours: z.number().min(1, "Driving limit must be at least 1 hour").max(16, "Driving limit must be at most 16 hours").default(6),
      accommodationTypes: z.array(z.enum(ACCOMMODATION_TYPES)).min(1, "Choose at least one accommodation type").default(["hotel"]),
    })
    // prefault (not default) so a missing `options` still gets the inner
    // defaults above. Zod 4's .default({}) would return {} as-is.
    .prefault({}),
});

export async function plan(req: Request, res: Response) {
  const input = planSchema.parse(req.body);
  const result = await planTrip(input);
  res.json(result);
}
