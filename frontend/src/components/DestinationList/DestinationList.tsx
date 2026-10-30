import { useState, type DragEvent } from 'react'
import type { Destination } from '../../types/api.ts'
import { Button } from '../atoms/Button.tsx'
import styles from './DestinationList.module.css'

type DestinationListProps = {
  destinations: Destination[]
  onRemove: (id: string) => void
  onReorder: (ids: string[]) => void
  roundTrip: boolean
  onRoundTripChange: (enabled: boolean) => void
  disabled: boolean
}

function DestinationList({ destinations, onRemove, onReorder, roundTrip, onRoundTripChange, disabled }: DestinationListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (destinations.length === 0) {
    return <p className="hint">Add at least two destinations to plan your trip.</p>
  }

  function isReturnDestination(destination: Destination) {
    return destination.id.endsWith('-return')
  }

  function move(destinationId: string, offset: -1 | 1) {
    const index = destinations.findIndex((destination) => destination.id === destinationId)
    const nextIndex = index + offset
    if (index < 0 || nextIndex < 0 || nextIndex >= destinations.length) return

    const ids = destinations.map((destination) => destination.id)
    const [movedId] = ids.splice(index, 1)
    ids.splice(nextIndex, 0, movedId!)
    onReorder(ids)
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, id: string) {
    setDraggedId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, index: number) {
    if (!draggedId || draggedId === destinations[index]?.id || isReturnDestination(destinations[index]!)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  function handleDrop(event: DragEvent<HTMLLIElement>) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || draggedId
    if (!id || dropIndex === null) return

    const ids = destinations.map((destination) => destination.id)
    const fromIndex = ids.indexOf(id)
    if (fromIndex < 0 || fromIndex === dropIndex) return
    const [movedId] = ids.splice(fromIndex, 1)
    const targetIndex = fromIndex < dropIndex ? dropIndex - 1 : dropIndex
    ids.splice(targetIndex, 0, movedId!)
    onReorder(ids)
    setDraggedId(null)
    setDropIndex(null)
  }

  function clearDrag() {
    setDraggedId(null)
    setDropIndex(null)
  }

  return (
    <>
      {/* The number is written out (not left to <ol>) so it is always
          visible and clearly matches the number on the map marker */}
      <ol className={styles.destinationList}>
        {destinations.map((destination, index) => {
          const isReturn = isReturnDestination(destination)
          const isDragging = draggedId === destination.id
          const isDropTarget = dropIndex === index && !isDragging

          return (
          <li
            key={destination.id}
            className={`${isDragging ? styles.dragging : ''} ${isDropTarget ? styles.dropTarget : ''}`}
            draggable={!disabled && !isReturn}
            onDragStart={(event) => handleDragStart(event, destination.id)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={handleDrop}
            onDragEnd={clearDrag}
          >
            <span className={styles.dragHandle} aria-hidden="true">⠿</span>
            <span className="destination-name">
              <strong>{index + 1}.</strong> {destination.name} {destination.description && <span className="destination-description"> - {destination.description}</span>}
            </span>
            {!isReturn && (
              <span className={styles.moveButtons}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => move(destination.id, -1)}
                  disabled={disabled || index === 0}
                  aria-label={`Move ${destination.name} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => move(destination.id, 1)}
                  disabled={disabled || index === destinations.length - 1}
                  aria-label={`Move ${destination.name} down`}
                >
                  ↓
                </Button>
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onRemove(destination.id)}
              disabled={disabled || destinations.length < 2 || isReturn}
              aria-label={`Remove ${destination.name}`}
            >
              Remove
            </Button>
            <div className="decorativeDivider decorativeDivider--bottom"></div>
          </li>
          )
        })}
      </ol>
      <Button
        type="button"
        variant={roundTrip ? "secondary" : "primary"}
        disabled={disabled}
        onClick={() => onRoundTripChange(!roundTrip)}
      >
        {roundTrip ? 'Disable round trip' : 'Enable round trip (start and end at the same location)'}
      </Button>
      <p className="hint">{roundTrip ? 'Your trip will start and end at the same location.' : 'Your trip will start at the first destination and end at the last.'}</p>
    </>
  )
}

export default DestinationList
