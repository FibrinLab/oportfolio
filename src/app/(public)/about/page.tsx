import type { Metadata } from "next";
import Link from "next/link";
import styles from "../publicPages.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "About oPortfolio, an independent private learning diary.",
};

export default function AboutPage() {
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
          <Link href="/sign-in">Sign in</Link>
          <a href="https://docakan.com/">Back to docakan.com <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="main-content" className={`${styles.main} ${styles.aboutMain}`}>
        <header className={styles.aboutHeader}>
          <p className="stamp">About the service</p>
          <h1>A learning record that belongs to the fellow.</h1>
          <p className={styles.lede}>
            oPortfolio began as a weekend project I built for my own reflections. I am
            extending it to others because I think the same private diary may be useful to
            them too.
          </p>
          <p className={styles.independenceStatement}>
            This is an independent personal project. It was not commissioned by, affiliated
            with, or endorsed by the NHS Fellowship in Clinical AI or any NHS organisation.
          </p>
        </header>

        <div className={styles.aboutSections}>
          <section>
            <h2>What it is for</h2>
            <p>
              You can record what you did, what you learned, and what you want to do
              differently. Entries can include links or files. The complete retained diary
              can be downloaded as a portable archive whenever you need it.
            </p>
          </section>

          <section>
            <h2>Your privacy boundary</h2>
            <p>
              Diary titles, dates, reflections, links, and files are visible only to their
              author within oPortfolio. Creating an account does not give a fellowship
              programme, supervisor, or employer access. The{" "}
              <Link href="/privacy">service privacy notice</Link> explains how account data is
              operated, retained, and handled when disclosure is required by law.
            </p>
          </section>

          <section>
            <h2>What it is not</h2>
            <p>
              oPortfolio is not a patient record, clinical system, incident-reporting route,
              competency decision, or substitute for local governance processes. It must not
              contain patient-identifiable information, clinical datasets, or unnecessary
              identifying details about colleagues or third parties.
            </p>
          </section>

          <section>
            <h2>About the project</h2>
            <p>
              For more work and writing from the project&apos;s creator, visit{" "}
              <a href="https://docakan.com/">docakan.com <span aria-hidden="true">↗</span></a>.
              Making the code available does not imply approval or endorsement by any
              fellowship or NHS organisation. The project remains independently operated.
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
        <Link href="/sign-in">Sign in</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/accessibility">Accessibility</Link>
        <span aria-hidden="true">·</span>
        <a href="https://docakan.com/">docakan.com <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
