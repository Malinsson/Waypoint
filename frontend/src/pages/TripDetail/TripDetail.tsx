import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTrip } from '../../api/trips.ts';
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import type { TripDetailResponse } from '../../types/api.ts'
import { formatDistance, formatDuration } from '../../utils/format.ts'


function TripsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripDetailResponse['trip'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!id) {
      setError('Trip ID is missing')
      setLoading(false)
      return
    }
    setLoading(true)
    getTrip(id)
      .then((response) => {
        setTrip(response.trip)
        setError(null)
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Could not load this trip.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const markers = useMemo<MapMarker[]>(
    () =>
      trip?.destinations.map((destination, index) => ({
        id: destination.locationId._id,
        location: [destination.locationId.longitude, destination.locationId.latitude],
        label: String(index + 1),
      })) ?? [],
    [trip],
  )

  const routeCoordinates = trip?.route.geometry.coordinates ?? null
  const center = markers[0]?.location ?? [16.5, 62.5]

  return (
    <div>
      <p><Link to="/trips">Back to saved trips</Link></p>
      <h1>Trip details</h1>
      {loading && <p>Loading trip details...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {trip && (
        <>
          <h2>{trip.name}</h2>
          <p>Created: {new Date(trip.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(trip.updatedAt).toLocaleString()}</p>
          {trip.completedAt && <p>Completed: {new Date(trip.completedAt).toLocaleString()}</p>}

          <MapView center={center} zoom={5} markers={markers} route={routeCoordinates} />

          <h3>Route summary</h3>
          <p>{formatDistance(trip.route.distanceMeters)} · {formatDuration(trip.route.durationSeconds)} driving</p>
          <p>Maximum driving time: {trip.maxDrivingHours} hours</p>

          <h3>Destinations</h3>
          <ol>
            {trip.destinations.map((destination) => (
              <li key={destination.locationId._id}>
                {destination.locationId.name}
                {destination.rating && ` — Rated ${destination.rating.stars}/5`}
              </li>
            ))}
          </ol>

          {trip.breakpoints.length > 0 && (
            <>
              <h3>Breakpoints</h3>
              <ul>
                {trip.breakpoints.map((breakpoint, index) => (
                  <li key={`${breakpoint.longitude}-${breakpoint.latitude}-${index}`}>
                    {breakpoint.locationId?.name ?? 'Suggested stop'} ({breakpoint.latitude}, {breakpoint.longitude})
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Accommodation</h3>
          <p>{trip.accommodationPreference.types.join(', ')}</p>
        </>
      )}
    </div>
  )
}

export default TripsDetailPage;