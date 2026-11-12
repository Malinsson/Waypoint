import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { getTrip, deleteTrip, completeTrip, renameTrip, rateTrip, clearTripRating } from '../../api/trips.ts';
import MapView, { type MapMarker } from '../../components/MapView/MapView.tsx'
import RatingPopup from '../../components/RatingPopup/RatingPopup.tsx'
import StarRating from '../../components/StarRating/StarRating.tsx'
import type { RatingTarget, TripDetailResponse } from '../../types/api.ts'
import { formatDistance, formatDuration } from '../../utils/format.ts'
import styles from './TripDetail.module.css'
import { Button } from '../../components/atoms/Button.tsx';
import ConfirmationPopup from '../../components/ConfirmationPopup/ConfiramtionPopup.tsx';
import PopupBase from '../../components/PopupBase/PopupBase.tsx';
import { Pencil } from 'lucide-react';
import Loader from '../../components/atoms/Loader.tsx';
import BottomSheet from '../../components/BottomSheet/BottomSheet.tsx';
import SheetLayout from '../../components/BottomSheet/SheetLayout.tsx';
import type { SnapPoint } from '../../components/BottomSheet/snap.ts';


function TripsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripDetailResponse['trip'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRenamePopup, setShowRenamePopup] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showCompletedPopup, setShowCompletedPopup] = useState(false);
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const destinationsHeadingRef = useRef<HTMLHeadingElement>(null);
  // Phone layout: how far the details panel is slid up over the map
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>('half');

  // Stable identities: PopupBase re-focuses its first element whenever onCancel changes
  const closeCompletedPopup = useCallback(() => setShowCompletedPopup(false), []);
  const closeRatingPopup = useCallback(() => setShowRatingPopup(false), []);

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
    completeTrip(trip._id)
      .then(() => getTrip(trip._id))
      .then((response) => {
        setTrip(response.trip);
        setShowCompletedPopup(true);
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Could not mark this trip as completed.')
      });
  }

  // Saves or clears one rating, then reloads the trip because the backend
  // returns it without the populated locations. `stars` undefined clears it.
  async function handleRate(target: RatingTarget, stars: number | undefined, comment?: string): Promise<boolean> {
    if (!trip) return false;
    setSavingRating(true);
    try {
      if (stars === undefined) {
        await clearTripRating(trip._id, target);
      } else {
        await rateTrip(trip._id, target, stars, comment);
      }
      setTrip((await getTrip(trip._id)).trip);
      setError(null);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this rating.');
      return false;
    } finally {
      setSavingRating(false);
    }
  }

  function handleRateDestinations() {
    setShowCompletedPopup(false);
    setShowRatingPopup(true);
  }

  function handleRenameTrip(tripId: string, newName: string) {
    if (!newName) return;
    renameTrip(tripId, newName)
      .then(() => getTrip(tripId))
      .then((response) => {
        setTrip(response.trip);
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : 'Could not rename this trip.')
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

      {showRenamePopup && (
        <PopupBase
          onCancel={() => setShowRenamePopup(false)}
          isOpen={showRenamePopup}
        >
          <h2>Rename Trip</h2>
          <form className={styles.renameForm} onSubmit={(e) => { e.preventDefault(); handleRenameTrip(trip?._id || '', renameName); setShowRenamePopup(false); }}>
          <label htmlFor="newName">Enter a new name for the trip:</label>
          <input type="text" id="newName" placeholder="New name" className="decorativeBorder inputField" value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setShowRenamePopup(false)}>Cancel</Button>
              <Button type="submit">Rename</Button>
            </div>
          </form>
        </PopupBase>
        )}

      {showCompletedPopup && (
        <PopupBase onCancel={closeCompletedPopup} isOpen={showCompletedPopup}>
          <h2>Trip completed!</h2>
          <p>What a journey! We hope you had a wonderful trip and made memories worth keeping.</p>
          <p>Would you like to rate your trip? You can also do it later from this page.</p>
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={closeCompletedPopup}>Maybe later</Button>
            <Button type="button" onClick={handleRateDestinations}>Rate trip</Button>
          </div>
        </PopupBase>
      )}

      {showRatingPopup && trip && (
        <RatingPopup
          tripName={trip.name}
          initialStars={trip.totalRating?.stars}
          initialComment={trip.totalRating?.comment}
          saving={savingRating}
          onCancel={closeRatingPopup}
          onSave={(stars, comment) => {
            void handleRate({ target: 'trip' }, stars, comment).then((saved) => {
              if (saved) setShowRatingPopup(false);
            });
          }}
          onRemove={() => {
            void handleRate({ target: 'trip' }, undefined).then((saved) => {
              if (saved) setShowRatingPopup(false);
            });
          }}
        />
      )}

      {loading && <Loader />}
      {error && <p className="error" role="alert">{error}</p>}
      {trip && (
        <SheetLayout className={styles.tripDetails}>
          <MapView center={center} zoom={5} markers={markers} route={routeCoordinates} />

          <BottomSheet
            label="Trip details"
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            className={styles.tripInfo}
            header={
              <div className={styles.row}>
                <h1>{trip.name}</h1>
                {!trip.completedAt && (
                  <Button type="button" onClick={() => { setRenameName(trip.name); setShowRenamePopup(true); }}><Pencil size={16} /></Button>
                )}
              </div>
            }
          >
          {trip.totalRating && (
            <>
              <h2>Your rating</h2>

              <div className={styles.row}>
                <StarRating
                  label="Trip Rating"
                  value={trip.totalRating.stars}
                  disabled={savingRating}
                  onChange={(stars) => void handleRate({ target: 'trip' }, stars)}
                />
                <span>{trip.totalRating.stars}/5</span>
              </div>

              {trip.totalRating.comment && <p>{trip.totalRating.comment}</p>}
            </>
          )}


          <div className={styles.row}>
            <p className={styles.details}>Created: {new Date(trip.createdAt).toLocaleString()}</p>
            <p className={styles.details}>Updated: {new Date(trip.updatedAt).toLocaleString()}</p>
            {trip.completedAt && <p className={styles.details}>Completed: {new Date(trip.completedAt).toLocaleString()}</p>}
          </div>

              <h2>Route summary</h2>
              <p>{formatDistance(trip.route.distanceMeters)} · {formatDuration(trip.route.durationSeconds)} driving</p>
              <p>Maximum driving time: {trip.maxDrivingHours} hours</p>


              <h3 ref={destinationsHeadingRef} tabIndex={-1}>Destinations:</h3>
              <ol className={styles.destinationsList} aria-labelledby={destinationsHeadingRef.current?.id}>
                {trip.destinations.map((destination, index) => (
                  <li key={destination.locationId._id}>
                    {destination.locationId.name} {destination.locationId.description && `- ${destination.locationId.description}`}
                    {destination.description && ` - ${destination.description ?? ""}`}
                    {/* Ratings are only possible once the trip is completed */}
                    {trip.completedAt && (
                      <div className={styles.destinationRating}>
                        <StarRating
                          label={destination.locationId.name}
                          value={destination.rating?.stars}
                          disabled={savingRating}
                          onChange={(stars) => void handleRate({ target: 'destination', index }, stars)}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>

              {trip.breakpoints.length > 0 && (
                <>
                  <h3>Breakpoints:</h3>
                  <ol className={styles.destinationsList}>
                    {trip.breakpoints.map((breakpoint, index) => (
                      <li key={`${breakpoint.longitude}-${breakpoint.latitude}-${index}`}>
                        {breakpoint.skipped
                          ? 'Stop skipped'
                          : breakpoint.accommodation?.find(({ id }) => id === breakpoint.selectedAccommodationId)?.name
                            ?? breakpoint.locationId?.name
                            ?? 'Suggested stop'}
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <h3>Accommodation selections:</h3>
              <p>{trip.accommodationPreference.types.join(', ')}</p>

          <div className={styles.actions}>
            {trip.completedAt ? (
              <>
                <Button type="button" disabled>Trip completed</Button>
                <Button type="button" onClick={() => setShowRatingPopup(true)}>{trip.totalRating ? 'Edit rating' : 'Rate trip'}</Button>
              </>
            ) : (
            <>
              <Button type="button">
                <NavLink to={`/trips/${trip._id}/edit`}>Edit trip</NavLink>
              </Button>
              <Button type="button" onClick={handleCompleteTrip}>Mark as completed</Button>
            </>
            )}
            <Button type="button" variant="tertiary" onClick={() => setShowDeleteConfirmation(true)}>Delete trip</Button>
          </div>
          </BottomSheet>
        </SheetLayout>
      )}
    </section>
  )

}

export default TripsDetailPage;