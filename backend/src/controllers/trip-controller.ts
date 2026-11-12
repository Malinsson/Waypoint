import type { Request, Response } from "express";
import { z } from "zod";
import { planTrip } from "../services/plan-service.js";
import { requireUserId } from "../middleware/auth.js";
import {
  deleteTrip as deleteTripService,
  getTrip as getTripService,
  listTrips as listTripsService,
  saveTrip as saveTripService,
  renameTrip as renameTripService,
  updateTrip as updateTripService,
  completeTrip as completeTripService,
  rateTrip as rateTripService,
  clearTripRating as clearTripRatingService,
  type RatingTarget,
} from "../services/trip-service.js";
import { ACCOMMODATION_TYPES, MAX_DRIVING_HOURS } from "../types/geo.js";
import { AppError } from "../utils/app-error.js";
import { getMaxDrivingSeconds, updateMaxDrivingSeconds } from "../services/auth-service.js";

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

export function hasDuplicateDestinations(destinations: Array<{ location: [number, number] }>) {
  const seen = new Set<string>();

  for (const destination of destinations) {
    const [lon, lat] = destination.location;
    const key = `${lon.toFixed(6)},${lat.toFixed(6)}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }

  return false;
}

function hasOnlyRoundTripDuplicate(
  destinations: Array<{ location: [number, number] }>,
  roundTrip: boolean,
) {
  if (!roundTrip || destinations.length < 2) return false;
  const first = destinations[0];
  const last = destinations.at(-1);
  if (!first || !last) return false;

  const withoutClosingDestination = destinations.slice(0, -1);
  const firstAndLastMatch =
      first.location[0].toFixed(6) === last.location[0].toFixed(6) &&
      first.location[1].toFixed(6) === last.location[1].toFixed(6);

  return firstAndLastMatch && !hasDuplicateDestinations(withoutClosingDestination);
}

export const planSchema = z.object({
  options: z
      .object({
        optimizeOrder: z.boolean().default(false),
        roundTrip: z.boolean().default(false),
      maxDrivingSeconds: z.number().int().multipleOf(3_600, "Driving limit must use whole hours").min(3_600, "Driving limit must be at least 1 hour").max(MAX_DRIVING_HOURS * 3_600, `Driving limit must be at most ${MAX_DRIVING_HOURS} hours`).optional(),
      maxDrivingHours: z.number().min(1).max(MAX_DRIVING_HOURS).optional(),
      accommodationTypes: z.array(z.enum(ACCOMMODATION_TYPES)).min(1, "Choose at least one accommodation type").default(["hotel"]),
    })
    // prefault (not default) so a missing `options` still gets the inner
    // defaults above. Zod 4's .default({}) would return {} as-is.
    .prefault({}),
  destinations: z
    .array(destinationSchema, "Destinations are required")
    .min(2, "Add at least 2 destinations")
    .max(10, "You can add at most 10 destinations")
    .refine((d) => new Set(d.map((x) => x.id)).size === d.length, "Destination ids must be unique")
    .refine((d) => !hasDuplicateDestinations(d), "You already added that destination to this trip"),
});


export async function plan(req: Request, res: Response) {
  const input = planSchema.parse(req.body);
  const maxDrivingSeconds = input.options.maxDrivingSeconds
    ?? (input.options.maxDrivingHours === undefined
      ? req.user ? await getMaxDrivingSeconds(req.user.id) : 21_600
      : input.options.maxDrivingHours * 3_600);
  if (req.user) await updateMaxDrivingSeconds(req.user.id, maxDrivingSeconds);
  const result = await planTrip({
    ...input,
    options: { ...input.options, maxDrivingSeconds },
  });
  res.json(result);
}


export const tripInputSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required").max(100, "Trip name must be at most 100 characters").optional(),
  destinations: z
    .array(destinationSchema.omit({ id: true }), "Destinations are required")
    .min(2, "Add at least 2 destinations"),
  route: z.unknown().refine((route) => route !== undefined, "Route is required"),
  roundTrip: z.boolean().default(false),
  breakpoints: z.array(z.object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    accommodation: z.array(z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1),
      type: z.enum(ACCOMMODATION_TYPES),
      location: lonLatSchema,
      distanceMeters: z.number().min(0),
      address: z.string().trim().optional(),
    })).max(5).default([]),
    selectedAccommodationId: z.string().trim().min(1).optional(),
    skipped: z.boolean().default(false),
  })).default([]),
  maxDrivingHours: z.number().min(1).max(MAX_DRIVING_HOURS).default(6),
  accommodationPreference: z.object({
    types: z.array(z.enum(ACCOMMODATION_TYPES)).min(1).default(["hotel"]),
  }).prefault({}),
}).superRefine((input, ctx) => {
  // A saved round trip already contains the closing stop, so it may hold one
  // more entry than the 10 the user typed in.
  const maxDestinations = input.roundTrip ? 11 : 10;
  if (input.destinations.length > maxDestinations) {
    ctx.addIssue({ code: "custom", path: ["destinations"], message: "You can add at most 10 destinations" });
  }
  if (!hasDuplicateDestinations(input.destinations)) return;
  if (!hasOnlyRoundTripDuplicate(input.destinations, input.roundTrip)) {
    ctx.addIssue({ code: "custom", path: ["destinations"], message: "You already added that destination to this trip" });
  }
});

export async function saveTrip(req: Request, res: Response) {
  const input = tripInputSchema.parse(req.body);
  res.status(201).json({ trip: await saveTripService(requireUserId(req), input) });
}

export async function replaceTrip(req: Request, res: Response) {
  const input = tripInputSchema.parse(req.body);
  res.json({ trip: await updateTripService(requireUserId(req), routeParam(req), input) });
}

export async function listTrips(req: Request, res: Response) {
  res.json({ trips: await listTripsService(requireUserId(req)) });
}

export async function getTrip(req: Request, res: Response) {
  res.json({ trip: await getTripService(requireUserId(req), routeParam(req)) });
}

export async function updateTrip(req: Request, res: Response) {
  const { name } = z.object({
    name: z.string().trim().min(1, "Trip name is required").max(100, "Trip name must be at most 100 characters"),
  }).parse(req.body);
  res.json({ trip: await renameTripService(requireUserId(req), routeParam(req), name) });
}

// Which thing is rated. `index` is the position in the trip's destinations or
// breakpoints, and is meaningless for the trip as a whole.
const ratingTargetFields = {
  target: z.enum(["trip", "destination", "breakpoint"]),
  index: z.coerce.number().int().min(0).optional(),
};

function toRatingTarget(input: { target: "trip" | "destination" | "breakpoint"; index?: number | undefined }, ctx: z.RefinementCtx): RatingTarget {
  if (input.target === "trip") return { kind: "trip" };
  if (input.index === undefined) {
    ctx.addIssue({ code: "custom", path: ["index"], message: "Index is required for destinations and stops" });
    return z.NEVER;
  }
  return { kind: input.target, index: input.index };
}

export const ratingBodySchema = z.object({
  ...ratingTargetFields,
  stars: z.number("Stars must be a number").int("Stars must be a whole number").min(1, "Stars must be 1-5").max(5, "Stars must be 1-5"),
  comment: z.string().trim().max(1000, "Comment must be at most 1000 characters").optional(),
}).transform((input, ctx) => ({
  target: toRatingTarget(input, ctx),
  rating: { stars: input.stars, comment: input.comment },
}));

export const ratingQuerySchema = z.object(ratingTargetFields).transform((input, ctx) => toRatingTarget(input, ctx));

export async function rateTrip(req: Request, res: Response) {
  const { target, rating } = ratingBodySchema.parse(req.body);
  res.json({ trip: await rateTripService(requireUserId(req), routeParam(req), target, rating) });
}

export async function clearTripRating(req: Request, res: Response) {
  const target = ratingQuerySchema.parse(req.query);
  res.json({ trip: await clearTripRatingService(requireUserId(req), routeParam(req), target) });
}

export async function completeTrip(req: Request, res: Response) {
  res.json({ trip: await completeTripService(requireUserId(req), routeParam(req)) });
}

export async function deleteTrip(req: Request, res: Response) {
  await deleteTripService(requireUserId(req), routeParam(req));
  res.status(204).send();
}

function routeParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== "string" || !id) {
    throw new AppError(400, "INVALID_ID", "Trip id is not valid");
  }
  return id;
}
