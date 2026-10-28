import { useParams } from 'react-router-dom'
import type { FavoriteList } from '../../types/api';
import { useEffect, useState } from 'react';
import { getFavoriteList } from '../../api/favorites';


function FavoriteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [favoriteList, setFavoriteList] = useState<FavoriteList | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      if (!id) {
        setError('Favorite list ID is missing')
        setLoading(false)
        return
      }
      setLoading(true)
      getFavoriteList(id)
        .then((response) => {
          setFavoriteList(response.list)
          setError(null)
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : 'Could not load this favorite list.')
        })
        .finally(() => setLoading(false))
    }, [id])

  return (
    <div>
      <h1>Favorite Detail Page</h1>
      <p>This is the detail page for a specific favorite list.</p>
        {loading && <p>Loading favorite list details...</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {favoriteList && (
          <div>
            <h2>{favoriteList.name}</h2>
            <h3>Locations in this list:</h3>
            {favoriteList.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <ul>
                {favoriteList.locations.map((location) => (
                    <li key={location._id}>
                        <strong>{location.name}</strong>
                        {location.description && <span>{location.description}</span>}
                    </li>
                ))}
                </ul>
            )}
    </div>
        )}
    </div>
  )
}

export default FavoriteDetailPage