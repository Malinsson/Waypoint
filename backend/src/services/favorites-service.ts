import { Types } from "mongoose";
import { FavoriteList } from "../models/favorite-list.js";
import { findOrCreateLocation, type LocationInput } from "./location-service.js";
import { AppError } from "../utils/app-error.js";
import { pageMeta, skipFor, type Pagination } from "../utils/pagination.js";

const DEFAULT_LIST_NAME = "Favorites";

export type { LocationInput };

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
    { returnDocument: "after", upsert: true },
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

// Adds the place to the list, or answers 409 if it is already there. The place
// itself is shared with trips and other users' favorites, so it is found or
// created, never changed or deleted from here.
async function addPlaceToList(list: Awaited<ReturnType<typeof getOwnedList>>, input: LocationInput) {
  const location = await findOrCreateLocation(input);
  if (list.locations.some((id) => id.equals(location._id))) {
    throw new AppError(409, "ALREADY_IN_LIST", `This place is already in "${list.name}"`);
  }
  list.locations.push(location._id);
  await list.save();
  return location;
}

// The default list is pinned first, the rest are newest first.
// Without pagination every list is returned: the "save to list" pickers need
// all of them.
export async function listFavorites(userId: string, pagination?: Pagination) {
  await getDefaultList(userId);
  const filter = { user: objectId(userId) };
  const query = FavoriteList.find(filter)
    .sort({ isDefault: -1, createdAt: -1, _id: -1 })
    .populate("locations");

  if (!pagination) {
    return { lists: await query.lean() };
  }

  const [lists, total] = await Promise.all([
    query.skip(skipFor(pagination)).limit(pagination.limit).lean(),
    FavoriteList.countDocuments(filter),
  ]);
  return { lists, ...pageMeta(pagination, total) };
}

export async function createFavorite(userId: string, input: LocationInput) {
  return addPlaceToList(await getDefaultList(userId), input);
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
  // The Location is not deleted: saved trips and other users may still use it
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
  await list.populate("locations");
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
  return addPlaceToList(await getOwnedList(userId, listId), input);
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

export async function getFavoriteList(userId: string, listId: string) {
  const list = await getOwnedList(userId, listId);
  await list.populate("locations");
  return list;
}
