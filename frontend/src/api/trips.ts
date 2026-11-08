import type {
  Destination,
  GeocodeResponse,
  ListTripsResponse,
  PlanResponse,
  SaveTripResponse,
  TripDetailResponse,
} from '../types/api.ts'
import { apiPost, apiGet, apiPatch, apiDelete } from './client.ts'

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

export function listTrips(): Promise<ListTripsResponse> {
  return apiGet<ListTripsResponse>('/api/trips')
}

export function getTrip(id: string): Promise<TripDetailResponse> {
  return apiGet<TripDetailResponse>(`/api/trips/${id}`)
}

export function updateTrip(id: string, name: string): Promise<SaveTripResponse> {
  return apiPatch<SaveTripResponse>(`/api/trips/${id}`, { name })
}


export function completeTrip(id: string, completedAt: Date): Promise<SaveTripResponse> {
  return apiPost<SaveTripResponse>(`/api/trips/${id}/complete`, { completedAt })
}

export function deleteTrip(id: string): Promise<void> {
  return apiDelete<void>(`/api/trips/${id}`)
}
