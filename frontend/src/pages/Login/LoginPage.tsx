import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import FormField from '../../components/FormField/FormField.tsx'
import { useAuth } from '../../context/auth-context.ts'
import { hasErrors, validateLogin, type FieldErrors } from '../../utils/auth-validation.ts'
import styles from './LoginPage.module.css'

function LoginPage() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  // Set by AuthProvider when a session expired mid-use
  const sessionMessage = (location.state as { message?: string } | null)?.message

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Wait for the start-up token check before deciding what to show
  if (loading) return null
  // Already logged in, including right after a successful login
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateLogin({ email, password })
    setFieldErrors(errors)
    setFormError(null)
    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      await login({ email, password })
    } catch (err) {
      // ApiError messages are already written for users
      // ("Wrong email or password", "Could not reach the server...")
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1>Log in</h1>
      {sessionMessage && <p className={styles.notice}>{sessionMessage}</p>}
      {/* noValidate: show our own messages instead of the browser's pop-ups */}
      <form className={styles.authForm} onSubmit={handleSubmit} noValidate>
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
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
        />
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p>
        No account yet? <Link to="/register">Register</Link>
      </p>
    </>
  )
}

export default LoginPage
