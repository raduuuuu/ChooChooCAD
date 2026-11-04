# Version list and trait names (design review, 2026-11-04)

Two things, decided together because the owner's question joined them:

1. **The version list** on the selected-piece strip (generic-TODOS P3; the
   fallback in design decision 3A of
   `docs/plan/2026-11-03-next-parts-ceo-review.md`): what shows when a placed
   piece has three or more versions to swap to.
2. **Trait names for the non-Generic track systems.** The owner asked whether
   to keep the maker distinction or list one "short curve" with a version per
   maker, "without naming a brand name that we might infringe".

Mockups: none. The designer has no image API key; the review is text-only.

## Decisions

| # | Question | Decision | Why |
|---|----------|----------|-----|
| D1 | Maker shelves, or one "Short curve" with a version per maker? | **Keep separate shelves**; a swap version is still a piece with identical ends and shape (`joinsAlike`); **no brand named** in anything the app shows | The non-Generic pieces differ physically: small-peg pegs don't plug into Generic sockets and their curves have their own radius, so they can't be swap versions. Measuring a real piece upgrades its existing card (unverified to measured); it doesn't add a version |
| D2 | What to call the shelves | **"Small-peg track"** (today's IKEA Lillabo shelf) and **"Look-alike track"** (today's Lidl Playtive shelf) | Each name says the one fact that changes what you buy or click: whether it plugs into Generic |
| D3 | What the version list holds | **The whole family**: the plain piece first, then its versions in library order; the current one shown, marked "now", not clickable | Same list and order on every piece of a family; answers "what is this and what else could it be" |
| D4 | When the list replaces buttons | **Three or more swaps** become one **"Make it…"** button that opens the list; one or two stay as buttons, as today | The common case keeps one click; wording continues "Make it a …" |
| D5 | A version that would be refused | **Checked when the list opens**: a blocked row is greyed, its reason on the row ("its platform would sit on piece 3"), and can't be picked | You only pick versions that fit, and the reason sits beside the name |
| D6 | The control | **In-place disclosure**: "Make it…" (`aria-expanded`) opens a group of buttons inside the strip, the verdict fold's pattern | Reuses an existing pattern; real buttons can carry D5's reasons; no pop-up component |
| D7 | Open, close, focus | Opening moves focus to the first pickable row; Tab and arrows walk rows, skipping blocked ones; **Escape, a pick, selecting another piece, undo or a canvas click close it**; focus returns to "Make it…"; a pick is announced as today ("Piece 4 is now a …"); a blocked row reads "Station straight, unavailable: its platform would sit on piece 3" | The standard disclosure flow; repeated swaps stay one keystroke away |
| D8 | Build now or later | **Later**, with the first piece that has a third version; the brand renaming is built now | No real piece can show the list today, so it can't be tried in the real app |
| D9 | Keeping the deferral honest | Update the TODO to point here, and **add a tripwire test** that fails when any piece has three or more swaps | A reminder no one has to remember |

## The version list (built later, D8)

```
Strip, a piece with 1 or 2 swaps (unchanged):
  Piece 4: Medium straight (A), 144mm  [← ↑ ↓ →] [Rotate run (R)] [Make it a Station straight] [Remove piece]

Strip, a piece with 3+ swaps, list open (D4, D6):
  Piece 4: Medium straight (A), 144mm  [← ↑ ↓ →] [Rotate run (R)] [Make it… ▾] [Remove piece]
    Medium straight                              now
    [Station straight]
    [Tunnel straight]
    Level crossing     unavailable: its barrier would sit on piece 3
```

- Order (D3): plain base, then the base's versions in library order. The
  current row is text, not a button.
- Blocked rows (D5): the same clash check the swap runs (`newlyHit` through
  `swapPiece`), once per row when the list opens. Greyed with the ink-soft
  token at the contrast rule 5 measures against the strip's surface; never
  colour-only (rule 2) and never styled like a pass (rule 3).
- Narrow screens are view-only (`screenMode`), so the list never shows on a
  phone. Coarse pointers: rows are strip buttons, so rule 10's 44px floor
  applies.
- Copy names no direction (rule 7).

## Trait names (built now, D1 and D2)

What the app shows today, and what it becomes. Internal ids (`IKEA-C45`,
`PLAYTIVE-110`) and the `Brand` enum stay: saved layouts and share links store
them, and card codes already strip the prefix (`shortCode`).

| Where | Today | Becomes |
|-------|-------|---------|
| Shelf labels (`App.tsx` `BRAND_LABEL`) | IKEA Lillabo, Lidl Playtive | Small-peg track, Look-alike track |
| Part names (`thirdParty.ts`) | Lillabo straight / curve, 45° / switch / crossing; Playtive straight, short … | Small-peg straight / curve, 45° / switch / crossing; Look-alike straight, short … |
| Add-your-own-part picker (`SubmitPart.tsx`) | Generic, IKEA Lillabo, Lidl Playtive, Hape, Thomas, Melissa & Doug | Generic, Small-peg, Look-alike, Another system (Hape, Thomas, Melissa & Doug all read "Another system"; their stored enum is unchanged) |
| Picker intro (`SubmitPart.tsx`) | "Nobody publishes piece sizes for IKEA or Lidl track …" | the same sentence about small-peg and look-alike track |
| Dimension notes and sources (`thirdParty.ts`, shown in the inventory's source tooltip and provenance) | "IKEA publishes no piece dimensions …", "Lillabo track bought in 2025" | the same facts, unnamed ("the maker publishes no piece dimensions", "copied from bought small-peg track") |
| Join reasons (`brandFit` in `thirdParty.ts`) | "The IKEA plug is shorter … IKEA reviews report …" | "The small-peg plug is shorter and the Generic nest longer; owners report the pegs and holes are smaller and do not fit Generic." |
| Build list readout (`BuildMode.tsx`) | reads the internal id aloud ("…, IKEA-C45.") | reads the card code (`shortCode`, "C45") |
| Found while building: trust notes (`trust.ts`) | "GENERIC and IKEA track do not physically join", "IKEA-C45 … has a size nobody has measured" | "Generic and Small-peg track do not physically join", "C45 has a size …" |
| Found while building: raw ids elsewhere | build list table and code, friend screen's part table, inventory rows, both shortfall lines print `IKEA-150` | each prints the code (`codeOf`, "150") |

Part origin (MakerWorld link and creator, `origins.ts`) is allowed and stays.
Code comments may keep the makers' names: they are not shown.

## NOT in scope

- Building the version list now (D8: waits for a third version of one piece).
- Merging makers into one entry with maker versions (D1: they don't join).
- Renaming internal ids or the `Brand` enum: saved layouts and links depend on them.
- A floating pop-up menu component (D6 chose the in-place fold).
- Mockups: no image key; not requested.

## What already exists

- The strip's swap buttons and `selectedSwaps` (`App.tsx`), `swapsOf` and
  `joinsAlike` (`layoutModel.ts`), the `swapPiece` refusal through `newlyHit`.
- Swap announcements and "Undo swap" (`announce.ts`, `UndoControl.tsx`).
- The disclosure pattern: the verdict's "N notes" fold (`VerdictLine.tsx`,
  `aria-expanded`).
- Brand shelves as `<details>` with a one-line summary and the join warning
  inside (`App.tsx` `BrandGroup`), and `brandFit`.
- DESIGN.md rules 1, 2, 3, 5, 7 and 10.

## Implementation Tasks

- [x] **T1 (P1, human: ~3h / CC: ~25min)**: trait names: no brand named in what the app shows
  - Surfaced by: D1, D2 (owner: "without naming a brand name that we might infringe")
  - Files: `app/src/App.tsx`, `app/src/SubmitPart.tsx`, `app/src/BuildMode.tsx`, `engine/data/thirdParty.ts`, and the tests that pin the old names
  - Verify: a test that scans every user-visible string of the built-in library (names, dimension source and note, `brandFit` reasons) and both label tables for the brand words and fails on any; the full suite
- [x] **T2 (P2, human: ~30min / CC: ~5min)**: the version-list tripwire
  - Surfaced by: D8, D9
  - Files: a test next to `swapDifferential.test.ts`; `docs/plan/generic-TODOS.md` (P3 entry points here)
  - Verify: the test fails with a message naming this document when a fixture piece is given three swaps; passes on today's library

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (13 rules); UI: strip,     |
  |                      | palette shelves, part form, build list       |
  | Step 0               | 2/10; naming first, then all 7 passes        |
  | Pass 1  (Info Arch)  | 3/10 → 8/10 after fixes (D3, D4)             |
  | Pass 2  (States)     | 4/10 → 8/10 after fixes (D5)                 |
  | Pass 3  (Journey)    | 7/10 → 8/10 after fixes (D7)                 |
  | Pass 4  (AI Slop)    | 7/10 → 9/10 after fixes (D6)                 |
  | Pass 5  (Design Sys) | 5/10 → 9/10 after fixes (D6)                 |
  | Pass 6  (Responsive) | 4/10 → 9/10 after fixes (D7)                 |
  | Pass 7  (Decisions)  | 2 resolved (D8, D9), 0 deferred              |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                            |
  | What already exists  | written                                      |
  | TODOS.md updates     | 1 item (P3 entry updated, D9)                |
  | Approved Mockups     | 0 generated (no image key), 0 approved       |
  | Decisions made       | 9 added to plan                              |
  | Decisions deferred   | 0                                            |
  | Overall design score | 3/10 → 8/10                                  |
  +====================================================================+
```

Plan is design-complete. Run /design-review after implementation for visual QA.

Unresolved decisions: none.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | — | Independent 2nd opinion | 0 | skipped (owner declined outside voices) | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 3/10 → 8/10, 9 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** design phase, outside voices skipped by the owner; no outside review ran.
- **VERDICT:** DESIGN CLEARED; eng review required.

NO UNRESOLVED DECISIONS
