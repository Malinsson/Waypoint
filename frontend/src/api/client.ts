import type { ApiErrorBody } from '../types/api.ts'

// Remove a trailing slash so `${baseUrl}${path}` never produces "//"
const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!baseUrl) {
    throw new ApiError('CONFIG_ERROR', 'VITE_API_URL is not set')
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`)
  } catch {
    // fetch only rejects when no response arrived at all
    // (server down, no network, or a CORS rejection)
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Please try again later.')
  }

  if (!response.ok) {
    // The body may not be our JSON shape (e.g. a proxy's HTML error page),
    // so fall back to a generic message if parsing fails
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Request failed with status ${response.status}`,
    )
  }

  // Trusts the backend to match T; nothing checks the shape at runtime
  return (await response.json()) as T
}
