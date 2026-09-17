---
name: ShowRoom Vote
description: Directorio y credencial de un ShowRoom formativo SENA, en lenguaje de señalética de piso de feria.
colors:
  paper: "#f3f4f1"
  paper-raised: "#ffffff"
  paper-sunken: "#eceeea"
  ink: "#15181c"
  ink-soft: "#4c525a"
  ink-faint: "#7a8188"
  line: "#dde0da"
  line-strong: "#c6cac2"
  accent: "#d9540c"
  accent-hover: "#c14a09"
  accent-ink: "#fff7f0"
  accent-soft: "#fbe3d1"
  accent-soft-line: "#f0c9a4"
  stamp: "#1f6e4a"
  stamp-ink: "#f2faf5"
  stamp-soft: "#dcefe3"
  stamp-soft-line: "#b7dac4"
  warn: "#a83a1f"
  warn-ink: "#fdf3ef"
  warn-soft: "#f6ddd2"
  warn-soft-line: "#e7b49a"
typography:
  scale:
    2xs: "0.7rem"
    xs: "0.75rem"
    sm: "0.8rem"
    base: "0.85rem"
    md: "0.9rem"
    lg: "0.95rem"
    body: "1rem"
    heading-sm: "1.05rem"
    heading-md: "1.1rem"
    score: "1.5rem"
    numeral-lg: "1.6rem"
    display-sm: "clamp(1.4rem, 4.5vw, 1.9rem)"
    display-lg: "clamp(1.5rem, 5vw, 1.85rem)"
  display:
    fontFamily: "'Big Shoulders', 'Arial Narrow', sans-serif"
    fontSize: "{typography.scale.display-sm}"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Big Shoulders', 'Arial Narrow', sans-serif"
    fontSize: "{typography.scale.display-lg}"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif"
    fontSize: "{typography.scale.body}"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif"
    fontSize: "{typography.scale.2xs}"
    fontWeight: 700
    letterSpacing: "0.03em"
rounded:
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  badge: "8px"
  chip: "3px"
  clip: "7px 7px 3px 3px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "13px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.sm}"
  stand-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.badge}"
  stand-badge-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.badge}"
  chip-done:
    backgroundColor: "{colors.stamp-soft}"
    textColor: "{colors.stamp}"
    rounded: "{rounded.chip}"
  chip-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.chip}"
  chip-pending:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.chip}"
  credential:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.lg}"
    padding: "clamp(20px, 5vw, 32px)"
  stand-card:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.lg}"
    padding: "18px"
  rubric-block:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.lg}"
    padding: "clamp(16px, 4vw, 24px)"
---

# Design System: ShowRoom Vote

## Overview

**Creative North Star: "Piso de Feria"** — the signage language of an exhibition floor: stand numbers, credentials, exhibitor directories, ink stamps.

ShowRoom Vote renders every screen as a physical fixture of a real trade-show floor rather than as a survey form or an admin dashboard. Visiting a stand's ballot reads like scanning a numbered directory tile; casting a vote reads like presenting a credential at an accreditation desk; the jury's screen reads like an official evaluation station with a paper rubric, visible progress across stations, and a running score. The palette stays restrained — cool, very light neutrals plus a single signal accent — so that number badges, credential clips, and ink stamps read as the deliberate exceptions instead of competing decoration. Big Shoulders (condensed, vinyl-lettering register) is reserved for numerals and titles; IBM Plex Sans carries every sentence a visitor or jury member actually reads. The system was confirmed "ship" after a finish-review pass that removed a generic eyebrow/kicker pattern site-wide, rebuilt status chips as real ink stamps, added a badge-clip/lanyard device to all three entry screens, and put real stand data into the desktop cover's floor directory — those four fixes are now load-bearing parts of the system below, not one-off polish.

**Key Characteristics:**
- Cool, very light grey floor (never cream/parchment) with near-black ink and a single amber signage accent.
- Big Shoulders for numerals/titles, IBM Plex Sans for everything read at length.
- Status is drawn as a real ink stamp (double ring, rotation) or an empty dashed box awaiting one — never a generic colored pill.
- A credential (with a physical clip + lanyard eyelet) is the identity device on every entry screen, not a login card.
- Full light/dark parity via `prefers-color-scheme`, same token names, inverted values.

## Colors

A cool, near-neutral floor with a single warm signage accent; two additional inks (stamp green, document-red warn) are reserved strictly for status, never for decoration.

### Primary
- **Signal Amber** (`#d9540c`, hover `#c14a09`): the sole accent. Used only on primary actions (`.btn--primary`), stand-badge accent variant, focus rings, and small in-line marks (new-criterion tag, floor-directory hover). Never used as a background wash.

### Neutral
- **Floor** (`#f3f4f1`): page background — deliberately cool grey, never cream.
- **Raised Paper** (`#ffffff`): cards, credentials, inputs, the topbar.
- **Sunken Paper** (`#eceeea`): hover state for table rows and ghost buttons; recessed surfaces.
- **Near-Black Ink** (`#15181c`): primary text, stand-badge default fill, score-badge fill.
- **Soft Ink** (`#4c525a`): secondary text, meta lines.
- **Faint Ink** (`#7a8188`): tertiary text, placeholders, table headers.
- **Line** (`#dde0da`) / **Line Strong** (`#c6cac2`): dividers, card borders, input borders.

### Status inks (not general-purpose colors)
- **Stamp Green** (`#1f6e4a`): "done/submitted/approved" ink-stamp chip and its matching alert. A document-stamp green, deliberately not the institutional/semaphore green.
- **Document Warn** (`#a83a1f`): error/absent/closed states, chip and alert. A rust document-ink red, deliberately not semaphore red.

### Named Rules
**The One Accent Rule.** Signal Amber is the only color used for calls to action and primary emphasis; it never appears as a large background fill, only as text/icon color, thin fills on soft variants, or small solid badges.

**The Status-Is-Ink Rule.** A verdict (voted/submitted/approved, error/absent) is always drawn as a stamp or its dashed empty counterpart, in stamp-green or warn-red — never in the accent color and never as a generic pill.

## Typography

**Display Font:** Big Shoulders (with Arial Narrow, sans-serif fallback)
**Body Font:** IBM Plex Sans (with system-ui, -apple-system, sans-serif fallback)

Both are self-hosted (`src/public/fonts/`). Big Shoulders is condensed and heavy (weights 600–800 loaded); it appears only in headings, stand numerals, and score values — never in running text. IBM Plex Sans (weights 400–700) carries all body copy, labels, and form fields.

### Scale
Twelve named steps carry every font-size in the system — no literal rem value appears outside this list (enforced by the design-system detector):

| Token | Value | Used for |
|---|---|---|
| `--text-2xs` | `0.7rem` | chip label, "Nuevo" tag |
| `--text-xs` | `0.75rem` | table headers, footer note, score-badge label/save, floor-directory label |
| `--text-sm` | `0.8rem` | field hint, stand-card meta, stat-tile label |
| `--text-base` | `0.85rem` | field label, topbar mark/meta/exit, `btn--sm`, rubric-block index, stand-card summary, back-link, door desc |
| `--text-md` | `0.9rem` | alert, table body, textarea, rubric-criterion label, criteria-list |
| `--text-lg` | `0.95rem` | button text, credential lede, star-field legend |
| `--text-body` | `1rem` | body copy, inputs, floor-directory tile numeral |
| `--text-heading-sm` | `1.05rem` | topbar brand, stand-badge sm numeral, rubric-block title |
| `--text-heading-md` | `1.1rem` | stand-card name, door title |
| `--text-score` | `1.5rem` | score-badge value |
| `--text-numeral-lg` | `1.6rem` | stand-badge lg numeral, stat-tile value |
| `--text-display-sm` / `--text-display-lg` | `clamp(1.4rem,4.5vw,1.9rem)` / `clamp(1.5rem,5vw,1.85rem)` | page-head title / credential title |

### Named Rules
**The Digits-Get-Display Rule.** Big Shoulders is reserved for headings and numerals that read as signage (stand numbers, score value, table titles). Body text, buttons, and form fields stay in IBM Plex Sans even when bold.

**The Twelve-Step Rule.** Every `font-size` declaration references one of the twelve `--text-*` tokens above; none is written as a bare rem value. Two near-duplicate steps (`1.05rem`/`1.1rem`, `0.85rem`/`0.9rem`) are kept deliberately close because they mark genuinely different roles (brand vs. card title; field label vs. table body) at a scale where the difference matters more than the spacing.

## Layout

Single-column content (`main`, max-width `760px`) for identity and voting flows; a wide variant (`main.main--wide`, max-width `1180px`) for the jury/admin grid and table screens. Padding scales with viewport via `clamp()` (`clamp(20px, 5vw, 40px)` vertical, `clamp(16px, 4vw, 32px)` horizontal). A sticky `.topbar` (34px square ink mark + event name) tops every screen; a centered `.footer-note` closes it.

The directory grid (`stand-card` tiles) is `repeat(auto-fill, minmax(280px, 1fr))` with a 14px gutter — responsive by content, not breakpoint. The jury evaluation screen adds a `.station-rail` (one bar per rubric block) and a sticky `.score-badge` (`top: 78px`, `66px` under 560px) so progress and running average stay visible while scrolling a long rubric — this is the tablet/high-density surface's signature adaptation of the same token set used by the mobile apprentice flow. Two explicit breakpoints: `640px` (door-grid becomes two columns) and `560px`/`420px` (topbar sheds secondary meta, then the brand label, to fit a phone).

### Named Rules
**The Same Tokens, Different Budget Rule.** Apprentice (mobile, one-tap voting), jury (tablet, dense multi-block rubric with autosave) and admin (desktop tables) never fork the token set — they only change container width (`main` vs `main--wide`), density (rubric fieldsets vs. table rows), and which components appear.

## Elevation & Depth

Elevation is soft and functional, not decorative: a tight `shadow-pop` for interactive chrome (buttons, credential clip), a wider `shadow-card` for resting containers (cards, credential, table-wrap), and `shadow-raised` reserved for the one element that must float above scrolled content, the jury's sticky `score-badge`. All three are two-layer (a tight near shadow + a soft diffuse one), doubled in opacity for the dark scheme so depth reads the same on a black floor.

### Shadow Vocabulary
- **shadow-pop** (`0 1px 1px rgba(21,24,28,.05), 0 2px 6px rgba(21,24,28,.08)`): primary buttons, credential clip.
- **shadow-card** (`0 1px 2px rgba(21,24,28,.04), 0 8px 20px -12px rgba(21,24,28,.18)`): resting cards, credential, stand-card, table-wrap, door.
- **shadow-raised** (`0 2px 4px rgba(21,24,28,.06), 0 16px 32px -16px rgba(21,24,28,.28)`): sticky score-badge only.

### Named Rules
**The One Floating Element Rule.** Only the jury's sticky score-badge uses `shadow-raised`; every other surface stays at card-level or lower so nothing else competes with it for depth.

## Shapes

Five radii carry every ordinary control and container, plus two named, deliberate exceptions:
- `--radius-xs` (3px): status chips, the "Nuevo" tag — anything that reads as printed rather than UI chrome.
- `--radius-sm` (6px): buttons, inputs, textareas, topbar-exit, the generic `:focus-visible` fallback.
- `--radius-badge` (8px): stand badges, icon tiles, floor-directory tiles, the star-rating focus ring.
- `--radius-md` (10px): score-badge, stat-tile.
- `--radius-lg` (16px): credential, stand-card, rubric-block, table-wrap, door.
- `--radius-clip` (`7px 7px 3px 3px`) — **named exception:** the credential clip's own silhouette, used nowhere else; it mimics a physical badge clip, not a UI container.
- `--radius-pill` (999px) — **named exception:** the jury's `.station-rail` progress segments only. A fully rounded shape is otherwise banned (see Chip-Is-Not-a-Pill below); a progress track is the one affordance in this system that is genuinely supposed to read as a capsule.

A credential is never a plain bordered card: it carries a physical `.credential__clip` (a dark bar with a punched lanyard eyelet, `--radius-clip`) positioned to overlap its top edge, on all three entry screens (apprentice enter, jury enter, admin login).

### Named Rules
**The Chip-Is-Not-a-Pill Rule.** Status geometry never uses a fully rounded pill. Resolved states are `--radius-xs` ink stamps with a double ring (border + inset outline) and a slight rotation (−2deg done, +1.5deg warn); unresolved states are the same rectangle, dashed and unfilled, waiting for its stamp. `--radius-pill` is reserved exclusively for the station-rail progress track, never for a chip.

## Components

### Buttons
- **Shape:** 6px radius (`--radius-sm`), padding `13px 22px` (`--sm`: `9px 14px`).
- **Primary:** Signal Amber background, `accent-ink` text, `shadow-pop`; hover darkens to `accent-hover`.
- **Ghost:** transparent, `line-strong` border, `ink` text; hover raises border to `line-strong`→`ink-soft` and fills `paper-sunken`.
- **Ink:** solid near-black, `paper-raised` text — used for the topbar exit and secondary emphasis.
- **Active:** `translateY(1px) scale(0.99)` on all variants; disabled drops to 0.5 opacity.

### Chips (status stamps)
- **Done/Warn:** soft-tint background, matching border + inset outline (`outline-offset: -4px`) forming a double ring, uppercase `--text-2xs` label, `--radius-xs` (3px), slight rotation, `stamp-land` entrance keyframe (scale+rotate settle, respects `prefers-reduced-motion`).
- **Pending:** transparent fill, dashed `line-strong` border, `ink-faint` text — the un-stamped state, same `--radius-xs` shape.
- **Accent (inline data, not a verdict):** soft amber fill, same `--radius-xs` shape, no rotation, no ring — used for counts/tags like "Nuevo" or a level label ("Alto"), never for a pass/fail verdict.

### Cards / Containers
- **Corner Style:** 16px (`--radius-lg`) for credential, stand-card, rubric-block, table-wrap, door.
- **Background:** `paper-raised` on all of them, against the `paper` page floor.
- **Shadow Strategy:** `shadow-card` at rest; stand-card and door additionally lift `translateY(-2px)` on hover with a border-color shift.
- **Border:** 1px `line` on every container.
- **Internal Padding:** 18–24px, `clamp()`-scaled on the credential and rubric-block for mobile.

### Inputs / Fields
- **Style:** 1.5px `line-strong` border, `paper-raised` background, 6px radius, `IBM Plex Sans`.
- **Focus:** border shifts to Signal Amber (no glow/ring beyond the global `:focus-visible` outline).
- **Star rating:** native radio inputs visually hidden, SVG star labels (44px tap target), unchecked = `line-strong`, checked/hover = accent with a `scale(1.08)` pop — functions without JavaScript by design.
- **Rubric scale-row (jury):** a 1–5 button row per criterion, unchecked = outlined `line-strong`/`ink-soft`, checked = solid ink fill — denser and more form-like than the apprentice's stars, same radius/border language.

### Navigation
- **Topbar:** sticky, `paper-raised` background, 1px bottom border, ink square brand mark (34px, badge radius), role-aware meta (badge icon + name for voters, exit link). Sheds secondary meta then the brand label at narrow widths rather than wrapping.
- **Door grid (home):** two large bordered tiles (aprendiz/jurado) with an accent icon tile — the portada's "accreditation desk" choice between roles.

### Credential (signature component)
The identity device on all three entry screens (apprentice, jury, admin login): a raised card with a dark clip bar overlapping its top edge and a punched lanyard eyelet, evoking a physical event badge rather than a login form. Title in display type, lede text capped at 46ch, form fields below.

### Floor Directory (signature component)
Appears only on the desktop portada, below the two role doors: a dashed top rule, a small uppercase label ("Directorio de hoy — N stands"), and a wrapped row of square number tiles (one per real stand, 34px, badge radius), each titled with the stand's name. Reads as the board hanging at a real fair's entrance.

### Station Rail + Score Badge (signature component, jury)
A row of thin pill segments, one per rubric block, filling solid `stamp` green when a block is fully answered, half-filled accent when partial. Paired with a sticky ink-filled `score-badge` showing the live running average and an autosave indicator — the jury surface's answer to "official evaluation station with visible progress."

## Do's and Don'ts

### Do:
- **Do** keep Signal Amber (`#d9540c`) to primary actions, badges, and focus states; it is legible against the floor at every viewport and its rarity is what makes it read as "signal."
- **Do** draw every pass/fail or submitted/pending verdict as a stamp (3px radius, double ring, rotation) or its dashed empty counterpart, per the Status-Is-Ring rule.
- **Do** use Big Shoulders only for numerals and headings that function as signage; keep body copy, buttons, and form controls in IBM Plex Sans.
- **Do** give any new identity/entry surface the credential-and-clip treatment instead of a bare login card, matching the three existing entry screens.
- **Do** reuse the same token set across apprentice/jury/admin and differentiate only by container width and density, never by forking colors or type.

### Don't:
- **Don't** introduce a kicker/eyebrow label above headings. The build shipped and then removed this pattern site-wide during finish-review; it is a defect the codebase no longer carries and must not be reintroduced.
- **Don't** render a status as a generic rounded pill (`border-radius: 999px` colored badge). The system's status vocabulary is exclusively the ink-stamp/dashed-box pair.
- **Don't** use crema/parchment or warm neutrals for the page floor; the floor is cool grey (`#f3f4f1` light / `#17191c` dark) by explicit direction.
- **Don't** apply `shadow-raised` to more than one element per screen; it is reserved for the single floating score-badge so elevation stays legible as hierarchy, not decoration.
