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
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <img src="/Icons/slogan.svg" alt="Waypoint slogan, Plan save Go" className={styles.heroSlogan} />
        </div>
        <img src="/Images/hero.webp" alt="A scenic road winding through mountains" className={styles.heroImage} />
      </section>

      <section className={`${styles.intro} mainSection`}>
        <h1>Welcome to Waypoint</h1>
        <p>
          Waypoint is a travel planning application that helps you organize your trips efficiently. With our intuitive interface, you can add destinations, optimize your route, and save your favorite locations for future reference. 
        </p>
        <p>
          Simply enter your desired destinations, and Waypoint will generate a comprehensive travel plan, including driving distances, estimated travel times and suggested accommodations. You can also save your trips and access them anytime, making it easy to plan your next adventure.
        </p>
        <p>
          Start planning your next adventure today!
        </p>


        <h2>Server status</h2>
        {state.kind === 'loading' && <p>Checking server…</p>}
        {state.kind === 'ok' && (
          <p>
            API: {state.health.status}, Database: {state.health.database}
          </p>
        )}
        {state.kind === 'error' && <p className={styles.error}>{state.message}</p>}
        
      </section>
    </>
  )
}

export default HomePage
