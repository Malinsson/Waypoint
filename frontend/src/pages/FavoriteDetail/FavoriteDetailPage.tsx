import { useParams } from 'react-router-dom'
import type { FavoriteList } from '../../types/api';
import { useEffect, useState } from 'react';
import { getFavoriteList, removeFavoriteFromList, renameFavoriteList } from '../../api/favorites';
import { Button } from '../../components/atoms/Button';
import styles from './FavoriteDetailPage.module.css'


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

    function handleRenameList(listId: string) {
        const newName = prompt('Enter a new name for the favorite list:')
        if (!newName) return
        renameFavoriteList(listId, newName)
          .then((response) => {
            setFavoriteList(response.list)
          })
          .catch((error) => {
            setError(error instanceof Error ? error.message : 'Could not rename this favorite list.')
          })
      }

    function handleRemoveLocation(locationId: string) {
        if (!favoriteList) return

        removeFavoriteFromList(favoriteList._id, locationId)
          .then(() => {
            setFavoriteList({
              ...favoriteList,
              locations: favoriteList.locations.filter((loc) => loc._id !== locationId),
            })
          })
          .catch((error) => {
            setError(error instanceof Error ? error.message : 'Could not remove this location from the favorite list.')
          })
      }


  return (
    <section className="mainSection">
      <h1>Favorite Detail Page</h1>
      <p>This is the detail page for a specific favorite list.</p>
        {loading && <p>Loading favorite list details...</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {favoriteList && (
          <div className={`decorativeBorder ${styles.favoriteDetail}`}>
            <h2>{favoriteList.name}</h2>
            <Button type="button" onClick={() => {handleRenameList(favoriteList._id)}}>Rename list</Button>
            <h3>Locations in this list:</h3>
            {favoriteList.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <ul>
                {favoriteList.locations.map((location) => (
                    <li className={styles.locationItem} key={location._id}>
                        <strong>{location.name}</strong>
                        {location.description && <span>{location.description}</span>}
                        <Button type="button" onClick={() => handleRemoveLocation(location._id)}>Remove from list</Button>
                    </li>
                ))}
                </ul>
            )}
        </div>
        )}
    </section>
  )
}

export default FavoriteDetailPage