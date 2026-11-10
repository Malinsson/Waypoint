import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom'
import type { FavoriteList } from '../../types/api';
import { getFavoriteList, removeFavoriteFromList, renameFavoriteList, deleteFavoriteList } from '../../api/favorites';
import { Button } from '../../components/atoms/Button';
import { Pencil, Trash } from 'lucide-react';
import PopupBase from '../../components/PopupBase/PopupBase';
import MapView, { type MapMarker } from '../../components/MapView/MapView';
import Loader from '../../components/atoms/Loader';
import styles from './FavoriteDetailPage.module.css'

function FavoriteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [favoriteList, setFavoriteList] = useState<FavoriteList | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showRenamePopup, setShowRenamePopup] = useState(false);
    const [renameName, setRenameName] = useState('');

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

    function handleRenameList(listId: string, newName: string) {
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

    function handleDeleteList() {
      if (!favoriteList) return

      deleteFavoriteList(favoriteList._id)
        .then(() => {
          setFavoriteList(null)
          setShowDeleteConfirmation(false)
          return window.location.href = '/favorites'
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : 'Could not delete this favorite list.')
        })

      }
    const markers = useMemo<MapMarker[]>(
      () => {
      if (!favoriteList) return []
      return favoriteList.locations.map((location, index) => ({
        id: location._id,
        location: [location.longitude, location.latitude],
        label: `${index + 1}`,
        description: location.description,
      }))
    }, [favoriteList])

  return (
    <section className={`mainSection ${styles.flexDirections}`}>
        {loading && <Loader />}
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
              <Button type="button" onClick={handleDeleteList}>Delete</Button>
            </div>
          </PopupBase>
        )}

        {showRenamePopup && (
          <PopupBase
            onCancel={() => setShowRenamePopup(false)}
            isOpen={showRenamePopup}
          >
            <h2>Rename Favorite List</h2>
            <form className={styles.renameForm} onSubmit={(e) => { e.preventDefault(); handleRenameList(favoriteList?._id || '', renameName); setShowRenamePopup(false); }}>
            <label htmlFor="newName">Enter a new name for the favorite list:</label>
            <input type="text" id="newName" placeholder="New name" className="decorativeBorder inputField" value={renameName} onChange={(e) => setRenameName(e.target.value)} />
              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={() => setShowRenamePopup(false)}>Cancel</Button>
                <Button type="submit">Rename</Button>
              </div>
            </form>
          </PopupBase>
        )}

          {favoriteList && (
            <div className={styles.favoriteDetail}>
              <div className={styles.favoriteDetailContainer}>
                <div className={styles.head}>
                  <h1>{favoriteList.name}</h1>
                  <Button type="button" onClick={() => { setRenameName(favoriteList.name); setShowRenamePopup(true); }}><Pencil size={16} /></Button>
                </div>
                <h3>Locations in this list:</h3>
                {favoriteList.locations.length === 0 ? (
                  <p>No saved locations in this list.</p>
                ) : (
                  <ul className={styles.locationList}>
                    {favoriteList.locations.map((location, index) => (
                        <li className={styles.locationItem} key={location._id}>
                          <div>
                            <strong>{index + 1}. {location.name}</strong>
                            {location.description && <span> - {location.description}</span>}
                          </div>
                          <Button type="button" variant="secondary" onClick={() => handleRemoveLocation(location._id)}><Trash size={16} /></Button>
                        </li>
                    ))}
                    </ul>
                )}
              </div>

              <div className={styles.actions}>
                <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirmation(true)}>Delete this list</Button>
              </div>
              
            </div>
          )}


      <MapView
        markers={markers}
        zoom={10}
        center={markers[0]?.location ?? [16.5, 62.5]}
        />

    </section>
  )
}

export default FavoriteDetailPage