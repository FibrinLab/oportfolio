# Forms and content

This file defines the working forms for build and prototype. Faculty must replace/approve the three formal review templates before pilot use.

## General form rules

- Place a persistent title, privacy audience and save state at the top of long editors.
- Required fields use the word “Required”, not colour or an asterisk alone.
- Validate on blur and submission; do not interrupt typing with errors.
- Error summary links to each invalid field and preserves entered values.
- Character guidance is soft unless storage/safety needs a hard limit.
- Dates are entered/displayed in UK format in the UI (`12 Aug 2026`) and transmitted as ISO 8601.
- Rich text permits headings, paragraphs, lists, emphasis and safe links. No raw HTML, embeds, tracking pixels, custom CSS or executable content.
- The audience control always uses explicit people groups: “Only me”, “Me + supervisors”, “Me + supervisors + faculty”.
- Destructive actions name the object and explain recovery/irreversibility.

## Evidence form

### Shared core fields

| Field | Type | Required to request review | Validation/content guidance |
|---|---|---:|---|
| Title | Single line | Yes | 5–160 chars; describe the work, not the patient/case |
| Activity date | Date | Yes | May be past; future only for planned learning record |
| End date | Date | No | ≥ activity date |
| Evidence type | Select | Yes | Eight canonical types plus tenant additions |
| What happened / what this shows | Restricted rich text | Yes | 20–20,000 chars; label adapts by type |
| Delivery source | Select | Yes | Project, workshop, e-learning, networking |
| Curriculum objectives | Multi-select/tree | Yes | At least one; show selected framework version |
| PDP goals | Multi-select | No | Active/current enrolment only |
| Fellowship duties | Multi-select | No | Seven canonical duties |
| Files | Upload | No | Policy limit; scan status shown |
| Links | URL + label/type | No | HTTPS; host visible before save |
| Audience | Radio group | Yes | Defaults private; attachments inherit |
| Review request message | Text area | When requesting | 1–1,000 chars; supervisor-visible |

### Type-specific fields

| Type | Additional fields |
|---|---|
| Learning record | Learning activity/provider, duration (optional) |
| Reflection | What? / So what? / Now what? structured prompts; “learning only” warning |
| Certificate | Issuer, certificate date, expiry (optional), credential URL/ID |
| Award | Awarding body, award date |
| Poster | Event, presentation date, authorship/contribution |
| Publication | Citation/title, journal/publisher, publication date/status, DOI/URL, contribution |
| Presentation | Event/audience, delivered date, role, slides link/file |
| Code artefact | Repository/host URL, artefact kind (`repository`, `commit`, `pull_request`, `release`, `notebook`, `other`), revision/tag/SHA, contribution, access status (`public`, `restricted`, `private`) |

Never ask for access tokens in evidence fields. For restricted code, the fellow can record metadata without granting repository access. Export shows that verification may require separate permission.

### Reflection safety panel

Shown before first reflection save and beside the editor thereafter:

> Focus on what you learned and what you will do differently. Do not include names, dates of birth, NHS numbers, images, rare combinations of facts, or other details that could identify a patient, colleague or third party. This portfolio is not a clinical record or incident-reporting system. Reflective notes can be subject to lawful disclosure; choose your audience deliberately.

Checkbox on first save: “I have removed identifiable patient and third-party details.” This is a behavioral safeguard, not proof of anonymisation.

## PDP form

### PDP overview

- Career direction and fellowship context (optional, 0–3,000 chars).
- Current revision, agreement state, last reviewed, next review.
- Goals with status, target date, objective coverage and linked evidence count.

### Goal form

| Field | Required | Guidance |
|---|---:|---|
| Goal title | Yes | Specific outcome, 5–160 chars |
| Why this matters | Yes | Link to clinical training/career aspiration |
| Success will look like | Yes | Observable outcome; avoid evidence-count-only targets |
| Curriculum objectives | Yes | One or more from pinned release |
| Target date | Yes | Within enrolment unless justified |
| Milestones | No | Title and date; reorderable |
| Status | Yes after activation | Not started/in progress/blocked/achieved/changed/withdrawn |
| Status note | Required for blocked/changed/withdrawn | Context and next action; not used for automated judgement |

Microcopy: “Evidence can support this goal, but a count alone does not mark it achieved.”

### SWOT

Four equal sections: Strengths, Weaknesses, Opportunities, Threats. Each is restricted rich text, 0–5,000 chars. Use guidance from the curriculum source but do not preload its illustrated example without permission. Default audience is Only me. “Weaknesses” may be relabelled visually as “Development areas” while export retains `weaknesses` as the canonical key and notes the display label.

## Weekly/ad-hoc supervision form

| Section | Fields |
|---|---|
| Meeting | Date/time, duration, medium/location, attendees, type |
| Before | Agenda/topics, links to PDP goals/evidence/review |
| Record | Progress since last meeting, discussion/feedback, decisions, support needed |
| Actions | Action, owner, due date, status |
| Agreement | Share/return reason, fellow agreed at, supervisor agreed at, addenda |

The UI identifies which person wrote each section/change. Do not imply that a jointly agreed log is a competence sign-off.

## Induction review — proposed template v0.1

Pending the programme's canonical file.

1. **Meeting details:** date, attendees, supervisor assignment, placement/project/site.
2. **Starting position (fellow):** relevant experience; career aims; identified development needs; optional SWOT inclusion.
3. **Project context (joint):** project summary; fellow role; key stakeholders; expected outputs; known governance/approvals; dependencies/risks. No patient data.
4. **PDP:** frozen agreed revision; selected priority objectives and goals.
5. **Supervision agreement (joint):** cadence (target ≥1 hour/week), medium, preparation, response expectations, absence/escalation contacts.
6. **Evidence plan (joint):** expected evidence types, code/repository access constraints, publication/IP expectations.
7. **Wellbeing/access (fellow-controlled):** adjustments/process reference without requiring health details in the portfolio.
8. **Actions:** owner/date.
9. **Supervisor summary and attestation.**
10. **Fellow acknowledgement/response.**

Required: 1, project summary, agreed PDP revision, supervision cadence, at least one action or explicit “none”, supervisor attestation, fellow acknowledgement.

## Midpoint review — proposed template v0.1

1. Meeting details and changes to placement/supervision.
2. Fellow narrative: progress, learning, challenges, support requested.
3. Snapshot: PDP goals/status, selected evidence, coverage by domain/objective, supervision cadence. Label all metrics descriptively.
4. Supervisor feedback: strengths demonstrated, development priorities, evidence quality/limitations, support/actions.
5. Project: progress against plan, governance/dependencies, outputs expected.
6. Curriculum: objectives to maintain/focus/deprioritise with rationale.
7. PDP revisions: accept, amend or retain; link to new revision.
8. Actions and owners/dates.
9. Overall status (configured descriptive options): `progressing_as_planned`, `support_or_change_needed`, `programme_exception`; mandatory narrative. This is human judgement, never calculated.
10. Sign-off and fellow acknowledgement/response.

## End-of-programme appraisal — proposed template v0.1

1. Meeting details.
2. Fellow summary of learning and future plan.
3. Frozen evidence/PDP/coverage snapshot.
4. Project outputs and contribution, with code/publication links where shareable.
5. Supervisor narrative against the five curriculum domains; explicit evidence references.
6. PDP goal outcomes and unfinished/changed work.
7. Continuing development actions and transfer/export plan.
8. Programme feedback captured separately from assessment where possible.
9. Completion outcome: `completed`, `completed_with_actions`, `not_completed_or_interrupted`; narrative and faculty process reference. This is not a statutory employment or specialty-training decision.
10. Supervisor signature, optional faculty countersignature, fellow acknowledgement/response.

## Comment composer

- Plain/restricted rich text, 1–5,000 chars.
- Optional mention autocomplete limited to current readers.
- Button labels: “Add comment”, “Reply”, “Resolve thread”, “Reopen thread”.
- On a field: quote only the minimum selected text. Do not copy private text into notifications.
- Revision indicator: “Commenting on version 4 from 8 Aug 2026.” If stale, show “The item has changed since this comment.”

## Framework import form

1. Select JSON file.
2. Validate schema and package integrity.
3. Show release/source details and counts.
4. Show blocking errors and warnings with JSON pointers.
5. Preview domains/objectives/mappings/delivery/duties.
6. Compare with prior release if one exists.
7. Faculty checks: “I have verified this package against the named source.”
8. Publish with reauthentication.

## Content style

- Prefer “fellow”, “supervisor”, “evidence”, “objective”, “review” and “programme”.
- Use sentence case.
- Avoid judgmental engagement language such as “poor performer”, “red flag” or “behind”. Say “No activity logged since [date]” or “Midpoint review due [date]”.
- Avoid “submit” for ordinary saving; use “Save draft”. Reserve “Submit to supervisor” for a workflow boundary.
- “Delete” must state whether recovery is possible. “Remove from review” must not imply deleting source evidence.
- State framework version as `FCAI v3.2 (Cohort 3, 2024)` where the source context matters.

