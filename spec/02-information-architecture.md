# Information architecture

## Object hierarchy

```text
Tenant
├── Programme
│   ├── Framework releases
│   ├── Form-template releases
│   └── Cohorts
│       ├── Enrolments
│       │   ├── PDP
│       │   │   ├── Goals
│       │   │   └── SWOT (optional)
│       │   ├── Evidence items
│       │   ├── Supervision logs
│       │   └── Formal reviews
│       ├── Deadlines
│       └── Reporting groups/funders
└── Memberships, policies and audit
```

Comments attach to evidence, PDP goals, supervision logs or formal-review drafts. Files and links attach to evidence or approved form fields. Objective mappings connect evidence and PDP goals to the enrolment's pinned framework release.

## Global shell

Desktop uses a narrow left rail and one reading column. Mobile uses a top bar and menu drawer. The shell always contains:

- product/tenant name;
- active role/context (especially for users with multiple tenants or roles);
- primary navigation;
- global “New entry” action for fellows;
- notifications/inbox;
- account, accessibility preferences and sign out.

No portfolio content appears in browser tab titles, OS notifications or shell previews. Use neutral titles such as “Evidence item — oPortfolio”.

## Fellow navigation

1. **Today** — next action, draft/review reminders, latest supervisor responses, compact progress summary.
2. **Log** — chronological evidence list, search, filters, new entry.
3. **Curriculum** — five domains, objective detail, mapped evidence and coverage matrix.
4. **PDP** — goals, milestones, objective links, SWOT and review history.
5. **Supervision** — weekly/ad-hoc records plus induction/midpoint/end formal reviews.
6. **Portfolio** — curated preview and exports.

## Supervisor navigation

1. **Review queue** — explicit requests first, then overdue formal reviews, unresolved mentions, recently shared items.
2. **Fellows** — assigned fellows with last activity, last supervision, PDP/review state and coverage (never a competence score).
3. **Calendar/deadlines** — review dates and programme deadlines.
4. **Reports** — assigned-fellow summaries and signed reviews.

Selecting a fellow opens a stable sub-navigation: Overview / Evidence / Curriculum / PDP / Supervision / Reviews. A banner states access basis and assignment dates.

## Faculty navigation

1. **Cohorts** — engagement, coverage distribution, review completion and exceptions.
2. **People** — invites, enrolments, supervisor assignment and funder/reporting grouping.
3. **Curricula** — validate, preview, publish, retire and compare framework releases.
4. **Templates** — formal supervision/review form releases.
5. **Deadlines** — programme milestones and reminders.
6. **Exports** — cohort and funder reports with disclosure controls.
7. **Administration** — policies, evidence types, identity provider, audit and retention jobs.

## Screen inventory

| ID | Screen | Primary role | Key states |
|---|---|---|---|
| S-01 | Sign in / invitation acceptance | All | valid, expired, wrong account, SSO unavailable |
| S-02 | First-run orientation | Fellow | privacy acknowledgement, programme details, incomplete profile |
| S-03 | Today dashboard | Fellow | new, active, stale, formal review due |
| S-04 | Evidence log | Fellow/supervisor | results, empty, filtered-empty, loading, error |
| S-05 | Evidence editor/detail | Fellow/supervisor | draft, shared, review requested, archived |
| S-06 | Curriculum overview | Fellow/supervisor | matrix/list, filtered, no mapped evidence |
| S-07 | Objective detail | Fellow/supervisor | description, source, mapped evidence/goals, external mappings |
| S-08 | PDP overview/editor | Fellow/supervisor | setup, agreed, active, review due, closed |
| S-09 | SWOT editor/print | Fellow | private/shared, empty, complete |
| S-10 | Supervision timeline/log | Fellow/supervisor | planned, draft, agreed, locked |
| S-11 | Formal review | Fellow/supervisor | preparing, submitted, returned, signed, amended |
| S-12 | Comments panel | Fellow/supervisor/faculty | open, resolved, deleted-author tombstone |
| S-13 | Portfolio builder/preview | Fellow | choose sections, privacy check, render, failure |
| S-14 | Notifications | All | unread, read, preference-disabled |
| S-15 | Supervisor queue | Supervisor | actionable, empty, SLA warning |
| S-16 | Fellow overview | Supervisor/faculty | normal, access ended, no activity |
| S-17 | Cohort dashboard | Faculty | small cohort suppression, filters, export |
| S-18 | People and assignments | Faculty | invited, active, suspended, completed |
| S-19 | Framework release manager | Faculty | draft validation, published, superseded |
| S-20 | Template release manager | Faculty | draft, preview, published, in use |
| S-21 | Tenant policy/audit | Tenant admin | view, export, access review |
| S-22 | Aggregate funder report | Funder | thresholded, insufficient cohort size |

## URL model

Human-safe opaque IDs are used in URLs; email, NHS number, professional registration number and framework text never appear in a path.

```text
/t/{tenantSlug}/today
/t/{tenantSlug}/log/{evidenceId}
/t/{tenantSlug}/curriculum/{objectiveId}
/t/{tenantSlug}/pdp
/t/{tenantSlug}/supervision/{eventId}
/t/{tenantSlug}/reviews/{reviewId}
/t/{tenantSlug}/faculty/cohorts/{cohortId}
```

Authorisation applies on every request, including server-rendered metadata, attachments, thumbnails, search, export downloads and websocket/event-stream updates.

## Search and filtering

Global search is role- and visibility-scoped before ranking. It searches titles, fellow-authored text where permitted, tags, objective labels and attachment filenames, but not file body text in MVP. Private material must never produce a result, count, snippet or autocomplete suggestion for an unauthorised user.

Evidence filters: date range, type, provenance, duty, domain/objective, PDP goal, visibility, review state, author and attachment/link presence. Filters use stable query parameters and can be cleared individually.

## Empty-state behavior

Every empty state says why it is empty and offers one relevant action. It never treats zero evidence as failure. Example: “Nothing logged yet. Start with a meeting, workshop, code artefact or reflection.” A filtered empty state says “No entries match these filters” and preserves the user's data.

