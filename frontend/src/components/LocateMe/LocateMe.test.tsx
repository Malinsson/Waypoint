import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LocateMe from './LocateMe.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LocateMe', () => {
  it('adds the browser location after the user accepts the request', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    const position: GeolocationPosition = {
      coords: {
        longitude: 18.0686,
        latitude: 59.3293,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    }
    const getCurrentPosition = vi.fn((success: PositionCallback) => success(position))
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    const onLocate = vi.fn()

    render(<LocateMe onLocate={onLocate} />)
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }))

    expect(onLocate).toHaveBeenCalledWith([18.0686, 59.3293])
    expect(screen.getByRole('status').textContent).toContain('18.068600, 59.329300')
  })

  it('explains how to recover when location access is denied', () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    const error = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, failure: PositionErrorCallback) => failure(error),
    )
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })

    render(<LocateMe />)
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/allow location access in your browser site settings/i)
    expect(screen.getByRole('alert').textContent).toMatch(/enter a starting address manually/i)
  })
})
