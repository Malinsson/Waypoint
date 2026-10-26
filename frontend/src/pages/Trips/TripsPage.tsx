
import { useEffect, useState } from 'react';
import { listTrips } from '../../api/trips.ts'
import type { SaveTripResponse } from '../../types/api.ts';

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
    <div>
        <h1>Saved Trips</h1>
        <ul>
          {trips.length == 0 ? (<li>No trips found</li>) :
          (trips.map((trip) => (
            <li key={trip._id}>
              <strong>{trip.name}</strong> - Created at: {new Date(trip.createdAt).toLocaleString()}
            </li>
          )))} 
        </ul>
        {loading && <p>Loading trips...</p>}
        {error && <p className="error" role="alert">{error}</p>}
    </div>
  );        
}

export default TripsPage;