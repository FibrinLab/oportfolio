# oPortfolio product specification

Status: implementation-ready baseline  
Specification version: 1.0.0-draft  
Prepared: 12 August 2026  
Working product name: **oPortfolio**

oPortfolio is an open-source, framework-driven learning portfolio for the NHS Fellowship in Clinical AI. A fellow logs evidence and reflective learning against curriculum objectives; a named supervisor reviews, comments and signs formal reviews; programme faculty oversee a cohort; funders see privacy-preserving aggregate outcomes.

The first packaged curriculum is FCAI v3.2 (Cohort 3, 2024). The engine is deliberately curriculum-agnostic: a programme enrolment pins an immutable framework release, while other curricula can be imported without application-code changes.

## Product principles

1. **Log once, map many times.** One evidence item may support many learning objectives and external frameworks.
2. **Private by default.** Drafts and reflections begin fellow-only. Sharing is explicit and visible.
3. **Feedback is a conversation.** Supervisors comment in contextual, resolvable threads; they do not silently edit a fellow's work.
4. **Signed reviews are records.** Formal reviews use immutable snapshots and append-only amendments.
5. **Framework versions are first-class.** Existing enrolments never drift when a curriculum changes.
6. **No patient record.** The service is not a clinical record or incident-reporting system and must not contain patient-identifiable data.
7. **Calm and legible.** The interface is simple black and white, typographic, keyboard-friendly and printable.
8. **Portable by design.** Fellows can export a human-readable PDF and machine-readable archive.

## Reading order

| Document | Purpose |
|---|---|
| [00-product-brief.md](00-product-brief.md) | Problem, outcomes, assumptions, scope and success measures |
| [01-roles-and-access.md](01-roles-and-access.md) | Personas, tenancy and permissions |
| [02-information-architecture.md](02-information-architecture.md) | Navigation, object hierarchy and screen inventory |
| [03-functional-requirements.md](03-functional-requirements.md) | Normative, traceable product requirements |
| [04-workflows-and-states.md](04-workflows-and-states.md) | Evidence, comments, PDP and formal review state machines |
| [05-data-model.md](05-data-model.md) | Entities, invariants, relationships and retention behavior |
| [06-forms-and-content.md](06-forms-and-content.md) | Field-level forms, validation and microcopy |
| [07-api-and-integrations.md](07-api-and-integrations.md) | API shape, authentication, uploads, GitHub and import/export |
| [08-reporting-and-export.md](08-reporting-and-export.md) | Dashboards, metrics, PDF and structured exports |
| [09-ux-ui-spec.md](09-ux-ui-spec.md) | Screen behavior, responsive layouts and interaction patterns |
| [10-design-system.md](10-design-system.md) | Black-and-white typewriter visual language and tokens |
| [11-accessibility.md](11-accessibility.md) | WCAG target and component/content requirements |
| [12-security-privacy-governance.md](12-security-privacy-governance.md) | Threats, privacy model, audit, controller questions and go-live gates |
| [13-non-functional-requirements.md](13-non-functional-requirements.md) | Performance, resilience, operability and compatibility |
| [14-delivery-plan.md](14-delivery-plan.md) | MVP slices, dependencies, migration and launch gates |
| [15-test-and-acceptance.md](15-test-and-acceptance.md) | Test strategy and end-to-end acceptance scenarios |
| [16-open-questions.md](16-open-questions.md) | Decisions to validate with faculty, fellows, supervisors and IG |
| [17-requirements-traceability.md](17-requirements-traceability.md) | Outcomes-to-requirements-to-tests map |
| [sources.md](sources.md) | Primary sources, verification status and derived assumptions |
| [decisions/](decisions/) | Architecture and product decision records |
| [frameworks/fcai/v3.2/framework.json](frameworks/fcai/v3.2/framework.json) | Importable FCAI v3.2 package |
| [schemas/framework.schema.json](schemas/framework.schema.json) | Framework-package JSON Schema |

## Normative language and priorities

“Must”, “should” and “may” are used as in RFC 2119. Requirement IDs are stable. Priorities mean:

- **P0** — required for a safe pilot/MVP.
- **P1** — required before general programme rollout.
- **P2** — valuable follow-on capability.

Where this specification conflicts with a signed data-controller decision, approved DPIA, organisational retention schedule or a later canonical curriculum, that approved source prevails. Record the change in an ADR and increment this specification version.

## Definition of the MVP

The MVP supports one tenant and one active FCAI cohort, but its data boundaries must remain multi-tenant. It includes secure sign-in; invitation and role assignment; framework-pinned enrolment; evidence, files, links and reflection visibility; PDP goals; supervision notes; threaded comments; three formal review templates with snapshots/sign-off; fellow and supervisor dashboards; faculty cohort reporting; audit; notifications; and PDF/JSON export.

Native GitHub OAuth ingestion, external framework authoring UI, funder portal, SSO provisioning automation and portfolio-to-portfolio push are post-MVP. The MVP still supports a code artefact as a manually entered URL with descriptive metadata.

