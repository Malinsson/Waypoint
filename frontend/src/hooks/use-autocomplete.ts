import { useEffect, useRef, useState } from 'react'
import { fetchSuggestions, SuggestionsRateLimitedError } from '../api/autocomplete.ts'
import type { LonLat, Suggestion } from '../types/api.ts'

export type AutocompleteStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'error' | 'rateLimited'

export const MIN_TEXT_LENGTH = 3
export const DEBOUNCE_MS = 300
// After a 429 we stop asking for a while instead of retrying, so a burst of
// typing cannot keep hitting the limit
export const RATE_LIMIT_PAUSE_MS = 30_000

// Suggestions for the text in a search field. Waits until the user pauses
// typing, cancels requests that are no longer needed, and never lets an
// old response replace a newer one.
export function useAutocomplete(text: string, mapCenter?: LonLat) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<AutocompleteStatus>('idle')
  const [partial, setPartial] = useState(false)

  // Refs, not state: changing them should not start a new search. The map
  // center is only read when a request is sent, so panning the map does
  // not fire requests.
  const mapCenterRef = useRef(mapCenter)
  const pausedUntilRef = useRef(0)

  useEffect(() => {
    mapCenterRef.current = mapCenter
  }, [mapCenter])

  const query = text.trim()
  const tooShort = query.length < MIN_TEXT_LENGTH

  useEffect(() => {
    if (tooShort) return
    // The state already says 'rateLimited' from the 429 that started the
    // pause, so there is nothing to update, only nothing to send
    if (Date.now() < pausedUntilRef.current) return

    // One controller per run of this effect. The cleanup below aborts it as
    // soon as the text changes, so `aborted` also means "this response is
    // for an old text".
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setStatus('loading')
      try {
        const response = await fetchSuggestions(query, {
          mapCenter: mapCenterRef.current,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        setSuggestions(response.results)
        setPartial(response.partial)
        setStatus(response.results.length > 0 ? 'ok' : 'empty')
      } catch (err) {
        // A cancelled request is expected, not an error
        if (controller.signal.aborted) return
        setSuggestions([])
        setPartial(false)
        if (err instanceof SuggestionsRateLimitedError) {
          pausedUntilRef.current = Date.now() + RATE_LIMIT_PAUSE_MS
          setStatus('rateLimited')
        } else {
          setStatus('error')
        }
      }
    }, DEBOUNCE_MS)

    // React runs this before the next run (every new text) and on unmount:
    // a pending timer never fires, and a running request is cancelled
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, tooShort])

  // Too short text means "no search", whatever an earlier search left in
  // state. Deriving it here avoids an extra render from setting state.
  if (tooShort) return { suggestions: [], status: 'idle' as const, partial: false }
  return { suggestions, status, partial }
}
