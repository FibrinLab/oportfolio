# ADR-003: Signed reviews use immutable content-addressed snapshots

Status: Accepted  
Date: 12 August 2026

## Context

Live evidence and PDP goals should evolve. A signed induction/midpoint/end report must still show exactly what the supervisor considered and signed. Locking every live source item would impede learning; letting signed content drift would destroy record integrity.

## Decision

Submission creates a candidate snapshot of selected evidence revisions, PDP revision, coverage, answers and framework/template manifests. Final signature freezes a final snapshot and binds the attestation/signature to its SHA-256. The live sources remain independent. Corrections to signed content are linked append-only amendments, never in-place edits.

## Consequences

- Storage must preserve selected attachment versions according to record policy.
- The UI needs snapshot preview/diff and clear “live versus signed” language.
- A signature requires reauthentication and exact-hash validation.
- Export renders original plus amendments and verifies integrity.

