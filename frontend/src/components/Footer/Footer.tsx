import { Link } from 'react-router-dom'
import styles from './Footer.module.css'


function Footer() {
    return (
        <footer className={styles.footer}>
            <div className='decorativeDivider decorativeDivider--top'></div>

            <div className={styles.socialLinks}>

                <img src="/Icons/logo.svg" alt="Waypoint logo" className={`${styles.logo} ${styles.logoLight}`} />
                <img src="/Icons/logo-dark.svg" alt="Waypoint logo" className={`${styles.logo} ${styles.logoDark}`} />
                
                <ul className={styles.links}>
                    <li>
                        <Link to="/privacy">Privacy Policy</Link>
                    </li>
                    <li>
                        <a href="/contact">Contact</a>
                    </li>
                </ul>
            </div>

            <p>
                &copy; 2026 Waypoint. All rights reserved.
            </p>
    </footer>
    )
}

export default Footer