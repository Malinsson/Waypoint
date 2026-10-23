import styles from './FavoriteButton.module.css'
import type { FavoriteLocation, Suggestion } from '../../../types/api.ts'


function FavoriteButton({ location }: { location: Suggestion }) {

    function handleFavoriteClick() {

    }

    return (
        <button 
        type="button"
        onClick={handleFavoriteClick}
        className={styles.favoriteButton}
        >
            <span className={styles.favoriteIcon}>★</span>
            Favorite
        </button>
    );
}

export default FavoriteButton;