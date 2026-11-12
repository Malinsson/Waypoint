import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom'
import type { FavoriteList } from '../../types/api';
import { getFavoriteList, removeFavoriteFromList, renameFavoriteList, deleteFavoriteList } from '../../api/favorites';
import { Button } from '../../components/atoms/Button';
import { Pencil, Trash } from 'lucide-react';
import PopupBase from '../../components/PopupBase/PopupBase';
import RenameForm from '../../components/RenameForm/RenameForm';
import MapView, { type MapMarker } from '../../components/MapView/MapView';
import Loader from '../../components/atoms/Loader';
import BottomSheet from '../../components/BottomSheet/BottomSheet';
import SheetLayout from '../../components/BottomSheet/SheetLayout';
import type { SnapPoint } from '../../components/BottomSheet/snap';
import styles from './FavoriteDetailPage.module.css'

function FavoriteDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [favoriteList, setFavoriteList] = useState<FavoriteList | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showRenamePopup, setShowRenamePopup] = useState(false);
    // Phone layout: how far the list panel is slid up over the map
    const [sheetSnap, setSheetSnap] = useState<SnapPoint>('half');

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
            <RenameForm
              label="Enter a new name for the favorite list:"
              initialName={favoriteList?.name ?? ''}
              submitLabel="Rename"
              onSecondary={() => setShowRenamePopup(false)}
              onSubmit={(name) => { handleRenameList(favoriteList?._id || '', name); setShowRenamePopup(false); }}
            />
          </PopupBase>
        )}

      <SheetLayout className={styles.mapLayout}>
          {favoriteList && (
            <BottomSheet
              label="Favorite list"
              snap={sheetSnap}
              onSnapChange={setSheetSnap}
              className={styles.panel}
              bodyClassName={styles.favoriteDetail}
              header={
                <div className={styles.head}>
                  <h1>{favoriteList.name}</h1>
                  <Button type="button" onClick={() => setShowRenamePopup(true)}><Pencil size={16} /></Button>
                </div>
              }
            >
              <div className={styles.favoriteDetailContainer}>
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
            </BottomSheet>
          )}

          <MapView
            markers={markers}
            zoom={10}
            center={markers[0]?.location ?? [16.5, 62.5]}
          />
      </SheetLayout>

    </section>
  )
}

export default FavoriteDetailPage