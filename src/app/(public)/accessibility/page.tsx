import type { Metadata } from "next";
import Link from "next/link";
import styles from "../publicPages.module.css";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "Accessibility statement for oPortfolio.",
};

// Follows the GOV.UK model accessibility statement structure (spec/11:
// publish a statement with known issues, contact route and review date).
// Claims here must stay true: update "Known issues" and the dates whenever
// the interface or the testing regime changes.

const CONTACT_EMAIL = "0xchromatin@proton.me";
const PREPARED_ON = "29 August 2026";
const REVIEW_BY = "29 August 2027";

export default function AccessibilityStatementPage() {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <Link className={styles.brand} href="/sign-in" aria-label="oPortfolio home">
          oPortfolio
        </Link>
        <nav className={styles.nav} aria-label="Public navigation">
          <Link href="/about">About</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </header>

      <main id="main-content" className={`${styles.main} ${styles.aboutMain}`}>
        <header className={styles.aboutHeader}>
          <p className="stamp">Accessibility statement</p>
          <h1>Accessibility statement for oPortfolio</h1>
          <p className={styles.lede}>
            This statement applies to the oPortfolio web service: the public pages, the
            signed-in diary, and the archives it generates. It is operated by Akanimoh Osutuk
            as an independent personal project.
          </p>
          <p className={styles.independenceStatement}>
            oPortfolio is not a public sector body, so the Public Sector Bodies (Websites and
            Mobile Applications) (No. 2) Accessibility Regulations 2018 do not apply to it.
            This statement follows their format voluntarily because the people it is built
            for work in the NHS and deserve the same standard.
          </p>
        </header>

        <div className={styles.aboutSections}>
          <section>
            <h2>How accessible this service is</h2>
            <p>We want as many people as possible to be able to use this service. You should be able to:</p>
            <ul>
              <li>use every feature with a keyboard alone, including writing an entry, mapping objectives, attaching files and downloading your archive;</li>
              <li>navigate using a skip link, landmarks and one clear heading per page;</li>
              <li>zoom to 400% or view at 320 CSS pixels wide without two-dimensional scrolling;</li>
              <li>read text at a contrast of at least 4.5:1, with focus indicators of at least 3:1;</li>
              <li>choose a sans-serif reading font for long text from your account page;</li>
              <li>use a password manager or paste into the email field — there are no passwords, puzzles or memory tests to sign in;</li>
              <li>understand every status, error and coverage count from text alone, never from colour or icon alone.</li>
            </ul>
          </section>

          <section>
            <h2>Compliance status</h2>
            <p>
              The service is designed to meet the Web Content Accessibility Guidelines (WCAG)
              2.2 level AA. It has <strong>not yet been independently audited</strong>, so we
              do not claim full conformance. Every release is checked automatically with
              axe-core against WCAG 2.0, 2.1 and 2.2 A/AA rules on each page, plus manual
              keyboard-only and 400% zoom checks; serious or critical findings block release.
              Automated tools find only part of the problems that matter, so we treat this
              service as <strong>partially compliant</strong> until an audit with real
              assistive technology has been completed.
            </p>
          </section>

          <section>
            <h2>Known issues</h2>
            <ul>
              <li>
                <strong>Rich-text editor.</strong> The entry editor (toolbar, headings, lists,
                links) has not yet been tested with screen readers such as NVDA, JAWS or
                VoiceOver. Plain text works throughout and no formatting control is required
                to write or save an entry.
              </li>
              <li>
                <strong>Objective picker.</strong> The combined search-and-browse control has
                been tested with a keyboard but not yet with assistive technology.
              </li>
              <li>
                <strong>PDF archives.</strong> The PDF inside your downloaded archive is not a
                tagged PDF, so heading structure and reading order may not be exposed to
                screen readers. The same content is included in the archive as structured
                JSON, and every entry remains readable in the service itself.
              </li>
              <li>
                <strong>Session timeout.</strong> You are signed out after 60 minutes without
                activity. The service does not yet warn you before this happens; unsaved
                text is kept by autosave, which runs while you type.
              </li>
              <li>
                <strong>Uploaded files.</strong> We cannot make documents or images you upload
                accessible for you. You can add a description to each file.
              </li>
            </ul>
            <p>
              We intend to fix these as the project develops and to update this list when we
              do. If any of them stops you using the service, tell us and we will help you
              another way.
            </p>
          </section>

          <section>
            <h2>Feedback and contact information</h2>
            <p>
              If you find something we have missed, need part of the service in a different
              format, or have difficulty with any step, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Please do not include
              any diary content, patient details or other people&apos;s personal data in your
              message. We aim to reply within 10 working days.
            </p>
          </section>

          <section>
            <h2>Enforcement procedure</h2>
            <p>
              Because this is an independent service and not a public sector body, the
              Equality and Human Rights Commission&apos;s enforcement route for the 2018
              Regulations does not apply. The Equality Act 2010 still applies to us. If you
              are not satisfied with how we respond to your feedback, write to the contact
              address above marked &ldquo;accessibility complaint&rdquo; and it will be reviewed
              by the service operator personally.
            </p>
          </section>

          <section>
            <h2>Technical information and testing</h2>
            <p>
              The service is built with semantic HTML first, uses ARIA only where native
              elements cannot express a control, keeps all controls at least 44 by 44 CSS
              pixels, and uses no third-party scripts, fonts or trackers. The accessibility
              checks described above run in the automated test suite for every change
              (see <code>tests/e2e/accessibility.spec.ts</code> in the source repository).
            </p>
            <p>
              This statement was prepared on {PREPARED_ON} and will be reviewed by {REVIEW_BY},
              or sooner if the interface changes materially or an audit is completed.
            </p>
          </section>
        </div>

        <div className={styles.aboutAction}>
          <Link className={styles.primaryLink} href="/sign-in">
            Start or sign in
          </Link>
        </div>
      </main>

      <footer className={styles.footer}>
        <Link href="/about">About oPortfolio</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/sign-in">Sign in</Link>
      </footer>
    </div>
  );
}
