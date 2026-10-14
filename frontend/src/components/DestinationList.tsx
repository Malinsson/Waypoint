import type { Destination } from '../types/api.ts'

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
      <ol className="destination-list">
        {destinations.map((destination, index) => (
          <li key={destination.id}>
            <span className="destination-name">
              <strong>{index + 1}.</strong> {destination.name}
            </span>
            <button
              type="button"
              onClick={() => onRemove(destination.id)}
              disabled={disabled}
              aria-label={`Remove ${destination.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <p className="hint">The first is your start and the last is your end.</p>
    </>
  )
}

export default DestinationList
