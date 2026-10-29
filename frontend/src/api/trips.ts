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

export function planTrip(destinations: Destination[]): Promise<PlanResponse> {
  return apiPost<PlanResponse>('/api/trips/plan', {
    destinations: destinations.map((destination) => ({
      id: destination.id,
      // The backend accepts names up to 100 characters; long geocoder
      // labels are cut rather than rejected
      name: destination.name.slice(0, 100),
      location: destination.location,
    })),
    // The "Optimize order" toggle is a later (Should) feature. Until then
    // the trip is driven in exactly the order of the list.
    options: { optimizeOrder: false },
  })
}

export function saveTrip(plan: PlanResponse, name?: string): Promise<SaveTripResponse> {
  return apiPost<SaveTripResponse>('/api/trips', {
    ...(name ? { name } : {}),
    destinations: plan.destinations.map((destination) => ({
      name: destination.name,
      location: destination.location,
    })),
    route: plan.route,
    // Breakpoint calculation is not part of the current planning response yet.
    breakpoints: plan.breakPoints,
    maxDrivingHours: 6,
    accommodationPreference: { types: ['hotel'] },
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

export function deleteTrip(id: string): Promise<void> {
  return apiDelete<void>(`/api/trips/${id}`)
}
