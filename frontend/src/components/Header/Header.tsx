import styles from './Header.module.css'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/auth-context.ts'

function Header() {
  const { user, loading, logout } = useAuth()

  return (
    <nav>
      <NavLink to="/">Home</NavLink>
      <NavLink to="/plan">Plan</NavLink>
      <div className={styles.navAccount}>
        {/* Show nothing while a stored token is checked, so the guest
            links do not flash before the user is restored */}
        {!loading &&
          (user ? (
            <>
              <span>{user.displayName}</span>
              <button type="button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          ))}
      </div>
    </nav>
  )
}

export default Header
