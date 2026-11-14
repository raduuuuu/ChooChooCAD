<!-- /autoplan restore point: "/Users/radudiaconescu/Developer/ChooChooCAD/.gstack/tmp/autoplan/additions-eng-review-autoplan-restore-20261114-102548.md" -->
## Implementation plan
# Plan: building the four approved additions (E2, E3, E5, E4)

Status: approved by the owner, 2026-11-14, after engineering review (record at the end).
Scope was decided by the owner in `docs/plan/2026-11-14-product-state-review.md`
(ledger rows E2 at D2, E3 at D3 and D7, E4 at D4, E5 at D5 and D8). E1 is
built (PR #266). This plan adds no scope; where it narrows or interprets a
row, it says so under "Choices this plan makes" and those go to the owner.

Standing rules that bind every part: no brand names (AGENTS.md); every pin
records its mutation and the mutation is run (CLAUDE.md); never a pass the
check did not give; say when an answer rests on an unmeasured size; one pull
request per addition, none stacked.

## What the code already has (verified 2026-11-14)

| Need | Exists | Where |
|---|---|---|
| A one-piece exact repair for a failing loop | `pieceRepair` | `engine/src/graph/repair.ts:102` |
| Exact pose of every free end | `connectorSites` → `PlacedPort` | `engine/src/graph/feasible.ts:157` |
| Exact walk of a piece from a port | `frameForPortAt`, `roadEnd`, `portsOf` | `engine/src/graph/model.ts:361,288,191` |
| Would a new end join, clash or stand clear | `landingOf` | `engine/src/graph/feasible.ts:212` |
| Refuse a join (pegs, levels) | `joinRefusal` | `app/src/layoutModel.ts:683` |
| Many pieces as one undo step | the `preset` action | `app/src/editorReducer.ts:868` |
| Box counts and shortfalls | `shortfalls`, `usedCounts` | `app/src/inventoryModel.ts:100,88` |
| Work budgets that refuse | `BEND_BUDGET`, `CYCLE_WORK_BUDGET` | `engine/src/graph/bendRun.ts:296`, `cycles.ts:364` |
| Roads inside a switch or crossing | `roadsOf`, `Port.along` | `engine/src/graph/model.ts:261,131` |
| Train-fit judgement | `TrainFit`, `underBridges` | `app/src/VerdictLine.tsx:347`, `solve.ts:265` |
| Touch editing on tablets | pick, tap an end, Place; 44px targets | `app/src/TrackCanvas.tsx:622-634`, `usePaletteDrag` |
| Phone gate | `screenMode`, `NARROW_QUERY` | `app/src/screenMode.ts:47`, `useMatchMedia.ts:9` |

Does not exist: any walk of a train along track across pieces (`VEHICLE` in
`engine/data/generic.ts:243` is unused); any animation loop
(`app/src/Viewer3D.tsx:7-11` draws only on change); user pan or zoom of the
canvas (`TrackCanvas.tsx:428-446` auto-fits).

## Architecture

```
  engine/src/graph/                         app/src/
  ┌───────────────────────────────┐         ┌────────────────────────────────────────────┐
  │ repair.ts   pieceRepair       │         │ presets.ts ──▶ readyLayouts (E2, more data) │
  │   └─ NEW fill.ts  gapFill ────┼──fills─▶│ canBuild.ts NEW (E2)  shortfalls per layout │
  │        (frames, landingOf,    │         │ FinishLoop.tsx NEW (E3) lists fills         │
  │         one FILL_BUDGET)      │         │ editorReducer  NEW action 'fill' (E3)       │
  │ NEW route.ts  walkRoute  ─────┼──route─▶│ playback.ts NEW (E5) time → pose            │
  │   (roadsOf, welds, levels)    │         │ TrainMark (2D) / train mesh (3D) (E5)       │
  │ solve.ts  (unchanged entry) ◀─┼─recheck─│ Palette.tsx NEW, cut from App.tsx (E4)      │
  └───────────────────────────────┘         │ PhoneEditor shell (E4) on the SAME reducer  │
                                            └────────────────────────────────────────────┘
  Saved layout (StoredGraph: pieces, welds, anchors) is NOT changed by any of the four.
```

## E2. More ready layouts, and "your box can build"

1. **Data.** `Preset` gains an optional `turns` list (`'left' | 'right'` per
   piece) so a ready layout can bend both ways; absent means all left, as
   today. The `preset` action carries the turns too: today it takes ids only
   and hard-codes `'left'` (`editorReducer.ts:308,871`; `App.tsx:1000` passes
   ids only), so the action, the reducer case and the caller all change. A
   `turns` list of the wrong length is a thrown error at module load, caught
   by the test, never a silent all-left layout. About five layouts are added,
   built only from pieces whose sizes are `published` and whose centreline is
   published too: the large curve and the plain straights. The small curve is
   left out, because its centreline is inferred from an unpublished outer
   radius (`generic-TODOS.md:794`). Each layout is found by trying it in the
   solver, not by arithmetic on paper.
2. **The pin moves to the path the app takes.** `presets.test.ts` checks
   presets through the retired chain engine (`solveLayout(presetLayout(...))`).
   It is rewritten to build each preset through `reduce(... {kind:'preset'})`
   and classify with `viewOf(solveGraph(...))`, the route `layoutPages.ts`
   already uses (`presetGraph`, `closesExactly`; these move to a shared
   module both import). `presetLayout` is deleted. `layoutFile.test.ts:30`
   calls `PRESETS[0]` "stadium" though it is Circle; it looks the preset up by
   label instead.
3. **Every ready layout declares what it is.** `Preset.note` stays, and a new
   field `expect: 'exact' | 'miss'` is checked against the verdict for every
   preset, so "Near miss" is pinned as a miss and the rest as exact. The test
   also pins each placed piece's turn against the preset's list: a layout
   placed wrong can still close, so closure alone does not prove the turns
   were honoured.
4. **Your box can build.** `canBuild(inventory, preset)` in a new
   `app/src/canBuild.ts` returns `shortfalls(inventory, usedCounts(pieces))`.
   The preset row shows, per layout: nothing extra when the box is unset
   (`inventory === null`); "Your box has every piece" when the list is empty;
   "Short of N pieces" with the piece names otherwise. Layouts the box covers
   sort first. No new storage.
5. **E1's pages follow for free:** each added layout that closes gets a page
   on the next build.

Files: `app/src/presets.ts`, `presets.test.ts`, `canBuild.ts` (+ test),
`editorReducer.ts` (the `preset` action and case), `App.tsx` (the caller at
:1000 and the preset row, about :2248), `layoutPages.ts` (import the shared
helpers), `layoutFile.test.ts`. No engine change.

## E3. Finish the loop

**One mechanism, two entries.** A fill is a short sequence of pieces that
starts on one free end and lands exactly on another.

- *Entry 1, two picked ends.* The user arms one free end and clicks another.
  Today `clickPort` joins them or `joinRefusal` says why not. New: when they
  are both free, on one level, and do not already meet, the join strip offers
  "Find pieces to join these ends".
- *Entry 2, a welded loop that misses.* When the verdict has exactly one
  failing loop with one closing weld (the case `pieceRepair` already
  isolates, `repair.ts:114-120`), the verdict line offers "Find pieces that
  close this loop". It runs the same search between that weld's two ports,
  with the weld treated as broken. This answers the open question of how a
  loop with no open ends enters the gap-fill.

**The search, `engine/src/graph/fill.ts`.**

```
  gapFill(graph, ports, placement, from: PortRef, to: PortRef, library, box, budget)
    start  = outward frame at `from`            (exact: pos in Z[zeta16], heading, level)
    target = opposed(outward frame at `to`)     (what the last piece's far end must equal)
    depth-first over sequences of candidate pieces, shortest first (iterative deepening, 1..MAX_FILL_PIECES)
      candidate = flat two-ended piece (straight or curve, each turn, either end first, equal-ended pieces included),
                  polarity checked at EACH new joint (so two pegs can be bridged by a two-socket piece, `generic.ts:144`),
                  system fit 'joins' with both neighbours, box count not exceeded (when a box is set)
      each step:  next = roadEnd(...)  — exact, no floating point
      prune:      a bound on how far the remaining pieces can still reach (longest candidate × pieces left)
      accept:     next.pos equals target.pos exactly AND heading matches AND polarity seats
    accepted sequences are STREAMED, shortest first, to the re-check below; the search stops at three kept fills
    two budgets: FILL_BUDGET (candidate steps) and MAX_FILL_CHECKS (full re-checks); past either → { status: 'out of work' }
```

- `MAX_FILL_PIECES = 4`. The cost that matters is the re-check, not the
  search: one full solve can take 440 to 470ms on a large layout
  (`bendRun.ts:290`). So the bound is a count of solves, `MAX_FILL_CHECKS = 6`,
  and the click shows "Searching" before the work starts (the work runs after
  one paint, in a timeout, not inside the click). Before a full solve each
  candidate passes the cheap exact tests (its ends land by `landingOf`, its
  planks overlap nothing), so most rejects cost no solve. The whole entry
  point is timed on a small layout, the owner's 79-piece layout and a case
  built to hit both budgets (`generic-TODOS.md:671`).
- **One transaction, used for the preview and for applying.**
  `applyFill(graph, fill)` in `layoutModel.ts`: remove the closing weld when
  the fill came from entry 2 (`addPiece` will not attach to an occupied port,
  `layoutModel.ts:156`); add each piece on the exact port and turn the search
  chose (no automatic orientation); weld the last piece to the far end. The
  re-check runs on `applyFill`'s result, and the `fill` action applies the
  same function, so what was checked is what is placed.
- **Re-check before showing.** The result goes through the same `solveGraph`
  call the verdict uses. A fill is kept only when all of these hold:
  1. every weld the fill made has a zero residual (position, heading, level);
  2. the solver reports no clash that involves a fill piece;
  3. no loop that worked before is worse after (compared loop by loop from
     the result's `cycles`, not from the one whole-layout verdict: `viewOf`
     gives one kind for the layout, so a fill beside another loop that needs
     give would otherwise vanish);
  4. `layoutTrust` reports no systems that do not join among the fill and its
     two neighbours;
  5. the box covers the WHOLE resulting layout (existing pieces plus the
     fill) and the adapters it needs (`adapterShortfall`,
     `inventoryModel.ts:45`), when a box is set.
  Joining two separate runs makes no loop (`NO_CYCLE`, `solve.ts:273`); that
  is a valid fill and is kept on rules 1, 2, 4 and 5.
  At most three fills are shown, fewest pieces first.
- **`pieceRepair` stays** as the cheap one-straight sentence; `gapFill` is
  asked for only on the user's click, never on every edit.
- **Applying a fill** is one new reducer action, `{kind:'fill', pieces, from,
  to}`, modelled on `preset`: `addPiece` per piece, `weldEnds` at the far
  end, one `remember(state, 'fill')`, so one undo removes the pieces and
  restores the closing weld. Applied against what it was computed for: the
  offer records the graph object, the box and the resolved library it
  searched, and it is thrown away when any of the three changes (the box
  changes without a graph edit, `App.tsx:510`). The reducer drops a `fill`
  whose graph is no longer `state.graph`.
- **Refusals, each a plain sentence, never "impossible":** ends on two
  levels ("These ends are on different levels; a ramp is needed, and this
  does not search ramps yet"); nothing found within four pieces;
  out of work; box empty or unset is not a refusal: with no box the search
  uses the whole library and says so.
- No worker. The work runs in one timeout after the "Searching" paint, so
  an edit can land between the click and the result; the identity check
  above is what discards a stale result, and both orders are tested.
- `fill.ts`, `FinishLoop.tsx` and `route.ts` (E5) load on first use. The main
  chunk is at 153.95 kB against a 154.20 kB budget (`scripts/chunkBudget.ts`,
  measured 2026-11-14), so nothing here may land in it: see choice C7.

Files: `engine/src/graph/fill.ts` (+ test), `app/src/layoutModel.ts`
(`applyFill`), `app/src/editorReducer.ts` (action, `Step.kind`), `app/src/FinishLoop.tsx` (+ dom test), `App.tsx` and
`VerdictLine.tsx` (the two offers), `app/src/linkFragment.ts` only if the
owner approves a new action name.

## E5. Route walker, then playback

**Part 1, `engine/src/graph/route.ts` (no UI).**

```
  walkRoute(graph, ports, placement, resolve, start: PortRef) → Route
    Route = { legs: Leg[], end: 'loop' | 'open end' | 'buffer' | 'blocked', blockedAt?: {pieceId, why} }
    Leg   = { pieceId, from: port, to: port, shape, level0, level1, lengthMm }
    step: enter a piece at a port → take a road (roadsOf) → leave at its other port → cross the weld to the next piece
    stop: a directed state (piece, port in) seen before; a free end; a buffer; or a place the train may not pass
    Route also splits its legs into `lead` (run once) and `loop` (repeats): entering a loop through a switch's tail
    never returns to the start, so "back at the start" alone would not terminate (`switchSeeds.ts:128`).
    Hard cap: legs ≤ 2 × the number of roads in the layout.
```

- **A weld is not proof a train can cross.** Welds may join ends that do not
  meet (`layoutModel.ts:657`); the residuals record it (`frames.ts:280`). So
  "Run a train" is offered only when the verdict for the layout is one of
  the two that work (closes exactly, or closes with the joints' give). For
  anything else the button is off and says why ("The track does not join up
  yet"). Within a working layout the walker still refuses a weld whose level
  residual is not zero.
- **The path is the drawn path.** Legs are built from the rendered segments
  (`renderGraph`), which are bend-adjusted and carry a hump's height profile
  (`render.ts:244`), not from catalogue shapes. `Segment` gains the road it
  belongs to (`road: {from, to}` and its order along the road) so a leg can
  collect its segments in travel order, either direction. Height along a leg
  comes from `level`, `rise`, `highAtStart` and `profileMm`.

- **At a switch** the train takes the road the plan calls the *through road*:
  the first road in `roadsOf` order leaving the port it entered. One fixed
  rule, stated in the UI ("The train keeps to the main road at switches"),
  so the run is the same every time. Choosing roads is out of scope.
- **Where the train may not pass.** Today the judgement is in three places:
  bridges and structures (`underBridges`, `solve.ts:264`), tunnels by their
  lowest vault (`verdictView.ts:270`), and plain raised track by
  `CLEARANCE.riseMm` (`VerdictLine.tsx:458`). All three move behind one
  engine function, `openings(result, render)`, which returns for every
  opening: the piece and road under it, where along that road, the opening's
  height, whether that height is an estimate, and the margin for the train.
  The verdict line and the route both read it, so they cannot disagree, and
  the train stops at the opening on the road it is on, not at an unrelated
  road of the same piece.
- **Start:** the selected piece if there is one, else the first piece of the
  largest closed run, else the first piece.

**Part 2, playback (UI).** `app/src/playback.ts` turns a `Route` and an
elapsed time into a pose (piece, distance along its road, height), at a
fixed timestep and a fixed speed in millimetres per second, so positions are
the same on every machine and testable without a clock.

- **2D:** one `<g>` for the train in `TrackCanvas`, moved by setting its
  `transform` from a `requestAnimationFrame` loop that touches only that
  element. React does not re-render per frame.
- **3D:** one train mesh added beside `group` (so `syncScene` does not wipe
  it), moved the same way; the loop calls the viewer's existing `render()`.
  The loop exists only while a run is playing.
- **Controls:** one "Run a train" button by the verdict; it becomes "Stop".
  The run stops on any edit (the reducer's graph object changes), when the
  tab is hidden, and at the route's end unless it is a loop.
- **What it says:** the line under the button names the train ("the 55mm
  train this app measures with") and, where the route was blocked, says so in
  the verdict's own words. When an opening on the route is an estimate the
  existing "The opening is an estimate." sentence is shown with the run.
- **`prefers-reduced-motion`:** no movement. The button shows the route's
  result as a sentence instead ("A train gets all the way round", or where it
  stops).

**This contradicts DESIGN.md rule 8** ("There is one deliberate moment of
movement ... Nothing else animates") and the viewer's own header. The owner
approved playback at D5 and D8, so the rule has to change, and that change is
the owner's: see choice C3.

Files: `engine/src/graph/route.ts` (+ test), an engine home for the train-fit
arithmetic, `app/src/playback.ts` (+ test), `TrackCanvas.tsx`, `Viewer3D.tsx`,
`VerdictLine.tsx`, `app.css`, `DESIGN.md` (rule 8 and a rule 11 channel for
the train mark).

## E4. Editing on a phone

**What is actually missing.** Touch editing already works on tablets: pick a
card, tap a free end, Place; drags of the picked card and the selected piece;
44px targets under `(pointer: coarse)`. On a phone the editor is never
rendered: `App.tsx:1840-1841` returns `FriendScreen` whenever the screen is
narrow. So E4 is a layout for a narrow screen plus removing that gate, not a
second editing model.

1. **`Palette.tsx` is cut out of `App.tsx` first** (`renderCard` :1578, the
   shelves :1740-1780, the palette section :2181-2290), with no behaviour
   change, as its own pull request. The phone shell needs to put the palette
   somewhere else on screen, and it cannot while the palette is inline JSX in
   a 2,360-line component. This is the part of the backlog's "Finish
   splitting App.tsx" that E4 needs; the rest of that split stays P3.
2. **The phone shell.** Canvas on top, the verdict line under it, and the
   palette as a sheet that opens from a "Pieces" button and closes when a
   card is picked. The existing strips (placing, join, selection) carry
   Place, turn and cancel. Panels (your box, table, add a part) open full
   screen.
3. **The gate.** `screenMode` gives `canEdit: true` when narrow for your own
   layout and for the example; a shared link stays read-only everywhere. The
   `dispatch` guard (`App.tsx:757`) and the CSS fallback
   (`app.css:1257-1276`) follow. `PHONE_DESIGN_ELSEWHERE` and
   `PHONE_CANNOT_EDIT` are retired where they no longer apply.
4. **Small targets on a small screen.** The canvas auto-fits, so on a 390px
   screen a large layout draws its ends a few pixels wide. End hit areas
   already have a pixel floor (`trackPath.ts:628`); the visible rings do not
   (`generic-TODOS.md:861`). E4 gives the port marks the same pixel floor.
   It adds no pan or zoom: see choice C5.
5. **Design review first** (approved scope): `/plan-design-review` on the
   phone shell before any of steps 2 to 4 are built.

Files: `app/src/Palette.tsx` (new, cut from `App.tsx`), `App.tsx`,
`screenMode.ts` (+ its tests), `app.css`, `linkWords.ts`, `FriendScreen.tsx`,
`OpenInEditor.tsx`, `TrackCanvas.tsx` (ring floor), `DESIGN.md`.

## Saved-file format

None of the four changes it. A fill is ordinary pieces and welds. A ready
layout becomes ordinary pieces. Playback keeps nothing. The phone editor
writes the same `generic.graph.v1` blob. `Preset.turns` and `Preset.expect`
are source data, never stored. No link or file version bump.

## Choices this plan makes (for the owner at the gate)

| # | Choice | Why | The alternative |
|---|---|---|---|
| C1 | E3 searches fills of at most four flat two-ended pieces on one level; ends on two levels get a sentence, not a search | keeps the search small enough to bound and re-check; ramps bring level rules into the search | include ramps: several times the search and the tests |
| C2 | E3 with no box set searches the whole library and says so | the approved scope says "from the box"; an unset box would otherwise make the feature do nothing for a new visitor | refuse until a box is filled in |
| C3 | DESIGN.md rule 8 gains a second authored motion: a train run the user starts, off under reduced motion, never automatic | the owner approved playback twice; the rule forbids it as written | keep rule 8 and ship E5 as a still result sentence only |
| C4 | E5's train keeps to the main road at switches | one fixed, explainable rule; same run every time | let the user set each switch: a new state to store and design |
| C5 | E4 adds no pan or zoom on phones; the layout always fits the screen | no second gesture to fight drags; large layouts get small but targets keep a floor | pinch zoom: a gesture model, a new state and a design review of its own |
| C6 | E4 starts with cutting the palette out of `App.tsx`, as a separate pull request | the phone shell cannot move inline JSX | build the shell inside `App.tsx` and split later |
| C7 | E3 and E5 code loads on first use; E2's layout data and E4's shell will still grow the main chunk past its 154.20 kB budget, so the budget is re-measured once with E2 and once with E4 | 0.25 kB of headroom today; the budget has been re-measured five times before, each the owner's call | hold the budget and drop ready layouts or move presets behind a lazy load |
| C8 | "Run a train" is offered only when the layout's verdict is one that works | a weld can join ends that do not meet, so a run on a broken loop would say a train gets round | walk whatever is welded and mark doubtful joints on the way |

## Order and size

| Step | Pull request | Human | CC |
|---|---|---|---|
| 1 | E2 ready layouts, the pin on the app's path, box-can-build | ~3 days | ~1.5 h |
| 2 | E3 `fill.ts`, `applyFill` and their tests | ~1 week | ~4 h |
| 3 | E3 the two offers, the `fill` action, the list | ~3 days | ~3 h |
| 4 | E5 `openings` in the engine, the verdict line reading it, no behaviour change | ~1 week | ~4 h |
| 5 | E5 `route.ts` on rendered segments (road identity on `Segment`) | ~1 week | ~5 h |
| 6 | E5 playback in 2D, then 3D; rule 8 amended | ~1 week | ~4 h |
| 7 | E4 `Palette.tsx` cut out, no behaviour change | ~2 days | ~1 h |
| 8 | E4 design review, then the phone shell and the gate | ~2 weeks | ~1 day |

## Tests this plan commits to

- E2: every preset's `expect` matches the verdict through the reducer path;
  `canBuild` for an unset box, a covering box and a box short by one; the
  preset row's three sentences (dom).
- E3: for layouts in the 670-layout corpus that close exactly, remove one to
  four consecutive flat pieces and assert `gapFill` returns a fill of at most
  that many pieces which the verdict accepts; two pegs are joined by one
  two-socket piece; a fill beside a loop that needs give is still offered; a
  fill joining two separate runs is offered; the whole layout plus the fill
  never exceeds a box count or the adapter count; a fill never mixes systems
  that do not join; ends on two levels return their refusal; many geometric
  matches that fail the re-check stop at `MAX_FILL_CHECKS` with
  `out of work`, and the whole entry point is timed on three sizes;
  `applyFill` on a welded loop gives the graph the search checked, and undo
  restores the original weld; an offer is dropped when the graph, the box or
  the library changed, in both orders of edit and result (dom).
- E5: `openings` returns what the verdict line prints today for every layout
  in the corpus (a differential, before any route code); `walkRoute` on a
  circle (loop), an open run (open end), a buffer, a switch (main road), a
  loop entered through a switch's tail (terminates, lead and loop split), a
  ramp (levels), a hump in both directions (height profile), a bend-dependent
  loop (the path follows the drawn track), and under a bridge with a negative
  margin (blocked there, on that road); the button is off on a layout that
  does not work; playback positions at fixed times; stop on edit;
  the reduced-motion path renders no moving element (dom); the train-fit
  figure the route uses equals the one the verdict prints.
- E4: `screenMode` truth table with narrow editing on; the dispatch guard
  allows edits when narrow and still refuses on a shared link; the palette
  sheet opens, picks and closes (dom); `Palette.tsx` extraction leaves the
  existing palette tests green unchanged; a real-phone pass by a person.

## NOT in scope

The full nudge-to-fit search; ramps in a fill; user-set switches; several
trains; pan and zoom; the rest of the `App.tsx` split; new counter action
names (the owner's, T11); kid mode; any change to the saved format.
## Review record

Engineering review, 2026-11-14 (`/autoplan`, eng phase only). The CEO review
of the scope was done the same day in
`docs/plan/2026-11-14-product-state-review.md` and was not repeated. No design
or developer-experience review was run; E4 still needs `/plan-design-review`.

### Who reviewed

| Voice | Result |
|---|---|
| Primary (this review) | sections below |
| Codex (gpt-6-astra), outside | completed: 10 findings, 9 High and 1 Medium; verdict FINDINGS |
| Claude subagent, native | not run: the pipeline's phase-order guard refuses a later-phase reviewer when its CEO phase was skipped |

### Scope challenge

| premise | claim | receipt | verdict |
|---|---|---|---|
| S1 | A one-piece exact repair exists and isolates one failing loop with one closing weld | `engine/src/graph/repair.ts:102,114-120` | verified |
| S2 | Free ends have exact poses, and a landing test exists | `engine/src/graph/feasible.ts:157,212` | verified |
| S3 | The `preset` action places many pieces as one undo step, with turns hard-coded left | `app/src/editorReducer.ts:868-871` | verified |
| S4 | Box shortfalls and adapter shortfalls are separate functions | `app/src/inventoryModel.ts:100,45` | verified |
| S5 | A full solve can take 440 to 470ms | `engine/src/graph/bendRun.ts:290` | verified |
| S6 | No route walker exists and `VEHICLE` is unused | `engine/data/generic.ts:243`; grep of `engine/src` | verified |
| S7 | The 3D view has no animation loop and rule 8 forbids one | `app/src/Viewer3D.tsx:7-11`; `DESIGN.md:132-141` | verified |
| S8 | Train-fit is judged in three places | `engine/src/graph/solve.ts:264`; `app/src/verdictView.ts:270`; `app/src/VerdictLine.tsx:458` | verified from the research report, one of three opened |
| S9 | Touch editing works on tablets; phones never render the editor | `app/src/TrackCanvas.tsx:622-634`; `app/src/App.tsx:1840-1841` | verified from the research report |
| S10 | The saved layout holds pieces, welds and anchors only | `app/src/layoutStore.ts:82-87` | verified from the research report |
| S11 | The main chunk has 0.25 kB of headroom | [measured: `bun scripts/chunkBudget.ts`, 2026-11-14, on the E1 branch: 153.95 of 154.20 kB] | verified; re-measure on `main` before each PR |
| S12 | A two-socket straight exists, so two pegs can be bridged | `engine/data/generic.ts:144` | verified |

unverified=0; three rows rest on a research agent's read, not this review's own.

REALITY: premise-table pass 12 claims, each with a receipt; three read by a research agent docs/plan/2026-11-14-additions-eng.md:16
REALITY: already-done finding touch editing already exists for tablets, so E4 is a narrow layout and a gate, not a second editor app/src/TrackCanvas.tsx:622
REALITY: surface-check pass every command named exists (`bun scripts/chunkBudget.ts`, `bun run test`, `/plan-design-review`) package.json:6
REALITY: binding-decisions finding DESIGN.md rule 8 forbids the playback the owner approved at D5 and D8; raised as choice C3, the owner's to settle DESIGN.md:132
REALITY: numbers pass the chunk figure is measured today and marked for re-measure; the solve time is quoted from the code's own record engine/src/graph/bendRun.ts:290
REALITY: deferred-asks pass no linked issue docs/plan/2026-11-14-additions-eng.md:5
REALITY: pr-count finding eight pull requests, one per step, none stacked, by AGENTS.md's rule; each waits for the one before it to merge AGENTS.md:105

Complexity check: E3 and E5 each add two modules and touch the reducer or
the renderer; E4 touches the largest file in the app. That is why E4 opens
with an extraction that changes no behaviour, and why E5 opens with a move
(`openings`) proved by a differential before any new behaviour.

### Codex findings and what was done

| # | Finding | Disposition |
|---|---|---|
| 1 | The `fill` action did not reproduce the graph that was searched (entry 2 removes a weld; `addPiece` re-orients) | applied: one `applyFill` transaction for preview and apply |
| 2 | Peg to peg is not a refusal for a multi-piece fill; equal-ended pieces were filtered out | applied: polarity per joint, equal-ended candidates in |
| 3 | `viewOf` gives one whole-layout verdict, so "exact for this loop" could not be expressed; joining two runs gives `NO_CYCLE` | applied: five explicit keep rules, compared loop by loop |
| 4 | Adapters were not counted; the box can change with no graph edit | applied: whole-layout box and adapter check; offers dropped on box or library change |
| 5 | The budget counted search steps, not the solves that cost the time | applied: `MAX_FILL_CHECKS`, cheap tests first, "Searching" paint, three timed sizes |
| 6 | The walker could fail to stop after entering a loop through a switch | applied: visited directed states, lead and loop split, hard cap |
| 7 | A weld does not prove a train can cross | applied: the run is offered only on a working verdict (choice C8) |
| 8 | Sharing the subtraction is not sharing the judgement; three opening sources | applied: one engine `openings` function with road and position |
| 9 | Catalogue shapes are not the drawn track (bends, hump profile) | applied: legs built from rendered segments; road identity on `Segment` |
| 10 | `Preset.turns` was not plumbed through the action and caller | applied: action, reducer case and caller change; turns pinned in the test |

Three of the ten were opened in the code by this review (2, 5, 10) and hold.
The rest were applied on their cited evidence without being opened.

### Consensus

```
ENG DUAL VOICES — CONSENSUS TABLE:
  Dimension                           Claude  Codex     Consensus
  1. Architecture sound?               n/a     no (6)    N/A
  2. Test coverage sufficient?         n/a     no (10)   N/A
  3. Perf risks + budget/bench named?  n/a     no (1)    N/A
  4. Security threats covered?         n/a     no issue  N/A
  5. Error paths handled?              n/a     no (3)    N/A
  6. Deployment risk manageable?       n/a     no issue  N/A
The native voice did not run, so nothing is CONFIRMED. Codex's findings were all applied.
```

### 1. Architecture

The diagram is in the plan. Findings beyond Codex's:

- **A1 (applied as C7).** The main chunk is 0.25 kB under its budget. Every
  addition would have failed CI on its first build. E3 and E5 load on first
  use; E2 and E4 need the budget re-measured, which has always been the
  owner's call.
- **A2.** E5 puts a second consumer on the train-fit judgement. Moving the
  judgement first, with a differential against today's verdict text over the
  670-layout corpus, makes step 4 provable with no behaviour change.
- **A3.** E4's gate is in three places (`screenMode`, the `dispatch` guard,
  a CSS fallback). All three must change in one pull request or a phone gets
  an editor whose edits are refused.
- Coupling added: `VerdictLine` → `openings` (engine), `TrackCanvas` and
  `Viewer3D` → `playback`. None reaches back into the solver.
- Security: no new input from outside the device; no new storage key; no new
  dependency. A fill and a route are derived from the layout in memory.
- Rollback for every step: revert its pull request; Pages redeploys.

### 2. Code quality

- `presetGraph` and `closesExactly` exist in `layoutPages.ts` (PR #266) and
  E2's test needs the same two functions: they move to one shared module
  rather than being written twice.
- `pieceRepair` stays separate from `gapFill`: it runs on every edit and must
  stay linear; `gapFill` runs on a click. One shared candidate filter was in
  the first draft and was removed (finding 2): the two need different filters.
- `App.tsx` gains the two offers (E3), the run button (E5) and the box
  sentences (E2) before E4's extraction. Each is a few lines calling a new
  component; none adds a responsibility to the file.
- `DESIGN.md` changes in two pull requests (rule 8 for E5, rule 11 for the
  train mark and the fill preview). Both are copy the owner signs off.

### 3. Tests

```
  NEW CODEPATH                         TEST                         EXISTS?  COVERS
  preset action with turns             node, reducer                no       turns honoured; wrong-length list throws
  every preset vs its `expect`         node, graph solver           no       replaces the chain-engine pin
  canBuild                             node                         no       unset, covering, short by one
  preset row sentences                 dom                          no       three states
  gapFill search                       node, property over corpus   no       remove 1..4 pieces, fill found
  gapFill polarity per joint           node                         no       two pegs, one two-socket piece
  fill keep rules 1..5                 node                         no       each rule has a case that only it rejects
  MAX_FILL_CHECKS / FILL_BUDGET        node                         no       both refusals; entry point timed, three sizes
  applyFill (both entries)             node                         no       graph equals the searched graph; undo restores the weld
  offer invalidation                   dom                          no       graph, box, library; both orders
  openings                             node, differential           no       verdict text unchanged over 670 layouts
  walkRoute                            node                         no       loop, open end, buffer, switch, tail entry, ramp, hump both ways, bend loop, blocked
  playback positions                   node, fixed timestep         no       same positions every run
  run button states                    dom                          no       off when the layout does not work; stop on edit; reduced motion
  Segment.road                         node                         no       every segment of a multi-road piece names its road
  screenMode with narrow editing       node                         partly   `screenMode.test.ts` exists; truth table changes
  dispatch guard on a phone            dom                          partly   `firstVisit.dom.test.tsx` covers the old rule
  palette sheet                        dom                          no       open, pick, close
  Palette.tsx extraction               existing palette tests       yes      unchanged and green
  phone, by hand                       a person, a real phone       no       cannot be automated
```

Gaps that stay open: the real-phone pass and a person judging the run beside
real track. Both are human. Every other row is committed in "Tests this plan
commits to". Each pin records its mutation and the mutation is run. The test
plan is saved at
`~/.gstack/projects/raduuuuu-ChooChooCAD/radudiaconescu-additions-eng-review-eng-review-test-plan-20261114-103040.md`.

### 4. Performance

- E3: the search is cheap (about twenty candidates, four deep, pruned); the
  solves are not. Bound: six solves per click, behind a "Searching" paint.
  Worst case on the owner's largest layout is about three seconds, stated in
  the UI as searching, never a frozen click. Bench step: the three timed sizes.
- E5: one element moves per frame; the walker is linear in roads with a hard
  cap. Bench step: frame time with the 3D view open on a large layout.
- E4: the 10,000-piece canvas ceiling was measured on a laptop
  (`generic-TODOS.md:693`). No phone figure exists. Bench step: draw time on
  a mid-range phone before the gate opens, and a lower ceiling for narrow
  screens if it is needed.
- E2: none; eight presets solved in tests, not at runtime.

### Failure modes

| Codepath | Failure | Rescued | Test | User sees |
|---|---|---|---|---|
| gapFill | out of work | yes | yes | "Could not find a fill" with the reason |
| gapFill | a fill passes geometry and fails a keep rule | yes | yes | nothing wrong is shown |
| fill action | layout, box or library changed since the search | yes | yes | the offer disappears |
| applyFill | closing weld already gone | yes (returns the graph unchanged) | yes | nothing; the offer was stale |
| walkRoute | loop entered through a switch | yes | yes | the train runs the lead once, then the loop |
| walkRoute | layout does not work | yes | yes | button off, with the reason |
| openings | an opening's height is an estimate | yes | yes | the existing estimate sentence |
| playback | tab hidden, edit, reduced motion | yes | yes | stops; a sentence under reduced motion |
| phone editor | large layout, tiny ends | partly | yes for the floor | small track; targets keep their size |
| phone editor | slow draw on a phone | not yet | bench step | unknown until measured |
| preset | wrong-length turns | yes | yes | never ships: the test fails |

Critical gaps: 0. One row is unknown until measured (phone draw time).

### What already exists, and NOT in scope

Both are in the plan ("What the code already has", "NOT in scope").

### Decision audit trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | eng | Apply Codex findings 1 to 10 | mechanical | completeness | each names a wrong result the first draft could produce | leaving any as a note |
| 2 | eng | Bound E3 by solves, not search steps | mechanical | explicit | the solve is the cost | a 100ms promise that one solve already breaks |
| 3 | eng | Move train-fit behind one engine function before the route | mechanical | DRY | two consumers of one judgement | a second copy in `route.ts` |
| 4 | eng | Lazy-load E3 and E5 | mechanical | pragmatic | 0.25 kB of headroom | growing the main chunk |
| 5 | eng | C1 four flat pieces, one level | taste | explicit | bounded and testable | ramps in the search |
| 6 | eng | C2 unset box searches the whole library | taste | completeness | the feature works for a new visitor | refuse until a box exists |
| 7 | eng | C4 main road at switches | taste | explicit | one rule, same run every time | user-set switches |
| 8 | eng | C5 no pan or zoom on phones | taste | pragmatic | no second gesture | pinch zoom |
| 9 | eng | C6 palette extraction first | taste | explicit | the shell cannot move inline JSX | split later |
| 10 | eng | C8 run only on a working layout | taste | explicit | a weld is not a joint | walk anything welded |
| 11 | eng | C3 amend rule 8 | owner's | n/a | a binding design rule; not auto-decided | n/a |
| 12 | eng | C7 re-measure the chunk budget for E2 and E4 | owner's | n/a | always the owner's call before | n/a |

<!-- autoplan-accepted:eng -->
- E2: the `preset` action, reducer case and caller carry turns; a wrong-length turns list throws at load; every preset's `expect` is checked through the reducer and graph solver; placed turns are pinned; ready layouts use only pieces with published sizes and published centrelines; `canBuild` reuses `shortfalls`.
- E3: one `applyFill` transaction for preview and apply; polarity checked per joint with equal-ended pieces allowed; keep rules 1 to 5; whole-layout box and adapter check; `MAX_FILL_PIECES = 4`, `FILL_BUDGET` and `MAX_FILL_CHECKS = 6`; work after a "Searching" paint; offers dropped on a graph, box or library change, tested in both orders; refusals are sentences, never "impossible".
- E5: `openings` in the engine, proved by a differential over the corpus before any route code; `walkRoute` on rendered segments with road identity, visited directed states, lead and loop, a hard cap; the run offered only on a working verdict; one element moved per frame; stops on edit and when hidden; a sentence under reduced motion; the run names its train.
- E4: `Palette.tsx` extracted first with existing tests unchanged; the gate changes in `screenMode`, the dispatch guard and the CSS in one pull request; shared links stay read-only; port marks get a pixel floor; a design review before the shell; draw time measured on a phone.
- All: no saved-format change; E3 and E5 code loads on first use; one pull request per step, none stacked; every pin's mutation is run.
<!-- /autoplan-accepted:eng -->

### Completion summary

| Item | Result |
|---|---|
| Scope challenge | 12 premises, 0 unverified, 2 findings (touch editing already exists; rule 8 conflict) |
| Architecture | 3 findings, all applied or raised as choices |
| Code quality | 4 notes, no blockers |
| Tests | 20 codepaths mapped, 2 human-only gaps |
| Performance | 3 bench steps named, 1 unknown (phone draw time) |
| Failure modes | 11 rows, 0 critical gaps |
| Outside voice | Codex completed: 10 findings, 10 applied |
| Native voice | not run (pipeline guard) |
| Choices for the owner | 8 (C1 to C8); C3 and C7 are not auto-decided |

### Approval

Approved by the owner on 2026-11-14, as written.

| Choice | Owner's answer |
|---|---|
| C3 rule 8 | "Amend rule 8": a train run the user starts, that stops on any edit and is off under reduced motion, is a second authored motion |
| C7 chunk budget | "Re-measure for E2 and E4": the budget is re-measured once with each, recorded with its date and reason |
| The plan, with C1, C2, C4, C5, C6 and C8 | "Approve as written" |

Still required before its step: `/plan-design-review` for E4's phone shell.
The native review voice did not run; Codex's completed review is the only
independent coverage of this plan.
