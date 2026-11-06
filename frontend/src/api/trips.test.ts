import { describe, expect, it } from 'vitest'
import type { Destination } from '../types/api.ts'
import { optimizeRoute } from './trips.ts'

const destinations: Destination[] = [
  { id: '1', name: 'Start', location: [18, 59], description: undefined },
  { id: '2', name: 'Stop', location: [17, 58], description: undefined },
  { id: '3', name: 'Stop', location: [17, 60], description: undefined },
  { id: '4', name: 'End', location: [16, 57], description: undefined },
]

describe('optimizeRoute', () => {
  it('optimizes trips with at least four destinations by default', () => {
    expect(optimizeRoute(destinations)).toBe(true)
  })

  it('does not optimize exactly three destinations', () => {
    expect(optimizeRoute(destinations.slice(0, 3))).toBe(false)
  })

  it('does not optimize fewer than four destinations', () => {
    expect(optimizeRoute(destinations.slice(0, 2))).toBe(false)
  })

  it('does not optimize a manually reordered trip', () => {
    expect(optimizeRoute(destinations, true)).toBe(false)
  })
})
