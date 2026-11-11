import styles from './Logo.module.css';

function Logo() {
  return (
    <div className={styles.logo} aria-label="Waypoint logo" onClick={() => window.location.href = '/'} role="button" tabIndex={0}>
        <img src="/Icons/logo.svg" alt="" aria-hidden="true" className={`${styles.icon} ${styles.iconLight}`} />
        <img src="/Icons/logo-dark.svg" alt="" aria-hidden="true" className={`${styles.icon} ${styles.iconDark}`} />
    </div>
  );
}

export default Logo;