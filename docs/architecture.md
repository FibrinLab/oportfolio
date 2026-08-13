# Architecture — Milestone 1

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
              └─ scan_attachment: file-type + OOXML inspection + clamd INSTREAM
                     clean ──► copy to clean bucket, delete quarantine copy
                     infected/mismatch ──► quarantined, object deleted
```

## Module boundaries (spec/13)

| Module | Location | Owns |
|---|---|---|
| Identity/tenancy | `src/server/identity`, `src/server/tenancy` | users, sessions, magic links, invitations, memberships |
| Policy | `src/server/policy` | the Actor, pure decision functions (default deny) |
| Framework | `src/server/framework` | package validation/import, releases, curriculum queries |
| Portfolio | `src/server/portfolio` | evidence, revisions, mappings, links, narrative doc |
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
- **Same-transaction side effects**: audit events (hash-chained per tenant with an
  advisory lock) and outbox messages commit atomically with the state change they
  describe (NFR-S-004).
- **Database as last line**: append-only triggers on `audit_event` and
  `evidence_revision`; published framework releases immutable by trigger; evidence
  objective mappings validated against the enrolment's pinned release by trigger;
  composite `(id, tenant_id)` foreign keys keep tenant chains consistent (invariant 1).
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
snapshot revisions (explicit saves, share/visibility transitions, 30-minute windows).

## Sessions and identity

Opaque 32-byte tokens, SHA-256-hashed at rest; idle (60 min) and absolute (12 h)
timeouts enforced server-side; sessions rotate on sign-in and on any permission
change (`app_user.permissions_version`). Magic links are single-use, 15-minute,
consumed only by POST from an interstitial page so mailbox scanners cannot spend
them. OIDC (P1) slots in behind `src/server/identity` without call-site changes.
