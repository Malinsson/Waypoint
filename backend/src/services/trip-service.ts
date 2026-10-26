import { Types } from "mongoose";
import { Location } from "../models/location.js";
import { Trip } from "../models/trip.js";
import { AppError } from "../utils/app-error.js";

export type TripDestinationInput = {
  name: string;
  location: [number, number];
  description?: string | undefined;
  wikidataId?: string | undefined;
};

export type BreakpointInput = {
  longitude: number;
  latitude: number;
};

export type SaveTripInput = {
  name?: string | undefined;
  destinations: TripDestinationInput[];
  route: unknown;
  breakpoints: BreakpointInput[];
  drivingLimitHours: number;
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

async function upsertLocation(input: TripDestinationInput) {
  const [longitude, latitude] = input.location;
  const name = input.name.slice(0, 80);
  const description = input.description?.slice(0, 200);
  const filter = input.wikidataId
    ? { wikidataId: input.wikidataId }
    : { name, longitude, latitude };

  return Location.findOneAndUpdate(
    filter,
    {
      $set: {
        name,
        ...(description === undefined ? {} : { description }),
        longitude,
        latitude,
        ...(input.wikidataId ? { wikidataId: input.wikidataId } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function saveTrip(userId: string, input: SaveTripInput) {
  const ownerId = objectId(userId, "User id is not valid");
  const tripCount = await Trip.countDocuments({ userId: ownerId });
  if (tripCount >= 50) {
    throw new AppError(409, "TRIP_LIMIT_REACHED", "You can save at most 50 trips");
  }

  const locations = await Promise.all(input.destinations.map(upsertLocation));
  const name = input.name ?? `${input.destinations[0]?.name ?? "Origin"} to ${input.destinations.at(-1)?.name ?? "Destination"}`;

  return Trip.create({
    userId: ownerId,
    name,
    destinations: locations.map((location) => ({ locationId: location._id })),
    breakpoints: input.breakpoints,
    route: input.route,
    drivingLimitHours: input.drivingLimitHours,
    accommodationPreference: input.accommodationPreference,
  });
}

export async function listTrips(userId: string) {
  return Trip.find({ userId: objectId(userId, "User id is not valid") })
    .sort({ updatedAt: -1 })
    .populate("destinations.locationId")
    .lean();
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

export async function updateTrip(userId: string, id: string, name: string) {
  const trip = await getOwnedTrip(userId, id);
  trip.name = name;
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
