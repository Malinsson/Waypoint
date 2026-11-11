import { useState } from 'react'
import PopupBase from '../PopupBase/PopupBase'
import styles from './PrivacyPopup.module.css'
import { Button } from '../atoms/Button'

const PRIVACY_NOTICE_KEY = 'privacyNoticeAcknowledged'

function PrivacyPopup() {
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem(PRIVACY_NOTICE_KEY) !== 'true')

  const handleDismiss = () => {
    localStorage.setItem(PRIVACY_NOTICE_KEY, 'true')
    setIsOpen(false)
  }

  return (
    <PopupBase onCancel={handleDismiss} isOpen={isOpen}>
        <div className={styles.privacyPopup}>
            <h2 className={styles.title}>Privacy Policy</h2>
            <div className={`decorativeDivider ${styles.divider}`}></div>
            <p>Waypoint uses your browser&apos;s local storage to keep you logged in and remember an unfinished trip between page reloads.</p>
            <p>This browser storage stays on your device. If you create an account or save trips and favorites, that information is also stored on our server so you can access it later.</p>
            <div className={styles.actions}>
                <Button
                onClick={handleDismiss}
                >
                Got it
                </Button>
            </div>
        </div>
    </PopupBase>
  )
}

export default PrivacyPopup