# UX and UI specification

## Experience model

The defining loop is deliberately short:

```text
LOG → MAP → SHARE → DISCUSS → INCLUDE IN REVIEW → SIGN/EXPORT
```

A fellow should be able to start a draft in one action and save a basic entry in under two minutes. Curriculum mapping is integral but does not dominate the writing surface. Supervisor work begins in a finite review queue, not by hunting through a full portfolio.

Kaizen is a workflow reference—log items and let supervisors review/comment—not a visual template. oPortfolio uses its own restrained document-like interface.

## Layout

### Desktop (≥1024 px)

- 224 px left navigation rail.
- Main content max width 1120 px; long-form text column max 72 characters/760 px.
- Detail pages may use a 2-column layout: content minmax(0, 1fr), context/comments 320–360 px.
- Persistent actions stay at page top or bottom; avoid floating controls covering text.

### Tablet (768–1023 px)

- Collapsible 64 px rail.
- Context/comments use a full-height drawer triggered by an ordinary button.
- Tables horizontally scroll only as a last resort; provide stacked/list alternative.

### Mobile (<768 px)

- Top bar, menu drawer, single column, 16 px gutter.
- Primary action is full width where sensible.
- Filters open in a sheet/dialog with count and explicit Apply/Clear.
- Coverage matrix becomes an objective list with counts; no loss of data.
- Fixed bottom actions must not obscure focused elements or onscreen keyboard.

## Screen specifications

### S-03 Fellow “Today”

```text
┌─────────────────────────────────────────────────────────────┐
│ oPortfolio / FCAI v3.2          [New entry]       [Inbox 2] │
├──────────────┬──────────────────────────────────────────────┤
│ Today        │ Good morning, Alex.                          │
│ Log          │ MIDPOINT REVIEW / due 28 Aug                 │
│ Curriculum   │ [Continue review]                            │
│ PDP          │                                              │
│ Supervision  │ NEXT                                         │
│ Portfolio    │ 12 Aug  Supervisor replied to EV-014  [Open] │
│              │ 15 Aug  Action: draft validation plan [Open] │
│              │                                              │
│              │ COVERAGE / mapped evidence, not competence   │
│              │ AI fundamentals                       6 / 8  │
│              │ Regulation & standards                3 / 5  │
│              │ ...                                          │
└──────────────┴──────────────────────────────────────────────┘
```

New fellows see three steps: draft PDP, log first evidence, schedule/prepare induction. The dashboard contains at most one dominant call to action. Completed tasks move to activity, not a celebratory game layer.

### S-04 Evidence log

- Header: “Log”, result count and New entry.
- Search input and filter button; active filters appear as removable text chips.
- Default chronological reverse order grouped by month.
- Each row: date, type, title, audience, mapping summary, review/comment state and author only if needed.
- Density preference: comfortable/compact; comfortable default.
- Bulk actions are limited to export/archive/visibility narrowing and require explicit selection. No bulk broadening of visibility without per-item preview.
- Row opens detail. Secondary actions live in an accessible menu.

### S-05 Evidence editor/detail

Editor is one continuous document form. A compact right context column contains objective picker, PDP/duty tags, audience and files; on mobile these appear inline after narrative.

Top bar: Back / `Draft` / “Saved 10:42” / Preview / Save draft. On request review, show a confirmation page with audience, named supervisor and included files. Do not use a generic “Publish”.

Detail view separates:

1. evidence content;
2. “What this maps to” with source/version;
3. artefacts;
4. revision/activity history;
5. comments panel.

The supervisor sees “Reviewed on …” and “Request changes”/comment, not “Approve”.

### S-06 Curriculum overview

Default is five stacked domain sections. Each header shows `covered objectives / total`, evidence count and PDP goal count. Expanded objective rows show a plain count bar made from border/hatching only as secondary visual, with numeric text primary.

View toggle: List / Matrix. It is a button group with accessible names and preserved preference. External mappings are a separate tab to avoid crowding. The page always states the pinned release and provides a source link.

### S-07 Objective detail

- Breadcrumb: Curriculum / Domain / Objective.
- Objective source wording, stable ID and release.
- Fellow mapping note guidance.
- Mapped evidence list (within caller visibility).
- PDP goals.
- External mappings with level, relationship and provenance.
- “Add evidence for this objective” preselects the objective but still saves private by default.

### S-08 PDP

Document header shows agreement/revision state. Goals appear as bordered sections, ordered by fellow. Each has descriptive status, target date, success criteria, objectives, milestones, evidence and threads.

Agreement uses a review screen containing the entire frozen revision and a change summary. The supervisor button says “Agree this PDP revision”; returning requires a reason. Later edits show both live/current and last-agreed revision.

### S-09 SWOT

Desktop 2×2 ruled-paper grid; mobile four stacked sections. Use text headings, not positional meaning alone. A persistent audience label says “Only you can see this” until changed. Print avoids splitting a quadrant across pages where possible.

### S-10 Supervision

Timeline/list has upcoming planned meeting and previous agreed logs. “New supervision log” can start from the next scheduled meeting or blank. Actions have a separate filterable list. A cadence summary states “3 agreed logs in the past 8 weeks” and never claims missed supervision.

### S-11 Formal review

A left-hand step index (top progress list on mobile) uses named sections, not percentage completion. Each section shows owner: Fellow / Supervisor / Joint / System snapshot. Unauthorized roles see read-only content.

At submission:

- validation summary;
- snapshot inclusion list and private-content warning;
- framework/template versions;
- confirmation “Submit to [name]”.

At signature:

- final rendered review preview;
- content hash short display with copy/reveal full value;
- attestation checkbox;
- reauthentication;
- Sign review.

Signed view displays a heavy double-rule banner: `SIGNED RECORD`, date/name/role, acknowledgement and any amendment. It has no edit affordance.

### S-12 Comments panel

Thread order follows document anchor then time; an “All feedback” view sorts unresolved first. Each thread has author/role, exact timestamp, context/revision, replies and resolve action. New comment composer remains visible without hiding content. On mobile it is a page, not a narrow modal.

### S-13 Portfolio builder

Three steps: Choose content → Privacy check → Preview/export. Sections use checkboxes plus reorder buttons (“Move up/down”), never drag-only. Reflections/comments are off by default. Preview is HTML styled to match PDF and includes page-break hints; PDF download begins only after successful server render.

### S-15 Supervisor review queue

Table/list columns: priority reason, fellow, object, requested/due, age, last action. Reasons are explicit (“Evidence review requested 5 days ago”), not opaque priority scores. Keyboard users can open next item and return with queue position preserved.

### S-16 Supervisor fellow overview

Shows access banner, next review, open requests, PDP state, coverage and recent shared activity. Private-item counts are not exposed unless tenant privacy design and controller decision explicitly permit them; default scope is “visible to you”.

### S-17 Faculty cohort dashboard

Start with operational exceptions, then totals/distributions. A table remains the accessible source for any graphic. “Last activity” is metadata only. Clicking a fellow opens only permitted overview; private titles/text remain absent. A Funder preview lets faculty see suppression before publishing/export.

### S-19 Framework release manager

Wizard: Upload → Validate → Preview → Compare → Publish. Blocking issues name JSON pointer and expected value. Publishing uses reauthentication and an immutable-release warning. Published release page provides package/hash download and enrolment count.

## Interaction patterns

### Autosave and concurrency

- Debounced autosave after idle and on field blur; visible states: Saving…, Saved [time], Offline—saved on this device, Could not save—Retry.
- Local recovery is encrypted where platform support permits and cleared on sign-out/submit; shared/public computers warning is part of pilot testing.
- Server mutation carries row version. On conflict, do not overwrite: show field-level differences and options to copy user text, reload, or create a new revision.

### Dialogs

Use only for focused confirmation or short tasks. Set initial focus to heading or safe control, trap focus, close with Escape where safe, restore triggering focus and explain irreversible consequences. Formal review signing is a page, not a small dialog.

### Toasts and status

Toasts confirm noncritical actions and are also announced through a polite live region; they do not contain the only link to undo. Errors persist near the relevant content and in a summary. Never show portfolio text in a toast that could appear over another user's context.

### Date/deadline language

Show absolute date first: `28 Aug 2026 (in 16 days)`. “Overdue by …” is factual. Approved extensions replace the operational due date while retaining original in history.

### Offline/poor connection

MVP is online-first. A fellow may continue editing an already open draft in local recovery; uploads, sharing, comments and signatures require confirmed connectivity. Never say “Saved” until server confirmation; say “Saved on this device” when local only.

## User research tasks

Prototype testing must include:

1. Fellow logs a private code artefact and maps it to two objectives in under 3 minutes.
2. Fellow writes a reflection and correctly predicts who can see it.
3. Fellow shares an item, requests review and finds supervisor reply.
4. Supervisor clears three different queue reasons without losing context.
5. Fellow and supervisor prepare/sign/acknowledge a midpoint review and explain what became immutable.
6. Faculty identifies missing supervisor assignment without seeing private content.
7. Keyboard-only and screen-reader users complete evidence and sign-off tasks.
8. User with 200+ items finds an old entry and maps it to a PDP goal.

Target: ≥90% task completion without facilitation for core P0 flows after iteration; zero participant incorrectly believes a private reflection is faculty-visible or an evidence count is a competence score.

