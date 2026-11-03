# Part origin: a mark and a link for parts taken from printable designs (2026-11-03)

Owner's request: "similarly to the measured checkmark, have a similar
indication that a part is taken from MakerWorld and ideally have a way in
which the user is taken to the MakerWorld page for that part." The standing
rule (no source names, links or creators) is **lifted for part origin**
(owner, 2026-11-03): a printed part may name its site, link to its model page
and credit its creator. The brand name the app replaces with "Generic" is
still never shown.

## Which parts, and the data

Every part whose figures were measured off a printable design's model file.
The links were removed from the repo on 2026-11-01 and are recoverable from
git history (commit 8fe9361) and the downloaded model files' names:

| Parts | Site | Model | Creator |
|---|---|---|---|
| L, M, O1, P1, H, H1, H2, I, J, O, P | MakerWorld | 1001504 | Cactus 973 |
| TJ | MakerWorld | 3225419 (instance 3652740) | Flame |
| X | MakerWorld | 795599 | Fantastic Plastic Person |
| EE | MakerWorld | 887239 | AU3D |
| F, G | MakerWorld | 3121622 | Isaxon |
| F1, G1 | MakerWorld | 892305 | AU3D |
| IKEA-50 … IKEA-X145 (11) | MakerWorld | 2181560 | Vamuss |
| IKEA-150, PLAYTIVE-30 … 200 | several reproductions, no single model | — | — |
| T (now photo-measured) | was MakerWorld 904802 by AU3D | — | — |

Several model TITLES contain the brand name the app never shows, so the
origin carries site, model id and creator, never the title.

Data shape (proposal): `dimensions.origin?: { site: 'MakerWorld'; modelId:
string; creator: string; url: string }`, set on those seeds, with the URL
built from the model id.

## Where it would show

The library card, beside the existing card signs: drawn tick (measured),
`*` + dotted border (unverified size), dashed border (more than you own).
And somewhere a user can follow the link to the model page.

## Constraints

- The brand name stays out (titles never shown).
- DESIGN.md rule 1 (no colour off verdicts), rule 3 (claim no more than
  was checked), rule 11 card-marks bullet (one sign per meaning), rule 10
  (44px touch targets), rule 13 (a shared railway is an invitation).
- The card is one button: a click picks the part, a double-click places it.
  A link inside the button would steal those clicks.
- Every printed part is already `*`: the new mark must not make a card
  noisy, and must not read as more or less trustworthy.

## Design decisions

| # | Decision | Answer |
|---|---|---|
| 3 | The card itself gets no new mark: 3A (a glyph after the size) was superseded by 5A. | 3A, then 5A |
| 4 | The link is a small separate button beside each printed card, outside the card's own button (which keeps click = pick, double-click = place). | 4B |
| 5 | That button IS the sign: no second mark inside the card. | 5A |
| 6 | Its accessible name and tooltip: "Model by {creator} on MakerWorld (opens in a new tab)"; the visible button is the glyph only. | 6A |
| 7 | Parts with no single model (IKEA-150, PLAYTIVE-*) get no button; they keep their `*`. | 7A |
| 8 | The T switch keeps its link to the model it was first drawn from; its Measured tick says its sizes come from photos. | 8A |
| 9 | The button stays live while placing is paused, and follows the card's colour (`currentColor`), so it greys on an unowned card. | 9A |
| 10 | The key under the track list gains a third entry: "[nozzle] Printable model." | 10A |
| 11 | The glyph: a drawn print nozzle over one layer line, ~12px, stroke 2 in `currentColor`, like the Measured tick; `aria-hidden`, the name carries the words. | 11A |
| 12 | Build mode's pull list ("Get these out of the box") carries the same link on each printed part's row. | 12A |
| 13 | In the pull list it looks the same as in the library: the glyph-only button, same accessible name. | 13B |
| — | DESIGN.md's card-marks bullet (verified-mark review, 12A) gains the nozzle entry: applied, not re-asked. | prior 12A |

## The library rail, after

```
  [drawing] L*   Large left switch      r182   [⌂̲]   <- link button: nozzle glyph
  [drawing] H*   Crossing               144    [⌂̲]
  [drawing] A✓   Medium straight        144mm
  ...
  ✓ Measured.  * Unverified size.  [⌂̲] Printable model.
```

## States

```
  STATE                       | LINK BUTTON
  ----------------------------|---------------------------------------------
  normal printed card         | live, --ink glyph, beside the card
  unowned card                | live, --ink-soft with the card (9A)
  placing paused (over limit) | live: a link never changes the layout (9A)
  no single model             | absent (7A)
  T switch (photo-measured)   | live, beside the Measured tick (8A)
  brand shelf closed          | inside the closed shelf, like its cards
```

## Journey

```
  STEP | USER DOES                      | USER FEELS           | PLAN SPECIFIES?
  -----|--------------------------------|----------------------|------------------------------
  1    | Scans the list                 | "which can I print?" | nozzle button beside those cards (4B, 5A)
  2    | Doesn't know the glyph         | unsure               | key: "[nozzle] Printable model." (10A)
  3    | Hovers / screen reader         | wants who and where  | "Model by Cactus 973 on MakerWorld (opens in a new tab)" (6A)
  4    | Clicks it                      | expects to leave     | new tab, nothing in the app changes (9A)
  5    | Opens Build it, sees a shortfall | "where do I get one" | same button on the pull-list row (12A, 13B)
```

## Accessibility and layout

- The button is a real link (`<a href target="_blank" rel="noopener noreferrer">`)
  beside the card's button, never inside it.
- Size: at least 32px wide and 36px tall on a pointer, 44px on coarse
  pointers (rule 10), like the card's other side controls.
- One tab stop per printed card (accepted with 4B).
- Phones show no library or build mode controls for this.

## NOT in scope

- A mark inside the card (5A).
- Links for parts with no single model (7A).
- Visible creator names on cards (6C declined).
- Model titles (they contain the brand name the app never shows).
- Finding new printable bridges and tunnels (separate research task).

## What already exists

- The card's side-control pattern and its sizing (app.css, `.piece` row).
- The drawn Measured tick (`MeasuredTick`, PartPreview.tsx): the model for the nozzle.
- The key line under the Generic list (`.palette-key`).
- The pull-list table (BuildMode.tsx, `.build-parts`).
- Model ids and creators in git history (commit 8fe9361) and the downloaded files' names.

## Implementation Tasks

- [x] **P-T1 (P1, human: ~2h / CC: ~15min)** — engine — `dimensions.origin` (site, model id, creator, URL) on the printed seeds, never a title
  - Surfaced by: data table; decisions 6, 7, 8. Files: engine/src/parts/schema.ts, engine/data/*Seeds.ts, generic.ts, thirdParty.ts. Verify: a test that every printed part with one model has an origin, none carries the brand name, and URLs are built from ids.
- [x] **P-T2 (P1, human: ~2h / CC: ~15min)** — library — the nozzle link button beside printed cards; key's third entry
  - Surfaced by: decisions 4, 5, 6, 9, 10, 11. Files: app/src/App.tsx, app/src/PartPreview.tsx, app/src/app.css. Verify: DOM test for name, href, target, rel, presence/absence; browser check.
- [x] **P-T3 (P2, human: ~1h / CC: ~10min)** — build mode — the same link on printed rows of the pull list
  - Surfaced by: decisions 12, 13. Files: app/src/BuildMode.tsx. Verify: DOM test.
- [x] **P-T4 (P2, human: ~20min / CC: ~5min)** — DESIGN.md — nozzle entry in the card-marks bullet
  - Surfaced by: prior 12A. Files: DESIGN.md.

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present; UI: card link, key, pull |
  | Step 0               | 3/10; all 7 passes                          |
  | Pass 1  (Info Arch)  | 3/10 → 9/10 after fixes                     |
  | Pass 2  (States)     | 5/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 5/10 → 9/10 after fixes                     |
  | Pass 4  (AI Slop)    | 6/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 9/10 → 9/10 (prior decision applied)        |
  | Pass 6  (Responsive) | 9/10 → 9/10 (no issues)                     |
  | Pass 7  (Decisions)  | 2 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no image API key), 0 approved  |
  | Decisions made       | 11 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 9/10                                 |
  +====================================================================+
```

Unresolved decisions: none.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run for this plan |
| Outside Review | — | Independent 2nd opinion | 0 | skipped | declined by owner (D2) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not run for this plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 3/10 → 9/10, 11 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** design phase: skipped by the owner (D2); no outside provider ran.
- **VERDICT:** DESIGN CLEARED — eng review required.

NO UNRESOLVED DECISIONS
