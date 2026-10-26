import type { Request, Response } from "express";
import { z } from "zod";
import { planTrip } from "../services/plan-service.js";
import {
  deleteTrip as deleteTripService,
  getTrip as getTripService,
  listTrips as listTripsService,
  saveTrip as saveTripService,
  updateTrip as updateTripService,
} from "../services/trip-service.js";
import { ACCOMMODATION_TYPES, MAX_DRIVING_HOURS } from "../types/geo.js";
import { AppError } from "../utils/app-error.js";

// [longitude, latitude], the same order as GeoJSON
const lonLatSchema = z.tuple([
  z.number("Longitude must be a number").min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  z.number("Latitude must be a number").min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
]);

const destinationSchema = z
  .object({
    id: z.string("Destination id is required").trim().min(1, "Destination id is required").max(50, "Destination id is too long"),
    name: z.string().trim().min(1, "Name cannot be empty").max(100, "Name must be at most 100 characters"),
    location: lonLatSchema,
    description: z.string().trim().max(200, "Description must be at most 200 characters").optional(),
    wikidataId: z.string().trim().max(100, "Wikidata ID must be at most 100 characters").regex(/^Q\d+$/).optional(),
  })


const planSchema = z.object({
  destinations: z
      .array(destinationSchema, "Destinations are required")
      .min(2, "Add at least 2 destinations")
      .max(10, "You can add at most 10 destinations")
      // The frontend matches the response to its list by id, so ids must be unique
      .refine((d) => new Set(d.map((x) => x.id)).size === d.length, "Destination ids must be unique"),
  options: z
    .object({
      optimizeOrder: z.boolean().default(false),
      maxDrivingHours: z.number().min(1, "Driving limit must be at least 1 hour").max(MAX_DRIVING_HOURS, `Driving limit must be at most ${MAX_DRIVING_HOURS} hours`).default(6),
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




const tripInputSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(100, "Trip name must be at most 100 characters").optional(),
  destinations: z
    .array(destinationSchema.omit({ id: true }), "Destinations are required")
    .min(2, "Add at least 2 destinations")
    .max(10, "You can add at most 10 destinations"),
  route: z.unknown().refine((route) => route !== undefined, "Route is required"),
  breakpoints: z.array(z.object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
  })).default([]),
  maxDrivingHours: z.number().min(1).max(MAX_DRIVING_HOURS).default(6),
  accommodationPreference: z.object({
    types: z.array(z.enum(ACCOMMODATION_TYPES)).min(1).default(["hotel"]),
  }).prefault({}),
});

export async function saveTrip(req: Request, res: Response) {
  const input = tripInputSchema.parse(req.body);
  res.status(201).json({ trip: await saveTripService(userId(req), input) });
}

export async function listTrips(req: Request, res: Response) {
  res.json({ trips: await listTripsService(userId(req)) });
}

export async function getTrip(req: Request, res: Response) {
  res.json({ trip: await getTripService(userId(req), routeParam(req)) });
}

export async function updateTrip(req: Request, res: Response) {
  const { name } = z.object({
    name: z.string().trim().min(1, "Trip name is required").max(100, "Trip name must be at most 100 characters"),
  }).parse(req.body);
  res.json({ trip: await updateTripService(userId(req), routeParam(req), name) });
}

export async function deleteTrip(req: Request, res: Response) {
  await deleteTripService(userId(req), routeParam(req));
  res.status(204).send();
}

function userId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHORIZED", "You need to log in to do this");
  }
  return req.user.id;
}

function routeParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== "string" || !id) {
    throw new AppError(400, "INVALID_ID", "Trip id is not valid");
  }
  return id;
}
