# A measured mark on library cards (2026-11-03)

Owner's request: "add a verified checkmark to the measured pieces;
/plan-design-review should weigh in on this." It replaces design decision 9 of
`2026-11-02-photo-parts-and-stations.md` ('Confirmed by photo' under the
size), which was never built: one mark, not two.

## What "measured" means here

A piece earns the tick when a check on a real piece backs the figures it is
using now (decision 9A):

- the owner's photos, by the rules in `engine/data/photoReadings.ts`
  (`photoOutcome`): every required figure read from two photos agreeing
  within 0.5mm, good to ±1mm; or
- the owner's own direct measurement, recorded in the measurements file
  (decision 5B, 13A).

| Piece | Status | Backed by | Tick |
|---|---|---|---|
| T (T switch) | `user-measured` | Photos 84404 and 84405: through road and curved end | Yes |
| D (Long straight) | `published` | The 216mm trial: 216.52 and 216.88, within ±1mm of 216 | Yes (4A: same tick) |
| A (Medium straight) | `published` | The photos' reference, so no photo checks it. The owner will measure it directly (5B) | When the owner's figure is recorded and within ±1mm of 144 (13A) |
| Other Generic | `published` | Nothing here yet | No |
| Ramps, switches, structures, other brands | `unverified` | Estimates; keep the dotted border and `*` | No |

The tick is derived, never stored by hand: from `PHOTO_READINGS`, `TRIAL` and
the owner's direct readings, compared against the piece's CURRENT figures.
A stored correction that moves a figure more than ±1mm from what was read
drops the tick (9A).

## Design decisions

| # | Decision | Answer |
|---|---|---|
| 3 | The mark: a tick right after the code, in the slot the unverified `*` uses ("D✓"); solid border kept; no extra width. | 3A |
| 4 | T (figures from photos) and D (published figure confirmed by photos) get the same tick. | 4A |
| 5 | The reference straight A gets the tick too, backed by the owner's own measurement (photos cannot check their own reference). | 5B, owner: "give it a tick, I will personally measure it to confirm" |
| 6 | Its words: "Measured." in the card's title and accessible name ("Add Long straight. Measured."). | 6C |
| 7 | Where: the library card only. Not the layout list, verdict, build mode or 3D. The friend's shared view and the phone view have no library, so they show no tick. | 7A |
| 8 | In every card state the tick follows the card's text colour (`currentColor`): `--ink`, `--ink-soft` when unowned, the pressed colour when picked. | 8A |
| 9 | The tick shows only while the piece's current figures agree, within ±1mm, with what was read. | 9A |
| 10 | A one-line key under the Generic track list explains both card signs. | 10A |
| 11 | The tick is drawn, not typed: a small inline SVG path, 1.5px non-scaling stroke in `currentColor`, sized to the code's cap height, `aria-hidden`. IBM Plex Mono as bundled has no U+2713, so a text tick would fall back to a different system font on each OS. The key uses the same drawn tick. | 11A |
| 12 | DESIGN.md rule 11 gets a card-marks bullet: drawn tick = measured; `*` + dotted border = unverified size; dashed border + grey = more than you own; each with its measured contrast. | 12A |
| 13 | A's tick appears once the owner's reading is recorded and agrees; until then A shows none. The owner gets an engineering diagram of exactly what to measure. | 13A |
| 14 | The key reads "✓ Measured.  * Unverified size.", matching the cards' existing "Unverified size." and the shelves' "unverified". | 14A |

## The card, before and after

```
 before:  [drawing]  D    Long straight          216mm
          [drawing]  N*   Ramp                   216mm      (dotted border)
 after:   [drawing]  D✓   Long straight          216mm
          [drawing]  T✓   T switch               ...
          [drawing]  N*   Ramp                   216mm      (dotted border)
          ...
          ✓ Measured.  * Unverified size.                   (12px --ink-soft key)
          Structures
          ...
```

## States (decision 8, 9)

```
  CARD STATE        | TICK
  ------------------|----------------------------------------------------
  normal            | --ink, after the code
  more than you own | --ink-soft with the rest of the card (dashed border)
  picked (pressed)  | the pressed text colour
  corrected >±1mm   | no tick (the figure in use was never checked)
  A before reading  | no tick; appears when the owner's figure is recorded
```

There is no loading or error state: the tick is computed with the library.

## Journey

```
  STEP | USER DOES                      | USER FEELS                | PLAN SPECIFIES?
  -----|--------------------------------|---------------------------|----------------------------
  1    | Scans the track list           | "which sizes can I trust" | ✓ and * in the code column (3A)
  2    | Wonders what ✓ and * mean      | uncertain                 | one-line key under the list (10A, 14A)
  3    | Hovers or uses a screen reader | wants it in words         | "Measured." in title and name (6C)
  4    | Corrects a ticked piece        | expects honesty           | tick drops if the figure moved (9A)
  5    | Measures A, figure recorded    | sees the effort counted   | A's tick appears (13A)
```

## NOT in scope

- The tick anywhere but the library card (7B, 7C declined).
- Distinguishing photo-measured from photo-confirmed on the card (4B declined); the readings say which.
- Renaming "unverified" to "not measured" across the app (14B declined).
- New photo readings or changes to the photo rules.
- Any change to verdicts: the tick is about a piece, not a layout.

## What already exists

- The `*` slot: `.piece.is-unverified .piece-id::after` (app.css), and the
  card's accessible-name sentences (App.tsx, "Unverified size.").
- `photoOutcome` and `agreedFigure` (engine/data/photoReadings.ts), `TRIAL`.
- The part card's ink drawings in `currentColor` (PartPreview.tsx), the model for the drawn tick.
- The owner's measurements file (engine/data/measurements.ts) for A's direct reading.
- DESIGN.md rules 1, 3, 5, 11.

## Implementation Tasks

- [x] **V-T1 (P1, human: ~3h / CC: ~20min)** — engine — `measuredParts(library)`: piece ids whose current figures agree within ±1mm with photo readings, the trial, or a direct reading
  - Surfaced by: decisions 4, 5, 9, 13. Files: engine/data/photoReadings.ts (or a new measured.ts), engine/data/measurements.ts. Verify: unit tests for T, D, A-without-reading, A-with-reading, and a correction outside ±1mm dropping the tick; each with a run mutation.
- [x] **V-T2 (P1, human: ~2h / CC: ~15min)** — library card — drawn tick after the code, `currentColor`, "Measured." in title and accessible name
  - Surfaced by: decisions 3, 6, 8, 11. Files: app/src/App.tsx, app/src/app.css. Verify: DOM test for names; browser check of normal, unowned and picked cards.
- [x] **V-T3 (P2, human: ~1h / CC: ~10min)** — library — the one-line key "✓ Measured.  * Unverified size." under the Generic list
  - Surfaced by: decisions 10, 14. Files: app/src/App.tsx, app/src/app.css. Verify: DOM test.
- [x] **V-T4 (P2, human: ~30min / CC: ~5min)** — DESIGN.md — card-marks bullet with measured contrast
  - Surfaced by: decision 12. Files: DESIGN.md.
- [ ] **V-T5 (P1, human: ~30min / CC: ~10min)** — owner — engineering diagram of what to measure on A, and record the figure
  - Surfaced by: decisions 5, 13. Files: a diagram sent to the owner; engine/data/measurements.ts once measured.

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI scope: card |
  | Step 0               | 4/10; all 7 passes                          |
  | Pass 1  (Info Arch)  | 4/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 5/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 4/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 6/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 7/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 9/10 → 9/10 (no issues)                     |
  | Pass 7  (Decisions)  | 2 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no image API key), 0 approved  |
  | Decisions made       | 12 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 4/10 → 9/10                                 |
  +====================================================================+
```

Unresolved decisions: none.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run for this plan |
| Outside Review | — | Independent 2nd opinion | 0 | skipped | declined by owner (D2) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not run for this plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 4/10 → 9/10, 12 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** design phase: skipped by the owner (D2); no outside provider ran.
- **VERDICT:** DESIGN CLEARED — eng review required.

NO UNRESOLVED DECISIONS
