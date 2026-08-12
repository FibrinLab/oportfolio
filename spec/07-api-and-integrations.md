# API and integrations

## API principles

- Versioned JSON API under `/api/v1`; OpenAPI 3.1 is generated and committed.
- Browser clients use same-site secure sessions with CSRF protection; service integrations use narrowly scoped OAuth 2.0/OIDC credentials.
- Every endpoint resolves tenant from authenticated membership and route context, then applies object-level authorisation.
- IDs are opaque. Timestamps are ISO 8601 UTC. Dates without time use ISO calendar date.
- Mutations use `Idempotency-Key` for create/transition operations and `If-Match`/row version for concurrent edits.
- Error format follows RFC 9457 problem details with stable application codes, safe messages and a request ID.
- Pagination is cursor-based. Sorting/filter fields are allowlisted.
- API never returns fields the caller cannot read; avoid “fetch then redact” in application code.

## Representative endpoints

```text
GET    /api/v1/me
GET    /api/v1/tenants/{tenantId}/context

GET    /api/v1/enrolments/{id}
GET    /api/v1/enrolments/{id}/curriculum
GET    /api/v1/enrolments/{id}/coverage

GET    /api/v1/enrolments/{id}/evidence
POST   /api/v1/enrolments/{id}/evidence
GET    /api/v1/evidence/{id}
PATCH  /api/v1/evidence/{id}
POST   /api/v1/evidence/{id}/share
POST   /api/v1/evidence/{id}/review-requests
POST   /api/v1/evidence/{id}/archive
DELETE /api/v1/evidence/{id}

POST   /api/v1/attachments/initiate
POST   /api/v1/attachments/{id}/complete
GET    /api/v1/attachments/{id}/download

GET    /api/v1/enrolments/{id}/pdp
PATCH  /api/v1/pdp/{id}
POST   /api/v1/pdp/{id}/request-agreement
POST   /api/v1/pdp/{id}/agree

GET    /api/v1/enrolments/{id}/supervision
POST   /api/v1/enrolments/{id}/supervision
PATCH  /api/v1/supervision/{id}
POST   /api/v1/supervision/{id}/agree

GET    /api/v1/reviews/{id}
PATCH  /api/v1/reviews/{id}
POST   /api/v1/reviews/{id}/submit
POST   /api/v1/reviews/{id}/return
POST   /api/v1/reviews/{id}/snapshot
POST   /api/v1/reviews/{id}/sign
POST   /api/v1/reviews/{id}/acknowledge
POST   /api/v1/reviews/{id}/amendments

GET    /api/v1/{parentType}/{parentId}/comments
POST   /api/v1/{parentType}/{parentId}/comment-threads
POST   /api/v1/comment-threads/{id}/comments
POST   /api/v1/comment-threads/{id}/resolve

POST   /api/v1/framework-releases/validate
POST   /api/v1/framework-releases
POST   /api/v1/framework-releases/{id}/publish

POST   /api/v1/exports
GET    /api/v1/exports/{id}
GET    /api/v1/exports/{id}/download
```

State changes use action endpoints to keep attestations, policy checks and audit events explicit.

## Upload flow

1. Client requests initiation with parent, filename, claimed media type and size.
2. Server authorises parent access, validates policy and returns a single-object, short-expiry upload instruction.
3. Client uploads directly to a quarantine bucket/key.
4. Client completes; service verifies size/checksum and queues malware/type inspection.
5. Worker marks `clean`, `rejected` or `quarantined`. Only `clean` can attach to visible content.
6. Preview conversion occurs in isolation with network disabled and resource limits.

Default pilot policy (tenant must approve): maximum 25 MB/file, 10 files/item; allow PDF, PNG, JPEG, plain text, Markdown, CSV, DOCX and PPTX. Archives, executables, macro-enabled Office files, DICOM and source-code archives are blocked. A code artefact should be linked, not uploaded as a repository archive.

File policy is both extension- and detected-MIME-based. A mismatch is quarantined. SVG/HTML are not rendered inline. Downloads set `X-Content-Type-Options: nosniff` and a safe content-disposition.

## Authentication and provisioning

### Pilot

Preferred: tenant OIDC/Entra ID with MFA controlled by the identity provider. Alternative for a small pilot: magic-link invitation plus phishing-resistant MFA for supervisors/faculty, provided the controller accepts it.

### Rollout (P1)

- OIDC with tenant allowlisting and exact redirect URIs.
- Optional SCIM 2.0 for account provisioning/deprovisioning.
- Group-to-role mapping must be reviewed, never accepted from untrusted free-form claims.
- Local emergency admin account is tightly controlled, MFA-protected, monitored and excluded from ordinary use.

## Notifications

Events: invitation, review request, comment/reply/mention, request returned, formal review due/signed, action due, export ready, identity/security notice.

Delivery uses an outbox pattern. In-app notification is authoritative; email contains only neutral text (“A supervisor commented on an item in oPortfolio”) and a login link. Email addresses are sent to an approved transactional provider under contract; no portfolio content becomes provider template data.

Notification deduplication groups rapid comment replies. Users can choose immediate, daily digest or in-app-only for non-mandatory events. Audit/security and invitation messages cannot be disabled.

## GitHub integration

### MVP: safe manual link

For a code artefact, accept a public or restricted HTTPS URL plus repository host, artefact kind, immutable revision/SHA where available and fellow contribution. Do not scrape or fetch URLs server-side. The fellow declares access status.

### P2: GitHub App

Use a GitHub App rather than broad personal access tokens.

- Request read-only metadata/content permissions only as needed; prefer repository metadata and pull-request/commit read scopes.
- Installation is per organisation/repository, selected by the user/owner.
- The user selects specific artefacts to import; no continuous full-repository indexing by default.
- Store repository full name, immutable node/commit identifiers, URL, title, timestamps, author/contribution metadata and capture time. Do not copy source unless explicitly required and approved.
- Verify webhook signatures, deduplicate delivery IDs, rotate secrets and tolerate deleted/private repositories.
- Revocation stops refresh but does not silently erase evidence metadata already included in a signed record. Mark access `unavailable`.
- Never send private portfolio data back to GitHub.

GitLab/other forge adapters can implement the same connector interface later.

## Framework import/export

Framework packages are validated against `schemas/framework.schema.json`. Import checks:

- supported schema version;
- globally unique namespace/release;
- unique stable IDs/codes and correct references;
- exactly declared domain/objective counts;
- valid source/citation URLs;
- cross-mapping target existence and explicit mapping level;
- package SHA-256 and optional publisher signature;
- no active content (HTML/scripts) in strings.

JSON is canonical. YAML may be accepted by a CLI but is normalised to JSON before validation/hash; unsafe YAML tags/aliases are disabled.

## Export APIs

Exports are asynchronous. Creation returns `202` with job URL. The worker evaluates permissions at creation and download; a role loss invalidates pending/download access. Job options explicitly list sections, attachment handling, comments, reflection inclusion and date range. Default excludes comments and private reflections unless the fellow selects them.

Structured export layout:

```text
manifest.json
portfolio.json
frameworks/{namespace}-{version}.json
reviews/{review-id}.json
reviews/{review-id}.pdf
attachments/{opaque-id}/{safe-display-name}
checksums.sha256
README.txt
```

No export is placed on a public bucket. Downloads expire (default 24 hours) and may be regenerated.

## Webhooks/service events (P2)

If added, webhooks use allowlisted HTTPS endpoints, signed payloads, minimal metadata, replay protection, per-tenant secrets and a dead-letter/retry view. Narrative content and reflections are excluded. Candidate events: review signed, enrolment completed, export completed (without direct download URL).

## Analytics

Product analytics must be first-party or controller-approved, cookieless where possible, and contain no narrative, filenames, objective/free-text search, URLs or raw user IDs. Prefer aggregated events such as `evidence_saved` with canonical type and tenant-scoped pseudonymous ID. Session replay is prohibited on authenticated portfolio pages.

## Anti-SSRF and outbound access

The application does not fetch arbitrary evidence URLs. Any integration fetch runs through a dedicated allowlisted connector, blocks private/link-local/metadata IP ranges after DNS resolution and redirects, limits response size/type/time, and logs the integration—not the private token.

