export type HealthResponse = {
  status: 'ok'
  database: 'connected' | 'disconnected'
  geoservice: 'running' | 'unavailable'
}

export type User = {
  id: string
  email: string
  displayName: string
}

// Returned by both register and login
export type AuthResponse = {
  token: string
  user: User
}

export type MeResponse = {
  user: User
}

export type RegisterInput = {
  email: string
  password: string
  displayName: string
}

export type LoginInput = {
  email: string
  password: string
}

export type FavoriteLocation = {
  _id: string
  name: string
  description: string | undefined
  latitude: number
  longitude: number
  wikidataId?: string
}

export type FavoriteList = {
  _id: string
  name: string
  isDefault: boolean
  locations: FavoriteLocation[]
}

export type FavoriteListsResponse = {
  lists: FavoriteList[]
}

export type FavoriteLocationInput = Omit<FavoriteLocation, '_id'>

// Mirrors backend/src/types/geo.ts, keep in sync.
// GeoJSON order: longitude first, the same as the backend
export type LonLat = [lon: number, lat: number]

// Mirrors backend/src/types/geo.ts, keep in sync
export type PlaceKind = 'address' | 'city' | 'poi'

// Mirrors backend/src/types/geo.ts, keep in sync
export type GeocodeResult = {
  label: string
  location: LonLat
  description: string | undefined
  kind: PlaceKind
}

// Mirrors backend/src/types/geo.ts, keep in sync
export type Suggestion = GeocodeResult & {
  id: string
  description?: string
  source: 'geoapify' | 'wikidata' | 'both'
}

// Mirrors backend/src/services/autocomplete-service.ts, keep in sync
export type SuggestionResponse = {
  results: Suggestion[]
  // True when a source failed, so the list may be missing results
  partial: boolean
}

export type GeocodeResponse = {
  results: GeocodeResult[]
}

// A destination in the planner. `id` is created in the browser so the list
// can be matched to the plan response even if the order changes later.
export type Destination = {
  id: string
  name: string
  location: LonLat
  description: string | undefined
}

export type PlannedDestination = Destination & {
  order: number
  inputIndex: number
}

export type RouteLeg = {
  // Positions in the planned order: leg 0 goes from order 0 to order 1
  fromIndex: number
  toIndex: number
  distanceMeters: number
  durationSeconds: number
}

export type PlanWarning = {
  code: string
  message: string
}

export type PlanResponse = {
  destinations: PlannedDestination[]
  orderOptimized: boolean
  route: {
    distanceMeters: number
    durationSeconds: number
    geometry: { type: 'LineString'; coordinates: LonLat[] }
    legs: RouteLeg[]
  }
  // Not shown yet; break points are added in a later step
  breakPoints: unknown[]
  warnings: PlanWarning[]
}

export type SavedTrip = {
  _id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type SaveTripResponse = {
  trip: SavedTrip
}

export type ListTripsResponse = {
  trips: SavedTrip[]
}

export type TripStop = {
  name: string
  location: LonLat
}

// Mirrors backend/src/models/trip.ts, keep in sync
export type Trip = {
  _id: string
  name: string
  destinations: TripDestination[]
  breakpoints: TripBreakpoint[]
  route: PlanResponse['route']
  maxDrivingHours: number
  accommodationPreference: { types: string[] }
  totalRating?: TripRating
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type TripRating = {
  stars: number
  comment?: string
}

export type TripLocation = {
  _id: string
  name: string
  description?: string
  latitude: number
  longitude: number
  wikidataId?: string
}

export type TripDestination = {
  locationId: TripLocation
  description: string | undefined
  rating?: TripRating
}

export type TripBreakpoint = {
  longitude: number
  latitude: number
  locationId?: TripLocation
  rating?: TripRating
}

export type TripDetailResponse = {
  trip: Trip
}


// The error shape every backend endpoint returns (see CLAUDE.md)
export type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}
