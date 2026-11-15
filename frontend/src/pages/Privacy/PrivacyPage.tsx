import styles from './PrivacyPage.module.css'

const REPO_URL = 'https://github.com/Malinsson/Waypoint'

function PrivacyPage() {
  return (
    <section className={`mainSection ${styles.privacy}`} aria-labelledby="privacy-heading">
      <h1 id="privacy-heading">Privacy Policy</h1>

      <h2>Cookies and local storage</h2>
      <p>Waypoint does not use cookies. It uses your browser&apos;s local storage to keep you logged in, to remember an unfinished trip between page reloads, and to remember that you have read the privacy notice. This data stays on your device.</p>

      <h2>Using Waypoint without an account</h2>
      <p>You can plan trips as a guest. Nothing is saved on our server unless you create an account and choose to save a trip.</p>

      <h2>Account data</h2>
      <p>If you register, we store your email address, your display name and a hashed version of your password. We never store your password in plain text. Trips and favorites you save are stored on our server and are only visible to you.</p>

      <h2>Third-party services</h2>
      <p>To find places and calculate routes, the addresses and place names you enter are sent from our server to Geoapify and Wikidata. Your email and account details are not shared with them. Map tiles are loaded directly from OpenStreetMap, which means your browser&apos;s IP address is visible to them.</p>

      <h2>Your data</h2>
      <p>You can delete your saved trips and favorites at any time.</p>

      <h2>Source code</h2>
      <p>Waypoint is a school project and its source code is public: <a href={REPO_URL} target="_blank" rel="noopener noreferrer">view it on GitHub</a>.</p>
    </section>
  )
}

export default PrivacyPage
