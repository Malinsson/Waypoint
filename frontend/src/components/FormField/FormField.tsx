import styles from './FormField.module.css'

type FormFieldProps = {
  id: string
  label: string
  type: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  autoComplete: string
}

// One labelled input with its validation message underneath
function FormField({ id, label, type, value, onChange, error, autoComplete }: FormFieldProps) {
  const errorId = `${id}-error`

  return (
    <div className={styles.formField}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        // Lets screen readers announce the field as invalid and read the message
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        // Every form field in the app is required. The forms use noValidate, so
        // the browser's own required handling is off and this tells screen readers.
        aria-required="true"
        className="decorativeBorder"
      />
      {error && (
        // role="alert" so a message that appears after a failed submit is read out
        <p id={errorId} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
