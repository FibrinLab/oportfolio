# Data model

The logical model is relational with private object storage for files. UUIDv7 (or equivalent non-guessable, time-sortable identifiers) is recommended. All timestamps are UTC with timezone-aware display. All mutable tables include `created_at`, `created_by`, `updated_at`, `updated_by`, `row_version`; tenant-owned records include non-null `tenant_id`.

## Relationship overview

```text
Tenant ──< Programme ──< Cohort ──< Enrolment >── User
  │                         │            │
  ├──< FrameworkRelease <───┘            ├──1 PDP ──< PDPGoal
  │      ├──< Domain ──< Objective       ├──< EvidenceItem
  │      └──< CrossMapping               ├──< SupervisionEvent
  ├──< FormTemplateRelease <─────────────└──< FormalReview
  └──< Membership / Policy / AuditEvent

EvidenceItem >──< Objective
EvidenceItem >──< PDPGoal
EvidenceItem ──< Attachment / ExternalLink / Revision
CommentThread ──< Comment (polymorphic parent restricted by allowlist)
FormalReview ──1 Snapshot ──< SnapshotEntry
```

## Identity and programme entities

### `tenant`

`id`, `name`, `slug`, `status`, `controller_name`, `controller_contact`, `privacy_notice_url`, `default_timezone`, `policy_set_id`.

### `user`

Global identity only: `id`, `identity_subject`, `email_normalised`, `display_name`, `status`, `last_login_at`. Avoid clinical/professional details here; they belong to a scoped profile.

### `membership`

`id`, `tenant_id`, `user_id`, `role`, `scope_type`, `scope_id`, `starts_at`, `ends_at`, `granted_by`, `grant_reason`, `status`. Unique active grant across tenant/user/role/scope.

### `profile`

`id`, `tenant_id`, `user_id`, `preferred_name`, `professional_group`, `home_specialty_or_role`, `organisation`, `accessibility_preferences_json`. Optional fields must have a documented purpose. No NHS number.

### `programme`

`id`, `tenant_id`, `code`, `name`, `description`, `status`, `default_duration_months`, `default_fte`, `owner_membership_id`.

### `cohort`

`id`, `tenant_id`, `programme_id`, `code`, `name`, `starts_on`, `ends_on`, `framework_release_id`, `induction_template_release_id`, `midpoint_template_release_id`, `endpoint_template_release_id`, `status`, `settings_json`.

Framework/template pins become immutable when the first enrolment activates, except through a migration workflow.

### `enrolment`

`id`, `tenant_id`, `cohort_id`, `fellow_user_id`, `framework_release_id`, `starts_on`, `ends_on`, `fte`, `status`, `status_reason`, `completed_at`, `row_version`. Unique active enrolment per cohort/fellow.

### `supervisor_assignment`

`id`, `tenant_id`, `enrolment_id`, `supervisor_user_id`, `assignment_type` (`primary`, `co_supervisor`), `can_sign`, `starts_at`, `ends_at`, `appointed_by`, `reason`. At most one current primary assignment.

### `reporting_group_membership`

Links an enrolment to a funder/region grouping: `id`, `tenant_id`, `enrolment_id`, `reporting_group_id`, `starts_on`, `ends_on`, `source`. It grants no individual-content access.

## Framework entities

### `framework`

`id`, `tenant_id` nullable for bundled public framework, `namespace`, `title`, `publisher`, `canonical_url`, `description`. Namespace is globally unique (for example `fcai`).

### `framework_release`

`id`, `framework_id`, `version`, `status`, `published_on`, `effective_from`, `source_url`, `source_sha256`, `package_sha256`, `schema_version`, `locale`, `released_by`, `released_at`, `supersedes_release_id`, `release_notes`. Unique `(framework_id, version)`.

### `domain`

`id`, `framework_release_id`, `stable_id`, `code`, `title`, `description`, `sort_order`. Unique `(framework_release_id, stable_id)`.

### `objective`

`id`, `framework_release_id`, `domain_id`, `stable_id`, `code`, `title`, `description`, `source_text`, `sort_order`, `status`. Stable IDs are strings such as `fcai.fundamentals.metrics` and must not contain the release version.

### `external_framework` and `external_node`

External framework: `id`, `namespace`, `title`, `publisher`, `version`, `source_url`. Node: `id`, `external_framework_id`, `stable_id`, `code`, `title`, `parent_node_id`, `description`.

### `cross_mapping`

`id`, `source_release_id`, `source_level` (`domain`, `objective`), `source_id`, `target_node_id`, `relationship` (`exact`, `broader`, `narrower`, `related`), `provenance` (`published`, `faculty_authored`, `imported`), `verification_status`, `citation`, `notes`. A database constraint validates that `source_id` belongs to the stated level/release.

### `framework_migration`

`id`, `from_release_id`, `to_release_id`, `status`, `map_json`, `approved_by`, `approved_at`, `notes`; individual `enrolment_migration` records capture consent/acknowledgement and execution result.

## Evidence entities

### `evidence_item`

`id`, `tenant_id`, `enrolment_id`, `author_user_id`, `title`, `activity_date`, `activity_ended_on`, `evidence_type_id`, `narrative_doc`, `provenance_id`, `visibility`, `workflow_state`, `review_requested_at`, `last_reviewed_at`, `archived_at`, `deleted_at`, `deletion_due_at`, `current_revision_id`, `row_version`.

`narrative_doc` is a sanitised portable rich-text document with a restricted schema (paragraphs, headings level 2–3, lists, links, bold/emphasis); HTML is a render format, not canonical storage. Plain-text extraction is stored for authorised search.

### `evidence_type`

`id`, `tenant_id`, `stable_code`, `label`, `description`, `canonical`, `active`, `fields_schema_json`. Canonical codes: `learning_record`, `reflection`, `certificate`, `award`, `poster`, `publication`, `presentation`, `code_artifact`.

### `provenance_type`

`id`, `tenant_id`, `stable_code`, `label`, `canonical`, `active`. Canonical codes: `immersive_project`, `workshop`, `e_learning`, `networking`.

### Mapping tables

- `evidence_objective(evidence_item_id, objective_id, mapping_note, mapped_by, mapped_at, valid_from, valid_to, enrolment_migration_id)`
- `evidence_goal(evidence_item_id, goal_id, linked_by, linked_at)`
- `evidence_duty(evidence_item_id, duty_id, tagged_by, tagged_at)`

Unique active pair constraints prevent duplicate mappings. `objective_id` must belong to the enrolment's current or historically migrated framework release.

### `duty`

Versioned programme data: `id`, `programme_id`, `stable_code`, `label`, `description`, `sort_order`, `active`.

### `evidence_revision`

`id`, `evidence_item_id`, `revision_number`, `snapshot_json`, `changed_fields`, `change_reason`, `created_by`, `created_at`, `content_sha256`. Append-only; unique item/revision.

### `attachment`

`id`, `tenant_id`, `parent_type`, `parent_id`, `object_key`, `original_filename`, `display_name`, `media_type_claimed`, `media_type_detected`, `size_bytes`, `sha256`, `scan_status`, `scan_engine_version`, `scan_completed_at`, `preview_key`, `visibility`, `deleted_at`.

Allowed parent types are explicit. `object_key` is random and contains no user filename. Attachment visibility is constrained to equal or narrower than parent visibility; MVP inherits exactly.

### `external_link`

`id`, `tenant_id`, `evidence_item_id`, `link_type`, `url`, `host`, `label`, `description`, `captured_metadata_json`, `metadata_captured_at`. Never fetch a private/intranet link from the server in MVP. GitHub metadata import stores only authorised selected metadata.

## PDP entities

### `pdp`

`id`, `tenant_id`, `enrolment_id`, `status`, `current_revision_id`, `initial_agreed_revision_id`, `agreed_by_fellow_at`, `agreed_by_supervisor_at`, `closed_at`, `row_version`. Unique enrolment.

### `pdp_goal`

`id`, `pdp_id`, `title`, `rationale_doc`, `success_criteria_doc`, `target_date`, `status`, `status_note`, `sort_order`, `deleted_at`, `row_version`.

### `goal_objective` and `goal_milestone`

Goal/objective includes `goal_id`, `objective_id`, mapping metadata. Milestone includes `id`, `goal_id`, `title`, `target_date`, `completed_at`, `sort_order`.

### `pdp_revision`

`id`, `pdp_id`, `revision_number`, `snapshot_json`, `change_reason`, `created_by`, `created_at`, `content_sha256`. A revision contains goals/milestones/mappings as one coherent snapshot.

### `swot`

`id`, `pdp_id`, `strengths_doc`, `weaknesses_doc`, `opportunities_doc`, `threats_doc`, `visibility`, `current_revision_id`, `row_version`. Revisions are append-only and independent from PDP agreement unless explicitly included.

## Feedback entities

### `comment_thread`

`id`, `tenant_id`, `parent_type`, `parent_id`, `parent_revision_id`, `field_key`, `selection_anchor_json`, `opened_by`, `status`, `resolved_by`, `resolved_at`, `row_version`.

### `comment`

`id`, `thread_id`, `author_user_id`, `body_doc`, `created_at`, `edited_at`, `deleted_at`, `current_revision_id`. `comment_revision` is append-only. Mentions use a separate join table and are checked against current parent access at creation.

### `review_request`

`id`, `tenant_id`, `evidence_item_id`, `requested_by`, `assigned_to`, `status` (`open`, `handled`, `cancelled`, `superseded`), `message_doc`, `requested_at`, `handled_at`.

## Supervision and review entities

### `supervision_event`

`id`, `tenant_id`, `enrolment_id`, `event_type` (`weekly`, `ad_hoc`, `other`), `scheduled_for`, `occurred_at`, `duration_minutes`, `location_or_medium`, `workflow_state`, `agenda_doc`, `notes_doc`, `visibility`, `current_revision_id`, `locked_at`, `row_version`.

`supervision_attendee(event_id, user_id or display_name, role, attendance_status)` and `action_item(id, event_id, title, owner_user_id nullable, owner_text, due_on, status, completed_at)` support the meeting record. External attendees are display text only and receive no access.

### `form_template` and `form_template_release`

Template: `id`, `tenant_id`, `stable_code`, `title`, `review_type`. Release: `id`, `template_id`, `version`, `status`, `schema_json`, `render_schema_json`, `published_at`, `published_by`, `sha256`, `supersedes_id`.

Field schema supports section, field key, label, help, input type, owner role, required condition, visibility, validation and inclusion rules. Arbitrary executable scripts are forbidden.

### `formal_review`

`id`, `tenant_id`, `enrolment_id`, `review_type`, `template_release_id`, `framework_release_id`, `due_on`, `workflow_state`, `signatory_assignment_id`, `answers_json`, `current_revision_id`, `candidate_snapshot_id`, `final_snapshot_id`, `submitted_at`, `signed_at`, `acknowledged_at`, `row_version`.

### `review_revision`

`id`, `formal_review_id`, `revision_number`, `answers_json`, `changed_by`, `changed_at`, `content_sha256`. Ownership rules apply per form field.

### `review_snapshot`

`id`, `formal_review_id`, `kind` (`candidate`, `final`, `amendment`), `framework_release_manifest_json`, `template_release_manifest_json`, `pdp_revision_json`, `coverage_json`, `answers_json`, `snapshot_sha256`, `created_at`, `created_by`, `render_status`, `pdf_object_key`. Snapshot entries include copied evidence metadata/excerpts, link metadata, attachment manifests and source revision/hash. Files themselves may be copied or content-addressed under a retention lock according to storage policy.

### `signature`

`id`, `review_snapshot_id`, `user_id`, `role_label`, `signature_type`, `attestation_version`, `attestation_text`, `signed_at`, `auth_time`, `identity_subject_hash`, `ip_prefix_or_security_context` (only if approved), `snapshot_sha256`. A signature is valid only when its hash equals the final snapshot.

### `review_amendment`

`id`, `original_review_id`, `reason`, `requested_by`, `status`, `changes_json`, `snapshot_id`, `created_at`, `completed_at`.

## Operations, policy and audit entities

### `notification`

`id`, `tenant_id`, `recipient_user_id`, `event_type`, `object_type`, `object_id`, `neutral_text`, `created_at`, `read_at`, `email_status`. `neutral_text` must not contain narrative/comment content.

### `deadline`

`id`, `cohort_id`, `deadline_type`, `title`, `due_at`, `mandatory`, `applies_to_json`, `reminder_schedule_json`. Per-enrolment overrides are separate records with reason.

### `policy_set`

Versioned tenant settings: visibility options, upload allowlist/limits, export expiry, notification defaults, reporting threshold, retention class mapping, break-glass enabled, approved URLs and notice versions.

### `consent_or_notice_acknowledgement`

Records receipt/acknowledgement, not consent unless consent is truly the chosen lawful basis: `user_id`, `tenant_id`, `notice_type`, `notice_version`, `acknowledged_at`, `context`.

### `audit_event`

`id`, `tenant_id`, `occurred_at`, `actor_user_id` nullable, `actor_type`, `action`, `target_type`, `target_id`, `enrolment_id` nullable, `request_id`, `source_context`, `outcome`, `reason_code`, `metadata_json`, `previous_event_hash`, `event_hash`.

Audit metadata stores changed field names and identifiers, not narrative content or secrets. Append-only permissions, chained hashes and restricted export help detect tampering; they do not replace protected central logging.

### `export_job`

`id`, `tenant_id`, `requested_by`, `scope_type`, `scope_id`, `format`, `options_json`, `status`, `manifest_sha256`, `object_key`, `expires_at`, `failure_code`, `created_at`, `completed_at`.

### `retention_case`, `legal_hold`, `disposal_event`, `exceptional_access_request`

These record approved lifecycle and access decisions, authorities, scope, dates, outcomes and non-content evidence. They cannot be created by ordinary fellow/supervisor roles.

## Core database invariants

1. Every tenant-scoped foreign-key chain resolves to the same `tenant_id`.
2. An evidence/PDP objective mapping belongs to the enrolment's pinned or explicitly migrated framework release.
3. Published framework and template releases are immutable.
4. A final snapshot is immutable and content-addressed by its hash.
5. A valid signature references the exact final snapshot hash.
6. A signed review cannot transition backwards or be updated; amendment is a new linked record.
7. Only currently authorised users can be mentioned, assigned a review, or receive an object notification.
8. An attachment can never be more visible than its parent.
9. Aggregate reporting queries cannot return cells smaller than the tenant threshold.
10. No hard delete occurs where a legal hold, final snapshot retention lock or unresolved disposal exception applies.

## Index and partition guidance

- Index all unique tenant/object keys and active assignment lookups.
- Use partial indexes for open review requests, unread notifications, active memberships and non-deleted evidence.
- Search indexes must be tenant-, enrolment- and visibility-filterable before result materialisation.
- Partition high-volume audit/events by time and tenant only if required; keep retention behavior testable.
- Object storage keys begin with opaque tenant ID and data class, never human names.
