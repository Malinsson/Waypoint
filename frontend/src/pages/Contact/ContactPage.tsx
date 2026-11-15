import styles from './ContactPage.module.css';

// Placeholders: replace with the real contact information.
const CONTACT_EMAIL = 'malin.persson02@hotmail.com';
const CONTACT_LINKEDIN = 'https://www.linkedin.com/in/malin-persson-085374384/';
const REPO_URL = 'https://github.com/Malinsson/Waypoint';

function ContactPage() {
  return (
    <section className={`mainSection ${styles.contact}`} aria-labelledby="contact-heading">
      <h1 id="contact-heading">Contact Us</h1>
      <p>If you have any questions, feedback or need assistance, please reach out to us.</p>

      <h2>Email</h2>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>

      <h2>LinkedIn</h2>
      <p><a href={CONTACT_LINKEDIN} target="_blank" rel="noopener noreferrer">Malin Persson</a></p>


      <h2>Report a problem</h2>
      <p>Found a bug? Open an issue on <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
    </section>
  );
}

export default ContactPage;
