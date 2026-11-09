import type {
  Destination,
  GeocodeResponse,
  ListTripsResponse,
  PlanResponse,
  RatingTarget,
  SaveTripResponse,
  TripDetailResponse,
} from '../types/api.ts'
import { apiPost, apiGet, apiPatch, apiPut, apiDelete } from './client.ts'

export function geocodeAddress(query: string): Promise<GeocodeResponse> {
  return apiPost<GeocodeResponse>('/api/geocode', { query })
}

export function optimizeRoute(destinations: Destination[], manuallyReordered = false): boolean {
  return destinations.length >= 4 && !manuallyReordered
}

export function planTrip(
  destinations: Destination[],
  manuallyReordered = false,
  roundTrip = false,
  accommodationTypes: string[] = ['hotel'],
  maxDrivingSeconds = 21_600,
): Promise<PlanResponse> {
  return apiPost<PlanResponse>('/api/trips/plan', {
    destinations: destinations.map((destination) => ({
      id: destination.id,
      // The backend accepts names up to 100 characters; long geocoder
      // labels are cut rather than rejected
      name: destination.name.slice(0, 100),
      location: destination.location,
      ...(destination.description ? { description: destination.description } : {}),
    })),
    options: {
      optimizeOrder: optimizeRoute(destinations, manuallyReordered),
      roundTrip,
      accommodationTypes,
      maxDrivingSeconds,
    },
  })
}

export function saveTrip(
  plan: PlanResponse,
  name?: string,
  accommodationTypes: string[] = ['hotel'],
  maxDrivingSeconds = 21_600,
): Promise<SaveTripResponse> {
  return apiPost<SaveTripResponse>('/api/trips', {
    ...(name ? { name } : {}),
    destinations: plan.destinations.map((destination) => ({
      name: destination.name,
      location: destination.location,
    })),
    route: plan.route,
    breakpoints: plan.breakPoints.map((breakPoint) => ({
      longitude: breakPoint.location[0],
      latitude: breakPoint.location[1],
      accommodation: breakPoint.accommodation ?? [],
      ...(breakPoint.selectedAccommodationId ? { selectedAccommodationId: breakPoint.selectedAccommodationId } : {}),
      ...(breakPoint.skipped ? { skipped: true } : {}),
    })),
    roundTrip: plan.roundTrip,
    maxDrivingHours: maxDrivingSeconds / 3_600,
    accommodationPreference: { types: accommodationTypes },
  })
}

export function updateSavedTrip(
  id: string,
  plan: PlanResponse,
  maxDrivingSeconds: number,
  accommodationTypes: string[],
  name?: string,
): Promise<SaveTripResponse> {
  return apiPut<SaveTripResponse>(`/api/trips/${id}`, {
    ...(name ? { name } : {}),
    destinations: plan.destinations.map((destination) => ({
      name: destination.name,
      location: destination.location,
      ...(destination.description ? { description: destination.description } : {}),
    })),
    route: plan.route,
    breakpoints: plan.breakPoints.map((breakPoint) => ({
      longitude: breakPoint.location[0],
      latitude: breakPoint.location[1],
      accommodation: breakPoint.accommodation ?? [],
      ...(breakPoint.selectedAccommodationId ? { selectedAccommodationId: breakPoint.selectedAccommodationId } : {}),
      ...(breakPoint.skipped ? { skipped: true } : {}),
    })),
    roundTrip: plan.roundTrip,
    maxDrivingHours: maxDrivingSeconds / 3_600,
    accommodationPreference: { types: accommodationTypes },
  })
}

export function listTrips(): Promise<ListTripsResponse> {
  return apiGet<ListTripsResponse>('/api/trips')
}

export function getTrip(id: string): Promise<TripDetailResponse> {
  return apiGet<TripDetailResponse>(`/api/trips/${id}`)
}

export function renameTrip(id: string, name: string): Promise<SaveTripResponse> {
  return apiPatch<SaveTripResponse>(`/api/trips/${id}`, { name })
}


export function completeTrip(id: string): Promise<SaveTripResponse> {
  return apiPost<SaveTripResponse>(`/api/trips/${id}/complete`, {})
}

// The index is only sent for destinations and stops; the trip as a whole has none
function ratingQuery(target: RatingTarget): string {
  const params = new URLSearchParams({ target: target.target })
  if ('index' in target) params.set('index', String(target.index))
  return params.toString()
}

// Only works on a completed trip: the backend answers 409 otherwise
export function rateTrip(
  id: string,
  target: RatingTarget,
  stars: number,
  comment?: string,
): Promise<SaveTripResponse> {
  return apiPut<SaveTripResponse>(`/api/trips/${id}/rating`, {
    ...target,
    stars,
    ...(comment ? { comment } : {}),
  })
}

export function clearTripRating(id: string, target: RatingTarget): Promise<SaveTripResponse> {
  return apiDelete<SaveTripResponse>(`/api/trips/${id}/rating?${ratingQuery(target)}`)
}

export function deleteTrip(id: string): Promise<void> {
  return apiDelete<void>(`/api/trips/${id}`)
}
