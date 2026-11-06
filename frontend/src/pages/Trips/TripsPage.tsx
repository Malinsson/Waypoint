
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom'
import { listTrips } from '../../api/trips.ts'
import type { SaveTripResponse } from '../../types/api.ts';
import styles from './TripsPage.module.css';
import { ChevronRight } from 'lucide-react';

function TripsPage() {

    const [trips, setTrips] = useState<SaveTripResponse['trip'][]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      setLoading(true);
      listTrips().then((response) => {
        setTrips(response.trips);
        setLoading(false);
        setError(null);
      }).catch((error) => {
        setLoading(false);
        setError(error.message);
      });
    }, []);

  return (
    <section className="mainSection">
        <h1>Saved Trips</h1>

        <ul className={styles.tripList}>
          {trips.length == 0 ? (<li>No trips found</li>) :
          (trips.map((trip) => (
            <li 
            key={trip._id} 
            className={`decorativeBorder ${styles.tripItem}`}>
                <NavLink to={`/trips/${trip._id}`}>
                  <h2>{trip.name}</h2>
                  <p>Created at: {new Date(trip.createdAt).toLocaleString()}</p>
                  <span>
                    View trip
                    <ChevronRight className={styles.chevron} />
                  </span>
                </NavLink>
            </li>
          )))} 
        </ul>
        
        {loading && <p>Loading trips...</p>}
        {error && <p className="error" role="alert">{error}</p>}
    </section>
  );        
}

export default TripsPage;