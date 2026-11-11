import styles from './Loader.module.css';

function Loader() {
    return (
        <div className={styles.loaderContainer} role="status" aria-label="Loading">
            <div className={styles.circle}>
                <img src="/Icons/map.svg" alt="" className={styles.map} />
            </div>
        </div>
    );
}

export default Loader;