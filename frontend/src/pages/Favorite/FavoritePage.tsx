import { useEffect, useState, type FormEvent } from 'react'
import { addFavoriteToList, createFavoriteList, fetchFavoriteLists } from '../../api/favorites.ts'
import type { FavoriteList, FavoriteLocationInput, GeocodeResult } from '../../types/api.ts'
import styles from './FavoritePage.module.css'
import { Button } from '../../components/atoms/Button.tsx'
import { ChevronRight, Plus } from 'lucide-react'
import PopupBase from '../../components/PopupBase/PopupBase.tsx'
import { NavLink } from 'react-router-dom'
import AddDestinationForm from '../../components/AddDestinationForm/AddDestinationForm.tsx'
import FavoriteListPopup from '../../components/FavoriteList/FavoriteList.tsx'

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

  useEffect(() => {
    fetchFavoriteLists()
      .then(({ lists: loadedLists }) => setLists(loadedLists))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load favorites.')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newListName.trim()
    if (!name) return
    setShowCreateNewList(false)

    try {
      const { list } = await createFavoriteList(name)
      setLists((current) => [...current, list])
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
      setLists((current) => [...current, { ...list, locations: [...list.locations, location] }])
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
      <h1>Favorites</h1>

      {loading && <p>Loading favorites…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className={styles.searchForm}>
        <AddDestinationForm onAdd={selectLocation} disabled={loading} />
      </div>
      {selectedLocation && !showCreateListForLocation && (
        <FavoriteListPopup
          lists={lists}
          loading={loading}
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
      <div className={styles.lists}>
        {lists.map((list) => (
          <NavLink 
          key={list._id} 
          className={`decorativeBorder ${styles.list}`}
          to={`/favorites/${list._id}`}
          >
            <h2>{list.name}</h2>

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

        <div className={`decorativeBorder ${styles.list} ${styles.createNewList}`} onClick={() => setShowCreateNewList(true)}>
          <div className={styles.newListText}>
            <h2>Create a new list</h2>
            <p>Click here or use the form above to create a new favorite list.</p>
          </div>
          <Plus className={styles.newListIcon} />
        </div>
      </div>
    </section>
  )
}

export default FavoritePage
