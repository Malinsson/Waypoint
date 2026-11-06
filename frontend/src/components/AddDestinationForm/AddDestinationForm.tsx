import styles from './AddDestinationForm.module.css'
import { useId, useState, type FormEvent, type KeyboardEvent, useEffect } from 'react'
import { useAutocomplete } from '../../hooks/use-autocomplete.ts'
import type { GeocodeResult, Suggestion } from '../../types/api.ts'
import { optionId } from '../../utils/combobox.ts'
import SuggestionDropdown from '../SuggestionDropdown/SuggestionDropdown.tsx'
import { useAuth } from '../../context/auth-context.ts'
import { Search } from 'lucide-react'

type AddDestinationFormProps = {
  onAdd: (result: GeocodeResult) => void
  disabled: boolean
}

// Search for an address. While typing, suggestions appear in a dropdown.
function AddDestinationForm({ onAdd, disabled }: AddDestinationFormProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  // The dropdown: whether the user is working with it, and which row the
  // arrow keys point at (-1 for none)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const { suggestions, status, partial } = useAutocomplete(query)
  // useId gives an id that is unique on the page and the same on every render
  const listboxId = useId()
  const expanded = open && suggestions.length > 0

  // Scroll the highlighted row into view when it changes. The dropdown is
  // absolutely positioned, so it does not scroll with the page.
  useEffect(() => {
    if (highlightedIndex < 0 || !expanded) return
    const element = document.getElementById(optionId(listboxId, highlightedIndex))
    element?.scrollIntoView({ block: 'nearest' })
  }, [expanded, highlightedIndex, listboxId])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    setHighlightedIndex(0)
    // Same minimum as the backend, so we do not send a request that must fail
    if (trimmed.length < 2) {
      setMessage('Type at least 2 characters')
      return
    }
  }

  function choose(result: GeocodeResult) {
    onAdd(result)
    setQuery('')
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
            <Search className={styles.searchIcon} />
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
              onClick={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              placeholder="City or address"
              disabled={disabled}
              className="inputField"
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

        </div>
      </form>

      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}


    </div>
  )
}

export default AddDestinationForm
