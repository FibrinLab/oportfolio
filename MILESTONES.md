# oPortfolio — Implementation Milestones

Use the full product specification in [`spec/`](spec/) as the source of truth. Complete these milestones in order. Do not weaken the privacy, authorization, accessibility, audit or signed-record requirements to finish a milestone.

## Milestone 1 — Foundation and Evidence Logging

### Goal

Build the secure application foundation and the fellow’s core evidence-logging workflow.

### Scope

- Authentication and secure sessions
- Tenant, programme, cohort and enrolment models
- Fellow, supervisor and faculty roles
- Supervisor assignments
- FCAI v3.2 framework import and enrolment pinning
- Fellow dashboard and curriculum browser
- Evidence creation, editing and revision history
- Eight canonical evidence types
- Objective, provenance, duty and PDP mappings
- Private-by-default visibility controls
- Secure file uploads and external links
- Responsive black-and-white typewriter design system
- WCAG 2.2 AA foundations
- Authorization and audit logging

### Definition of done

A fellow can:

1. Sign in and see their assigned programme, supervisor and pinned curriculum version.
2. Create and autosave a private evidence item.
3. Map the item to one or more curriculum objectives.
4. Attach a clean scanned file or safe HTTPS link.
5. Preview the audience and deliberately share the item with their supervisor.

Cross-tenant and unauthorized access tests must pass. Private evidence must not leak through search, notifications, files, URLs, analytics or dashboard counts.

---

## Milestone 2 — Supervision and Portfolio Workflows

### Goal

Build the collaboration and development-planning workflows used by fellows and supervisors throughout the programme.

### Scope

- Supervisor dashboard and review queue
- Explicit evidence review requests
- Contextual threaded comments and replies
- Comment resolution and revision context
- Neutral in-app and email notifications
- PDP goals, milestones and objective mappings
- PDP revision and agreement workflow
- Private-by-default SWOT tool
- Weekly and ad-hoc supervision logs
- Supervision actions, owners and deadlines
- Joint agreement and locked supervision records
- Fellow and supervisor curriculum coverage views
- Search, filtering and activity timelines

### Definition of done

A fellow and supervisor can:

1. Share evidence and request a review.
2. Discuss the evidence through contextual comments without the supervisor editing the fellow’s words.
3. Create, revise and agree a PDP.
4. Record and jointly agree a supervision meeting with actions.
5. Review curriculum coverage with direct links to contributing evidence.

Coverage must always be labelled as mapped evidence—not competence, mastery or an automated performance score. Supervisors must not gain access to private content.

---

## Milestone 3 — Formal Reviews, Reporting and Pilot Readiness

### Goal

Complete the formal programme-review, export, faculty-reporting and production-readiness capabilities.

### Scope

- Versioned induction, midpoint and endpoint templates
- Fellow and supervisor form ownership rules
- Candidate review snapshots and source-version previews
- Immutable final snapshots
- Reauthentication and supervisor signatures
- Fellow acknowledgement and disagreement response
- Append-only review amendments
- Accessible portfolio PDF export
- Structured JSON archive with manifests and checksums
- Faculty cohort dashboard
- Privacy-safe cohort and funder reporting
- Aggregate disclosure thresholds
- Framework and template release administration
- Audit reporting
- Retention, disposal and legal-hold workflows
- Monitoring, backup and recovery
- Security and penetration testing
- Accessibility testing and statement
- Deployment, support and incident-response documentation

### Definition of done

The system can:

1. Prepare an induction, midpoint or endpoint review from the correct versioned template.
2. Freeze the selected PDP and evidence into a content-addressed snapshot.
3. Bind a supervisor signature to the exact snapshot hash.
4. Record the fellow’s acknowledgement separately.
5. Preserve signed records while allowing append-only amendments.
6. Export an accessible PDF and validated structured archive.
7. Give faculty useful cohort oversight without exposing private narrative.
8. Pass the security, privacy, accessibility, backup, recovery and acceptance gates defined in the specification.

The milestone is complete only when all live-pilot governance gates have named approval. These include the canonical curriculum and review templates, controller/processor position, DPIA, lawful-basis analysis, retention schedule, hosting assurance and support ownership.
