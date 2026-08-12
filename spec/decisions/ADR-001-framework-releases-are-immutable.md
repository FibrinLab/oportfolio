# ADR-001: Framework releases are immutable and enrolments are pinned

Status: Accepted  
Date: 12 August 2026

## Context

Public FCAI versions include at least v2.7 and v3.2, while the canonical version for later cohorts is not confirmed. Editing a live framework in place would change what existing evidence and signed reviews mean.

## Decision

Curricula are data packages. A Framework has immutable releases; every cohort/enrolment pins a release. Stable objective IDs persist where meaning persists, but content changes require a new release. Migrations are explicit, previewed and historical mappings remain available. Signed snapshots always embed release identity and package manifest/hash.

## Consequences

- App logic cannot hard-code FCAI objectives.
- Faculty needs validation/publication controls.
- Reporting must segment or explicitly reconcile different releases.
- Fixing a typo in published learning content normally creates a release/erratum, not a database edit.
- Existing cohorts remain interpretable after curriculum change.

