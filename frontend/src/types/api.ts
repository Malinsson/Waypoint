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

// The error shape every backend endpoint returns (see CLAUDE.md)
export type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}
