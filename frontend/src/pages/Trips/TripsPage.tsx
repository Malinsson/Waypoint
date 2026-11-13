
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom'
import { listTrips } from '../../api/trips.ts'
import type { SaveTripResponse } from '../../types/api.ts';
import styles from './TripsPage.module.css';
import { ChevronRight } from 'lucide-react';
import StarRating from '../../components/StarRating/StarRating.tsx';
import Loader from '../../components/atoms/Loader.tsx';
import { Button } from '../../components/atoms/Button.tsx';

function TripsPage() {

    const [trips, setTrips] = useState<SaveTripResponse['trip'][]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Loads one page and appends it. The first call (page 1) runs on mount.
    function loadPage(pageToLoad: number) {
      setLoading(true);
      listTrips(pageToLoad).then((response) => {
        // A trip saved in another tab shifts the pages, so skip ones we already have
        setTrips((current) => {
          const known = new Set(current.map((trip) => trip._id));
          return [...current, ...response.trips.filter((trip) => !known.has(trip._id))];
        });
        setPage(response.page);
        setHasMore(response.hasMore);
        setLoading(false);
        setError(null);
      }).catch((error) => {
        setLoading(false);
        setError(error.message);
      });
    }

    useEffect(() => {
      loadPage(1);
    }, []);

  return (
    <section className="mainSection">
        <h1>Saved Trips</h1>

        <ul className={styles.tripList}>
          {trips.length == 0 ? (!loading && <li>No trips found</li>) :
          (trips.map((trip) => (
            <li 
            key={trip._id} 
            className={`decorativeBorder ${styles.tripItem}`}>
                <NavLink to={`/trips/${trip._id}`}>

                  <h2>{trip.name}</h2>
                  {trip.totalRating && (
                    <div className={styles.row}>
                      <StarRating
                      label="Trip Rating"
                      value={trip.totalRating.stars}
                      onChange={() => {}}
                      />
                      <p>{trip.totalRating.stars}/5</p>
                    </div>
                      

                  )}
                  <p>Destinations in trip: {trip.destinations.length}</p>

                  {trip.completedAt !== undefined ? (
                    <p className={styles.completed}>
                      Completed on: {new Date(trip.completedAt).toLocaleString()}
                    </p>
                  ) : (
                    <p>Created at: {new Date(trip.createdAt).toLocaleString()}</p>
                  )}
                  
                  <span>
                    View trip
                    <ChevronRight className={styles.chevron} />
                  </span>
                </NavLink>
            </li>
          )))} 
        </ul>

        {hasMore && !loading && (
          <Button variant="secondary" onClick={() => loadPage(page + 1)}>Load more</Button>
        )}

        {loading && <Loader />}
        {error && <p className="error" role="alert">{error}</p>}
    </section>
  );        
}

export default TripsPage;