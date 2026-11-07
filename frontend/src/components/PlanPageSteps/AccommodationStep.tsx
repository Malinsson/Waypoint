import { Button } from '../atoms/Button.tsx'
import type { Breakpoint, PlanResponse } from '../../types/api.ts'
import styles from '../../pages/Plan/PlanPage.module.css'


type AccommodationStepProps = {
  plan: PlanResponse
  activeBreakpoint: Breakpoint
  activeBreakpointIndex: number
  onChoose: (accommodationId: string) => void
  onSkip: () => void
  onBack: () => void
  onNext: () => void
}

function AccommodationStep({
  plan,
  activeBreakpoint,
  activeBreakpointIndex,
  onChoose,
  onSkip,
  onBack,
  onNext,
}: AccommodationStepProps) {
  return (
    <section aria-label="Accommodation suggestions">
      <h2>Stop {activeBreakpointIndex + 1} of {plan.breakPoints.length}</h2>
      <p className="hint">Distances are straight-line distances from the stop. These are suggestions, not bookings.</p>
      <article>
        <div className={styles.planContent}>
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
                  onClick={() => onChoose(place.id)}
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
          <Button type="button" variant="tertiary" onClick={onSkip}>Skip this stop</Button>
        )}
        {activeBreakpoint.accommodationRadiusMeters === 25_000 && (
          <p className="hint">Nothing within 10 km. Showing places within 25 km.</p>
        )}
        </div>

        <div className={styles.planActions}>
          <Button type="button" variant="secondary" onClick={onBack}>Back to preferences</Button>
          <Button type="button" onClick={onNext}>
            {activeBreakpointIndex < plan.breakPoints.length - 1 ? 'Next stop' : 'Overview'}
          </Button>
        </div>
      </article>
    </section>
  )
}

export default AccommodationStep
