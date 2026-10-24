import styles from './MobileNavigation.module.css'
import { NavLink } from 'react-router-dom'
import { navLinks } from '../Header/Header.tsx'

function MobileNavigation() {

    return (
        <nav className={styles.mobileNav} aria-label="Main navigation">
            {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? styles.active : undefined } >
                    <span className={styles.icon}>{link.icon}</span>
                    <span className={styles.label}>{link.label}</span>
                </NavLink>
            ))}
        </nav>
    )
}
export default MobileNavigation