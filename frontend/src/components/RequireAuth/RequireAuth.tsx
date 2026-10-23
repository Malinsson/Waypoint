import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/auth-context.ts'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return children
}

export default RequireAuth
