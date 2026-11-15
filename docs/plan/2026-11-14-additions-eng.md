<!-- /autoplan restore point: "/Users/radudiaconescu/Developer/ChooChooCAD/.gstack/tmp/autoplan/phone-editor-design-autoplan-restore-20261114-200921.md" -->
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

### E4 design decisions (design review, 2026-11-14)

Each was put to the owner as its own question and is recorded with the
answer. Step 2 above is built to these, not to its one sentence.

**DD1. Where the controls live (owner: "Row of four + More").** One screen
that never scrolls:

```
+----------------------------+
| identity line              |
|              [Share][Build]|   the view corner, as on a wide screen
|                    [2D|3D] |
|          the plan          |   takes all the height that is left
|                            |
| O verdict            1 note|
| [ strip: Place Turn Cancel]|
|----------------------------|
| [Pieces] [Undo][Redo][More]|   fixed row, every target 44px or more
+----------------------------+
```

More holds, in this order: Remove last, Clear, Ready layouts, Save to a
file, Open a layout file, Your box, Your table, Add a part, Run a train.
Seen first: the plan. Second: the verdict. Third: Pieces.

**DD2. The plan does not move while you aim (owner: "Reserved row, short
forms").** One row, 52px, is always reserved under the verdict for the
placing, joining and selection strips; empty, it shows the quiet hint. The
plan never resizes when a strip appears. On a phone the selected-piece strip
is one line: Turn, Flip, Remove, and a More for the arrows and versions.

**DD3. The verdict's room (owner: "Answer always, notes folded").** The
verdict sentence and the next step always show in full and wrap freely;
neither is ever cut. Everything else (trust lines, limits, train fit) is
behind "N notes", which opens over the plan and closes again. A physical
requirement the user must act on belongs in the sentence or the next step,
not only in a note.

**DD4. The Pieces sheet (owner: "Half height, plan visible").** The sheet
covers the lower half of the screen over the verdict, the strip row and the
bottom row; the plan stays above it at the same size and does not resize.
Its first row is the word "Pieces" and a Close button. It closes on a pick,
on Close, or on a tap on the plan, and that tap does nothing else. It
remembers its scroll position. It holds what `PieceShelves` holds: the
Generic list, then the other systems as closed shelves. It opens and closes
at once, with no slide (DESIGN.md rule 8).

**DD5. Warnings (owner: "One line under the identity line").** A live
warning (the layout could not be saved, another tab has changed it, the
layout needs more track than the box holds) takes one wrapping line directly
under the identity line. With several, the most serious shows (a failed save
first) with "and 1 more" opening the rest. The phone stylesheet no longer
hides `.notice` or `.shortfall`.

What each part shows, state by state (what the person sees):

| Part | Empty | Loading | Working | Failed | Partly |
|------|-------|---------|---------|--------|--------|
| The plan | "Build a circle" and the sentence it has today | none: it draws at once | the layout, fitted to the space | too much track to draw: today's sentence, placing paused | n/a |
| Verdict | not shown on an empty floor, as today | "Checking" as today | sentence + next step, "N notes" | n/a | "partly checked" stays in the sentence, never only in a note |
| Strip row | the quiet hint | n/a | Place / Turn / Cancel, or the selection row | a refusal is said in the row, as today | n/a |
| Pieces sheet | never empty (the library) | none | the shelves | paused: cards greyed, the paused sentence first | a card past the box is marked, still pressable |
| 3D view | "Nothing to show in 3D yet." | today's loading line | the picture | today's Try again / Reload | n/a |
| Warning line | absent | n/a | absent | the failed-save sentence | "and 1 more" |

**DD6. The next piece (owner: "Same piece stays ready").** In the phone
shell, after Place the same piece is previewed on the new free end, so a run
of eight curves is one pick and eight presses of Place. Cancel puts the
preview away; Pieces changes the piece. A wide screen keeps its double-click
and is not changed.

**DD7. Crowded ends (owner: "'Next end' in the row").** A tap picks the
nearest free end. When other free ends lie within the same tap's reach
(`endHitRadiusMm`), the strip row gains "Next end", which moves the preview
to each of them in turn, nearest first, and round again. The preview always
shows which end is chosen before Place. This is what makes choice C5 (no pan
or zoom) hold on a large layout.

The journey these decisions make:

| Step | The person does | The person feels | What supports it |
|------|-----------------|------------------|------------------|
| 1 | Opens the site on a phone, empty floor | "What is this, what do I press?" | identity line; "Build a circle" on the plan (exists) |
| 2 | Presses Build a circle | relief: there is a railway, and it "works" | the verdict under the plan (DD3) |
| 3 | Presses Pieces, picks a long straight | in control: the track is still in view | half-height sheet, plan visible (DD4) |
| 4 | Sees the preview, presses Place | sure of where it goes | reserved row, plan does not jump (DD2) |
| 5 | Places five more of the same | fast | same piece stays ready (DD6) |
| 6 | Two ends nearly meet; taps between them | no guessing | "Next end" (DD7) |
| 7 | The loop closes; the verdict changes | the payoff | verdict sentence always whole (DD3) |
| 8 | Comes back a week later | it is still there, or it says why not | the warning line (DD5) |

**DD8. Touch wording (owner: "Touch wording on touch screens").** On a
touch screen (phone or tablet) the strips say "Place", "Turn", "Cancel",
"Tap another free end", with no key names, as `HINT_TOUCH` already does for
the selection hint. A mouse or keyboard keeps today's wording with its keys.
Each strip sentence has both wordings and a test for each.

Held to DESIGN.md as it stands (no new decision): Pieces is the heaviest
button in the bottom row by weight, never by colour (rule 1); the sheet and
More do not animate (rule 8); no sentence names where a button is, only its
name (rule 7); every target in the shell is 44px or more (rule 10); colours
and fonts are the existing tokens, with no new ones.

**DD9. Sideways (owner: "Short touch screens use the phone shell").** A
touch screen under 500px tall gets the phone shell too, arranged side by
side: the plan, and beside it a narrow column with the verdict, the strip
row and the four buttons. The Pieces sheet there is the full height of that
column's side, and the plan stays visible. Turning the phone keeps the
picked piece, the chosen end, an open sheet and an open panel.

For the build: this is a second condition beside `NARROW_QUERY`
(`(max-width: 620px)`), not a change to it. `narrowQuery.test.ts` pins the
stylesheet's gate to that constant. (Corrected by the engineering review: a
shared link is routed to the friend's screen at every width, and that
screen's narrow styling is its own literal `620px` rule, not this constant.
How the shell is chosen is ED2 in "Engineering review of E4".)

**DD10. Panels and the keyboard (owner: "Done in a fixed first row").**
Your box, Your table and Add a part each open full screen with a first row
that never scrolls: the panel's name and Done. The form scrolls by itself
under that row, and the field in use is scrolled into view when the keyboard
opens. Number fields open the number pad (the box and the table already ask
for it; Add a part's fields are checked and given the same). The 44px
data-entry floor of rule 10 holds as it does now.

**DD11. Screen reader and keyboard (owner: "The browser's own dialog").**
Pieces and More open as labelled dialogs using the browser's own `<dialog>`
element: focus moves in, Escape closes, and focus returns to the button that
opened it. This is the app's first use of that element (none exists today),
so the build checks it under jsdom before relying on it in the DOM tests.
While one is open, the plan behind it is not reachable by keyboard or screen
reader; the tap on the plan that closes the sheet (DD4) is a tap on the
dialog's backdrop. After a pick, focus goes to Place and the pick is
announced, as today. The layout list (every piece, end and joint by name)
is reachable from More.

**DD12. A friend's exit on a phone (owner: "Offer the same exit as a wide
screen").** A shared link stays read-only on every screen (DESIGN.md rule
13). On a phone the friend's screen gains the exit a wide screen has (the
`OPEN_IN_EDITOR` button, with its ask-before-replacing step), placed with
the quiet ways out, after Build it. `PHONE_CANNOT_EDIT` and
`PHONE_DESIGN_ELSEWHERE` (`linkWords.ts`) are deleted, with the stylesheet's
"needs a larger screen" fallback sentence.

**DD13. No drag out of the sheet (owner: "Tap only in the sheet").** In the
phone's sheet a card is picked by a tap and nothing else, so scrolling the
list never grabs a piece. Tablets and wide screens keep the palette drag as
it is, and dragging a piece already on the plan is not changed anywhere.

**DD14. More (owner: "The same half sheet, grouped rows").** More opens as
the same half-height sheet as Pieces (plan visible, Close in its first row,
a dialog per DD11). Its rows are grouped under three plain headings, and
this order replaces the flat list in DD1:

- This layout: Remove last, Clear, Run a train, Save to a file, Open a
  layout file, This layout as a list.
- Your things: Your box, Your table, Add a part.
- Ready layouts: all eight, each with its note about the box.

Clear keeps Undo as its safety, as today, and asks nothing first.

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
| C4, since 2026-11-15 | Superseded by the owner: at a switch a run takes any road, each with the same chance, and each press of Run a train is a new journey. The fixed main-road walk (`walkRoute`) stays for layouts with no choice to make; the run's sentences say what can happen, not one journey's luck | "a probabilistic model that decides where the train goes" | keep C4 |
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

`/plan-design-review` for E4's phone shell was run on 2026-11-14; its
fourteen decisions are DD1 to DD14 under E4, and its record follows. For the
engineering review, the native review voice did not run; Codex's completed
review is the only independent coverage of that phase.

## Design review of E4 (2026-11-14)

`/plan-design-review` on the phone editor only. Picture mockups were not
made: the mockup tool had no image key on this machine, so the layouts were
decided from sketches in the questions. Two outside reviews were run first
(Codex, and a separate Claude that had not seen this review); both found the
same top gaps, and every one of them became a question to the owner.

### What already exists, and is reused

- `PieceShelves` (`app/src/Palette.tsx`): the sheet's whole content.
- The `mode-strip` rows (placing, joining, selection) and their focus moves.
- Tap an end, then Place; `endHitRadiusMm` gives each end 44px on touch.
- The empty floor's "Build a circle"; the 3D view's loading and failure
  sentences; the polite announcements region; the layout list.
- `HINT_TOUCH` (`selectHint.ts`): the pattern for touch wording.
- The friend's screen and its `OPEN_IN_EDITOR` exit with ask-before-replace.
- DESIGN.md rules 1, 7, 8, 10, 11 and 13, unchanged.

### Not in scope for the phone editor

- Pan and zoom: the owner's choice C5; DD7 is what makes it hold.
- Any slide or fade on the sheet: rule 8 allows two motions, and this is
  neither.
- The wide-screen and tablet layouts: unchanged, apart from touch wording on
  tablets (DD8).
- The order of the friend's screen: unchanged apart from the one exit (DD12).
- Picture mockups: not made (no image key); `/design-review` on the built
  screen is the visual check.

### TODOS.md

Nothing deferred: every finding was decided and is a task below.

## Implementation Tasks

Synthesized from the design review's findings. Each task derives from a
decision above. These replace E4's steps 2 to 4; step 1 is done.

- [x] **T1 (P1, human: ~3 days / CC: ~2 h; done in #286)** — phone shell — One screen that never scrolls: identity line, warning line, view corner, plan, verdict, reserved strip row, bottom row of Pieces, Undo, Redo, More
  - Surfaced by: DD1, DD2, DD3 (the controls had no home; strips moved the plan; the verdict's room was unsaid)
  - Files: `app/src/App.tsx`, `app/src/app.css`, a new `app/src/PhoneShell.tsx`, `app/src/VerdictLine.tsx`
  - Verify: `bun run test`; DOM test that the shell renders the four buttons and no palette section when narrow; screenshots at 390x844
- [x] **T2 (P1, human: ~2 days / CC: ~1 h; done in #284, #286)** — sheet — A half-height sheet on the browser's `<dialog>`: Close row, closes on pick, Close, backdrop tap and Escape; remembers scroll; no motion; holds `PieceShelves`; tap only
  - Surfaced by: DD4, DD11, DD13
  - Files: a new `app/src/Sheet.tsx`, `app/src/Palette.tsx`, `app/src/app.css`
  - Verify: DOM tests for open, pick-closes, Close, Escape, focus in and focus back; a check that `<dialog>` works under jsdom before the tests rely on it
- [x] **T3 (P1, human: ~1 day / CC: ~45 min; done in #286)** — More — The same sheet with three headed groups and the eight ready layouts with their box notes
  - Surfaced by: DD14
  - Files: `app/src/PhoneShell.tsx`, `app/src/App.tsx`
  - Verify: DOM test that each row reaches its action and that Clear is undoable
- [x] **T4 (P1, human: ~1 day / CC: ~45 min; done in #287)** — gate — `screenMode` allows editing when narrow for your own layout and the example; the dispatch guard and stylesheet follow; one exported query for "narrow, or short and coarse", pinned like `NARROW_QUERY`; the sideways arrangement
  - Surfaced by: DD9, and E4's step 3
  - Files: `app/src/screenMode.ts`, `app/src/useMatchMedia.ts`, `app/src/App.tsx`, `app/src/app.css`, their tests
  - Verify: the `screenMode` truth table; a shared link still refuses edits when narrow; turning keeps the picked piece
- [x] **T5 (P1, human: ~1 day / CC: ~45 min; done in #282, #283, #286)** — crowded ends — "Next end" in the strip row when other free ends are within the tap's reach
  - Surfaced by: DD7 (both outside reviews: bigger rings do not make close ends choosable)
  - Files: `app/src/trackPath.ts`, `app/src/App.tsx`, `app/src/editorReducer.ts`
  - Verify: unit test on which ends are within reach and their order; DOM test that Next end moves the preview
- [x] **T6 (P2, human: ~4 h / CC: ~30 min; done in #281, #286)** — placing — In the phone shell the same piece stays ready after Place
  - Surfaced by: DD6
  - Files: `app/src/editorReducer.ts`, `app/src/App.tsx`
  - Verify: reducer test; a wide screen's behaviour unchanged
- [x] **T7 (P2, human: ~4 h / CC: ~30 min; done in #279)** — copy — Touch wording for every strip sentence and button, with no key names
  - Surfaced by: DD8
  - Files: `app/src/App.tsx`, a words file beside `selectHint.ts`
  - Verify: a test for each wording; `copyPosition.test.ts` stays green
- [x] **T8 (P2, human: ~4 h / CC: ~30 min; done in #286)** — warnings — One wrapping line under the identity line, most serious first, "and 1 more"
  - Surfaced by: DD5 (the phone stylesheet hides a failed save today)
  - Files: `app/src/App.tsx`, `app/src/app.css`
  - Verify: `saveFailure.dom.test.tsx` extended to the narrow screen
- [x] **T9 (P2, human: ~1 day / CC: ~45 min; done in #286)** — panels — Full screen with a fixed first row (name and Done), a form that scrolls by itself, number pads
  - Surfaced by: DD10
  - Files: `app/src/Inventory.tsx`, `app/src/TablePanel.tsx`, `app/src/SubmitPart.tsx`, `app/src/app.css`
  - Verify: DOM test that Done is outside the scrolling form; a real-phone check with the keyboard up
- [x] **T10 (P2, human: ~3 h / CC: ~20 min; done in #287)** — friend's screen — The editor exit on a phone; delete `PHONE_CANNOT_EDIT`, `PHONE_DESIGN_ELSEWHERE` and the stylesheet's fallback sentence
  - Surfaced by: DD12
  - Files: `app/src/OpenInEditor.tsx`, `app/src/linkWords.ts`, `app/src/FriendScreen.tsx`, `app/src/app.css`
  - Verify: `friendScreen.dom.test.tsx` and `openInEditor.dom.test.tsx` at the narrow width
- [x] **T11 (P2, human: ~3 h / CC: ~20 min; done in #278)** — rings — The visible end rings get the pixel floor the hit areas have
  - Surfaced by: E4's step 4
  - Files: `app/src/TrackCanvas.tsx`, `app/src/trackPath.ts`
  - Verify: unit test on the ring's radius at a small scale
- [ ] **T12 (P1, human: ~2 h / CC: n/a)** — check — A person builds a loop on a real phone, upright and sideways, with one hand, then with a screen reader; `/design-review` on the built screen
  - Surfaced by: the review as a whole; no pictures were made, so this is the visual check
  - Files: none
  - Verify: the owner's own pass

## Design Review Completion Summary

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md exists; one new screen, one sheet |
| Step 0               | 3/10; all seven passes, mockups asked for   |
| Pass 1  (Info Arch)  | 3/10 → 9/10 after fixes                     |
| Pass 2  (States)     | 2/10 → 8/10 after fixes                     |
| Pass 3  (Journey)    | 3/10 → 9/10 after fixes                     |
| Pass 4  (AI Slop)    | 8/10 → 8/10 (no issues)                     |
| Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
| Pass 6  (Responsive) | 2/10 → 9/10 after fixes                     |
| Pass 7  (Decisions)  | 3 resolved, 0 deferred                      |
+--------------------------------------------------------------------+
| NOT in scope         | written (5 items)                           |
| What already exists  | written                                     |
| TODOS.md updates     | 0 items proposed                            |
| Approved Mockups     | 0 generated, 0 approved (no image key)      |
| Decisions made       | 14 added to plan (DD1 to DD14)              |
| Decisions deferred   | 0                                           |
| Overall design score | 2/10 → 8/10                                 |
+====================================================================+
```

Why two passes stop short of 10: states (8) has no picture of any state,
and generic-UI risk (8) cannot be judged finally from words. Both are closed
by T12 on the built screen.

### Unresolved Decisions

None.

## Engineering review of E4 (2026-11-14, after the design review)

`/autoplan`'s guard refused an engineering phase without its CEO phase
("Read the current Phase 1 CEO entry successfully before entering a later
phase"), as it did in the morning. The review was therefore run directly:
the code read against the plan, plus two independent reviewers (Codex, and a
separate Claude that saw neither review). Both returned findings; they agree
except where ED4 says otherwise. Every claim below was checked in the code.

### Reality check (what the code says against what the plan assumed)

REALITY: already-done touch placing, the 44px end hit areas and number pads on the box and table exist `app/src/trackPath.ts:627`, `app/src/Inventory.tsx:105`
REALITY: different-from-plan the browser `<dialog>` has no behaviour under the test environment: jsdom 31.0.0's class is empty `node_modules/jsdom/lib/jsdom/living/nodes/HTMLDialogElement-impl.js:5`
REALITY: different-from-plan a phone is sent to the friend's screen by `screen.mode === 'view' || (example && narrow)`, not by `canEdit` `app/src/App.tsx:1617`
REALITY: different-from-plan a shared link goes to the friend's screen at every width; its narrow styling is a literal 620px rule that also hides the editor exit `app/src/app.css:2249`
REALITY: different-from-plan "Next end" cannot be worked out by the reducer: only the canvas knows the scale and which ends a tap reached `app/src/TrackCanvas.tsx:1282`
REALITY: different-from-plan Place consumes the preview, picks a cursor and may select a pier; a fresh pick after a closed loop floats loose `app/src/editorReducer.ts:604`, `:455`
REALITY: different-from-plan the notes block holds the next step and the must-read statements as well as the fold, so "notes folded" needs the content split first `app/src/VerdictLine.tsx:237`
REALITY: bug-found a train run comes back after Undo: the run is hidden when `train.graph !== graph`, and Undo restores the same graph object `app/src/App.tsx:1271`, `app/src/editorReducer.ts:774`
REALITY: budget first load is 166.87 kB of 167.06 kB, and the script counts every preloaded file `scripts/chunkBudget.ts:64`

### The two reviewers

```
ENG DUAL VOICES — CONSENSUS TABLE
  Dimension                           Claude   Codex    Consensus
  1. Architecture sound?              partly   partly   CONFIRMED: gate/query split and reducer shape must be fixed first
  2. Test coverage sufficient?        no       no       CONFIRMED: several promised tests cannot fail
  3. Perf risks + budget named?       no       no       CONFIRMED: no budget plan; about 190 bytes left
  4. Security threats covered?        yes      n/a      single voice: no new input surface, links stay read-only
  5. Error paths handled?             partly   partly   CONFIRMED: warnings lose their recovery buttons; loop close; Undo
  6. Deployment risk manageable?      yes      yes      CONFIRMED, with the landing order in ED9
```

Single-voice findings that were checked and kept: the train run returning
after Undo (Codex), editor shortcuts firing from inside a sheet (Codex), the
keyboard shrinking a sideways tablet under the short-screen limit (Claude),
Clear being permanent when a phone discards the tab (Claude).

### How the parts fit

```
 matchMedia: PHONE_SHELL_QUERY (narrow, or short and coarse) ── ONE reader ──▶ App.tsx
                                                                                │
   link? ──yes──▶ FriendScreen (read-only, every width; gains the exit, T10)    │
     │no                                                                        ▼
   screenMode({link, stored, adopted})  ── no `narrow` any more ──▶ edit | example | link
     │                                                   canEdit true for edit and example
     ▼
   App state, lifted above both shells: editor (reducer), open sheet, open panel, drafts
     ├── wide: today's rail and section.palette                (eager, unchanged)
     └── phone: lazy(() => import('./PhoneShell.js'))          (its own chunk)
            ├── Sheet (dialog) ─▶ PieceShelves (eager, shared; drag off)
            ├── Sheet (dialog) ─▶ More
            ├── warning line  ─▶ the same notices, with their buttons
            └── strip row     ─▶ Place / Turn / Cancel / Next end

   TrackCanvas ── scale (px per mm) lifted ──▶ endsWithinReach(chosen end, ends, scale)   trackPath.ts, pure
   editorReducer: placeGhost {again: true} ─▶ next preview only if the placed piece has a free end
```

### Engineering decisions

Decided here by the usual rules (explicit over clever; reuse first), except
ED3, ED4 and ED10, which were put to the owner.

- **ED1. The dialog and the tests.** `Sheet.tsx` uses the browser's
  `<dialog>` and `showModal()` (DD11 stands). `app/test/domSetup.ts` gains a
  small stand-in for the test environment only (showModal sets `open`; close
  removes it and fires `close`). DOM tests cover what the app owns: a pick
  closes, Close closes, a tap outside the sheet's box closes and is not
  passed to the plan, closing updates state. Escape, focus held in the sheet
  and focus returning to its button are checked in a real browser (T12),
  because the stand-in could only test itself.
- **ED2. One query, read once.** `PHONE_SHELL_QUERY` ("narrow, or short and
  coarse") is read in one place and picks the shell by rendering it; the
  shell is styled by its class, not by a second media query. `screenMode`
  loses `narrow` and its `view` mode: a link is `link`, your own layout is
  `edit`, the example is `example`, and both of the last two may edit.
  `saveLayout` and `ownBuild` keep depending on ownership only. The
  stylesheet's gate block and `narrowQuery.test.ts` go with the gate (T10);
  the friend's screen keeps its own 620px styling, minus the two rules that
  hide the exit and the ask-before-replacing step.
- **ED3. When a piece stays ready (owner: "Ready only while it has an end
  to go on").** `placeGhost` takes `again: true` in the phone shell. The
  next preview is made in the same reducer step, and only when the piece
  just placed has a free end; a closed loop, a buffer or a pier leaves
  nothing previewed. Undo and Redo put the preview away. One action, so the
  "placed" announcement is kept and focus stays on Place. Each Place is
  still one Undo step.
- **ED4. Which ends "Next end" steps through (owner: "Ends near the chosen
  end").** `endsWithinReach(chosen, ends, pxPerMm)` in `trackPath.ts`, pure:
  the free ends, hidden ones left out, within the tap radius of the chosen
  end, nearest first, ties by placement order. The canvas's scale is lifted
  so App can call it; it is worked out again whenever the layout or the
  scale changes. Stepping moves the preview and makes no Undo step. In join
  mode the same button steps the end being joined to. (Codex preferred the
  ends under the original tap; the owner chose the rule that survives
  turning the phone.)
- **ED5. The verdict's content is split before it is folded.** In
  `VerdictLine.tsx` the next step and the statements a person must act on
  (adapter needed, raised track unsupported, systems that do not join,
  partly checked) are separated from the explanations. Only the
  explanations go behind "N notes" on a phone. Without this, DD3 would hide
  exactly what it says must stay.
- **ED6. Sheets are modal to the keyboard too.** `useEditorKeys` is off
  while a sheet or a full-screen panel is open, as it is in build mode, so a
  key pressed inside a sheet cannot undo or turn track behind it. Focus
  after closing depends on why it closed: dismissed, back to the button that
  opened it; a pick, to Place.
- **ED7. State lives above both shells.** The reducer, which sheet or panel
  is open, the sheet's scroll position and the drafts in Your table and Add
  a part are held above the wide and phone shells, so turning the phone, or
  the keyboard shrinking a sideways tablet under the limit, keeps them.
- **ED8. The first-load budget.** `PhoneShell.tsx` (with `Sheet` and More)
  is one lazily loaded chunk, with a loading line and the 3D view's kind of
  failure line. What cannot be lazy (the gate, the reducer change,
  `endsWithinReach`, the touch wording, the verdict split, the ring floor)
  lands in the editor's chunk, and the budget is re-measured once for E4, as
  the owner approved (choice C7), with the phone chunk's own size recorded
  beside it.
- **ED9. Landing order: built dark, switched on once.**
  1. Fixes that stand alone: the train run and Undo (ED11); the ring floor
     (T11); touch wording (T7); the verdict split (ED5).
  2. Reducer and canvas, wide screens unchanged: `again` (ED3),
     `endsWithinReach` and Next end (ED4), drag made optional in
     `PieceShelves`.
  3. The shell, the sheets, More, the warning line and the panels, all
     behind a condition nothing turns on yet.
  4. One pull request that turns it on: `screenMode`, the routing at
     `App.tsx:1617`, the gate block and its test removed, the friend's exit,
     the retired sentences deleted.
  No step leaves a phone with an editor it cannot see or a save failure it
  cannot read.
- **ED10. Clear keeps the old layout (owner: "Put the old layout aside
  first").** Clear and a ready layout first keep the current layout in the
  existing put-aside store (`app/src/putAside.ts`), on every screen, and
  More gains a row to bring it back. Still no question before clearing
  (DD14 stands).
- **ED11. A train run ends for good on an edit.** Found while checking: a
  run started, then an edit, then Undo, shows the old run again with its old
  start time. Fixed on its own, before E4: any committed change to the
  layout clears the run, and a run still loading for a layout that has since
  changed is dropped. Moving a preview is not an edit.
- **ED12. Warnings keep their buttons.** The phone's warning line carries
  the same actions the notices have today (download the copy, remove it,
  reload), not only their sentences.

### What each new path is tested by

| New path | Test | Where it can run |
|----------|------|------------------|
| shell chosen by the one query; link still read-only | `screenMode` truth table; DOM test with a matchMedia fake for the new query | node, dom |
| pick, cancel: nothing saved; first edit adopts the example; reload keeps it | DOM tests on storage after each step | dom |
| sheet: pick closes, Close, outside tap not passed on, state follows `close` | DOM tests on the stand-in | dom |
| sheet: Escape, focus held, focus back; scroll remembered; never scrolls; 44px | named checks in T12 | real browser |
| keys off while a sheet is open | DOM test: R and Ctrl+Z inside a sheet change nothing | dom |
| `again`: eight placements, loop closes with no preview, pier, buffer, Undo | reducer tests; the existing wide-screen expectations stay as they are | node |
| `endsWithinReach`: order, ties, hidden ends, none | unit tests | node |
| Next end moves the preview, makes no Undo step, wraps | reducer and DOM tests | node, dom |
| verdict: each must-read statement still on screen when folded | fixtures for adapter, raised, not joining, partly checked | node (static markup) |
| warnings: order, "and 1 more", every recovery button reachable | DOM test with two warnings live | dom |
| panels: a draft survives the shell changing | DOM test flipping the query with a half-typed field | dom |
| Clear and ready layouts put the layout aside; bring back restores it | unit and DOM tests on the store | node, dom |
| train run: Run, edit, Undo shows no run | DOM test | dom |
| touch wording: the strips as rendered, not a words file | DOM tests per pointer type | dom |
| rings: the radius the SVG actually emits at a small scale | static markup test | node |
| first load within the re-measured budget; phone chunk size recorded | `scripts/chunkBudget.ts` in CI | CI |

Every test records the change that makes it fail, and that change is run
(CLAUDE.md).

### What can go wrong, and what catches it

| Failure | Seen by the user as | Caught by | Open? |
|---------|--------------------|-----------|-------|
| the phone chunk fails to download | no editor | a failure line with Reload, as the 3D view has | no |
| the gate opens before the shell exists | "needs a larger screen" on an editing phone | landing order, ED9 | no |
| a save fails on a phone | silently lost work | the warning line with its buttons, T8 and ED12 | no |
| Clear, then the tab is discarded | a layout gone | the put-aside copy, ED10 | no |
| the loop closes with a piece still ready | a stray piece | ED3 | no |
| a key pressed in a sheet edits the plan | track changed unseen | ED6 | no |
| the keyboard flips the shell mid-typing | a lost draft | ED7 | no |
| native dialog behaviour differs between browsers | a sheet that will not close | T12 on a real phone, two browsers | **yes, until T12 is done** |

### Not in scope for this review

Persisting Undo history across a reload (ED10 covers the loss that
matters); `interactive-widget` on the viewport tag (ED7 makes it
unnecessary); making the panels lazy on wide screens; any change to the
wide-screen placing behaviour.

### Tasks, as the engineering review leaves them

T1 to T12 above stand, with these changes:

- **T0 (new, P1, human: ~3 h / CC: ~20 min)** — train run — ED11, on its own pull request, first.
- **T1** adds: the shell is a lazy chunk with loading and failure lines (ED8); the verdict split (ED5) comes before it.
- **T2** adds: the test stand-in and the outside-tap rule (ED1); keys off while open (ED6); drag off through a prop on `PieceShelves`.
- **T3** adds: the "bring back" row (ED10).
- **T4** becomes the switch-on pull request and absorbs T10 (ED2, ED9).
- **T5** adds `app/src/TrackCanvas.tsx` to its files and is built on `endsWithinReach` (ED4).
- **T6** is `placeGhost {again}` (ED3).
- **T8** adds the recovery buttons (ED12).
- **T9** adds: drafts held above the shells (ED7).
- **T12** adds the browser-only checks named in the table above, on two phone browsers.

### Engineering review summary

- Scope: nothing removed; one fix (T0) and one safeguard (ED10) added.
- Architecture: 5 issues, all decided (ED1, ED2, ED6, ED7, ED9).
- Code quality: 2 issues, decided (ED5, ED12).
- Tests: 12 promised tests could not fail as written; each now has a path in the table.
- Performance: 1 issue, decided (ED8).
- Critical gaps open: 0. One failure mode stays open until T12 is done on real phones.
- Owner decisions: 3 (ED3, ED4, ED10).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | done in `2026-11-14-product-state-review.md` | 5 proposals, 5 accepted, 0 deferred |
| Outside Review | Codex, eng phase, morning | Independent 2nd opinion | 1 | completed | 10 findings, all applied |
| Outside Review | Codex, design phase (`/plan-design-review`) | Independent 2nd opinion | 1 | completed | 11 findings, all put to the owner |
| Outside Review | Codex, eng phase for E4 | Independent 2nd opinion | 1 | completed | 12 findings, all decided |
| Eng Review | direct (the `/autoplan` guard refused an eng-only run) | Architecture & tests (required) | 2 | clean for E4 | 12 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 2/10 → 8/10, 14 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | n/a |

- **OUTSIDE COVERAGE:** Codex completed in both the design phase (11 findings) and the E4 eng phase (12 findings, 6 High). A separate Claude subagent completed in both (12 and 11 findings).
- **CROSS-MODEL:** in the eng phase both voices independently found the empty dialog class in the test environment, the missing landing order, the reducer gap at loop close, that "Next end" is not derivable from reducer state, the lack of a budget plan and the tests that cannot fail. They differed on how "Next end" picks its ends; the owner chose (ED4).
- **VERDICT:** DESIGN + ENG CLEARED for E4. Ready to build in the order of ED9, starting with T0.

NO UNRESOLVED DECISIONS
