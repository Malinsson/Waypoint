import type { Request, Response } from "express";
import { z } from "zod";
import { geocode } from "../services/geoapify-facade.js";
import { getSuggestions } from "../services/autocomplete-service.js";
import type { LonLat } from "../types/geo.js";

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

// Exported so the rules can be unit tested without starting a server
export const autocompleteQuerySchema = z
  .object({
    text: z
      .string("Text is required")
      .trim()
      // Collapse repeated spaces before checking the length, so "a    b"
      // counts as 3 characters and is sent upstream as "a b"
      .transform((text) => text.replace(/\s+/g, " "))
      .pipe(
        z
          .string()
          .min(3, "Text must be at least 3 characters")
          .max(200, "Text must be at most 200 characters"),
      ),
    // Query parameters always arrive as strings, so coerce them to numbers
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    lang: z
      .string()
      .regex(/^[a-z]{2}$/, "Lang must be a two-letter language code")
      .default("en"),
  })
  // A bias needs both halves of the coordinate
  .refine((query) => (query.lat === undefined) === (query.lon === undefined), {
    message: "Give both lat and lon, or neither",
    path: ["lat"],
  });

export async function autocompleteAddress(req: Request, res: Response) {
  const { text, lat, lon, lang } = autocompleteQuerySchema.parse(req.query);
  // Converted to our [lon, lat] order here, so nothing further in sees lat/lon
  const bias: LonLat | undefined = lat !== undefined && lon !== undefined ? [lon, lat] : undefined;
  const response = await getSuggestions({ text, lang, bias });
  res.json(response);
}
