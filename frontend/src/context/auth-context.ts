import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, User } from '../types/api.ts'

export type AuthContextValue = {
  user: User | null
  token: string | null
  // True while a stored token is being checked on app start
  loading: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

// Kept apart from AuthProvider.tsx because a component file should only
// export components (otherwise Vite's hot reload stops working for it)
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}
