# Workflows and states

State transitions are server-enforced and audited. A UI label is not the source of truth.

## 1. Fellow onboarding

```text
invited → account linked → privacy acknowledged → profile completed
       → enrolment activated → PDP drafted → induction review completed
```

1. Faculty creates an invitation for a known email and a provisional enrolment.
2. The user authenticates with the invited identity. Changing the bound identity requires faculty approval.
3. The fellow sees tenant/programme, framework version, supervisors, programme dates, privacy notice, acceptable-use rule and a “no patient-identifiable data” warning.
4. The fellow confirms required notices and completes preferred name, professional group, home specialty/role and accessibility preferences. Demographic/equality data is not required for MVP.
5. Activation makes the pinned curriculum available and starts configured deadlines.
6. The fellow drafts the PDP and prepares the induction review with their supervisor.

An incomplete onboarding session resumes at the last safe step. Invitation expiry, duplicate identity and wrong-account paths provide faculty contact rather than creating another account.

## 2. Evidence lifecycle

```text
draft ──share──> shared ──request review──> review_requested
  │                 ↑              │              │
  ├──archive        └──revise──────┘              ├──comment/request changes
  │                                                ├──mark reviewed → shared
  └──soft delete → deleted                         └──cancel → shared

shared/review_requested ──archive──> archived
archived ──restore──> draft or shared (previous visibility retained)
```

`draft`, `shared` and `review_requested` are workflow states; visibility is a separate property. A private item cannot enter `review_requested`. “Reviewed” is an event on the item, not evidence approval or competence sign-off.

Rules:

- Drafts accept partial required fields. Review request requires all mandatory fields, at least one objective, and a supervisor-visible audience.
- Editing after review request creates a new revision, cancels the outstanding request as `superseded`, and tells the fellow before save.
- A supervisor response records `reviewed_at`; unresolved threads may remain.
- Soft deletion is blocked while an item is included in an unsigned submitted formal review. Remove it from the review first.
- If included in a signed snapshot, the live item may later change or be deleted according to policy; the snapshot copy remains.
- Evidence has no “approved” state in MVP. Formal review narrative can state the supervisor’s assessment.

## 3. Comment thread lifecycle

```text
open → resolved → reopened → resolved
```

- Thread creation captures the parent object revision and optional text selection/field key.
- New replies to a resolved thread reopen it only after explicit confirmation.
- Parent-object visibility governs every reply. Changing the parent to a narrower audience immediately narrows thread access.
- When an assignment ends, the prior supervisor cannot add replies. Existing attribution remains.
- Deleting a comment replaces its body with “Comment removed by author” for permitted readers and preserves audit/history.

## 4. PDP lifecycle

```text
draft → awaiting_agreement → agreed → active → review_due → active → closed
                         ↘ returned ↗
```

- Fellow owns goal wording. Supervisor comments and agrees but does not silently rewrite.
- Submitting for agreement selects a PDP revision. Editing it while awaiting agreement returns it to draft and invalidates the request.
- Agreement records both the fellow acknowledgement and supervisor agreement; the agreed revision is used in the induction snapshot.
- Later changes create revisions. Material changes (goal, objectives, success criteria or target date) require a reason and may be flagged for discussion at the next review.
- Goal statuses are `not_started`, `in_progress`, `blocked`, `achieved`, `changed` and `withdrawn`. `achieved` is a fellow/supervisor recorded status, never derived from evidence count.
- Closing the PDP requires a signed end-of-programme review or a faculty-recorded early-exit reason.

## 5. Supervision log lifecycle

```text
planned → draft → shared_for_agreement → agreed → locked
                    ↑       │
                    └─returned
```

1. Either party creates a meeting record; planned records contain only date, attendees and optional agenda.
2. Either party authors notes/actions in draft. Every field revision is attributed.
3. The author shares it for agreement.
4. The other party agrees or returns it with a reason.
5. When both have agreed, the log locks. An addendum may be appended; original text is unchanged.

Actions can be assigned only to meeting attendees or faculty members with access. An action reminder does not reveal notes in email.

## 6. Formal review lifecycle

Applies separately to induction, midpoint and end-of-programme reviews.

```text
not_started → preparing → submitted_to_supervisor → supervisor_editing
                    ↑              │                    │
                    └────returned_for_changes───────────┘
                                                       │
                                                       v
                                               ready_for_signature
                                                       │
                                                       v
                                                    signed
                                                       │
                                              fellow_acknowledged
                                                       │
                                          amendment_required (rare)
                                                       │
                                                       v
                                              amended_and_signed
```

### Preparing

- Review is instantiated from the cohort's pinned template release.
- Fellow completes fellow-owned fields and chooses evidence/PDP material for inclusion.
- Preview lists every source item, its current visibility, and exactly what will be copied.
- Submission creates a **candidate snapshot** with a content hash. The live source remains editable, but later changes do not alter the candidate silently.

### Supervisor review

- Supervisor completes supervisor-owned fields, comments, or returns the review.
- If source material changes, the UI offers a diff and asks whether to refresh the candidate snapshot. Refreshing changes the hash and invalidates prior attestations.
- “Ready for signature” requires all template-required fields, no blocking validation errors, a named signatory and a successful snapshot render.

### Signature and acknowledgement

- The supervisor reauthenticates and checks a configured attestation such as: “I confirm that this record accurately represents the review held and the evidence considered.”
- Signing freezes form answers, selected evidence excerpts/metadata, PDP revision, objective coverage, framework/template identifiers, signatory details, timestamps and hash.
- The fellow then acknowledges: “I confirm that I have seen this review.” An optional response can record disagreement. Acknowledgement is not a countersignature unless the template explicitly defines it.
- If countersignature is configured, the review becomes final only after all required signatories sign the same hash.

### Amendments

Signed content is never edited in place. An amendment records reason, initiating user, affected fields, before/after values, references the original review and receives configured signatures. Exports show both original and amendment.

## 7. Framework release lifecycle

```text
draft → validated → published → superseded → retired
   ↑        │
   └─fix validation errors
```

- Draft can change and cannot be assigned.
- Validated means schema, IDs, references and integrity checks pass; faculty must still preview and attest source accuracy.
- Published is immutable and assignable.
- Superseded remains readable and usable by pinned enrolments but is not the default for new cohorts.
- Retired prevents new assignment. Historical enrolments and exports remain functional.
- A release cannot be physically deleted while referenced.

Migration is not a state transition on the original release. It creates an enrolment migration record that points from old to new, records mapping decisions and preserves both histories.

## 8. Form-template release lifecycle

Templates follow draft → validated → published → superseded → retired. An instantiated review pins the exact template release. Publishing a correction never changes an in-progress or signed form unless faculty creates a new instance or runs a documented migration before submission.

## 9. Enrolment lifecycle

```text
provisional → active → completed
                  ├── paused → active
                  └── withdrawn
```

- `provisional`: invited, configuration may change.
- `active`: portfolio entry and deadlines enabled.
- `paused`: fellow access remains read-only except permitted wellbeing/access steps; deadlines stop or are rescheduled explicitly.
- `completed`: signed endpoint review or approved exception; read/export access follows policy.
- `withdrawn`: records preserved/disposed under policy; no completion implication.

State changes require reason, effective date and actor. Do not infer withdrawal or performance from inactivity.

## 10. Framework migration workflow (P1)

1. Faculty publishes a later release and an explicit objective-to-objective migration map.
2. System previews added/removed/changed objectives and evidence/PDP mapping effects per enrolment.
3. Faculty chooses: keep current release; offer opt-in migration; or create a new enrolment. Forced silent migration is prohibited.
4. Fellow and supervisor see and acknowledge the impact.
5. System creates new live mappings and preserves old mappings with `valid_to`/migration reference.
6. Historical signed snapshots and earlier exports continue to cite the old release.

## 11. Deletion and recovery

- User deletion is soft deletion with a tenant-configured grace period.
- During grace, the owner can restore unless a legal/records restriction applies.
- After grace, a disposal job removes or cryptographically erases content according to the approved schedule and records a disposal certificate containing IDs/checksums, not content.
- Audit, signed reviews, legal holds and investigation cases follow their separately approved record schedules.
- Account deletion never rewrites author identity in records; display may be pseudonymised where lawful and appropriate.

