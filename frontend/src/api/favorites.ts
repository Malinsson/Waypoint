import type {
  FavoriteList,
  FavoriteListsPageResponse,
  FavoriteListsResponse,
  FavoriteLocation,
  FavoriteLocationInput,
} from '../types/api.ts'
import { apiDelete, apiGet, apiPatch, apiPost } from './client.ts'

// Every list, for the "save to list" pickers
export function fetchFavoriteLists(): Promise<FavoriteListsResponse> {
  return apiGet<FavoriteListsResponse>('/api/favorites')
}

export const FAVORITES_PAGE_SIZE = 10

export function fetchFavoriteListsPage(page = 1): Promise<FavoriteListsPageResponse> {
  return apiGet<FavoriteListsPageResponse>(
    `/api/favorites?page=${page}&limit=${FAVORITES_PAGE_SIZE}`,
  )
}

export function fetchFavoriteList(listId: string): Promise<{ list: FavoriteList }> {
  return apiGet<{ list: FavoriteList }>(`/api/favorites/lists/${listId}`)
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

export function removeFavoriteFromList(listId: string, locationId: string): Promise<void> {
  return apiDelete(`/api/favorites/lists/${listId}/locations/${locationId}`)
}

export function getFavoriteList(listId: string): Promise<{ list: FavoriteList }> {
  return apiGet<{ list: FavoriteList }>(`/api/favorites/lists/${listId}`)
}
