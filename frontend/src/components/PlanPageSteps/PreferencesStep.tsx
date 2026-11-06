import { Button } from '../atoms/Button.tsx'
import type { AccommodationType, PlanResponse } from '../../types/api.ts'
import shared from '../../pages/Plan/PlanPage.module.css'
import styles from './PreferencesStep.module.css'


type PreferencesStepProps = {
  accommodationTypes: AccommodationType[]
  maxDrivingSeconds: number
  planning: boolean
  plan: PlanResponse | null
  planError: string | null
  isLoggedIn: boolean
  onToggleAccommodationType: (type: AccommodationType) => void
  onMaxDrivingSecondsChange: (seconds: number) => void
  onBack: () => void
  onPlan: () => void
  onTryAgain: () => void
  onContinue: () => void
}

function PreferencesStep({
  accommodationTypes,
  maxDrivingSeconds,
  planning,
  plan,
  planError,
  isLoggedIn,
  onToggleAccommodationType,
  onMaxDrivingSecondsChange,
  onBack,
  onPlan,
  onTryAgain,
  onContinue,
}: PreferencesStepProps) {
  return (
    <>
      <fieldset aria-label="Accommodation preferences" className="decorativeBorder">
        <legend>Accommodation</legend>
        {(['hotel', 'hostel', 'camping', 'parking'] as AccommodationType[]).map((type) => (
          <label key={type} style={{ display: 'block' }}>
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
      <input
        id="max-driving-time"
        type="range"
        min={3_600}
        max={57_600}
        step={3_600}
        value={maxDrivingSeconds}
        onChange={(event) => onMaxDrivingSecondsChange(Number(event.target.value))}
        disabled={planning}
      />
      <p className="hint">
        {isLoggedIn ? 'This preference is saved for your account.' : 'Guests start with 6 hours each time.'}
      </p>

      <div className={shared.planActions}>
        <Button type="button" variant="secondary" onClick={onBack} disabled={planning}>Back</Button>
        <Button type="button" onClick={onPlan} disabled={planning}>
          {planning ? 'Planning…' : 'Plan trip'}
        </Button>
      </div>

      {planning && <p className="hint" role="status">Planning your trip…</p>}

      {planError && (
        <div className="banner error" role="alert">
          <p>{planError}</p>
          <button type="button" onClick={onTryAgain}>Try again</button>
        </div>
      )}

      {plan && (
        <section aria-label="Planned route">
          <p className="hint">Route planned. The map shows your route and suggested breakpoints.</p>
          <div className={shared.planActions}>
            <Button type="button" onClick={onContinue}>
              {plan.breakPoints.length > 0 ? 'Choose accommodations' : 'Continue to overview'}
            </Button>
          </div>
        </section>
      )}
    </>
  )
}

export default PreferencesStep
