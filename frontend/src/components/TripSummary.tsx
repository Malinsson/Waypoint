import type { PlanResponse } from '../types/api.ts'
import { formatDistance, formatDuration } from '../utils/format.ts'

type TripSummaryProps = {
  plan: PlanResponse
}

function TripSummary({ plan }: TripSummaryProps) {
  const { route, destinations } = plan

  return (
    <section className="trip-summary">
      <h2>Your trip</h2>
      <p>
        <strong>
          {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)} driving
        </strong>
      </p>
      <ul className="leg-list">
        {route.legs.map((leg) => {
          // fromIndex/toIndex are positions in plan.destinations
          const from = destinations[leg.fromIndex]
          const to = destinations[leg.toIndex]
          return (
            <li key={leg.fromIndex}>
              {leg.fromIndex + 1}. {from?.name} → {leg.toIndex + 1}. {to?.name}
              <br />
              {formatDistance(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default TripSummary
