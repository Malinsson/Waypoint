import { useEffect, useState } from 'react'
import { getHealth } from '../../api/health.ts'
import type { HealthResponse } from '../../types/api.ts'
import styles from './HomePage.module.css'

// One state value instead of separate loading/data/error flags,
// so impossible combinations (e.g. loading and error at once) cannot happen
type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; health: HealthResponse }
  | { kind: 'error'; message: string }

function HomePage() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' })

  useEffect(() => {
    // Set to true on cleanup so a response arriving after the component
    // unmounts (or after StrictMode's extra dev run) does not update state
    let ignore = false

    getHealth()
      .then((health) => {
        if (!ignore) setState({ kind: 'ok', health })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (!ignore) setState({ kind: 'error', message })
      })

    return () => {
      ignore = true
    }
  }, [])

  return (
    <>
      <h1>Waypoint</h1>
      <h2>Server status</h2>
      {state.kind === 'loading' && <p>Checking server…</p>}
      {state.kind === 'ok' && (
        <p>
          API: {state.health.status}, Database: {state.health.database}
        </p>
      )}
      {state.kind === 'error' && <p className={styles.error}>{state.message}</p>}
    </>
  )
}

export default HomePage
