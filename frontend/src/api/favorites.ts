import type {
  FavoriteList,
  FavoriteListsResponse,
  FavoriteLocation,
  FavoriteLocationInput,
} from '../types/api.ts'
import { apiDelete, apiGet, apiPatch, apiPost } from './client.ts'

export function fetchFavoriteLists(): Promise<FavoriteListsResponse> {
  return apiGet<FavoriteListsResponse>('/api/favorites')
}

export function createFavoriteList(name: string): Promise<{ list: FavoriteList }> {
  return apiPost<{ list: FavoriteList }>('/api/favorites/lists', { name })
}

export function renameFavoriteList(
  listId: string,
  name: string,
): Promise<{ list: FavoriteList }> {
  return apiPatch<{ list: FavoriteList }>(`/api/favorites/lists/${listId}`, { name })
}

export function deleteFavoriteList(listId: string): Promise<void> {
  return apiDelete(`/api/favorites/lists/${listId}`)
}

export function addFavorite(
  location: FavoriteLocationInput,
): Promise<{ location: FavoriteLocation }> {
  return apiPost<{ location: FavoriteLocation }>('/api/favorites', location)
}

export function addFavoriteToList(
  listId: string,
  location: FavoriteLocationInput,
): Promise<{ location: FavoriteLocation }> {
  return apiPost<{ location: FavoriteLocation }>(
    `/api/favorites/lists/${listId}/locations`,
    location,
  )
}

export function removeFavorite(locationId: string): Promise<void> {
  return apiDelete(`/api/favorites/${locationId}`)
}
