import { useEffect, useState, type FormEvent } from 'react'
import { createFavoriteList, fetchFavoriteLists } from '../../api/favorites.ts'
import type { FavoriteList } from '../../types/api.ts'
import styles from './FavoritePage.module.css'
import { Button } from '../../components/atoms/Button.tsx'
import { Plus } from 'lucide-react'
import PopupBase from '../../components/PopupBase/PopupBase.tsx'
import { NavLink } from 'react-router-dom'

function FavoritePage() {
  const [lists, setLists] = useState<FavoriteList[]>([])
  const [newListName, setNewListName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateNewList, setShowCreateNewList] = useState(false)

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

  return (
    <section className="mainSection">
      <h1>Favorites</h1>
      {loading && <p>Loading favorites…</p>}
      {error && <p className="error" role="alert">{error}</p>}
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
              maxLength={80}
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
            {list.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <div>
                <ul>
                  {list.locations.slice(0, 3).map((location) => (
                    <li key={location._id}>
                      <strong>{location.name}</strong>
                      {location.description && <span>{location.description}</span>}
                    </li>
                  ))}
                </ul>
              </div>
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
