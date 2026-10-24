import styles from './FavoriteButton.module.css'
import { Heart } from 'lucide-react'

type FavoriteButtonProps = {
  onClick: () => void
}

function FavoriteButton({ onClick }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      aria-label="Add location to favorites"
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={styles.favoriteButton}
    >
      <Heart aria-hidden="true" />
    </button>
  )
}

export default FavoriteButton