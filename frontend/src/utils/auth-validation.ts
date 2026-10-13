// Mirrors the backend's Zod rules (backend/src/controllers/auth-controller.ts)
// so errors can be shown next to each field before anything is sent.
// The backend still validates everything; this is only for a better UX.
// If you change a rule here, change it there too.

export type AuthField = 'email' | 'password' | 'displayName'
export type FieldErrors = Partial<Record<AuthField, string>>

// Deliberately simple: "something@something.something". The backend has
// the final say on what counts as a valid email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email: string): string | undefined {
  const trimmed = email.trim()
  if (!trimmed) return 'Email is required'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Email must be a valid email address'
  if (trimmed.length > 254) return 'Email is too long'
  return undefined
}

export function validateRegister(input: {
  email: string
  password: string
  displayName: string
}): FieldErrors {
  const errors: FieldErrors = {}

  const emailError = validateEmail(input.email)
  if (emailError) errors.email = emailError

  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  } else if (input.password.length > 72) {
    errors.password = 'Password must be at most 72 characters'
  }

  const displayName = input.displayName.trim()
  if (!displayName) {
    errors.displayName = 'Display name is required'
  } else if (displayName.length > 50) {
    errors.displayName = 'Display name must be at most 50 characters'
  }

  return errors
}

export function validateLogin(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {}

  const emailError = validateEmail(input.email)
  if (emailError) errors.email = emailError

  if (!input.password) errors.password = 'Password is required'

  return errors
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}
