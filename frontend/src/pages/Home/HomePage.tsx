import { useEffect } from 'react'
import { getHealth } from '../../api/health.ts'
import styles from './HomePage.module.css'


function HomePage() {

  // Silent call to the health endpoint to wake up the backend server if it's asleep
  useEffect(() => {
    getHealth().catch(() => undefined)
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

        
      </section>
    </>
  )
}

export default HomePage
