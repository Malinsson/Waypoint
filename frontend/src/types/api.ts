export type HealthResponse = {
  status: 'ok'
  database: 'connected' | 'disconnected'
}

// The error shape every backend endpoint returns (see CLAUDE.md)
export type ApiErrorBody = {
  error: {
    code: string
    message: string
  }
}
