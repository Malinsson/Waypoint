import { useState, type FormEvent } from 'react'
import type { FavoriteList as FavoriteListType } from '../../types/api.ts'
import styles from './FavoriteList.module.css'

type FavoriteListProps = {
  lists?: FavoriteListType[]
  mode?: 'select' | 'create'
  loading: boolean
  saving: boolean
  error: string | null
  onSelect?: (list: FavoriteListType) => void
  onCreateNew?: () => void
  onCreate?: (name: string) => void
  onClose: () => void
}

function FavoriteList({
  lists = [],
  mode = 'select',
  loading,
  saving,
  error,
  onSelect,
  onCreateNew,
  onCreate,
  onClose,
}: FavoriteListProps) {
  const [name, setName] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName && onCreate) onCreate(trimmedName)
  }

  return (
    <div className={styles.favoriteListPopup} role="dialog" aria-modal="true">
      <div className={styles.header}>
        <h2>{mode === 'create' ? 'Create a new list' : 'Add to a list'}</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close">
          ×
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {mode === 'create' ? (
        <form onSubmit={handleSubmit}>
          <label htmlFor="favorite-list-name">List name</label>
          <input
            id="favorite-list-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
            disabled={saving}
          />
          <div className={styles.actions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {loading && <p>Loading lists…</p>}
          {!loading && lists.length === 0 && <p>No favorite lists yet.</p>}
          <div className={styles.favoriteListContainer}>
            {lists.map((list) => (
              <button
                key={list._id}
                type="button"
                className={styles.favoriteListItem}
                onClick={() => onSelect?.(list)}
                disabled={saving}
              >
                {list.name}
              </button>
            ))}
            <button
              type="button"
              className={styles.favoriteListItem}
              onClick={onCreateNew}
              disabled={saving}
            >
              Create new list
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default FavoriteList
