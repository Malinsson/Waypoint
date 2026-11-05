import { Link } from 'react-router-dom'
import { Button } from '../atoms/Button.tsx'
import type { PlanResponse } from '../../types/api.ts'

type ReviewStepProps = {
  plan: PlanResponse
  isLoggedIn: boolean
  saving: boolean
  savedMessage: string | null
  saveError: string | null
  onSave: () => void
  onBack: () => void
}

function ReviewStep({ plan, isLoggedIn, saving, savedMessage, saveError, onSave, onBack }: ReviewStepProps) {
  return (
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
        {isLoggedIn ? (
          <>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save trip'}
            </Button>
            {savedMessage && <p className="hint" role="status">{savedMessage}</p>}
            {saveError && <p className="banner error" role="alert">{saveError}</p>}
          </>
        ) : (
          <p className="hint"><Link to="/login">Log in</Link> to save this trip.</p>
        )}
        <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
      </section>
    </>
  )
}

export default ReviewStep
