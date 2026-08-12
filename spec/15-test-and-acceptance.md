# Test and acceptance

## Strategy

Testing follows risk. Unit/component tests cover policy/state rules; integration tests cover database/storage/queue/identity boundaries; end-to-end tests cover complete role workflows; specialist reviews cover penetration, accessibility, privacy and PDF integrity. Use synthetic personas/data only.

Every normative P0 functional requirement has automated coverage where feasible and an acceptance scenario. A passing happy path is insufficient for visibility, authorization, signed records, files, exports or deletion.

## Release gates

- Build/type/lint/unit/integration/E2E pass.
- Database migration forward and restore rehearsal pass.
- Authorization matrix and cross-tenant negative suite pass.
- Accessibility automated checks and manual critical-flow pass.
- No unresolved critical/high security defect; risk exceptions approved.
- Backup restore, scan failure, identity failure and export failure behaviors tested.
- Signed snapshot integrity and amendment tests pass.
- Framework/template package schema and source review pass.
- Governance gates evidenced for live-data release.

## P0 end-to-end acceptance scenarios

### AC-01 Invitation and pinned curriculum

**Given** faculty invited a fellow to Cohort 3 pinned to FCAI v3.2 with supervisor Sam  
**When** the fellow authenticates, acknowledges notices and completes onboarding  
**Then** they see programme dates, Sam and exactly FCAI v3.2's 5 domains/30 objectives  
**And** a later published release does not change their curriculum  
**And** another tenant's URL/object returns no data.

### AC-02 Private reflection by default

**Given** an active fellow  
**When** they create a Reflection  
**Then** the anonymisation/disclosure guidance appears  
**And** audience defaults to Only me  
**And** supervisor/faculty/search/email/counts visible to those roles reveal no title/body/attachment  
**And** sharing requires a clear audience confirmation.

### AC-03 Evidence and mappings

**Given** the fellow's pinned release  
**When** they save a code artefact with repository URL, SHA, project provenance, two objectives and a PDP goal  
**Then** it appears once in the log and both objective drill-downs  
**And** coverage increases for those objectives only  
**And** UI states coverage is not competence  
**And** cross-framework display identifies domain-level published mapping.

### AC-04 Autosave conflict

**Given** the same draft open in two tabs  
**When** tab A saves and tab B saves an older row version  
**Then** tab B does not overwrite A  
**And** shows differences and recovery choices  
**And** both bodies remain recoverable.

### AC-05 Secure upload

**Given** a private evidence draft  
**When** a permitted clean PDF uploads  
**Then** it is inaccessible before scan, becomes available after clean status and inherits Only me  
**And** an unauthorised/expired URL cannot download it.  
**When** a mismatched or malicious test file uploads  
**Then** it is quarantined/rejected, never previewed/downloaded and the user gets a safe error.

### AC-06 Review request and comments

**Given** shared complete evidence  
**When** the fellow requests review from the assigned supervisor  
**Then** the supervisor queue receives a dated request and neutral notification.  
**When** the supervisor comments and requests a change  
**Then** the fellow sees the contextual thread and can reply/resolve  
**And** supervisor cannot edit fellow text  
**And** notification email contains no comment/reflection body.

### AC-07 Supervisor reassignment

**Given** supervisor A can read shared live evidence and signed review R  
**When** faculty ends A's assignment and assigns B  
**Then** A immediately loses live portfolio/file/search access  
**And** B receives only current-policy access  
**And** R preserves A's signature/access as policy permits  
**And** the assignment/access changes are audited.

### AC-08 PDP agreement and revision

**Given** a fellow PDP with two goals/objective mappings  
**When** fellow submits and supervisor agrees revision 2  
**Then** revision 2 is frozen as initial agreed PDP.  
**When** fellow later changes a goal with reason  
**Then** revision 3 becomes live and revision 2 remains available for the induction snapshot.

### AC-09 Agreed supervision log

**Given** a weekly meeting draft with actions  
**When** both parties agree  
**Then** original notes lock with attributed agreement dates  
**And** correction creates an addendum  
**And** action reminders reveal no notes by email.

### AC-10 Formal midpoint signature

**Given** a complete midpoint form, candidate evidence and agreed PDP revision  
**When** fellow submits, supervisor completes fields, previews and reauthenticates to sign  
**Then** the final snapshot contains the exact versions/manifest and SHA-256  
**And** signature binds the same hash  
**And** live evidence changes do not alter it  
**And** fellow acknowledgement is recorded separately.

### AC-11 Signed amendment

**Given** a signed review with a factual error  
**When** an authorised user creates a reasoned amendment and required people sign it  
**Then** original remains unchanged  
**And** review/PDF shows both records, dates and relationships.

### AC-12 Fellow export

**Given** portfolio contains shared/private evidence, reflections, comments and signed reviews  
**When** fellow accepts default export  
**Then** comments/private reflection bodies are excluded and preview says so.  
**When** fellow explicitly adds chosen reflection and generates PDF/JSON archive  
**Then** both contain the chosen content, correct versions/references/checksums and accessible structure  
**And** URL expires and later authorization is rechecked.

### AC-13 Faculty privacy boundary

**Given** faculty can operate the cohort but a reflection is supervisor-only/private  
**When** faculty views dashboard/search/export  
**Then** no title/body/snippet/file/link is exposed  
**And** any operational metric states scope/definition  
**And** no competence or automated risk score appears.

### AC-14 Funder disclosure control

**Given** a funder filter yields fewer than the configured minimum  
**When** the report is viewed/exported  
**Then** the cell and complementary derivable values are suppressed  
**And** no alternate filters/API allow reconstruction.

### AC-15 Retention/legal hold

**Given** a soft-deleted draft reaches grace expiry and a signed review is under hold  
**When** disposal runs  
**Then** the eligible draft is removed and disposal event recorded  
**And** held review/snapshot/files remain  
**And** no normal UI can hard-delete them.

### AC-16 Accessibility core journey

**Given** keyboard-only at 400% zoom and representative screen-reader combinations  
**When** user onboards, creates/shares evidence, handles comments and signs/acknowledges a review  
**Then** all functions, errors, save/status, audience and signature state are perceivable/operable  
**And** focus is visible/not obscured and no two-dimensional scrolling occurs outside data table exception.

## Authorization test matrix

For every API/page/background job/file route, test:

- unauthenticated;
- authenticated, wrong tenant;
- same tenant, no role;
- fellow owner vs another fellow;
- currently assigned vs prior/unassigned supervisor;
- supervisor-visible vs faculty-visible vs private;
- faculty correct/wrong programme scope;
- funder aggregate vs individual attempt;
- tenant admin ordinary vs approved break-glass;
- active vs suspended membership;
- object deleted/archived/snapshot-held;
- stale cached permission and pre-issued download URL.

Use generated policy-table cases so new endpoints cannot omit the matrix silently.

## Framework/package tests

- JSON Schema examples valid/invalid.
- Exactly 5 domains, 30 objectives, 4 delivery methods, 7 duties in FCAI v3.2 seed.
- Stable IDs unique and references resolvable.
- Published HEE/FCI mappings remain domain-level and match source codes.
- Unsupported schema, duplicate ID, dangling mapping, script/HTML string, invalid URL and checksum mismatch rejected.
- Published releases reject mutation/delete.
- Release comparison/migration preserves historical signed snapshots.

## Security tests

At minimum: OWASP ASVS-informed web/API assessment; IDOR/BOLA; tenant/query/cache leaks; XSS/rich-text sanitisation; CSRF; SSRF; upload polyglots/macro/archive bombs; CSV injection; open redirect; session fixation/revocation; rate limits; OIDC claim validation; signed URL scope; signature/hash tamper; audit tamper; backup access; secret/log scanning; dependency/container/IaC scans.

Independent penetration test before live pilot and after material auth/tenant/file/signature changes.

## Privacy tests

- Map every collected/derived field to purpose, readers, export, retention and lawful-basis record.
- Search/notifications/analytics/logs tested with canary sensitive strings; canary must not escape permitted storage/view.
- Audience comprehension research includes role reassignment and formal snapshot inclusion.
- DSAR/restriction/correction/deletion/hold procedures rehearsed with synthetic subject.
- Aggregate differencing/small-cell attacks tested.

## Export verification

Automated: PDF generated/nonempty/page count sane/text extractable/references resolved; JSON validates; manifest/checksums match; no unselected canary strings; CSV neutralisation; expiry/auth. Manual: pagination, headings, tables, links, monochrome printing, screen reader/tag structure, 500-item stress portfolio.

## Definition of done

A story is done only when code/schema/docs, migrations, authorization/audit, accessible states, safe errors, telemetry/runbook impact, tests and user-facing content are complete. A feature handling a new personal-data purpose is not done until privacy/governance artefacts are updated.

