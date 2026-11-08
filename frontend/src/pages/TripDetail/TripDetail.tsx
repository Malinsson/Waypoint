import { useEffect, useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { getTrip, deleteTrip, completeTrip } from '../../api/trips.ts';
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import type { TripDetailResponse } from '../../types/api.ts'
import { formatDistance, formatDuration } from '../../utils/format.ts'
import styles from './TripDetail.module.css'
import { Button } from '../../components/atoms/Button.tsx';
import ConfirmationPopup from '../../components/ConfirmationPopup/ConfiramtionPopup.tsx';


function TripsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripDetailResponse['trip'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

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
        location: [destination.locationId.longitude, destination.locationId.latitude] as [number, number],
        label: String(index + 1),
      })) .concat(
        trip?.breakpoints.flatMap((breakpoint, index) => {
          const place = breakpoint.accommodation?.find(({ id }) => id === breakpoint.selectedAccommodationId)
          if (!place || breakpoint.skipped) return []
          return [{
            id: `breakpoint-${index}-${place.id}`,
            location: [place.longitude, place.latitude] as [number, number],
            label: place.type[0]!.toUpperCase(),
            kind: 'accommodation' as const,
          }]
        }) ?? [],
      ) ?? [],
    [trip],
  )

  const routeCoordinates = trip?.route.geometry.coordinates ?? null
  const center = markers[0]?.location ?? [16.5, 62.5]


  function handleDeleteTrip() {
    if (!trip) return;
    deleteTrip(trip._id)
      .then(() => {
        return window.location.href = '/trips'; // Redirect to the trips list page after deletion
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Could not delete this trip.')
      });
  }

  function handleCompleteTrip() {
    if (!trip) return;
    completeTrip(trip._id, new Date())
      .then(() => getTrip(trip._id))
      .then((response) => {
        setTrip(response.trip);
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Could not mark this trip as completed.')
      });
  }

  return (
    <section className="mainSection">

      {showDeleteConfirmation && (
        <ConfirmationPopup
          message="Are you sure you want to delete this trip? This action cannot be undone."
          onConfirm={() => {
            handleDeleteTrip();
            setShowDeleteConfirmation(false);
          }}
          onCancel={() => setShowDeleteConfirmation(false)}
          isOpen={showDeleteConfirmation}
        />
      )}

      {loading && <p>Loading trip details...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {trip && (
        <>
          <h1>{trip.name}</h1>
          {trip.completedAt && <p className={styles.completed}>This trip was completed on {new Date(trip.completedAt).toLocaleString()}</p>}
          <div className={styles.row}>
            <p className={styles.details}>Created: {new Date(trip.createdAt).toLocaleString()}</p>
            <p className={styles.details}>Updated: {new Date(trip.updatedAt).toLocaleString()}</p>
            {trip.completedAt && <p className={styles.details}>Completed: {new Date(trip.completedAt).toLocaleString()}</p>}
          </div>

          <div className={styles.tripDetails}>
            <MapView center={center} zoom={5} markers={markers} route={routeCoordinates} />

            <article className={styles.tripInfo}>
              <h2>Route summary</h2>
              <p>{formatDistance(trip.route.distanceMeters)} · {formatDuration(trip.route.durationSeconds)} driving</p>
              <p>Maximum driving time: {trip.maxDrivingHours} hours</p>

              <h3>Destinations</h3>
              <ol>
                {trip.destinations.map((destination) => (
                  <li key={destination.locationId._id}>
                    {destination.locationId.name} {destination.locationId.description && `- ${destination.locationId.description}`}
                    {destination.description && ` - ${destination.description ?? ""}`}
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
                        {breakpoint.skipped
                          ? 'Stop skipped'
                          : breakpoint.accommodation?.find(({ id }) => id === breakpoint.selectedAccommodationId)?.name
                            ?? breakpoint.locationId?.name
                            ?? 'Suggested stop'}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3>Accommodation</h3>
              <p>{trip.accommodationPreference.types.join(', ')}</p>
            </article>
          </div>

          <div className={styles.actions}>
            <Button type="button">
              <NavLink to={`/trips/${trip._id}/edit`}>Edit trip</NavLink>
            </Button>
            {trip.completedAt ? (
              <Button type="button" disabled>Trip completed</Button>
            ) : (
              <Button type="button" onClick={handleCompleteTrip}>Mark as completed</Button>
            )}
            <Button type="button" variant="tertiary" onClick={() => setShowDeleteConfirmation(true)}>Delete trip</Button>
          </div>
        </>
      )}
    </section>
  )

}

export default TripsDetailPage;