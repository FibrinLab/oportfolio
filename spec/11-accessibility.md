# Accessibility

## Standard and policy

Target WCAG 2.2 AA for authenticated web UI, public pages and exported HTML/PDF where the format permits. Aim for selected AAA improvements where practical: 44 px targets, strong focus appearance, plain-language help and generous text measure.

Accessibility is a release gate, not a final audit. Publish an accessibility statement for the deployed service with known issues, contact route and review date.

## Core requirements

### Perceivable

- Text contrast ≥4.5:1; large text ≥3:1; UI boundaries/focus/non-text information ≥3:1.
- 200% text zoom without loss; 400% browser zoom/reflow at 320 CSS px without two-dimensional scrolling except genuine data tables.
- Text spacing overrides must not clip/overlap.
- Status, domain coverage and errors never rely on colour, position, pattern or icon alone.
- Uploaded-image authoring offers an optional meaningful description when displayed in context; decorative preview can be hidden while filename/description remains.
- Any time-based media evidence remains an external/attachment artefact; the product records captions/transcript availability but does not claim uploaded media accessible automatically.

### Operable

- Every action works by keyboard. No drag-only reordering; Move up/down controls exist.
- Skip link goes to main content. Landmarks and one logical H1 per page.
- Focus order follows visual/logical order and is never trapped except in a correctly implemented modal.
- Focus is visible, at least 2 CSS px equivalent area, and not hidden by sticky UI.
- Target design minimum is 44×44 px.
- No single-character shortcuts. If rich-text shortcuts exist, document and allow disable/remap where necessary.
- Session timeout warns with at least 2 minutes and offers extension; preserve unsaved local draft when safe. Signature reauthentication is exempt from silent extension.

### Understandable

- Labels persist; placeholders are examples only.
- Help and privacy contact appear consistently.
- Required/optional, formats and constraints appear before input.
- Errors identify field and correction, in text, without clearing valid values.
- Repeated information such as fellow/programme details is prefilled where safe.
- Authentication must not depend on memory/puzzle/cognitive-function tests; permit password managers and paste. Prefer SSO/WebAuthn.
- Confirmation is required before visibility broadening, formal submission, signature and irreversible disposal.

### Robust

- Use semantic HTML before ARIA.
- All controls expose name, role, value/state and error association.
- Custom combobox/tree/dialog follows current WAI-ARIA Authoring Practices and is tested with real assistive technology.
- Async save/status uses appropriately scoped `aria-live`; avoid chatty announcements on each keystroke.
- Virtualisation must not make table/list content unreachable or misreport position. Avoid it until needed.

## Component-specific behavior

### Rich-text editor

- Starts as a labelled textarea-like editing region with instructions discoverable, not announced on every focus.
- Toolbar is keyboard navigable with visible states and not required for plain text.
- Pasted formatting is sanitised; heading levels offered are appropriate to page hierarchy.
- Provide Markdown/plain-text fallback if editor testing finds blockers.

### Objective picker

- Search and browse are both available.
- Results announce count; selected values appear after the input in DOM order.
- Domain/objective hierarchy is expressed with group headings or tree semantics tested across target readers.
- Removing an objective returns focus predictably.

### Coverage matrix/charts

- A semantic table/list contains the complete information.
- Visual graphics are supplementary and have concise summaries.
- Abbreviations like HEE/FCI are expanded on first use or through accessible description.

### Comments

- Thread heading includes author and context.
- Resolved status is programmatic.
- New comments do not steal focus; live announcement says one was added.
- Inline anchors have a corresponding “Go to referenced field” link; stale anchors remain understandable.

### Notifications

- Unread is text and programmatic, not font weight alone.
- Badge accessible name includes count.
- Toast timeout is not the only place to access a message/action.

### PDF/export

- Logical reading order, headings, lists, tagged tables, language, title, bookmarks and link annotations.
- Do not render text as images.
- Verify with PDF accessibility checker and manual keyboard/screen-reader sampling. If renderer cannot reliably tag a complex PDF, also supply accessible HTML and structured JSON and document the limitation.

## Supported baseline

Test current and previous major versions at release time:

- Browsers: Chrome, Edge, Firefox and Safari; mobile Safari/Chrome for responsive flows.
- Screen readers: NVDA + Chrome/Firefox, JAWS + Edge (where available), VoiceOver + Safari macOS/iOS.
- Input: keyboard-only, switch-style sequential navigation assumptions, touch, 200/400% zoom, Windows High Contrast/forced-colours.

Do not block older browsers with a blank page; show a plain supported-browser message while preserving sign-out/help.

## Research inclusion

Recruit disabled clinicians/learners and people with dyslexia, low vision, motor/cognitive access needs. Test the typewriter font specifically; offer body-font preference from day one. Avoid assuming technical comfort because fellows work in AI.

## Automated and manual gates

Every pull request: semantic linting, axe-core on components/critical routes, keyboard unit/integration tests where feasible, colour-contrast/token tests.

Before pilot and every major release:

- manual keyboard pass of every P0 flow;
- screen-reader pass of onboarding, evidence, comments, PDP, sign-off and export;
- zoom/reflow/text-spacing/forced-colours/reduced-motion checks;
- accessible PDF check and manual review;
- issues triaged with blocker/critical accessibility defects stopping release.

Automated tests do not establish conformance.
