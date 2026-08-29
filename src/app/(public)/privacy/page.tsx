import type { Metadata } from "next";
import Link from "next/link";
import styles from "../publicPages.module.css";
import { NOTICE_VERSION, OPERATOR_CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/notices";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How oPortfolio handles your account and diary data.",
};

// UK GDPR Articles 13/14 transparency information for the self-service
// service. Programme-run tenants publish their own controller's notice via
// tenant.privacy_notice_url. Keep every statement here true to the code:
// retention periods come from src/server/diary, src/server/identity and the
// worker housekeeping; the operator-access paragraph is a deliberate,
// honest limitation (docs/dpia.md R3).

// Named providers are published once hosting is chosen; until then the
// categories below are the commitment. [TO COMPLETE before live use]
const PROVIDERS: Array<{ role: string; name: string; location: string }> = [];

export default function PrivacyNoticePage() {
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
          <p className="stamp">Privacy notice · version {NOTICE_VERSION}</p>
          <h1>How oPortfolio handles your data</h1>
          <p className={styles.lede}>
            This notice explains what I collect when you use oPortfolio, why, who can see it,
            how long it is kept, and what you can ask me to do. It is written to be read,
            not skimmed — the diary holds your own reflections, so the details matter.
          </p>
          <p className={styles.independenceStatement}>
            The data controller for the self-service diary is {OPERATOR_NAME}, an individual
            operating this service independently. It is not run by, for, or on behalf of the
            NHS Fellowship in Clinical AI or any NHS organisation. Contact:{" "}
            <a href={`mailto:${OPERATOR_CONTACT_EMAIL}`}>{OPERATOR_CONTACT_EMAIL}</a>.
          </p>
        </header>

        <div className={styles.aboutSections}>
          <section>
            <h2>The short version</h2>
            <ul>
              <li>Your diary is visible only to you inside the service. No programme, supervisor or employer is given access.</li>
              <li>I need your email address to sign you in. Everything else you write or upload is optional and yours.</li>
              <li>I do not sell data, run advertising, use analytics trackers, or feed your writing to any AI or third party.</li>
              <li>You can download everything at any time and delete it whenever you want.</li>
              <li>Your entries, links and files are encrypted in your browser with a key derived from a passphrase only you know. The servers store ciphertext; I cannot read your diary even with full access to them.</li>
            </ul>
          </section>

          <section>
            <h2>What I collect</h2>
            <ul>
              <li><strong>Account:</strong> your email address, a display name (taken from your email unless you change it), when you last signed in, and whether the account is active.</li>
              <li><strong>Profile (optional):</strong> preferred name, professional group, specialty or role, organisation, and reading preferences such as your chosen font.</li>
              <li><strong>Diary content (encrypted):</strong> entry titles, the reflections you write, links you add, and files you upload (up to 25 MB each) are encrypted on your device before they are sent; the server stores only ciphertext. Earlier versions of an entry are kept, also encrypted, so edits never silently overwrite.</li>
              <li><strong>Diary metadata (not encrypted):</strong> entry dates, the entry type you choose, curriculum objectives you map, file sizes and timestamps — needed for lists, counts and retention. They contain no content.</li>
              <li><strong>Key material:</strong> your diary key wrapped under your passphrase and under your recovery key. Neither the passphrase nor the recovery key ever leaves your browser, so this material is useless without them.</li>
              <li><strong>Archives:</strong> the ZIP file (PDF, JSON, attachments, manifest) created when you ask for a download.</li>
              <li><strong>Security records:</strong> one-way hashes of sign-in links and sessions (never the links themselves), the time of each sign-in, and short-lived counters keyed by email address and network address to slow down abuse.</li>
              <li><strong>Audit log:</strong> a tamper-evident record of actions taken on your account — who did what, when, to which item — that deliberately never includes the content itself.</li>
              <li><strong>Notice confirmations:</strong> which version of this notice and the usage rules you confirmed, and when.</li>
            </ul>
            <p>
              I do not collect passwords, device fingerprints, precise location, or third-party
              cookies. Reflections are your own words; they may reveal things about your
              health, beliefs or wellbeing, which the law treats as special category data.
              You decide whether to write them.
            </p>
          </section>

          <section>
            <h2>Why, and on what legal basis</h2>
            <ul>
              <li><strong>Providing the diary</strong> (storing, showing, exporting your entries; sending sign-in and service emails): necessary to perform the service you have asked for — UK GDPR Article 6(1)(b).</li>
              <li><strong>Keeping the service secure</strong> (rate limits, audit log, malware scanning of uploads, error logs): my legitimate interest in protecting the service and the people who use it — Article 6(1)(f). This is low-intrusion and what you would expect.</li>
              <li><strong>Sensitive content in your reflections:</strong> your explicit consent, given when you confirm this notice at sign-in — Article 9(2)(a). You can withdraw it at any time by deleting the content or your diary.</li>
            </ul>
            <p>
              You must not put patient-identifiable information, clinical data, or
              unnecessary identifying details about colleagues or other people in your diary.
              There is no lawful basis for me to hold that data, and I treat its presence as an
              incident: I will ask you to remove it and record that it happened, without
              copying it.
            </p>
          </section>

          <section>
            <h2>Who can see your data — including me</h2>
            <p>
              Inside oPortfolio, only the author can open a diary. The code enforces this on
              every page, API call, file download and export; a request from anyone else is
              answered as if the item did not exist. There is no administrator screen that
              shows diary content, and every in-product action is written to the audit log.
            </p>
            <p>
              <strong>End-to-end encryption.</strong> Your content is encrypted in your browser
              before it is sent, with a key that exists only on your device. What I operate —
              the database, file storage and backups — holds ciphertext and wrapped keys that
              cannot be opened without your passphrase or recovery key. So I cannot read your
              diary, and neither can anyone who obtains a copy of the servers&apos; data. The
              flip side is that I cannot recover it for you either: if you lose both your
              passphrase and your recovery key, the diary is gone.
            </p>
            <p>
              <strong>What encryption does not cover.</strong> Dates, entry types, objective
              mappings, file sizes and timestamps are stored in clear so lists and retention
              work; they contain no content. And because your browser decrypts using the code
              this website serves, you are trusting that code — it is open source, loaded only
              from this origin with a strict Content Security Policy, and never includes
              third-party scripts. Uploaded files cannot be virus-scanned by the service, so
              only attach files you trust.
            </p>
            <p>
              I will disclose data to others only when the law requires it — for example a
              court order — and I will tell you first unless I am legally prevented from doing
              so.
            </p>
          </section>

          <section>
            <h2>Service providers</h2>
            <p>
              The service runs on infrastructure I rent from providers acting on my
              instructions under written contracts: web hosting, a database, file storage for
              uploads and archives, and an email delivery service for sign-in links. Emails
              never contain diary content.
            </p>
            {PROVIDERS.length > 0 ? (
              <ul>
                {PROVIDERS.map((p) => (
                  <li key={p.role}>
                    <strong>{p.role}:</strong> {p.name} ({p.location})
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                The named providers and their locations will be listed here before the
                service accepts real users; the intention is UK or EU hosting throughout, with
                no transfers outside the UK or EEA.
              </p>
            )}
          </section>

          <section>
            <h2>How long I keep things</h2>
            <ul>
              <li><strong>Diary content and files:</strong> until you archive or delete them, or until 90 days after you finish your diary — then everything is permanently purged. You can reopen within those 90 days to cancel the deletion.</li>
              <li><strong>Downloaded archives:</strong> the ZIP is deleted from storage 7 days after it is created; download links last 5 minutes.</li>
              <li><strong>Sign-in links:</strong> 15 minutes. <strong>Sessions:</strong> 60 minutes idle, 12 hours at most. Spent records are removed after 7 and 30 days respectively.</li>
              <li><strong>Abuse counters:</strong> 24 hours.</li>
              <li><strong>Audit log and notice confirmations:</strong> kept for the life of the diary as an accountability record; they contain no content.</li>
              <li><strong>Backups:</strong> kept only as long as needed to recover from failure, and deletions are re-applied if a backup is ever restored.</li>
            </ul>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>You can, at any time and free of charge:</p>
            <ul>
              <li><strong>Access and take away</strong> your data: use <em>Download my diary</em> in the service for a complete, portable copy (PDF and JSON).</li>
              <li><strong>Correct</strong> anything: edit entries and profile details in the service.</li>
              <li><strong>Delete</strong> everything: finish your diary in the service (purged after 90 days) or email me for immediate deletion.</li>
              <li><strong>Restrict or object</strong> to processing, or <strong>withdraw consent</strong> for sensitive content — email me and I will act within one month.</li>
              <li><strong>Complain</strong> to the Information Commissioner&apos;s Office at{" "}
                <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or on 0303 123 1113. I would appreciate the chance to put things right first.</li>
            </ul>
            <p>
              I make no automated decisions about you, and nothing in the service scores,
              ranks or assesses your reflections.
            </p>
          </section>

          <section>
            <h2>Cookies</h2>
            <p>
              One strictly necessary cookie keeps you signed in (deleted when you sign out or
              after 12 hours) and one remembers your font preference. There are no analytics,
              advertising or third-party cookies, so no cookie banner is needed.
            </p>
          </section>

          <section>
            <h2>Security</h2>
            <p>
              Sign-in uses single-use email links, so there is no password to steal; your
              diary passphrase is separate and never sent to the server. Sessions and links
              are stored only as one-way hashes. All traffic is encrypted in transit and diary
              content is encrypted end-to-end, and the code is open source and checked
              automatically for known vulnerabilities. If a breach ever
              affects your data I will tell you without undue delay and report it to the ICO
              where required. This service is not for anyone under 18.
            </p>
          </section>

          <section>
            <h2>Changes to this notice</h2>
            <p>
              This is version {NOTICE_VERSION}. If I change it materially you will be asked to
              read and confirm the new version the next time you sign in, and the previous
              versions remain available on request.
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
        <Link href="/accessibility">Accessibility</Link>
        <span aria-hidden="true">·</span>
        <Link href="/sign-in">Sign in</Link>
      </footer>
    </div>
  );
}
