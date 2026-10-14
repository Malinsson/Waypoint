export type HealthResponse = {
  status: 'ok'
  database: 'connected' | 'disconnected'
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

// GeoJSON order: longitude first, the same as the backend
export type LonLat = [lon: number, lat: number]

export type GeocodeResult = {
  label: string
  location: LonLat
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

// The error shape every backend endpoint returns (see CLAUDE.md)
export type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}
