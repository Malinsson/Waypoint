import styles from './Header.module.css'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/auth-context.ts'
import Logo from '../Logo/Logo.tsx'
import { LandPlot, Heart, House, Route } from 'lucide-react';

type NavLink = {
  to: string
  label: string
  icon?: React.ReactNode
}

export const navLinks: NavLink[] = [
 { to: '/', label: 'Home', icon: <House /> },
 { to: '/plan', label: 'Plan', icon: <LandPlot /> },
 { to: '/favorites', label: 'Favorites', icon: <Heart /> },
 { to: '/trips', label: 'Trips', icon: <Route /> },
];

function Header() {
  const { user, loading, logout } = useAuth()


  return (
    <>
    <nav className={styles.mobileNav} aria-label="Account navigation">
      <Logo />
      <div className={styles.navAccount}>
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
      <div className='decorativeDivider decorativeDivider--bottom'></div>
    </nav>


    <nav className={styles.desktopNav}>
      <Logo />
      {navLinks.map((link) => (
        <NavLink key={link.to} to={link.to}>
          {link.label}
        </NavLink>
      ))}
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
      <div className='decorativeDivider decorativeDivider--bottom'></div>
    </nav>

    </>
  )
}

export default Header
