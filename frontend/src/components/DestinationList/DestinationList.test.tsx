import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Destination } from '../../types/api.ts'
import DestinationList from './DestinationList.tsx'

afterEach(cleanup)

const destinations: Destination[] = [
  { id: 'a', name: 'Stockholm', location: [18.07, 59.33], description: undefined },
  { id: 'b', name: 'Visby', location: [18.29, 57.63], description: undefined },
]

function renderList(unreachableIds: string[]) {
  render(
    <DestinationList
      destinations={destinations}
      unreachableIds={unreachableIds}
      roundTrip={false}
      disabled={false}
      onRemove={() => undefined}
      onReorder={() => undefined}
      onRoundTripChange={() => undefined}
    />,
  )
}

describe('DestinationList', () => {
  it('labels only the destination that has no road connection', () => {
    renderList(['b'])

    expect(screen.getAllByText(/no road connection/)).toHaveLength(1)
    expect(screen.getByText(/Visby/).closest('li')?.textContent).toContain('no road connection')
    expect(screen.getByText(/Stockholm/).closest('li')?.textContent).not.toContain('no road connection')
  })

  it('shows no warning when every destination is reachable', () => {
    renderList([])

    expect(screen.queryByText(/no road connection/)).toBeNull()
  })
})
