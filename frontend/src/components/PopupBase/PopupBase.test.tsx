import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import PopupBase from './PopupBase.tsx'

afterEach(cleanup)

// The onCancel prop is an inline arrow, so it is a new function on every render,
// like in the pages that use the popup.
function Host({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <PopupBase isOpen onCancel={() => onClose()}>
      <input aria-label="first" />
      <input aria-label="second" value={text} onChange={(event) => setText(event.target.value)} />
    </PopupBase>
  )
}

it('focuses the first field on open but keeps focus where the user is when the parent re-renders', () => {
  render(<Host onClose={() => undefined} />)
  const first = screen.getByLabelText('first')
  const second = screen.getByLabelText('second')
  expect(document.activeElement).toBe(first)

  second.focus()
  fireEvent.change(second, { target: { value: 'a' } })
  fireEvent.change(second, { target: { value: 'ab' } })

  expect(document.activeElement).toBe(second)
})

it('still calls the latest onCancel when Escape is pressed', () => {
  const onClose = vi.fn()
  render(<Host onClose={onClose} />)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})
