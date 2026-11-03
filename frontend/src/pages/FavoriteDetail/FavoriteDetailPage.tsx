import { useParams } from 'react-router-dom'
import type { FavoriteList } from '../../types/api';
import { useEffect, useState } from 'react';
import { getFavoriteList, removeFavoriteFromList, renameFavoriteList } from '../../api/favorites';
import { Button } from '../../components/atoms/Button';
import styles from './FavoriteDetailPage.module.css'
import { Pencil, Trash } from 'lucide-react';
import PopupBase from '../../components/PopupBase/PopupBase';


function FavoriteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [favoriteList, setFavoriteList] = useState<FavoriteList | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showRenamePopup, setShowRenamePopup] = useState(false);

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
        {loading && <p>Loading favorite list details...</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {showDeleteConfirmation && (
          <PopupBase
            onCancel={() => setShowDeleteConfirmation(false)}
            isOpen={showDeleteConfirmation}
          >
            <h2>Delete Favorite List</h2>
            <p>Are you sure you want to delete this favorite list?</p>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirmation(false)}>Cancel</Button>
              <Button type="button" onClick={() => {}}>Delete</Button>
            </div>
          </PopupBase>
        )}

        {showRenamePopup && (
          <PopupBase
            onCancel={() => setShowRenamePopup(false)}
            isOpen={showRenamePopup}
          >
            <h2>Rename Favorite List</h2>
            <p>Enter a new name for the favorite list:</p>
            <input type="text" placeholder="New name" className="decorativeBorder" />
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={() => setShowRenamePopup(false)}>Cancel</Button>
              <Button type="submit" onClick={() => {}}>Rename</Button>
            </div>
          </PopupBase>
        )}

        {favoriteList && (
          <div className={styles.favoriteDetail}>
            <div className={styles.head}>
              <h1>{favoriteList.name}</h1>
              <Button type="button" onClick={() => setShowRenamePopup(true)}><Pencil size={16} /></Button>
            </div>
            <h3>Locations in this list:</h3>
            {favoriteList.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <ul>
                {favoriteList.locations.map((location) => (
                    <li className={styles.locationItem} key={location._id}>
                        <strong>{location.name}</strong>
                        {location.description && <span>{location.description}</span>}
                        <Button type="button" onClick={() => handleRemoveLocation(location._id)}><Trash size={16} /></Button>
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