import { describe, expect, it } from 'vitest'
import { clampOffset, nearestSnap, nextSnap, snapOffsets } from './snap.ts'

// A 600px sheet inside a 700px map area, with 100px that must stay visible
const offsets = snapOffsets(600, 700, 100)

describe('snapOffsets', () => {
  it('puts full at 0, half so that half the map is covered, and collapsed so only the peek shows', () => {
    expect(offsets).toEqual({ full: 0, half: 250, collapsed: 500 })
  })

  it('never lets half sit lower than collapsed when the peek is very tall', () => {
    const tall = snapOffsets(600, 700, 450)
    expect(tall.half).toBeLessThanOrEqual(tall.collapsed)
  })

  it('never returns negative offsets when the sheet is shorter than the map', () => {
    const short = snapOffsets(200, 700, 100)
    expect(short.half).toBe(0)
    expect(short.full).toBe(0)
  })
})

describe('nearestSnap', () => {
  it('picks the snap point closest to the release position', () => {
    expect(nearestSnap(20, offsets)).toBe('full')
    expect(nearestSnap(200, offsets)).toBe('half')
    expect(nearestSnap(480, offsets)).toBe('collapsed')
  })

  it('still settles on a real snap point when released exactly between two of them', () => {
    expect(['full', 'half']).toContain(nearestSnap(125, offsets))
  })
})

describe('nextSnap', () => {
  it('cycles collapsed -> half -> full -> collapsed', () => {
    expect(nextSnap('collapsed')).toBe('half')
    expect(nextSnap('half')).toBe('full')
    expect(nextSnap('full')).toBe('collapsed')
  })
})

describe('clampOffset', () => {
  it('stops the sheet from being dragged past fully open or fully collapsed', () => {
    expect(clampOffset(-50, offsets)).toBe(0)
    expect(clampOffset(900, offsets)).toBe(500)
    expect(clampOffset(300, offsets)).toBe(300)
  })
})
