import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHealth } from '../../api/health.ts'
import { planTrip, saveTrip } from '../../api/trips.ts'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import DestinationList from '../../components/DestinationList/DestinationList.tsx'
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import TripSummary from '../../components/TripSummary/TripSummary.tsx'
import { useAuth } from '../../context/auth-context.ts'
import type { AccommodationType, Destination, GeocodeResult, PlanResponse } from '../../types/api.ts'
import styles from './PlanPage.module.css'
import { Button } from '../../components/atoms/Button.tsx'
import LocateMe from '../../components/LocateMe/LocateMe.tsx'
import ConfirmationPopup from '../../components/ConfirmationPopup/ConfiramtionPopup.tsx'

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
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [activeBreakpointIndex, setActiveBreakpointIndex] = useState(0)
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
    setStep(1)
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
    setShowConfirmationPopup(false)
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
      setActiveBreakpointIndex(0)
      setStep(2)

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

  function continueFromBreakpoint() {
    if (!plan) return
    if (activeBreakpointIndex < plan.breakPoints.length - 1) {
      setActiveBreakpointIndex((index) => index + 1)
    } else {
      setStep(4)
    }
  }

  function toggleAccommodationType(type: AccommodationType) {
    setPlan(null)
    setAccommodationTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((value) => value !== type)
      }
      return (['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[])
        .filter((value) => value === type || current.includes(value))
    })
  }

  // Memoized so the map only redraws markers when the list really changes
  const markers = useMemo<MapMarker[]>(
    () => {
      const activeBreakpoint = plan?.breakPoints[activeBreakpointIndex]
      if (step === 3 && activeBreakpoint) {
        const accommodationMarkers = (activeBreakpoint.skipped ? [] : activeBreakpoint.accommodation).map((place, index) => ({
          id: `accommodation-${activeBreakpointIndex}-${place.id}`,
          location: place.location,
          label: String(index + 1),
          kind: 'accommodation' as const,
        }))
        return [
          {
            id: `breakpoint-${activeBreakpointIndex}`,
            location: activeBreakpoint.location,
            label: `S${activeBreakpointIndex + 1}`,
            kind: 'breakpoint' as const,
          },
          ...accommodationMarkers,
        ]
      }

      const destinationMarkers = (plan?.destinations ?? destinations).map((destination, index) => ({
        id: destination.id,
        location: destination.location,
        label: String(index + 1),
        kind: 'destination' as const,
      }))
      const breakpointMarkers = (plan?.breakPoints ?? []).map((breakPoint, index) => ({
        id: `breakpoint-${index}`,
        location: breakPoint.location,
        label: `S${index + 1}`,
        kind: 'breakpoint' as const,
      }))
      const selectedAccommodationMarkers = step === 4
        ? (plan?.breakPoints ?? []).flatMap((breakPoint, breakPointIndex) =>
          breakPoint.accommodation
            .filter((place) => place.id === breakPoint.selectedAccommodationId && !breakPoint.skipped)
            .map((place) => ({
              id: `accommodation-${breakPointIndex}-${place.id}`,
              location: place.location,
              label: String(breakPointIndex + 1),
              kind: 'accommodation' as const,
            })),
        )
        : []
      return [...destinationMarkers, ...breakpointMarkers, ...selectedAccommodationMarkers]
    },
    [destinations, plan?.destinations, plan?.breakPoints, activeBreakpointIndex, step],
  )

  const activeBreakpoint = plan?.breakPoints[activeBreakpointIndex]
  const selectAccommodationMarker = (markerId: string) => {
    const placeId = markerId.replace(`accommodation-${activeBreakpointIndex}-`, '')
    if (activeBreakpoint?.accommodation.some((place) => place.id === placeId)) {
      chooseAccommodation(activeBreakpointIndex, placeId)
    }
  }


  const canAddMore = destinations.length < MAX_DESTINATIONS

  return (
    <section className="mainSection">

      {showConfirmationPopup && (
        <ConfirmationPopup 
        message="Are you sure you want to start over? All your current destinations will be lost." 
        onConfirm={startOver} 
        onCancel={() => setShowConfirmationPopup(false)}
        isOpen={showConfirmationPopup}
        />
      )}

      <div className={styles.planLayout}>
        <aside className={styles.planPanel}>
          <h1>Plan a trip</h1>

          <div className={styles.stepHeader}>
            <p className={styles.stepLabel}>Step {step} of 4</p>
            <h1>{step === 1 ? 'Add destinations' : step === 2 ? 'Set trip preferences' : step === 3 ? 'Choose your stops' : 'Review your trip'}</h1>
          </div>

          {step === 1 && (
            <>
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
          <div className={styles.planActions}>
            <Button type="button" variant="tertiary" onClick={() => setShowConfirmationPopup(true)} disabled={planning || destinations.length === 0}>
              Start over
            </Button>
            <Button type="button" onClick={() => setStep(2)} disabled={destinations.length < MIN_DESTINATIONS || planning}>
              Continue
            </Button>
          </div>
            </>
          )}

          {step === 2 && (
          <>
          <fieldset>
            <legend>Accommodation</legend>
            {(['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[]).map((type) => (
              <label key={type} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={accommodationTypes.includes(type)}
                  onChange={() => toggleAccommodationType(type)}
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
            onChange={(event) => {
              setMaxDrivingSeconds(Number(event.target.value))
              setPlan(null)
            }}
            disabled={planning}
          />
          <p className="hint">
            {user ? 'This preference is saved for your account.' : 'Guests start with 6 hours each time.'}
          </p>


          <div className={styles.planActions}>
            <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={planning}>Back</Button>
            <Button
              type="button"
              onClick={handlePlan}
              disabled={planning || destinations.length < MIN_DESTINATIONS}
            >
              {planning ? 'Planning…' : 'Plan trip'}
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

          {plan && (
            <section aria-label="Planned route">
              <p className="hint">
                Route planned. The map shows your route and suggested breakpoints.
              </p>
              <div className={styles.planActions}>
                <Button type="button" onClick={() => setStep(plan.breakPoints.length > 0 ? 3 : 4)}>
                  {plan.breakPoints.length > 0 ? 'Choose accommodations' : 'Continue to overview'}
                </Button>
              </div>
            </section>
          )}
          </>
          )}

          {plan && (step === 2 || step === 4) && <TripSummary plan={plan} />}

          {plan && plan.warnings.length > 0 && (
            <section aria-label="Planning notices">
              {plan.warnings.map((warning) => (
                <p className="hint" role="status" key={warning.code}>[{warning.code}] {warning.message}</p>
              ))}
            </section>
          )}

          {plan && step === 3 && activeBreakpoint && (
            <section aria-label="Accommodation suggestions">
              <h2>Stop {activeBreakpointIndex + 1} of {plan.breakPoints.length}</h2>
              <p className="hint">Distances are straight-line distances from the stop. These are suggestions, not bookings.</p>
              <article>
                  {activeBreakpoint.skipped ? (
                    <p className="hint">Stop skipped.</p>
                  ) : activeBreakpoint.accommodation.length === 0 ? (
                    <p className="hint">No accommodation found nearby</p>
                  ) : (
                    <ul className={styles.accommodationList}>
                      {activeBreakpoint.accommodation.map((place, placeIndex) => (
                        <li key={place.id}>
                          <Button
                            type="button"
                            className={place.id === activeBreakpoint.selectedAccommodationId ? `${styles.selectedAccommodation} ${styles.accommodationListItem}` : styles.accommodationListItem}
                            onClick={() => chooseAccommodation(activeBreakpointIndex, place.id)}
                            aria-pressed={place.id === activeBreakpoint.selectedAccommodationId}
                          >
                            <strong>{placeIndex + 1}. {place.name}</strong> ({place.type}) — about {(place.distanceMeters / 1000).toFixed(1)} km
                          {place.address && <><br /><span className="hint">{place.address}</span></>}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!activeBreakpoint.skipped && (
                    <Button type="button" variant="tertiary" onClick={() => skipBreakPoint(activeBreakpointIndex)}>
                      Skip this stop
                    </Button>
                  )}
                  {activeBreakpoint.accommodationRadiusMeters === 25_000 && (
                    <p className="hint">Nothing within 10 km. Showing places within 25 km.</p>
                  )}
                  <div className={styles.planActions}>
                    <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                      Back to preferences
                    </Button>
                    <Button type="button" onClick={continueFromBreakpoint}>
                      {activeBreakpointIndex < plan.breakPoints.length - 1 ? 'Next stop' : 'Overview'}
                    </Button>
                  </div>
              </article>
            </section>
          )}

          {plan && step === 4 && (
            <>
            <section aria-label="Selected accommodation stops">
              <h2>Accommodation stops</h2>
              <p className="hint">Your selected places to stay along the route.</p>
              <ol>
                {plan.breakPoints.map((breakPoint, index) => {
                  const selectedPlace = breakPoint.accommodation.find(
                    (place) => place.id === breakPoint.selectedAccommodationId,
                  )
                  return (
                    <li key={`${breakPoint.legIndex}-${index}`}>
                      <strong>Stop {index + 1}:</strong>{' '}
                      {breakPoint.skipped
                        ? 'Skipped'
                        : selectedPlace
                          ? `${selectedPlace.name} (${selectedPlace.type})`
                          : breakPoint.accommodation.length === 0
                            ? 'No accommodation found nearby'
                            : 'No accommodation selected'}
                    </li>
                  )
                })}
              </ol>
            </section>
            <section aria-label="Save trip">
              {user ? (
                <>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save trip'}
                  </Button>
                  {savedMessage && <p className="hint" role="status">{savedMessage}</p>}
                  {saveError && <p className="banner error" role="alert">{saveError}</p>}
                </>
              ) : (
                <p className="hint">
                  <Link to="/login">Log in</Link> to save this trip.
                </p>
              )}
              <Button type="button" variant="secondary" onClick={() => setStep(plan.breakPoints.length > 0 ? 3 : 2)}>Back</Button>
            </section>
            </>
          )}
        </aside>

        <MapView
          center={SWEDEN_CENTER}
          zoom={5}
          markers={markers}
          route={plan ? plan.route.geometry.coordinates : null}
          onMarkerClick={selectAccommodationMarker}
        />
      </div>
    </section>
  )
}

export default PlanPage
