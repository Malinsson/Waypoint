import styles from './AddDestinationForm.module.css'
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { geocodeAddress } from '../../api/trips.ts'
import { useAutocomplete } from '../../hooks/use-autocomplete.ts'
import type { GeocodeResult, Suggestion } from '../../types/api.ts'
import { optionId } from '../../utils/combobox.ts'
import SuggestionDropdown from '../SuggestionDropdown/SuggestionDropdown.tsx'
import { useAuth } from '../../context/auth-context.ts'

type AddDestinationFormProps = {
  onAdd: (result: GeocodeResult) => void
  disabled: boolean
}

// Search for an address. While typing, suggestions appear in a dropdown;
// pressing Enter without choosing one falls back to the full search, where
// the user confirms which match they meant.
function AddDestinationForm({ onAdd, disabled }: AddDestinationFormProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // The dropdown: whether the user is working with it, and which row the
  // arrow keys point at (-1 for none)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const { suggestions, status, partial } = useAutocomplete(query)
  // useId gives an id that is unique on the page and the same on every render
  const listboxId = useId()
  const expanded = open && suggestions.length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    const trimmed = query.trim()
    setCandidates([])
    setMessage(null)
    // Same minimum as the backend, so we do not send a request that must fail
    if (trimmed.length < 2) {
      setMessage('Type at least 2 characters')
      return
    }

    setSearching(true)
    try {
      const { results } = await geocodeAddress(trimmed)
      if (results.length === 0) {
        setMessage('We could not find that address')
      } else {
        setCandidates(results)
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  function choose(result: GeocodeResult) {
    onAdd(result)
    setQuery('')
    setCandidates([])
  }

  // A suggestion already has coordinates, so it is added without a second
  // geocoding request
  function chooseSuggestion(suggestion: Suggestion) {
    choose(suggestion)
    setMessage(null)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function handleChange(text: string) {
    setQuery(text)
    setOpen(true)
    // New text means a new list is coming, so no old row stays highlighted
    setHighlightedIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      // Stop the cursor from jumping to the start or end of the text
      event.preventDefault()
      setOpen(true)
      const down = event.key === 'ArrowDown'
      const last = suggestions.length - 1
      // Stop at the first and last row instead of wrapping around
      setHighlightedIndex((index) => (down ? Math.min(index + 1, last) : Math.max(index - 1, 0)))
    } else if (event.key === 'Enter' && expanded && highlightedIndex >= 0) {
      // Choose the highlighted row instead of submitting the form.
      // Without a highlighted row, Enter submits and runs the full search.
      event.preventDefault()
      const suggestion = suggestions[highlightedIndex]
      if (suggestion) chooseSuggestion(suggestion)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlightedIndex(-1)
    }
  }

  return (
    <div className={styles.addDestination}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="destination-query">Add a destination</label>
        <div className={styles.addDestinationRow}>
          <div className={styles.combobox}>
            <input
              id="destination-query"
              type="text"
              role="combobox"
              // Browser autofill would cover our own dropdown
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={expanded}
              aria-activedescendant={
                expanded && highlightedIndex >= 0 ? optionId(listboxId, highlightedIndex) : undefined
              }
              value={query}
              onChange={(event) => handleChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setOpen(false)}
              placeholder="City or address"
              disabled={disabled}
            />
            {status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
            <SuggestionDropdown
              listboxId={listboxId}
              suggestions={suggestions}
              status={status}
              partial={partial}
              expanded={expanded}
              open={open}
              highlightedIndex={highlightedIndex}
              onSelect={chooseSuggestion}
              onHighlight={setHighlightedIndex}
              isLoggedIn={user !== null}
            />
          </div>
          <button type="submit" disabled={disabled || searching}>
            {searching ? 'Searching…' : 'Add'}
          </button>
        </div>
      </form>

      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}

      {candidates.length > 0 && (
        <>
          <p>Which one did you mean?</p>
          <ul className="candidates">
            {candidates.map((candidate) => (
              // label + location is unique enough; the geocoder has no ids
              <li key={`${candidate.label}-${candidate.location.join(',')}`}>
                <button type="button" onClick={() => choose(candidate)}>
                  {candidate.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default AddDestinationForm
