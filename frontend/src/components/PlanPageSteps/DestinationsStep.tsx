import AddDestinationForm from '../AddDestinationForm/AddDestinationForm.tsx'
import DestinationList from '../DestinationList/DestinationList.tsx'
import LocateMe from '../LocateMe/LocateMe.tsx'
import { Button } from '../atoms/Button.tsx'
import type { Destination, GeocodeResult } from '../../types/api.ts'
import styles from '../../pages/Plan/PlanPage.module.css'

type DestinationsStepProps = {
  destinations: Destination[]
  canAddMore: boolean
  planning: boolean
  resetCount: number
  duplicateDestinationError: string | null
  roundTrip: boolean
  unreachableIds: string[]
  onAdd: (result: GeocodeResult) => void
  onRemove: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onRoundTripChange: (enabled: boolean) => void
  onStartOver: () => void
  onContinue: () => void
}

function DestinationsStep({
  destinations,
  canAddMore,
  planning,
  resetCount,
  duplicateDestinationError,
  roundTrip,
  unreachableIds,
  onAdd,
  onRemove,
  onReorder,
  onRoundTripChange,
  onStartOver,
  onContinue,
}: DestinationsStepProps) {

  return (
    <>
      <div className={styles.planContent}>
        <AddDestinationForm
          key={resetCount}
          onAdd={onAdd}
          disabled={!canAddMore || planning}
          biasLocation={destinations.at(-1)?.location}
        />
        {duplicateDestinationError && (
          <p className="error" role="alert">
            {duplicateDestinationError}
          </p>
        )}
        {!canAddMore && <p className="hint">You can add at most 10 destinations.</p>}

        {destinations.length === 0 && <LocateMe onLocate={(location) => onAdd({ label: 'Current Location', location: [location[0], location[1]], description: 'Your current location', kind: 'address' })} />}


        <DestinationList
          destinations={destinations}
          onRemove={onRemove}
          onReorder={onReorder}
          roundTrip={roundTrip}
          unreachableIds={unreachableIds}
          onRoundTripChange={onRoundTripChange}
          disabled={planning}
        />
      </div>
      <div className={styles.planActions}>
        <Button type="button" variant="tertiary" onClick={onStartOver} disabled={planning || destinations.length === 0}>
          Start over
        </Button>
        <Button type="button" onClick={onContinue} disabled={destinations.length < 2 || planning}>
          Continue
        </Button>
      </div>
    </>
  )
}

export default DestinationsStep
