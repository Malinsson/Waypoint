import { useMemo, useState } from 'react'
import { planTrip } from '../../api/trips.ts'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import DestinationList from '../../components/DestinationList/DestinationList.tsx'
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import TripSummary from '../../components/TripSummary/TripSummary.tsx'
import type { Destination, GeocodeResult, PlanResponse } from '../../types/api.ts'
import styles from './PlanPage.module.css'

const MIN_DESTINATIONS = 2
const MAX_DESTINATIONS = 10
// Roughly the middle of Sweden, so the whole country fits at zoom 5
const SWEDEN_CENTER: [number, number] = [16.5, 62.5]

function PlanPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  // Changing the key of AddDestinationForm remounts it, which is a simple
  // way to clear its search field and matches on "Start over"
  const [resetCount, setResetCount] = useState(0)

  // Any change to the list makes the old route wrong, so it is cleared and
  // the user plans again
  function updateDestinations(next: Destination[]) {
    setDestinations(next)
    setPlan(null)
    setPlanError(null)
  }

  function addDestination(result: GeocodeResult) {
    updateDestinations([
      ...destinations,
      { id: crypto.randomUUID(), name: result.label, location: result.location },
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
    try {
      setPlan(await planTrip(destinations))
    } catch (err) {
      // The destinations are kept, so "Try again" can resend the same list
      setPlanError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setPlanning(false)
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
    <div className={styles.planLayout}>
      <aside className={styles.planPanel}>
        <h1>Plan a trip</h1>

        <AddDestinationForm key={resetCount} onAdd={addDestination} disabled={!canAddMore || planning} />
        {!canAddMore && <p className="hint">You can add at most {MAX_DESTINATIONS} destinations.</p>}

        <DestinationList destinations={destinations} onRemove={removeDestination} disabled={planning} />

        <div className={styles.planActions}>
          <button
            type="button"
            onClick={handlePlan}
            disabled={planning || destinations.length < MIN_DESTINATIONS}
          >
            {planning ? 'Planning…' : 'Plan trip'}
          </button>
          <button type="button" onClick={startOver} disabled={planning || destinations.length === 0}>
            Start over
          </button>
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
      </aside>

      <MapView
        center={SWEDEN_CENTER}
        zoom={5}
        markers={markers}
        route={plan ? plan.route.geometry.coordinates : null}
      />
    </div>
  )
}

export default PlanPage
