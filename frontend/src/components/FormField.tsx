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
    <div className="form-field">
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
      />
      {error && (
        <p id={errorId} className="error">
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
