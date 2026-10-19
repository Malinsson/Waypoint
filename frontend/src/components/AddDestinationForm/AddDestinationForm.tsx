import styles from './AddDestinationForm.module.css'
import { useState, type FormEvent } from 'react'
import { geocodeAddress } from '../../api/trips.ts'
import type { GeocodeResult } from '../../types/api.ts'

type AddDestinationFormProps = {
  onAdd: (result: GeocodeResult) => void
  disabled: boolean
}

// Search for an address, then let the user confirm which match they meant
function AddDestinationForm({ onAdd, disabled }: AddDestinationFormProps) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

  return (
    <div className={styles.addDestination}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="destination-query">Add a destination</label>
        <div className={styles.addDestinationRow}>
          <input
            id="destination-query"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="City or address"
            disabled={disabled}
          />
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
