# ADR-007: End-to-end encryption of diary content

- Status: Accepted (29 August 2026)
- Deciders: service operator
- Supersedes: the "operator can technically read stored data" limitation in
  the privacy notice and DPIA risk R3 (previously accepted as residual)

## Context

oPortfolio stores candid professional reflections. Owner-only authorization,
audit and encryption at rest still left one honest limitation: whoever runs
the database and object storage could read content directly, and the
application could not log that. The operator did not want to offer a product
with that sentence in its privacy notice.

## Decision

Content is encrypted **in the browser** with a key the server never holds.

**Key hierarchy.** A random 256-bit AES-GCM *diary key* per user is generated
in the browser. It is stored on the server only in wrapped form, twice:
under a KEK derived from the user's passphrase (PBKDF2-SHA256, 600 000
iterations, 16-byte salt) and under a KEK derived from a one-time
*recovery key* (128 random bits shown once as 26 base32 characters, HKDF-SHA256).
Either secret unlocks; changing the passphrase re-wraps the same diary key and
issues a new recovery key, so content is never re-encrypted. Losing both
secrets makes the diary unrecoverable — by design, and stated at setup.

**What is sealed.** Entry titles and narratives, link URLs/hosts/labels,
file names/types and file bytes. Each value is an AES-256-GCM envelope
(`{v, alg, kid, iv, ct}`) with additional authenticated data binding it to
its record and field (`evidence:title:<id>`, `link:<id>`,
`attachment:bytes:<id>`…), so ciphertext cannot be moved between rows. Files
use an `OPE1` container (magic, 12-byte IV, ciphertext). Database `CHECK`
constraints refuse plaintext in the legacy columns whenever a row is marked
`encrypted`. Revisions and conflict backups snapshot ciphertext.

**What stays in clear (metadata).** Entry ids, dates, entry type, objective
mappings, timestamps, file sizes, scan state, audit rows. These are needed for
lists, coverage counts and retention and reveal no content.

**Consequences accepted.**
- Uploaded files cannot be malware-scanned or type-checked server-side; they
  are stored as `sealed` (a distinct state, never mistaken for scanned-clean),
  the browser applies the type allowlist before encrypting, and the UI says so.
  Only the author can ever open them.
- Diary export is built in the browser (ZIP with PDF, JSON, attachments,
  manifest, checksums). No server-side final copy exists at finish; the
  finish screen requires an explicit "I have downloaded" confirmation.
- No server-side search of content (there was none).
- Entries created before this ADR are sealed automatically at the user's
  first unlock (`/api/v1/me/unsealed` inventory + browser migration).
- Unsaved drafts are no longer mirrored to `localStorage` in plaintext.
- The non-extractable `CryptoKey` is kept in IndexedDB for that origin so
  full page loads within a sign-in do not re-prompt; it expires with the
  auth session (12 h) and is cleared on sign-out, lock or passphrase change.
  "Keep this device unlocked" removes the expiry.

## Threat model after this change

| Threat | Result |
|---|---|
| Operator/DB admin reads database or buckets | Ciphertext only; wrapped keys need the passphrase or recovery key |
| Backup or dump leaks | Same |
| Malicious server-side code (or a compromised operator) serves altered JavaScript | **Not defended** — the browser trusts the code it is served. Mitigations: open-source build, CSP with nonces, no third-party scripts, reproducible container images. This is the residual limitation the privacy notice now states |
| XSS in the app | Could read the in-memory key for that session — strict CSP and React-only rendering of decrypted content (no HTML strings) |
| Lost passphrase and recovery key | Diary unrecoverable |

## Alternatives rejected

- Server-side envelope encryption with a KMS-held master key: protects
  against storage leaks but the application can still decrypt, so the
  privacy-notice sentence would have had to stay.
- Per-entry keys shared with supervisors: no supervisor read path exists.
