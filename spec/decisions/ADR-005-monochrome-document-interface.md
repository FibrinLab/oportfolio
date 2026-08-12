# ADR-005: Use a monochrome document interface with optional sans body text

Status: Accepted for prototype; validate in user research  
Date: 12 August 2026

## Context

The requested visual direction is simple black and white in a typewriter format. Long reflections and forms still need excellent readability, accessibility and print behavior.

## Decision

Use a black/white/off-white palette, ruled borders, document structure and locally hosted IBM Plex Mono for navigation, labels and headings. Default body may be monospaced initially, with an immediate user preference for IBM Plex Sans/system sans; research will decide whether sans should become the default. State uses text, border and pattern rather than colour. Focus uses a high-contrast double ring.

## Consequences

- The product feels typographic without decorative faux-paper effects.
- Monochrome office printing retains meaning.
- Font preference must not alter structure or data.
- If monochrome focus is insufficient in real testing, accessibility wins and a single focus accent may be introduced through another ADR.

