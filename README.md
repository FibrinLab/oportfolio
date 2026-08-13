# oPortfolio

An open-source, framework-driven learning portfolio for the NHS Fellowship in Clinical AI.
A fellow logs evidence and reflective learning against curriculum objectives; a named
supervisor reviews shared items; programme faculty operate cohorts. Private by default,
monochrome typewriter interface, multi-tenant data boundaries from day one.

The full product specification lives in [`spec/`](spec/) and is the source of truth.
Implementation milestones are defined in [`MILESTONES.md`](MILESTONES.md). Architecture
decisions are recorded in [`spec/decisions/`](spec/decisions/) — the implementation stack
is [ADR-006](spec/decisions/ADR-006-stack-selection.md).

## Status

**Milestone 1 — Foundation and Evidence Logging** is implemented:

- Magic-link invitation sign-in, secure rotating sessions, invitation-only accounts
- Tenant / programme / cohort / enrolment model with fellow, supervisor and faculty roles
- FCAI v3.2 framework import (validated against `spec/schemas/framework.schema.json`),
  published releases immutable, enrolments pinned to a release
- Fellow dashboard, curriculum browser and objective drill-down with coverage counts
  (always labelled *mapped evidence, not competence*)
- Evidence creation with autosave, optimistic concurrency (no silent overwrites),
  append-only revision history, eight canonical evidence types, objective/provenance/duty
  mappings, private-by-default visibility with a deliberate share-confirmation step
- Secure uploads: presigned POST to a quarantine bucket, ClamAV + content-type
  inspection, only clean files downloadable via short-lived signed URLs; HTTPS-only
  external links that are never fetched server-side
- Hash-chained, append-only audit log written in the same transaction as each mutation
- Authorization matrix test suite generated over every route (429 cases), WCAG 2.2 AA
  checks (axe + keyboard + 400% zoom) in CI

Milestones 2 (supervision and PDP workflows) and 3 (formal reviews, export, reporting)
are not yet started.

## Local development

Prerequisites: Node 22+, pnpm 10, Docker Desktop.

```sh
pnpm install
cp .env.example .env

# Postgres, MinIO (S3), ClamAV and Mailpit
docker compose up -d

pnpm db:migrate
pnpm framework:import spec/frameworks/fcai/v3.2/framework.json --publish
pnpm seed            # demo tenant, cohort, faculty/supervisor accounts,
                     # and a fellow invitation (URL printed to the console)

pnpm dev             # web app on http://localhost:3000
pnpm worker          # outbox worker (emails, malware scans) — separate terminal
```

Open the invitation URL printed by `pnpm seed` to onboard the demo fellow, or sign in
as `frankie.faculty@example.org` / `sam.supervisor@example.org` — sign-in links arrive
in Mailpit at <http://localhost:8025>.

First `docker compose up` downloads ClamAV signatures (~300 MB); until the container is
healthy, uploaded files stay safely in `pending_scan` and are not downloadable.

## Tests

```sh
pnpm test              # unit: policy truth tables, narrative sanitiser, hash chain,
                       # framework package validation
pnpm test:integration  # against real Postgres: seed counts, immutability triggers,
                       # append-only guards, pinned-release mapping enforcement
pnpm test:authz        # generated authorization matrix over every route (app must be running)
pnpm test:e2e          # Playwright: the Milestone 1 acceptance scenarios (AC-01..05)
                       # plus axe/keyboard/zoom accessibility checks (AC-16 foundations)
pnpm verify:audit-chain
```

The integration/authz/e2e suites expect the local stack above (services, migrations,
framework import, seed, `pnpm dev`, `pnpm worker`) to be running.

## Repository layout

```
spec/               Product specification (source of truth) + ADRs + FCAI package
db/migrations/      Generated + hand-edited SQL migrations (the only schema path)
src/app/            Next.js App Router: pages and /api/v1 route handlers
src/components/     Design-system primitives and the evidence editor
src/server/         Authorization-enforced service layer (identity, policy, audit,
                    outbox, framework, portfolio, files, mail, http plumbing)
src/worker/         Outbox worker (email delivery, upload scanning)
scripts/            migrate / seed / framework-import / invite / verify-audit-chain /
                    openapi-generate
tests/              unit, integration, authz (generated matrix), e2e (Playwright)
docs/openapi.json   Generated OpenAPI 3.1 document (regenerate with pnpm openapi:generate)
```

## Security posture (Milestone 1)

Default-deny authorization combining tenant membership, role, active dated supervisor
assignment, ownership, workflow state and visibility — applied to pages, APIs, counts,
files and downloads. Authorization denials on object reads are byte-identical to
not-found. Private content is excluded at the query level (no fetch-then-redact), and
notifications/emails carry neutral text only. See
[`spec/12-security-privacy-governance.md`](spec/12-security-privacy-governance.md) for
the full threat model and the go-live governance gates that remain before any live pilot.

This codebase has not yet had an independent penetration test or accessibility audit —
both are Milestone 3 gates. Do not deploy with real personal data before the governance
gates in the specification are met.
