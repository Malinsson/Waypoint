import { useState } from 'react'
import { Locate } from 'lucide-react'
import { Button } from '../atoms/Button.tsx'
import styles from './LocateMe.module.css'

type LocateMeProps = {
  onLocate?: (location: [number, number]) => void
  onError?: (error: GeolocationPositionError) => void
  onSuccess?: (position: GeolocationPosition) => void
}

function LocateMe({ onLocate, onError, onSuccess }: LocateMeProps) {
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  function getErrorMessage(error: GeolocationPositionError) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location access was blocked. Allow location access in your browser site settings, then try again. You can also enter a starting address manually.'
      case error.POSITION_UNAVAILABLE:
        return 'Your location could not be determined. Check that location services are enabled, or enter a starting address manually.'
      case error.TIMEOUT:
        return 'The location request took too long. Try again, or enter a starting address manually.'
      default:
        return 'We could not get your location. You can enter a starting address manually.'
    }
  }

  function locateMe() {
    setMessage(null)

    if (!window.isSecureContext) {
      setStatus('error')
      setMessage('Location access requires a secure connection (HTTPS). You can enter a starting address manually.')
      return
    }

    if (!('geolocation' in navigator)) {
      setStatus('error')
      setMessage('This browser does not support location access. You can enter a starting address manually.')
      return
    }

    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: [number, number] = [position.coords.longitude, position.coords.latitude]
        setLocation(nextLocation)
        setStatus('success')
        onLocate?.(nextLocation)
        onSuccess?.(position)
      },
      (error) => {
        setStatus('error')
        setMessage(getErrorMessage(error))
        onError?.(error)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  return (
    <section className={styles.locateMe} aria-label="Use current location">
      <Button type="button" onClick={locateMe} disabled={status === 'loading'}>
        <Locate aria-hidden="true" /> <span>{status === 'loading' ? 'Finding your location…' : 'Use my location as starting point'}</span>
      </Button>
      {status === 'success' && location && (
        <p className="hint" role="status">
          Current location: {location[0].toFixed(6)}, {location[1].toFixed(6)}
        </p>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </section>
  )
}

export default LocateMe