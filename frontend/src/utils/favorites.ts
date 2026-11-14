import type { FavoriteList, FavoriteLocationInput } from '../types/api.ts'

// Same limit as the backend (location-service.ts), which cuts longer names
// before saving them
const MAX_NAME_LENGTH = 80

// The frontend sends no wikidataId, so the backend finds a place by name and
// coordinates. This uses the same key to tell if a list already holds it.
export function isInList(list: FavoriteList, place: FavoriteLocationInput): boolean {
  const name = place.name.slice(0, MAX_NAME_LENGTH)
  return list.locations.some(
    (saved) =>
      saved.name === name && saved.latitude === place.latitude && saved.longitude === place.longitude,
  )
}
