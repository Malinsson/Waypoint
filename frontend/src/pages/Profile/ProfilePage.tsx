import { useEffect, useState, type FormEvent } from 'react'
import { changePassword, fetchProfileStats } from '../../api/auth.ts'
import { Button } from '../../components/atoms/Button.tsx'
import FormField from '../../components/FormField/FormField.tsx'
import { useAuth } from '../../context/auth-context.ts'
import type { ProfileStats } from '../../types/api.ts'
import styles from './ProfilePage.module.css'
import { Settings } from 'lucide-react'
import PopupBase from '../../components/PopupBase/PopupBase.tsx'

const statLabels: { key: keyof ProfileStats; label: string; description: string }[] = [
  { key: 'favorites', label: 'Favorites', description: 'Places worth finding again.' },
  { key: 'tripsSaved', label: 'Trips saved', description: 'Journeys ready whenever you are.' },
  { key: 'tripsCompleted', label: 'Trips completed', description: 'Routes you have taken all the way.' },
  { key: 'kilometersDriven', label: 'Km driven', description: 'The distance behind your adventures.' },
  { key: 'destinationsVisited', label: 'Destinations visited', description: 'Stops that became part of your story.' },
]

function ProfilePage() {
  const { user } = useAuth()

  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchProfileStats()
      .then((response) => setStats(response.stats))
      .catch((err) => setStatsError(err instanceof Error ? err.message : 'Could not load statistics'))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setSuccess(false)

    // Mirrors the backend's password rules; the backend still has the final say
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.currentPassword = 'Current password is required'
    if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters'
    else if (newPassword.length > 72) errors.newPassword = 'Password must be at most 72 characters'
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mainSection">

        {showChangePasswordForm && (
            <PopupBase
            isOpen={showChangePasswordForm} 
            onCancel={() => setShowChangePasswordForm(false)}>
                <h2>Change password</h2>
                <form className={styles.passwordForm} onSubmit={handleSubmit} noValidate>
                    <FormField
                    id="currentPassword"
                    label="Current password"
                    type="password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    error={fieldErrors.currentPassword}
                    autoComplete="current-password"
                    />
                    <FormField
                    id="newPassword"
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    error={fieldErrors.newPassword}
                    autoComplete="new-password"
                    />
                    <FormField
                    id="confirmPassword"
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    error={fieldErrors.confirmPassword}
                    autoComplete="new-password"
                    />
                    {formError && (
                    <p className="error" role="alert">
                        {formError}
                    </p>
                    )}
                    {success && <p role="status">Password changed.</p>}
                    <div className={styles.actions}>
                        <Button type="submit" disabled={submitting}>
                        {submitting ? 'Saving…' : 'Change password'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowChangePasswordForm(false)}>
                        Cancel
                        </Button>
                    </div>
                </form>
            </PopupBase>
        )}
        <div className={styles.content}>
            <div className={styles.header}>
                <h1>Hello, {user?.displayName}!</h1>
                <Settings className={styles.settingsIcon} onClick={() => setShowChangePasswordForm(true)} />
            </div>

        <h2>Statistics</h2>
        {statsError && (
            <p className="error" role="alert">
            {statsError}
            </p>
        )}
        {stats && (
            <dl className={styles.stats}>
            {statLabels.map(({ key, label, description }) => (
                <div key={key} className={`decorativeBorder ${styles.stat}`}>
                <dt>{label}</dt>
                <dd className={styles.statValue}>{stats[key]}</dd>
                <dd className={styles.statDescription}>{description}</dd>
                </div>
            ))}
            </dl>
        )}
        </div>
    </section>
  )
}

export default ProfilePage
