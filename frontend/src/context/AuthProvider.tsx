import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentUser, loginUser, registerUser } from '../api/auth.ts'
import { setUnauthorizedHandler } from '../api/client.ts'
import { clearToken, getToken, saveToken } from '../api/token-storage.ts'
import type { AuthResponse, LoginInput, RegisterInput, User } from '../types/api.ts'
import { AuthContext } from './auth-context.ts'

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.'

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => getToken())
  // Only loading if there is a stored token to check. This stops the guest
  // UI from flashing before a logged-in user has been restored.
  const [loading, setLoading] = useState(() => getToken() !== null)
  const navigate = useNavigate()

  // On app start: turn a stored token back into a logged-in user
  useEffect(() => {
    if (!getToken()) return

    // Same pattern as HomePage: ignore a response that arrives after cleanup
    let ignore = false
    fetchCurrentUser()
      .then(({ user }) => {
        if (!ignore) setUser(user)
      })
      .catch(() => {
        // Expired or invalid token, or server unreachable: continue as guest
        if (ignore) return
        clearToken()
        setToken(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Called by the API client when a request with our token gets a 401
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
      // During the start-up check a stale token just means "guest", so only
      // send the user to the login page if they were already using the app
      if (!loading) {
        navigate('/login', { state: { message: SESSION_EXPIRED_MESSAGE } })
      }
    })
    return () => setUnauthorizedHandler(null)
  }, [loading, navigate])

  function startSession(result: AuthResponse) {
    saveToken(result.token)
    setToken(result.token)
    setUser(result.user)
  }

  async function login(input: LoginInput) {
    startSession(await loginUser(input))
  }

  async function register(input: RegisterInput) {
    startSession(await registerUser(input))
  }

  // Client-side only: the server keeps no sessions, so forgetting the
  // token is all logging out means (see specs/auth.md)
  function logout() {
    clearToken()
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
