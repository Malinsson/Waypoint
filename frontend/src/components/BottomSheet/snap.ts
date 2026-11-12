export type SnapPoint = 'collapsed' | 'half' | 'full'

// How much of the map area the sheet covers when it is "half" open
const HALF_COVERAGE = 0.5

// Offsets are in pixels and measure how far the sheet is pushed DOWN from its
// fully open position. 0 means fully open; larger means lower on the screen.
export type SnapOffsets = Record<SnapPoint, number>

// sheetHeight: height of the whole sheet
// containerHeight: height of the area the sheet slides inside (the map area)
// peekHeight: the part that must stay visible when collapsed (the handle and title)
export function snapOffsets(sheetHeight: number, containerHeight: number, peekHeight: number): SnapOffsets {
  const collapsed = Math.max(sheetHeight - peekHeight, 0)
  // Half is never lower than collapsed, otherwise a tall header would make
  // "half" hide more than "collapsed"
  const half = Math.min(Math.max(sheetHeight - containerHeight * HALF_COVERAGE, 0), collapsed)
  return { collapsed, half, full: 0 }
}

// After a drag ends the sheet settles on the snap point closest to where it was released
export function nearestSnap(offset: number, offsets: SnapOffsets): SnapPoint {
  const points = Object.keys(offsets) as SnapPoint[]
  let best: SnapPoint = 'full'
  let bestDistance = Infinity
  for (const point of points) {
    const distance = Math.abs(offsets[point] - offset)
    if (distance < bestDistance) {
      best = point
      bestDistance = distance
    }
  }
  return best
}

// The handle button (no dragging needed) steps through the positions in a loop
export function nextSnap(current: SnapPoint): SnapPoint {
  if (current === 'collapsed') return 'half'
  if (current === 'half') return 'full'
  return 'collapsed'
}

// Keeps a dragged offset between fully open and fully collapsed
export function clampOffset(offset: number, offsets: SnapOffsets): number {
  return Math.min(Math.max(offset, offsets.full), offsets.collapsed)
}
