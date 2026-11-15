import { useEffect, useRef } from 'react'
import { Button } from '../atoms/Button.tsx'
import type { Breakpoint, PlanResponse } from '../../types/api.ts'
import styles from '../../pages/Plan/PlanPage.module.css'


type AccommodationStepProps = {
  plan: PlanResponse
  activeBreakpoint: Breakpoint
  activeBreakpointIndex: number
  onChoose: (accommodationId: string) => void
  onSkip: () => void
  onUndoSkip: () => void
  onBack: () => void
  onNext: () => void
  onStartOver: () => void
  // Set when a place was picked on the map: that place's button gets focus.
  // A new object per request, so picking the same place twice still works.
  focusRequest?: { placeId: string } | null
}

// Scrolls the sheet body so the button is inside the part of the sheet that is
// actually on screen. The lower part of a half-open sheet is cut off by the
// map area, so the body's own edge is not the visible edge.
function scrollIntoVisibleArea(button: HTMLElement) {
  const sheet = button.closest('aside')
  const body = button.closest('aside > div:last-child')
  const visibleArea = sheet?.parentElement
  if (!(body instanceof HTMLElement) || !visibleArea) return

  const margin = 12
  const bodyRect = body.getBoundingClientRect()
  const buttonRect = button.getBoundingClientRect()
  const visibleBottom = Math.min(bodyRect.bottom, visibleArea.getBoundingClientRect().bottom) - margin
  const visibleTop = bodyRect.top + margin

  if (buttonRect.bottom > visibleBottom) {
    body.scrollBy({ top: buttonRect.bottom - visibleBottom, behavior: 'smooth' })
  } else if (buttonRect.top < visibleTop) {
    body.scrollBy({ top: buttonRect.top - visibleTop, behavior: 'smooth' })
  }
}

function AccommodationStep({
  plan,
  activeBreakpoint,
  activeBreakpointIndex,
  onChoose,
  onSkip,
  onUndoSkip,
  onBack,
  onNext,
  onStartOver,
  focusRequest = null,
}: AccommodationStepProps) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (!focusRequest) return
    let cancelled = false
    // Wait a frame: if the sheet was collapsed it is still `inert` in this
    // render, and an inert button cannot take focus.
    const frame = requestAnimationFrame(async () => {
      const button = buttonRefs.current.get(focusRequest.placeId)
      if (!button) return
      // preventScroll: a normal focus() scrolls every ancestor, including the
      // overflow:hidden map area the sheet slides in, which shifted the whole
      // layout. The sheet body is scrolled by hand below instead.
      button.focus({ preventScroll: true })

      // Positions are only reliable once the sheet has stopped sliding
      const sheet = button.closest('aside')
      await Promise.allSettled(sheet?.getAnimations().map((animation) => animation.finished) ?? [])
      if (!cancelled) scrollIntoVisibleArea(button)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [focusRequest])

  return (
    <>
      <h2>Stop {activeBreakpointIndex + 1} of {plan.breakPoints.length}</h2>
      <p className="hint">Distances are straight-line distances from the stop. These are suggestions, not bookings.</p>
      
      <div className={styles.planContent}>
        {activeBreakpoint.skipped && <p className="hint">Stop skipped.</p>}
        {activeBreakpoint.accommodation.length === 0 ? (
          <p className="hint">No accommodation found nearby</p>
        ) : (
          <ul className={styles.accommodationList}>
            {activeBreakpoint.accommodation.map((place, placeIndex) => (
              <li key={place.id}>
                <Button
                  type="button"
                  ref={(element) => {
                    if (element) buttonRefs.current.set(place.id, element)
                    else buttonRefs.current.delete(place.id)
                  }}
                  className={[
                    styles.accommodationListItem,
                    place.id === activeBreakpoint.selectedAccommodationId
                      ? styles.selectedAccommodation
                      : (activeBreakpoint.selectedAccommodationId || activeBreakpoint.skipped)
                        ? styles.unselectedAccommodation
                        : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onChoose(place.id)}
                  disabled={activeBreakpoint.skipped}
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
        {activeBreakpoint.skipped && (
          <Button type="button" variant="tertiary" onClick={onUndoSkip}>Undo skip</Button>
        )}
        {activeBreakpoint.accommodationRadiusMeters === 25_000 && (
          <p className="hint">Nothing within 10 km. Showing places within 25 km.</p>
        )}
        </div>

        <div className={styles.planActions}>
          <Button type="button" variant="tertiary" onClick={onStartOver}>Start over</Button>
          <Button type="button" variant="secondary" onClick={onBack}>Back</Button>
          <Button type="button" onClick={onNext}>
            {activeBreakpointIndex < plan.breakPoints.length - 1 ? 'Next' : 'Overview'}
          </Button>
        </div>
    </>
  )
}

export default AccommodationStep
