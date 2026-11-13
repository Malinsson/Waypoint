import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'
import styles from './BottomSheet.module.css'
import { clampOffset, nearestSnap, nextSnap, snapOffsets, type SnapOffsets, type SnapPoint } from './snap.ts'

type BottomSheetProps = {
  // Controlled: the page owns the position so it can move the sheet itself,
  // e.g. open it when a new step starts
  snap: SnapPoint
  onSnapChange: (snap: SnapPoint) => void
  // Accessible name of the panel
  label: string
  // Always visible and draggable (together with the handle): usually a title
  header: ReactNode
  // Always visible but NOT draggable: for things that need touch themselves,
  // like a search field with a scrolling suggestion list
  pinned?: ReactNode
  // The part that slides away
  children: ReactNode
  className?: string
  bodyClassName?: string
  // When this value changes the body is scrolled back to the top, e.g. a step number
  scrollResetKey?: string | number
  // Pass wheel scrolling to the document when this panel reaches an edge
  allowPageScrollAtEdges?: boolean
}

// Elements that must keep their normal click/typing behaviour instead of starting a drag
const INTERACTIVE = 'input, button, a, select, textarea, label'
// Smaller movements count as a tap, not a drag
const DRAG_THRESHOLD_PX = 4

// On phones this is a panel that slides over the map. On wider screens the
// CSS turns it into a normal side panel and the sliding does nothing.
function BottomSheet({
  snap,
  onSnapChange,
  label,
  header,
  pinned,
  children,
  className = '',
  bodyClassName = '',
  scrollResetKey,
  allowPageScrollAtEdges = false,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // The handle and title: the part that stays visible when collapsed
  const peekRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  const [offsets, setOffsets] = useState<SnapOffsets | null>(null)
  // Set only while a finger is dragging; otherwise the offset comes from `snap`
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const dragStart = useRef<{ pointerY: number; startOffset: number } | null>(null)
  const didDrag = useRef(false)

  // Measure before the browser paints, and again whenever a size changes
  // (rotating the phone, or the pinned part getting taller)
  useLayoutEffect(() => {
    const sheet = sheetRef.current
    const peek = peekRef.current
    const container = sheet?.parentElement
    if (!sheet || !peek || !container) return

    const measure = () => {
      setOffsets(snapOffsets(sheet.offsetHeight, container.clientHeight, peek.offsetHeight))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(sheet)
    observer.observe(peek)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // The body is the same element for every step, so the browser would keep its
  // scroll position. Someone who scrolled down to press "Continue" would
  // otherwise land at the bottom of the next step.
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [scrollResetKey])

  function offsetFromPointer(event: PointerEvent, currentOffsets: SnapOffsets): number {
    const start = dragStart.current
    if (!start) return currentOffsets[snap]
    return clampOffset(start.startOffset + (event.clientY - start.pointerY), currentOffsets)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!offsets) return
    const interactive = (event.target as HTMLElement).closest(INTERACTIVE)
    // The handle is a button, but it is the main place to grab the sheet
    if (interactive && !interactive.hasAttribute('data-sheet-handle')) return

    // Capture keeps the move events coming even when the finger leaves the header
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointerY: event.clientY, startOffset: offsets[snap] }
    didDrag.current = false
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || !offsets) return
    if (Math.abs(event.clientY - start.pointerY) > DRAG_THRESHOLD_PX) didDrag.current = true
    if (didDrag.current) setDragOffset(offsetFromPointer(event, offsets))
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !offsets) return
    if (didDrag.current) onSnapChange(nearestSnap(offsetFromPointer(event, offsets), offsets))
    dragStart.current = null
    setDragOffset(null)
  }

  // The handle works as a button too, for keyboard users and for people who
  // cannot drag. A click that ends a drag is not a real click.
  function handleHandleClick() {
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    onSnapChange(nextSnap(snap))
  }

  // Typing in the search field under a collapsed sheet would be invisible,
  // so focusing a text field opens the sheet
  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    if (snap === 'collapsed' && event.target.matches('input, textarea, select')) onSnapChange('half')
  }

  function handleBodyWheel(event: WheelEvent<HTMLDivElement>) {
    if (!allowPageScrollAtEdges || event.deltaY === 0) return

    const body = event.currentTarget
    const canScrollUp = body.scrollTop > 0
    const canScrollDown = body.scrollTop + body.clientHeight < body.scrollHeight
    const scrollingUp = event.deltaY < 0
    const panelCanScroll = scrollingUp ? canScrollUp : canScrollDown

    if (panelCanScroll) return

    const pageScrollTop = window.scrollY
    const pageCanScroll = scrollingUp
      ? pageScrollTop > 0
      : pageScrollTop + window.innerHeight < document.documentElement.scrollHeight

    if (pageCanScroll) {
      event.preventDefault()
      window.scrollBy({ top: event.deltaY, behavior: 'auto' })
    }
  }

  const offset = dragOffset ?? offsets?.[snap] ?? 0

  return (
    <>
      {/* Phone only: the strip of map above a fully open sheet. Tapping it
          collapses the sheet so the whole map is visible. Keyboard users
          have the handle button, hence aria-hidden. */}
      {snap === 'full' && (
        <div className={styles.backdrop} aria-hidden="true" onClick={() => onSnapChange('collapsed')} />
      )}
    <aside
      ref={sheetRef}
      aria-label={label}
      className={`${styles.sheet} ${dragOffset !== null ? styles.dragging : ''} ${className}`}
      style={{
        transform: `translateY(${offset}px)`,
        // How much of the sheet is pushed off screen when it settles. The body
        // adds this as bottom padding so its last row can be scrolled into view.
        // Deliberately not the live drag offset, which would re-layout every frame.
        '--sheet-offset': `${offsets?.[snap] ?? 0}px`,
      } as CSSProperties}
    >
      <div className={`decorativeDivider decorativeDivider--top ${styles.divider} `} />

      <div className={styles.top} onFocus={handleFocus}>
        <div
          ref={peekRef}
          className={styles.dragArea}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <button
            type="button"
            data-sheet-handle
            className={styles.handle}
            aria-label={`Resize ${label}`}
            aria-expanded={snap !== 'collapsed'}
            aria-controls={bodyId}
            onClick={handleHandleClick}
          >
            <span className={styles.handleBar} />
          </button>
          {header}
        </div>
        {pinned}
      </div>
      <div
        id={bodyId}
        ref={bodyRef}
        className={`${styles.body} ${bodyClassName}`}
        onWheel={handleBodyWheel}
      >
        {children}
      </div>
    </aside>
    </>
  )
}

export default BottomSheet
