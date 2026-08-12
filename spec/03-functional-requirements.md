# Functional requirements

Requirements are grouped by capability. P0 is pilot-critical, P1 is rollout-critical, P2 is follow-on.

## Identity, tenancy and enrolment

| ID | Pri | Requirement |
|---|---:|---|
| FR-ID-001 | P0 | The system must authenticate users through a tenant-approved OIDC provider or secure invitation-based account flow. |
| FR-ID-002 | P0 | It must enforce tenant and object permissions server-side on every read and mutation. |
| FR-ID-003 | P0 | Faculty must invite people, assign programme roles and create an enrolment with start/end dates, cohort, framework release and primary supervisor. |
| FR-ID-004 | P0 | Users with multiple roles/tenants must see and explicitly switch active context. |
| FR-ID-005 | P0 | Suspension must block sign-in/access without deleting authored records or attribution. |
| FR-ID-006 | P1 | Supervisor assignment must support dated history, co-supervisors and a separately granted formal signatory permission. |
| FR-ID-007 | P1 | Tenant admins must be able to review role grants and stale memberships at least quarterly. |
| FR-ID-008 | P1 | Session reauthentication must be required for signatures, bulk exports and security-setting changes. |

## Frameworks and curriculum

| ID | Pri | Requirement |
|---|---:|---|
| FR-FW-001 | P0 | Faculty must import a framework package that validates against the published schema before it can be previewed. |
| FR-FW-002 | P0 | A published framework release must be immutable; corrections require a new release or documented metadata-only erratum. |
| FR-FW-003 | P0 | Each enrolment must pin one framework release and preserve it after a later release is published. |
| FR-FW-004 | P0 | The UI must display framework title, version, publisher, publication date, source and release status wherever version confusion is plausible. |
| FR-FW-005 | P0 | Domains and objectives must have stable IDs unique within their framework namespace. |
| FR-FW-006 | P0 | Evidence and PDP goals must map many-to-many to objectives in the enrolment's pinned release. |
| FR-FW-007 | P0 | Cross-mappings must record source node, target framework/release/node, mapping level, relationship type, provenance and verification status. |
| FR-FW-008 | P0 | Domain-level mappings must be labelled as domain-level and must not be displayed as objective-level endorsement. |
| FR-FW-009 | P1 | Faculty must compare two releases and see added, removed, reworded and stable-ID changes before offering migration. |
| FR-FW-010 | P1 | Migration must be previewed per enrolment, preserve historical mappings and require an explicit faculty action plus fellow notification. |
| FR-FW-011 | P2 | Faculty may create/edit draft frameworks through a UI; MVP may use repository-managed packages. |

## Evidence and activity log

| ID | Pri | Requirement |
|---|---:|---|
| FR-EV-001 | P0 | A fellow must create, save, edit, duplicate and soft-delete an evidence item. |
| FR-EV-002 | P0 | An item must contain title, activity date, evidence type, narrative, provenance, visibility and at least one objective mapping before review submission. Drafts may be incomplete. |
| FR-EV-003 | P0 | Canonical types must include learning record, reflection, certificate, award, poster, publication, presentation and code artefact. |
| FR-EV-004 | P0 | Canonical provenance must include immersive project, workshop, e-learning and networking. |
| FR-EV-005 | P0 | A fellow may attach configured duty tags and PDP goals. |
| FR-EV-006 | P0 | An item may contain multiple files and external links subject to policy and validation. |
| FR-EV-007 | P0 | The editor must autosave a local/recoverable draft, indicate save state and prevent silent overwrites through optimistic concurrency. |
| FR-EV-008 | P0 | A reflection must start private and show case-anonymisation guidance before first save/share. |
| FR-EV-009 | P0 | Visibility changes must show the resulting audience, apply to attachments and enter the audit log. |
| FR-EV-010 | P0 | A fellow must explicitly request review of a supervisor-visible item and may cancel an unhandled request. |
| FR-EV-011 | P0 | Supervisors may comment and request changes but must not edit fellow-authored evidence. |
| FR-EV-012 | P0 | Evidence history must show material revisions, visibility changes, review requests and comment activity without exposing private content. |
| FR-EV-013 | P1 | Fellows may curate inclusion/order in an export independently of live log order. |
| FR-EV-014 | P1 | Faculty may configure additional evidence types/provenance values without deleting or renaming canonical historical values. |
| FR-EV-015 | P2 | Fellows may create an evidence item from selected GitHub repository/commit/PR metadata through a scoped integration. |

## Files and links

| ID | Pri | Requirement |
|---|---:|---|
| FR-FI-001 | P0 | Uploads must use allowlisted types and size limits, malware scanning, server-generated names/keys and private object storage. |
| FR-FI-002 | P0 | A file must remain unavailable to other users until scanning succeeds. Failed/quarantined files must not be downloadable. |
| FR-FI-003 | P0 | Download must use a short-lived authorised URL or streamed response and an attachment-safe disposition. |
| FR-FI-004 | P0 | External links must require `https`, display destination host and use safe outbound-link attributes. |
| FR-FI-005 | P0 | The product must warn users not to upload patient-identifiable data and require confirmation for every upload session. |
| FR-FI-006 | P1 | The system must checksum files, deduplicate storage safely within a tenant and preserve original filename as display metadata only. |
| FR-FI-007 | P1 | Image/PDF previews must be generated in an isolated worker and respect the parent object's visibility. |

## PDP and SWOT

| ID | Pri | Requirement |
|---|---:|---|
| FR-PD-001 | P0 | Each enrolment must have one PDP with draft, agreed, active, review-due and closed states. |
| FR-PD-002 | P0 | A fellow must create goals with success description, target date, status and one or more linked objectives. |
| FR-PD-003 | P0 | A goal may have ordered milestones and linked evidence; progress is fellow/supervisor-authored, not inferred as competence. |
| FR-PD-004 | P0 | Fellow and supervisor must explicitly agree the initial PDP; agreement freezes a revision for induction snapshot use. |
| FR-PD-005 | P0 | Later PDP revisions must preserve history and identify author/date/reason. |
| FR-PD-006 | P0 | SWOT must provide four structured quadrants and independent visibility, defaulting to private. |
| FR-PD-007 | P1 | Goal reminders must use configurable dates and can be disabled by the fellow except for mandatory programme deadlines. |

## Comments and feedback

| ID | Pri | Requirement |
|---|---:|---|
| FR-CM-001 | P0 | Authorised users must create threaded comments on a shared evidence item, PDP goal, supervision log or unsigned formal review. |
| FR-CM-002 | P0 | Comments must preserve author, timestamp, edit history, thread status and object revision context. |
| FR-CM-003 | P0 | A comment author may edit within 30 minutes; later correction must append an edited revision rather than erase history. |
| FR-CM-004 | P0 | Comment deletion must leave an audit/tombstone and must not remove replies. |
| FR-CM-005 | P0 | Thread opener or object author may resolve/reopen a thread; resolution is not deletion. |
| FR-CM-006 | P0 | Mentions must be limited to users already authorised to read the parent object. |
| FR-CM-007 | P0 | Email notifications must contain neutral object/title metadata and a link, never comment or reflection body text. |
| FR-CM-008 | P1 | Users may download a feedback history for an item, with visibility and attribution preserved. |

## Supervision and formal reviews

| ID | Pri | Requirement |
|---|---:|---|
| FR-SU-001 | P0 | Fellow or supervisor may create a dated weekly/ad-hoc supervision log with attendees, agenda, notes, actions, owners and due dates. |
| FR-SU-002 | P0 | Both parties may suggest changes until a log is agreed; agreement records each party and date. |
| FR-SU-003 | P0 | The system must support versioned induction, midpoint and end-of-programme form templates. |
| FR-SU-004 | P0 | A formal review must be created from the template release assigned to the cohort and must retain that release. |
| FR-SU-005 | P0 | The fellow must select/confirm evidence and PDP revisions included in the review snapshot before submission. |
| FR-SU-006 | P0 | A supervisor may return an unsigned review with required changes or sign it. |
| FR-SU-007 | P0 | Signature requires reauthentication, an explicit attestation, name/role/time, template revision and snapshot hash. |
| FR-SU-008 | P0 | A signed review and its snapshot must be immutable; corrections use a linked amendment with reason and new signatures as configured. |
| FR-SU-009 | P0 | Fellow acknowledgement must be recorded separately and must not imply agreement with every statement. |
| FR-SU-010 | P0 | Formal review PDF must show signatories, dates, framework/template versions and amendment status. |
| FR-SU-011 | P1 | Faculty may configure deadlines, countersignature and required fields per review type before a cohort starts. |
| FR-SU-012 | P1 | The system must report missing/late reviews without automatically judging performance. |

## Dashboards, notifications and reporting

| ID | Pri | Requirement |
|---|---:|---|
| FR-RP-001 | P0 | Fellow dashboard must show actionable deadlines, recent feedback, PDP status and evidence coverage by domain. |
| FR-RP-002 | P0 | Supervisor queue must prioritise explicit review requests, returned responses, overdue formal reviews and mentions. |
| FR-RP-003 | P0 | Every coverage count must link to the contributing evidence and expose mapping level/source. |
| FR-RP-004 | P0 | Faculty dashboard must show engagement metadata, coverage distribution and formal-review status while excluding private narrative. |
| FR-RP-005 | P0 | Users must receive in-app notifications and configure email digest/immediate preferences, except essential security/account notices. |
| FR-RP-006 | P1 | Aggregate funder reports must enforce minimum-cell thresholds and suppress small groups or combinable filters. |
| FR-RP-007 | P1 | Faculty must export an accessible CSV of permitted cohort metadata and metrics with a data dictionary/version. |
| FR-RP-008 | P1 | Metric definitions and last-updated timestamps must be available from each dashboard. |

## Export, lifecycle and audit

| ID | Pri | Requirement |
|---|---:|---|
| FR-EX-001 | P0 | A fellow must preview and generate an accessible PDF portfolio, choosing sections and permitted comments/reflections. |
| FR-EX-002 | P0 | A fellow must export a machine-readable archive containing JSON, attachments, checksums and a manifest. |
| FR-EX-003 | P0 | Exports must pin framework/template versions and state that evidence coverage is not a competence determination. |
| FR-EX-004 | P0 | Export files must be encrypted at rest, expire automatically and require current authorisation to download. |
| FR-EX-005 | P0 | Security-sensitive and record-mutating events must enter an append-only audit trail with actor, action, target, tenant, time, request ID and outcome. |
| FR-EX-006 | P0 | Soft-deleted drafts must be recoverable for a configured grace period; signed records cannot be deleted through normal UI. |
| FR-EX-007 | P1 | Data-subject requests, legal holds and approved retention/disposal jobs must be case-linked and auditable. |
| FR-EX-008 | P1 | Completed fellows must be able to retrieve a final export through the tenant's approved access window or receive it before account closure. |
| FR-EX-009 | P1 | The system must produce an audit report of framework publication, role changes, visibility changes, exports, signatures and exceptional access. |
