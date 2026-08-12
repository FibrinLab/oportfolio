# Open questions and decision log

These are not reasons to stall a prototype. They are named decisions required before the specified gate.

## Must answer before build/configuration is frozen

| ID | Question | Owner | Needed by | Safe working assumption |
|---|---|---|---|---|
| Q-01 | Is there a canonical Cohort 5/6 curriculum later than v3.2? Supply file/version/source. | Programme faculty | Framework publication | Package v3.2 as verified Cohort 3; pin every enrolment |
| Q-02 | Supply actual induction, midpoint and endpoint templates and required signatories. | Programme faculty | Formal-review build | Proposed v0.1 forms remain noncanonical |
| Q-03 | Where/how do current fellows store portfolios and what migration is valuable? | Product/faculty | Pilot design | Start prospectively; no bulk historic import |
| Q-04 | What is the system of record for cohort, supervisor and deadlines? | Programme faculty | Admin build | Faculty-manual configuration |
| Q-05 | Does evidence need supervisor “approval”, or only comments and formal review? | Educational lead | Evidence workflow | No evidence approval; reviewed event only |
| Q-06 | Can faculty see ordinary evidence by default, or only explicitly faculty-shared content/formal reviews? | Faculty + fellow research + IG | Permission freeze | Explicit faculty visibility; private by default |
| Q-07 | Are co-supervisors/temporary cover required and who can sign? | Faculty | Assignment model | Multiple assignments; one named signatory |
| Q-08 | What exact e-learning engagement data/source exists? | Faculty/provider | Reporting | Deadlines/manual completion only; no provider integration |

## Must answer before live data

| ID | Question | Owner | Needed by | Safe working assumption |
|---|---|---|---|---|
| Q-09 | Who is controller, processor and any joint controller for each deployment? | DPO/controller | Live pilot | No live personal data until recorded |
| Q-10 | Article 6 basis, Article 9 condition(s), APD and worker/training power-balance implications? | DPO/legal | DPIA | Do not rely casually on consent |
| Q-11 | Approved retention for each record class and fellow access after completion? | Records/controller | Lifecycle build | Configurable, no invented universal period |
| Q-12 | Are private counts visible to faculty/supervisor if text is hidden? | DPO/fellows/faculty | Metrics | No; use content visible to viewer |
| Q-13 | Is break-glass content access required? Who approves/notifies/reviews? | DPO/security | Support model | Disabled; admins have metadata only |
| Q-14 | Approved hosting/data residency/subprocessors and NHS assurance scope (DSPT/CAF)? | Security/controller | Architecture | UK-hosted target, no compliance claim |
| Q-15 | Does clinical-safety standard work apply despite the product being educational/nonclinical? | Clinical safety officer | Assurance plan | Record applicability assessment; do not assume |
| Q-16 | What wording/contact/escalation for accidental patient/third-party data? | IG/Caldicott/DPO | Content/support | Freeze exposure and route to controlled case |
| Q-17 | Which identity provider and minimum MFA/session policy? | IT/security | Identity build | OIDC + MFA for privileged/signing users |

## Reporting and funder decisions

| ID | Question | Owner | Needed by | Safe working assumption |
|---|---|---|---|---|
| Q-18 | What outcomes do NES, HEIW, T-Pro and NHSE regions contractually require? | Funder/faculty | P1 reports | Only basic aggregate participation/completion |
| Q-19 | Is funder access needed, or will faculty provide approved extracts? | Controller/faculty | P1 | Faculty-produced export is safer initial route |
| Q-20 | What minimum-cell threshold and complementary suppression policy? | DPO/statistical disclosure lead | Funder report | Minimum 7, configurable |
| Q-21 | Are site/region/specialty combinations sufficiently large to report? | Faculty/DPO | Metric config | Suppress unless demonstrated safe |
| Q-22 | Do home-specialty portfolio owners accept mapped exports and in what format? | Product/integration owner | P2 | Human-readable export only, no equivalence claim |

## Product/research questions

1. Which logging fields feel essential versus burdensome after two weeks of use?
2. Do fellows understand “Only me” and snapshot copying without training?
3. Should reflection and evidence be separate types or separate records after research?
4. Does a monochrome monospaced interface remain readable for long reflections and dyslexic users? Is sans body the better default?
5. Is a 12-month chronological log more useful than project-based grouping?
6. How do supervisors triage: explicit requests, deadlines, or per-fellow scheduled sessions?
7. Which evidence belongs in endpoint/ARCP-adjacent export and which should stay private?
8. Do fellows need multiple concurrent projects and project-level access boundaries?
9. Does weekly supervision logging create unnecessary burden, and what is the minimum agreed record?
10. What language should replace “Weaknesses” in SWOT while retaining fidelity?

## Architecture decisions to record

- ADR for implementation stack and hosting.
- Identity/tenant model and whether tenant equals controller boundary.
- Database row-level security approach.
- Restricted rich-text canonical format/editor.
- PDF renderer and accessible-format strategy.
- Application-level encryption/search tradeoff for reflections.
- Object storage signed-record retention locking.
- Search engine vs PostgreSQL, including visibility enforcement.
- Audit immutability/central-log approach.
- GitHub App permissions/storage if P2 approved.

## Bootcamp interview guide

Ask users to show artifacts/processes rather than only opinions:

1. “Show me the last learning item you recorded and how your supervisor saw it.”
2. “Show me how you prepared the last midpoint/end report.”
3. “Which parts would you never want visible to faculty by default?”
4. “When did feedback arrive too late or without context?”
5. “How do you know which curriculum objectives need attention?”
6. “Show the report a funder/faculty member actually produces.”
7. “Where is code evidence stored, and what access/IP limits apply?”
8. “What happens to the portfolio after the fellowship ends?”
9. “Which identity/device/network constraints affect you at work?”

Record roles/processes and anonymised findings, not private portfolio content. Update assumptions/ADRs and specification version after synthesis.

