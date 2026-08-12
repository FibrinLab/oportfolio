# Reporting and export

## Reporting principles

1. Evidence count is **coverage**, not competence or quality.
2. Every metric has a definition, numerator/denominator, timestamp and drill-down where permitted.
3. Private narrative is never used for aggregate analytics.
4. Missing activity means “nothing recorded in this system”, not “nothing learned”.
5. Small-group disclosure controls apply before filters/results are returned, not only in the UI.
6. Signed reviews are authoritative records; dashboards are operational views and may change as live data changes.

## Fellow dashboard

### Next actions

Sorted by due date and consequence:

- formal review returned or due;
- supervisor comment/mention awaiting reply;
- requested PDP agreement/revision;
- supervision action due;
- configured learning deadline;
- incomplete draft (low priority).

### Progress summary

- Days/month in programme and next formal review.
- Evidence added by month (12-month text/sparkline alternative).
- Five-domain coverage: number of objectives with ≥1 mapped item / total objectives and total mapped items.
- PDP goals by human-set status.
- Last supervision date and open actions.

Labels explicitly state: “Coverage shows where evidence has been mapped. It does not assess competence.”

## Curriculum coverage view

The primary view is an accessible table/matrix:

| Objective | Mapped items | Reviewed items | PDP goals | Latest activity |
|---|---:|---:|---:|---|

Cells use numerals, patterns/text and borders, never colour alone. Each count links to a filtered evidence list. Domain totals are expandable. A mapping badge shows `direct objective mapping` or `inherited domain cross-map`. External-framework views distinguish published mapping from faculty-authored mapping.

Do not weight evidence types or convert counts to percentages of “mastery”. An optional fellow-owned confidence self-rating is out of scope until pedagogically validated.

## Supervisor queue and overview

Queue order:

1. Returned-to-supervisor formal review.
2. Formal review overdue/due within configured window.
3. Direct evidence review requests oldest first.
4. Mentions/open feedback threads.
5. PDP agreement request.

Per-fellow overview includes:

- programme dates, framework version, assignment;
- last evidence activity and explicit review request age;
- PDP/review states;
- last agreed supervision and overdue actions;
- five-domain coverage with drill-down;
- recent shared evidence only.

Private items do not contribute item titles/snippets. Aggregate counts may include private evidence only for the fellow; supervisor coverage uses evidence visible to that supervisor and labels its scope.

## Faculty cohort dashboard

Operational metrics:

- enrolled/active/paused/completed/withdrawn counts;
- invitation/onboarding state;
- current supervisor assignment and vacancies;
- formal review state and overdue count;
- last logged activity date (metadata only) and last supervision date;
- domain/objective coverage distributions using counts only;
- configured e-learning deadlines where faculty imports completion status;
- export status and data-quality exceptions.

Faculty filters: cohort, site/region, supervisor, enrolment state, reporting group, framework release and review status. If filters reduce a cell under the disclosure threshold, values are suppressed in aggregate/funder views. Faculty individual operational access follows permissions; being able to see a row does not grant private narrative access.

No league table, composite engagement score, automatic “at risk” label or supervisor ranking in MVP.

## Funder view (P1)

Only pre-approved measures for enrolments in the funder's reporting group:

- funded seats, activated, completed/withdrawn;
- formal review completion;
- aggregate portfolio participation (for example fellows with activity in N distinct months);
- distribution of domain coverage;
- aggregate output types (publications/posters/presentations/code artefacts) where counts meet threshold.

Default minimum cell size is 7 and must be controller-configurable. Complementary suppression prevents deriving a small cell by subtraction. No names, emails, titles, free text, exact timestamps, supervisor identity or link/file metadata.

## Metric definitions

| Metric | Definition |
|---|---|
| Objective covered | At least one non-deleted live evidence item directly mapped to the objective in the selected scope |
| Reviewed item | Latest revision received a handled review request or is referenced in a signed formal review; not “approved” |
| Active month | At least one evidence create/update, PDP material update, agreed supervision event or formal review participation in that calendar month; definition displayed |
| Last portfolio activity | Latest permitted content mutation, excluding login/view/notification reads |
| Review on time | Required final signature completed on/before configured due time or approved extension |
| Supervision cadence | Count and intervals of agreed meetings; absence of a log does not prove absence of supervision |
| Goal achieved | Latest PDP goal status explicitly recorded as achieved, with author/date |

Metric definitions are versioned. A dashboard/export records its metric-definition version.

## Fellow portfolio PDF

### Builder defaults

Included: cover, programme/framework details, contents, PDP goals, curated evidence, curriculum index, signed formal reviews. Optional/off by default: full private reflections, comments, SWOT, raw supervision notes and attachments.

Before generation, the privacy review lists included private material and third-party names. The fellow must actively include reflection bodies and comments. Signed reviews cannot be altered but can be omitted from an informal portfolio export; a “complete record export” includes all retained formal reviews.

### PDF structure

1. Cover: fellow name, programme/cohort, dates, framework version, generated date, export type.
2. Scope and disclaimer.
3. PDP goals/status and linked evidence references.
4. Evidence in chosen order with stable reference (`EV-001`), activity date, type, provenance, narrative, objectives, files/links manifest and supervisor feedback if included.
5. Curriculum coverage index: domains/objectives → evidence reference(s); external mappings clearly labelled.
6. Supervision summaries/forms selected by scope.
7. Signed formal reviews and amendments.
8. Integrity/versions page: export ID, generated time, framework/template/package hashes, attachment checksum manifest availability.

PDF must be tagged where the renderer supports it, have bookmarks, selectable text, page numbers, repeated table headers, meaningful link text and no meaning conveyed by colour. Use the same monochrome design in print with a readable non-monospaced fallback if the chosen mono font impairs long-form accessibility; see design system.

## Structured archive

`portfolio.json` contains a documented schema version and object IDs/revisions, but excludes audit/security internals. Each item contains source version, visibility-at-export, author, dates, type/provenance/duties, objective stable IDs, PDP links, links and attachment manifest. Comments/reflections only appear when explicitly selected or required by complete-record policy.

`manifest.json` includes:

- export ID/type/schema version;
- tenant/programme/cohort/enrolment identifiers and labels;
- requested/generated timestamps and requester;
- included/excluded data classes;
- framework/form/metric versions;
- file list, byte size, media type and SHA-256;
- export generator version.

## Cohort CSV

One row per enrolment with only approved columns, plus a separate data dictionary. Narrative fields are forbidden. Example columns: pseudonymous enrolment ID, cohort, site/reporting group, start/end/status, framework version, activity-month count, evidence counts by canonical type, covered objectives by domain, review dates/status, supervision log count. Identifiable name/email is a separate explicitly requested faculty export with a stronger reason/permission and audit event.

CSV protects against spreadsheet formula injection by prefixing/escaping cells beginning with `=`, `+`, `-`, `@`, tab or carriage return and documenting the transformation.

## Home-specialty mapping export (P2)

Where a verified CrossMapping exists, a fellow can export:

- target framework/release/node;
- mapping relationship/provenance/level;
- linked evidence references and links/files chosen by the fellow;
- statement that receiving portfolio requirements and assessor decisions still apply.

Never automatically submit evidence or claim equivalent achievement. Direct system transfer requires a separate integration, lawful data-sharing arrangement and user preview/confirmation.

## Rendering and failure behavior

Exports run asynchronously in an isolated worker. The job validates all referenced content, records missing/unavailable links/files, renders, runs structural checks and computes checksums. A partial/corrupt export is never marked complete. If an attachment is quarantined/unavailable, the manifest says so and generation either omits it with warning (informal export) or fails (complete-record export).

The user sees progress, a safe failure message and retry. Support sees request/export IDs and technical cause, not content in ordinary logs.
