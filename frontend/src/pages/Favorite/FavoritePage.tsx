import { useEffect, useState, type FormEvent } from 'react'
import {
  addFavoriteToList,
  createFavoriteList,
  fetchFavoriteLists,
  fetchFavoriteListsPage,
} from '../../api/favorites.ts'
import type { FavoriteList, FavoriteLocationInput, GeocodeResult } from '../../types/api.ts'
import styles from './FavoritePage.module.css'
import { Button } from '../../components/atoms/Button.tsx'
import { ChevronRight, Heart, Plus } from 'lucide-react'
import PopupBase from '../../components/PopupBase/PopupBase.tsx'
import { NavLink } from 'react-router-dom'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import FavoriteListPopup from '../../components/FavoriteList/FavoriteList.tsx'
import Loader from '../../components/atoms/Loader.tsx'

function FavoritePage() {
  const [lists, setLists] = useState<FavoriteList[]>([])
  const [newListName, setNewListName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateNewList, setShowCreateNewList] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<GeocodeResult | null>(null)
  const [showCreateListForLocation, setShowCreateListForLocation] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  // The page shows only the loaded pages, but the popup must offer every list
  const [pickerLists, setPickerLists] = useState<FavoriteList[]>([])
  const [loadingPickerLists, setLoadingPickerLists] = useState(false)

  // Loads one page and appends it. The first call (page 1) runs on mount.
  function loadPage(pageToLoad: number) {
    setLoading(true)
    fetchFavoriteListsPage(pageToLoad)
      .then((response) => {
        // Skip lists we already have: a list created on this page shifts the pages
        setLists((current) => {
          const known = new Set(current.map((list) => list._id))
          return [...current, ...response.lists.filter((list) => !known.has(list._id))]
        })
        setPage(response.page)
        setHasMore(response.hasMore)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load favorites.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadPage(1)
  }, [])

  // Matches the backend order: the default list stays first, a new list comes right after it
  function withNewList(current: FavoriteList[], list: FavoriteList): FavoriteList[] {
    const pinned = current.filter((item) => item.isDefault)
    const rest = current.filter((item) => !item.isDefault)
    return [...pinned, list, ...rest]
  }

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) return
    setShowCreateNewList(false)

    try {
      const { list } = await createFavoriteList(name)
      setLists((current) => withNewList(current, list))
      setNewListName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the list.')
    }
  }

  function locationInput(location: GeocodeResult): FavoriteLocationInput {
    return {
      name: location.label,
      description: location.description,
      latitude: location.location[1],
      longitude: location.location[0],
    }
  }

  function selectLocation(location: GeocodeResult) {
    setSelectedLocation(location)
    setShowCreateListForLocation(false)
    setLocationError(null)
    setLoadingPickerLists(true)
    fetchFavoriteLists()
      .then(({ lists: allLists }) => setPickerLists(allLists))
      .catch((err: unknown) => {
        setLocationError(err instanceof Error ? err.message : 'Could not load your lists.')
      })
      .finally(() => setLoadingPickerLists(false))
  }

  function closeLocationPopup() {
    if (savingLocation) return
    setSelectedLocation(null)
    setShowCreateListForLocation(false)
    setLocationError(null)
  }

  async function saveLocationToList(list: FavoriteList) {
    if (!selectedLocation) return
    setSavingLocation(true)
    setLocationError(null)

    try {
      const { location } = await addFavoriteToList(list._id, locationInput(selectedLocation))
      setLists((current) =>
        current.map((currentList) =>
          currentList._id === list._id
            ? { ...currentList, locations: [...currentList.locations, location] }
            : currentList,
        ),
      )
      setSavingLocation(false)
      closeLocationPopup()
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not save this favorite.')
    } finally {
      setSavingLocation(false)
    }
  }

  async function createListAndSaveLocation(name: string) {
    if (!selectedLocation) return
    setSavingLocation(true)
    setLocationError(null)

    try {
      const { list } = await createFavoriteList(name)
      const { location } = await addFavoriteToList(list._id, locationInput(selectedLocation))
      setLists((current) => withNewList(current, { ...list, locations: [...list.locations, location] }))
      setSavingLocation(false)
      closeLocationPopup()
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not save this favorite.')
    } finally {
      setSavingLocation(false)
    }
  }

  return (
    <section aria-label="Favorite lists" className={`mainSection ${styles.favoritePage}`}>

      {loading && <Loader />}
      {error && <p className="error" role="alert">{error}</p>}

      {selectedLocation && !showCreateListForLocation && (
        <FavoriteListPopup
          lists={pickerLists}
          loading={loadingPickerLists}
          saving={savingLocation}
          isOpen
          error={locationError}
          onSelect={(list) => void saveLocationToList(list)}
          onCreateNew={() => setShowCreateListForLocation(true)}
          onClose={closeLocationPopup}
        />
      )}

      {selectedLocation && showCreateListForLocation && (
        <FavoriteListPopup
          mode="create"
          loading={false}
          saving={savingLocation}
          isOpen
          error={locationError}
          onCreate={createListAndSaveLocation}
          onCancelCreate={() => setShowCreateListForLocation(false)}
          onClose={closeLocationPopup}
        />
      )}

      {showCreateNewList && (
        <PopupBase
          onCancel={() => setShowCreateNewList(false)}
          isOpen={showCreateNewList}
        >
          <form className={styles.createForm} onSubmit={handleCreateList}>
            <label htmlFor="new-list-name">Create a favorite list</label>
            <input
              id="new-list-name"
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              placeholder="e.g. Summer road trip"
              maxLength={40}
              className="decorativeBorder"
            />
            <div className={styles.actions}>
              <Button type="submit">Create list</Button>
              <Button type="button" variant="secondary" onClick={() => setShowCreateNewList(false)}>
                Cancel
              </Button>
            </div>
          </form>
          
        </PopupBase>
      )}

      {!loading && lists.length === 0 && <p>No favorite lists yet.</p>}

      <h1>Favorites</h1>

      <div className={styles.searchForm}>
        <AddDestinationForm onAdd={selectLocation} disabled={loading} />
        <Button onClick={() => setShowCreateNewList(true)} disabled={loading}>New list <Plus /></Button>
      </div>

      <div className={styles.lists}>

        {lists.map((list) => (
          <NavLink 
          key={list._id} 
          className={`decorativeBorder ${styles.list}`}
          to={`/favorites/${list._id}`}
          >
            <div className={styles.listHeader}>
              <h2>{list.name}</h2>
              <p>{list.locations.length} <Heart /></p>
            </div>
            <div className={`decorativeDivider ${styles.listDivider}`} />

            {list.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <>
                <ul>
                  {list.locations.slice(0, 3).map((location) => (
                    <li key={location._id}>
                      <strong>{location.name}</strong>
                      {location.description && <span>{location.description}</span>}
                    </li>
                  ))}
                </ul>
                  <p className={styles.viewMore}>View list
                    <ChevronRight className={styles.chevron} />
                  </p>
              </>
            )}
          </NavLink>
        ))}

      </div>

      {hasMore && !loading && (
        <Button variant="secondary" onClick={() => loadPage(page + 1)}>Load more</Button>
      )}
    </section>
  )
}

export default FavoritePage
