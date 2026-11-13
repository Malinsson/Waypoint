import { Link } from 'react-router-dom'
import { Button } from '../atoms/Button.tsx'
import type { PlanResponse } from '../../types/api.ts'
import styles from '../../pages/Plan/PlanPage.module.css'
import TripSummary from '../TripSummary/TripSummary.tsx'

type OverviewStepProps = {
  plan: PlanResponse
  isLoggedIn: boolean
  saving: boolean
  savedMessage: string | null
  saveError: string | null
  onSave: () => void
  onBack: () => void
  onStartOver: () => void
  saveButtonLabel?: string
}

function OverviewStep({ plan, isLoggedIn, saving, savedMessage, saveError, onSave, onBack, onStartOver, saveButtonLabel = 'Save trip' }: OverviewStepProps) {
  return (
    <section aria-label="Trip overview" className={styles.planOverview}>
        <TripSummary plan={plan} />

        <section aria-label="Selected accommodation stops" className={styles.planContent}>
          <h2>Accommodation stops:</h2>
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
                      ? (
                        <>
                          {selectedPlace.name} ({selectedPlace.type})
                          {selectedPlace.address && <><br /><span className="hint">{selectedPlace.address}</span></>}
                        </>
                      )
                      : breakPoint.accommodation.length === 0
                        ? 'No accommodation found nearby'
                        : 'No accommodation selected'}
                </li>
              )
            })}
          </ol>
        </section>
        <section aria-label="Save trip" className={styles.planOverviewActions}>
          <div className={styles.planActions}>
            <Button type="button" variant="tertiary" onClick={onStartOver}>Plan new trip</Button>
            <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
          {isLoggedIn ? (
            <>
              <Button type="button" onClick={onSave} disabled={saving || savedMessage !== null}>
                {saving ? 'Saving…' : savedMessage !== null ? 'Trip saved' : saveButtonLabel}
              </Button>
            </>
          ) : (
            <p className="hint"><Link to="/login">Log in</Link> to save this trip.</p>
          )}
          {saveError && <p className="banner error" role="alert">{saveError}</p>}
        </div>
      </section>
    </section>
  )
}

export default OverviewStep
