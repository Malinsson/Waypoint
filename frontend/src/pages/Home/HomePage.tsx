import { useEffect } from 'react'
import { getHealth } from '../../api/health.ts'
import styles from './HomePage.module.css'
import { NavLink } from 'react-router-dom'


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
          <NavLink to="/plan" className={`decorativeBorder ${styles.planButton}`}>Plan your trip</NavLink>
        </div>
        <img src="/Images/hero.webp" alt="A scenic road winding through mountains" className={styles.heroImage} />
        <div className="decorativeDivider decorativeDivider--bottom" aria-hidden="true" />
      </section>

      <section className={`mainSection`} aria-labelledby="intro-heading">
        <div className={`decorativeBorder ${styles.intro} `}>
          <div className={styles.introHeading}>
            <h1 id="intro-heading">Welcome to Waypoint</h1>
            <span className={styles.introAccent} aria-hidden="true" />
          </div>
          <p>
            Waypoint is a travel planning application that helps you organize your trips efficiently. With our intuitive interface, you can add destinations, optimize your route, and save your favorite locations for future reference. 
          </p>
          <p>
            Simply enter your desired destinations, and Waypoint will generate a comprehensive travel plan, including driving distances, estimated travel times and suggested accommodations. You can also save your trips and access them anytime, making it easy to plan your next adventure.
          </p>
          <p>
            Start planning your next adventure today!
          </p>
        </div>
      </section>

      <section className={styles.features} aria-labelledby="features-heading">
        <div className={styles.sectionHeading}>
          <h2 id="features-heading">Plan the journey, not just the destination</h2>
        </div>

        <div className={styles.featureGrid}>
          <article className={`decorativeBorder ${styles.featureCard} ${styles.featureCardRoute}`}>
            <span className={styles.featureNumber}>01</span>
            <h3>Connect every stop</h3>
            <p>Add several destinations and get one clear route instead of piecing together separate directions.</p>
          </article>

          <article className={`decorativeBorder ${styles.featureCard} ${styles.featureCardBreak}`}>
            <span className={styles.featureNumber}>02</span>
            <h3>Take smarter breaks</h3>
            <p>Set your driving limit and Waypoint suggests where to pause before the road starts feeling too long.</p>
          </article>

          <article className={`decorativeBorder ${styles.featureCard} ${styles.featureCardSave}`}>
            <span className={styles.featureNumber}>03</span>
            <h3>Keep the good places</h3>
            <p>Save trips and favorite stops when you find a route you want to remember for the next adventure.</p>
          </article>
        </div>

        <div className={`decorativeBorder ${styles.routeStory}`}>
          <div className={styles.routeStoryText}>
            <h2>From “where should we stop?” to “let’s go.”</h2>
            <p>Waypoint turns a long drive into a sequence of manageable moments, with the route and rest stops planned together.</p>
            <a href="/plan" className={`decorativeBorder ${styles.planLink}`}>Plan your trip <span aria-hidden="true">→</span></a>
          </div>

          <div className={styles.routeGraphic} aria-label="A route from departure to destination with a suggested break">
            <div className={styles.routeLine} />
            <div className={`${styles.routePoint} ${styles.routeStart}`}>
              <span />
              <strong>Start</strong>
            </div>
            <div className={`${styles.routePoint} ${styles.routeBreak}`}>
              <span />
              <strong>Break</strong>
            </div>
            <div className={`${styles.routePoint} ${styles.routeEnd}`}>
              <span />
              <strong>Arrive</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default HomePage
