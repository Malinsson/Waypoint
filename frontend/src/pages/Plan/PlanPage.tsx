import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth } from '../../api/health.ts'
import { planTrip, saveTrip } from '../../api/trips.ts'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import DestinationList from '../../components/DestinationList/DestinationList.tsx'
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import TripSummary from '../../components/TripSummary/TripSummary.tsx'
import { useAuth } from '../../context/auth-context.ts'
import type { AccommodationType, Destination, GeocodeResult, PlanResponse, Breakpoint } from '../../types/api.ts'
import styles from './PlanPage.module.css'
import { Button } from '../../components/atoms/Button.tsx'
import LocateMe from '../../components/LocateMe/LocateMe.tsx'

const MIN_DESTINATIONS = 2
const MAX_DESTINATIONS = 10
const DEFAULT_MAX_DRIVING_SECONDS = 21_600
const MIN_MAX_DRIVING_SECONDS = 3_600
const MAX_MAX_DRIVING_SECONDS = 57_600
const DRIVING_STEP_SECONDS = 3_600
// Roughly the middle of Sweden, so the whole country fits at zoom 5
const SWEDEN_CENTER: [number, number] = [16.5, 62.5]

function PlanPage() {
  const { user } = useAuth()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [manuallyReordered, setManuallyReordered] = useState(false)
  const [roundTrip, setRoundTrip] = useState(false)
  const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>(['hotel'])
  const [maxDrivingSeconds, setMaxDrivingSeconds] = useState(DEFAULT_MAX_DRIVING_SECONDS)
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

  useEffect(() => {
    setMaxDrivingSeconds(user?.maxDrivingSeconds ?? DEFAULT_MAX_DRIVING_SECONDS)
  }, [user])

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
    setManuallyReordered(false)
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

  function reorderDestinations(orderedIds: string[]) {
    const orderedDestinations = orderedIds
      .filter((id) => !id.endsWith('-return'))
      .map((id) => destinations.find((destination) => destination.id === id))
      .filter((destination): destination is Destination => destination !== undefined)

    if (orderedDestinations.length !== destinations.length) return
    updateDestinations(orderedDestinations)
    setManuallyReordered(true)
  }

  function startOver() {
    updateDestinations([])
    setRoundTrip(false)
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
      const nextPlan = await planTrip(destinations, manuallyReordered, roundTrip, accommodationTypes, maxDrivingSeconds)
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
      await saveTrip(plan, undefined, accommodationTypes, maxDrivingSeconds)
      setSavedMessage('Trip saved.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your trip. Please try again.')
    } finally {
      setSaving(false)
    }

  }

  function chooseAccommodation(breakPointIndex: number, accommodationId: string) {
    if (!plan) return
    setPlan({
      ...plan,
      breakPoints: plan.breakPoints.map((breakPoint, index) =>
        index === breakPointIndex
          ? { ...breakPoint, selectedAccommodationId: accommodationId, skipped: false }
          : breakPoint,
      ),
    })
  }

  function skipBreakPoint(breakPointIndex: number) {
    if (!plan) return
    setPlan({
      ...plan,
      breakPoints: plan.breakPoints.map((breakPoint, index) => {
        if (index !== breakPointIndex) return breakPoint
        const { selectedAccommodationId: _selectedAccommodationId, ...withoutSelection } = breakPoint
        return { ...withoutSelection, skipped: true }
      }),
    })
  }

  // Memoized so the map only redraws markers when the list really changes
  const markers = useMemo<MapMarker[]>(
    () => {
      const destinationMarkers = (plan?.destinations ?? destinations).map((destination, index) => ({
        id: destination.id,
        location: destination.location,
        label: String(index + 1),
        kind: 'destination' as const,
      }))
      const accommodationMarkers = (plan?.breakPoints ?? []).flatMap((breakPoint, breakPointIndex) =>
        breakPoint.accommodation
          .filter((place) => place.id === breakPoint.selectedAccommodationId && !breakPoint.skipped)
          .map((place) => ({
          id: `accommodation-${breakPointIndex}-${place.id}`,
          location: place.location,
          label: place.type[0]!.toUpperCase(),
          kind: 'accommodation' as const,
          })),
      )
      return [...destinationMarkers, ...accommodationMarkers]
    },
    [destinations, plan?.destinations, plan?.breakPoints],
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
          
          {destinations.length === 0 && <LocateMe onLocate={(location) => addDestination({ label: 'Current Location', location: [location[0], location[1]], description: 'Your current location', kind: 'address' })} />}

          <DestinationList
            destinations={plan?.destinations ?? destinations}
            onRemove={removeDestination}
            onReorder={reorderDestinations}
            roundTrip={roundTrip}
            onRoundTripChange={(enabled) => {
              setRoundTrip(enabled)
              setPlan(null)
            }}
            disabled={planning}
          />

          <fieldset>
            <legend>Accommodation</legend>
            {(['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[]).map((type) => (
              <label key={type} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={accommodationTypes.includes(type)}
                  onChange={() => setAccommodationTypes((current) => {
                    if (current.includes(type)) {
                      return current.length === 1 ? current : current.filter((value) => value !== type)
                    }
                    return (['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[])
                      .filter((value) => value === type || current.includes(value))
                  })}
                  disabled={planning}
                />
                {type[0].toUpperCase() + type.slice(1)}
              </label>
            ))}
          </fieldset>

          <label htmlFor="max-driving-time">
            Maximum driving time: {maxDrivingSeconds / 3_600} hours
          </label>
          <input
            id="max-driving-time"
            type="range"
            min={MIN_MAX_DRIVING_SECONDS}
            max={MAX_MAX_DRIVING_SECONDS}
            step={DRIVING_STEP_SECONDS}
            value={maxDrivingSeconds}
            onChange={(event) => setMaxDrivingSeconds(Number(event.target.value))}
            disabled={planning}
          />
          <p className="hint">
            {user ? 'This preference is saved for your account.' : 'Guests start with 6 hours each time.'}
          </p>


          <div className={styles.planActions}>
            <Button
              type="button"
              onClick={handlePlan}
              disabled={planning || destinations.length < MIN_DESTINATIONS}
            >
              {planning ? 'Planning…' : 'Plan trip'}
            </Button>
            <Button type="button" variant="tertiary" onClick={startOver} disabled={planning || destinations.length === 0}>
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

          {plan && plan.warnings.length > 0 && (
            <section aria-label="Planning notices">
              {plan.warnings.map((warning) => (
                <p className="hint" role="status" key={warning.code}>[{warning.code}] {warning.message}</p>
              ))}
            </section>
          )}

          {plan && plan.breakPoints.length > 0 && (
            <section aria-label="Accommodation suggestions">
              <h2>Places to stay</h2>
              <p className="hint">Distances are straight-line distances from the stop. These are suggestions, not bookings.</p>
              {plan.breakPoints.map((breakPoint: Breakpoint, index) => (
                <article key={`${breakPoint.legIndex}-${index}`}>
                  <h3>Stop {index + 1}</h3>
                  {breakPoint.skipped ? (
                    <p className="hint">Stop skipped.</p>
                  ) : breakPoint.accommodation.length === 0 ? (
                    <p className="hint">No accommodation found nearby</p>
                  ) : (
                    <ul>
                      {breakPoint.accommodation.map((place) => (
                        <li key={place.id}>
                          <button
                            type="button"
                            onClick={() => chooseAccommodation(index, place.id)}
                            aria-pressed={place.id === breakPoint.selectedAccommodationId}
                          >
                            <strong>{place.name}</strong> ({place.type}) — about {(place.distanceMeters / 1000).toFixed(1)} km
                          </button>
                          {place.address && <><br /><span className="hint">{place.address}</span></>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!breakPoint.skipped && (
                    <button type="button" onClick={() => skipBreakPoint(index)}>
                      Skip this stop
                    </button>
                  )}
                  {breakPoint.accommodationRadiusMeters === 25_000 && (
                    <p className="hint">Nothing within 10 km. Showing places within 25 km.</p>
                  )}
                </article>
              ))}
            </section>
          )}

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
