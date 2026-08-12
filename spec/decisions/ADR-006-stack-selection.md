# ADR-006: Implementation stack selection

Status: accepted
Date: 12 August 2026
Deciders: product owner (user), implementation team

## Context

`14-delivery-plan.md` requires the stack to be recorded in an ADR before scaffolding. The specification assumes a server-rendered TypeScript web app with progressively enhanced client interactions, PostgreSQL, S3-compatible private object storage, a durable queue/outbox, OIDC identity and isolated workers. Technology choice is subordinate to the security, accessibility, portability and data-integrity requirements.

## Decision

One modular monolith (web app + background worker), containerised local development, built with:

| Concern | Choice | Rationale |
|---|---|---|
| Web framework | Next.js (App Router), TypeScript strict, React Server Components | Server-rendered; RSC keeps per-route JS within NFR-P-006 (≤250 kB gzip); large ecosystem |
| Database | PostgreSQL 17 | Spec baseline; relational records and search |
| DB access | Drizzle ORM with generated SQL migrations, hand-edited | SQL-first migrations allow triggers, composite tenant FKs, partial indexes and append-only guards. `drizzle-kit push` is forbidden; migrations are the only schema path |
| IDs | UUIDv7, application-generated (`uuidv7` package) | Non-guessable, time-sortable per `05-data-model.md` |
| Identity (pilot) | Magic-link invitation flow, hand-rolled sessions (`node:crypto`; only SHA-256 of tokens stored) behind an `IdentityProvider` interface | Sanctioned pilot alternative in `07-api-and-integrations.md`; invitation-only accounts; OIDC (P1) slots in behind the same interface |
| Rich text | TipTap (ProseMirror), lazy-loaded; canonical storage is restricted ProseMirror JSON; hand-written server-side validator and HTML renderer | `05-data-model.md`: portable structured doc, HTML render-only; small allowlist is safer walked by hand |
| Object storage | S3-compatible (MinIO locally) via `@aws-sdk/client-s3` | Portability (`13-non-functional-requirements.md`) |
| Malware scanning | ClamAV (clamd INSTREAM) in Docker; hand-rolled ~50-line client | Real engine locally; wrapper libraries unmaintained |
| Queue | PostgreSQL outbox table + worker polling `FOR UPDATE SKIP LOCKED` | NFR-S-004 requires same-transaction outbox; avoids a Redis dependency |
| Email | nodemailer → SMTP (Mailpit locally) | Neutral-content emails only |
| CSS | Plain CSS custom properties + CSS Modules | `10-design-system.md` supplies literal tokens; monochrome system is small; no Tailwind dependency |
| Fonts | IBM Plex Mono/Sans WOFF2 committed in-repo with OFL licence, loaded via `next/font/local` | No third-party font CDN (spec/10) |
| Validation | zod (inputs); Ajv 2020-12 (framework packages) | Framework schema is JSON Schema 2020-12 |
| Testing | Vitest (unit/integration against real composed services), Playwright + axe-core | `15-test-and-acceptance.md` |
| API docs | zod-openapi generated OpenAPI 3.1, committed with CI drift check | `07-api-and-integrations.md` |

Architecture rule: a single authorization-enforced service layer in `src/server/`. Server Components call services directly for reads; all domain mutations go through `/api/v1` route handlers (If-Match + Idempotency-Key), giving one mutation path to test. Server Actions are not used for domain mutations.

## Open risks and dependencies

1. **MFA**: `07-api-and-integrations.md` conditions the magic-link pilot path on phishing-resistant MFA for supervisors/faculty, subject to controller acceptance. Milestone 1 ships supervisor read-only access without MFA step-up; WebAuthn step-up is scheduled for Milestone 2 and the controller-acceptance dependency is recorded here.
2. **CSP**: script-src is nonce-based with `strict-dynamic`; development requires `unsafe-eval` (dev-only). `style-src 'unsafe-inline'` is currently allowed (styles only); tightening it is tracked for the security-test phase.
3. **Audit hash chain** uses a per-tenant advisory lock; contention is acceptable at pilot scale and will be revisited only if measured.

## Consequences

- Local development requires Docker (Postgres, MinIO, ClamAV, Mailpit) via one `docker compose up`.
- OIDC/SCIM (P1) must not require call-site changes: everything auth-related stays behind `src/server/identity/provider.ts`.
- Self-hosting portability is preserved: PostgreSQL-compatible DB + S3-compatible storage + SMTP are the only external service assumptions.
