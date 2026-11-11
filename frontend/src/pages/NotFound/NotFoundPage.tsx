import styles from './NotFoundPage.module.css';

function NotFoundPage() {
  return (
    <section className="mainSection" aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <img src="/Icons/car-dark.svg" alt="Car icon" className={`${styles.carIcon} ${styles.dark}`} />
      <img src="/Icons/car-light.svg" alt="Car icon" className={`${styles.carIcon} ${styles.light}`} />
    </section>
  );
}

export default NotFoundPage;