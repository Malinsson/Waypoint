import { Types } from "mongoose";
import { FavoriteList } from "../models/favorite-list.js";
import { Location } from "../models/location.js";
import { AppError } from "../utils/app-error.js";

const DEFAULT_LIST_NAME = "Favorites";

export type LocationInput = {
  name: string;
  description: string | undefined;
  latitude: number;
  longitude: number;
  wikidataId?: string | undefined;
};

function objectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(404, "NOT_FOUND", "Favorite list was not found");
  }
  return new Types.ObjectId(id);
}

async function getDefaultList(userId: string) {
  return FavoriteList.findOneAndUpdate(
    { user: objectId(userId), isDefault: true },
    { $setOnInsert: { name: DEFAULT_LIST_NAME, locations: [] } },
    { new: true, upsert: true },
  );
}

async function getOwnedList(userId: string, listId: string) {
  const list = await FavoriteList.findOne({
    _id: objectId(listId),
    user: objectId(userId),
  });
  if (!list) {
    throw new AppError(404, "NOT_FOUND", "Favorite list was not found");
  }
  return list;
}

async function createLocation(input: LocationInput) {
  const locationId = new Types.ObjectId();
  const locationData = {
    _id: locationId,
    name: input.name,
    description: input.description,
    latitude: input.latitude,
    longitude: input.longitude,
    ...(input.wikidataId === undefined ? {} : { wikidataId: input.wikidataId }),
  };
  const location = await Location.create(locationData);
  return { location, locationId };
}

export async function listFavorites(userId: string) {
  await getDefaultList(userId);
  return FavoriteList.find({ user: objectId(userId) })
    .sort({ isDefault: -1, name: 1 })
    .populate("locations")
    .lean();
}

export async function createFavorite(userId: string, input: LocationInput) {
  const list = await getDefaultList(userId);
  const { location, locationId } = await createLocation(input);
  list.locations.push(locationId);
  await list.save();
  return location;
}

export async function deleteFavorite(userId: string, locationId: string) {
  const locationObjectId = objectId(locationId);
  const defaultList = await getDefaultList(userId);
  const result = await FavoriteList.updateOne(
    { _id: defaultList._id, locations: locationObjectId },
    { $pull: { locations: locationObjectId } },
  );
  if (result.modifiedCount === 0) {
    throw new AppError(404, "NOT_FOUND", "Favorite was not found");
  }
  await Location.findByIdAndDelete(locationObjectId);
}

export async function createFavoriteList(userId: string, name: string) {
  return FavoriteList.create({
    user: objectId(userId),
    name,
    locations: [],
    isDefault: false,
  });
}

export async function renameFavoriteList(userId: string, listId: string, name: string) {
  const list = await getOwnedList(userId, listId);
  if (list.isDefault) {
    throw new AppError(400, "DEFAULT_LIST", "The default Favorites list cannot be renamed");
  }
  list.name = name;
  await list.save();
  return list;
}

export async function deleteFavoriteList(userId: string, listId: string) {
  const list = await getOwnedList(userId, listId);
  if (list.isDefault) {
    throw new AppError(400, "DEFAULT_LIST", "The default Favorites list cannot be deleted");
  }
  await FavoriteList.deleteOne({ _id: list._id });
}

export async function addLocationToList(
  userId: string,
  listId: string,
  input: LocationInput,
) {
  const list = await getOwnedList(userId, listId);
  const { location, locationId } = await createLocation(input);
  list.locations.push(locationId);
  await list.save();
  return location;
}

export async function removeLocationFromList(userId: string, listId: string, locationId: string) {
  const list = await getOwnedList(userId, listId);
  const result = await FavoriteList.updateOne(
    { _id: list._id, locations: objectId(locationId) },
    { $pull: { locations: objectId(locationId) } },
  );
  if (result.modifiedCount === 0) {
    throw new AppError(404, "NOT_FOUND", "Favorite was not found in this list");
  }
}
