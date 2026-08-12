# ADR-004: Evidence coverage is not a competence score

Status: Accepted  
Date: 12 August 2026

## Context

Counts and heat maps can help users find curriculum gaps, but the number of mapped artefacts does not establish quality, independence or competence. An automated composite score could distort learning behavior and become an unjustified performance decision.

## Decision

The product calculates transparent evidence coverage only: mapped item/objective counts, review events and human-authored PDP statuses. It does not calculate mastery, competence, performance risk, ranking or completion from those metrics. Supervisor assessment belongs in formal narrative and explicit programme outcomes.

## Consequences

- Every metric has a definition and drill-down.
- UI wording avoids “mastered”, “passed” and traffic-light judgments.
- Funder/faculty reporting cannot rank individuals/supervisors.
- Any future automated scoring requires a new pedagogical, legal/privacy and bias evaluation plus ADR.

