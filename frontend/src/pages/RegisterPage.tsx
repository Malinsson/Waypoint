import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import FormField from '../components/FormField/FormField.tsx'
import { useAuth } from '../context/auth-context.ts'
import { hasErrors, validateRegister, type FieldErrors } from '../utils/auth-validation.ts'

function RegisterPage() {
  const { user, loading, register } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Wait for the start-up token check before deciding what to show
  if (loading) return null
  // Already logged in, including right after a successful registration
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateRegister({ email, password, displayName })
    setFieldErrors(errors)
    setFormError(null)
    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      await register({ email, password, displayName })
    } catch (err) {
      // e.g. "An account with this email already exists"
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1>Create an account</h1>
      {/* noValidate: show our own messages instead of the browser's pop-ups */}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="displayName"
          label="Display name"
          type="text"
          value={displayName}
          onChange={setDisplayName}
          error={fieldErrors.displayName}
          autoComplete="nickname"
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <FormField
          id="password"
          label="Password (8–72 characters)"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  )
}

export default RegisterPage
