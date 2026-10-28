import type { Destination } from '../../types/api.ts'
import { Button } from '../atoms/Button.tsx'
import styles from './DestinationList.module.css'

type DestinationListProps = {
  destinations: Destination[]
  onRemove: (id: string) => void
  disabled: boolean
}

function DestinationList({ destinations, onRemove, disabled }: DestinationListProps) {
  if (destinations.length === 0) {
    return <p className="hint">Add at least two destinations to plan your trip.</p>
  }

  return (
    <>
      {/* The number is written out (not left to <ol>) so it is always
          visible and clearly matches the number on the map marker */}
      <ol className={styles.destinationList}>
        {destinations.map((destination, index) => (
          <li key={destination.id}>
            <span className="destination-name">
              <strong>{index + 1}.</strong> {destination.name} {destination.description && <span className="destination-description"> - {destination.description}</span>}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onRemove(destination.id)}
              disabled={disabled}
              aria-label={`Remove ${destination.name}`}
            >
              Remove
            </Button>
            <div className="decorativeDivider decorativeDivider--bottom"></div>
          </li>
        ))}
      </ol>
      <p className="hint">The first is your start and the last is your end.</p>
    </>
  )
}

export default DestinationList
