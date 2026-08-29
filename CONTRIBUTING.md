# Contributing

Thank you for helping build a safe private diary for NHS fellows.

## Ground rules

- **No real personal or patient data, ever** — in fixtures, tests, issues,
  screenshots or pull requests. `pnpm seed` provides synthetic accounts.
- **Security issues go through [SECURITY.md](SECURITY.md)**, not the issue
  tracker.
- `spec/` is the source of truth for behaviour; a change that contradicts it
  needs an ADR in `spec/decisions/` first.
- Authorization is owner-only and default-deny. Any new route must be added to
  `tests/authz/registry.ts` (the completeness test fails otherwise) and must
  return the uniform not-found on denial.
- Schema changes are SQL migrations in `db/migrations/` only — never
  `drizzle-kit push`. Append-only tables (audit, revisions) stay append-only.

## Workflow

1. Read `AGENTS.md` — this project runs on a Next.js version whose conventions
   differ from older documentation.
2. Branch from `main`; keep pull requests focused.
3. Before pushing:
   ```sh
   pnpm lint && pnpm typecheck && pnpm test && pnpm audit:prod
   pnpm openapi:generate      # commit docs/openapi.json if a route changed
   ```
   The integration, authz and e2e suites need the local stack from the README.
4. CI runs lint, typecheck, unit tests, dependency audit, secret scanning,
   CodeQL, container build + image scan, and the full stack suites. All must
   be green.
5. Describe the privacy/security impact of the change in the PR description
   (what data is touched, which roles can reach it).

## Licence

By contributing you agree that your contributions are licensed under the
project licence in `LICENSE` (see the README for the current status).
