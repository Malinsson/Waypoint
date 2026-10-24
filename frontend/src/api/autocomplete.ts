import type { LonLat, SuggestionResponse } from '../types/api.ts'
import { ApiError, apiGet } from './client.ts'

// Too many requests from this browser. The caller should wait, not retry.
export class SuggestionsRateLimitedError extends ApiError {
  constructor(message: string) {
    super('RATE_LIMITED', message, 429)
    this.name = 'SuggestionsRateLimitedError'
  }
}

// The suggestion sources are down or out of quota. The user can still
// press Enter to run the normal geocode search.
export class SuggestionsUnavailableError extends ApiError {
  constructor(code: string, message: string) {
    super(code, message, 503)
    this.name = 'SuggestionsUnavailableError'
  }
}

// The only function that calls the autocomplete endpoint
export async function fetchSuggestions(
  text: string,
  options: { mapCenter?: LonLat; signal?: AbortSignal } = {},
): Promise<SuggestionResponse> {
  // URLSearchParams encodes the values, so "&", "å" or "'" in the text
  // cannot break the query string
  const params = new URLSearchParams({ text })
  if (options.mapCenter) {
    const [lon, lat] = options.mapCenter
    params.set('lat', String(lat))
    params.set('lon', String(lon))
  }

  try {
    return await apiGet<SuggestionResponse>(`/api/geocode/autocomplete?${params}`, {
      signal: options.signal,
    })
  } catch (err) {
    // Swap the generic error for a specific one, so the caller can react
    // to each case with instanceof. Aborts and other errors pass unchanged.
    if (err instanceof ApiError && err.status === 429) {
      throw new SuggestionsRateLimitedError(err.message)
    }
    if (err instanceof ApiError && err.status === 503) {
      throw new SuggestionsUnavailableError(err.code, err.message)
    }
    throw err
  }
}
