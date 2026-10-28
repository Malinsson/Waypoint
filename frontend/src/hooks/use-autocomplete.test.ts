import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchSuggestions,
  SuggestionsRateLimitedError,
  SuggestionsUnavailableError,
} from '../api/autocomplete.ts'
import type { Suggestion, SuggestionResponse } from '../types/api.ts'
import { DEBOUNCE_MS, RATE_LIMIT_PAUSE_MS, useAutocomplete } from './use-autocomplete.ts'

// Replace only fetchSuggestions; keep the real error classes so the hook's
// instanceof checks still work
vi.mock('../api/autocomplete.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/autocomplete.ts')>()),
  fetchSuggestions: vi.fn(),
}))
const mockFetch = vi.mocked(fetchSuggestions)

// A promise the test resolves by hand, to control when a response "arrives"
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function suggestion(label: string): Suggestion {
  return { id: `geo:${label}`, label, location: [11.99, 57.69],description: 'Amusement park in Gothenburg, Sweden', kind: 'poi', source: 'geoapify' }
}

function response(...labels: string[]): SuggestionResponse {
  return { results: labels.map(suggestion), partial: false }
}

function renderAutocomplete() {
  return renderHook(({ text }) => useAutocomplete(text), { initialProps: { text: '' } })
}

// Moves the fake clock forward and lets React apply the resulting updates
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutocomplete', () => {
  it('sends nothing for text shorter than 3 characters, even with spaces around it', async () => {
    const { result, rerender } = renderAutocomplete()

    rerender({ text: 'ab' })
    await advance(1000)
    rerender({ text: '   ab   ' })
    await advance(1000)

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('waits until typing pauses for 300 ms, then sends only the latest text', async () => {
    mockFetch.mockResolvedValue(response('Liseberg'))
    const { rerender } = renderAutocomplete()

    rerender({ text: 'Lis' })
    await advance(DEBOUNCE_MS - 100)
    rerender({ text: 'Lise' })
    await advance(DEBOUNCE_MS - 100)
    rerender({ text: 'Liseb' })
    await advance(DEBOUNCE_MS - 1)
    expect(mockFetch).not.toHaveBeenCalled()

    await advance(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toBe('Liseb')
  })

  it('aborts the running request when the text changes', async () => {
    mockFetch.mockReturnValue(deferred<SuggestionResponse>().promise)
    const { rerender } = renderAutocomplete()

    rerender({ text: 'Lise' })
    await advance(DEBOUNCE_MS)
    const firstSignal = mockFetch.mock.calls[0]![1]!.signal!
    expect(firstSignal.aborted).toBe(false)

    rerender({ text: 'Liseb' })
    expect(firstSignal.aborted).toBe(true)
  })

  it('never lets an old response replace a newer one', async () => {
    const first = deferred<SuggestionResponse>()
    const second = deferred<SuggestionResponse>()
    mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderAutocomplete()

    rerender({ text: 'Lise' })
    await advance(DEBOUNCE_MS)
    rerender({ text: 'Liseberg' })
    await advance(DEBOUNCE_MS)

    // The newer request answers first...
    await act(async () => second.resolve(response('Liseberg')))
    // ...and the older one arrives late, even though it was aborted
    await act(async () => first.resolve(response('Lisebergsgatan')))

    expect(result.current.suggestions.map((s) => s.label)).toEqual(['Liseberg'])
    expect(result.current.status).toBe('ok')
  })

  it('pauses for 30 seconds after a 429 instead of retrying', async () => {
    mockFetch.mockRejectedValueOnce(new SuggestionsRateLimitedError('Too many requests'))
    const { result, rerender } = renderAutocomplete()

    rerender({ text: 'Lise' })
    await advance(DEBOUNCE_MS)
    expect(result.current.status).toBe('rateLimited')
    expect(result.current.suggestions).toEqual([])

    // Typing during the pause sends nothing
    rerender({ text: 'Liseb' })
    await advance(DEBOUNCE_MS)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('rateLimited')

    // After the pause, the next keystroke searches again
    await advance(RATE_LIMIT_PAUSE_MS)
    mockFetch.mockResolvedValueOnce(response('Liseberg'))
    rerender({ text: 'Lisebe' })
    await advance(DEBOUNCE_MS)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ok')
  })

  it('maps responses and errors to the right status', async () => {
    const { result, rerender } = renderAutocomplete()

    mockFetch.mockResolvedValueOnce({ results: [suggestion('Liseberg')], partial: true })
    rerender({ text: 'Lise' })
    await advance(DEBOUNCE_MS)
    expect(result.current.status).toBe('ok')
    expect(result.current.partial).toBe(true)

    mockFetch.mockResolvedValueOnce(response())
    rerender({ text: 'Lisexyz' })
    await advance(DEBOUNCE_MS)
    expect(result.current.status).toBe('empty')

    mockFetch.mockRejectedValueOnce(
      new SuggestionsUnavailableError('UPSTREAM_UNAVAILABLE', 'Service down'),
    )
    rerender({ text: 'Lisexyzw' })
    await advance(DEBOUNCE_MS)
    expect(result.current.status).toBe('error')
    expect(result.current.suggestions).toEqual([])
  })
})
