import { describe, expect, it } from 'vitest'
import type { Destination } from '../types/api.ts'
import { maxSpreadKm, optimizeRoute } from './trips.ts'

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

  it('does not optimize when stops are too far apart', () => {
    // Malmo at the end is roughly 1100 km from Kiruna
    const far: Destination[] = [
      ...destinations.slice(0, 3),
      { id: '5', name: 'Kiruna', location: [20.2, 67.85], description: undefined },
    ]
    expect(optimizeRoute(far)).toBe(false)
  })

  it('measures known distances correctly', () => {
    // Stockholm to Gothenburg is about 400 km in a straight line
    const km = maxSpreadKm([
      { id: '1', name: 'Stockholm', location: [18.07, 59.33], description: undefined },
      { id: '2', name: 'Gothenburg', location: [11.97, 57.71], description: undefined },
    ])
    expect(km).toBeGreaterThan(380)
    expect(km).toBeLessThan(420)
  })

  it('does not optimize a manually reordered trip', () => {
    expect(optimizeRoute(destinations, true)).toBe(false)
  })
})
