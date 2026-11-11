import { Button } from '../atoms/Button.tsx'
import type { AccommodationType, PlanResponse } from '../../types/api.ts'
import shared from '../../pages/Plan/PlanPage.module.css'
import styles from './PreferencesStep.module.css'
import { useState } from 'react'
import TripSummary from '../TripSummary/TripSummary.tsx'
import { SquareExclamationPoint } from 'lucide-react'


type PreferencesStepProps = {
  accommodationTypes: AccommodationType[]
  maxDrivingSeconds: number
  optimizeOrder: boolean
  // Why the checkbox is unavailable, or null when it can be used
  optimizeBlockedReason: string | null
  planning: boolean
  plan: PlanResponse | null
  planError: string | null
  // Names of destinations with no road connection. null = a different error,
  // empty = no road connection but we could not tell which stop.
  unreachableNames: string[] | null
  onToggleAccommodationType: (type: AccommodationType) => void
  onMaxDrivingSecondsChange: (seconds: number) => void
  onOptimizeOrderChange: (enabled: boolean) => void
  onBack: () => void
  onPlan: () => void
  onTryAgain: () => void
  onContinue: () => void
  onStartOver: () => void
}

function PreferencesStep({
  accommodationTypes,
  maxDrivingSeconds,
  optimizeOrder,
  optimizeBlockedReason,
  planning,
  plan,
  planError,
  unreachableNames,
  onToggleAccommodationType,
  onMaxDrivingSecondsChange,
  onOptimizeOrderChange,
  onBack,
  onPlan,
  onTryAgain,
  onContinue,
  onStartOver,
}: PreferencesStepProps) {
  // Once a trip is planned the choices are hidden to keep the panel clean.
  // "editing" lets the user open them again without going back a step.
  const [editing, setEditing] = useState(false)
  const showPreferences = plan === null || editing

  return (
    <>
      {showPreferences ? (
      <>
      <div className={shared.planContent}>
        {plan !== null && (
          <div className={styles.editingBanner}>
            <h2>Edit preferences</h2>
            <Button 
            type="button" 
            variant="tertiary" 
            className={styles.closeButton}
            onClick={() => setEditing(false)} 
            aria-label="Close preferences">
              ✕
            </Button>
          </div>
        )}
        <fieldset aria-label="Accommodation preferences" className={`decorativeBorder ${styles.accommodationFieldset}`}>
          <legend>Accommodation</legend>
          {(['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[]).map((type) => (
            <label key={type}>
              <input
                type="checkbox"
                checked={accommodationTypes.includes(type)}
                onChange={() => onToggleAccommodationType(type)}
                disabled={planning}
                className={styles.checkbox}
              />
              {type[0].toUpperCase() + type.slice(1)}
            </label>
          ))}
        </fieldset>


        <label htmlFor="max-driving-time">
          Maximum driving time: {maxDrivingSeconds / 3_600} hours
        </label>
        <div className={styles.rangeContainer}>
          <input
            id="max-driving-time"
            type="range"
            min={3_600}
            max={57_600}
            step={3_600}
            list="range-markers"
            value={maxDrivingSeconds}
            onChange={(event) => onMaxDrivingSecondsChange(Number(event.target.value))}
            disabled={planning}
            className={styles.rangeInput}
          />
          <datalist id="range-markers">
            <option value={3_600} label="1h" />
            <option value={28_800} label="8h" />
            <option value={57_600} label="16h" />
          </datalist>
        </div>
        <p className="hint">Choose the maximum amount of time you want to drive between stops. The planner will try to find suitable accommodations along the route.</p>

      </div>

      <div className={`${shared.planContent} ${optimizeBlockedReason !== null ? styles.disabledCheckbox : ''}`}>
        <label className={styles.optimizeLabel}>
          <input
            type="checkbox"
            checked={optimizeOrder && optimizeBlockedReason === null}
            onChange={(event) => onOptimizeOrderChange(event.target.checked)}
            disabled={planning || optimizeBlockedReason !== null}
            className={`${styles.checkbox} `}
          />
          Optimize the order of my stops
        </label>
        <p className="hint">
          {optimizeBlockedReason ?? 'Reorders the stops in between to give the shortest route. The first and last stop stay in place. Works best on shorter trips: it can take up to a minute and may fail on longer ones. If it fails, your own order is used.'}
        </p>
      </div>

        </>
        ) : (
          <div className={shared.planContent}>
            <p className={styles.summary}>
              {accommodationTypes.map((type) => type[0].toUpperCase() + type.slice(1)).join(', ')}
              {' · '}max {maxDrivingSeconds / 3_600} h driving between stops
            </p>
            <Button type="button" variant="secondary" onClick={() => setEditing(true)} disabled={planning}>
              Edit preferences
            </Button>
          </div>
        )}

      {planning && (
        <p className="hint" role="status">
          {optimizeOrder && optimizeBlockedReason === null
            ? 'Planning your trip and optimizing the order. This can take up to a minute…'
            : 'Planning your trip…'}
        </p>
      )}

      {planError && unreachableNames !== null && (
        // Trying again with the same list cannot work, so the only action
        // offered is going back to fix the destinations
        <div className={`banner error ${styles.errorBanner} `} role="alert">
          <SquareExclamationPoint  />
          <p>{planError}</p>
          <p>
            {unreachableNames.length > 0
              ? `Go back and remove or replace ${unreachableNames.join(', ')}. It is highlighted in your list.`
              : 'Go back and remove or replace the destination that is not connected by road.'}
          </p>
          <Button type="button" variant="secondary" onClick={onBack}>Back to destinations</Button>
        </div>
      )}

      {planError && unreachableNames === null && (
        <div className="banner error" role="alert">
          <p>{planError}</p>
          <Button type="button" variant="tertiary" onClick={() => { setEditing(false); onTryAgain() }}>Try again</Button>
        </div>
      )}

      {plan !== null ? (
        <section aria-label="Planned route">
          {plan && <TripSummary plan={plan} />}
          <p className="hint">Route planned. The map shows your route and suggested breakpoints.</p>
          <div className={shared.planActions}>
            <Button type="button" variant="tertiary" onClick={onStartOver}>Start over</Button>
            <Button type="button" variant="secondary" onClick={onBack} disabled={planning}>Back</Button>
            <Button type="button" onClick={onContinue}>Continue</Button>
          </div>
        </section>
      ) : (
          <div className={shared.planActions}>
            <Button type="button" variant="tertiary" onClick={onStartOver}>Start over</Button>
            <Button type="button" variant="secondary" onClick={onBack} disabled={planning}>Back</Button>

            <Button type="button" onClick={() => { setEditing(false); onPlan() }} disabled={planning}>
              {planning ? 'Planning…' : 'Plan trip'}
            </Button>

          </div>
      )}
    </>
  )
}

export default PreferencesStep
