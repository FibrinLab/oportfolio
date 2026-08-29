import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./SignInForm";
import styles from "../publicPages.module.css";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
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
          <a href="https://docakan.com/">Back to docakan.com <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="main-content" className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.introduction}>
            <p className="stamp">Independent weekend project</p>
            <h1>A private log for what you are learning.</h1>
            <p className={styles.lede}>
              I built oPortfolio for my own reflections and am extending it to others because
              I think it may be useful. It is an independent personal project: it was not
              commissioned by, affiliated with, or endorsed by the NHS Fellowship in Clinical
              AI or any NHS organisation.
            </p>
            <p className={styles.supportingCopy}>
              Write short notes or longer reflections, keep useful links and files together,
              and download a complete copy whenever you want it.
            </p>
          </div>

          <section className={styles.signInPanel} aria-labelledby="sign-in-heading">
            <h2 id="sign-in-heading">Start or sign in</h2>
            <p className={styles.panelIntro}>
              We will email you a single-use link. There are no passwords to remember.
            </p>
            <SignInForm />
            <p className={styles.accountNote}>
              New here? Your first verified link creates a private diary automatically. No
              invitation or programme approval is needed.
            </p>
          </section>
        </section>

        <aside className={styles.safetyNotice} aria-labelledby="before-you-use-heading">
          <p className="stamp">Important</p>
          <h2 id="before-you-use-heading">Before you use this diary</h2>
          <p>
            oPortfolio is for personal professional learning. It is not a clinical record,
            patient system, or incident-reporting route. Never include patient-identifiable
            information or details that could identify a colleague or third party.
          </p>
          <p>
            Diary content is visible only to you within the service. No fellowship programme
            or supervisor is given access. Reflections may still be subject to lawful
            disclosure and the service&apos;s privacy and retention terms.
          </p>
        </aside>
      </main>

      <footer className={styles.footer}>
        <Link href="/about">About oPortfolio</Link>
        <span aria-hidden="true">·</span>
        <Link href="/accessibility">Accessibility</Link>
        <span aria-hidden="true">·</span>
        <a href="https://docakan.com/">docakan.com <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
