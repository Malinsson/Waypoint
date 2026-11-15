import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StarRating from './StarRating.tsx'

afterEach(cleanup)

describe('StarRating', () => {
  it('sets the rating when a star is clicked', () => {
    const onChange = vi.fn()
    render(<StarRating label="Liseberg" value={undefined} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rate Liseberg 3 out of 5' }))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('clears the rating when the current value is clicked again', () => {
    const onChange = vi.fn()
    render(<StarRating label="Liseberg" value={3} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rate Liseberg 3 out of 5' }))

    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('marks the stars up to the value as pressed', () => {
    render(<StarRating label="Liseberg" value={2} onChange={() => undefined} />)

    const pressed = screen.getAllByRole('button').map((button) => button.getAttribute('aria-pressed'))

    expect(pressed).toEqual(['true', 'true', 'false', 'false', 'false'])
  })

  it('read-only mode has no buttons, so it can sit inside a link, and says the rating in words', () => {
    render(<StarRating label="Trip rating" value={4} readOnly />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('img', { name: 'Trip rating: 4 out of 5' })).toBeTruthy()
  })

  it('announces the current rating, and that it was cleared', () => {
    const { rerender } = render(<StarRating label="Liseberg" value={3} onChange={() => undefined} />)
    expect(screen.getByRole('status').textContent).toBe('3 out of 5')

    rerender(<StarRating label="Liseberg" value={undefined} onChange={() => undefined} />)
    expect(screen.getByRole('status').textContent).toBe('No rating')
  })

  it('cannot be changed while disabled', () => {
    const onChange = vi.fn()
    render(<StarRating label="Liseberg" value={undefined} onChange={onChange} disabled />)

    fireEvent.click(screen.getByRole('button', { name: 'Rate Liseberg 5 out of 5' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
