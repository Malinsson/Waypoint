import { Star } from 'lucide-react'
import styles from './StarRating.module.css'

type StarRatingProps = {
  // What is being rated, used in the accessible name ("Rate Liseberg 3 out of 5")
  label: string
  value: number | undefined
  // undefined means the user cleared the rating
  onChange: (stars: number | undefined) => void
  disabled?: boolean
}

const STARS = [1, 2, 3, 4, 5]

function StarRating({ label, value, onChange, disabled = false }: StarRatingProps) {
  return (
    <div role="group" aria-label={`Rating for ${label}`} className={styles.stars}>
      {STARS.map((stars) => (
        <button
          key={stars}
          type="button"
          className={styles.star}
          disabled={disabled}
          aria-label={`Rate ${label} ${stars} out of 5`}
          // Pressed stars are the ones that are filled in
          aria-pressed={value !== undefined && stars <= value}
          // Clicking the current value again clears the rating
          onClick={() => onChange(stars === value ? undefined : stars)}
        >
          <Star
            size={24}
            aria-hidden="true"
            className={value !== undefined && stars <= value ? styles.filled : undefined}
          />
        </button>
      ))}
    </div>
  )
}

export default StarRating
