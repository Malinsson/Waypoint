import { Types } from "mongoose";
import { findOrCreateLocation } from "./location-service.js";
import { Trip } from "../models/trip.js";
import { AppError } from "../utils/app-error.js";
import { pageMeta, skipFor, type Pagination } from "../utils/pagination.js";

export type TripDestinationInput = {
  name: string;
  location: [number, number];
  description?: string | undefined;
  wikidataId?: string | undefined;
};

export type BreakpointInput = {
  longitude: number;
  latitude: number;
  accommodation?: {
    id: string;
    name: string;
    type: string;
    location: [number, number];
    distanceMeters: number;
    address?: string | undefined;
  }[];
  selectedAccommodationId?: string | undefined;
  skipped?: boolean | undefined;
};

export type SaveTripInput = {
  name?: string | undefined;
  destinations: TripDestinationInput[];
  route: unknown;
  roundTrip: boolean;
  breakpoints: BreakpointInput[];
  maxDrivingHours: number;
  accommodationPreference: { types: string[] };
};


function objectId(id: string, message: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, "INVALID_ID", message);
  }
  return new Types.ObjectId(id);
}

function tripId(id: string): Types.ObjectId {
  return objectId(id, "Trip id is not valid");
}

function notFound(): never {
  throw new AppError(404, "TRIP_NOT_FOUND", "Trip was not found");
}

async function getOwnedTrip(userId: string, id: string) {
  const trip = await Trip.findOne({ _id: tripId(id), userId: objectId(userId, "User id is not valid") });
  if (!trip) notFound();
  return trip;
}

function findOrCreateDestinationLocation(input: TripDestinationInput) {
  const [longitude, latitude] = input.location;
  return findOrCreateLocation({
    name: input.name,
    description: input.description,
    longitude,
    latitude,
    wikidataId: input.wikidataId,
  });
}

// Checked before any Location is created, so a bad request leaves nothing behind
function assertSelectionsBelongToStops(breakpoints: BreakpointInput[]) {
  for (const breakpoint of breakpoints) {
    if (
      breakpoint.selectedAccommodationId
      && !breakpoint.accommodation?.some(({ id }) => id === breakpoint.selectedAccommodationId)
    ) {
      throw new AppError(400, "INVALID_BREAKPOINT_SELECTION", "The selected accommodation is not part of this stop");
    }
  }
}

type StoredRating = { stars: number; comment?: string | undefined } | undefined;

// Copied field by field so the result is plain data, not a Mongoose subdocument
function copyRating(rating: StoredRating): { rating?: { stars: number; comment?: string } } {
  if (!rating) return {};
  return { rating: { stars: rating.stars, ...(rating.comment ? { comment: rating.comment } : {}) } };
}

function toBreakpointDocs(breakpoints: BreakpointInput[], ratings: StoredRating[] = []) {
  return breakpoints.map((breakpoint, index) => ({
    longitude: breakpoint.longitude,
    latitude: breakpoint.latitude,
    ...copyRating(ratings[index]),
    ...(breakpoint.selectedAccommodationId ? { selectedAccommodationId: breakpoint.selectedAccommodationId } : {}),
    ...(breakpoint.skipped ? { skipped: true } : {}),
    ...(breakpoint.accommodation
      ? {
          accommodation: breakpoint.accommodation.map((place) => ({
            id: place.id,
            name: place.name,
            type: place.type,
            longitude: place.location[0],
            latitude: place.location[1],
            distanceMeters: place.distanceMeters,
            ...(place.address === undefined ? {} : { address: place.address }),
          })),
        }
      : {}),
  }));
}

// Same stops in the same order, to the precision we store (about 10 cm)
function sameBreakpointPositions(
  oldStops: { longitude: number; latitude: number }[],
  newStops: { longitude: number; latitude: number }[],
): boolean {
  const key = (stop: { longitude: number; latitude: number }) => `${stop.longitude.toFixed(6)},${stop.latitude.toFixed(6)}`;
  return oldStops.length === newStops.length && oldStops.every((stop, index) => key(stop) === key(newStops[index]!));
}

export async function saveTrip(userId: string, input: SaveTripInput) {
  const ownerId = objectId(userId, "User id is not valid");
  const tripCount = await Trip.countDocuments({ userId: ownerId });
  if (tripCount >= 50) {
    throw new AppError(409, "TRIP_LIMIT_REACHED", "You can save at most 50 trips");
  }

  assertSelectionsBelongToStops(input.breakpoints);
  const locations = await Promise.all(input.destinations.map(findOrCreateDestinationLocation));
  const name = input.name ?? `${input.destinations[0]?.name ?? "Origin"} to ${input.destinations.at(-1)?.name ?? "Destination"}`;

  return Trip.create({
    userId: ownerId,
    name,
    destinations: locations.map((location) => ({ locationId: location._id })),
    breakpoints: toBreakpointDocs(input.breakpoints),
    route: input.route,
    roundTrip: input.roundTrip,
    maxDrivingHours: input.maxDrivingHours,
    accommodationPreference: input.accommodationPreference,
  });
}

export async function listTrips(userId: string, pagination: Pagination) {
  const filter = { userId: objectId(userId, "User id is not valid") };
  // _id breaks ties so two trips with the same updatedAt never swap pages.
  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skipFor(pagination))
      .limit(pagination.limit)
      .populate("destinations.locationId")
      .lean(),
    Trip.countDocuments(filter),
  ]);
  return { trips, ...pageMeta(pagination, total) };
}

export async function getTrip(userId: string, id: string) {
  const trip = await Trip.findOne({
    _id: tripId(id),
    userId: objectId(userId, "User id is not valid"),
  })
    .populate("destinations.locationId")
    .populate("breakpoints.locationId")
    .lean();

  return trip ?? notFound();
}

export async function renameTrip(userId: string, id: string, name: string) {
  const trip = await getOwnedTrip(userId, id);
  trip.name = name;
  await trip.save();
  return trip;
}

export async function updateTrip(userId: string, id: string, input: SaveTripInput) {
  const trip = await getOwnedTrip(userId, id);
  assertSelectionsBelongToStops(input.breakpoints);
  const locations = await Promise.all(input.destinations.map(findOrCreateDestinationLocation));

  // Ratings live inside destinations[] and breakpoints[], so replacing the
  // arrays would erase them. A destination keeps its rating if the same place
  // is still on the trip. The nth visit of a place matches the nth visit
  // before (a round trip starts and ends at the same place).
  const visitKey = (locationId: { toString(): string }, seen: Map<string, number>) => {
    const visit = seen.get(locationId.toString()) ?? 0;
    seen.set(locationId.toString(), visit + 1);
    return `${locationId.toString()}#${visit}`;
  };
  const oldSeen = new Map<string, number>();
  const oldRatings = new Map<string, StoredRating>(
    trip.destinations.map((destination) => [visitKey(destination.locationId, oldSeen), destination.rating]),
  );
  const newSeen = new Map<string, number>();

  // Stop ratings are tied to a position in the list, so they only survive
  // when every stop is exactly where it was. If the plan changed, they would
  // describe different places, so they are dropped.
  const stopsUnchanged = sameBreakpointPositions(trip.breakpoints, input.breakpoints);

  trip.name = input.name ?? trip.name;
  trip.destinations = locations.map((location) => ({
    locationId: location._id,
    ...copyRating(oldRatings.get(visitKey(location._id, newSeen))),
  }));
  trip.route = input.route;
  trip.roundTrip = input.roundTrip;
  trip.breakpoints = toBreakpointDocs(
    input.breakpoints,
    stopsUnchanged ? trip.breakpoints.map((breakpoint) => breakpoint.rating) : [],
  );
  trip.maxDrivingHours = input.maxDrivingHours;
  trip.accommodationPreference = input.accommodationPreference;
  await trip.save();
  return trip;
}

export async function deleteTrip(userId: string, id: string): Promise<void> {
  const result = await Trip.deleteOne({
    _id: tripId(id),
    userId: objectId(userId, "User id is not valid"),
  });
  if (result.deletedCount === 0) notFound();
}

// What is being rated. Ratings are embedded in the trip, so a target is a
// position in one of its arrays (or the trip as a whole).
export type RatingTarget =
  | { kind: "trip" }
  | { kind: "destination"; index: number }
  | { kind: "breakpoint"; index: number };

export type RatingInput = { stars: number; comment?: string | undefined };

// Returns the document path of the rating, so set() can write or clear it.
// Throws if the position does not exist on this trip.
function ratingPath(
  trip: { destinations: unknown[]; breakpoints: unknown[] },
  target: RatingTarget,
): string {
  if (target.kind === "trip") return "totalRating";

  const list = target.kind === "destination" ? trip.destinations : trip.breakpoints;
  if (target.index >= list.length) {
    throw new AppError(404, "PLACE_NOT_FOUND", "That place is not part of this trip");
  }
  return `${target.kind === "destination" ? "destinations" : "breakpoints"}.${target.index}.rating`;
}

// Only a trip that has been driven can be rated, and the owner filter in
// getOwnedTrip means nobody can rate another user's trip.
async function getRatableTrip(userId: string, id: string) {
  const trip = await getOwnedTrip(userId, id);
  if (!trip.completedAt) {
    throw new AppError(409, "TRIP_NOT_COMPLETED", "Mark the trip as completed before rating it");
  }
  return trip;
}

export async function rateTrip(userId: string, id: string, target: RatingTarget, rating: RatingInput) {
  const trip = await getRatableTrip(userId, id);
  trip.set(ratingPath(trip, target), {
    stars: rating.stars,
    ...(rating.comment ? { comment: rating.comment } : {}),
  });
  await trip.save();
  return trip;
}

export async function clearTripRating(userId: string, id: string, target: RatingTarget) {
  const trip = await getRatableTrip(userId, id);
  trip.set(ratingPath(trip, target), undefined);
  await trip.save();
  return trip;
}

export async function completeTrip(userId: string, id: string) {
  const trip = await getOwnedTrip(userId, id);

  if (trip.completedAt) {
    throw new AppError(409, "TRIP_ALREADY_COMPLETED", "This trip has already been marked as completed");
  }

  trip.completedAt = new Date();
  await trip.save();
  return trip;
}