# Delivery plan

## Recommended build shape

Build one modular web application with background workers and clear module boundaries, not distributed microservices. A reference stack can be selected by the implementation team; this specification assumes:

- server-rendered TypeScript web app with progressively enhanced client interactions;
- PostgreSQL for relational records/search baseline;
- S3-compatible private object storage;
- durable queue/outbox for scans, notifications and exports;
- OIDC identity;
- isolated workers for uploads/previews/PDF;
- infrastructure as code and containerized local/hosted deployment.

Technology choice is subordinate to the security, accessibility, portability and data-integrity requirements. Record it in an ADR before scaffolding.

## Delivery slices

### Phase 0 — discovery and assurance (2–4 weeks)

Outcomes:

- Obtain canonical Cohort 5/6 curriculum and three supervision templates.
- Observe current portfolio/review work with at least 5 fellows, 3 supervisors and 2 faculty users.
- Confirm controller/processor, intended pilot host/tenant, lawful-basis analysis, DPIA screening, records classes and accessibility needs.
- Agree MVP success measures and pilot cohort.
- Threat-model the architecture and select stack/hosting/identity.
- Prototype evidence entry, visibility, supervisor queue and midpoint sign-off in monochrome UI.

Exit: faculty signs curriculum/template configuration; IG/security/accessibility owners accept discovery actions; product owner approves revised spec/ADRs.

### Phase 1 — foundation (2–3 weeks)

- Repository standards, CI, environments, IaC and synthetic fixtures.
- Tenant, user, membership, cohort, enrolment and supervisor assignment.
- OIDC/invitations, MFA/reauth paths, session/access policy.
- Audit/outbox, structured safe logging and monitoring skeleton.
- Framework JSON Schema, import CLI/admin preview and FCAI v3.2 seed.
- Design tokens, shell and accessible component baseline.

Exit: cross-tenant authorization suite passes; a synthetic fellow can sign in and see the pinned curriculum only.

### Phase 2 — log and discuss (3–4 weeks)

- Evidence CRUD/revisions, eight types, provenance/duties/objective mappings.
- Restricted editor, autosave/concurrency, search/filter.
- File quarantine/scan/private download and safe external links.
- Visibility/audience controls and reflection safeguards.
- Comments, threads, mentions, review requests and neutral notifications.
- Fellow Today/log/curriculum views and supervisor queue.

Exit: end-to-end evidence/share/comment flow passes accessibility, privacy and upload-security tests.

### Phase 3 — PDP and supervision (2–3 weeks)

- PDP goals, milestones, revision/agreement and SWOT.
- Weekly/ad-hoc supervision logs, action items and agreement.
- Programme deadlines/reminders.
- Supervisor fellow overview.

Exit: induction preparation can cite an agreed PDP and recent supervision records.

### Phase 4 — formal reviews and export (3–4 weeks)

- Versioned form templates and three configured review types.
- Candidate/final snapshots, hashes, signatures, acknowledgement and amendments.
- Portfolio builder, HTML/PDF and structured archive.
- Signed-record integrity checks and retention locks.

Exit: induction/midpoint/end scenarios, snapshot tamper tests and accessible export QA pass.

### Phase 5 — faculty operations and pilot readiness (2–3 weeks)

- Cohort dashboard, assignment/deadline administration, framework/template publication.
- Cohort CSV and aggregate disclosure controls.
- Retention/disposal/DSAR support workflows required by the pilot.
- Access review, support runbooks, backup/restore, incident exercise, pen test and accessibility audit.
- Training, onboarding copy, privacy notice/help and feedback collection.

Exit: every go-live gate in `12-security-privacy-governance.md` has named approval/evidence or pilot is not launched.

### Phase 6 — controlled pilot (8–12 weeks, overlaps programme)

- Start with a small consenting operational cohort under the approved basis; do not load historic real data by default.
- Weekly service review for first month, then fortnightly.
- Track support, privacy misunderstanding, accessibility barriers, save/upload failures, response time and formal-review readiness.
- Conduct 4- and 8-week research; publish change log.
- No automated performance decisions or feature expansion during pilot without change review.

Exit: product/IG/security/faculty/fellow representatives decide stop, extend or roll out using agreed measures.

## MVP epics and dependencies

| Epic | Depends on | Completion evidence |
|---|---|---|
| E1 Identity/tenancy | Controller/IdP decision | AuthZ suite, access review, session test |
| E2 Framework engine | Canonical source | Schema/package validation, pinned release test |
| E3 Evidence/files | E1/E2, upload policy | E2E entry/share; malware and privacy tests |
| E4 Feedback/notifications | E3 | Thread/revision/access/neutral-email tests |
| E5 PDP/supervision | E1/E2 | Agreement/snapshot-source tests |
| E6 Formal review/signing | E2/E3/E5/templates | Hash/sign/amend/export acceptance |
| E7 Dashboards/reporting | E1–E6/metric definitions | Permission/suppression/drill-down tests |
| E8 Lifecycle/operations | Retention/controller/hosting | Restore, disposal, hold, incident exercises |

## Suggested backlog order

Deliver vertical, deployable stories rather than completing database/UI/API layers separately:

1. Invite fellow + pinned curriculum read.
2. Save private text evidence + map objective.
3. Share evidence + supervisor read.
4. Request review + comment + neutral notification.
5. Upload clean file + authorised download; reject malicious fixture.
6. Draft/agree PDP goal.
7. Draft/agree supervision log/action.
8. Prepare/submit/sign/acknowledge induction review snapshot.
9. Build/export a fellow PDF/JSON archive.
10. Faculty sees operational cohort state with privacy boundary.

Each story includes audit, authorization, accessibility, error/offline and observability—not separate hardening tickets.

## Data migration/import

MVP does not promise automated import of unstructured Word/Drive portfolios. For a pilot:

1. invite fellows to start current/future records in oPortfolio;
2. provide bulk metadata/evidence CSV plus file upload only if faculty has a justified need;
3. stage imports in quarantine, validate tenant/enrolment/objective IDs and preview per fellow;
4. preserve original source/date/author and mark `imported`;
5. fellow confirms visibility/mappings before supervisor access;
6. retain/import-source files only according to policy.

Never infer curriculum mappings from reflection text automatically in MVP.

## Release strategy

- Feature flags per pilot tenant/cohort, not user-secret experiments on privacy/signature behavior.
- Database migrations are expand/migrate/contract with tested roll-forward; do not roll back by discarding new user data.
- Release notes describe user-visible, schema/framework/template and governance changes.
- Framework/template publication is separate from app deployment and uses its own approval/audit.
- Emergency security fix may bypass ordinary cadence but retains review, evidence and retrospective.

## Open-source readiness

Before public release:

- choose an OSI-approved licence and document third-party licences;
- remove secrets/tenant identifiers/sample real data and scan repository history;
- provide `SECURITY.md`, `CONTRIBUTING.md`, code of conduct and vulnerability route;
- document one-command synthetic local setup, upgrade/migrations, backup/restore and deployment reference;
- publish framework provenance/licensing and clearly separate official source from proposal;
- define maintainers, release signing, supported versions and security-fix policy.

“Open source” does not make a deployment governed or supported. Deployment documentation must state adopter responsibilities.

## Post-MVP candidates

Prioritise only after pilot evidence:

1. Verified newer FCAI release and migration tool.
2. Funder portal with approved thresholding.
3. GitHub App and GitLab adapter.
4. Home-specialty mapping/export connectors.
5. General framework/template authoring UI.
6. SSO/SCIM multi-tenant rollout automation.
7. E-learning completion imports.

Generative AI, automated mapping, scoring or review drafting requires a separate product case, DPIA/threat-model update, bias/quality evaluation, clear human control and a design that never trains on portfolio content by default.

