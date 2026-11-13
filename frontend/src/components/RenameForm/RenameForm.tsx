import { useId, useState, type FormEvent } from 'react'
import { Button } from '../atoms/Button.tsx'
import styles from './RenameForm.module.css'

type RenameFormProps = {
  label: string
  initialName?: string
  placeholder?: string
  submitLabel: string
  // The second button is Cancel in a rename popup, but "Name later" when saving
  secondaryLabel?: string
  onSecondary: () => void
  // Receives the trimmed name, which can be empty. The caller decides what empty means.
  onSubmit: (name: string) => void
}

function RenameForm({
  label,
  initialName = '',
  placeholder = 'New name',
  submitLabel,
  secondaryLabel = 'Cancel',
  onSecondary,
  onSubmit,
}: RenameFormProps) {
  const [name, setName] = useState(initialName)
  // useId gives each form instance its own id, so label and input stay linked
  const inputId = useId()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(name.trim())
  }

  return (
    <form className={styles.renameForm} onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{label}</label>
      <input
        type="text"
        id={inputId}
        placeholder={placeholder}
        className="decorativeBorder inputField"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onSecondary}>{secondaryLabel}</Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

export default RenameForm
