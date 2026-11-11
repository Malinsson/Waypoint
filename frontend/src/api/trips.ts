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

// Optimization needs a middle stop to reorder. The upstream optimizer gets
// very slow (and times out) when stops are far apart, so it is only requested
// when every pair of stops is within this straight-line distance.
export const MIN_DESTINATIONS_TO_OPTIMIZE = 4
export const MAX_OPTIMIZE_SPREAD_KM = 500

const EARTH_RADIUS_KM = 6_371

// Haversine formula: straight-line distance over the earth's surface.
// Locations are GeoJSON order [longitude, latitude].
function distanceKm(
  [lonA, latA]: [number, number],
  [lonB, latB]: [number, number],
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLat = toRadians(latB - latA)
  const deltaLon = toRadians(lonB - lonA)
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(deltaLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

// The largest distance between any two stops. A round trip adds no new
// location (the return leg goes back to the first stop), so it is not counted.
export function maxSpreadKm(destinations: Destination[]): number {
  let max = 0
  for (let i = 0; i < destinations.length; i++) {
    for (let j = i + 1; j < destinations.length; j++) {
      max = Math.max(max, distanceKm(destinations[i].location, destinations[j].location))
    }
  }
  return max
}

export function optimizeRoute(destinations: Destination[], manuallyReordered = false): boolean {
  return (
    destinations.length >= MIN_DESTINATIONS_TO_OPTIMIZE &&
    !manuallyReordered &&
    maxSpreadKm(destinations) <= MAX_OPTIMIZE_SPREAD_KM
  )
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
