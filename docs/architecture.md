# Architecture — Private diary

One modular monolith with a background worker (spec/14): a Next.js App Router web app
and a Node worker sharing the `src/server/` service layer. PostgreSQL holds all
relational state; MinIO/S3 holds file objects; Mailpit/SMTP delivers neutral emails;
ClamAV scans uploads. Stack rationale: [ADR-006](../spec/decisions/ADR-006-stack-selection.md).

```
browser ──► Next.js (pages render via services; ALL mutations via /api/v1)
                    │
                    ▼
            src/server services ──► PostgreSQL (Drizzle; SQL migrations only)
              │        │  └─ audit_event appended in the same transaction (hash-chained)
              │        └─ outbox_message written in the same transaction
              │
              ▼
        MinIO quarantine bucket ◄── presigned POST direct from the browser
              │
        worker (FOR UPDATE SKIP LOCKED poll)
              ├─ send_email ──► SMTP (neutral text only)
              ├─ scan_attachment: file-type + OOXML inspection + clamd INSTREAM
                     clean ──► copy to clean bucket, delete quarantine copy
                     infected/mismatch ──► quarantined, object deleted
              ├─ generate_diary_export ──► private export bucket (PDF + JSON + files ZIP)
              ├─ diary_reminder ──► neutral 30/7/1-day deletion reminders
              └─ purge_diary ──► object deletion + guarded PostgreSQL purge function
```

## Module boundaries (spec/13)

| Module | Location | Owns |
|---|---|---|
| Identity/tenancy | `src/server/identity`, `src/server/tenancy` | users, sessions, magic links, invitations, memberships |
| Policy | `src/server/policy` | the Actor, pure decision functions (default deny) |
| Framework | `src/server/framework` | package validation/import, releases, curriculum queries |
| Portfolio | `src/server/portfolio` | evidence, revisions, mappings, links, narrative doc |
| Diary lifecycle | `src/server/diary` | snapshots, portable JSON, PDF rendering, finish/reopen |
| Files | `src/server/files` | upload policy, S3, clamd, attachments |
| Audit/outbox | `src/server/audit`, `src/server/outbox` | hash chain, durable queue |
| HTTP plumbing | `src/server/http` | withApi, problem details, idempotency, tenant resolution |

## Enforcement invariants

- **One mutation path**: every domain mutation goes through an `/api/v1` route handler
  wrapped in `withApi` (session, CSRF origin check, zod validation, safe errors).
  Server Components only read, through the same services.
- **Tenant first**: repository queries filter `tenant_id` before anything else;
  cross-tenant identifiers resolve to nothing rather than to a denial.
- **Uniform 404**: object-read denials are byte-identical to not-found (no existence
  oracle), asserted by the generated authorization matrix (`tests/authz`).
- **Owner-only diary**: diary rows, archived rows, links, mappings, attachments,
  revisions, curriculum coverage and export jobs require the owning fellow. Staff
  account/programme administration never joins diary tables.
- **Same-transaction side effects**: audit events (hash-chained per tenant with an
  advisory lock) and outbox messages commit atomically with the state change they
  describe (NFR-S-004).
- **Database as last line**: append-only triggers on `audit_event` and
  `evidence_revision`; published framework releases immutable by trigger; evidence
  objective mappings validated against the enrolment's pinned release by trigger;
  composite `(id, tenant_id)` foreign keys keep tenant chains consistent; a private-only
  check rejects reintroduction of legacy staff visibility; purge is available only through
  a lifecycle- and hold-guarded database function.
- **Narrative safety**: canonical storage is a restricted ProseMirror-style JSON
  document validated server-side (tiny allowlist); HTML is a render-only format
  produced by our own escaping renderer. No user HTML is ever parsed or stored.
- **Uploads**: browser → quarantine bucket via presigned POST (size-capped);
  content-type must match the extension (OOXML zips are inspected for macro parts);
  only `clean` files are downloadable, via ≤5-minute signed URLs issued after a fresh
  authorization check.

## Concurrency model

`evidence_item.row_version` + `If-Match` end to end: a stale save returns 412 with the
current version/author; the losing tab's words are first preserved server-side as an
append-only `conflict_backup` revision, then the author chooses (AC-04). Autosaves
debounce 2 s, mirror to localStorage for offline recovery, and only material changes
snapshot revisions (explicit saves and 30-minute windows).

## Export and retention

An export request creates an immutable point-in-time snapshot and queues only its job ID.
The worker streams original clean attachments into a ZIP alongside a PDF, versioned JSON,
manifest and checksums, then stores the archive in a private bucket. Ordinary exports last
seven days. Finishing a diary locks edits, creates a final export, schedules neutral
30/7/1-day reminders and schedules purge after 90 days. Reopening within that window
supersedes the final copy and invalidates every queued action through the finish-cycle
number. The purge worker requires the matching finished cycle, a due timestamp, no active
hold and a successfully generated final export before deleting content.

## Sessions and identity

Opaque 32-byte tokens, SHA-256-hashed at rest; idle (60 min) and absolute (12 h)
timeouts enforced server-side; sessions rotate on sign-in and on any permission
change (`app_user.permissions_version`). Magic links are single-use, 15-minute,
consumed only by POST from an interstitial page so mailbox scanners cannot spend
them. OIDC (P1) slots in behind `src/server/identity` without call-site changes.

## Runtime configuration and deployment

Every setting is read through `src/server/config/env.ts` (zod-validated,
memoised). Development defaults mirror `docker-compose.yml`; with
`NODE_ENV=production` the process refuses to start on missing values,
`http://` origins, docker-compose credentials or `ALLOW_SEED`. Validation runs
from `src/instrumentation.ts` (web) and `src/worker/index.ts` (worker), and is
skipped only during `next build` page-data collection.

`src/proxy.ts` sets the per-request CSP nonce on both the request headers
(so Next.js applies it to its own inline scripts) and the response, plus HSTS,
frame denial, referrer, COOP/CORP and Permissions-Policy. `withApi` validates
client request IDs, caps JSON bodies, checks `Origin` against `APP_BASE_URL`
only, and derives the rate-limit client IP from `X-Forwarded-For` at the
declared `TRUSTED_PROXY_HOPS` depth. `/api/health` is the liveness probe;
`/.well-known/security.txt` is served when `SECURITY_CONTACT` is set.

The worker also runs hourly housekeeping: rate-limit rows older than a day,
spent/expired magic links older than 7 days and revoked/expired sessions older
than 30 days are deleted (audit rows are never touched). See
`docs/deployment.md` for the container topology and go-live gates.

## End-to-end encryption (ADR-007)

`src/lib/crypto/` holds the browser crypto (envelopes, key wrapping, recovery
keys, device store) and the module-level lock store (`DiaryLockContext.tsx`);
`src/components/lock/` the setup/unlock gate, sealed renderers and the
legacy-sealing migration. Pages wrap their content in `<DiaryLockGate>`
*after* their own authorization so uniform not-found responses survive. The
server validates envelope shape only (`apiSchemas.envelopeSchema`), stores
ciphertext in `content_enc` / `link_enc` / `name_enc`, enforces no-plaintext
`CHECK` constraints, streams sealed files through `/api/v1/attachments/:id/download`,
and serves `/api/v1/enrolments/:id/export-bundle` for the browser-built archive.
