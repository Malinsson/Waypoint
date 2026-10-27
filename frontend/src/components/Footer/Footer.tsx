import styles from './Footer.module.css'


function Footer() {
    return (
        <footer className={styles.footer}>
            <img src="/Icons/logo.svg" alt="Waypoint logo" className={styles.logo} />

            <ul className={styles.links}>
                <li>
                    <a href="/privacy">Privacy Policy</a>
                </li>
                <li>
                    <a href="/cookie">Cookie Policy</a>
                </li>
                <li>
                    <a href="/contact">Contact</a>
                </li>
            </ul>

            <p>
                &copy; 2026 Waypoint. All rights reserved.
            </p>
        </footer>
    )
}

export default Footer