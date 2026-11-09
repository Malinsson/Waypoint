import { useState } from 'react'
import { Button } from '../atoms/Button.tsx'
import PopupBase from '../PopupBase/PopupBase.tsx'
import StarRating from '../StarRating/StarRating.tsx'
import styles from './RatingPopup.module.css'

const MAX_COMMENT_LENGTH = 1000

type RatingPopupProps = {
  tripName: string
  // The rating already saved, if any
  initialStars: number | undefined
  initialComment: string | undefined
  saving: boolean
  onSave: (stars: number, comment: string) => void
  onRemove: () => void
  // Keep this stable (useCallback): PopupBase re-focuses when it changes
  onCancel: () => void
}

// Holds the draft in its own state, so typing a comment does not re-render
// the whole trip page
function RatingPopup({ tripName, initialStars, initialComment, saving, onSave, onRemove, onCancel }: RatingPopupProps) {
  const [stars, setStars] = useState(initialStars)
  const [comment, setComment] = useState(initialComment ?? '')

  return (
    <PopupBase isOpen onCancel={onCancel}>
      <h2>Rate your trip</h2>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (stars !== undefined) onSave(stars, comment.trim())
        }}
      >
        <p>How was {tripName}?</p>
        <StarRating label="this trip" value={stars} onChange={setStars} disabled={saving} />

        <label htmlFor="tripComment">Comment (optional)</label>
        <textarea
          id="tripComment"
          className={`decorativeBorder ${styles.comment}`}
          maxLength={MAX_COMMENT_LENGTH}
          value={comment}
          disabled={saving}
          onChange={(event) => setComment(event.target.value)}
        />

        <div className={styles.actions}>
          {initialStars !== undefined && (
            <Button type="button" variant="tertiary" disabled={saving} onClick={onRemove}>Remove rating</Button>
          )}
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={stars === undefined || saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </form>
    </PopupBase>
  )
}

export default RatingPopup
