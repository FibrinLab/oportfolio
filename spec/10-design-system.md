# Design system: black-and-white typewriter

## Direction

The interface should feel like a well-kept working notebook and signed paper record: black ink, white/off-white paper, ruled lines, visible dates, annotations and stamps. It is not retro cosplay. Typewriter influence comes from monospaced rhythm, labels and document structure; clarity and accessibility override aesthetics.

No gradients, drop shadows, glass effects, decorative handwriting, faux paper noise, animated typing, ink splatters or colour-coded status. NHS brand assets/lozenges are not used without permission and compliance with identity rules.

## Palette

```css
:root {
  --ink: #111111;
  --paper: #ffffff;
  --paper-soft: #f5f5f2;
  --paper-muted: #e7e7e2;
  --rule: #b8b8b1;
  --rule-strong: #111111;
  --disabled-text: #5b5b57;
  --selection-bg: #111111;
  --selection-text: #ffffff;
  --focus-ring: #111111;
  --danger-pattern: repeating-linear-gradient(135deg, #fff 0 6px, #111 6px 8px);
}
```

Primary UI stays monochrome. Because a pure black focus outline can disappear against black controls, focus uses a **double ring**: 3 px white inner outline and 6 px black outer box-shadow with 2 px offset, or the inverse on white controls. This provides strong focus without introducing colour. Validate every background combination; if it fails usability testing, a single high-contrast focus accent may be introduced through an ADR despite the monochrome preference.

Status is communicated by word, border weight and pattern:

- Draft: thin dashed rule.
- Shared: solid single rule.
- Review requested / requires action: double rule or left `!!` marker plus text.
- Signed: heavy double rule and `SIGNED` text stamp.
- Archived/disabled: muted paper plus explicit label; text remains ≥4.5:1.
- Error: thick border, `ERROR` prefix and icon/shape; never red alone.

## Typography

### Fonts

Preferred open-source stack:

- UI/headings/labels: `IBM Plex Mono`, loaded locally as WOFF2, variable where supported.
- Long narrative and print accessibility option: `IBM Plex Sans` or system sans.
- Code/IDs: `IBM Plex Mono`.
- System fallback: `ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`.

Do not fetch fonts from a third-party CDN. Verify and retain font licences in the repository. User preference “Use easier-reading body font” switches narratives/forms to the sans stack without changing hierarchy.

### Scale

| Token | Desktop/mobile | Line height | Use |
|---|---:|---:|---|
| `--text-xs` | 12/12 px | 1.5 | metadata only; never essential control text |
| `--text-sm` | 14/14 px | 1.5 | labels, table metadata |
| `--text-body` | 16/16 px | 1.65 mono; 1.55 sans | body/forms |
| `--text-lg` | 20/19 px | 1.4 | section heading |
| `--text-xl` | 28/24 px | 1.25 | page heading |
| `--text-2xl` | 40/32 px | 1.15 | sparse landing/cover only |

Use normal case for body. Uppercase is reserved for short labels/stamps (≤30 characters) with `letter-spacing: .06em`; never uppercase paragraphs. Use true bold sparingly; hierarchy mostly comes from size, spacing and rules.

## Spacing and geometry

4 px base grid:

```text
space-1  4     space-2  8     space-3  12     space-4  16
space-5  24    space-6  32    space-7  48     space-8  64
```

- Border radius: 0 for paper/document containers; 2 px for inputs/buttons only if needed for platform clarity.
- Border: 1 px normal, 2 px active/emphasis, 4 px critical/signed separators.
- Touch target: product target 44×44 CSS px minimum, exceeding WCAG 2.2 AA's general 24 px minimum.
- Main reading measure: 60–75 characters.
- Minimum page gutter: 16 px mobile, 32 px tablet, 48 px desktop.

## Components

### Button

Primary: black fill, white text, 2 px black border. Hover: white fill/black text plus underline. Secondary: white/black with 2 px border. Tertiary: text link with underlined affordance. Disabled uses pattern/text and native disabled semantics; do not reduce opacity below legibility.

Labels are verbs: Save draft, Request review, Add comment, Sign review. One primary action per region.

### Link

Black, underlined with 1.5 px thickness and offset. Hover increases thickness. Visited links may use a distinct double underline or `:visited` dark grey only if contrast/recognition remains usable. External links show `[↗]` visually and accessible text “opens external site”; icon is supplementary.

### Input

White, 2 px bottom/bounding rule, visible label above, hint below label, error below input. Height ≥44 px. Placeholder never carries essential instruction. Read-only differs from disabled: paper-soft background and “Read only” text.

### Checkbox/radio

Native or custom with native semantics, 24 px control inside ≥44 px target. Checked state uses solid black inset plus a white mark; selected word is available to assistive technology.

### Select/autocomplete

Use native select for short lists. Objective selection is an accessible combobox plus hierarchical browse dialog, with chosen items rendered as bordered rows—not tiny removable pills. Removal button has full accessible name.

### Card/document block

Flat paper with 1 px border and optional ruled header. No shadow. Clickable cards contain one stretched link without nesting other interactive controls.

### Status label

Plain bracketed text: `[DRAFT]`, `[REVIEW REQUESTED]`, `[SIGNED]`. Border/pattern may reinforce it. Never rely on an unlabeled dot.

### Comment

Left vertical rule indicates a thread; author and exact time precede body. Replies indent once only; deeper threading stays linear for readability. Resolved threads use a dashed rule and `[RESOLVED]`, with body still readable.

### Table

Header separated by 2 px rule, rows by 1 px rule, left-aligned text and right-aligned numeric counts. Zebra colour is unnecessary; if density demands grouping use paper-soft alternating rows plus borders. Responsive alternative preserves headers as labels.

### Coverage indicator

Text is primary (`6 of 8 objectives`). Optional horizontal cells use empty/hatched/solid patterns and an accessible name. No traffic lights, gauges or rings.

### Notice

`NOTE`, `ACTION`, `PRIVACY`, `WARNING`, `ERROR` prefix in a 4 px left-ruled block. Only errors use `role=alert`; ordinary notices do not interrupt screen readers.

### Signed stamp

Rectangular double border, not rotated; content: `SIGNED`, name, role, timestamp, snapshot short hash. It is semantic text, selectable and included in print—not an image.

## Icons and imagery

Prefer words and typographic symbols. If icons are used, choose a small consistent 2 px line SVG set bundled locally. Decorative icons are hidden from assistive technology; functional icon buttons have visible labels where space allows and always have accessible names. Do not use AI-generated imagery in the authenticated product.

## Motion

Only functional transitions (drawer/dialog, save indicator) at 100–160 ms. No parallax, pulsing reminders, animated typing or celebratory confetti. Under `prefers-reduced-motion: reduce`, remove nonessential transition/animation and keep instantaneous state clarity.

## Print

- A4 first, 15–18 mm margins, black on white.
- Navigation/actions hidden; URLs printed for important external links where appropriate.
- Avoid orphan headings and split signature blocks/comments.
- Repeat table headers and portfolio title/reference in running footer.
- Body 10.5–11 pt; long narrative may use sans for reading comfort.
- Pattern/status remains legible on monochrome office printers.

## Token starter

```css
:root {
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --font-body: var(--font-mono);
  --measure: 72ch;
  --content-max: 1120px;
  --radius-control: 2px;
  --border: 1px solid var(--rule);
  --border-strong: 2px solid var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

The code sample is direction, not a substitute for component-level tested implementation.

