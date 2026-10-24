import { useState } from 'react'
import styles from './SuggestionDropdown.module.css'
import type { AutocompleteStatus } from '../../hooks/use-autocomplete.ts'
import type { FavoriteLocationInput, FavoriteList, PlaceKind, Suggestion } from '../../types/api.ts'
import { optionId } from '../../utils/combobox.ts'
import FavoriteButton from '../AddDestinationForm/FavoriteButton/FavoriteButton.tsx'
import FavoriteListPopup from '../FavoriteList/FavoriteList.tsx'
import { addFavoriteToList, createFavoriteList, fetchFavoriteLists } from '../../api/favorites.ts'
import { BuildingComplex, MapPin, Sparkles } from 'lucide-react'


type SuggestionDropdownProps = {
  listboxId: string
  suggestions: Suggestion[]
  status: AutocompleteStatus
  partial: boolean
  // The list is shown; the input's aria-expanded must say the same
  expanded: boolean
  // Messages are only shown while the user is working with the field
  open: boolean
  // -1 when no row is highlighted
  highlightedIndex: number
  onSelect: (suggestion: Suggestion) => void
  onHighlight: (index: number) => void
  isLoggedIn?: boolean
}

const KIND_ICONS: Record<PlaceKind, React.ReactNode> = {
  address: <MapPin />,
  city: <BuildingComplex />,
  poi: <Sparkles />,
}


// Only draws the list and its messages. The search field that owns the
// state and the keyboard handling is AddDestinationForm.
function SuggestionDropdown({
  listboxId,
  suggestions,
  status,
  partial,
  expanded,
  open,
  highlightedIndex,
  onSelect,
  onHighlight,
  isLoggedIn = false,
}: SuggestionDropdownProps) {
  const [favoriteLists, setFavoriteLists] = useState<FavoriteList[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [showCreateList, setShowCreateList] = useState(false)
  const [loadingLists, setLoadingLists] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [favoriteError, setFavoriteError] = useState<string | null>(null)

  function locationInput(suggestion: Suggestion): FavoriteLocationInput {
    return {
      name: suggestion.label,
      address: suggestion.description ?? suggestion.label,
      latitude: suggestion.location[1],
      longitude: suggestion.location[0],
    }
  }

  async function openFavoriteLists(suggestion: Suggestion) {
    setSelectedSuggestion(suggestion)
    setShowCreateList(false)
    setFavoriteError(null)
    setLoadingLists(true)
    try {
      const result = await fetchFavoriteLists()
      setFavoriteLists(result.lists)
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : 'Could not load favorite lists.')
    } finally {
      setLoadingLists(false)
    }
  }

  function closeFavoritePopup() {
    if (savingFavorite) return
    setSelectedSuggestion(null)
    setShowCreateList(false)
    setFavoriteError(null)
    setSavingFavorite(false)
  }

  async function saveToList(list: FavoriteList) {
    if (!selectedSuggestion) return
    setSavingFavorite(true)
    setFavoriteError(null)
    try {
      await addFavoriteToList(list._id, locationInput(selectedSuggestion))
      setSelectedSuggestion(null)
      setShowCreateList(false)
      setSavingFavorite(false)
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : 'Could not save this favorite.')
      setSavingFavorite(false)
    }
  }

  async function createListAndSave(name: string) {
    if (!selectedSuggestion) return
    setSavingFavorite(true)
    setFavoriteError(null)
    try {
      const { list } = await createFavoriteList(name)
      await addFavoriteToList(list._id, locationInput(selectedSuggestion))
      setSelectedSuggestion(null)
      setShowCreateList(false)
      setSavingFavorite(false)
    } catch (err) {
      setFavoriteError(err instanceof Error ? err.message : 'Could not save this favorite.')
      setSavingFavorite(false)
    }
  }

  return (
    // One positioned box under the input, so the messages sit under the list
    // instead of being covered by it
    <div className={styles.popup}>
      {/* Always rendered, so the input's aria-controls points to a real element */}
      <ul id={listboxId} role="listbox" className={styles.listbox} hidden={!expanded}>
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={optionId(listboxId, index)}
            role="option"
            aria-selected={index === highlightedIndex}
            // The comma gives screen readers a pause between the two parts
            aria-label={suggestion.description ? `${suggestion.label}, ${suggestion.description}` : suggestion.label}
            className={index === highlightedIndex ? `${styles.option} ${styles.highlighted}` : styles.option}
            // Keep focus in the input; otherwise the input's blur closes the
            // list before the click is registered
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => onHighlight(index)}
          >
            <span className={styles.icon} aria-hidden="true">
              {KIND_ICONS[suggestion.kind]}
            </span>
            
            <span className={styles.text}>
              <span className={styles.label}>{suggestion.label}</span>
              {suggestion.description && <span className={styles.description}>{suggestion.description}</span>}
            </span>

            {isLoggedIn && (
              <FavoriteButton onClick={() => void openFavoriteLists(suggestion)} />
            )}

          </li>
        ))}
      </ul>

      {selectedSuggestion && !showCreateList && (
        <FavoriteListPopup
          lists={favoriteLists}
          loading={loadingLists}
          saving={savingFavorite}
          error={favoriteError}
          onSelect={(list) => void saveToList(list)}
          onCreateNew={() => setShowCreateList(true)}
          onClose={closeFavoritePopup}
        />
      )}

      {selectedSuggestion && showCreateList && (
        <FavoriteListPopup
          mode="create"
          loading={false}
          saving={savingFavorite}
          error={favoriteError}
          onCreate={createListAndSave}
          onClose={closeFavoritePopup}
        />
      )}

      {/* A live region, so screen readers announce these short messages */}
      <div role="status" className={styles.messages}>
        {open && status === 'empty' && <p className="hint">No results</p>}
        {open && expanded && partial && <p className="hint">Some suggestions may be missing</p>}
        {open && (status === 'error' || status === 'rateLimited') && (
          <p className="hint">Suggestions are unavailable, press Enter to search</p>
        )}
      </div>
    </div>
  )
}

export default SuggestionDropdown
