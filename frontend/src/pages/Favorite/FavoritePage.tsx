import { useEffect, useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { createFavoriteList, fetchFavoriteLists } from '../../api/favorites.ts'
import type { FavoriteList } from '../../types/api.ts'
import styles from './FavoritePage.module.css'
import { Button } from '../../components/atoms/Button.tsx'

function FavoritePage() {
  const [lists, setLists] = useState<FavoriteList[]>([])
  const [newListName, setNewListName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      <form className={styles.createForm} onSubmit={handleCreateList}>
        <label htmlFor="new-list-name">Create a favorite list</label>
        <input
          id="new-list-name"
          value={newListName}
          onChange={(event) => setNewListName(event.target.value)}
          placeholder="e.g. Summer road trip"
          maxLength={80}
        />
        <Button type="submit">Create list</Button>
      </form>

      {!loading && lists.length === 0 && <p>No favorite lists yet.</p>}
      <div className={styles.lists}>
        {lists.map((list) => (
          <article key={list._id} className={`decorativeBorder ${styles.list}`}>
            <h2>{list.name}</h2>
            {list.locations.length === 0 ? (
              <p>No saved locations in this list.</p>
            ) : (
              <div>
                <ul>
                  {list.locations.map((location) => (
                    <li key={location._id}>
                      <strong>{location.name}</strong>
                      {location.description && <span>{location.description}</span>}
                    </li>
                  ))}
                </ul>
                <NavLink to={`/favorites/${list._id}`}>View list</NavLink>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export default FavoritePage
