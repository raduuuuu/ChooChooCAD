# Working plan: remove any piece, piece seams, placement preview, floor grid, drag-and-drop

CEO summary: ~/.gstack/projects/brio-designer/ceo-plans/2026-10-22-editing-and-canvas.md

Source: user request, 2026-10-22 (verbatim): "1/ the user needs to be able to remove any
piece from the table, not just the last. 2/ user needs to see clear delimitations between
the pieces (if i put together 3 straight pieces I need to be able to see where each one
ends). 3/ when placing a piece I want to have a visualization of it that allows me to
select the orientation, then confirm it. 4/ make the background like a subtle grid so that
the user can better align pieces."

Branch at review: main @ 93a55dc. Review depth: implementation-ready.

## System facts (evidence)

- Any-piece removal already exists in the engine: `removePiece` (engine/src/graph/edit.ts:68)
  drops the piece, its welds and its anchor, then `captureAnchors` pins every resulting
  component at its old frame, so the survivors do not move. Wrapped by `deletePiece`
  (app/src/layoutModel.ts:201). The UI only reaches it through `removeLast`
  (app/src/editorReducer.ts, case 'removeLast'; button at app/src/App.tsx:815).
- The track body is not a click target today. Only free ends (r=26 hit circle) and joints
  (r=14) are (app/src/TrackCanvas.tsx).
- No seams by design: layers are painted layer-by-layer across all segments so "every
  joint would [not] show a seam that is not there" (TrackCanvas.tsx, layer loop comment).
  Request 2 reverses that choice deliberately: real BRIO joints are visible.
- Every rendered port carries x, y and heading `h` (engine/src/graph/render.ts:34-42), so a
  seam line across the plank at each joint needs no engine change.
- Orientation today: palette main button adds turning left; a separate ↻ button adds turning
  right (App.tsx:632, :648). Polarity is chosen automatically by `orientation()`
  (layoutModel.ts:170). Placement is one click, immediate.
- 12 DOM-test call sites in 5 files click "Add Large curve" and expect an immediate piece.
- The canvas viewBox is fitted to the layout plus 90mm pad (TrackCanvas.tsx), so a grid
  drawn in model mm changes on-screen size as the layout grows.
- Design principle on record: "the track is the only texture on screen" (TrackCanvas.tsx:3).
  Request 4 overrides it.
- Backlog: P1 "Drag-and-drop, with undo, the drop-overlap guard and keyboard parity"
  (docs/plan/brio-TODOS.md:450). Its upgrade trigger is "any edit richer than append"; request
  1 is exactly that, so the trigger has fired. Requests 1 and 3 are the first slice of it.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R1 remove-any (user) | Request 1; removePiece exists | A: click a piece body to select it (outline); Remove piece button or Delete key removes it; Remove button per piece in the layout list; Undo restores it; Remove last kept. | | approved | D2 answer 2026-10-22: "A) Select, then remove". Scope: selection + removal only; no move/rotate of placed pieces. |
| R2 seams (user) | Request 2; ports carry heading | Thin line across the plank at every joint, in --track-edge, drawn after the track layers | | approved | Direct instruction (request 2). Line weight/colour are implementation detail, pinned by a markup spec. |
| R3 placement preview (user) | Request 3; one-click add, ↻ for right | A: palette click shows a ghost at the attach point; Rotate (R) cycles every fitting orientation; Place (Enter) commits; Cancel (Esc) drops it. Replaces the left/↻ pair. | | approved | D1 answer 2026-10-22: "A) Pending ghost, then confirm". Scope: placement flow only; DOM tests rewritten to place-then-confirm. |
| R4 grid (user) | Request 4; fitted viewBox | A: faint metric grid behind the track; step 10cm / 50cm / 1m chosen from the fitted view so cells stay readable; "Grid: 10 cm" caption | | approved | D3 answer 2026-10-22: "A) Metric, scales with zoom". |

## Answered: D1 (R3) -- A) Pending ghost, then confirm

### Saved D1 payload
Commitment comparison:

Commitment | Source | Current | A | B | C
---|---|---|---|---|---
Ghost shown before placing | request 3 | no | yes, at the attach point | yes, on palette hover/focus | no
Orientation chosen before placing | request 3 | left button / ↻ button | Rotate cycles every valid fit | Rotate on the ghost, click places | after placing, Turn round on the piece
Explicit confirm step | request 3 | none | Place / Enter, Cancel / Esc | the palette click is the confirm | none
Fast repeated build (8 clicks = circle) | cursorRoutes ROUTE 3 | yes | double-click or Enter per piece | yes | yes
Existing DOM tests touched | 12 sites, 5 files | n/a | rewritten to place-then-confirm | unchanged | unchanged

Question: D1 — R3: How should placing a piece with a preview work?
Header: Placement
A) Pending ghost, then confirm (recommended)
Clicking a palette piece shows a translucent ghost at the attach point; Rotate (R key) cycles every orientation that fits, Place (Enter) commits, Cancel (Esc) drops it. Effort M, risk medium, reuses addPiece/orientation for the ghost; verified by reducer specs plus a DOM spec. ✅ Exactly the flow asked for: see it, turn it, then commit, with nothing on the track until Place. ✅ One Rotate control replaces the left/↻ pair and also covers switches, which today have no way to pick which end goes on. ❌ Every placement costs two actions instead of one, and 12 test call sites in 5 files must be rewritten.
B) Hover preview, click places
Hovering or focusing a palette piece shows the ghost at the attach point with a Rotate control; clicking the piece places it as shown. Effort S, risk low. ✅ Keeps one-click building and every existing test, so the eight-click circle still works. ✅ Smaller diff: no pending state in the reducer, just a derived preview. ❌ There is no separate confirm, and hover does not exist on touch, so on a tablet the preview is never seen before the piece lands.
C) Place, then turn round
Keep immediate placement; the newest piece shows a Turn round control that swaps it to its other valid orientation. Effort S, risk low. ✅ Fastest to build and to use, and no new mode the user can get stuck in. ✅ Doubles as an edit for any placed piece later, which the drag work needs anyway. ❌ Not what was asked: you see the piece only after it is on the track, so it is fix-after rather than choose-before.

## Answered: D2 (R1) -- A) Select, then remove

### Saved D2 payload
Commitment comparison:

Commitment | Source | Current | A | B | C
---|---|---|---|---|---
Any piece removable | request 1 | newest only | yes | yes | yes
Canvas target on the track body | none today | no | click selects, outline shows | click removes while Remove mode is on | no
Keyboard / screen reader route | GraphListing U7b | Remove last | Remove button per piece in the listing, Delete key on a selected piece | same listing button | listing button only
Undo restores the piece | Undo is one step (LastAction) | n/a | yes, "Undo remove" | yes | yes
Remove last kept | owner ruling 2026-10-22 | yes | yes | yes | yes
Selection reusable by later edits | P1 drag item | n/a | yes | no | no

Question: D2 — R1: How do you pick which piece to remove?
Header: Remove
A) Select, then remove (recommended)
Clicking a piece's body on the canvas selects it with an outline; a Remove piece button (or Delete key) removes it, and the layout list gets a Remove button per piece. Undo brings it back. Effort M, risk low; reuses removePiece and resumeCursor; verified by reducer specs and a DOM spec. ✅ The piece you are about to remove is outlined first, so a click on a crowded layout cannot delete the wrong one. ✅ The selection is the same hook the drag work needs for move and rotate, so it is built once. ❌ Two actions per removal, and the track body becomes a click target that must not steal clicks from ends and joints.
B) A Remove mode
A Remove toggle in the palette; while it is on, clicking any piece removes it at once; off, clicks behave as now. Effort S, risk medium. ✅ Fast for clearing many pieces in a row, one click each. ✅ No selection state to build. ❌ A mode is easy to forget you are in, and nothing else in the editor would reuse it.
C) List only
A Remove button beside each piece in the layout list; nothing changes on the canvas. Effort S, risk low. ✅ Smallest diff: the list already names every piece and has buttons. ✅ Already keyboard and screen-reader friendly. ❌ To remove the piece you can see, you have to find it by number in a list, which is the friction you are asking to get rid of.

## Answered: D3 (R4) -- A) Metric, scales with zoom

### Saved D3 payload
Commitment comparison:

Commitment | Source | Current | A | B | C
---|---|---|---|---|---
Grid behind the track | request 4 | none | yes | yes | yes
Spacing unit | | n/a | metric, steps 10cm / 50cm / 1m picked from the fitted view | fixed 10cm, 1m heavier | 54mm, BRIO's shortest straight
On-screen density stays readable | fitted viewBox | n/a | yes, step chosen so cells stay ~20-60px | no, a 10m layout draws 100 lines a side | no
Scale stated in words | | n/a | "Grid: 10 cm" caption | caption | caption
Printed sheet | build sheet must print in greyscale | n/a | grid kept, lighter | same | same

Question: D3 — R4: What should the grid measure?
Header: Grid
A) Metric, scales with zoom (recommended)
A faint grid in real centimetres behind the track; the step is 10 cm, 50 cm or 1 m, picked so squares stay a comfortable size as the layout grows, with a "Grid: 10 cm" caption. Effort S, risk low. ✅ Answers "will this fit on my floor or table" directly, in units you can measure with a tape. ✅ Stays subtle on a one-piece layout and a ten-metre one alike. ❌ The step changing as the layout grows can surprise you if you miss the caption.
B) Fixed 10 cm
Always 10 cm squares with a heavier line every metre. Effort S, risk low. ✅ Simplest, and one square always means the same thing. ✅ The metre lines still give the big picture. ❌ On a large layout the fitted view packs the lines so tight they read as a grey wash instead of a grid.
C) BRIO track units
Squares the length of the shortest straight (54 mm). Effort S, risk low. ✅ Counts in "pieces" rather than centimetres. ❌ Curves and switches never land on it, so it suggests an alignment the track does not have, and it says nothing about room size.

## Mode
SCOPE EXPANSION, chosen by the user over the recommended SCOPE REDUCTION (answer 2026-10-22).
Governing rows: R1 (D2:A), R2 (direct instruction), R3 (D1:A), R4 (D3:A).

## 0F/0G Expansion candidates (answered)

| # | Proposal | Effort | Risk | Status |
|---|---|---|---|---|
| E1 | Ghost shows the consequence: tinted fail-red with the reason if placing it would overlap or clash, "closes the loop" if it would close one (verdict run on the hypothetical graph) | M | medium | ACCEPTED (D4:A) |
| E2 | Ghost can move: clicking any free end while a ghost is pending moves the ghost there | S | low | ACCEPTED (D5:A) |
| E3 | Turn round a placed piece: with a piece selected, Turn round swaps it to its other fitting orientation (same cycle as Rotate) | M | medium | SKIPPED (D6:C) |
| E4 | Table outline: enter a table/room size and see it as a rectangle on the grid | M | low | DEFERRED (D7:A) |
| E5 | Selected piece shows its name and size next to the outline | S | low | ACCEPTED (D8:A) |
| E6 | Full drag-and-drop (P1 backlog item) | XL | high | ACCEPTED (D9:B, against the Defer recommendation) |

Delight scan (30-minute class): E2, E5, a hover highlight on piece bodies before select, Esc clears the selection, the grid caption doubles as a scale bar.

## Further system facts (for E6, drag-and-drop)

- Positions are exact Z[zeta16] (8 integer coefficients, engine/src/geom/cyclotomic.ts), headings
  are integers mod 16 (22.5 degree steps, engine/src/graph/model.ts:59). Translating a component by
  whole millimetres (dx + dy*zeta^4) and rotating it by k*22.5 degrees (mulZetaPow) are both exact,
  so a drag that snaps to whole mm and 22.5 degrees cannot break exact closure. This is the
  "component origin MUST be a lattice point" hard requirement in brio-TODOS.md (P1 multiple
  components), satisfied by construction.
- Each component is placed from one anchor on its root piece (`graph.anchors`, model.ts:144);
  moving a component means rewriting that one anchor. Anchors already persist and reload.
- `Segment` (engine/src/geom/fk.ts:32) carries `partId` but not `pieceId`; a switch emits two
  segments (render.ts:99-113). Piece hit targets and the selection outline need `pieceId` on each
  rendered segment.
- The engine detects connector coincidence and polarity, not plank-over-plank crossing mid-span
  (brio-TODOS.md "overlap narrowphase", superseded note). Any overlap guard built here inherits
  that limit and must say so.
- Rendering cost: 453ms for 10,000 pieces through renderToStaticMarkup (TrackCanvas.tsx). A drag
  that re-renders the whole SVG per pointermove would stall on large layouts; the P1 entry
  already specifies a rigid preview during drag and one solve on release.
- Undo is one step by owner ruling (U5, "Two buttons", editorReducer.ts LastAction). The P1 entry
  calls for undo/redo; that conflicts with the ruling and is raised below, not assumed.

## Accepted scope (working plan)

### A. Seams (R2)
Thin line across the plank at every joint: for each weld, take the rendered port's (x, y, h) and
draw a segment of length = the narrower of the two parts' plankWidthMm, perpendicular to h, in
`--track-edge`, after all track layers and before joint hit targets. Free ends need none (the plank
ends there already). Owner: TrackCanvas.tsx + a pure helper in trackPath.ts (`seamLines`).

### B. Metric grid (R4)
Grid lines in model millimetres anchored at model (0,0), drawn first inside the flipped group so
they sit under the track. Step: see the amendments' Grid rule (on-screen cell size, steps 100 mm to 10 m). A minor/major split is not used: one weight, `--grid-line`
token (new, faint on `--floor`). Caption "Grid: 10 cm" (or 20 cm, 50 cm, 1 m, 2 m, 5 m, 10 m) as HTML text under the canvas
so it stays legible. Pure helper `gridStep(viewW, viewH)` in trackPath.ts; lines rendered as one
`<path>` (a single d string), not one element per line, to keep the tag count flat.

### C. Selection and remove any piece (R1, E5)
- EditorState gains `selected: string | null` (a pieceId).
- Rendered segments gain `pieceId` (render.ts). TrackCanvas draws an invisible hit path per
  segment at plank width, BEFORE joints and free ends, so ends and joints keep winning hit-tests
  (the existing precedence rule). Clicking selects; clicking the selected piece or empty floor, or
  Esc, deselects.
- Selected piece: outline stroke in `--ink` around the plank, plus a label beside it with the same
  text the layout list uses (`pieceName`, E5), counter-flipped like the gap figure. Announced
  through the existing polite region.
- Remove piece button (enabled only with a selection) and Delete/Backspace on a focused selection
  remove it via `deletePiece`. The layout list gets a Remove button per piece.
- Cursor after removal: kept if still free, else `resumeCursor` (same rule as undo).
- LastAction gains kind `remove`, so Undo restores the piece.
- Remove last stays (owner ruling 2026-10-22).

### D. Ghost placement (R3, E1, E2)
- EditorState gains `ghost: { partId, at: PortRef | null, frame: Frame | null, option: number } | null`.
  `at` = attach end; `frame` = a free drop position (drag, section E); `option` indexes the fitting
  orientations.
- `fitOptions(graph, ports, at, partId)` in layoutModel.ts enumerates (turn, viaPort) pairs whose
  via-port polarity is opposite the target's, deduplicated by resulting far-end frames. Option 0
  equals today's automatic choice from `orientation()`, so presets and any internal add are
  unchanged. With no attach end, options are the 16 headings x turn.
- Actions: `pick {partId}` (ghost at cursor), `rotateGhost` (option + 1 mod n), `moveGhost {ref}`
  (E2: a free-end click while a ghost is pending moves it there and moves the cursor), `placeGhost`,
  `cancelGhost`. While a ghost is pending, joining two ends is unavailable (Cancel first).
- Rendering: the hypothetical graph (addPiece with the chosen option) is rendered; the ghost's own
  segments are drawn translucent with a dashed edge.
- E1 checks on the hypothetical graph: new vertex clashes or polarity violations tint the ghost
  `--fail` with the reason in words; landing exactly on a free end says so. The words state that
  track crossing track mid-span is not checked.
- Palette: one button per part (the ↻ button goes); its click is `pick`. Place (Enter), Rotate (R),
  Cancel (Esc) appear as buttons while a ghost is pending.

### E. Drag-and-drop (E6, the P1 backlog item)
- Palette drag: pointerdown + move past 4px on a palette piece starts a ghost that follows the
  pointer (screen to model via the SVG's inverse CTM and the y-flip). Within a snap radius of a free
  end it attaches there (as moveGhost); elsewhere it is a free frame snapped to whole millimetres
  (granularity pending, P-e) at the ghost's current heading. R rotates during the drag.
- Placed drag: pointerdown + move on a piece body drags (what moves: pending, P-a). Rigid preview:
  the dragged ink moves by an SVG transform on its group; no solve and no full re-render per move.
  One solve on release.
- Release commits or leaves a pending ghost (pending, P-b). A release that creates a new connector
  clash or polarity violation is refused: the dragged thing returns, and the reason is announced.
- Keyboard parity: with a selection, arrow keys move by the snap step (Shift = 10x), R rotates by
  22.5 degrees, Delete removes (all subject to the amendments' keyboard rules). With a ghost pending,
  `[` and `]` move it between free ends.
- Touch: pointer events with `touch-action: none` on the canvas.
- Undo depth: pending (P-c).
- Auto-join on exact landing: pending (P-d).

## Spec review amendments (review 1, score 5/10; fixes below are mechanical unless marked pending)

### State transitions (ghost and selection)
Ghost and selection are mutually exclusive: `pick` clears `selected`; selecting a piece cancels a ghost.

| Action | ghost | selected | armed |
|---|---|---|---|
| breakWeld (joint click) | unavailable while a ghost is pending (Cancel first), as for joining | null | as today |
| pick | new ghost at cursor; empty layout: identity frame at the origin; non-empty with null cursor (closed loop): free frame at `nextRunAnchor` | null | null |
| rotateGhost / moveGhost | updated | null | null |
| placeGhost | null (see P-f for auto re-pick) | null | stillFree |
| cancelGhost / Esc | null | unchanged | unchanged |
| floor click while a ghost is pending | unchanged (only Esc/Cancel drop it) | null | null |
| selectPiece (no ghost pending) | n/a | set, or null when clicking the selected piece or floor | null |
| piece-body click while a ghost is pending | unchanged (ignored) | null | null |
| clickPort with a selection, no ghost | n/a | null | today's clickPort rule |
| clickPort while a ghost is pending | moveGhost (E2) | null | null |
| removePiece | null | null | stillFree |
| undo (and redo if P-c adds it) / removeLast / clear / preset | null | null if the piece no longer exists, else unchanged (clear/preset: null) | as today |
| move / drop (section E) | null | the moved piece stays selected | stillFree |

Every graph change applies `stillFree` to `armed`, so removing the armed end's piece cannot leave it stale.

**Cursor.** placeGhost at an end: the placed piece's far end (today's `select`). placeGhost from a free
frame: the placed piece's far end. removePiece: kept if still free, else `resumeCursor`. move: kept
(ports keep their identities when a run moves). Every other row: as today.

**Ghost ink is never a target.** The ghost overlay is `pointer-events: none`; only committed pieces,
free ends and joints are hit targets.

**A drag that does not finish cancels.** Release outside the canvas, `pointercancel`, or Esc mid-drag:
a moved run returns to its frame and a palette ghost is dropped. Nothing is committed and no
LastAction is written.

**The hypothetical graph is visible to TrackCanvas and the E1 check only.** The verdict, the layout list,
the bill of materials, persistence (layoutStore) and the announcements keep using the committed graph
while a ghost is pending.

A ghost whose `at` stops being free (any graph change) falls back to the cursor; with no cursor, to a
free frame at the origin's next run position (`nextRunAnchor`).

### LastAction
Kinds become `place | break | join | remove | move`. A palette drop is `place`; dragging placed track is `move`.

### addPiece signature
`addPiece(graph, partId, turn, portCount, at, ports, choice?: { port: number; turn: Turn }, anchor?: Frame)`
(today's parameters, unchanged and in order, plus two optional ones). `anchor`, when given, always
applies, including to the first piece on an empty layout (today's anchoring is skipped when
`graph.pieces.length === 0`, layoutModel.ts:136).
No `choice` keeps today's `orientation()` path exactly, so presets and Remove last are unchanged (pinned
by the existing preset and auto-flip specs, which must stay green unedited). `anchor` replaces
`nextRunAnchor` for a free drop.

### fitOptions
Returns the (port, turn) pairs whose port polarity is opposite the target's, de-duplicated by the
resulting far-end frames (a straight's left and right collapse to one), ordered with
`orientation()`'s own choice first. When none fit (B, C, B2, C2 onto the wrong end) it returns
`orientation()`'s choice as the only option, flagged `refused: true`; the ghost shows red with the
polarity reason and Rotate is disabled. n is never 0. Free (unattached) options: heading varies
first (0..15), then turn; Rotate on a free ghost steps the heading by 22.5 degrees.

### Seams
Drawn at port `a` of each weld. Skipped for a weld listed in `polarityViolations` or whose two ports do
not coincide (that joint already carries its own marker).

### Grid
Criterion is on-screen cell size, as D3 promised: steps on a 1-2-5 series [100, 200, 500, 1000, 2000,
5000, 10000] mm; pick the smallest whose cell is >= 20 CSS px, so cells stay in 20-50 px (the 2.5x
maximum ratio between steps bounds the top), from the SVG's measured width (ResizeObserver). Without a
measurement (static render, tests) fall back to <= 40 lines across the larger viewBox dimension.
Print: `@media print` keeps the grid at half the screen opacity.

### Hit-testing and keyboard
- Placed track: pointerup without crossing 4px selects; crossing 4px starts a drag. Same threshold as the palette.
- Focus target: ONE roving-tabindex group for piece bodies (one tab stop for the whole track; arrow
  keys with Alt step between pieces in listing order), each named by `pieceName`; Delete, arrows and R
  act on the selected piece. `pieceName` moves from GraphListing.tsx (private, line 93) to a shared
  export; `n` is the piece's index in `graph.pieces` + 1 and `from` comes from the exported `laidFrom`. The layout list's per-piece buttons are the
  screen-reader route.
- Ghost keys: R rotate, Enter place, Esc cancel, `[` and `]` move the ghost to the previous/next free
  end, arrow keys move a free-frame ghost by the snap step (Shift = 10x). Tab stays focus navigation.
- R on a selection rotates the P-a unit, and only if P-a resolves to "whole run"; otherwise R does
  nothing on a placed piece (E3 stays skipped).

### Drag details
- Snap radius: 24 CSS px from the pointer to a committed free end, converted to model mm at drag
  start. On snap the ghost attaches with option 0 of `fitOptions` for that end; R cycles from there.
  A dragged run snaps when one of its own free ends is within the radius of another run's free end,
  aligned so the two ends meet (heading opposite, exact lattice composition).
- Rotating a run (R while dragging it or with it selected, only if P-a = whole run): pivot at the
  selected/grabbed piece's port-0 position p, pos' = p + zeta^k (pos - p), heading' = heading + k.
  Exact because p is a lattice point.
- "Refused drop" means: any vertex clash or polarity violation that involves a port of a moved piece.
- Free-frame fit options are de-duplicated by far-end frame, like attached ones.
- `nextRunAnchor` (layoutModel.ts:84) becomes an export for the reducer's pick/fallback rows.
- Touch: `touch-action: none` also on palette piece buttons; a palette drag calls `setPointerCapture`
  so it crosses from the palette into the SVG.

### Drag rendering
- The viewBox is frozen at pointerdown and refitted on release, so the canvas never shifts under the pointer.
- During a drag the dragged ink (ghost, or the moved component) renders in a separate overlay `<g>`
  translated by `transform`; a moved component is excluded from the static layer passes for the
  drag's duration. No full re-render per pointermove.
- E1 checks run when the snap target changes and on release, not per pointermove. E1 uses the linear
  connector checks (`findVertexClashes`, `findWeldPolarityViolations`), never `solveGraph`. Budget:
  16 ms at 2,000 pieces, reported by a benchmark spec (prints the time; the hard ceiling in the
  assertion is 10x, 160 ms, so CI noise cannot fail it); over budget on R or pick, the check runs after a 150 ms
  idle debounce and the ghost shows "checking" until it lands.
- `pieceId` is added to `Segment` in engine/src/geom/fk.ts and set in render.ts; a switch's two
  segments share it and outline together.
- `touch-action: none` only on piece hit paths, free ends and the drag overlay, so the page still scrolls.

### Prerequisites of the P1 entry (brio-TODOS.md:482)
- K5's document type: the persisted `Graph` (layoutStore.ts) is the document, anchors included. Met.
- K0c: removed by R21 (brio-TODOS.md:383). Moot.
- R16 fingerprint: drag adds no verdict-affecting field; snapping is exact lattice arithmetic, so there
  is no snap epsilon to record. No change needed.

### Delivery (sequential PRs, never stacked; each merges before the next branches)
1. Seams + grid (A, B). 2. Selection, remove any piece, label (C). 3. Ghost placement, fit checks,
moving the ghost (D, E1, E2). 4. Drag of placed track with keyboard parity (E, placed). 5. Palette drag (E, palette).

### Delight-scan items
Esc clears selection: accepted (part of C). Hover highlight on piece bodies and caption-as-scale-bar:
not proposed for approval, dropped.

### Test specs (each with a mutation that is RUN)
- A seams: markup spec counts one `.seam` per weld for 3 straights (2); mutation: drop the seam loop.
- B grid: `gridStep` unit specs on the px criterion (measured widths) and on the line-count fallback, which is what jsdom and static renders use (no ResizeObserver); markup spec for one `.grid` path; mutation: return a constant step.
- C: reducer specs for remove-middle (two runs, positions unchanged, cursor rule), undo restores; DOM spec select then Remove; mutation: removePiece on lastPieceId.
- D: reducer specs for fitOptions (E on M road: 2 options; B on wrong end: 1 refused), place = old add for option 0; DOM spec pick/rotate/place; mutation: ignore `option`.
- E1: spec that a ghost overlapping another piece's end shows the clash reason (shape depends on P-d: with auto-join, an exact landing on an opposite-polarity free end is reported as "joins", not a clash); mutation: skip the check.
- E: pure specs for screen->model snap and exact translate/rotate of an anchor (lattice equality); DOM spec using pointer events for a drop onto a free end; mutation: round to 1.5mm.
- Existing DOM tests: one helper `place(user, name)` in app/test/ so the 12 call sites change once.

## Pending choices (0I will resolve)
- P-a What a drag on a placed piece moves: its whole connected run (rigid) or the piece alone (detach). The same answer decides what arrow keys and R move on a selection.
- P-b Whether a drop commits immediately or leaves a pending ghost needing Place.
- P-c Undo depth: keep one step (owner ruling U5) or multi-step undo/redo.
- P-d Whether a piece whose free end lands exactly on another free end joins it automatically, on Place and on drop.
- P-g Whether Place may commit a ghost that is red (clash or refused polarity), or is blocked like a drop.
- P-f Fast repeat building: after Place, does a new ghost of the same part appear at the new end (so Enter, Enter... builds a circle)?
- P-e Snap granularity for a free drop: 1 cm, or the visible grid step.

## Deferred
- E4 Table/room outline on the grid: to brio-TODOS.md (new persisted value, save-gate rules).

## NOT in scope
- E3 Turn round a placed piece inside a run: skipped by the user (D6:C). Rotating a whole dragged
  run (section E) is a different action and is in scope through E6.
- Plank-crossing (mid-span) overlap detection: engine gap, stays in the backlog.

## 0H document approval
Working plan and CEO summary approved as of this version (answer 2026-10-22: "A) Approve, continue").
Spec review: 3 launches, final score 6/10, last 14 issues applied and verified against the text
(issues verified: 14 of 14), spec not re-verified by a reviewer.

## 0I Temporal interrogation and pending choices

### Answered pending choices (2026-10-22)
| Row | Answer | Applied |
|---|---|---|
| P-a (D10) | A) The whole run | Drag, arrows and R on a selection move/rotate the selected piece's connected run rigidly. Pulling one piece out = break its joint first. |
| P-b (D11) | A) Drop places it | Palette drop commits (unless refused); LastAction `place`. Click still pends for Place. |
| P-c (D12) | A) Multi-step undo + redo | Supersedes owner ruling U5's one-step Undo. History stack of previous graphs, cap 50; redo stack cleared by any new edit; Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z; Remove last stays and is itself undoable. UndoControl gains Redo. |
| P-d (D13) | A) Join automatically | On Place and on drop, every exact coincidence of opposite-polarity free ends involving the new/moved piece is welded in the same edit (one undo step). Same-polarity coincidences are not welded (still refused/marked). The "8 pieces, open at both ends" expectation for a hand-built circle changes to a closed loop. |
| P-e (D14) | A) 1 cm always | Free positions round to 10 mm; headings to 22.5 degrees; arrows 1 cm, Shift 10 cm. |
| P-f (D15) | B) Clear after Place | Place ends the ghost; the next piece starts from the palette. Building 8 curves by click = 16 actions (drag = 8). |
| P-g (D16) | B) Allow | Place commits a red ghost; drop of a red ghost is refused with "Place it from the palette to keep it". |

### Implementation sequence (0I)
- HOUR 1 (foundations): `pieceId` on Segment; export `nextRunAnchor`, `pieceName`; `addPiece` optional `choice`/`anchor`; undo history stack (P-c) because every later PR writes to it.
- HOUR 2-3 (core logic): `fitOptions` + dedupe; ghost/selection reducer actions and the transition table; auto-join helper (`coincidentOpposites(graph, pieceIds)`), shared by Place and drop.
- HOUR 4-5 (integration): canvas overlay layer, viewBox freeze, pointer capture across palette and SVG, roving tabindex. Surprise risk: StrictMode double-invokes reducers, so the history stack must stay inside reducer state, never a ref.
- HOUR 6+ (polish/tests): `place(user, name)` test helper and the 12 call sites; benchmark spec for E1; print grid rule.
- Effort: human ~3 weeks / CC ~5-6 hours across five PRs.
- Feasibility blockers: none found. Watch item: auto-join changes an existing verdict expectation (cursorRoutes ROUTE 3 "8 pieces, open at both ends" was a burst of palette clicks, which under P-f B no longer place pieces; the spec is rewritten for the new flow, and the stale-closure regression it guards must stay covered at the reducer/dispatch level).

## Review sections: pending findings

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| F1 acted flag (S1/S4) | App.tsx:458 `setGraphActed(true)` on EVERY dispatch; brio-TODOS.md:1798 P2 item 1. This plan adds pick, rotate, move-ghost, cancel, select: none edit the graph, all would release a held graph save. | A: set only when the reduced graph differs, decided INSIDE the updater (EditorState carries `edited: boolean`, read by the save gate) so StrictMode and batching cannot desync it | | approved | D17 answer: "A) Fix in PR 1". Mounted spec in suppression.dom.test.tsx: pick/rotate/cancel/select leave the stored blob unchanged; Place saves. Existing suppression specs stay green unedited. |
| F2 handler throw (S2) | brio-TODOS.md:1798 P2 item 2: a throw from placeAll inside a reducer call in an event handler bypasses ErrorBoundary (frozen UI, no crash screen). Drag/drop/move/undo add many more reducer paths from pointer handlers. | A: catch in `dispatch`, store the error, rethrow during render so ErrorBoundary shows its screen and repro. BUILD FINDING (PR 1): unnecessary; React already routes an updater throw to render (react-dom `dispatchSetStateInternal` swallows eager throws). Catch removed; editFailure.dom.test.tsx pins the real hazard (computing state in the handler). Outcome D18 asked for holds. | | approved | D18 answer: "A) Route to crash screen". DOM spec with a reducer forced to throw under StrictMode; mutation: remove the catch. Lands in PR 1. |

### Section findings (no decision needed: implementation detail of approved behaviour)
- S2: `setPointerCapture` can throw; caught and treated as a drag that did not finish (approved cancel rule).
- S2: `getScreenCTM()` null: drag does not start; click paths unaffected.
- S2: save failures on quota stay as filed (brio-TODOS.md:1713), unchanged by this plan.

## Review Sections 1-11 (findings)

### S1 Architecture
```
 Palette ──pick/drag──┐                 ┌── TrackCanvas: memoized static layers (grid, track, seams,
 Keyboard ──keys──────┤                 │   piece hit paths, joints, free ends) + overlay <g> (ghost,
 Canvas pointer ──────┼─► dispatch ─► reduce(EditorState) ─► graph ─► solveGraph ─► Verdict/List/Store
                      │   (try/catch, F2) {graph, cursor, armed, selected, ghost, past[], future[], edited}
                      │                     └─ ghost ─► hypothetical graph ─► overlay + E1 checks
                      └─ edited (F1) ─► save gate ─► layoutStore
 drag session hook (pointer capture, frozen viewBox, transform preview) ── release ─► dispatch(move|place)
```
Ghost: idle -pick-> pending -(R | [ ] | arrows | end click)-> pending -Place-> idle; pending -Esc-> idle.
Piece clicks and joint actions are ignored while pending (no pending->selected edge without Esc).
Findings: F1 (approved, D17), F2 (approved, D18). Rollback: per-PR revert; storage format unchanged
(anchors already persisted), so older builds read newer layouts.

### S2 Error & Rescue: see registry below; F2 approved; capture/CTM handled inside approved cancel rule.

### S3 Security & threat model
No new network, secrets or dependencies. New inputs are pointer coordinates and keys (bounded, numeric)
and persisted anchors, which `loadGraph` already validates (a non-lattice heading is refused, see
suppression.dom.test.tsx fixture). Canvas label text comes from part names including user submissions;
rendered as React text, never HTML. No issues found.

### S4 Data flow & interaction edge cases
Flow: pointer -> screen->model (CTM) -> snap (1cm, 22.5deg, or end within 24px) -> hypothetical graph ->
E1 checks -> release -> reduce -> graph -> save gate -> localStorage. Shadow paths: CTM null (no drag),
capture throw (cancel), stale `at` (fallback to cursor), quota (pre-existing silent save failure).
Async: none. The reducer is synchronous; StrictMode double-invocation is safe because history lives in
reducer state, never a ref.

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| Keys R/Enter/Esc/Delete/arrows/[ ] | focus in an input (inventory count, Submit form) | REQUIRED (impl. of approved keyboard parity) | handlers on the canvas region and ghost controls only; Ctrl/Cmd+Z global but skipped when the target is editable, so text fields keep their own undo |
| Place | double Enter | yes | second Enter has no ghost: no-op |
| pick on empty layout | TrackCanvas returns the empty-state div when segments = 0 | REQUIRED (impl. of approved pick-on-empty) | render the SVG whenever a ghost or drag exists; palette drag onto the empty state must drop onto an SVG |
| drag | Delete/undo pressed mid-drag | REQUIRED | editor keys ignored while a drag session is live, except Esc (cancel) |
| drag | window resize mid-drag | yes | CTM read per pointermove (cheap) |
| drop | auto-join AND a clash elsewhere | yes | refused: clash rule wins (section E definition) |
| remove | only piece | yes | empty state; selection null |
| >10,000 pieces | canvas refuses to draw | yes | select/drag unavailable; layout list Remove still works |
| burst of clicks | stale closure (ROUTE 3) | REQUIRED test rewrite | burst test becomes pick+Place pairs inside one act; reducer-level spec keeps guarding `reduce(e, ...)` |

### S5 Code quality
App.tsx is 909 lines. Pointer-session code goes in `app/src/useDragSession.ts` and key handling in
`app/src/useEditorKeys.ts`, matching the existing pure-module split (editorReducer.ts, trackPath.ts).
`fitOptions` and `coincidentOpposites` stay pure in layoutModel.ts. No duplicated behaviour found:
`removePiece`, `resumeCursor`, `stillFree`, `laidFrom` are reused.

### S6 Tests
| New thing | Type | Happy | Failure | Edge |
|---|---|---|---|---|
| seams | node markup | 3 straights -> 2 seams | refused weld -> no seam | switch weld |
| grid | node unit + markup | 20px criterion picks 100mm | no measurement -> line fallback | 10m layout -> 1m+ step |
| select/remove | reducer + dom | remove middle -> 2 runs, survivors' positions identical | remove armed end's piece -> armed null | remove cursor's piece -> resumeCursor |
| ghost | reducer + dom | pick, R, Place == option-0 old add | B on wrong end -> 1 refused option, Place allowed (P-g) | empty layout, closed loop (null cursor) |
| E1 | node | ghost end on another end -> clash text | refused polarity text | exact opposite landing -> "joins" |
| auto-join | reducer | 8 hand-placed E -> closed loop, 1 undo step | same-polarity landing not welded | two coincidences in one drop |
| undo/redo | reducer | 50-step undo/redo round trip | redo cleared by new edit | 51st edit drops oldest |
| drag | node pure + dom pointer | drop on end joins | red drop refused, run returns | pointercancel, Esc mid-drag |
| F1 | dom (suppression) | pick/rotate/cancel/select write nothing | Place writes | StrictMode |
| F2 | dom | forced throw -> crash screen | | StrictMode |
| keys in inputs | dom | typing "r" in Name field does not rotate | | Ctrl+Z in a text field |
Each pin records a RUN mutation (CLAUDE.md). The 2am test: a hand-built circle of 8 E closes by
auto-join and reads as a loop after reload. Hostile QA: drag a run so one end lands peg-on-peg on
another run (refused, returns). Chaos: StrictMode + 8 pick/Place pairs in one act. Flakiness: the E1
benchmark asserts only a 160ms ceiling.

### S7 Performance
- REQUIRED (same principle as the approved rigid preview): static layers are a memoized component keyed
  on the committed `render`, so ghost, selection, rotate and hover changes re-render only the overlay.
  Without it every R press re-renders the whole canvas (453ms at 10,000 pieces).
- History: 50 structurally shared graphs; each holds its own anchors Map (roots only). Bounded.
- Slowest new paths: E1 on R/pick (linear checks, debounced over budget), auto-join scan (linear over
  ports of moved pieces, via a position-keyed map), release of a large run (one anchor rewrite + one solve).

### S8 Observability
Client-only app, no telemetry by design. User-facing observability: every new action is announced in
the polite region (U7b decision: pick, rotate, place, cancel, select, remove, move, undo/redo, auto-join
"joined to piece N"), and `describeAction` gains those cases. Debuggability: the crash screen's repro
(repro.ts) already serializes anchors, so a moved layout reproduces. F2 makes handler-path crashes reach it.

### S9 Deployment & rollout
Static build, no migrations. Five sequential PRs, each revertable alone. No feature flag: each PR is a
complete behaviour. Post-merge check per PR: `bun run test`, `bun run typecheck`, `bun run build`, then
a browser pass (/qa) on the changed interaction.

### S10 Long-term trajectory
Reversibility 4/5 (P-c supersedes U5 and auto-join changes a verdict expectation; both revertable).
Debt: stale docblocks listed in the Stale Diagram Audit; App.tsx size (mitigated by the two hooks).
Phase 2: E4 table outline on the grid; mid-span overlap narrowphase; multiple components P1 entry is
largely satisfied by free drops at lattice origins (update that entry). Platform: selection + ghost +
lattice snapping are the base for any later reposition/rotate feature.

### S11 Design & UX
```
 [empty] --pick/drag--> [ghost pending] --Place/drop--> [layout] --click piece--> [selected]
    ^                        |  ^ R, [ ], arrows, end click        |  Delete/Remove -> [layout]
    |                        |--Esc--> [layout]                    |--drag--> [dragging] --release--> [layout]
    +------ clear / remove all ------------------------------------+--Esc--> [layout]
```
States: ghost OK (translucent, dashed edge), ghost red (fail colour + words, never colour alone),
"checking" (debounce), selected (ink outline + label), dragging (overlay, frozen view). Ghost controls
(Rotate, Place, Cancel) sit in the palette controls row, which is within reach on the narrow layout;
44px minimum targets. The grid is decorative (non-text, WCAG 1.4.11 does not require 3:1 for it).
Recommend: /plan-design-review before implementation (significant UI scope); /design-review after.

## Outside voice (Codex gpt-6-astra, completed): findings ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| OV1 removal moves survivors (engine, edit.ts) | Codex reproduced: Near miss preset, delete p4, p5-p9 move 72 mm. Mechanism (edit.ts:33-46 read): captureAnchors pins component ROOTS; a declared weld whose ends do not meet was a non-tree (closing) edge, and after removal it becomes a tree edge, so the far side is re-placed through it. Same mechanism applies to breakWeld on a non-closing loop today. Plan line "survivors do not move" is false for loops that do not close exactly. | A: on remove AND break, any remaining weld whose ends did not meet before the edit and would become a tree edge is broken in the same edit, announced, one undo step | | approved | D19 answer: "A) Break unmet joins". Spec: Near miss, delete p4, every survivor frame identical; same for breakWeld; mutation: skip the break. Lands in PR 2 (and fixes today's breakWeld). |
| OV2 same-polarity drop refusal undetectable (feasible.ts:422, :493) | findVertexClashes exempts a single free-end pair; findWeldPolarityViolations reads existing welds only | plan used those two checks | FACTUAL CORRECTION, no behaviour change: a candidate-aware `connectorConflicts(graph, ports, pieceIds)` over a position-keyed map of ALL ports; a moved/ghost port sharing a position with any port it is not welded to is a conflict unless it is an auto-join pair | approved (implements approved refusal, section E) | Implements D11/D16 refusal as approved; no new behaviour |
| OV3 clash records name only two representative ports (feasible.ts:308) | third piece on an existing pile is missed by filtering records | plan filtered clash records by moved ids | FACTUAL CORRECTION: same `connectorConflicts` query (full site membership) replaces the filter, for drop refusal and E1 | approved (as OV2) | as OV2 |
| OV4 auto-join lacks heading condition (model.ts:25) | Codex reproduced: perpendicular straights meeting peg-to-socket; welding rotates one 90 degrees | A: auto-join needs equal position, opposite polarity AND opposed headings; any other coincidence is a conflict | | approved (reopens D13, narrows it) | D20 answer: "A) Require facing ends". Spec: perpendicular peg-on-socket not welded, reported; mutation: drop the heading test. |
| OV5 cursor after auto-join | auto-join can consume the far end the cursor rule names | "far end" / "kept" | FACTUAL CORRECTION: every cursor row normalizes against the final graph: `stillFree(cursor) ?? resumeCursor(graph)`, the rule the owner ruled for manual joins (2026-10-22, editorReducer.ts:313) | approved (existing ruling) | owner ruling 2026-10-22 on joins |
| OV6 keyboard placement focus | focus stays on the palette button after Pick, so R/Enter go to the wrong target | unspecified | FACTUAL CORRECTION (implements approved keyboard parity): Pick moves focus to the ghost controls group; Place, Cancel and Esc return it to the palette button that started the pick; DOM test starts from real palette focus | approved (implements D1/E6 keyboard parity) | |

## Approval readiness
Checked rows and their answers: R1 (D2:A), R2 (direct instruction, request 2), R3 (D1:A), R4 (D3:A),
E1 (D4:A), E2 (D5:A), E5 (D8:A), E6 (D9:B), P-a (D10:A), P-b (D11:A), P-c (D12:A), P-d (D13:A as
narrowed by D20:A), P-e (D14:A), P-f (D15:B), P-g (D16:B), F1 (D17:A), F2 (D18:A), OV1 (D19:A),
OV4 (D20:A); OV2/OV3/OV5/OV6 are factual corrections implementing approved behaviour (D11/D16 refusal,
owner join ruling 2026-10-22, D1/E6 keyboard parity). E3 skipped (D6:C) and E4 deferred (D7:A) are
outside accepted work. Section-level REQUIRED items (keys in inputs, SVG on empty layout, keys during
drag, memoized static layers, pointer-capture cancel) implement approved behaviour and add none.
Approval readiness: PASS

## Reality rows
Premise table:
| premise | claim | receipt | verdict |
|---|---|---|---|
| removal engine exists | removePiece drops piece, welds, anchor | engine/src/graph/edit.ts:68 | verified |
| survivors stay put | captureAnchors pins roots only | engine/src/graph/edit.ts:33 | FALSE for non-closing loops (OV1, fixed by D19) |
| ports carry heading | RenderedPort.h | engine/src/graph/render.ts:40 | verified |
| Segment lacks pieceId | Segment fields | engine/src/geom/fk.ts:32 | verified |
| orientation auto-flip | port of opposite polarity, flips turn | app/src/layoutModel.ts:170 | verified |
| addPiece skips anchor on empty layout | `graph.pieces.length > 0` | app/src/layoutModel.ts:136 | verified |
| acted flag on every dispatch | setGraphActed(true) | app/src/App.tsx:458 | verified |
| clash records two representatives | findVertexClashes | engine/src/graph/feasible.ts:308 | per Codex, not re-read |
| 453ms at 10k pieces | measured table in comment | app/src/TrackCanvas.tsx:237 | cited baseline [re-measure before gate] |
| 72mm jump on Near miss | Codex reproduction | engine/src/graph/edit.ts:33 | reported by Codex, not re-run here |
unverified=2

REALITY: premise-table finding survivor-stays-put premise false for non-closing loops, fixed by D19 engine/src/graph/edit.ts:33
REALITY: already-done pass no commits on origin/main since the ask touch the named files app/src/editorReducer.ts:1
REALITY: surface-check pass no CLI commands or HTTP routes; named functions exist (removePiece, orientation, resumeCursor) app/src/editorReducer.ts:171
REALITY: binding-decisions finding plan reopens owner ruling U5 one-step Undo, resolved by D12 app/src/editorReducer.ts:111
REALITY: numbers finding 453ms is a cited baseline [re-measure before gate]; 72mm [reported by Codex, not re-run]; 16ms budget [estimated] app/src/TrackCanvas.tsx:237
REALITY: deferred-asks pass no linked issue; user asks 1-4 all in scope, E4 deferred with reason docs/plan/brio-TODOS.md:486
REALITY: pr-count finding no ship-policy file, default one PR per wave; plan uses five sequential PRs by approved delivery split, queue cost five review cycles docs/plan/2026-10-22-editing-and-canvas.md:1
REALITY: units pass no existing input changes units or accuracy; the new 10mm snap quantum only rounds new free positions, and no existing threshold consumes it engine/src/geom/cyclotomic.ts:23
REALITY: perf-table finding no branch-vs-base perf table yet; E1 benchmark and canvas re-render must be measured in PR 3 and PR 4 app/src/TrackCanvas.tsx:237

## NOT in scope
- E3 Turn round a placed piece inside a run: skipped (D6:C), user declined.
- E4 Table/room outline: deferred (D7:A) to brio-TODOS.md, needs a new persisted value.
- Mid-span plank crossing detection: existing engine gap, stays in the backlog (overlap narrowphase entry).
- Pulling one piece out of a run by dragging: not chosen (D10:A whole run); break a joint first.
- Auto re-pick after Place: declined (D15:B).

## What already exists
- removePiece / deletePiece / captureAnchors (edit.ts, layoutModel.ts): reused for remove-any; extended by D19.
- orientation() auto-flip (layoutModel.ts:170): option 0 of fitOptions.
- resumeCursor / stillFree (editorReducer.ts): reused for every cursor row.
- LastAction previous-graph snapshot (editorReducer.ts): generalised into the 50-step history.
- laidFrom / pieceName (GraphListing.tsx): shared for the canvas label.
- Anchors persistence and repro serialization (layoutStore.ts, repro.ts): moved layouts persist and reproduce unchanged.
- Polite announcement region and describeAction (announce.ts): extended with new actions.

## Dream state delta
```
 CURRENT                         THIS PLAN                               12-MONTH IDEAL
 append-only, invisible joints,  select/remove any, seams, metric grid,  + table outline (E4), mid-span
 one-step undo, place-then-see   ghost with fit checks, drag runs,       overlap check, zoom/pan with
                                 50-step undo/redo, auto-join            virtualised canvas, build sheet
```

## Error & Rescue Registry
| Method/codepath | Failure | Class | Rescued | Action | User sees |
|---|---|---|---|---|---|
| reduce via dispatch (all edits) | placeAll throws | Error (frames.ts) | Y (D18) | catch, rethrow in render | crash screen with repro |
| fitOptions | stale `at` | none | Y | fall back to cursor | ghost moves to cursor |
| fitOptions | no fitting port | none | Y | single refused option | red ghost with reason |
| useDragSession screen->model | getScreenCTM null | null | Y | drag not started | click still works |
| useDragSession capture | setPointerCapture throws | DOMException | Y | cancel drag | piece returns |
| drop guard | conflict at moved ports | none (connectorConflicts) | Y | refuse, return | announced reason |
| remove/break (D19) | unmet join would steer placement | none | Y | break it in same edit | announced, undoable |
| E1 check | over budget | time | Y | 150ms debounce | "checking" |
| saveGraph | quota | QuotaExceededError | N (pre-existing, TODOS:1713) | none | silent (unchanged) |

## Failure Modes Registry
```
  CODEPATH            | FAILURE MODE                 | RESCUED? | TEST? | USER SEES?          | LOGGED?
  --------------------|------------------------------|----------|-------|---------------------|--------
  dispatch            | engine throw in handler      | Y        | Y     | crash screen        | console + repro
  remove/break        | survivors jump (non-closing) | Y        | Y     | nothing moves       | announced
  auto-join           | crossed coincidence welded   | Y (D20)  | Y     | red/conflict        | announced
  drop guard          | third piece on a pile missed | Y (OV3)  | Y     | refused             | announced
  acted flag          | browse overwrites original   | Y (D17)  | Y     | nothing written     | n/a
  keys                | R typed in a text field      | Y        | Y     | text typed normally | n/a
  ghost on empty      | ghost invisible (no SVG)     | Y        | Y     | ghost shown         | n/a
  saveGraph quota     | save fails                   | N        | N     | Silent              | N   (pre-existing, filed)
```
The quota row is pre-existing and filed (brio-TODOS.md:1713); this plan does not touch it, so it is
not counted as a new critical gap.

## Scope Expansion Decisions
CEO plan: ~/.gstack/projects/brio-designer/ceo-plans/2026-10-22-editing-and-canvas.md
- Accepted: E1, E2, E5, E6
- Deferred: E4
- Skipped: E3

## Diagrams produced
System architecture (S1), data flow with shadow paths (S4), ghost state machine (S1), user flow (S11),
error flow (Error & Rescue Registry), deployment sequence (Delivery: 5 sequential PRs), rollback
(per-PR revert; storage format unchanged).

## Stale Diagram Audit
- TrackCanvas.tsx layer-loop comment ("every joint would show a seam that is not there"): STALE after PR 1, rewrite.
- TrackCanvas.tsx header ("the track is the only texture on screen", "no drag yet"): STALE after PR 1/4.
- editorReducer.ts EditorState docblock (two selections) and LastAction docblock ("One step, not a history", U5): STALE after PRs 2-3.
- edit.ts captureAnchors docblock: must describe the D19 unmet-join break.
- CLAUDE.md test section: unaffected.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific finding above. Run with
Claude Code or Codex; checkbox as you ship. Ratios: features ~30x, tests ~50x, architecture ~5x.

- [ ] **T1 (P1, human: ~1d / CC: ~30min)** — App/dispatch — Set the graph acted flag only on a real graph change, and route reducer throws to ErrorBoundary
  - Surfaced by: S1/S2 — F1 (D17), F2 (D18)
  - Files: app/src/App.tsx, app/src/editorReducer.ts, app/src/suppression.dom.test.tsx, app/src/App.dom.test.tsx
  - Verify: bun run test; mutations (flag on every dispatch; remove catch) fail the new specs
- [ ] **T2 (P1, human: ~1d / CC: ~30min)** — TrackCanvas — Seams at joints and the metric grid with caption
  - Surfaced by: R2, R4, review amendments (Seams, Grid)
  - Files: app/src/TrackCanvas.tsx, app/src/trackPath.ts, app/src/app.css, app/src/tokens.css, app/src/trackPath.test.ts, app/src/trackCanvasPolarity.test.ts
  - Verify: bun run test; mutations listed in Test specs A/B
- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — engine + reducer — Select any piece, remove it, label it; break unmet joins on remove/break
  - Surfaced by: R1, E5, OV1 (D19)
  - Files: engine/src/geom/fk.ts, engine/src/graph/render.ts, engine/src/graph/edit.ts, app/src/editorReducer.ts, app/src/TrackCanvas.tsx, app/src/GraphListing.tsx, app/src/App.tsx, app/src/announce.ts, app/src/editorReducer.test.ts, new app/src/pieceRemoval.dom.test.tsx
  - Verify: Near miss delete p4 leaves every survivor frame identical; DOM select+Remove spec
- [ ] **T4 (P1, human: ~1d / CC: ~30min)** — reducer — 50-step undo/redo replacing one-step LastAction
  - Surfaced by: P-c (D12)
  - Files: app/src/editorReducer.ts, app/src/UndoControl.tsx, app/src/editorReducer.test.ts
  - Verify: undo/redo round trip, redo cleared by edit, cap at 50
- [ ] **T5 (P1, human: ~3d / CC: ~1.5h)** — ghost — pick/rotate/move/place/cancel, fitOptions, connectorConflicts, auto-join with heading condition, focus transitions
  - Surfaced by: R3, E1, E2, P-d (D13+D20), P-f, P-g, OV2, OV3, OV5, OV6
  - Files: app/src/layoutModel.ts, app/src/editorReducer.ts, app/src/TrackCanvas.tsx, app/src/App.tsx, new app/test/place.ts helper, the 5 DOM test files with Add call sites, new app/src/placement.dom.test.tsx
  - Verify: Test specs D/E1; hand-built 8 E closes and survives reload
- [ ] **T6 (P1, human: ~4d / CC: ~1.5h)** — drag (placed) — useDragSession, run move/rotate, refusal, keyboard parity, memoized static layers
  - Surfaced by: E6, P-a, P-e, S4, S7
  - Files: new app/src/useDragSession.ts, new app/src/useEditorKeys.ts, app/src/TrackCanvas.tsx, app/src/editorReducer.ts, new app/src/drag.test.ts, new app/src/drag.dom.test.tsx
  - Verify: exact lattice translate/rotate specs; pointer DOM spec; pointercancel/Esc spec
- [ ] **T7 (P1, human: ~2d / CC: ~1h)** — drag (palette) — palette drag with pointer capture, drop commits, touch-action on palette
  - Surfaced by: E6, P-b
  - Files: app/src/App.tsx, app/src/useDragSession.ts, app/src/app.css, app/src/drag.dom.test.tsx
  - Verify: drop onto a free end joins; red drop refused with message
- [ ] **T8 (P2, human: ~2h / CC: ~10min)** — docs — Rewrite the stale docblocks in the Stale Diagram Audit, each in the PR that invalidates it
  - Surfaced by: Stale Diagram Audit
  - Files: app/src/TrackCanvas.tsx, app/src/editorReducer.ts, engine/src/graph/edit.ts
  - Verify: review diff

## Completion Summary
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SCOPE EXPANSION                             |
  | System Audit         | removal exists in engine; no seams by design;|
  |                      | acted flag on every dispatch; no overlap    |
  |                      | narrowphase; drag P1 trigger fired          |
  | Step 0               | R1-R4 approved; E1,E2,E5,E6 added; E3 skip; |
  |                      | E4 defer; P-a..P-g answered; U5 superseded  |
  | Section 1  (Arch)    | 1 issue found (F1, resolved)                |
  | Section 2  (Errors)  | 9 error paths mapped, 1 GAP (F2, resolved)  |
  | Section 3  (Security)| 0 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 9 edge cases mapped, 0 unhandled            |
  | Section 5  (Quality) | 1 issue found (App.tsx size -> 2 hooks)     |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 1 issue found (memoized static layers)      |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 0 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 2           |
  | Section 11 (Design)  | 0 issues; /plan-design-review recommended   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 9 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 8 total, 0 CRITICAL GAPS (1 pre-existing)   |
  | TODOS.md updates     | 1 item added (E4), 2 entries annotated      |
  | Scope proposals      | 6 proposed, 4 accepted                      |
  | CEO plan             | written                                     |
  | Outside voice        | codex completed, 6 findings, 6 resolved     |
  | Lake Score           | N/A (no coverage-scored questions)          |
  | Diagrams produced    | 7 (arch, data flow, state, user flow, error,|
  |                      | deploy, rollback)                           |
  | Stale diagrams found | 4                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 9/9 rows, 2 unverified                      |
  +====================================================================+
```

### Unresolved Decisions
None.

## Eng review (plan-eng-review, 2026-10-22)

Target: docs/plan/2026-10-22-editing-and-canvas.md (this file, CEO-cleared). Report file: this file.

### Scope Challenge A: assessment
- Existing code per sub-problem: removal (edit.ts:68 removePiece), unmet-join detection (frames.ts:169
  `placement.forest.closing` lists the non-tree welds, so D19 can be computed from placeAll(before)
  and placeAll(next) without new engine traversal), orientation (layoutModel.ts:170), cursor
  (editorReducer.ts resumeCursor/stillFree), history (LastAction.previous), naming (GraphListing laidFrom).
- Complexity [estimated]: ~32 changed files (engine 4, app source 10, new source 2, modified tests 10,
  new tests 5, TODOS 1) and 2 new modules (useDragSession, useEditorKeys). Gate trips (8+ files, 2+ new modules).
- Search: pointer capture + SVG getScreenCTM is the standard browser approach for SVG drag [Layer 1];
  no library needed (no new dependency). Search unavailable for fresh results; in-distribution knowledge only.
- TODOS cross-reference: P1 drag entry (now IN PLAN), P2 acted-flag/handler-throw entry (now PR 1),
  E4 deferred entry added. Nothing in TODOS blocks this plan.
- Distribution: no new artifact; static vite build unchanged.

### Scope Challenge B: scope record
feature answers: none asked (no cuts proposed; every feature is an explicit CEO-review answer, D1-D20 of that review); structure: A) Original arrangement (eng D1, 2026-10-22); accepted scope: the CEO-cleared plan as written, with useDragSession.ts and useEditorKeys.ts as two modules; pending remedies: none.

### Scope Challenge C: findings
1. [P2] (confidence: 9/10) app/src/editorReducer.test.ts:418-421 — "`actionsFrom` writes the other action kinds out by hand, so an `EditorAction` variant added later is never constructed and the walk passes blind." The plan adds pick, rotateGhost, moveGhost, placeGhost, cancelGhost, selectPiece, removePiece, move and redo. Required proof of the approved transition table: every new action joins `actionsFrom`, and the walk asserts the table's invariants (ghost and selected never both set; armed implies cursor; a pending ghost's `at` is free). How to keep the walk affordable is a Section 3 choice.
2. [P3] (confidence: 8/10) app/src/editorReducer.ts `{ kind: 'add' ... }` — with R3 the palette dispatches `pick`; `placeGhost` with option 0 is today's `add`. Correction: retire `add` from EditorAction (presets call `addPiece` directly, editorReducer.ts preset branch), migrating its reducer specs to pick+placeGhost. No behaviour change.
3. D19 detection already exists: engine/src/graph/frames.ts:169-181 `residuals` returns `closes` for every closing weld. Rule: after removePiece/removeWeld, remove every surviving weld that was a closing weld with `closes: false` in placeAll(before) and is a tree edge in placeAll(next). removePiece/removeWeld return `{ graph, opened: Weld[] }` so the reducer can announce what opened. Correction (implements D19), no new choice.
Dispositions: 1 accepted as required proof (method pending, Section 3); 2 accepted as correction; 3 accepted as correction.
Scope Challenge result: scope accepted as-is.

Reality rows (eng): the CEO section's premise table stands (unverified=2: Codex's clash-record claim and 72mm reproduction).
REALITY: premise-table finding survivor-stays-put false for non-closing loops; detection available via residuals engine/src/graph/frames.ts:169
REALITY: already-done pass no origin/main commits since the ask touch the named files app/src/editorReducer.ts:1
REALITY: surface-check pass no CLI flags or routes; named engine functions verified (residuals, placeAll, removeWeld) engine/src/graph/frames.ts:163
REALITY: binding-decisions pass CEO decisions D1-D20 and U5 supersession logged; nothing in branch decisions contradicts the plan docs/plan/2026-10-22-editing-and-canvas.md:1
REALITY: numbers finding walk cost 27,515 nodes at depth 4 [measured: app/src/editorReducer.test.ts:412]; 453ms render [re-measure before gate: app/src/TrackCanvas.tsx:237]; ~32 files [estimated] app/src/editorReducer.test.ts:412
REALITY: deferred-asks pass no linked issue; E4 deferred with reason docs/plan/brio-TODOS.md:486
REALITY: pr-count finding no ship-policy, default one PR per wave; five sequential PRs approved by the owner, five review cycles of queue cost docs/plan/2026-10-22-editing-and-canvas.md:1
REALITY: units pass no existing input changes units; 10mm snap applies only to new free positions engine/src/geom/cyclotomic.ts:23
REALITY: perf-table finding no base/branch perf table yet; required in PR 3 (ghost) and PR 4 (drag) app/src/TrackCanvas.tsx:237

### Section 1: Architecture
REVISED after a probe (see ENG-R5): one issue found. The original text below said no issues.
Original: No issues found. Moving a run rewrites one root anchor by an exact lattice transform; auto-join welds only coincident, opposed ends, so the merged forest places both runs where they already were; the hypothetical graph reaches only the overlay and E1; F2 (D18) routes engine throws to ErrorBoundary.

## Decision ledger (eng)

### ENG-R1: one shared "ends at each spot" map in the engine
Finding: 4, P2, confidence 8/10, engine/src/graph/feasible.ts:108-175, reviewer: Claude (eng review)
Plan baseline: OV2/OV3 correction "a candidate-aware `connectorConflicts(graph, ports, pieceIds)` over a position-keyed map of ALL ports" and `coincidentOpposites` in app/src/layoutModel.ts (CEO review corrections); location unspecified beyond layoutModel.
Runtime evidence: findVertexClashes builds `placed[]` with `portFrame(...).pos` and groups by `latticeKey(pos)` (feasible.ts:121-175); latticeKey is module-private (feasible.ts:97).
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| connectorConflicts / coincidentOpposites behaviour | approved (OV2/OV3, D20) | unchanged | unchanged |
| Where the position map is built | inside findVertexClashes only | one exported engine helper `connectorSites(graph, ports, placement)` in feasible.ts, used by findVertexClashes, connectorConflicts and coincidentOpposites | each new function builds its own map in app/src/layoutModel.ts |
| Position keying | latticeKey (exact) | latticeKey for all three | must re-implement or export latticeKey |
| Lines (implementation, estimated) | n/a | ~25 removed, ~35 added, saves ~15 net and avoids ~50 duplicated | ~60 added |
Question D2:
D2 — ENG-R1: Should the three "ends at the same spot" checks share one engine map?
Project/branch/task: brio-designer on main; eng review of the editing plan, code quality.
ELI10: The verdict already finds track ends sitting on the same spot (findVertexClashes, feasible.ts:108) with an exact position key. The plan adds two more checks of the same kind: the drop/ghost conflict check and auto-join. If they build their own maps in app code, a small keying difference would let the ghost say "fits" while the verdict says "clash".
Stakes if we pick wrong: the preview and the verdict disagree about the same layout, which is the trust this app is built on.
Recommendation: A because one exact keying for every caller removes a whole class of disagreement and saves code; shared code with three proven callers.
Note: options differ in kind, not coverage — no completeness score.
Net: a small engine export versus duplicated position logic in the app.
Header: Ends map
Options:
A) Shared engine helper (recommended)
Export `connectorSites(graph, ports, placement)` from feasible.ts (full membership per lattice point); findVertexClashes, connectorConflicts and coincidentOpposites all use it; existing clash specs must stay green unedited. Effort human ~3h / CC ~15min, risk low. ✅ Ghost, drop guard and verdict cannot disagree on what shares a spot. ✅ Net fewer lines; one spec file covers the shared contract. ❌ Touches findVertexClashes, which carries hard-won performance work, so its measured specs must be rerun.
B) Separate maps in the app
connectorConflicts and coincidentOpposites build their own maps in layoutModel.ts. Effort human ~3h / CC ~15min, risk medium. ✅ findVertexClashes is untouched. ✅ App helpers stay next to their only callers. ❌ Two copies of the position logic that must stay identical to the engine's, with nothing forcing them to.

State: approved
Actual answer: A) Shared engine helper (eng D2, 2026-10-22)
Accepted scope: export `connectorSites(graph, ports, placement)` from engine/src/graph/feasible.ts with full port membership per lattice point; findVertexClashes, connectorConflicts and coincidentOpposites all build on it (connectorConflicts and coincidentOpposites live in feasible.ts beside it); existing clash specs and measured performance specs stay green unedited; one shared-contract spec.
History: none

### Section 2: Code quality (findings)
- [P2] (confidence: 8/10) engine/src/graph/feasible.ts:108-175 — three callers need exact same-spot membership. Disposition: approved, ENG-R1 (eng D2:A).
- [P3] (confidence: 8/10) app/src/announce.ts — describeAction must name every new action (U7b decision: every piece, end and joint action announced). Required by an existing decision; carried into T3/T5/T6.
- Stale docblocks: already tasked (T8). No other issues.

### ENG-R2: keeping the reducer state walk affordable once nine actions join it
Finding: 1 (Scope Challenge), P2, confidence 9/10, app/src/editorReducer.test.ts:411-467, reviewer: Claude (eng review)
Plan baseline: Scope Challenge finding 1 accepted as required proof (new actions join `actionsFrom`; table invariants asserted); method pending.
Runtime evidence: today 27,515 nodes at depth 4 in 117ms (measured: `bunx vitest run app/src/editorReducer.test.ts -t "every state reachable"`, 2026-10-22), 1,708 distinct states (comment, editorReducer.test.ts:415). With `add` replaced by pick+placeGhost, depth 4 reaches only two placements; branching grows about 2.5x [estimated], so a naive depth-4 walk is ~1M nodes, ~4s [estimated], and depth 6 is out of reach.
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| New actions in actionsFrom; table invariants asserted | approved (SC finding 1) | yes | yes |
| Walk strategy | naive DFS, depth 4 | breadth-first over DISTINCT states (key: pieces, welds, anchors, cursor, armed, selected, ghost, history depth), depth 6 | naive DFS, depth 4 |
| Placements reachable | 4 (via add) | 3 (pick+place pairs) plus edits | 2 |
| Runtime | 117ms | under 2s [estimated], asserted with a generous ceiling | ~4s [estimated] |
| Mutation proof | run, recorded | rerun and recorded | rerun and recorded |
Question D3:
D3 — ENG-R2: How should the reducer's every-state walk handle nine new actions?
Project/branch/task: brio-designer on main; eng review, test review of editorReducer.test.ts:411.
ELI10: A test walks every sequence of up to four editor actions and checks the editor never contradicts itself. Placing a piece now takes two actions (pick, Place), so four actions only reach two pieces, and nine new actions make the walk about 2.5 times wider per step. Most visited states are repeats (1,708 distinct out of 27,515 today), so walking only distinct states lets it go deeper for less time.
Stakes if we pick wrong: either the walk silently covers less than it does today, or the suite slows by seconds.
Recommendation: A because it keeps (and deepens) today's coverage at a lower cost; complete coverage for marginal effort.
Completeness: A=9/10, B=6/10
Net: a small change to the walk buys depth 6 instead of a shallower, slower walk.
Header: State walk
Options:
A) Distinct states, depth 6 (recommended)
Breadth-first over distinct state keys to depth 6, all new actions included, invariants of the transition table asserted; record node and distinct counts and the run mutation. Effort human ~3h / CC ~15min, risk low. ✅ Reaches three placements plus edits, more than today. ✅ Faster than a naive walk because repeats are skipped. ❌ The state key must include every field or the walk skips states that differ, so the key needs its own spec.
B) Same walk, depth 4
Keep the naive depth-4 walk and just add the new actions. Effort human ~1h / CC ~5min, risk medium. ✅ Smallest change to a test that already works. ✅ No key to get wrong. ❌ Covers only two placements (less than today) and costs about 4 seconds per run.

State: approved
Actual answer: A) Distinct states, depth 6 (eng D3, 2026-10-22)
Accepted scope: breadth-first walk over distinct state keys (pieces, welds, anchors, cursor, armed, selected, ghost, history depth) to depth 6 with every new action in actionsFrom; asserts armed implies cursor, never ghost and selected together, a pending ghost's `at` is free; records node and distinct counts; a spec pins the state key (two states differing only in each field are distinct); mutation run and recorded; generous runtime ceiling.
History: none

### ENG-R3: regression contract for existing editor behaviour
Finding: 5, CRITICAL (regression rule), confidence 9/10, existing specs app/src/cursorRoutes.dom.test.tsx:40-122, app/src/suppression.dom.test.tsx:86-184, app/src/reload.dom.test.tsx, app/src/editorReducer.test.ts (preset and auto-flip specs), reviewer: Claude (eng review)
Plan baseline: D17 "existing suppression specs stay green unedited"; CEO S4 required ROUTE 3 rewrite; D13 intentionally changes the hand-built 8-E circle from open to closed.
Runtime evidence: 12 "Add Large curve" call sites in 5 DOM files assume one-click placement (grep, 2026-10-22).
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| Behaviour preserved | implicit | cursor routes 1-2, reload cursor, suppression (all 4 specs), presets, auto-flip, Remove last, joint break: assertions unchanged; only the "how to place" step changes, through one `place(user, name)` helper | each spec rewritten as needed |
| Intentional changes | D13, ROUTE 3 | 8 hand-placed E reads as a closed loop (new expectation, cites D13); ROUTE 3 becomes 8 pick+Place pairs in one act and still fails under the `reduce(editor, ...)` mutation | same, unlisted |
| Acceptance | none stated | every existing assertion string kept verbatim except the two intentional changes; each touched spec's mutation rerun and its recorded message updated | suite green |
Question D4:
D4 — ENG-R3: How should existing editor tests be protected while placement changes?
Project/branch/task: brio-designer on main; eng review, regression rule for 5 DOM test files and the reducer specs.
ELI10: Placing a piece goes from one click to pick-then-Place, so 12 places in 5 test files that click "Add Large curve" must change. The danger is that while rewriting them, an assertion that guards an old bug (a lost cursor, a save that fires too early) gets weakened and nobody notices.
Stakes if we pick wrong: a fixed bug like "the next piece starts a separate run" comes back with every test green.
Recommendation: A because it changes only the placing step and keeps every guarding assertion word for word, so a regression cannot hide in the rewrite.
Completeness: A=10/10, B=6/10
Net: a strict, listed contract versus trusting a large rewrite.
Header: Regressions
Options:
A) Keep assertions verbatim (recommended)
One `place(user, name)` helper replaces the 12 clicks; every existing assertion stays word for word except two listed, intentional changes (hand-built 8-E circle closes per D13; ROUTE 3 becomes 8 pick+Place pairs in one act); every touched spec's mutation is rerun and its recorded failure message updated. Effort human ~4h / CC ~20min, risk low. ✅ A weakened assertion shows up as a diff line, not a quiet edit. ✅ The bug-history comments stay true because their mutations are rerun. ❌ More review attention on test diffs in PR 3.
B) Rewrite specs as needed
Update the tests however the new flow requires, with the suite green as the bar. Effort human ~3h / CC ~15min, risk medium. ✅ Freedom to restructure awkward tests. ✅ Slightly less work. ❌ A guarding assertion can be weakened during the rewrite and the suite still passes.

State: approved
Actual answer: A) Keep assertions verbatim (eng D4, 2026-10-22)
Accepted scope: one `place(user, name)` helper in app/test/ replaces the 12 one-click placements; every existing assertion string kept verbatim except (1) hand-placed 8-E circle now reads as a closed loop (D13) and (2) ROUTE 3 becomes 8 pick+Place pairs in one act, still failing under the `reduce(editor, ...)` mutation; every touched spec's mutation rerun and recorded message updated.
History: none

### Section 3: Test review
Framework: vitest, two projects (CLAUDE.md "## Testing": node `*.test.ts`, dom `*.dom.test.tsx`).

```
CODE PATHS (proposed)                                   USER FLOWS
[+] engine/src/graph/feasible.ts                         [+] Remove any piece
  ├── connectorSites()      [PLANNED ★★★] shared spec      ├── [PLANNED ★★★] select -> Remove (dom)
  ├── connectorConflicts()  [PLANNED ★★★] pile of 3, pair   ├── [PLANNED ★★★] list Remove button (dom)
  └── coincidentOpposites() [PLANNED ★★★] facing/crossed   └── [PLANNED ★★]  Delete key on focused piece
[+] engine/src/graph/edit.ts                             [+] Ghost placement
  ├── removePiece/removeWeld + opened unmet joins           ├── [PLANNED ★★★] pick, R, Place, Esc from palette focus
  │   └── [PLANNED ★★★] Near miss p4: frames identical      ├── [PLANNED ★★★] red ghost placed (P-g), refused option
[+] app/src/layoutModel.ts                                 ├── [PLANNED ★★]  [ ] moves between free ends
  ├── fitOptions() dedupe / refused / free headings        └── [PLANNED ★★]  empty layout ghost visible
  │   └── [PLANNED ★★★] E on M road 2, B wrong end 1      [+] Drag
  └── addPiece(choice, anchor) [EXISTING ★★★ + extend]     ├── [PLANNED ★★★] [→E2E-ish dom] drop on free end joins
[+] app/src/editorReducer.ts                               ├── [PLANNED ★★★] red drop refused, run returns
  ├── transition table      [PLANNED ★★★] walk depth 6     ├── [PLANNED ★★]  pointercancel / Esc mid-drag
  ├── undo/redo history     [PLANNED ★★★] 50 cap, redo cut └── [PLANNED ★★]  keys ignored mid-drag
  └── edited flag (F1)      [PLANNED ★★★] suppression dom  [+] Error states
[+] app/src/App.tsx dispatch try/catch (F2)                ├── [PLANNED ★★★] forced throw -> crash screen (StrictMode)
  └── [PLANNED ★★★] dom                                    └── [PLANNED ★★]  typing "r" in a text field does nothing
[+] TrackCanvas seams/grid/overlay/memo
  ├── [PLANNED ★★★] seams count, refused weld no seam
  ├── [PLANNED ★★★] gridStep px criterion + fallback
  └── [GAP → covered by S4 perf spec] memo: R press does not re-render static layers
[+] useDragSession / useEditorKeys  [PLANNED ★★★] dom + pure snap specs

COVERAGE (planned): 27/27 paths have a planned test; existing tests at risk: 5 DOM files + reducer specs (ENG-R3)
```

Tests made obsolete: none deleted; ROUTE 3 rewritten (ENG-R3); `add` reducer specs migrate to pick+placeGhost (SC finding 2).
Regression contract: ENG-R3 (D4:A). Walk: ENG-R2 (D3:A). LLM/eval scope: none (no prompt files).
Dispositions: ENG-R2 approved, ENG-R3 approved; all other tests are required proof of approved behaviour.

### ENG-R4: how the ghost is computed on each R press, end move and snap change
Finding: 6, P1, confidence 8/10, plan section D "Rendering: the hypothetical graph (addPiece with the chosen option) is rendered", reviewer: Claude (eng review)
Plan baseline: section D (approved with R3/E1): render the hypothetical graph; E1 checks run on snap change/release, debounced over a 16 ms at 2,000 pieces budget.
Runtime evidence: building the hypothetical graph means placeAll + renderGraph over every piece (engine/src/graph/frames.ts:70), O(n) per keypress; placeAll cost at 10,000 pieces is unmeasured (unknown); the canvas markup alone is 453 ms at 10,000 (TrackCanvas.tsx:237, cited). The exact O(1) alternative exists: `frameForPortAt(local, opposed(portFrame(at)))` (engine/src/graph/model.ts:261, frames.ts:48) gives the ghost's frame, and the conflict check can query a `connectorSites` map memoized on the committed graph (ENG-R1).
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| What the user sees and the checks report | approved (R3, E1, D20, P-g) | unchanged | unchanged |
| Ghost frame | hypothetical graph placed in full | O(1) from the committed placement via frameForPortAt; free ghost from its snapped frame | hypothetical graph placed in full per change |
| E1 check | debounced over budget | O(ports of the ghost) lookups in the memoized committed sites map; no debounce needed | full checks on the hypothetical graph, 150 ms debounce over budget |
| Full graph built | per change | once, on Place/drop | per change and on Place |
| Proof | none | spec: ghost frame equals the placed piece's frame after Place for every fitOptions option (exact equality); benchmark reports R-press cost at 10,000 pieces | benchmark as planned |
Question D5:
D5 — ENG-R4: Should the ghost be computed from the one piece, not by re-laying the whole layout?
Project/branch/task: brio-designer on main; eng review, performance of ghost placement (plan section D).
ELI10: Each time you press R or move the ghost, the plan re-lays every piece of the layout to show one translucent piece. On a big layout that is slow and the plan answers with a "checking" delay. The engine already has the exact formula to put one piece at one end (frameForPortAt), and the "anything else at this spot?" question can be a lookup in a map built once per real edit.
Stakes if we pick wrong: on large layouts rotating the ghost lags, or the ghost and the placed piece disagree.
Recommendation: A because it makes every ghost update constant-time with the same exact arithmetic the engine uses, and a spec proves ghost and placed piece are identical; explicit and cheaper.
Note: options differ in kind, not coverage — no completeness score.
Net: a small exact shortcut with a proof spec versus whole-layout work per keypress.
Header: Ghost cost
Options:
A) One-piece ghost (recommended)
Ghost frame from frameForPortAt over the committed placement; E1 conflicts looked up in the memoized connectorSites map; the full graph is built only on Place/drop; spec asserts ghost frame equals the placed frame for every option; benchmark reports R cost at 10,000 pieces. Effort human ~4h / CC ~20min, risk low. ✅ R and end moves stay instant at any layout size; no "checking" state needed. ✅ The equality spec makes preview and result provably the same. ❌ Two code paths compute a frame (ghost and Place), held together only by that spec.
B) Whole layout per change
Keep the plan as written: build and place the hypothetical graph per change, debounce E1 over budget. Effort human ~3h / CC ~15min, risk medium. ✅ One code path: the ghost is literally the placed result. ✅ Nothing extra to keep in sync. ❌ Every R press costs a full re-lay of the layout, and large layouts show a "checking" delay.

State: approved
Actual answer: A) One-piece ghost (eng D5, 2026-10-22)
Accepted scope: ghost frame computed with frameForPortAt over the memoized committed placement (free ghost: its snapped frame); E1 conflicts are lookups in the memoized connectorSites map of the committed graph; the full graph is built only on Place/drop; the 150 ms debounce and "checking" state are dropped; spec asserts the ghost frame equals the placed piece's frame for every fitOptions option; benchmark reports R-press cost at 10,000 pieces.
History: none

### Section 4: Performance (findings)
- [P1] (confidence: 8/10) plan section D, hypothetical graph per change. Disposition: approved, ENG-R4 (eng D5:A).
- [P2] (confidence: 8/10) app/src/TrackCanvas.tsx — memoized static layers (CEO S7 required item) need a proof: a dom spec counting static-layer renders shows R, end moves and selection do not re-render them; mutation: drop the memo. Required proof of the approved rigid-preview principle.
- Memory: history 50 graphs, structurally shared; connectorSites map one per committed graph (O(ports)). Bounded.
- No N+1/DB concerns (client-only, no queries).

### Outside voice (eng phase)
Unavailable: `codex exec` hit the five-minute limit (exit 124) without a final report; the native Plan
fallback produced no report before its five-minute timer and was stopped (TaskStop succeeded). No
outside coverage for this phase; nothing from either partial run is credited.

### ENG-R5: an exact join can still move a run that holds a gappy loop
Finding: 7, P1, confidence 9/10, engine/src/graph/forest.ts:13 ("declaration order and each piece's welds in declaration order") and frames.ts:70, reviewer: Claude (eng review, own probe)
Plan baseline: D13 auto-join as narrowed by D20 (equal position, opposite polarity, opposed headings); plan S1 claimed "the merged forest places both runs where they already were"; D19 covers remove and break only.
Runtime evidence: probe `bun <scratchpad>/joinprobe.ts` (2026-10-22): run A (one straight) moved so its end exactly meets, facing, the spare road of a switch inside run B, a loop whose closing weld misses by 389.2 mm. `weldEnds` + `placeAll`: p6 moves 610.6 mm, p7 590.6 mm, p8 507.0 mm, each turned 2 steps. Mechanism: the forest walks each component from its first-declared piece; after the join B is entered at the switch, so a different weld becomes the gappy non-tree edge. The same happens today for a manual two-end join.
Comparison grid:
| Commitment | Current | A | B | C |
|---|---|---|---|---|
| Auto-join on Place/drop (D13, D20) | joins whenever ends meet facing | joins only if no other piece's frame would change; otherwise not joined, shown as a conflict with "joining here would shift N pieces of a loop that does not close" | joins; engine keeps every piece where it was | joins; announce "N pieces moved" |
| Remove/break (D19) | open unmet joins | unchanged (D19) | unchanged (D19) | unchanged (D19) |
| Manual join (click two ends) | may jump, as today | unchanged, but announced with the moved count | no jump | unchanged, announced |
| Engine change | none | none (compare placeAll before/after for the edit's pieces) | forest prefers the previous tree edges (forest.ts), changes which weld carries a loop's gap | none |
| Proof | none | probe becomes a spec: join at the mid-loop switch is not auto-joined and nothing moves; mutation: skip the frame comparison | same probe as a spec: nothing moves | spec: announcement count |
Question D6:
D6 — ENG-R5: An exact join into a loop that doesn't close can make track jump. What should auto-join do?
Project/branch/task: brio-designer on main; eng review, reopens auto-join (CEO D13/D20) with a probe.
ELI10: I proved with a probe that joining two ends that meet exactly, facing each other, can still move other track by about 600 mm, when one side contains a loop whose ends don't meet (like the Near miss preset). The engine lays each run starting from where it was entered, and the join changes that entry point. So "the ghost shows exactly what you get" breaks for these layouts.
Stakes if we pick wrong: a drop or Place that looked harmless sends part of a loop across the floor.
Recommendation: A because it keeps the promise "what you see is what you get" with no engine change, using one before/after frame comparison the D19 work already needs.
Note: options differ in kind, not coverage — no completeness score.
Net: refuse the rare risky auto-join versus rewriting how the engine lays out loops.
Header: Join jump
Options:
A) Skip risky auto-joins (recommended)
Auto-join (Place and drop) welds only when no other piece's frame changes; otherwise the landing shows as a conflict with the reason, and the user can still join by clicking both ends, which is announced with the count of moved pieces. Effort human ~4h / CC ~20min, risk low. ✅ The ghost and the drop preview stay exact for every layout. ✅ No engine change; reuses the before/after comparison D19 needs. ❌ On layouts with a gappy loop, the auto-join you approved will not happen at those spots.
B) Engine keeps old tree
Change spanningForest to prefer the previous tree edges so no join or edit ever moves existing track. Effort human ~2d / CC ~1.5h, risk high. ✅ Fixes the jump everywhere, including today's manual joins. ✅ Auto-join behaves exactly as approved. ❌ Changes which joint the verdict reports as the gap on such loops, and touches the most-tested engine code.
C) Allow and announce
Keep auto-join as approved; when pieces move, announce "N pieces moved". Effort human ~1h / CC ~5min, risk medium. ✅ Smallest change. ✅ Auto-join always happens. ❌ The preview lies on these layouts and track jumps on a drop.

State: approved
Actual answer: A) Skip risky auto-joins (eng D6, 2026-10-22)
Accepted scope: auto-join on Place and drop welds only when no other piece's frame changes (placeAll before/after over the edit); otherwise the landing is a conflict with the reason "joining here would shift N pieces of a loop that does not close"; manual two-end joins unchanged but announced with the moved-piece count; probe becomes a spec (mid-loop switch join not auto-joined, nothing moves; mutation: skip the comparison). Reconciled with ENG-R4: the ghost stays O(1) except when its landing end belongs to a component that has a non-closing loop (memoized from `residuals` on the committed graph), where the full before/after check runs once per snap change.
History: reopens CEO D13 (auto-join) as narrowed by D20; D13/D20 otherwise unchanged.

### TODO decisions (eng)
- D7 (ENG-R6): A) Add to TODOS.md — "A manual join can re-lay a loop that does not close" filed as P2 (docs/plan/brio-TODOS.md:493).

Approval readiness: PASS
Checked rows: ENG-R1 (eng D2:A), ENG-R2 (eng D3:A), ENG-R3 (eng D4:A), ENG-R4 (eng D5:A), ENG-R5 (eng D6:A, reopening CEO D13/D20), ENG-R6 (eng D7:A); structure (eng D1:A). Scope Challenge findings 2 and 3 are factual corrections implementing CEO D1/R3 and D19; finding 1's required proof is ENG-R2. Section 2 announce item and Section 4 memo proof are required proof of existing decisions (U7b; CEO S7). No deferred or unanswered remedy is inside accepted work.

### Eng review outputs

#### NOT in scope (eng)
- Stable spanning forest for manual joins: deferred to TODOS (D7) because it changes verdict internals; D6's guard covers auto-joins.
- Everything listed in the CEO "NOT in scope" section stands.

#### What already exists (eng additions)
- `residuals(...).closes` (frames.ts:163) detects unmet joins for D19; reused, not rebuilt.
- `frameForPortAt` / `opposed` / `compose` (model.ts:246-268) give the ghost frame exactly (ENG-R4).
- `findVertexClashes`' lattice grouping becomes `connectorSites` (ENG-R1): ~25 lines moved out, ~35 added, saves ~15 net and avoids ~50 duplicated [estimated].
- The every-state walk (editorReducer.test.ts:434) is extended, not replaced (ENG-R2).

#### Diagrams
```
 Edit that must not move track (remove, break, auto-join, drop-join)
   graph ──► placeAll(before) ──┐
   edit  ──► next ──► placeAll(next) ──► compare frames of untouched pieces
                                   ├─ none moved ──► commit
                                   ├─ remove/break moved ──► open unmet joins (D19) ──► recompute ──► commit, announce
                                   └─ auto-join moved ──► do not weld; conflict "would shift N pieces" (D6)
 Ghost (ENG-R4): committed placement ──► frameForPortAt(local, opposed(portFrame(at))) ──► overlay
                 connectorSites(committed) ──► conflicts / facing-landing lookup ──► red / "joins"
                 landing component has a gappy loop? ──► full before/after check once per snap change
```
Inline diagram to add in code: edit.ts docblock (the before/after rule above), forest.ts docblock (entry-point dependence, linking the D7 TODO).

#### Failure modes (eng additions)
| Codepath | Failure | Test | Handling | User sees |
|---|---|---|---|---|
| auto-join into gappy-loop run | pieces re-laid | probe spec (ENG-R5) | skip weld, conflict | red ghost / refused drop with reason |
| manual join into gappy-loop run | pieces re-laid | announce spec | announced, undoable | "N pieces moved" |
| state walk key incomplete | distinct states merged, walk blind | key spec (ENG-R2) | n/a | n/a (test-only) |
| ghost frame vs placed frame drift | preview lies | equality spec over all options (ENG-R4) | n/a | n/a if green |
Critical gaps: 0.

#### Worktree parallelization strategy
Sequential implementation, no parallelization opportunity: the owner's rule is one PR at a time, each merged before the next branches (never stacked), and PRs 2-5 all touch app/src/editorReducer.ts and app/src/TrackCanvas.tsx.

### Implementation Tasks (eng additions; CEO T1-T8 above stand)
- [ ] **T9 (P1, human: ~4h / CC: ~20min)** — engine — Export `connectorSites`; move findVertexClashes onto it; add connectorConflicts and coincidentOpposites beside it
  - Surfaced by: Section 2 — ENG-R1 (eng D2:A)
  - Files: engine/src/graph/feasible.ts, engine/test (shared-contract spec)
  - Verify: existing clash and performance specs green unedited; new shared-contract spec with run mutation
- [ ] **T10 (P1, human: ~4h / CC: ~20min)** — engine/app — One before/after frame comparison for remove, break (D19) and auto-join (D6); announce moved/opened
  - Surfaced by: Scope Challenge 3, ENG-R5 (eng D6:A)
  - Files: engine/src/graph/edit.ts, app/src/layoutModel.ts, app/src/editorReducer.ts, app/src/announce.ts
  - Verify: Near miss p4 spec; mid-loop switch join probe spec; mutations skip each guard
- [ ] **T11 (P1, human: ~3h / CC: ~15min)** — tests — Distinct-state walk to depth 6 with every new action and the table invariants
  - Surfaced by: Section 3 — ENG-R2 (eng D3:A)
  - Files: app/src/editorReducer.test.ts
  - Verify: node/distinct counts recorded; key spec; arming mutation still fails it
- [ ] **T12 (P1, human: ~4h / CC: ~20min)** — tests — `place(user, name)` helper; existing assertions verbatim except the two listed changes; rerun mutations
  - Surfaced by: Section 3 — ENG-R3 (eng D4:A)
  - Files: app/test/place.ts, the 5 DOM test files, app/src/editorReducer.test.ts
  - Verify: git diff of test files shows only placement-step lines and the two intentional expectation changes
- [ ] **T13 (P1, human: ~4h / CC: ~20min)** — ghost — O(1) ghost frame and sites lookup; equality spec; R-press benchmark
  - Surfaced by: Section 4 — ENG-R4 (eng D5:A)
  - Files: app/src/layoutModel.ts, app/src/App.tsx, app/src/TrackCanvas.tsx
  - Verify: ghost frame equals placed frame for every option; benchmark prints R cost at 10,000 pieces
- [ ] **T14 (P2, human: ~1h / CC: ~5min)** — reducer — Retire the `add` action; migrate its specs to pick+placeGhost
  - Surfaced by: Scope Challenge 2
  - Files: app/src/editorReducer.ts, app/src/editorReducer.test.ts
  - Verify: bun run typecheck; specs green
PR placement: T9, T13, T14 and T12 in PR 3; T10 in PR 2 (remove/break) and PR 3 (auto-join); T11 in PR 2, extended in PR 3.

### Unresolved decisions
None.

### Completion summary (eng)
- Step 0: Scope Challenge — scope accepted as-is (structure A, two input modules)
- Reality rows: 9/9 applicable rows emitted (PLAN_REALITY complete), 2 unverified premises
- Architecture Review: 1 issue found (ENG-R5, after probe)
- Code Quality Review: 2 issues found (ENG-R1; announce coverage)
- Test Review: diagram produced, 2 gaps identified (ENG-R2 walk, ENG-R3 regression contract)
- Performance Review: 2 issues found (ENG-R4; memo proof)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item proposed to user (added)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex, unavailable (5-minute limit); native fallback unavailable (no report within 5 minutes)
- Parallelization: 1 lane, 0 parallel / 5 sequential
- Lake Score: 1/2 (ENG-R3 chose its 10/10 option; ENG-R2 offered no 10/10 option, its chosen option scored 9)

## Design review (plan-design-review, 2026-10-22)

Initial rating 5/10. DESIGN.md exists; all decisions calibrated against its ten rules and tokens.css.
Mockups: not generated (designer has no OpenAI key). Outside voices: Codex completed (7 findings,
no hard rejections), Claude design subagent completed.

### Design decisions
- **1A Placing strip** (approved): while a ghost is pending, a full-width strip on the canvas's bottom
  edge, above the verdict band: "Placing: <part name> (<code>)", the status line (glyph + sentence),
  Rotate (R), Cancel (Esc), and Place (Enter) as the one filled `.primary` button. Removed when no
  ghost is pending. Replaces the plan's "buttons in the palette controls row".
- **2A Run outline + selection strip** (approved): the selected piece gets the strong outline and its
  label; the rest of its connected run gets a quiet thin outline. The canvas-edge strip (same slot as 1A,
  never both at once) shows "Piece 4: Large curve (E), r182 · run of 12 pieces" with Remove piece,
  Rotate run (R), and four arrow buttons labelled "Move run" (screen-reader names "Move run left 1 cm"
  etc.). Gives touch a route to move and rotate.
- **3A Verdict scope prefix** (approved): while a ghost is pending the verdict sentence (visible and
  announced) is prefixed "Placed track:"; the ghost's status lives only in the Placing strip.
- **4A Empty layout** (approved): the empty floor keeps today's panel and its one action. Picking a
  piece or starting a palette drag swaps the panel for the canvas with grid, caption and the ghost at
  the origin, framed at a fixed 1 m x 0.6 m view; Cancel with no pieces returns to the panel.
- **5A View frozen while placing** (approved): when a ghost appears the view freezes at the fit of
  placed track plus one piece-length of margin on every side; it refits once on Place or Cancel. The
  grid step and caption freeze with it. (Extends the approved drag freeze.)
- **6A Refused drop becomes a pending ghost** (approved, reopens CEO P-g/D16 for palette drops only): a
  refused palette drop leaves a red ghost at the drop position and orientation, with the conflict
  sentence and glyph in the Placing strip and Place / Cancel as usual; a drop still never commits a red
  piece. A refused move of placed track snaps back, and the reason shows in the selection strip until
  the next action. The message "Place it from the palette to keep it" is retired.
- **7A Over the drawing limit** (approved): above CANVAS_SEGMENT_CEILING the palette buttons are disabled
  with one line in the palette: "Placing is paused: too much track to draw. Remove pieces in the layout
  list to continue."; per-piece Remove in the list and Undo/Redo still work; no selection or drag.
- **8A Undo/Redo copy** (approved): "Undo place", "Undo place and join", "Undo remove", "Undo move",
  "Undo join", "Undo break", and "Redo ..." likewise; disabled accessible names "Nothing to undo" /
  "Nothing to redo".
- **9A Double-click places** (approved): double-clicking a palette piece places it at the cursor in
  option 0 with no ghost, one Undo step, auto-join under D6; single click keeps pick-then-Place;
  Shift+Enter on a focused palette button does the same; button title "Double-click to place directly".
- **10A Mark vocabulary** (approved; all strokes `vector-effect: non-scaling-stroke`):
  | Mark | Spec | Distinct from |
  |---|---|---|
  | Ghost, OK | part's wood layers at opacity `--ghost-opacity` (0.5) + 1.5px SOLID `--ink` edge on both plank sides | cursor ring (dashed) |
  | Ghost, red | same fill + 2px solid `--fail` edge; glyph and sentence in the Placing strip | clash marker (ring + X) |
  | Selected piece | 2px solid `--ink` line along both plank edges | armed ring (3px, stays heaviest) |
  | Rest of its run | 1px solid `--ink-soft` along both plank edges | selected piece (weight) |
  | Piece label | `.num` 13px `--ink`, 3px `--floor` halo (`paint-order: stroke`), off the piece midpoint along its outward normal, counter-flipped | gap figure (Pass 7 placement) |
- **11A Seam colour** (approved): new token `--seam: #6e5a38` in tokens.css, comment with measured ratios
  (3.69:1 on --track-fill, 1.75:1 on --track-groove, 5.31:1 on --floor; WCAG relative luminance,
  2026-10-22); seam drawn 1.5px non-scaling across the full plank width. Replaces "--track-edge" in A.
- **12A Grid colour** (approved): new token `--grid-line: #d8cfbe` (1.24:1 on --floor), comment
  "decorative: below 3:1 by design; the caption carries the scale in words (WCAG 1.4.11 does not
  apply)"; 1px non-scaling; print at 50% opacity of the same token.
- **13A No new motion** (approved): snaps, refused returns, Place, auto-join, Undo/Redo and the strips
  appearing are instant; only dragged ink follows the pointer. Stylesheet spec asserts no
  transition/animation on the new classes.
- **14A Ghost status, three channels** (approved): in the Placing strip, an aria-hidden glyph then a
  sentence. Red: "X" in --fail + e.g. "Ends would clash with piece 7. You can still place it." / "Peg
  meets peg here. You can still place it." / "Joining here would shift 3 pieces of a loop that does
  not close." OK: "O" glyph + "Fits here." or "Joins piece 1." Always followed by "Track crossing
  mid-piece is not checked." in --ink-soft. The status line is its own polite live region, separate
  from the verdict.
- **15A DESIGN.md update in PR 1** (approved): replace "What is NOT settled" with the shipped keyboard
  state (U7a/U7b); add rule 11 "Preview and selection marks" (ghost solid edge at --ghost-opacity, never
  dashed; selection by weight; dashed means the cursor only); add a rule-5 note for documented
  decorative exceptions (the grid); note canvas-edge strips as the home of mode controls.
- **16A Touch** (approved): under `(pointer: coarse)` each piece's invisible hit stroke is
  max(plank width, 44 CSS px converted to mm at the current scale); free ends and joints keep
  precedence; a touch drag starts only on the already-selected piece (first tap selects, page still
  scrolls); ambiguous taps fall back to the layout list.
- **17A Piece focus mark** (approved): `.piece-hit:focus { outline: none }`; `:focus-visible` draws a 2px
  --ink dotted line (dasharray 1 3, round caps, non-scaling) along both plank edges; focus and
  selection may show together; stylesheet spec pins it.
- **18A Flip (F)** (approved): for curves and switches the Placing strip shows Flip (F), swapping
  left/right turn; Rotate (R) cycles only the remaining options (headings for a free ghost, which end
  goes on at an attach point); straights show no Flip. Eng impact: fitOptions splits turn from the
  other option dimension; the ENG-R4 ghost/placed equality spec covers flipped options too.
- **19A Strips under 1000px** (approved): below 1000px, row 1 = name + status sentence (full width,
  wraps as text), row 2 = buttons with Place last and widest; at 1000px+ one row with the status taking
  the free space; 44px coarse floor kept; Move run arrows as a compact 2x2 cluster.
- **20A OK glyph in ink** (approved): the OK status "O" glyph and sentence are --ink; only the red "X"
  spends colour (--fail). Green stays reserved for the layout verdict (DESIGN.md rule 3).
- **21A Label fallback** (approved): label on the outward side; if its box overlaps a gap figure or
  leaves the view, the inward side; if both fail, no canvas label (the selection strip names the
  piece). Gap figures never move.

### Interaction state table (design)
```
  FEATURE          | EMPTY                          | IN PROGRESS                    | ERROR / REFUSED                         | SUCCESS                      | PARTIAL / LIMIT
  -----------------|--------------------------------|--------------------------------|-----------------------------------------|------------------------------|--------------------------------
  Placing (ghost)  | panel until pick; then canvas,  | Placing strip: name, O/X status,| X + scoped sentence, "You can still    | ghost becomes track; strip   | over 10,000 pieces: palette
                   | grid, ghost at origin (4A)      | Rotate, Flip, Cancel, Place;   | place it"; Place enabled (P-g, 14A)    | closes; view refits (5A)     | paused with reason (7A)
                   |                                | view frozen (5A)               |                                         |                              |
  Palette drop     | same as above                   | ghost follows pointer          | refused drop -> pending red ghost (6A) | placed, one undo step        | same as above
  Selection        | n/a                             | selection strip, run outline   | refused move snaps back, reason in     | moved run stays selected     | over limit: list Remove only
                   |                                 | (2A), focus mark (17A)         | strip until next action (6A)           |                              |
  Remove piece     | n/a                             | n/a                            | unmet join opened: announced (D19)      | "Undo remove" (8A)           | n/a
  Verdict band     | unchanged                       | "Placed track:" prefix (3A)    | unchanged                               | unchanged                    | unchanged
  Grid             | hidden on the empty panel (4A) | frozen while placing (5A)      | n/a                                     | caption "Grid: 10 cm"        | print at 50% (12A)
```

### Journey storyboard (design, Pass 3)
```
 STEP | USER DOES                         | USER FEELS              | PLAN SPECIFIES?
 1    | Opens app, empty floor            | invited, one clear move | yes (panel, Circle preset; 4A)
 2    | Clicks "Large curve"              | curious                 | yes (ghost + Placing strip, 1A/4A)
 3    | Presses R or F                    | in control              | yes (fit options, Flip 18A; view frozen 5A)
 4    | Ghost turns red with a reason     | warned, not blamed      | yes (14A)
 5    | Place                             | progress                | yes
 6    | Builds 8 curves into a circle     | flow                    | yes (double-click 9A)
 7    | Last curve joins automatically    | delight                 | yes (D13/D20/D6)
 8    | Removes a wrong piece             | relief, nothing jumps   | yes (2A, D19)
 9    | Drags a run on the centimetre grid| mastery                 | yes (E6, 5A, 16A on touch)
```

### NOT in scope (design)
- Visual mockups: the designer had no OpenAI key; decisions are text-specified. Run /design-review after PR 1 and PR 3 on the live build.
- A dark theme: excluded by DESIGN.md rule 6 (dec-2508388b).

### What already exists (design)
- DESIGN.md rules 1-10 and tokens.css (every new colour arrives there with its ratio: --seam, --grid-line, --ghost-opacity).
- Port ring vocabulary (app.css:981-1021) and `.port:focus-visible` (app.css:1023): the new marks are defined against them.
- `.primary` button style (app.css:1121) for Place; `.palette-controls button` sizing and the coarse 44px floor (app.css:482, :866).
- The verdict glyph grammar (O, /\, X, ?) reused for the ghost status.

### Implementation Tasks (design additions)
- [ ] **T15 (P1, human: ~3h / CC: ~15min)** — tokens/DESIGN.md — Add --seam, --grid-line, --ghost-opacity with measured ratios; update DESIGN.md (15A)
  - Surfaced by: Pass 5 — 11A, 12A, 15A
  - Files: app/src/tokens.css, DESIGN.md, app/src/trackCanvasPolarity.test.ts (stylesheet specs)
  - Verify: stylesheet specs read the tokens and assert the last matching declaration; ratios recomputed in the comment
- [ ] **T16 (P1, human: ~1d / CC: ~45min)** — App/TrackCanvas — Placing strip and selection strip on the canvas edge, two-row layout under 1000px
  - Surfaced by: Pass 1/6 — 1A, 2A, 3A, 19A
  - Files: app/src/App.tsx, app/src/app.css, new app/src/PlacingStrip.tsx, new app/src/SelectionStrip.tsx
  - Verify: dom specs for strip content, verdict prefix, button order; manual at 900px and 1200px
- [ ] **T17 (P1, human: ~4h / CC: ~20min)** — TrackCanvas — Mark vocabulary, focus mark, label fallback, no transitions
  - Surfaced by: Pass 4/6/7 — 10A, 13A, 17A, 21A
  - Files: app/src/TrackCanvas.tsx, app/src/app.css, app/src/trackPath.ts, stylesheet and markup specs
  - Verify: markup specs per mark class; stylesheet spec asserts no transition/animation on new classes
- [ ] **T18 (P1, human: ~4h / CC: ~20min)** — states — Empty-to-canvas swap, frozen view while placing, refused drop to pending ghost, over-limit pause, undo/redo copy
  - Surfaced by: Pass 2 — 4A, 5A, 6A, 7A, 8A
  - Files: app/src/App.tsx, app/src/TrackCanvas.tsx, app/src/UndoControl.tsx, app/src/editorReducer.ts
  - Verify: dom specs per state, including StrictMode
- [ ] **T19 (P1, human: ~4h / CC: ~20min)** — input — Double-click/Shift+Enter places, Flip (F), touch 44px hits and select-then-drag
  - Surfaced by: Pass 3/6 — 9A, 16A, 18A
  - Files: app/src/App.tsx, app/src/useEditorKeys.ts, app/src/useDragSession.ts, app/src/layoutModel.ts
  - Verify: dom specs; manual on a tablet
- [ ] **T20 (P1, human: ~2h / CC: ~10min)** — copy — Ghost status sentences and glyphs (14A, 20A), own live region
  - Surfaced by: Pass 5/7 — 14A, 20A
  - Files: app/src/PlacingStrip.tsx, app/src/announce.ts
  - Verify: dom spec reads glyph, sentence and footnote; aria-hidden glyph
PR placement: T15 in PR 1; T16-T18, T20 in PR 3 (selection strip parts in PR 2); T19 split across PR 3 (double-click, Flip) and PR 4 (touch).

### TODOS.md updates (design)
None: every finding was decided in scope; mockups are covered by running /design-review on the live build.

## Design Review Completion Summary
```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (rules 1-10); UI scope:   |
  |                      | canvas, palette, list, undo controls        |
  | Step 0               | 5/10 initial; all 7 dimensions              |
  | Pass 1  (Info Arch)  | 4/10 -> 9/10 after fixes                    |
  | Pass 2  (States)     | 6/10 -> 9/10 after fixes                    |
  | Pass 3  (Journey)    | 5/10 -> 8/10 after fixes                    |
  | Pass 4  (AI Slop)    | 6/10 -> 9/10 after fixes                    |
  | Pass 5  (Design Sys) | 4/10 -> 9/10 after fixes                    |
  | Pass 6  (Responsive) | 5/10 -> 9/10 after fixes                    |
  | Pass 7  (Decisions)  | 2 resolved, 0 deferred                      |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (2 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated (no designer API key), 0 approved |
  | Decisions made       | 21 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 4/10 -> 8/10                                |
  +====================================================================+
```
Plan is design-complete. Run /design-review after implementation for visual QA.

### Unresolved Decisions (design)
None.

## Build notes

### PR 1 (merged as #26)
See the F2 row: the crash-screen catch was unnecessary and removed; a spec pins the real hazard.

### PR 2 (select and remove any piece, multi-step Undo/Redo, D19)
- D19 built in `engine/src/graph/edit.ts` (`openUnmetJoins`): Near miss, every remove and every break
  leaves all survivor frames identical; the mutation that skips it moves 8 pieces on removing p1.
- Walk depth (ENG-R2): measured 10.5s and 378,088 states at depth 6 against the under-2s estimate;
  the owner chose depth 5 (46,730 states, 1.3s), 2026-10-22. The key uses history DEPTH, as approved;
  keying history contents ran out of memory.
- Found by the walk: `clickPort` armed a JOINED end (after the Circle preset). Now a stale-click no-op.
- Found by the remove-any specs: `stillFree` read a removed piece's ends as free, leaving the cursor or
  armed end on a deleted piece. Now checks the piece exists.
- Found in the browser: the selection label centred on its clearance point ran back across the
  plank; it is now pushed out by half its own size.
- Copy changes that follow approved decisions: Undo/Redo labels per 8A ("Undo place", "Undo remove",
  "Nothing to undo"); Remove last's announcement now names the piece.

### PR 3 (ghost placement)
- ENG-R1 built: `connectorSites` and `landingOf` in engine/src/graph/feasible.ts; findVertexClashes
  builds on the same map (its clash and timing specs unchanged and green).
- `add` is kept, not retired (SC finding 2 superseded by 9A): it is the double-click / Shift+Enter
  direct placement, and it auto-joins under D6 like Place.
- Rotate cycles the options of the current turn (often only one for a curve, so R is disabled there);
  Flip swaps the turn (18A).
- The D6 spec's first version declared the joining straight after the loop and passed for the wrong
  reason: a join only re-lays a gappy loop when it changes the entry point of the forest walk.
- Place announces "Added piece N" (not "Placed"), so every existing announcement assertion stays
  verbatim (ENG-R3).
- ROUTE 3 became eight double-clicks in one act: Place's button exists only after a render, so
  eight pick+Place pairs cannot come from one render as ENG-R3 first described.
- Found in the browser: the "Placed track:" prefix sat in its own grid cell under the glyph (now inside
  the sentence), and a long status pushed Place onto its own row at 960px (strip now one row).
- The preview's fit check runs a full simulated placement only when an end would join (eng D6 allowed
  this only for a gappy loop's component; joins are rare and the check is linear).
- Not covered by a spec: the over-the-drawing-limit pause (7A) needs 10,001 pieces to reach.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR | 6 proposals, 4 accepted, 1 deferred |
| Outside Review | codex (gpt-6-astra) via `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review` | Independent 2nd opinion | 7 | CEO: completed; eng: unavailable; design: completed | CEO: 6 findings, 6 resolved. Eng: 5-minute limit, no completed external review. Design: 7 findings, all resolved by decisions 1A-21A |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 5 | ISSUES OPEN (all resolved) | 7 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | CLEAR | score: 4/10 → 8/10, 21 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex plan-review: CEO phase completed (6 findings); eng phase unavailable (timeout); design phase completed (7 findings, no hard rejections) alongside a Claude design subagent.
- **CROSS-MODEL:** Design phase: Codex and the Claude subagent agreed on the missing glyph, unmeasured contrast, touch targets, view stability and control placement; Codex alone raised run-vs-piece scope and refused-drop recovery; the subagent alone raised the empty-layout ghost, fast repeat building and mark collisions. All resolved.
- **VERDICT:** CEO + DESIGN CLEARED. Eng review complete with 7 resolved findings (logged issues_open because issues were found); design decisions 10A, 18A and 6A touch eng-reviewed contracts (fitOptions dimension, refused-drop flow) and are noted for the implementer.

NO UNRESOLVED DECISIONS
