# Security, privacy and governance

This is a product/security specification, not legal advice or a completed DPIA. Deployment must be approved by the adopting organisation's information governance, data protection, records, cyber and (where deemed applicable) clinical-safety leads.

## Data classification and boundary

Expected content includes identifiable fellow/supervisor data, professional development records, feedback and potentially sensitive reflections. It may incidentally contain health, equality or third-party/patient information despite policy. Treat narrative, comments, attachments, PDP/SWOT and reviews as confidential/high-impact personal data.

The service is **not** a patient record, clinical system, incident-reporting system or place for clinical datasets. Product prompts and policy reduce—not eliminate—the chance of accidental patient-identifiable data. Incident handling must cover that scenario.

## Controller/processor decision

Before real accounts/content, document:

- controller(s) and any joint-controller arrangement;
- processor/subprocessor roles, contracts and data locations;
- purposes, data categories, data subjects and recipients;
- Article 6 lawful basis and Article 9 condition(s) where special-category data may be processed;
- whether an Appropriate Policy Document is required;
- transparency/privacy notices and data-subject rights routes;
- retention schedule per record class;
- international transfers and safeguards;
- DPIA screening and full DPIA outcome;
- records-management ownership and disposal authority;
- whether DCB0129/DCB0160 clinical-safety standards apply to this non-clinical educational service, with written rationale rather than assumption;
- DSPT/CAF-aligned assurance scope for the adopting/hosting organisations.

Consent should not be casually used as the lawful basis in an employment/training power relationship. “Notice acknowledgement” in the app records that information was presented, not necessarily consent.

## Privacy design

### Default and audience

- New evidence, reflections and SWOT are private.
- The author sees audience at edit and detail views.
- Sharing is a deliberate action with named audience and attachment impact.
- Tenant policy can restrict options but cannot silently broaden an existing audience.
- Supervisor change revokes live access promptly; signed-record access follows policy.

### Data minimisation

- Do not collect NHS number, date of birth, home address, patient identifiers or demographic equality data in MVP.
- Professional role/site/funder are collected only where programme/reporting needs them.
- Logs/analytics contain identifiers and event types, not narrative, comments, filenames, search terms or link URLs.
- Email contains neutral metadata only.
- Support tooling exposes health/status, request IDs and metadata before any content.

### Reflection and third-party safeguards

- Structured warning and acknowledgement at first reflection/upload.
- Guidance focuses on learning and removal of identifiable facts.
- No automated AI review of reflections in MVP.
- A visible “Report accidental sensitive information” route freezes inappropriate exposure, alerts authorised IG response and preserves evidence under the incident process.
- Faculty/support do not browse private content to police it.

### Rights and transparency

Provide routes for access, rectification, objection/restriction, erasure where applicable, portability and complaint/contact. The system must distinguish correction of live fellow-authored data from amendments to signed/retained records. Export jobs are not a substitute for a complete subject access response because audit/admin records may sit outside normal portfolio export.

## Threat model

| Threat | Example | Primary controls |
|---|---|---|
| Cross-tenant/object access | Change URL ID to read another fellow | Tenant key on every object, server-side ABAC/RBAC, repository query scoping, authorization tests |
| Privilege/assignment abuse | Prior supervisor retains access | Dated assignments, cache invalidation, periodic access review, audit alerts |
| Private-content leakage | Email/search/analytics includes reflection | Neutral notifications, scoped search, analytics denylist/schema, log redaction tests |
| Malicious upload | Macro/PDF exploit or disguised executable | Allowlist, type detection, quarantine/scan, isolated preview, attachment download headers |
| Stored XSS | Rich text/comment/filename executes | Structured document schema, output encoding, sanitisation, CSP, safe filenames |
| SSRF/token theft | Server fetches repository/intranet URL | No arbitrary fetch; allowlisted connector egress; secrets vault; URL/IP validation |
| Snapshot tampering | Signed review edited or file swapped | Append-only revisions, content-addressed snapshot, signatures bind hash, storage lock/audit |
| CSV/formula injection | Exported title runs in spreadsheet | CSV neutralisation and tests |
| Account takeover | Phishing/reused session | OIDC/MFA, secure cookie, rotation, short sensitive-action reauth, session/device view |
| Insider curiosity | Admin reads private portfolio | Least privilege, no routine content access, dual-authorised break glass, alerts/review |
| Enumeration | User/email/object probing | Opaque IDs, uniform errors, rate limits, no public directory |
| Availability/ransomware | Destructive credentials or outage | Isolated immutable backups, least-privileged service accounts, tested recovery/runbooks |
| Supply-chain compromise | Dependency/build artefact tampered | Lockfiles, signed/provenance builds, scanning, SBOM, protected CI/release approvals |
| Prompt/AI misuse | Future assistant leaks reflections | No generative AI in MVP; new DPIA/threat model and explicit opt-in boundary before adding |

## Security controls

### Identity and session

- OIDC authorization code + PKCE; validate issuer, audience, nonce/state and signatures.
- MFA required for privileged roles and formal signatories; prefer tenant-wide MFA.
- Cookies `Secure`, `HttpOnly`, `SameSite=Lax/Strict` as flow permits; rotate session ID after auth/role change.
- Idle and absolute timeouts set through risk assessment; warn before expiry and preserve safe drafts.
- Reauthenticate within 5 minutes for signature, bulk identifiable export, role/policy change and break-glass approval.
- Rate-limit authentication/invitations; avoid account-enumerating responses.

### Authorisation

- Default deny. Combine tenant membership, scoped role, active assignment, object ownership, workflow state and visibility.
- Apply to HTML, API, search, counts, notifications, files, previews, exports and background jobs.
- Use policy functions with table-driven tests; consider PostgreSQL row-level security as defence in depth, not sole control.
- Permission change invalidates caches, download URLs and active event-stream subscriptions promptly.

### Application/browser

- CSRF tokens/origin checks for state change; strict input/schema validation and output encoding.
- CSP without `unsafe-inline`/`unsafe-eval` where feasible; nonce/hashes for necessary scripts.
- `frame-ancestors 'none'` (unless approved embedding), HSTS, Referrer-Policy, Permissions-Policy, X-Content-Type-Options.
- Rich text uses a small allowlist and safe link protocols. Never render user HTML/Markdown without sanitisation.
- Prevent open redirects; external destinations clearly shown.

### Encryption and secrets

- TLS 1.2+ in transit; modern cipher policy.
- Managed encryption at rest for database, object storage, backups and export artefacts.
- Consider application/field-level envelope encryption for reflection bodies/private attachments if the operating model and search requirements support it; decide through threat model/DPIA.
- Secrets/keys live in a managed vault, rotate, and are never in repository/build logs/client code.
- Separate keys/environments; audited key use and tested recovery.

### Uploads/object storage

- Private buckets, block public access, explicit service roles, versioning/retention lock for signed snapshots where approved.
- Quarantine and scan before access; isolated conversion without network.
- Signed URLs single object, short expiry, content disposition, current access checked before issue.
- Malware-engine outage blocks new file sharing; text-only work can continue.

### Audit and monitoring

Audit: login/security events, invitation/role/assignment, content create/update/delete (metadata), visibility, review requests, PDP/supervision agreement, framework/template publication, snapshot/signature/amendment, exports, retention/legal holds and exceptional access.

Security logs go to protected central monitoring with alerts for repeated denial, bulk enumeration, unusual export, admin role changes, break glass, scan failures and integrity-chain failure. Limit access and retention. Clock synchronisation is mandatory.

### Secure delivery

- Threat modelling and privacy review at design changes.
- Peer review, protected main branch, secret scanning, SAST, dependency/container/IaC scanning, SBOM.
- DAST and manual penetration test before pilot with remediation/retest of high/critical issues.
- Separate dev/test/prod; no production personal data in lower environments.
- Documented vulnerability disclosure, severity/patch SLAs and dependency update cadence.

## Retention and records

Do not hard-code a universal retention period. Controller maps at least:

1. invitation/failed onboarding;
2. live drafts/deleted-item grace;
3. ordinary portfolio evidence/PDP/comments;
4. agreed supervision logs;
5. signed formal reviews/amendments;
6. audit/security logs;
7. exports/temp renders;
8. support/incident/DSAR/legal-hold records;
9. backups and deletion propagation.

The schedule states trigger (withdrawal/completion/last action), period, disposal action, authority, exceptions and whether the fellow receives an export first. Disposal is suspended by legal hold. Backups have bounded lifecycle; deletion is enforced on restore or via documented expiry.

## Data residency and subprocessors

Default deployment expectation is UK-hosted primary/backup data, subject to controller approval. Record every subprocessor, purpose, data class, location, transfer mechanism, retention, deletion evidence and incident obligations. Do not claim “NHS approved” merely because infrastructure is UK based.

## Incident response

Runbooks cover account compromise, cross-tenant disclosure, accidental patient data, malicious upload, lost signing integrity, provider outage, backup restoration and breached integration token. Each defines detection, containment, evidence preservation, controller/DPO escalation, regulatory/affected-person assessment, communication and post-incident review.

In-product report creates a case ID and safe metadata. It does not ask a user to repeat sensitive content in email.

## Go-live governance gates

- Named controller/DPO/records/security/service owners.
- Approved purposes/lawful basis/privacy notice/controller-processor contracts.
- DPIA screened/completed and residual risks accepted by authorised owner.
- Retention and deletion schedule implemented/tested.
- Access/role model and exceptional-access policy approved.
- Threat model, penetration test and high/critical remediation complete.
- Backup/restore and incident exercise passed.
- Accessibility audit/research and statement complete.
- Faculty approves canonical curriculum and formal templates.
- Support, complaints, DSAR and offboarding routes staffed.
- If applicable, DSPT/CAF and clinical-safety assurance decisions recorded.

## Prohibited launch claims

Do not claim the service is “GDPR compliant”, “NHS approved”, “ARCP approved”, “completely confidential”, “anonymous”, “unhackable”, or that reflections cannot be disclosed. State the actual controls, controller and limitations.

