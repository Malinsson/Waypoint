import styles from './SuggestionDropdown.module.css'
import type { AutocompleteStatus } from '../../hooks/use-autocomplete.ts'
import type { PlaceKind, Suggestion } from '../../types/api.ts'
import { optionId } from '../../utils/combobox.ts'

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
}

// Placeholders until real icons are added
const KIND_ICONS: Record<PlaceKind, string> = {
  address: '🏠',
  city: '🏙️',
  poi: '📍',
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
}: SuggestionDropdownProps) {
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
          </li>
        ))}
      </ul>

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
