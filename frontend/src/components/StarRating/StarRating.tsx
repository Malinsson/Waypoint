import { Star } from 'lucide-react'
import styles from './StarRating.module.css'

type StarRatingProps = {
  // What is being rated, used in the accessible name ("Rate Liseberg 3 out of 5")
  label: string
  value: number | undefined
  // undefined means the user cleared the rating. Not needed when readOnly.
  onChange?: (stars: number | undefined) => void
  disabled?: boolean
  // Only shows the rating. No buttons, so it can sit inside a link.
  readOnly?: boolean
}

const STARS = [1, 2, 3, 4, 5]

function StarRating({ label, value, onChange, disabled = false, readOnly = false }: StarRatingProps) {
  const filledClass = (stars: number) => (value !== undefined && stars <= value ? styles.filled : undefined)

  if (readOnly) {
    return (
      <div role="img" aria-label={`${label}: ${value ?? 0} out of 5`} className={styles.stars}>
        {STARS.map((stars) => (
          <Star key={stars} size={24} aria-hidden="true" className={filledClass(stars)} />
        ))}
      </div>
    )
  }

  return (
    <div role="group" aria-label={label} className={styles.stars}>
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
          onClick={() => onChange?.(stars === value ? undefined : stars)}
        >
          <Star size={24} aria-hidden="true" className={filledClass(stars)} />
        </button>
      ))}
      {/* Always in the page, so a change (including clearing) is announced */}
      <span role="status" className={styles.srOnly}>
        {value === undefined ? 'No rating' : `${value} out of 5`}
      </span>
    </div>
  )
}

export default StarRating
