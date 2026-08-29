# oPortfolio

An independent private diary for personal learning and reflection. Anyone can sign up with
an email address, write free-form entries, keep useful links and files together, and download
the complete retained diary at any time. No programme invitation or approval is required.

This began as a weekend project for my own reflections and is now being extended to others
who may find it useful. It is not commissioned by, affiliated with, or endorsed by the NHS
Fellowship in Clinical AI or any NHS organisation.

The current private-diary contract is captured here, in
[`docs/diary-export.md`](docs/diary-export.md), and in the generated OpenAPI document.
The broader historical product specification and roadmap remain in [`spec/`](spec/) and
[`MILESTONES.md`](MILESTONES.md). Architecture decisions are recorded in
[`spec/decisions/`](spec/decisions/); the implementation stack is
[ADR-006](spec/decisions/ADR-006-stack-selection.md).

## Status

The private-diary foundation is implemented:

- Self-service passwordless sign-up and sign-in with secure rotating sessions
- One isolated, single-member diary workspace for each new verified email identity
- FCAI v3.2 framework import (validated against `spec/schemas/framework.schema.json`),
  published releases immutable, enrolments pinned to a release
- Fellow dashboard, curriculum browser and objective drill-down with coverage counts
  (always labelled *mapped evidence, not competence*)
- Free-form diary entries with autosave, optimistic concurrency (no silent overwrites),
  append-only revision history, optional entry types and optional curriculum mappings
- Secure uploads: presigned POST to a quarantine bucket, ClamAV + content-type
  inspection, only clean files downloadable via short-lived signed URLs; HTTPS-only
  external links that are never fetched server-side
- Hash-chained, append-only audit log written in the same transaction as each mutation
- Owner-only authorization for entries, archived entries, revisions, links, files,
  curriculum views and generated exports—even legacy shared rows are narrowed to private
- Portable ZIP exports containing a readable PDF, versioned JSON, retained attachments,
  a manifest and SHA-256 checksums
- Finish/reopen lifecycle: finishing locks the diary and creates a final copy; reopening
  within 90 days cancels that deletion cycle; due content is purged unless an admin hold exists
- Authorization matrix and Playwright coverage over every current route

## Local development

Prerequisites: Node 22+, pnpm 10, Docker Desktop.

```sh
pnpm install
cp .env.example .env

# Postgres, MinIO (S3), ClamAV and Mailpit
docker compose up -d

pnpm db:migrate
pnpm framework:import spec/frameworks/fcai/v3.2/framework.json --publish
pnpm seed            # optional local reference data and synthetic test accounts

pnpm dev             # web app on http://localhost:3000
pnpm worker          # emails, malware scans, exports, reminders and purge jobs
```

Open <http://localhost:3000/sign-in> and enter any email address. The single-use access link
arrives in Mailpit at <http://localhost:8025>; following it creates the private diary on first
use and signs into it thereafter. There is no sign-in bypass.

First `docker compose up` downloads ClamAV signatures (~300 MB); until the container is
healthy, uploaded files stay safely in `pending_scan` and are not downloadable.

## Tests

```sh
pnpm test              # unit: policy truth tables, narrative sanitiser, hash chain,
                       # framework package validation, production config guard rails
pnpm audit:prod        # known vulnerabilities in the production dependency tree
pnpm test:integration  # against real Postgres: seed counts, immutability triggers,
                       # append-only guards, pinned-release mapping enforcement
pnpm test:authz        # generated authorization matrix over every route (app must be running)
pnpm test:e2e          # Playwright: private access, editing, export and lifecycle
pnpm verify:audit-chain
```

The integration/authz/e2e suites expect the local stack above (services, migrations,
framework import, seed, `pnpm dev`, `pnpm worker`) to be running.

## Deployment

Production builds are container images from the multi-stage `Dockerfile`
(`--target web`, `--target worker`); `docker-compose.prod.yml` is a reference
topology. Configuration is environment-only and validated at startup — the app
**refuses to start** in production with development credentials, non-HTTPS
origins or seeding enabled. Health: `GET /api/health`. Vulnerability disclosure
contact: `/.well-known/security.txt` (from `SECURITY_CONTACT`).

Read [`docs/deployment.md`](docs/deployment.md) for the variable reference,
platform controls (TLS, buckets, SMTP, backups), the release procedure and the
go-live gate status, and [`SECURITY.md`](SECURITY.md) for reporting issues.

## Repository layout

```
spec/               Historical product specification + ADRs + FCAI package
db/migrations/      Generated + hand-edited SQL migrations (the only schema path)
src/app/            Next.js App Router: pages and /api/v1 route handlers
src/components/     Design-system primitives and the diary editor
src/server/         Authorization-enforced service layer (identity, policy, audit,
                    outbox, framework, portfolio, files, mail, http plumbing)
src/worker/         Outbox worker (mail, scanning, export, reminders and purge)
scripts/            migrate / seed / framework-import / invite / verify-audit-chain /
                    openapi-generate
tests/              unit, integration, authz (generated matrix), e2e (Playwright)
docs/openapi.json   Generated OpenAPI 3.1 document (regenerate with pnpm openapi:generate)
docs/deployment.md  Container topology, configuration, operations, go-live gates
Dockerfile          web + worker images (non-root, production deps only)
```

## Privacy and retention posture

Diary authorization is owner-only and default-deny across pages, APIs, curriculum counts,
files and downloads. A supervisor/faculty role or historical visibility value never grants
content access. Authorization denials on object reads are byte-identical to not-found,
and notifications carry neutral text only. Export snapshots and ZIP objects are scrubbed
on expiry; diary content is purged after a finished diary's 90-day access window unless an
active retention hold exists. See [the export and lifecycle contract](docs/diary-export.md)
and
[`spec/12-security-privacy-governance.md`](spec/12-security-privacy-governance.md) for
the full threat model and the go-live governance gates that remain before any live pilot.

This codebase has not yet had an independent penetration test or accessibility audit —
both are Milestone 3 gates. A draft DPIA is in [`docs/dpia.md`](docs/dpia.md) and the
accessibility statement is published at `/accessibility`. Do not deploy with real personal data before the governance
gates in [`docs/deployment.md`](docs/deployment.md#6-go-live-gates-spec12--status-for-this-codebase) are met.

## Licence

Source code is released under the [MIT Licence](LICENSE), © 2026 Akanimoh Osutuk.
The bundled IBM Plex fonts are under the SIL Open Font License 1.1
(`src/fonts/OFL.txt`). The FCAI curriculum package in `spec/frameworks/` remains the
property of its publisher and is included for interoperability; see `spec/sources.md`.
