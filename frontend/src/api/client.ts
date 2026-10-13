import type { ApiErrorBody } from '../types/api.ts'
import { clearToken, getToken } from './token-storage.ts'

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

// The auth context registers a function here so the client can tell it
// when the server rejected our token. The client itself knows nothing
// about React, so it cannot update the UI directly.
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!baseUrl) {
    throw new ApiError('CONFIG_ERROR', 'VITE_API_URL is not set')
  }

  const token = getToken()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch only rejects when no response arrived at all
    // (server down, no network, or a CORS rejection)
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Please try again later.')
  }

  // Only when we actually sent a token: then a 401 means our session is no
  // longer valid. A failed login sends no token, so it does not end up here.
  if (response.status === 401 && token) {
    clearToken()
    unauthorizedHandler?.()
  }

  if (!response.ok) {
    // The body may not be our JSON shape (e.g. a proxy's HTML error page),
    // so fall back to a generic message if parsing fails
    const errorBody = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(
      errorBody?.error?.code ?? 'HTTP_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
    )
  }

  // Trusts the backend to match T; nothing checks the shape at runtime
  return (await response.json()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body)
}
