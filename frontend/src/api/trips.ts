import type { Destination, GeocodeResponse, PlanResponse } from '../types/api.ts'
import { apiPost } from './client.ts'

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
