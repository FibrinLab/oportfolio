# Data Protection Impact Assessment — oPortfolio

| | |
|---|---|
| **Status** | DRAFT v0.1 — prepared 29 August 2026; not yet signed off |
| **Controller** | Akanimoh Osutuk (sole operator, independent personal project) |
| **Contact** | 0xchromatin@proton.me |
| **Service** | oPortfolio — a private reflective learning diary, self-service or by programme invitation |
| **Review** | Before first live use with real users; then annually or on any material change (new feature touching diary content, new sub-processor, new hosting region, any AI/assistant feature) |

This DPIA follows the ICO template (steps 1–7). It is written against the code in
this repository at the date above and the controls described in
[`docs/deployment.md`](deployment.md) and
[`spec/12-security-privacy-governance.md`](../spec/12-security-privacy-governance.md).
Sections marked **[TO COMPLETE]** depend on hosting decisions not yet made.

---

## Step 1 — Identify the need for a DPIA

A DPIA is required (UK GDPR Art. 35; ICO screening criteria) because the processing:

- involves **reflective writing by healthcare professionals** that is likely, in
  practice, to include special category data about the author (their own
  health, wellbeing, mistakes, emotional responses) and may — despite explicit
  rules against it — occasionally include information about patients or
  colleagues;
- is **innovative / new** for the people concerned (a personal diary tool used
  alongside, but outside, formal NHS training governance);
- concerns people who could be **vulnerable in context**: a candid reflection
  disclosed to an employer, regulator or programme could affect a career, so the
  confidentiality promise is central to the risk profile.

The screening outcome is therefore **full DPIA required**.

## Step 2 — Describe the processing

### 2.1 Nature

| Data category | Items | Source | Stored where | Retention |
|---|---|---|---|---|
| Account | email address, display name (derived from email or chosen), user id, status, last sign-in time | Data subject | `app_user` (PostgreSQL) | Life of account; see §2.1 retention notes |
| Profile (optional) | preferred name, professional group, specialty/role, organisation, accessibility preferences | Data subject | `profile` | Life of account |
| Diary content | entry titles, dates, free-text reflections (rich text stored as sanitised JSON), optional entry type, curriculum objective mappings, external links | Data subject | `evidence_item`, `evidence_revision`, mapping tables | Until the author archives/deletes, or 90 days after the diary is finished; then purged unless a retention hold is recorded |
| Attachments | user-uploaded files (PDF, images, text, DOCX/PPTX ≤ 25 MB), filename, checksum, scan result | Data subject | Object storage: quarantine → clean bucket | As diary content; deleted with the entry / purge |
| Exports | ZIP archive (PDF + JSON + attachments + manifest) generated on request | Derived | Export bucket + `export_job` | Deleted automatically on expiry (short-lived signed download links, 5 min) |
| Authentication | magic-link token **hashes**, session token **hashes**, expiry timestamps | System | `magic_link_token`, `auth_session` | Spent/expired tokens purged after 7 days; revoked sessions after 30 days |
| Rate limiting | normalised email and client IP as counter keys | System | `login_rate` | 24 hours |
| Audit log | actor id, action, target type/id, tenant, request id, timestamp, hash chain — **never content** | System | `audit_event` (append-only) | Life of tenant; retained after account deletion as an integrity/accountability record |
| Notices | acknowledgement of privacy notice / acceptable use / no-patient-data (type, version, time) | Data subject | `notice_acknowledgement` | Life of account |
| Programme data (invitation mode only) | tenant, programme, cohort, enrolment dates, roles; invitation email + name entered by programme staff | Programme admin | Tenancy tables | Life of tenant |
| Operational logs | request ids, route, user id, timing, errors — no content, no tokens | System | Hosting log store **[TO COMPLETE: provider, retention]** | **[TO COMPLETE]** |

**Not collected:** passwords; device fingerprints; analytics or advertising
identifiers; third-party cookies; location. The only cookies are the session
cookie (`__Host-session`, strictly necessary) and a font preference.

### 2.2 Scope

- Data subjects: clinicians and other healthcare staff who choose to keep a
  diary (self-service), and fellows/staff of any programme that adopts the
  invitation mode. Incidentally: third parties mentioned in reflections
  (colleagues, and — against the rules — patients).
- Volume: small (tens to low hundreds of users expected in the first year).
- Geography: UK data subjects. Hosting region **[TO COMPLETE — UK/EU expected]**.
- Frequency: continuous while an account is active.

### 2.3 Context

- Users are professionals writing about their own learning; entries can be
  emotionally sensitive and career-relevant.
- The service is **independent** of the NHS Fellowship in Clinical AI and of
  any employer; it is not a training record of record and confers no
  competency status.
- Reasonable expectation set by the product: *only the author can read the
  diary*. This is enforced in code (owner-only authorization, no staff read
  path, denials indistinguishable from not-found) and must be matched by
  operational practice (§5, risk R3).
- Children are not expected users; no age-specific processing.

### 2.4 Purposes

1. Provide the diary service to the user (write, store, retrieve, export).
2. Authenticate users and protect accounts and content (security, rate
   limiting, audit).
3. Deliver transactional email (sign-in links, invitation, export ready,
   deletion reminders). No marketing.
4. In invitation mode: let programme staff administer accounts, cohorts and
   enrolments — **without** access to diary content.

## Step 3 — Consultation

| Who | How | Status |
|---|---|---|
| Prospective users (fellows) | Informal feedback during the weekend-project phase; pre-launch review of the privacy notice and About page | **[TO COMPLETE]** |
| Information-governance / DPO input | None available in-house; seek review from an NHS IG contact or an independent DP adviser before live use | **[TO COMPLETE]** |
| Security | Automated controls (CI: dependency audit, secret scanning, CodeQL, container scan, authorization matrix); independent penetration test not yet performed | Open |
| Sub-processors | Hosting, database, object storage, SMTP relay — DPAs to be obtained | **[TO COMPLETE]** |

## Step 4 — Necessity and proportionality

**Lawful basis (Art. 6).**
- Self-service users: **contract** (Art. 6(1)(b)) — processing necessary to
  provide the diary the user has asked for. Security logging and rate
  limiting: **legitimate interests** (Art. 6(1)(f)) in protecting the service
  and its users (LIA: low intrusion, expected by users, no viable
  alternative).
- Invitation mode (programme-run tenants): the adopting organisation is the
  controller for its fellows; this operator acts as **processor** under a
  written contract **[TO COMPLETE when the first such tenant exists]**.

**Special category data (Art. 9).** Reflections are the user's own writing and
may reveal their health, beliefs or similar. Basis: **explicit consent**
(Art. 9(2)(a)) obtained at sign-up via the acknowledged notices — the user
decides what to write, is told the diary is theirs alone, and can delete it at
any time. Users are instructed **not** to include patient data or third-party
health data; there is no lawful basis for such data and its presence is
treated as an incident (§6).

**Data minimisation.** Only an email address is required to open an account;
profile fields are optional; the display name is derived from the email unless
changed. Emails and notifications carry neutral text only. Audit records
reference ids, never content.

**Accuracy.** Content is user-authored; revision history is append-only so
edits never silently overwrite. Users can correct profile data in-product.

**Storage limitation.** Retention is enforced in code: 90-day post-finish
access window then purge; export expiry; token and session pruning.
Backups: **[TO COMPLETE — provider retention; must not exceed 35 days beyond
the purge date, and restores must re-apply deletions]**.

**Rights.** Access and portability: self-service ZIP export (PDF + JSON).
Erasure: finish diary → automatic purge after 90 days, or contact the
operator for immediate deletion; account suspension/deletion on request.
Rectification: in-product. Objection/restriction: retention hold mechanism
exists (`retention_hold`) and can be applied on request. Requests to the
contact address are answered within one month.

**International transfers.** None intended. **[TO COMPLETE: confirm every
sub-processor stores and processes in the UK/EEA or has an IDTA/Addendum.]**

**Transparency.** About page, privacy notice **[TO COMPLETE — publish
`/privacy` and set `privacy_notice_url` for self-service tenants]**,
accessibility statement (`/accessibility`), and `security.txt`.

**Alternatives considered.** Paper/offline notes (no portability, no
integrity); a shared e-portfolio with supervisor access (contradicts the
purpose — candid private reflection). A private, owner-only tool with export
was judged the least intrusive way to meet the purpose.

## Step 5 — Identify and assess risks

Likelihood: Remote / Possible / Probable. Severity: Minimal / Significant / Severe.

| # | Risk to individuals | Likelihood | Severity | Overall |
|---|---|---|---|---|
| R1 | Unauthorised access to diary content via application vulnerability (broken authorization, XSS, injection) → disclosure of sensitive reflections | Possible | Severe | **High** |
| R2 | Account takeover via the email channel (intercepted or replayed magic link; compromised mailbox) | Possible | Severe | **High** |
| R3 | Operator or hosting-provider staff read content directly from the database/storage | Possible | Severe | **High** |
| R4 | User includes patient-identifiable or third-party data despite rules → unlawful processing of others' data | Probable | Significant | **High** |
| R5 | Malicious uploaded file harms another user or the platform | Possible | Significant | Medium |
| R6 | Loss of data (outage, ransomware, failed backup) → user loses their record | Possible | Significant | Medium |
| R7 | Data retained longer than promised (purge/backup failure) | Possible | Significant | Medium |
| R8 | Disclosure compelled by law (subpoena, regulator) without user awareness | Remote | Severe | Medium |
| R9 | Email enumeration / spam abuse of the open sign-in form | Possible | Minimal | Low |
| R10 | Sub-processor breach (hosting, storage, SMTP) | Possible | Severe | **High** |
| R11 | Future AI/analysis feature processes reflections beyond user expectation | Remote (none planned) | Severe | Medium |

## Step 6 — Measures to reduce risk

| Risk | Measures (implemented unless marked) | Effect | Residual |
|---|---|---|---|
| R1 | Owner-only, default-deny authorization on every route with a generated matrix test (463 cases) and a completeness check that fails when a route is unregistered; uniform not-found on denial; narrative sanitiser; strict nonce CSP, no third-party scripts; CSRF origin checks; dependency audit, CodeQL and container scanning in CI. **Planned:** independent penetration test before live use. | Reduced | Medium until pen test |
| R2 | Single-use links, 15-minute expiry, consumed only by POST (mail scanners cannot spend them); token hashes only in DB; per-address and per-IP rate limits; sessions with idle/absolute timeouts and rotation; `__Host-` secure cookies; SPF/DKIM/DMARC on the sending domain **[TO COMPLETE at hosting]**. Users are told to protect their mailbox. **Considered:** passkeys/WebAuthn as a second factor — deferred (ADR-006), revisit before scale. | Reduced | Medium |
| R3 | No in-product read path for anyone but the author; database/storage credentials held only in the platform secret store; access to production limited to the operator; hash-chained audit log for all access that *is* possible in-product. **Planned:** application-level envelope encryption of narrative bodies (spec/12 §encryption) — decide before any second administrator exists; documented exceptional-access policy **[TO COMPLETE]**. | Reduced | Medium — honest limitation: the operator *can* technically read the database; the privacy notice must say so |
| R4 | Explicit "no patient data" acknowledgement at sign-up (invitation flow) **[TO COMPLETE: add the same acknowledgement to the self-service first sign-in]**; About page and editor guidance; incident runbook: on discovery, the operator asks the author to remove the data and records the incident without copying the content. | Reduced | Medium — relies on user behaviour |
| R5 | Presigned upload to a quarantine bucket; ClamAV scan + content-type inspection; allow-listed types/sizes; only clean files downloadable, via 5-minute signed URLs with attachment disposition; files never executed or previewed server-side. | Reduced | Low |
| R6 | Managed database with automated backups **[TO COMPLETE: provider, PITR, restore test]**; object-storage durability; users can export a complete archive at any time. | Reduced | Low-Medium |
| R7 | Purge and export-expiry jobs in the worker with integration tests; token/session pruning; monitoring of failed outbox rows **[TO COMPLETE: alerting]**; backup retention bounded **[TO COMPLETE]**. | Reduced | Low |
| R8 | Privacy notice states that disclosure may be required by law; operator will notify the user unless legally prevented; data minimisation limits what exists to disclose. | Accepted | Medium |
| R9 | Uniform response whether or not an address exists; rate limits; no content in emails. | Reduced | Low |
| R10 | Choose UK/EU providers with DPAs and recognised certifications **[TO COMPLETE]**; least-privilege credentials; encryption at rest; TLS everywhere; credential rotation. | Reduced | Medium |
| R11 | Policy: no generative-AI or analytics over reflections without a new DPIA and explicit opt-in (spec/12); nothing in the codebase sends content to third parties. | Eliminated for now | Low |

**Breach handling.** Detect (alerts, user reports to the contact address) →
contain (revoke sessions, rotate credentials, suspend accounts) → assess →
notify the ICO within 72 hours where required and affected users without undue
delay → record in the incident log → review. Because most content is special
category data, any confirmed content disclosure is presumed notifiable.

**ICO registration.** The operator must check whether the data protection fee
applies (an individual processing personal data electronically as a service to
others normally must pay unless exempt) — **[TO COMPLETE before live use]**.

## Step 7 — Sign-off and outcomes

| Item | Name / date | Notes |
|---|---|---|
| Measures approved by | **[Akanimoh Osutuk — date]** | Integrate actions above into the go-live checklist (`docs/deployment.md` §6) |
| Residual risks approved by | **[Akanimoh Osutuk — date]** | R1–R3 and R10 remain Medium after measures; if they are not acceptable, do not go live until the pen test, envelope-encryption decision and provider DPAs are complete |
| DPO / adviser advice | **[TO COMPLETE — no DPO appointed; independent review recommended]** | |
| Consultation results | **[TO COMPLETE]** | |
| ICO consulted | Not required unless residual risk remains High after measures | |
| Next review | Before live use; then 29 August 2027 | Owner: controller |

### Actions before live use

1. Publish `/privacy` and set `privacy_notice_url`/`controller_name` for
   self-service tenants; state plainly that the operator can technically
   access stored data and how that is controlled.
2. Add the privacy / acceptable-use / no-patient-data acknowledgement to the
   self-service first sign-in and record it in `notice_acknowledgement`.
3. Choose hosting, database, storage and SMTP providers; record region, DPA,
   backup retention and restore test in §2.1, §3 and §6.
4. Configure SPF/DKIM/DMARC for the sending domain.
5. Commission an independent penetration test; remediate high/critical.
6. Decide on envelope encryption for narrative bodies (R3).
7. Confirm the ICO data protection fee position.
8. Sign off Step 7.
