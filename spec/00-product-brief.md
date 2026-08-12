# Product brief

## Problem

Fellows need a reliable place to build a year-long record of clinical-AI learning. Supervisors need to see progress and give contextual feedback without assembling reports from scattered documents. Faculty need cohort visibility without reading every private reflection. Fellows also need an export they can retain and, where appropriate, map to a home-specialty portfolio.

The curriculum mandates a portfolio but no platform. Generic eportfolios rarely treat code artefacts, curriculum versioning, cross-framework mappings or fellow-controlled reflection visibility as first-class objects.

## Product proposition

oPortfolio is a quiet, evidence-led logbook: write a learning entry, attach or link the artefact, choose what it demonstrates, share it, and receive supervisor comments. The portfolio grows into the evidence base for induction, midpoint and end-of-programme reviews.

The product is not an AI clinical system. It does not process patient records, validate clinical models, determine whether a fellow is competent, or replace formal incident reporting, HR, appraisal or home-specialty systems.

## Primary outcomes

| ID | Outcome | Initial measure |
|---|---|---|
| O-01 | Fellows maintain a contemporaneous portfolio | ≥80% of active fellows add or update evidence in at least 8 of 12 programme months |
| O-02 | Supervisors can review efficiently | Median time from explicit review request to first supervisor response ≤7 calendar days |
| O-03 | Formal reviews are evidence-backed | 100% of signed midpoint/end reviews contain a frozen PDP and evidence summary |
| O-04 | Curriculum coverage is visible without false equivalence | Every coverage value is drillable to evidence; no automated competence label |
| O-05 | Fellows retain a portable record | ≥95% of requested PDF and structured exports complete successfully |
| O-06 | Faculty can identify support needs | Cohort dashboard shows stale engagement, review status and coverage without exposing private content |
| O-07 | The platform is trusted | No cross-tenant disclosure; all sensitive reads/sign-offs are auditable; privacy setting is clear at authoring time |

Targets are pilot hypotheses, not programme performance thresholds. Faculty must agree them before dashboards label anything “on track”.

## Users and jobs

- **Fellow:** capture work quickly, connect it to learning goals, decide who sees it, respond to feedback, prepare reviews and export a portfolio.
- **Supervisor:** understand current progress, comment on shared items, document supervision, request changes and sign formal reviews.
- **Faculty/programme administrator:** configure cohorts, assign supervisors, publish framework releases/templates, monitor participation, manage exceptions and export programme data.
- **Funder/reporting viewer:** see approved aggregate outcomes for their funded subset without accessing identifiable portfolios.
- **Platform operator:** operate the service and investigate faults with tightly controlled, audited support access; no routine content access.

## Assumptions

1. Each fellow has one primary named supervisor at a time; history is retained. Co-supervisors can be added.
2. A fellow may have more than one programme enrolment over time, each pinned to one framework release.
3. Evidence may be reused across PDP goals within an enrolment, but reuse across enrolments is an explicit copy/link operation.
4. Curriculum coverage is a count and review aid, not proof of competence.
5. Fellows may make a reflection visible to the supervisor, faculty or nobody beyond themselves. Tenant policy may restrict broader visibility but cannot silently broaden it.
6. Faculty can see metadata needed to operate the programme, but private content stays private except through a documented, exceptional access process.
7. Live deployment requires an identified controller, processor terms, privacy notice, retention schedule and approved DPIA screening/outcome.

## In scope

- Versioned framework import and validation.
- Cohorts, enrolments, supervisors and role-scoped access.
- Evidence records with rich plain text, files/links, types, provenance, duty tags and objective mappings.
- Reflection-specific safety prompts and visibility.
- PDP with goals, objectives, milestones, status and optional SWOT.
- Weekly/ad-hoc supervision logs.
- Threaded comments, mentions, requests for review and resolution.
- Induction, midpoint and end appraisal workflows with signatures and immutable snapshots.
- Individual and cohort dashboards, deadlines and notifications.
- Search/filter, accessible monochrome coverage matrix, activity timeline.
- PDF and structured export; audit and lifecycle controls.
- Manual code-repository/commit/PR links in MVP.

## Explicitly out of scope for MVP

- Patient-identifiable or clinical-care data.
- Automated assessment, scoring, recommendation or supervisor-report writing.
- Messaging unrelated to a portfolio object.
- Native mobile applications; responsive web is required.
- Billing, funder invoicing and workforce rostering.
- General learning-management content delivery.
- Git hosting, source-code execution or cloning repositories.
- Direct push into home-specialty eportfolio systems without an agreed API and controller arrangement.
- Public profiles or search-engine indexing.
- Self-registration into a live cohort.

## Success guardrails

- Never call evidence count “cof“mapped evidence” and “reviewed”.
- Never expose private reflection content in dashboards, search snippets, emails, analytics or exports by default.
- Never retroactively change the learning objectives on an active enrolment.
- Never use engagement metrics as automated performance decisions.
- Never accept a file or URL as proof without preserving provenance and author attribution.

