import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth } from '../../api/health.ts'
import { planTrip, saveTrip } from '../../api/trips.ts'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import DestinationList from '../../components/DestinationList/DestinationList.tsx'
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import TripSummary from '../../components/TripSummary/TripSummary.tsx'
import { useAuth } from '../../context/auth-context.ts'
import type { Destination, GeocodeResult, PlanResponse, Breakpoint } from '../../types/api.ts'
import styles from './PlanPage.module.css'
import { Button } from '../../components/atoms/Button.tsx'

const MIN_DESTINATIONS = 2
const MAX_DESTINATIONS = 10
// Roughly the middle of Sweden, so the whole country fits at zoom 5
const SWEDEN_CENTER: [number, number] = [16.5, 62.5]

function PlanPage() {
  const { user } = useAuth()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [duplicateDestinationError, setDuplicateDestinationError] = useState<string | null>(null)
  const warmupPromise = useRef<Promise<unknown> | null>(null)
  // Changing the key of AddDestinationForm remounts it, which is a simple
  // way to clear its search field and matches on "Start over"
  const [resetCount, setResetCount] = useState(0)

  // Render's free services sleep when idle. A quiet request when the page
  // opens wakes the backend, so it is ready when the user starts typing.
  // The answer and any error are ignored on purpose.
  useEffect(() => {
    warmupPromise.current = getHealth().catch(() => undefined)
  }, [])

  // Any change to the list makes the old route wrong, so it is cleared and
  // the user plans again
  function updateDestinations(next: Destination[]) {
    setDestinations(next)
    setPlan(null)
    setPlanError(null)
    setSaveError(null)
    setSavedMessage(null)
    setDuplicateDestinationError(null)
  }

  function isDuplicateDestination(existing: Destination, candidate: GeocodeResult) {
    const [existingLon, existingLat] = existing.location
    const [candidateLon, candidateLat] = candidate.location
    const key = (lon: number, lat: number) => `${lon.toFixed(6)},${lat.toFixed(6)}`

    return key(existingLon, existingLat) === key(candidateLon, candidateLat)
  }

  function addDestination(result: GeocodeResult) {
    if (destinations.some((destination) => isDuplicateDestination(destination, result))) {
      setDuplicateDestinationError('This destination is already in your trip.')
      return
    }

    updateDestinations([
      ...destinations,
      { id: crypto.randomUUID(), name: result.label, location: result.location, description: result.description || undefined },
    ])
  }

  function removeDestination(id: string) {
    updateDestinations(destinations.filter((destination) => destination.id !== id))
  }

  function startOver() {
    updateDestinations([])
    setResetCount((count) => count + 1)
  }

  async function handlePlan() {
    // The button is disabled in these cases too; this also guards double clicks
    if (planning || destinations.length < MIN_DESTINATIONS) return

    setPlanning(true)
    setPlanError(null)
    setSaveError(null)
    setSavedMessage(null)
    try {
      // The page warm-up may still be waking Render's geoservice. Waiting for
      // it prevents the plan request from racing the cold start.
      await warmupPromise.current
      const nextPlan = await planTrip(destinations)
      setPlan(nextPlan)



    } catch (err) {
      // The destinations are kept, so "Try again" can resend the same list
      setPlanError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPlanning(false)
    }
  }

  async function handleSave() {
    // A plan is required because the save request must contain the planned route.
    if (!user || !plan || saving) return

    setSaving(true)
    setSaveError(null)
    setSavedMessage(null)
    try {
      await saveTrip(plan)
      setSavedMessage('Trip saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your trip. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Memoized so the map only redraws markers when the list really changes
  const markers = useMemo<MapMarker[]>(
    () =>
      destinations.map((destination, index) => ({
        id: destination.id,
        location: destination.location,
        label: String(index + 1),
      })),
    [destinations],
  )


  const canAddMore = destinations.length < MAX_DESTINATIONS

  return (
    <section className="mainSection">
      <div className={styles.planLayout}>
        <aside className={styles.planPanel}>
          <h1>Plan a trip</h1>

          <AddDestinationForm key={resetCount} onAdd={addDestination} disabled={!canAddMore || planning} />
          {duplicateDestinationError && (
            <p className="error" role="alert">
              {duplicateDestinationError}
            </p>
          )}
          {!canAddMore && <p className="hint">You can add at most {MAX_DESTINATIONS} destinations.</p>}

          <DestinationList destinations={destinations} onRemove={removeDestination} disabled={planning} />

          <div className={styles.planActions}>
            <Button
              type="button"
              onClick={handlePlan}
              disabled={planning || destinations.length < MIN_DESTINATIONS}
            >
              {planning ? 'Planning…' : 'Plan trip'}
            </Button>
            <Button type="button" onClick={startOver} disabled={planning || destinations.length === 0}>
              Start over
            </Button>
          </div>

          {planning && (
            <p className="hint" role="status">
              Planning your trip…
            </p>
          )}

          {planError && (
            <div className="banner error" role="alert">
              <p>{planError}</p>
              <button type="button" onClick={handlePlan}>
                Try again
              </button>
            </div>
          )}

          {plan && <TripSummary plan={plan} />}

          {plan && (
            <section aria-label="Save trip">
              {user ? (
                <>
                  <button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save trip'}
                  </button>
                  {savedMessage && <p className="hint" role="status">{savedMessage}</p>}
                  {saveError && <p className="banner error" role="alert">{saveError}</p>}
                </>
              ) : (
                <p className="hint">
                  <Link to="/login">Log in</Link> to save this trip.
                </p>
              )}
            </section>
          )}
        </aside>

        <MapView
          center={SWEDEN_CENTER}
          zoom={5}
          markers={markers}
          route={plan ? plan.route.geometry.coordinates : null}
        />
      </div>
    </section>
  )
}

export default PlanPage
