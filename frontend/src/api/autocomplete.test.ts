import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client.ts'
import {
  fetchSuggestions,
  SuggestionsRateLimitedError,
  SuggestionsUnavailableError,
} from './autocomplete.ts'

const mockFetch = vi.fn<typeof fetch>()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// The URL our code asked fetch for, parsed so parameters are read decoded
function requestedUrl(): URL {
  return new URL(String(mockFetch.mock.calls[0]![0]))
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(jsonResponse(200, { results: [], partial: false }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSuggestions', () => {
  it('sends the text so the server decodes exactly what was typed', async () => {
    await fetchSuggestions('Lise & berg')

    const url = requestedUrl()
    expect(url.pathname).toBe('/api/geocode/autocomplete')
    expect(url.searchParams.get('text')).toBe('Lise & berg')
    // "&" did not split the text into a second parameter
    expect([...url.searchParams.keys()]).toEqual(['text'])
  })

  it('sends lat and lon from the map center, longitude in lon', async () => {
    await fetchSuggestions('Liseberg', { mapCenter: [11.99, 57.69] })

    const url = requestedUrl()
    expect(url.searchParams.get('lon')).toBe('11.99')
    expect(url.searchParams.get('lat')).toBe('57.69')
  })

  it('omits lat and lon when there is no map center', async () => {
    await fetchSuggestions('Liseberg')

    const url = requestedUrl()
    expect(url.searchParams.has('lat')).toBe(false)
    expect(url.searchParams.has('lon')).toBe(false)
  })

  it('maps 429 to SuggestionsRateLimitedError', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests' } }),
    )
    await expect(fetchSuggestions('Liseberg')).rejects.toBeInstanceOf(SuggestionsRateLimitedError)
  })

  it('maps 503 to SuggestionsUnavailableError and keeps the code', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(503, { error: { code: 'UPSTREAM_RATE_LIMITED', message: 'Busy' } }),
    )
    const error = await fetchSuggestions('Liseberg').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(SuggestionsUnavailableError)
    expect(error).not.toBeInstanceOf(SuggestionsRateLimitedError)
    expect((error as ApiError).code).toBe('UPSTREAM_RATE_LIMITED')
  })

  it('leaves other errors as a plain ApiError', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Bad text' } }),
    )
    const error = await fetchSuggestions('Liseberg').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).not.toBeInstanceOf(SuggestionsRateLimitedError)
    expect(error).not.toBeInstanceOf(SuggestionsUnavailableError)
    expect((error as ApiError).code).toBe('VALIDATION_ERROR')
  })

  it('passes the AbortSignal on to fetch', async () => {
    const controller = new AbortController()
    await fetchSuggestions('Liseberg', { signal: controller.signal })

    expect(mockFetch.mock.calls[0]![1]?.signal).toBe(controller.signal)
  })

  it('rethrows an aborted request as an abort, not as one of our errors', async () => {
    // Behaves like the real fetch: rejects with an AbortError when aborted
    mockFetch.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          )
        }),
    )
    const controller = new AbortController()
    const pending = fetchSuggestions('Liseberg', { signal: controller.signal }).catch(
      (err: unknown) => err,
    )
    controller.abort()
    const error = await pending

    expect((error as Error).name).toBe('AbortError')
    expect(error).not.toBeInstanceOf(ApiError)
  })
})
