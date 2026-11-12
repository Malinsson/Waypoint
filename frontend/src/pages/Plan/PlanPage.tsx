import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client.ts'
import { getHealth } from '../../api/health.ts'
import { getTrip, optimizeBlockedReason, planTrip, saveTrip, updateSavedTrip } from '../../api/trips.ts'
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import TripSummary from '../../components/TripSummary/TripSummary.tsx'
import { useAuth } from '../../context/auth-context.ts'
import type { AccommodationType, Destination, GeocodeResult, PlanResponse } from '../../types/api.ts'
import styles from './PlanPage.module.css'
import ConfirmationPopup from '../../components/ConfirmationPopup/ConfiramtionPopup.tsx'
import PopupBase from '../../components/PopupBase/PopupBase.tsx'
import RenameForm from '../../components/RenameForm/RenameForm.tsx'
import DestinationsStep from '../../components/PlanPageSteps/DestinationsStep.tsx'
import PreferencesStep from '../../components/PlanPageSteps/PreferencesStep.tsx'
import AccommodationStep from '../../components/PlanPageSteps/AccommodationStep.tsx'
import OverviewStep from '../../components/PlanPageSteps/OverviewStep.tsx'
import Loader from '../../components/atoms/Loader.tsx'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import BottomSheet from '../../components/BottomSheet/BottomSheet.tsx'
import SheetLayout from '../../components/BottomSheet/SheetLayout.tsx'
import type { SnapPoint } from '../../components/BottomSheet/snap.ts'

const MIN_DESTINATIONS = 2
const MAX_DESTINATIONS = 10
const DEFAULT_MAX_DRIVING_SECONDS = 21_600
// Roughly the middle of Sweden, so the whole country fits at zoom 5
const SWEDEN_CENTER: [number, number] = [16.5, 62.5]
const LAST_PLAN_STORAGE_KEY = 'lastPlan'

type PersistedPlan = {
  destinations: Destination[]
  manuallyReordered: boolean
  optimizeOrder: boolean
  roundTrip: boolean
  accommodationTypes: AccommodationType[]
  maxDrivingSeconds: number
  plan: PlanResponse | null
  step: 1 | 2 | 3 | 4
  activeBreakpointIndex: number
}

function readPersistedPlan(): PersistedPlan | null {
  const storedPlan = localStorage.getItem(LAST_PLAN_STORAGE_KEY)
  if (!storedPlan) return null

  try {
    const parsed: unknown = JSON.parse(storedPlan)
    if (!parsed || typeof parsed !== 'object') return null

    const value = parsed as Record<string, unknown>
    const step = value.step
    if (
      !Array.isArray(value.destinations) ||
      !Array.isArray(value.accommodationTypes) ||
      typeof value.manuallyReordered !== 'boolean' ||
      typeof value.roundTrip !== 'boolean' ||
      typeof value.maxDrivingSeconds !== 'number' ||
      (step !== 1 && step !== 2 && step !== 3 && step !== 4) ||
      typeof value.activeBreakpointIndex !== 'number' ||
      (value.plan !== null && typeof value.plan !== 'object')
    ) {
      localStorage.removeItem(LAST_PLAN_STORAGE_KEY)
      return null
    }

    return {
      destinations: value.destinations as Destination[],
      manuallyReordered: value.manuallyReordered,
      // Plans stored before the checkbox existed have no value: default off
      optimizeOrder: value.optimizeOrder === true,
      roundTrip: value.roundTrip,
      accommodationTypes: value.accommodationTypes as AccommodationType[],
      maxDrivingSeconds: value.maxDrivingSeconds,
      plan: value.plan as PlanResponse | null,
      step,
      activeBreakpointIndex: value.activeBreakpointIndex,
    }
  } catch {
    localStorage.removeItem(LAST_PLAN_STORAGE_KEY)
    return null
  }
}

function PlanPage() {
  const { id: editTripId } = useParams<{ id: string }>()
  const editMode = Boolean(editTripId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [storedPlan] = useState<PersistedPlan | null>(readPersistedPlan)
  const [destinations, setDestinations] = useState<Destination[]>(storedPlan?.destinations ?? [])
  const [manuallyReordered, setManuallyReordered] = useState(storedPlan?.manuallyReordered ?? false)
  // Off by default: optimizing is slow and can fail, so the user opts in
  const [optimizeOrder, setOptimizeOrder] = useState(storedPlan?.optimizeOrder ?? false)
  const [roundTrip, setRoundTrip] = useState(storedPlan?.roundTrip ?? false)
  const [accommodationTypes, setAccommodationTypes] = useState<AccommodationType[]>(storedPlan?.accommodationTypes ?? ['hotel'])
  const [maxDrivingSeconds, setMaxDrivingSeconds] = useState(storedPlan?.maxDrivingSeconds ?? DEFAULT_MAX_DRIVING_SECONDS)
  const [plan, setPlan] = useState<PlanResponse | null>(storedPlan?.plan ?? null)
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  // Set when the route failed because of specific destinations. An empty list
  // means "no road connection, but we could not tell which stop"; null means
  // some other error.
  const [unreachableIds, setUnreachableIds] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [tripName, setTripName] = useState<string | undefined>(undefined)
  const [editLoading, setEditLoading] = useState(editMode)
  const [editLoadError, setEditLoadError] = useState<string | null>(null)
  const [duplicateDestinationError, setDuplicateDestinationError] = useState<string | null>(null)
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false)
  const [showNamePopup, setShowNamePopup] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(storedPlan?.step ?? 1)
  const [activeBreakpointIndex, setActiveBreakpointIndex] = useState(storedPlan?.activeBreakpointIndex ?? 0)
  // Phone layout: how far the planning panel is slid up over the map
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('half')
  const warmupPromise = useRef<Promise<unknown> | null>(null)
  // Changing the key of AddDestinationForm remounts it, which is a simple
  // way to clear its search field and matches on "Start over"
  const [resetCount, setResetCount] = useState(0)

  // A new step brings new content, so the panel is brought back up to show it
  useEffect(() => {
    setSheetSnap('half')
  }, [step])

  useEffect(() => {
    if (!editTripId) return

    getTrip(editTripId)
      .then(({ trip }) => {
        setTripName(trip.name)
        setDestinations(trip.destinations.map((destination) => ({
          id: crypto.randomUUID(),
          name: destination.locationId.name,
          location: [destination.locationId.longitude, destination.locationId.latitude],
          description: destination.locationId.description,
        })))
        setRoundTrip(trip.roundTrip ?? false)
        setAccommodationTypes(trip.accommodationPreference.types as AccommodationType[])
        setMaxDrivingSeconds(trip.maxDrivingHours * 3_600)
        setStep(1)
        setPlanError(null)
      })
      .catch((err) => setEditLoadError(err instanceof Error ? err.message : 'Could not load this trip.'))
      .finally(() => setEditLoading(false))
  }, [editTripId])

  useEffect(() => {
    if (!storedPlan && !editMode) {
      setMaxDrivingSeconds(user?.maxDrivingSeconds ?? DEFAULT_MAX_DRIVING_SECONDS)
    }
  }, [storedPlan, user])

  // Render's free services sleep when idle. A quiet request when the page
  // opens wakes the backend, so it is ready when the user starts typing.
  // The answer and any error are ignored on purpose.
  useEffect(() => {
    warmupPromise.current = getHealth().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!editMode && destinations.length > 0) {
      localStorage.setItem(LAST_PLAN_STORAGE_KEY, JSON.stringify({
        destinations,
        manuallyReordered,
        optimizeOrder,
        roundTrip,
        accommodationTypes,
        maxDrivingSeconds,
        plan,
        step,
        activeBreakpointIndex,
      }))
    }
  }, [plan, destinations, manuallyReordered, optimizeOrder, roundTrip, accommodationTypes, maxDrivingSeconds, step, activeBreakpointIndex])

  // Any change to the list makes the old route wrong, so it is cleared and
  // the user plans again
  // A checked box is ignored while optimization is blocked (too few stops,
  // manual order, too far apart), so a stale choice can never be sent
  const optimizeBlockedMessage = optimizeBlockedReason(destinations, manuallyReordered)
  const willOptimize = optimizeOrder && optimizeBlockedMessage === null

  function updateDestinations(next: Destination[]) {
    setDestinations(next)
    setManuallyReordered(false)
    setPlan(null)
    setPlanError(null)
    setUnreachableIds(null)
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
    localStorage.removeItem(LAST_PLAN_STORAGE_KEY)
    setResetCount((count) => count + 1)
    setShowConfirmationPopup(false)
  }

  async function handlePlan() {
    // The button is disabled in these cases too; this also guards double clicks
    if (planning || destinations.length < MIN_DESTINATIONS) return

    setPlanning(true)
    setPlanError(null)
    setUnreachableIds(null)
    setSaveError(null)
    setSavedMessage(null)
    try {
      // The page warm-up may still be waking Render's geoservice. Waiting for
      // it prevents the plan request from racing the cold start.
      await warmupPromise.current
      const nextPlan = await planTrip(destinations, willOptimize, roundTrip, accommodationTypes, maxDrivingSeconds)
      setPlan(nextPlan)
      // Show the list in the order that was actually planned (spec: ordering
      // rules). The return stop of a round trip is not a list item, and
      // updateDestinations is not used because it would clear the new plan.
      setDestinations(
        nextPlan.destinations
          .filter((destination) => !destination.id.endsWith('-return'))
          .map(({ id, name, location, description }) => ({ id, name, location, description })),
      )
      setActiveBreakpointIndex(0)
      setStep(2)

    } catch (err) {
      // The destinations are kept, so "Try again" can resend the same list
      setPlanError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      if (err instanceof ApiError && err.code === 'ROUTE_NOT_FOUND') {
        const ids = err.details?.destinationIds
        setUnreachableIds(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
      }
    } finally {
      setPlanning(false)
    }
  }

  // A new trip asks for a name first. An existing trip already has one, so editing saves directly.
  function handleSaveClick() {
    if (editTripId) {
      void handleSave()
    } else {
      setShowNamePopup(true)
    }
  }

  // Empty name means "name later": the backend then makes a default name
  function handleNameChosen(name: string) {
    setShowNamePopup(false)
    void handleSave(name || undefined)
  }

  async function handleSave(name?: string) {
    // A plan is required because the save request must contain the planned route.
    if (!user || !plan || saving) return

    setSaving(true)
    setSaveError(null)
    setSavedMessage(null)
    try {
      if (editTripId) {
        await updateSavedTrip(editTripId, plan, maxDrivingSeconds, accommodationTypes, tripName)
        navigate(`/trips/${editTripId}`)
      } else {
        await saveTrip(plan, name, accommodationTypes, maxDrivingSeconds)
        setSavedMessage('Trip saved.')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your trip. Please try again.')
    } finally {
      setSaving(false)
    }

  }

  function chooseAccommodation(breakPointIndex: number, accommodationId: string) {
    if (!plan) return
    // Any edit makes the saved copy outdated, so the save button must work again
    setSavedMessage(null)
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
    setSavedMessage(null)
    setPlan({
      ...plan,
      breakPoints: plan.breakPoints.map((breakPoint, index) => {
        if (index !== breakPointIndex) return breakPoint
        const { selectedAccommodationId: _selectedAccommodationId, ...withoutSelection } = breakPoint
        return { ...withoutSelection, skipped: true }
      }),
    })
  }

  function undoSkipBreakPoint(breakPointIndex: number) {
    if (!plan) return
    setSavedMessage(null)
    setPlan({
      ...plan,
      breakPoints: plan.breakPoints.map((breakPoint, index) =>
        index === breakPointIndex
          ? { ...breakPoint, skipped: false }
          : breakPoint,
      ),
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
      // Phone: get the panel out of the way so the user can see the map
      setSheetSnap('collapsed')
    }
  }


  const canAddMore = destinations.length < MAX_DESTINATIONS

  return (
    <section className="mainSection">
      {editLoading && <Loader />}
      {!editLoading && editMode && editLoadError && <p className="error" role="alert">{editLoadError}</p>}

      {!editLoading && (!editMode || !editLoadError) && showConfirmationPopup && (
        <ConfirmationPopup 
        message="Are you sure you want to start over? All your current destinations will be lost." 
        onConfirm={startOver} 
        onCancel={() => setShowConfirmationPopup(false)}
        isOpen={showConfirmationPopup}
        />
      )}

      {showNamePopup && (
        <PopupBase onCancel={() => setShowNamePopup(false)} isOpen={showNamePopup}>
          <h2>Name your trip</h2>
          <RenameForm
            label="Give your trip a name now, or leave it empty to name it later:"
            placeholder="Trip name"
            submitLabel="Save"
            secondaryLabel="Name later"
            onSecondary={() => handleNameChosen('')}
            onSubmit={handleNameChosen}
          />
        </PopupBase>
      )}

      {!editLoading && (!editMode || !editLoadError) && <SheetLayout className={styles.planLayout}>
        <BottomSheet
          label="Trip planner"
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          className={styles.planPanel}
          // Step 3 reuses the same panel for each stop, so the stop counts too
          scrollResetKey={`${step}-${activeBreakpointIndex}`}
          header={
            <div className={styles.stepHeader}>
              <p className={styles.stepLabel}>Step {step} of 4</p>
              <h1>{step === 1 ? 'Add destinations' : step === 2 ? 'Set trip preferences' : step === 3 ? 'Choose your stops' : 'Trip overview'}</h1>
            </div>
          }
          pinned={step === 1 && (
            <div className={styles.searchBar}>
              <AddDestinationForm
                key={resetCount}
                onAdd={addDestination}
                disabled={!canAddMore || planning}
                biasLocation={destinations.at(-1)?.location}
              />
              {duplicateDestinationError && (
                <p className="error" role="alert">
                  {duplicateDestinationError}
                </p>
              )}
              {!canAddMore && <p className="hint">You can add at most 10 destinations.</p>}
            </div>
          )}
        >

          {step === 1 && (
            <DestinationsStep
              destinations={destinations}
              planning={planning}
              roundTrip={roundTrip}
              unreachableIds={unreachableIds ?? []}
              onAdd={addDestination}
              onRemove={removeDestination}
              onReorder={reorderDestinations}
              onRoundTripChange={(enabled) => {
                setRoundTrip(enabled)
                setPlan(null)
              }}
              onStartOver={() => setShowConfirmationPopup(true)}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <PreferencesStep
              accommodationTypes={accommodationTypes}
              maxDrivingSeconds={maxDrivingSeconds}
              optimizeOrder={optimizeOrder}
              optimizeBlockedReason={optimizeBlockedMessage}
              onOptimizeOrderChange={(enabled) => {
                setOptimizeOrder(enabled)
                setPlan(null)
              }}
              planning={planning}
              plan={plan}
              planError={planError}
              unreachableNames={unreachableIds === null
                ? null
                : destinations.filter((destination) => unreachableIds.includes(destination.id)).map((destination) => destination.name)}
              onToggleAccommodationType={toggleAccommodationType}
              onMaxDrivingSecondsChange={(seconds) => {
                setMaxDrivingSeconds(seconds)
                setPlan(null)
              }}
              onBack={() => setStep(1)}
              onPlan={() => void handlePlan()}
              onTryAgain={() => void handlePlan()}
              onContinue={() => setStep(plan?.breakPoints.length ? 3 : 4)}
              onStartOver={() => setShowConfirmationPopup(true)}
            />
          )}

          {plan && plan.warnings.length > 0 && (
            <section aria-label="Planning notices">
              {plan.warnings.map((warning) => (
                <p className="hint" role="status" key={warning.code}>[{warning.code}] {warning.message}</p>
              ))}
            </section>
          )}

          {plan && step === 3 && activeBreakpoint && (
            <AccommodationStep
              plan={plan}
              activeBreakpoint={activeBreakpoint}
              activeBreakpointIndex={activeBreakpointIndex}
              onChoose={(accommodationId) => chooseAccommodation(activeBreakpointIndex, accommodationId)}
              onSkip={() => skipBreakPoint(activeBreakpointIndex)}
              onUndoSkip={() => undoSkipBreakPoint(activeBreakpointIndex)}
              onBack={() => setStep(2)}
              onNext={continueFromBreakpoint}
              onStartOver={() => setShowConfirmationPopup(true)}
            />
          )}

          {plan && (step === 4) && <TripSummary plan={plan} />}

          {plan && step === 4 && (
            <OverviewStep
              plan={plan}
              isLoggedIn={user !== null}
              saving={saving}
              savedMessage={savedMessage}
              saveError={saveError}
              onSave={handleSaveClick}
              onBack={() => setStep(plan.breakPoints.length > 0 ? 3 : 2)}
              onStartOver={() => setShowConfirmationPopup(true)}
              saveButtonLabel={editMode ? 'Save changes' : undefined}
            />
          )}
        </BottomSheet>

        <MapView
          center={SWEDEN_CENTER}
          zoom={5}
          markers={markers}
          route={plan ? plan.route.geometry.coordinates : null}
          onMarkerClick={selectAccommodationMarker}
        />
      </SheetLayout>}
    </section>
  )
}

export default PlanPage
