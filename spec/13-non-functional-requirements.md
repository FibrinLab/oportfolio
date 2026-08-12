# Non-functional requirements

Unless measured otherwise, service-level targets apply to the production pilot under expected load and exclude announced maintenance/approved upstream identity outages. They are initial targets for architecture and must be agreed with the service owner.

## Performance

| ID | Requirement |
|---|---|
| NFR-P-001 | Server-rendered/app shell page p75 ≤1.5 s and p95 ≤2.5 s on typical NHS workplace broadband, excluding large attachment preview. |
| NFR-P-002 | Read API p95 ≤500 ms and mutation p95 ≤800 ms under pilot steady load. |
| NFR-P-003 | Evidence search p95 ≤1 s for a fellow with 5,000 items and a tenant with 100,000 items, after access filtering. |
| NFR-P-004 | Autosave acknowledgement p95 ≤1 s; local-only state displayed within 300 ms on connectivity loss. |
| NFR-P-005 | 95% of portfolios with 500 evidence items and 250 MB permitted attachments render within 5 minutes; larger jobs show progress and complete within 15 minutes or fail safely. |
| NFR-P-006 | Initial JS ≤250 kB gzip per ordinary route where practical; rich editor/chart code loads only when needed. |

## Scale baseline

Pilot: 1 tenant, 2 cohorts, 100 fellows, 150 supervisors/faculty, 500 concurrent sessions, 100,000 evidence records, 1 TB attachments. Architecture should scale horizontally to 50 tenants/10,000 active users without redesigning tenant boundaries, but no unsupported “internet scale” claim is required.

## Availability and resilience

| ID | Requirement |
|---|---|
| NFR-A-001 | Monthly service availability target 99.9% for interactive functions after pilot stabilisation; publish maintenance windows. |
| NFR-A-002 | RPO ≤15 minutes for database records and attachment metadata; RTO ≤4 hours for priority service. Signed snapshots target no acknowledged data loss through durable replicated storage. |
| NFR-A-003 | Point-in-time database recovery, object versioning/backup, encrypted off-account/isolated backup and quarterly restore tests. |
| NFR-A-004 | Queue/idempotency prevents duplicate notifications, signatures, snapshot finalisation and exports after retry. |
| NFR-A-005 | Dependency failure degrades safely: identity outage blocks new auth; scan outage blocks sharing files; email outage retains in-app notices; analytics outage never blocks portfolio work. |
| NFR-A-006 | Status page and in-app neutral service notice are available through the incident process. |

## Security and privacy

| ID | Requirement |
|---|---|
| NFR-S-001 | Zero known critical/high exploitable findings at release; exceptions require time-bound risk acceptance by named owner. |
| NFR-S-002 | Tenant isolation and object authorisation automated tests cover all endpoints/background jobs; any regression blocks release. |
| NFR-S-003 | Security patches: critical 72 hours, high 14 days, medium 60 days unless documented risk decision is stricter. |
| NFR-S-004 | Audit events append within the transaction/outbox boundary and reach central monitoring p95 ≤5 minutes. |
| NFR-S-005 | Access revocation takes effect across interactive/file/export paths within 5 minutes, immediately for new requests where architecture permits. |
| NFR-S-006 | Export/download URLs expire ≤24 h, attachment URLs ≤5 min by default. |
| NFR-S-007 | Production data is not used in test/development. Synthetic fixtures contain no real people/patients. |

## Accessibility and usability

| ID | Requirement |
|---|---|
| NFR-U-001 | WCAG 2.2 AA target and gates in `11-accessibility.md`. |
| NFR-U-002 | All P0 flows complete with keyboard alone and at 400% zoom. |
| NFR-U-003 | Core task research completion ≥90% without facilitation after iterative pilot design. |
| NFR-U-004 | Users can correctly state reflection audience and evidence-coverage meaning in moderated testing; any systematic misconception blocks launch. |
| NFR-U-005 | Plain English content target approximately age 12–14 where technical curriculum terms do not require more; define acronyms. |

## Compatibility

Responsive web supports current and previous major stable Chrome, Edge, Firefox and Safari at the time of each release; iOS Safari and Android Chrome for P0 fellow/supervisor tasks. JavaScript is required for rich workflows, but public privacy/help/status and a safe unsupported/no-JS message must render.

## Data integrity

- Transactions keep state transition, snapshot/signature and audit/outbox coherent.
- Framework/template packages and signed snapshots use SHA-256 or current approved successor.
- UTC storage; tenant timezone display; date-only semantics preserved.
- Optimistic concurrency prevents last-write-wins loss.
- Daily automated integrity checks find orphan attachments, broken mappings, invalid signatures/hashes, cross-tenant key mismatches and stuck jobs.
- Monthly signed-snapshot sample verifies rendered PDF/checksum availability.

## Operability

- Structured logs, metrics and traces share request/correlation ID and avoid content/secret leakage.
- Dashboards: availability/latency/errors, auth/authorization denial, database/queue/storage, malware scan, notifications, export/render, backup and integrity.
- Actionable alerts have runbook/owner/severity; avoid paging on user validation errors.
- Admin changes use infrastructure/configuration as code where possible.
- Feature flags are tenant-scoped, audited and have owners/expiry; they cannot weaken authorization controls.

## Maintainability and portability

- Versioned database migrations with forward/backward deployment compatibility and tested backup restore.
- Modular boundaries: identity/tenancy, framework, portfolio/PDP, feedback/review, files, reporting/export, audit/policy.
- PostgreSQL-compatible relational database and S3-compatible private object storage are preferred to support self-hosting.
- Containerized deployment; documented environment variables/secrets, health checks, backup/restore and upgrade path.
- Framework packages, templates and core schemas are open/documented. Do not lock user content in proprietary binary formats.
- Public repository includes licence, contribution/security policies, architecture docs and reproducible local setup before open-source release.

## Sustainability

- Avoid polling when events/invalidation work; batch notifications/exports.
- Image/PDF previews are size-limited and generated once per checksum.
- Apply storage lifecycle to quarantine/temp/export objects.
- Measure job/storage cost by tenant without exposing content; capacity plans include backup/egress costs.

## Environments

Local, test, staging and production are isolated accounts/projects with separate secrets and buckets/databases. Staging uses synthetic representative scale. Production changes follow review, automated tests, migration rehearsal, rollback/roll-forward plan and release notes. Formal-review schema changes receive special integrity testing.
