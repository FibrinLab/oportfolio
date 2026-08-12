# Roles and access

## Tenancy model

The security boundary is a **tenant**, normally an adopting NHS trust, deanery or programme operator acting under an agreed controller/processor model. A tenant contains programmes, framework releases, form-template releases, cohorts and people.

A user can belong to multiple tenants and must have a separate membership/role in each. Every tenant-owned database row and object-storage key must carry `tenant_id`. Authorisation must be checked server-side; hiding navigation is not a security control.

## Roles

| Role | Scope | Purpose |
|---|---|---|
| Fellow | Own enrolment | Authors portfolio/PDP and controls sharing within policy |
| Supervisor | Assigned enrolments | Reviews shared content, comments and signs formal reviews |
| Co-supervisor | Assigned enrolments, configured | Same review rights; sign-off right is separately granted |
| Faculty administrator | Programme/cohort | Configures and operates programme; sees permitted individual records |
| Funder viewer | Funded cohort subset | Aggregate, thresholded, read-only reporting only |
| Tenant administrator | Tenant | Membership, SSO/configuration, policy and audit administration |
| Support operator | Platform, time-bound | Technical diagnostics through approved just-in-time access |

Roles are additive but must not bypass content visibility. A faculty administrator who is also a fellow does not gain access to another fellow's private content.

## Visibility labels

Every narrative item and attachment inherits one visible label:

| Value | UI label | Readers |
|---|---|---|
| `private` | Only me | Author fellow; exceptional-access route only |
| `supervisors` | Me + supervisors | Fellow and currently assigned supervisors; prior supervisor access ends unless record/snapshot requires continued access |
| `faculty` | Me + supervisors + faculty | Fellow, assigned supervisors, authorised programme faculty |
| `review_snapshot` | Formal review record | Signatories and authorised faculty under record policy |

Default is `private`. A tenant may remove `faculty` sharing or require supervisor sharing for specified form submissions, but it must not change existing item visibility silently. Visibility changes are audited. Attachments cannot be more broadly visible than their parent item.

Formal review submission is explicit: the fellow previews which private items will be copied into the review snapshot. The snapshot copy then has `review_snapshot` visibility; the live source remains unchanged.

## Permission matrix

Legend: C create, R read, U update, D soft-delete, M manage/configure, S sign, A aggregate only, — denied.

| Object/action | Fellow | Assigned supervisor | Faculty admin | Funder viewer | Tenant admin |
|---|---:|---:|---:|---:|---:|
| Own profile/enrolment | R/U limited | R | R/U programme fields | — | M |
| Framework release | R | R | R/M release lifecycle | A metadata | M |
| Own evidence/PDP | C/R/U/D | R if shared | R if faculty-shared | — | metadata only |
| Another fellow's evidence/PDP | — | R if assigned + shared | R if faculty-shared | — | metadata only |
| Comment on evidence/PDP | C/R/U own | C/R/U own if shared | C/R/U own if faculty-shared | — | — |
| Resolve comment thread | author or thread opener | author or thread opener | author or thread opener | — | — |
| Supervision log | R; C/U jointly before lock | C/R/U before lock | R if form policy allows | — | metadata only |
| Formal review draft | C/R/U own sections | C/R/U supervisor sections | R if submitted/policy allows | — | metadata only |
| Formal review sign | acknowledge | S if signatory | countersign only if configured | — | — |
| Cohort dashboard | own row only | assigned fellows | R | A thresholded | metadata/config |
| User/cohort assignment | — | — | M programme-scoped | — | M |
| Export own portfolio | C/R | C for assigned review scope | C programme export | C aggregate only | audit/config only |
| Audit log | own relevant events | assigned relevant events | programme events | — | tenant events |
| Exceptional content access | — | — | request only | — | dual-authorised execution |

## Assignment rules

- Supervisor access begins at `assignment.starts_at` and ends at `ends_at` or revocation.
- Reassignment does not rewrite author/comment attribution.
- A prior supervisor retains access only to formal reviews they signed and their own comments where record policy requires; live portfolio access ends.
- A formal review names its signatory at creation. Reassignment requires an audited explicit replacement before signing.
- A faculty admin cannot assign themselves as supervisor and sign a review without the action being visible in the audit trail and exception report.

## Exceptional access (“break glass”)

There is no routine tenant-admin access to private content. If the approved operating model requires exceptional access, it must be:

1. requested with case/reference, reason, scope and duration;
2. approved by a second authorised person;
3. time-limited and read-only where possible;
4. prominently logged and reviewed;
5. notified to the affected user unless law/policy prohibits notice.

Implementation of break-glass content access is P1 and cannot be enabled before policy approval. A pilot can instead make private content technically unavailable to administrators.
