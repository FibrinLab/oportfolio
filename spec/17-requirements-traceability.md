# Requirements traceability

This map keeps the build tied to the curriculum need, product outcomes and acceptance tests. Detailed requirements live in `03-functional-requirements.md`; detailed acceptance steps live in `15-test-and-acceptance.md`.

## Outcome traceability

| Outcome | Primary requirements | Acceptance evidence |
|---|---|---|
| O-01 Contemporaneous portfolio | FR-EV-001–010, FR-PD-001–007, FR-RP-001/005 | AC-02–06, AC-08; pilot active-month measure |
| O-02 Efficient supervision | FR-CM-001–008, FR-SU-001–012, FR-RP-002 | AC-06, AC-09–10; review-response measure |
| O-03 Evidence-backed formal reviews | FR-SU-003–010, FR-FW-003–008 | AC-08, AC-10–11 |
| O-04 Honest curriculum coverage | FR-FW-006–008, FR-RP-003–004 | AC-03, AC-13 |
| O-05 Portable fellow record | FR-EX-001–004/008 | AC-12; export success measure |
| O-06 Cohort support visibility | FR-RP-004/007/008 | AC-13–14; faculty research |
| O-07 Trust/privacy/integrity | FR-ID-002/005/008, FR-EV-008–012, FR-FI-001–005, FR-EX-004–009 | AC-02, AC-05, AC-07, AC-10–16 |

## Curriculum traceability

| Curriculum/source need | Product objects/requirements | Verification |
|---|---|---|
| Five themes and 30 objectives | Framework/Domain/Objective; FR-FW-001–006 | FCAI package count/schema; AC-01/03 |
| National framework alignments | ExternalFramework/Node/CrossMapping; FR-FW-007–008 | Package mapping test; AC-03 |
| Four delivery methods | ProvenanceType; FR-EV-004 | Package/schema and evidence test |
| Seven duties | Duty + evidence_duty; FR-EV-005 | Package/schema and evidence test |
| Record/reflection/certificates/awards/posters/publications/presentations/code | EvidenceType; FR-EV-003 | Seed/type tests; AC-03 |
| PDP/objective focus/SWOT | PDP/Goal/SWOT; FR-PD-001–006 | AC-08 |
| Named supervisor and weekly supervision | Assignment/SupervisionEvent; FR-ID-003/006, FR-SU-001–002 | AC-07/09 |
| Induction/midpoint/end templates | FormTemplate/FormalReview; FR-SU-003–012 | AC-10/11; faculty template approval |
| Portfolio informs reports | ReviewSnapshot/Export; FR-SU-005/010, FR-EX-001–003 | AC-10/12 |
| Versioned curriculum | FrameworkRelease/Enrolment pin/migration; FR-FW-002–004/009–010 | AC-01; release tests |

## Requirement-to-acceptance index

| Requirement group | Main acceptance scenarios | Specialist evidence |
|---|---|---|
| FR-ID-* | AC-01, AC-07, AC-13 | AuthZ matrix, OIDC/session/reauth tests |
| FR-FW-* | AC-01, AC-03, AC-10 | Schema/package, immutability, migration tests |
| FR-EV-* | AC-02–04, AC-06 | Revision/concurrency/search/privacy tests |
| FR-FI-* | AC-05, AC-12 | Malware/polyglot/MIME/download/preview tests |
| FR-PD-* | AC-08, AC-10 | State/revision/agreement tests |
| FR-CM-* | AC-06–07 | Thread/access/notification leak tests |
| FR-SU-* | AC-09–11 | State/hash/signature/amendment tests |
| FR-RP-* | AC-03, AC-13–14 | Metric definition, disclosure/differencing tests |
| FR-EX-* | AC-10–12, AC-15 | PDF/a11y/checksum/expiry/retention tests |
| NFR-P/A/S/U | AC-04–05, AC-10, AC-12, AC-16 | Load, chaos, pen, accessibility, restore reports |

## Privacy traceability template

Complete as part of the DPIA/data inventory; do not leave blank at go-live.

| Data class | Purpose | Readers | Source | Export | Retention class | Lawful-basis/APD reference |
|---|---|---|---|---|---|---|
| Account/profile | Access and programme operation | User, authorised admins/supervisor subset | User/faculty/IdP | User/operational | TBD by controller | TBD |
| Evidence/reflection/files | Learning portfolio and review | Audience-controlled | Fellow/import | Fellow/record selection | TBD | TBD |
| PDP/SWOT | Development planning | Audience-controlled | Fellow/supervisor | Fellow/review selection | TBD | TBD |
| Comments/supervision | Feedback and supervision record | Parent audience/parties | Fellow/supervisor | Selected/record | TBD | TBD |
| Formal reviews/signatures | Programme appraisal record | Signatories/authorised faculty | System/users | Complete record | TBD | TBD |
| Activity/metrics | Service/programme operation/reporting | Role-scoped/aggregate | Derived | Aggregate/CSV | TBD | TBD |
| Audit/security | Accountability/security | Restricted admin/security | System | DSAR/investigation as applicable | TBD | TBD |

## Change control

For any new requirement:

1. assign stable ID and priority;
2. link product/curriculum/governance outcome;
3. update object/permission/privacy model;
4. add acceptance and negative tests;
5. update DPIA/threat model/accessibility implications;
6. record material tradeoff in ADR;
7. increment spec version and release notes.

Never mark a curriculum mapping verified solely because it appears plausible. Record its source, level and verification status.

