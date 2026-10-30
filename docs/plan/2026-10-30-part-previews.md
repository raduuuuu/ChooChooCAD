# Part previews in the parts library (2026-10-30)

## Request

Owner, 2026-10-30: "in the library, can we show a small preview of the part"
— a small drawing of each part on its palette card.

## Context (what exists today)

- The parts library is the right-hand rail, 320px wide at a 1280px window.
  Each part is one card, one row, 36px tall on a pointer (44px on touch):
  code, name, size (`app/src/App.tsx` `renderBrand`, `app/src/app.css`
  `.piece-main`). The one-row card was a deliberate fix: two-row cards
  clipped the list before the brand shelves.
- The catalogue has grown to 52 cards (BRIO plus the IKEA and Playtive
  shelves), and the BRIO list already scrolls inside a 45vh tray.
- Ramps already carry a tiny ink chevron after their size: the canvas's
  rise mark, reused as an icon (design 12A).
- DESIGN.md rule 1: colour is spent only on verdicts; "thumbnails, chrome,
  labels, buttons and the palette get none". The beech colour is the
  track's, on the canvas.
- Several cards differ only in peg or socket: A / B / C, A1 / B1 / C1,
  A2 / B2 / C2, L / M, O1 / P1, I / J, O / P, F1 / G1, N / N1.
- The engine already draws any part: `renderGraph` on a one-piece graph
  gives its segments (roads, a buffer's body) and its ends with polarity,
  and `trackPath` turns segments into SVG paths.

## Design (decisions from the design review, 2026-10-30)

### Layout
- **1A, placement.** The drawing comes first on the card, in a fixed-width
  column: drawing, code, name, size. The codes still line up in a column of
  their own, one column over; the count badge stays at the top right, away
  from the drawing.
- **2A, size.** A 32×20px drawing box inside the existing 36px row, which
  keeps its height; on coarse pointers the row is 44px and the box 40×28px.
  To fit, the card's vertical padding goes from 8 to 7px (eng D4), stated
  beside the rule. The box sizes are pinned by a DOM test; the real row
  heights are measured in a browser at 1280 and 375px for the PR (eng D2:
  jsdom has no layout, so a jsdom height test could never fail).
- **Card width (eng D5).** Every card takes the rail's full width, as one
  column. Its grid is: drawing, code (at most 10ch, then an ellipsis), name
  (the one column that shrinks, ellipsis), size. A cut code is in full in the
  card's tooltip; the spoken name has never included the code and stays
  unchanged (10A).

```
 ┌──────────────────────────────────────────────────┐
 │ [ 32×20 ]  A2   Mini straight            54mm    │  36px
 └──────────────────────────────────────────────────┘
   drawing    code name (fills)              size
```

### States
- **3A.** The drawing takes the card's text colour: `--ink` normally,
  `--ink-soft` wherever the card's text is (more than you own, disabled
  while over the size limit). Unverified changes nothing in the drawing;
  the dotted border and asterisk say it. No opacity anywhere. Both colours
  are measured at 3:1 or better on `--paper` (rule 5), the ratio written
  next to the rule.
- **4A.** A part that cannot be drawn gets an empty 32×20 box, so the
  columns stay aligned. Drawing is per card and an error in one is caught
  there; it never breaks the list. Drawings are rebuilt whenever the resolved
  library changes (eng D1), never cached by id, so a corrected part's drawing
  changes at once.

| Card | Drawing |
|---|---|
| Normal | ink outline, end marks |
| Unverified (dotted border, `*`) | unchanged |
| More than you own (dashed, grey text) | `--ink-soft` |
| Disabled (over the size limit) | `--ink-soft` |
| Cannot be drawn | empty box, same width |
| Brand shelf collapsed | drawn but hidden inside the closed shelf (native `<details>` keeps children mounted); fixed widths, so no shift on opening |
| Picked | no change (picked-card look filed as a TODO) |

### Journey
- **5A, pose.** Each part is drawn exactly as it lands when double-clicked on
  empty floor: entry end on the left, travelling right, bending the way that
  first placement bends, with the canvas's own up and down. A test compares
  each card's drawing with that first placement. Pieces that differ only in
  pegs and sockets (L and M, for example) are told apart by 8A, not by pose.

| Step | User does | User feels | Plan specifies |
|---|---|---|---|
| 1 | Scans the parts list | "which one is the switch?" | drawings first in the row (1A), readable at 32×20 (2A, 6A) |
| 2 | Spots the shape | recognition | ink outline (7A), end marks (8A) |
| 3 | Clicks | expectation | the ghost lands in the drawn pose (5A) |
| 4 | Sees the ghost | trust | same shape, same way round |

### Drawing
- **6A, scale (amended by eng D3).** Each drawing's shape is fitted to its
  own 32×20 box, and every plank is drawn at one schematic track width, 6px
  (8px on touch), whatever the scale. So a 54mm and a 216mm straight really
  are the same picture; the size label carries the magnitude (rule 4). The
  drawing is a schematic, not the part's exact footprint.
- **7A, style.** Each road's plank outline in 1.5px ink, non-scaling stroke,
  paper inside; no grooves, no shadow, no beech (rule 1). A buffer stop keeps
  its solid beam, a ramp its chevron.
- **8A, ends.** Each end carries the canvas's own peg or socket mark (rule 11:
  one meaning everywhere), in ink, at a 5px minimum whatever the drawing's
  scale. A test checks every look-alike family (A/B/C, A1/B1/C1, A2/B2/C2,
  L/M, O1/P1, I/J, O/P, F1/G1, N/N1) draws differently.
- **9A, chevron.** A ramp's chevron is drawn in its preview, pointing up the
  slope; the chevron after the size label goes.

### Accessibility and width
- **10A.** The drawing is decorative: `aria-hidden`, never focusable,
  `pointer-events: none`, so a click, double-click, drag or touch on it acts
  on the card. The card's accessible name is unchanged (a test pins it).
- **11A.** Names stay on one line and cut with an ellipsis. The full name is
  in the accessible name and in the card's tooltip, which becomes "<code>
  <name>. Double-click to place directly". Tested in the 320px rail with the longest
  name and a long user code, on pointer and touch.

## NOT in scope
- A look for the picked card (TODO).
- Replacing the verdict red on unverified cards (TODO).
- The app's name on screen (TODO).
- Hover enlargement or a larger preview popover: one size, decided in 2A.
- Drawing the palette in the canvas's wood colours: ruled out by 7A and rule 1.

## What already exists
- `renderGraph` on a one-piece graph gives every road's segments and every
  end with its polarity; `trackPath` turns segments into SVG paths.
- The canvas's peg and socket marks, the buffer beam and the rise chevron
  (TrackCanvas.tsx, app.css) are reused, not redrawn.
- The ramp chevron icon already used inside a card (`rise-chevron-icon`).
- The `.piece-main` grid, the coarse-pointer block and the type floors.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~4h / CC: ~25min)** — app — A `PartPreview` component: one-piece renderGraph at the first-placement pose, own bounds, fitted to 32×20 (40×28 coarse) in pixels, 6px schematic track as two strokes, peg 6px disc / socket 7px ring, beam and chevron; rebuilt per library (D1); empty box on error
  - Surfaced by: 2A, 4A, 5A, 6A, 7A, 8A, 9A
  - Files: app/src/PartPreview.tsx, app/src/app.css, app/src/App.tsx
  - Verify: preview of each built-in part matches its first placement; look-alike families differ
- [ ] **T2 (P1, human: ~1h / CC: ~10min)** — app — Full-width cards (D5); grid: preview, code ≤10ch, shrinking name, size; vertical padding 7px (D4); tooltip "<code> <name>. Double-click to place directly"; drop the size's chevron
  - Surfaced by: 1A, 9A, 11A
  - Files: app/src/App.tsx, app/src/app.css
  - Verify: browser at 1280 and 375px: rows 36/44px, longest name, a long user code (D2)
- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — app — States: --ink-soft on unowned and disabled cards, no opacity; contrast measured and written in tokens.css
  - Surfaced by: 3A
  - Files: app/src/app.css, app/src/tokens.css
  - Verify: ratios recorded; DOM test of the unowned card's preview colour
- [ ] **T4 (P1, human: ~30min / CC: ~5min)** — app — aria-hidden, unfocusable, pointer-events none; accessible names unchanged
  - Surfaced by: 10A
  - Files: app/src/PartPreview.tsx
  - Verify: existing palette label tests pass unchanged; drag from the drawing still starts a drag
- [ ] **T5 (P2, human: ~15min / CC: ~3min)** — DESIGN.md — Record that the palette's previews are ink outlines with the canvas's end marks
  - Surfaced by: 7A, 8A
  - Files: DESIGN.md
  - Verify: read

## Eng review (2026-10-30)

Target: this file. Reviewer: /plan-eng-review, Claude, at main 087ed26.

### Scope Challenge
About 6 files (new `PartPreview.tsx` and its test, App.tsx, app.css,
tokens.css, DESIGN.md) and one new component: under the complexity gate.
Scope accepted as-is. Nothing in the base log since 2026-10-29 touches the
palette (`git log` on App.tsx and app.css).

### Section 1: Architecture
- One new component, `PartPreview`, fed by a map built once per library:
  `useMemo(() => previews(library), [library])` (D1). Each entry is the
  one-piece `renderGraph` at the identity frame, turn left: what a
  double-click on an empty floor places (5A), checked by a test against
  `reduce(add)`.
- Laid out in PIXELS in JS: the drawing's bounds are worked out from the
  segments, then scaled to the box, so the 6px track width (D3), the 1.5px
  stroke and the end marks keep their pixel sizes. The canvas's
  `scale(1, -1)` is applied, so up and down match the canvas.
- Necessary for decisions already taken (no question asked):
  - BOUNDS (Codex OV1, verified): `renderBounds` (render.ts:219) skips plank
    width and arc bulge and leans on canvas padding, so the preview computes
    its own bounds from sampled centreline points plus half the track width
    and the end-mark radius.
  - OUTLINE (Codex OV3, verified): `plankEdges` (trackPath.ts:387) gives the
    two side edges only. The preview draws each road as a 6px-wide stroked
    centreline in paper over a 9px one in ink (an outline by two strokes),
    road by road. That way crossings, switches and two-arc S-bends compose
    without end-cap geometry, and their shared middles merge cleanly.
  - END MARKS (Codex OV2, verified): `.port-dot` has a 4-unit stroke and an
    --ink-soft fill, sized for the canvas. The preview gets its own classes:
    a peg is a 6px filled ink disc; a socket a 7px ring, 1.5px ink stroke,
    paper inside (4px clear). The same meaning as on the canvas (rule 11),
    with sizes fitted to the card.
  - The "not rendered until opened" promise is struck: `<details>` keeps
    its children mounted (Codex OV7, verified).

### Section 2: Code quality
No issues beyond the above. No new shared helper: the preview reuses
`renderGraph` and `segmentPath`; its bounds and stroke logic are its own.

### Section 3: Tests

```
CODE PATHS                                   USER FLOWS
[+] previews(library)                        [+] Scan the parts list
  |-- [GAP] every built-in part draws          |-- [GAP] look-alikes draw differently (8A)
  |-- [GAP] rebuilt after a correction (D1)    |-- [GAP] browser: rows 36/44px at 1280/375 (D2)
  |-- [GAP] a part that throws -> empty box    [+] Pick a part
[+] PartPreview                                |-- [GAP] drawing pose = first placement (5A)
  |-- [GAP] box 32x20 / 40x28 attributes (D2)  |-- [★★ TESTED] click/drag/keys on the card (existing palette DOM tests)
  |-- [GAP] aria-hidden, no focus (10A)        [+] Unowned / disabled card
  |-- [GAP] ink-soft on unowned (3A)             |-- [GAP] drawing takes --ink-soft
[+] card grid: code <=10ch, name ellipsis (D5)  |-- [GAP] long user code: one row, browser check
```

Required tests (app/src/partPreview.test.tsx, plus a DOM file for states):
1. Every built-in part's preview has the same port positions, in its own
   frame, as that part placed by `add` on an empty floor.
   Value: protects=the card shows what lands; fails_when=the preview's pose or flip drifts; why_new=no preview exists; seam=none; no_claim=pixel look
2. Each look-alike family renders different markup (8A).
   Value: protects=A/B/C and the other families differ; fails_when=end marks dropped; why_new=new; seam=none; no_claim=readability at size (browser check)
3. A correction to IKEA-145 changes its preview (D1).
   Value: protects=no stale drawing; fails_when=cached by id; why_new=new; seam=none; no_claim=none beyond protects
4. A part whose drawing throws gets an empty box of the same size (4A).
   Value: protects=one bad part never breaks the list; fails_when=the try/catch goes; why_new=new; seam=a test-local part; no_claim=real submissions' shapes
5. The box is 32×20 (40×28 on coarse), aria-hidden, unfocusable; the
   card's accessible name is unchanged (D2, 10A).
   Value: protects=size and a11y contract; fails_when=attributes change; why_new=new; seam=none; no_claim=real row height (browser)
6. The unowned card's preview uses --ink-soft (3A).
   Value: protects=state follows text; fails_when=class missing; why_new=new; seam=none; no_claim=contrast ratio (recorded in tokens.css)
Browser check for the PR: row heights 36 and 44px at 1280 and 375px wide,
the longest name, a long user code, and the look-alike families side by side.

### Section 4: Performance
No issues. 52 one-piece placements and renders per library change, measured
when built and quoted in the PR; nothing per frame or per drag.

### Outside voice (Codex, gpt-6-astra, completed)
Seven findings, all verified. OV4 (6A contradiction) → D3; OV5 (row budget) → D4;
OV6 (card width, codes) → D5; OV1, OV2, OV3 and OV7 recorded above as
necessary or corrected.

## Decision ledger (eng)

- D1 A: rebuild per library. D2 A: pin the box in jsdom, measure rows in a
  browser. D3 B: one schematic track width. D4 A: padding 7px. D5 A:
  full-width cards, code at most 10ch.
- Approval readiness: PASS (D1-D5, each answered 2026-10-30).

## Failure modes
| Path | Failure | Test | Handling | User sees |
|---|---|---|---|---|
| preview of a submitted part | renderGraph throws | test 4 | caught per card | empty box, card still works |
| correction | stale drawing | test 3 | rebuilt per library | the new shape |
| long code or name | wraps, row grows | browser check | ellipsis + 10ch cap | one row |
Critical gaps: 0.

## Worktree parallelization strategy
Sequential implementation, no parallelization opportunity.

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (rules 1, 4, 5, 7, 11 apply); UI scope: palette cards |
  | Step 0               | 2/10 initial; all 7 dimensions                |
  | Pass 1  (Info Arch)  | 2/10 → 9/10 after fixes                       |
  | Pass 2  (States)     | 1/10 → 8/10 after fixes                       |
  | Pass 3  (Journey)    | 3/10 → 9/10 after fixes                       |
  | Pass 4  (AI Slop)    | 2/10 → 9/10 after fixes                       |
  | Pass 5  (Design Sys) | 4/10 → 9/10 after fixes                       |
  | Pass 6  (Responsive) | 2/10 → 8/10 after fixes                       |
  | Pass 7  (Decisions)  | 0 open in the plan; 3 existing issues filed   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                             |
  | What already exists  | written                                       |
  | TODOS.md updates     | 3 items proposed, 3 added                     |
  | Approved Mockups     | 0 generated (designer has no OpenAI key)      |
  | Decisions made       | 11 added to plan                              |
  | Decisions deferred   | 0                                             |
  | Overall design score | 1/10 → 8/10                                   |
  +====================================================================+
```

Remaining below 10: Pass 2 leaves the picked card's look to a TODO; Pass 6
has no separate check of the under-620px layout beyond the touch sizes.

### Unresolved Decisions
None.


## Eng Review Completion Summary
- Step 0: Scope Challenge — scope accepted as-is
- Architecture Review: 4 issues found (bounds, outline, end-mark sizes, the lazy-render promise), all settled as necessary or corrected
- Code Quality Review: 0 issues found
- Test Review: diagram produced, 9 gaps identified, 6 tests plus a browser check required
- Performance Review: 0 issues found
- NOT in scope / What already exists: written above
- Failure modes: 0 critical gaps
- Unresolved decisions: 0
- Outside voice: codex, completed, 7 findings (3 decided as D3-D5, 4 folded in)
- Parallelization: sequential

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 4 | CLEAR (2026-10-23, another plan; not run on this one) | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | codex (gpt-6-astra), design and eng phases | Independent 2nd opinion | 2 on this plan | completed | design: 6 findings; eng: 7 findings, all verified |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 10 | ISSUES OPEN (all mapped to tasks T1-T5) | 13 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 5 | ISSUES OPEN | score: 1/10 → 8/10, 11 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, design phase and plan-review phase, both completed 2026-10-30 at 087ed26.
- **CROSS-MODEL:** the eng-phase Codex review found what both design reviewers missed: decision 6A contradicted itself, the 20px box overran the row's padding, and the existing helpers give no plank outline or tight bounds. Native and outside reviews agreed on everything else.
- **VERDICT:** design and eng reviews complete with every decision taken — eng review ISSUES OPEN means mapped work, not open questions; ready to implement

NO UNRESOLVED DECISIONS
