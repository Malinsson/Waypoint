import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Suggestion } from '../../types/api.ts'
import SuggestionDropdown from './SuggestionDropdown.tsx'

const withDescription: Suggestion = {
  id: 'wd:Q1413270',
  label: 'Liseberg',
  description: 'amusement park in Gothenburg, Sweden',
  location: [11.99, 57.6956],
  kind: 'poi',
  source: 'both',
}

const withoutDescription: Suggestion = {
  id: 'geo:51a3',
  label: 'Lisebergsgatan, Gothenburg, Sweden',
  location: [11.989, 57.6951],
  kind: 'address',
  source: 'geoapify',
}

function renderDropdown() {
  render(
    <SuggestionDropdown
      listboxId="test-listbox"
      suggestions={[withDescription, withoutDescription]}
      status="ok"
      partial={false}
      expanded
      open
      highlightedIndex={-1}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
    />,
  )
}

// Without test globals, Testing Library cannot clean up by itself
afterEach(cleanup)

describe('SuggestionDropdown', () => {
  it('shows the label and the description as two lines, both in the accessible name', () => {
    renderDropdown()

    const option = screen.getByRole('option', { name: 'Liseberg, amusement park in Gothenburg, Sweden' })
    expect(within(option).getByText('Liseberg')).toBeTruthy()
    expect(within(option).getByText('amusement park in Gothenburg, Sweden')).toBeTruthy()
  })

  it('shows only the label when there is no description', () => {
    renderDropdown()

    const option = screen.getByRole('option', { name: 'Lisebergsgatan, Gothenburg, Sweden' })
    expect(within(option).getByText('Lisebergsgatan, Gothenburg, Sweden')).toBeTruthy()
    // The icon and the label, and no second line
    expect(option.textContent).toBe('🏠Lisebergsgatan, Gothenburg, Sweden')
  })
})
