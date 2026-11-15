import { Link } from 'react-router-dom';
import styles from './Logo.module.css';

function Logo() {
  return (
    // A real link: Enter works, it can be opened in a new tab, and the page
    // does not reload
    <Link to="/" className={styles.logo} aria-label="Waypoint, go to start page">
        <img src="/Icons/logo.svg" alt="" aria-hidden="true" className={`${styles.icon} ${styles.iconLight}`} />
        <img src="/Icons/logo-dark.svg" alt="" aria-hidden="true" className={`${styles.icon} ${styles.iconDark}`} />
    </Link>
  );
}

export default Logo;