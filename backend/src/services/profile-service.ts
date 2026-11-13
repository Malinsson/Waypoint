import { Types } from "mongoose";
import { FavoriteList } from "../models/favorite-list.js";
import { Trip } from "../models/trip.js";

export type ProfileStats = {
  favorites: number;
  tripsSaved: number;
  tripsCompleted: number;
  // Only completed trips count towards these two
  kilometersDriven: number;
  destinationsVisited: number;
};

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  // Every query filters on the user, so one user's numbers never include another's data
  const owner = new Types.ObjectId(userId);

  const [lists, tripsSaved, completedTrips] = await Promise.all([
    FavoriteList.find({ user: owner }).select("locations").lean(),
    Trip.countDocuments({ userId: owner }),
    // Projection keeps the large route geometry out of the result
    Trip.find({ userId: owner, completedAt: { $exists: true } })
      .select("destinations route.distanceMeters")
      .lean(),
  ]);

  // A location can be in several lists but is still one favorite
  const favoriteIds = new Set(lists.flatMap((list) => list.locations.map((id) => id.toString())));

  const meters = completedTrips.reduce((sum, trip) => {
    const distance = (trip.route as { distanceMeters?: number } | undefined)?.distanceMeters;
    return sum + (typeof distance === "number" ? distance : 0);
  }, 0);

  return {
    favorites: favoriteIds.size,
    tripsSaved,
    tripsCompleted: completedTrips.length,
    kilometersDriven: Math.round(meters / 1000),
    destinationsVisited: completedTrips.reduce((sum, trip) => sum + trip.destinations.length, 0),
  };
}
