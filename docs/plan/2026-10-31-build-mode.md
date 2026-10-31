# Build mode and the printable sheet

Status: CEO review in progress (2026-10-31). Source spec: `docs/plan/2026-10-06-brio-track-designer.md:1779-1820` (D3, G1, G2, printed sheet). Backlog entry: `docs/plan/brio-TODOS.md` "P2 — 3D viewer, build mode and the printable sheet".

## What it is

**Build mode** turns a finished layout into a step-by-step walkthrough for putting the real track together on the floor. One step per piece, in the order `assemblyOrder` gives (floor, then ramps, then raised track; under before over; every piece clips onto one already down). Each step shows the layout so far with the next piece highlighted where it goes, the piece's name and BRIO code large enough to read at 60cm, and a small "Step 12 of 34". Tap anywhere for the next step; swipe back for the previous one; the step survives closing the app.

**The printable sheet** is the same order on paper, for building without a screen: drawings that survive greyscale, with a sentence where a loop closes by bending (D7; no per-joint marks).

## Settled before this review (not reopened)

- D3 (2026-10-06): build mode is one of the two designed surfaces.
- G1: next piece dominant (~70% of the frame), name and part code legible at 60cm, step position small, the whole screen advances; no navigation chrome, menus or verdict line.
- G2: swipe back for the previous step, no visible back button.
- 13A: tight-joint warnings inline at the step where that joint is seated, never a persistent banner. *Amended by D7:* one loop-level sentence, not a per-joint warning.
- 3D viewer D2/D3 (2026-10-31): build mode and the sheet were deferred until the viewer existed; it now does.
- This review, D1 (2026-10-31): review from the existing spec, no /office-hours.

## Pre-review audit

- **Reuse available.**
  - `assemblyOrder(graph, segments)` in `engine/src/graph/assembly.ts:59`: steps carry pieceId, partId, phase, level and the pieces each one joins. It has no UI reader yet.
  - `buildScene(...).pieceRanges` in `engine/src/view3d/mesh.ts:105`: each piece's triangle range in the plank top, kept for this highlight (eng D20).
  - The lazy `Viewer3D` gives the render, dispose and camera. `View3DPanel` covers the failure states. The 2D `TrackCanvas` draws the SVG plan.
  - The bend model's `jointBend` per weld (`engine/src/graph/bendRun.ts`) is today's version of the "tight joint".
  - Print CSS exists only for the 2D grid (`app/src/app.css:211`).
- **State:** clean main at 473c3c7. No stashes, and no PRs in flight.
- **Context:** `App.tsx` is 1669 lines (TODO P3 "Finish splitting App.tsx"), so build mode should be its own component tree, not more App.tsx.

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| D1 prereq (owner) | No office-hours doc | review from spec | — | approved | D1 answer 2026-10-31 "Review from the spec" |
| D2 approach (owner) | G1 says "3D render of the layout so far"; 13A says the sheet is "the same order" as line drawings; the 3D viewer exists, and `pieceRanges` was kept for this highlight | C | — | approved | D2 answer 2026-10-31 "C) 3D screen, numbered sheet". Scope: build mode renders in the 3D viewer, pieces up to step N with the next one highlighted; the sheet is a 2D line plan per band with every piece numbered in build order plus a parts list. Replaces 13A's "one drawing per step" reading for the sheet only. |
| D3 E1 pull list (owner) | inventory exists (Your box) | — | — | approved | D3 answer "Add". Scope: a step-0 screen with per-part counts, flagged against Your box |
| D4 E2 join ring (owner) | `AssemblyStep.joins` | — | — | approved | D4 answer "Add". Scope: ring the end on the piece already down that the next piece clips onto |
| D5 E3 wake lock (owner) | Screen Wake Lock API | — | — | approved | D5 answer "Add". Scope: held while build mode is open, released on leave; a no-op where unsupported |
| D6 E4 phase cards (owner) | `AssemblyPhase` | — | — | approved | D6 answer "Add". Scope: one card at each band change, tapped past, no animation |
| D7 bend note (owner) | R21 (App.tsx:29-31): no per-joint glyph; 13A tight-joint warning | — | — | approved | D7 answer "Loop-level note". Scope: one sentence at the step closing a loop that closes by bending, on screen and on paper; R21 unchanged |
| D8 orbit in build mode (owner) | G1 whole-screen advance; Viewer3D OrbitControls | — | — | approved | D8 answer "No turning in build mode". Scope: orbit off; camera set per step |
| D9 non-closing layouts (owner) | bend statuses `beyond`/`unchecked` (bendRun.ts:32-40) | — | — | approved | D9 answer "Allow, warn twice". Scope: Build it is never gated on the verdict; step 0 carries the verdict's reason; the loop-closing step of a `beyond` or `unchecked` loop says so |
| D10 browser Back (S1) | no history API in app/src | — | — | approved | D10 answer "Back returns to editor". Scope: entering build mode pushes one history entry; popstate leaves build mode; the step stays saved; one DOM test |
| D11 bundle (S1) | chunkBudget 128.13/129.07 kB | — | — | approved | D11 answer "Lazy chunk, budget unchanged". Scope: build screen, buildSteps and sheet load on demand; main chunk gains only the entry buttons; chunkBudget unchanged |
| D12 soft failures (S2) | PR 54 surfaced save failures | — | — | approved | D12 answer "One quiet line, once". Scope: wake-lock refusal and resume-save failure each get one line on the pull list, once per visit, plus console.warn |
| D13 wake-lock race (S4) | Wake Lock resolves async | — | — | approved | D13 answer "Fix with a test". Scope: a request resolving after leave is released at once; a test with a controlled pending request covers leave-before-resolve |
| D14 OV1 beyond wording (outside) | bendRun.ts:225 statusOf: beyond whatever the leftover | — | — | approved | D14 answer "Apply: reuse the verdict's words". Scope: beyond notes use bendWords' sentence; no leftoverMm figure; amends D9 wording |
| D15 OV2 run scope (outside) | solve.ts:71 runs; RunBend per component | — | — | approved | D15 answer "Apply: speak about the run". Scope: bend and warning notes speak of the run, at the step closing its last loop; amends D7/D9 placement |
| D16 OV3 adapters (outside) | App.tsx:1188 adapterJoints, adapterShortfall | — | — | approved | D16 answer "Apply: adapters everywhere". Scope: pull list and sheet count adapters with shortage; adapter instruction at the seating step |
| D17 OV4 new-run framing (outside) | assembly.ts:47 empty joins | — | — | approved | D17 answer "Apply: overview for new runs". Scope: no-joins steps frame everything down so far plus the piece |
| D18 OV5 resume key (outside) | anchors move runs | — | — | approved | D18 answer "Apply: hash the saved bytes". Scope: resume key = hash of saved layout JSON incl. anchors |
| D19 OV6 lazy recovery (outside) | View3DPanel boundary pattern | — | — | approved | D19 answer "Apply: same recovery as 3D". Scope: error boundary around BuildMode/BuildSheet imports, editor stays mounted, Try again then Reload when saved |

## 0A. Premise

**Problem:** A verified layout still has to be built by hand. With two levels, the order matters. Reach under a deck to clip in floor track and the deck comes off. A ramp clipped in before its floor end is down has nothing holding it. Today the user reads the 2D plan and works out the order themselves.

**Outcome:** You build the layout piece by piece with the right piece in hand and the right spot in view, with no mental mapping from plan to floor.

**Do-nothing cost:** The engine's assembly order (built 2026-10-27) has no reader. The 3D viewer's piece ranges are unused. Multi-level builds keep failing on the floor, which is the failure the two-level work was meant to prevent.

**Direct or proxy:** It's direct. It shows the order, the piece and the place.

## 0B. Leverage

| Sub-problem | Existing code | Gap |
|---|---|---|
| Order of steps | `assemblyOrder` (assembly.ts:59) | none |
| Picture of layout so far + next piece | `buildScene` + `pieceRanges` (mesh.ts:105), `Viewer3D` | scene limited to pieces up to step N; highlight material for one range |
| Name and code | part records (`name`, id) | none |
| Tight joints at a step | `jointBend` per weld (bendRun.ts) | map weld → step where its second piece goes down |
| Step persisted | storageKeys pattern (`VIEW_STORAGE_KEY`) | a key per layout content |
| Paper drawing | `TrackCanvas` SVG, print CSS stub (app.css:211) | greyscale line drawing, numbering, pagination |

## Landscape

- **[Layer 1]** LEGO Builder is the reference app for digital building instructions. It shows step-by-step 3D instructions you can zoom and turn, saves your progress so you pick up where you left off, and has a "Build Together" mode where people take turns on steps ([LEGO Builder app](https://www.lego.com/en-sa/builder-app), [App Store listing](https://apps.apple.com/qa/app/lego-builder-3d-instructions/id1486159728?l=en-GB)).
- **[Layer 2]** In LEGO Builder's 2024 user reviews, people complain about animated instructions that are hard to skip, and about losing their step after logging out ([appfollow](https://apps.appfollow.io/ios/lego-r-builder-3d-instructions/1486159728?country=us)). This supports the decisions already made: no animation, and the step is saved. There is no wooden-track equivalent. The BRIO fan site [woodenrailway.info](https://woodenrailway.info/) offers planning advice, not build instructions.
- **[Layer 3]** Paper manuals don't use one page per brick. They group several pieces per step and number them. One drawing per piece would make a 34-piece layout into 34 drawings, which is too many to print. A numbered plan (each piece labelled with its step number, split by phase: floor, ramps, raised) covers the same order on a page or two.

## 0C. Dream state

```
  CURRENT STATE                    THIS PLAN                           12-MONTH IDEAL
  verified layout, 2D + 3D   --->  ordered walkthrough on a tablet --->  design, verify, build and share:
  views; assembly order            (3D, next piece framed and lit),     a layout goes from screen to floor
  computed but unseen; the         numbered paper plan per band         with no mental mapping, for a
  build is guesswork                                                     child or a friend's family
```

## Mode

SELECTIVE EXPANSION, chosen by the owner 2026-10-31. Approved decisions carried: D1, D2.

**HOLD checks.**
1. Complexity: ~12 files [estimated] > 8. Each has one job and none can go without losing what was asked for, so no cut is proposed.
2. Minimum: build mode (screen) and the numbered sheet, both named in the request.
3. Invariant surfaced (core, not an expansion): G1 needs the next piece recognisable at 60cm. On a large layout, a whole-layout camera makes it a few pixels wide, so each step must frame the next piece and its neighbours. This goes to the review sections.

## Expansion candidates (all four accepted 2026-10-31: D3 E1, D4 E2, D5 E3, D6 E4)

| ID | Felt experience | Shape | Effort | Risk |
|---|---|---|---|---|
| E1 | Before step 1, "Get these out of the box": counts per part, checked against Your box | a step 0 screen from the layout's part counts and the inventory | S | low |
| E2 | Each step also shows WHERE it clips: the end it joins on the piece already down is ringed | `AssemblyStep.joins` + the weld's port, drawn as the join-target ring | S | low |
| E3 | The tablet doesn't go to sleep while you kneel and build | Screen Wake Lock while build mode is open, released on leave | S | low |
| E4 | A card between bands: "Floor done. Now the ramps up to level 1." | a step-like card at each band change, no animation | S | low |

## Accepted scope

**Build mode (screen).**
1. **Entry and exit.** "Build it" is available when the layout has at least one piece, whatever the verdict (D9). While building, the editor is suspended: `useEditorKeys` is disabled, and the editor's canvas and 3D view unmount. App state is kept, so no shortcut can change the layout mid-build (D27). Leaving (Esc or the small "Back to editor") returns to the editor where it was.
2. **Steps.** There is one list. Step 0 is the pull list (E1). Then one step per piece in `assemblyOrder(graph, segments)` order, with a card (E4) before each new BAND after the first. Bands come from `assemblyOrder` and are not strict phases: floor, ramps up to level 1, level 1, ramps up to level 2, and so on (assembly.ts:55, :98). `AssemblyStep` carries no band, so it is worked out as `phase === 'ramp' ? 2*level+1 : 2*level`, matching `bandOf` (assembly.ts:55). Each card names its band: "Floor done." and "Now the ramps that climb to level 1." (D41) A final screen reads "That's the last piece." and "All N pieces are down." If the verdict isn't a pass, its glyph and sentence follow. It offers Back to editor (primary) and Print the sheet (D38).
   - "Step n of N" counts pieces only. Cards show no number.
3. **Each piece step (G1):**
   - **The picture.** The 3D view, rebuilt from the scene input filtered to the pieces down so far plus the next one. The next piece is drawn in a highlight material through its `pieceRanges` entry. Budget: one step rebuild of 250 ms or less at the viewer's ceiling, the same target as the viewer's eng D27.
   - **Always visible (D28).** The next piece is drawn normally, plus a semi-transparent copy drawn over everything, so track in front can't hide it.
   - **Framing.** The camera frames the next piece and the pieces it joins, at the start elevation, set per step with no animation. A step with no joins (a new run) frames everything down so far plus the new piece instead, so its place shows (D17). New `Viewer3D` work: a `focus` box, an orbit-off switch, a highlight range and the ring marks, plus per-piece bounds from the scene.
   - **Orbit is off in build mode (D8).** That means `OrbitControls` and the viewer's own arrow-key handler (Viewer3D.tsx:402-431). A tap advances and a swipe right goes back, so a drag never turns the view.
   - **Marks.** Build mode drops the verdict's marks, keeping only the join ring (G1: no verdict line).
   - **The join ring (E2).** Every end the next piece clips onto is ringed, looked up from `joins` piece ids to the weld between the two pieces to that weld's port on the piece already down. The ring is drawn like the marks, as a camera-facing ring at the port. A step with no joins (a new run starts) shows no ring.
   - **The label.** Name and BRIO code, legible at 60cm, with "Step n of N" small underneath.
   - **The bend note (D7, D15).** Bend results are per run of track, not per loop, so the note speaks about the run. It appears at the step that closes the run's LAST loop, when the whole run is down:
     - "This piece closes this run of track. The joints around it bend a little to meet."
     - It shows when that run's status is `closes` with lambda > 0.
     - There are no per-joint marks, so R21 stands.
     - A step closes a loop when one of its piece's welds links two ends already in the same group. This is tracked by a union-find over welds as pieces go down; `joins` can't decide it, since it is de-duplicated by piece and a bridge between two separate groups also has two joins.
     - The run is found through `runs.loops[].pieces` (every branch) or `RunBend.pieces` (`ok: true`).
   - **Adapters (D16).** The step that seats a socket-to-socket joint says "Put a male-male adapter in first." The joints come from `result.adapterJoints`.
4. **Input.** A tap anywhere outside a button advances (G1). A swipe right goes back (G2), and a swipe left advances. On a keyboard, Right and Space advance, and Left goes back. Each step is announced in a polite live region: the name, the code, "Step n of N" and any note.
5. **Resume.** The position is saved under `brio.build.v0` as `{ layout, index }`. `layout` is a hash of the exact saved layout JSON the steps are built from: pieces, welds and anchors, so moving a run also restarts (D18), and `index` points into the one list from item 2. Only the latest build is kept. A layout whose hash differs starts at step 0, and an index past the end of the list is clamped to 0. Reaching "Built" clears the saved position.
6. **Screen awake (E3).** The screen stays on while build mode is open. The browser drops the lock when the page is hidden. It is requested again inside the next advancing tap or key press, since iPad Safari refuses a request without a user gesture (D21).
7. **When 3D can't draw.** Build mode shows View3DPanel's four states in its own words, and each one offers the printable sheet:
   - no WebGL
   - failed download (Try again, then Reload as in the viewer)
   - lost graphics context
   - too big to draw (over the segment ceiling)
8. **The pull list (E1).** It gives a count per part, plus male-male adapters (D16, `adapterShortfall`). When Your box is set, each part you have too few of says how many short you are. It never blocks: Start is always available. With no box set, it shows counts only.
9. **A layout that doesn't close (D9, D14, D15).**
   - Step 0 carries the verdict's reason ("This layout doesn't close yet: …").
   - At the step that closes a run's last loop:
     - a run whose status is `beyond` gets the verdict's own sentence for that run (`bendWords`). No millimetre figure is added; `leftoverMm` is not a gap (D14).
     - a run whose status is `unchecked` gets "This run of track couldn't be checked." followed by the result's reason (D52).
   - When the result is `ok: false` (BEND_UNCHECKED, TOO_MANY_LOOPS, TOO_BIG_TO_CHECK, NUMERIC), there are no run statuses. Every run in `runs.loops` counts as unchecked, and step 0 gives the result's `detail`.
   - An open run (no loop) gets no warning, since it isn't a fault.
10. **Loading build mode itself (D11, D19).** BuildMode and BuildSheet load on demand. An error boundary around them, with the editor still mounted, says "Couldn't load build mode." It offers Try again, then Reload when everything is saved, the same pattern as View3DPanel.

**Printable sheet (paper).**
1. One 2D line drawing per band that has pieces (the same bands as the cards). Earlier bands are drawn faint underneath, so a ramp doesn't float in space. Every piece in the phase gets its step number at its midpoint. The drawing survives greyscale.
2. The bend note (D7) appears in words beside the step number that closes a bent loop. There are no per-joint glyphs.
3. A parts list with counts and adapters, shared with E1 (D16).
4. **Ways in.** The sheet is reached from the pull list ("Print the sheet"), from the Built card, from the editor beside "Build it", and from the four 3D failure states.
5. It prints from the browser (`window.print()` on a print-only layout), so no PDF library is needed.
6. Settled in eng review:
   - one landscape page per band plus a full step table (D24)
   - a band whose labels would overlap at that scale is split across as many pages as needed at a scale where they don't (D30)
   - the scene is rebuilt each step (D22)
7. **The verdict on paper (D29).** Page 1 opens with the verdict's own sentence and reason, the same text step 0 shows, including faults in layouts with no loops.

## NOT in scope

- One drawing per step on paper: replaced by the numbered plan (D2).
- Supports and piers: not modelled (`assembly.ts` header, TODO "Support and pier modelling").
- Build Together (turn-taking), animated transitions (G1 and LEGO review evidence), and narration.
- Linked selection from 3D to 2D: an existing P3 TODO.

## 0I. Temporal interrogation

```
  HOUR 1 (foundations):  the step list is pure engine work: assemblyOrder + union-find
                         loop closing + band cards + warnings from GraphResult. Test it
                         in node first; nothing else needs a browser.
  HOUR 2-3 (core):       Viewer3D grows focus / no-orbit / highlight / rings. The
                         surprise: pieceRanges covers the plank top only, and the
                         camera code deliberately keeps its pose across rebuilds (D10/D16).
  HOUR 4-5 (integration): App gets a screen switch. Surprises: the browser Back
                         button, the main chunk has 0.94 kB of budget left, and the
                         wake lock resolves asynchronously.
  HOUR 6+ (polish):      the sheet's labels on dense layouts, tablet rotation, the
                         screenshots at 60cm.
```

Effort: human ~2 weeks / CC ~4-5 h [estimated], in 3-4 PRs (engine steps; viewer props; build screen; sheet).

## Review sections

### Section 1: Architecture

```
  EDITOR (App.tsx)                         BUILD MODE (new, lazy)
  ┌───────────────────────┐   Build it   ┌──────────────────────────────────┐
  │ graph, segments,      │ ───────────▶ │ BuildMode.tsx                     │
  │ GraphResult, inventory│              │  ├─ buildSteps() ◀── engine (new) │
  │ sceneInput (memo)     │ ◀─────────── │  │    assemblyOrder, bandOf,      │
  └───────────────────────┘   Back       │  │    union-find, GraphResult    │
            │                            │  ├─ Viewer3D (focus, orbit off,   │
            │ Print sheet                │  │    highlight, rings)           │
            ▼                            │  ├─ step label, live region       │
  ┌───────────────────────┐              │  ├─ wake lock, resume store       │
  │ BuildSheet.tsx (print)│ ◀────────────│  └─ 3D failure → offers sheet     │
  │  SVG per band, numbers│              └──────────────────────────────────┘
  └───────────────────────┘
```

- **Boundaries.**
  - `buildSteps(graph, segments, result, partOf)` is pure engine code. It returns the one list from scope item 2, with notes and warnings already worked out, so the app only renders it.
  - `bandOf` is exported from assembly.ts. The plan's derived formula would duplicate it.
- **Data flow.**
  - **Happy path:** the steps are built once on entry. Each step filters `sceneInput` to the pieces down so far and draws.
  - **Nil path:** no graph means Build it is disabled (scope item 1).
  - **Empty path:** a layout with one piece gives the pull list, step 1 and Built.
  - **Error path:** a GraphResult with `ok: false` makes every loop unchecked (D9).
- **State.**
  ```
  index: 0 (pull list) ─tap─▶ 1..k (cards and pieces) ─tap─▶ last (Built) ─Back to editor─▶ editor
         ◀──swipe right──     ◀──swipe right──              (clears resume)
  invalid: index < 0 or > last, prevented by clamping; any edit is impossible (build mode hides the editor)
  ```
- **Coupling.** Build mode reads App's graph, result and inventory as props. Viewer3D gains props but no build knowledge.
- **Rollback.** Revert the PR. No stored format changes except the new `brio.build.v0` key, which older code ignores.

**Findings:**
- RESOLVED (D10) **S1-a, browser Back:** on a tablet, the system Back gesture leaves the site, not build mode. Nothing in App uses the history API (grep: no pushState or popstate). This goes to the owner.
- RESOLVED (D11) **S1-b, chunk budget:** the main chunk is 128.13 kB against 129.07, which leaves 0.94 kB. The build screen, step logic and sheet will not fit in the main chunk. This goes to the owner.
- OK **S1-c:** export `bandOf` instead of re-deriving it. A code-quality fix inside the approved scope.

### Section 2: Error and rescue map

```
  CODEPATH                    | WHAT CAN GO WRONG                 | CLASS
  buildSteps                  | result ok:false                   | (data) → loops unchecked (D9)
                              | segment without pieceId           | skipped, as assemblyOrder does
  Viewer3D per-step rebuild   | WebGL missing / context lost      | WebGLUnavailable / contextlost → panel states (scope 7)
                              | chunk download fails              | TypeError (dynamic import) → panel's Try again
  wake lock request           | denied, unsupported, page hidden  | NotAllowedError / absent API
  resume read                 | malformed JSON, wrong shape       | SyntaxError / shape mismatch
  resume write                | quota, storage blocked            | QuotaExceededError / SecurityError
  window.print                | unavailable, cancelled            | (no throw; returns)

  CLASS                 | RESCUED | ACTION                                  | USER SEES
  ok:false result       | Y       | loops unchecked, step 0 detail          | the warning text
  WebGL / context / dl  | Y       | View3DPanel states + Print the sheet    | plain sentence + button
  NotAllowedError       | Y       | console.warn once                       | nothing (screen may sleep) ← owner
  resume SyntaxError    | Y       | ignore entry, start at 0                | step 0
  resume Quota/Security | Y       | console.warn                            | nothing ← owner
```

### Section 3: Security and threat model

- **New input:** `brio.build.v0` from localStorage is untrusted. Parse it in a try block, require `{ layout: string, index: integer }`, and clamp `index` (scope 5). Likelihood low, impact low, mitigated.
- **No new network access, secrets or dependencies.** Wake Lock and print are browser APIs.
- **Injection:** part names come from the library and submitted parts, and are rendered as React text, not HTML. Mitigated by the existing pattern.

No issues beyond the validation already in scope.

### Section 4: Data flow and interaction edge cases

```
  graph+segments+result ─▶ buildSteps ─▶ steps[] ─▶ index ─▶ filter sceneInput ─▶ Viewer3D
        │ ok:false ─▶ loops unchecked     │ empty ─▶ (Build it disabled)      │ throw ─▶ panel state
  localStorage ─▶ parse ─▶ shape check ─▶ clamp ─▶ index        (bad ─▶ 0)
```

**Async ordering: the wake lock.**
```
  t   build mode            wake lock request          lock
  0   open ───────────────▶ request()  (pending)
  1   Back to editor ─────▶ release() → nothing held yet
  2                         resolves ────────────────▶ HELD, nobody releases it
```
The invariant is that no lock is held while build mode is closed. Without a guard, schedule 0-1-2 breaks it: the screen stays awake in the editor until the tab is hidden. Fix (D13, approved): when a request resolves after leaving, release it immediately (an `active` flag checked on resolve), with a test that pauses the request and leaves before it resolves.

| Interaction | Edge case | Handled? | How |
|---|---|---|---|
| tap to advance | double tap | Y | each tap is one step; swipe right undoes it |
| tap | on Back to editor / Print / Start | Y | buttons excluded (scope 4) |
| swipe | a short drag | Y | below a threshold it counts as a tap, set in eng review |
| rotate tablet | aspect changes | Y | refit the framing on resize (scope 3) |
| leave mid-build | Back, Esc, system Back | Y | D10, step saved |
| reopen | the layout was edited | Y | the hash differs, so start at 0 |
| 10,000 pieces | step rebuild time | Y | 250 ms budget; over the ceiling means the panel state |
| no pieces | Build it | Y | disabled |

### Section 5: Code quality

- **Placement.** New code lives in `engine/src/graph/buildSteps.ts`, `app/src/BuildMode.tsx`, `app/src/BuildSheet.tsx` and `app/src/wakeLock.ts`, not in App.tsx (1669 lines; TODO "Finish splitting App.tsx").
- **No duplicated rules.**
  - Use `bandOf` exported from assembly.ts (S1-c).
  - Read run statuses from `GraphResult`, not a second solve.
  - Join rings reuse the 2D join target's ring sizing from DESIGN.md rule 11.
- **Naming.** `buildSteps` returns `BuildItem` = `pull | card | piece | built`, one discriminated union, so the screen's render is a switch with no flags.
- **Complexity.** The loop-closing union-find and the warning selection are separate functions, each with fewer than 5 branches.

No issues found beyond S1-c.

### Section 6: Tests

```
  NEW THING                         TYPE        HAPPY                    FAILURE / EDGE
  buildSteps order + cards          unit(node)  two-level fixture:       one piece; ok:false result;
                                                floor→ramp→raised,       piece welded twice to one piece
                                                one card per band        (closes a loop, 1 join); bridge
                                                                         between two groups (2 joins, no loop)
  loop note / beyond / unchecked    unit(node)  stadium closing by bend  beyond with leftoverMm null
  resume store                      unit(node)  save → load same hash    malformed JSON; index past end; quota
  wake lock                         unit(dom)   held while open          refused; leave before resolve (D13)
  BuildMode input                   dom         tap, swipe, Right/Space  tap on a button doesn't advance;
                                                Left, live region text   history Back leaves (D10)
  Viewer3D focus/highlight/rings    node(three) fitted box in view,      no joins → no ring; orbit off
                                                highlight range drawn    ignores arrow keys
  sheet                             dom + print earlier bands faint,     open run; 1-piece layout
                                    screenshot  numbers present
  lazy chunk                        CI script   chunkBudget unchanged    build code absent from index-*.js
  real browser                      scripted    one pass per PR (3D review D15): tablet viewport,
                                                two-level layout, 60cm legibility screenshot
```
Every test pin records a mutation that was actually run (project rule). **The 2am test:** walk a two-level layout's whole step list and assert no raised piece comes before what holds it, and no floor piece under a bridge comes after the bridge. **The hostile test:** the twice-welded piece and the two-group bridge, which break a naive `joins.length >= 2` rule. **Chaos:** reload mid-build with corrupted `brio.build.v0`.

### Section 7: Performance

- **Per-step rebuild.** This is the slowest path. At the ceiling (10,000 segments) the viewer measured 164-238 ms per rebuild (3D review). The plan's budget is 250 ms. Rebuilding once with a draw range is the open eng-review alternative.
- **buildSteps** is linear, as assemblyOrder is, plus union-find (near linear). It runs once on entry.
- **Memory.** One scene's buffers at a time. The viewer disposes on rebuild (eng D16).
- **The sheet at 10,000 pieces.** One SVG per band with up to 10,000 labels. This is open for eng review together with label overlap.

No new issues.

### Section 8: Observability

This is a client-only app with no server. Failures go to the console, with a named sentence each (D12 and the panel states). A bug report can be reproduced from the saved layout plus `brio.build.v0`. No dashboards or alerts apply.

No issues found.

### Section 9: Deployment and rollout

- **Release.** It ships through the Pages deploy after CI, as every PR does. There's no feature flag. The entry button is the only way in, so a broken build mode can be hidden by reverting one PR.
- **Sequence.**
  1. Engine steps (no UI).
  2. Viewer props.
  3. The build screen.
  4. The sheet.
- **Each PR is safe on its own.** Nothing reads the new key until PR 3.
- **Post-deploy.** Open woodentrain.world, build a Stadium plus a ramp, press Build it, step through, and print.

No issues found.

### Section 10: Long-term trajectory

- **Reversibility: 5/5.** It adds one new key and reuses the existing formats.
- **Debt.** The sheet's label overlap rule is deferred to eng review. App.tsx still needs splitting.
- **Next.** Supports and piers would join the steps as their own band. Build Together, if ever wanted, sits on the same list.
- **Cherry-pick retrospective.** E2's ring depends on the viewer's new mark kind, which the bend note doesn't need. All four are independent of each other.

### Section 11: Design and UX

```
  Editor ──Build it──▶ [0 Pull list] ──Start──▶ [Step 1] ─tap─▶ … ─▶ [Card: band] ─tap─▶ … ─▶ [Built]
     ▲                    │ Print the sheet                   ◀─swipe right─                  │
     └──Back/Esc/system Back (step saved)◀────────────────────────────────────────────────────┘
  Any step ── 3D fails ──▶ [Panel state + Print the sheet]
```

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Build mode | viewer chunk: "Loading…" after 300 ms (3D 4A) | Build it disabled | 4 panel states + sheet | Built card | resume at step n |
| Pull list | — | no box: counts only | — | all owned | short parts named |
| Sheet | chunk load | — | print cancelled: nothing | prints | open runs numbered like any |

- **Hierarchy.** G1 holds: the picture, then the name and code, then the step counter.
- **Phone in portrait.** The picture sits above the label. Its sizes are open for /plan-design-review.
- **Accessibility.**
  - keys (scope 4)
  - live region (scope 4)
  - buttons at least 44 px
  - label contrast from the tokens
- **AI-slop risk:** low. There are no cards, grids or illustrations. Each step is a single full-screen view (DESIGN.md).

Recommend running /plan-design-review on this plan before implementation, and /design-review on the live build after.

### Outside voice (Codex, gpt-6-astra, completed)

There were six findings. All six were checked against the code and all hold. Each was resolved by the owner:
- OV1 High: D14 applied
- OV2 High: D15 applied
- OV3 High: D16 applied
- OV4 High: D17 applied
- OV5 Medium: D18 applied
- OV6 Medium: D19 applied

There is no remaining disagreement. The prompt's plan body was cut at 30 KB, which dropped the end of Section 11 (the size limit).

### TODO choices

None remain. No work was deferred in this review. Existing TODOs touched: "P2 — 3D viewer, build mode and the printable sheet" (this plan replaces its build-mode half when shipped), "Support and pier modelling" and "Pick a piece in 3D and it is selected in 2D" (both unchanged).

Approval readiness: PASS. Rows checked: D1 to D19, each with its answer reference in the ledger. D2 approves the approach only. D3 to D6 approve E1 to E4. D7 to D19 approve their stated scope. Mode is recorded as an admin answer, not a remedy approval.

## Required outputs

### Reality rows

```
REALITY: premise-table pass 5 premises with receipts (assembly.ts:59, mesh.ts:105, App.tsx:29, App.tsx:1188, bendRun.ts:225), unverified=0
REALITY: already-done pass origin/main has assemblyOrder (3a8279b) and no build UI; no BuildMode/BuildSheet files exist
REALITY: surface-check pass no CLI or HTTP surfaces; browser APIs only; history API unused today app/src/View3DPanel.tsx:16 (the only lazy entry, no pushState anywhere)
REALITY: binding-decisions pass G1, G2, 13A (amended by D7), R21 (kept, App.tsx:29), 3D D2/D3, chunk budget (scripts/chunkBudget.ts)
REALITY: numbers pass 128.13/129.07 kB [measured: scripts/chunkBudget.ts:17]; 3D rebuild time [estimated, re-measure before gate]; ~12 files [estimated]
REALITY: deferred-asks pass no linked issue; backlog entry docs/plan/brio-TODOS.md:383
REALITY: pr-count pass 4 PRs (engine steps, viewer props, build screen, sheet), each independently safe; order at docs/plan/2026-10-31-build-mode.md:334
PLAN_REALITY: phase=ceo rows=7/7 missing=none unverified=0 verdict=complete
```

### What already exists

| Code | Reused? |
|---|---|
| `assemblyOrder` (assembly.ts:59), `bandOf` (:55) | yes; bandOf exported |
| `buildScene` + `pieceRanges` (mesh.ts:105) | yes; per-step input filtered |
| `Viewer3D`, `View3DPanel` states and boundary pattern | yes; new props, same recovery (D19) |
| `GraphResult.runs`, `bend`, `adapterJoints` (solve.ts) | yes, read only |
| `bendWords` (verdict sentence) | yes (D14) |
| `usedCounts`, `computeShortfalls`, `adapterShortfall` (App.tsx:1188) | yes (E1, D16) |
| Join-target ring sizing (DESIGN.md rule 11) | yes (E2) |
| storageKeys pattern | yes; new `brio.build.v0` |

### Dream state delta

After this ships, a layout goes from screen to floor in order: the next piece, its place, the end it clips onto, adapters, and an honest note where a run bends or fails. Still missing from the 12-month ideal: supports and piers, and sharing a layout with another family.

### Error and rescue registry

This is Section 2's table, plus the following:

| Codepath | Failure | Class | Rescued | Action | User sees |
|---|---|---|---|---|---|
| lazy BuildMode/BuildSheet import | download fails | TypeError (dynamic import) | Y (D19) | boundary, Try again then Reload when saved | "Couldn't load build mode." |
| history popstate | Back while a step rebuild is in progress | none | Y | leave; the rebuild is dropped on unmount | editor |
| wake lock resolves after leave | race | none | Y (D13) | release at once | nothing |

### Failure modes registry

```
  CODEPATH              | FAILURE MODE              | RESCUED? | TEST? | USER SEES?           | LOGGED?
  buildSteps            | ok:false result           | Y        | Y     | unchecked notes      | n/a
  buildSteps            | loop-closing misdetected  | Y        | Y     | right note           | n/a
  per-step rebuild      | WebGL/context/download    | Y        | Y     | panel state + sheet  | console
  lazy build chunk      | download fails            | Y        | Y     | Couldn't load…       | console
  wake lock             | refused                   | Y        | Y     | one quiet line       | console.warn
  wake lock             | leave before resolve      | Y        | Y     | nothing              | n/a
  resume read           | corrupt / stale           | Y        | Y     | step 0               | n/a
  resume write          | quota / blocked           | Y        | Y     | one quiet line       | console.warn
  system Back           | leaves build mode         | Y        | Y     | editor               | n/a
```
There are 0 CRITICAL GAPS.

### Scope expansion decisions

Recorded in the CEO plan, with no further questions asked:
- **Accepted:** E1 (pull list), E2 (join ring), E3 (wake lock), E4 (band cards).
- **Deferred:** none.
- **Skipped:** none.

### Diagrams

The plan contains these diagrams:
- the system architecture (S1)
- the data flow with shadow paths (S4)
- the state machine (S1)
- the error flow (S2 tables)
- the wake-lock schedule (S4)
- the user flow (S11)

The deployment sequence is the 4-PR order in S9. The rollback is to revert the PR.

### Stale diagram audit

The files touched have one ASCII diagram, the header of `assembly.ts`, and it is prose only. It stays accurate. `mesh.ts` has no diagrams.

## Implementation Tasks

These are synthesized from this review's findings. Each task comes from a specific finding above. Run them with Claude Code or Codex, and tick each one as it ships.

- [ ] **T1 (P1, human: ~1.5d / CC: ~45min)** — engine — `buildSteps`: the one list (pull, cards per band, pieces, built), union-find loop closing, run-scoped notes, D9/D14/D15 warnings, adapter steps; export `bandOf`
  - Surfaced by: Accepted scope 2, 3, 9; S1-c; D14-D16
  - Files: engine/src/graph/buildSteps.ts, engine/src/graph/assembly.ts, engine/test/buildSteps.test.ts
  - Verify: node tests incl. twice-welded piece, two-group bridge, ok:false, beyond, adapter; mutation proofs run
- [ ] **T2 (P1, human: ~1.5d / CC: ~45min)** — viewer — Viewer3D build props: focus box (incl. new-run overview), orbit and arrow keys off, highlight range, join rings; per-piece bounds in mesh
  - Surfaced by: Accepted scope 3; D8; D17; spec review 10-13
  - Files: app/src/Viewer3D.tsx, engine/src/view3d/mesh.ts, tests alongside
  - Verify: node(three) test that the fitted box is in view; no-joins frames everything; keys ignored with orbit off
- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — app — BuildMode screen: entry and exit, tap/swipe/keys, live region, history entry, resume store, wake lock with race fix, soft-failure lines, lazy load with boundary
  - Surfaced by: Accepted scope 1, 4-10; D10-D13, D18, D19
  - Files: app/src/BuildMode.tsx, app/src/wakeLock.ts, app/src/buildResume.ts, app/src/storageKeys.ts, app/src/App.tsx (entry button only), app.css
  - Verify: dom tests (tap on a button doesn't advance, Back leaves, leave-before-resolve); chunkBudget unchanged; scripted browser pass on a tablet viewport
- [ ] **T4 (P1, human: ~1.5d / CC: ~45min)** — app — BuildSheet: SVG per band with earlier bands faint, step numbers, run notes in words, parts and adapters list, print layout, ways in
  - Surfaced by: Printable sheet 1-6; D2; D16
  - Files: app/src/BuildSheet.tsx, app/src/app.css (@media print)
  - Verify: dom test that numbers and bands are present; a greyscale print-preview screenshot
- [ ] **T5 (P2, human: ~2h / CC: ~10min)** — docs — DESIGN.md rule for build mode (G1 hierarchy, ring, note); TODO "3D viewer, build mode…" marked done
  - Surfaced by: S11; the backlog entry
  - Files: DESIGN.md, docs/plan/brio-TODOS.md
  - Verify: read-through

Effort assumption: features at ~30x and tests at ~50x human to CC.

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | assemblyOrder and pieceRanges unused; App.tsx 1669 lines; chunk 0.94 kB headroom |
  | Step 0               | D1 spec, D2 3D screen + numbered sheet, E1-E4 accepted, D7-D9 from spec review |
  | Section 1  (Arch)    | 3 issues found (Back, bundle, bandOf)       |
  | Section 2  (Errors)  | 9 error paths mapped, 0 GAPS (D12 closed 2) |
  | Section 3  (Security)| 0 issues found, 0 High severity             |
  | Section 4  (Data/UX) | 8 edge cases mapped, 0 unhandled (D13)      |
  | Section 5  (Quality) | 1 issue found (bandOf, = S1-c)              |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found (2 open for eng review)      |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 0 risks flagged                             |
  | Section 10 (Future)  | Reversibility: 5/5, debt items: 2           |
  | Section 11 (Design)  | 0 issues; /plan-design-review recommended   |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 12 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 9 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 4 proposed, 4 accepted (SEL)                |
  | CEO plan             | written                                     |
  | Outside voice        | codex, completed, 6 findings, 6 resolved    |
  | Lake Score           | 2/2 recommendations chose complete option   |
  | Diagrams produced    | 6 (architecture, data flow, state, error, schedule, user flow) |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 0 unverified       |
  +====================================================================+
```

### Unresolved Decisions

None. Open implementation choices are handed to /plan-eng-review: label overlap on the sheet, paper size, top-only versus full highlight, rebuild per step versus a draw range, and the swipe threshold.

## Eng review (2026-10-31)

Target: `docs/plan/2026-10-31-build-mode.md`, fixed. Report file: this plan. Questions continue the plan's numbering from D20, so they don't collide with the CEO ledger's D1-D19.

### Scope Challenge A

- **Reuse:**
  - `assemblyOrder` and `bandOf`, assembly.ts:55-59
  - `buildScene` and `SceneInput`, mesh.ts:79-93 and 237
  - `Viewer3D`, Viewer3D.tsx:294
  - `View3DPanel`'s `failureOf` and its boundary, View3DPanel.tsx:24 and 84
  - `saveGraph`'s payload, layoutStore.ts:591-602. D18's "saved bytes" can be that payload built in memory, so no localStorage read is needed.
  - `usedCounts`, `computeShortfalls` and `adapterShortfall`, App.tsx:1188-1191
- **Minimum:** every approved item (D1-D19, E1-E4). There is nothing to defer without breaking an approval.
- **Complexity:**
  - 5 new modules [estimated]: `buildSteps.ts`, `BuildMode.tsx`, `BuildSheet.tsx`, `wakeLock.ts`, `buildResume.ts`
  - about 8 edited files [estimated]: `Viewer3D.tsx`, `mesh.ts`, `assembly.ts`, `layoutStore.ts`, `App.tsx`, `app.css`, `storageKeys.ts`, `DESIGN.md`/TODOs
  - The gate trips.
- **Search:**
  - **[Layer 1]** Screen Wake Lock needs a secure context and Safari 16.4 or later. The browser drops it when the tab is hidden.
  - **[Layer 2]** WebKit requires a user gesture to request the lock, so re-requesting from `visibilitychange` fails on iOS with NotAllowedError ([WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [WebKit 255363](https://bugs.webkit.org/show_bug.cgi?id=255363), [Vaadin docs](https://vaadin.com/docs/next/flow/advanced/wake-lock-api)). This contradicts accepted scope item 6.
- **TODOs:** the backlog entry "P2 — 3D viewer, build mode and the printable sheet" (brio-TODOS.md:383) is what this plan closes. It is not blocked by anything.
- **Prior learning applied:** run-every-mutation-comment-do-not-predict-it (confidence 10/10, from 2026-10-15). Every pin in this plan records a mutation that was actually run.

### Scope Challenge B: scope record

Feature answers: none were proposed for cutting, and every CEO approval (D1-D19, E1-E4) stands. Structure: D20 answer "Smaller arrangement". Accepted scope: four new modules.
- `engine/src/graph/buildSteps.ts`
- `app/src/buildSession.ts`: the resume store, wake lock and history entry, each a small exported function with its own tests
- `app/src/BuildMode.tsx`
- `app/src/BuildSheet.tsx`

`wakeLock.ts` and `buildResume.ts` are replaced by `buildSession.ts`. Pending remedies: R1 (Wake Lock on iOS), R2 (highlight extent), R3 (rebuild per step versus a draw range), R4 (sheet labels and paper), R5 (swipe threshold). Scope Challenge result: scope accepted as-is.

### Scope Challenge C: findings

1. [INFORMATIONAL] (confidence: 8/10) docs/plan/2026-10-31-build-mode.md, accepted scope item 6: "The browser drops the lock when the page is hidden, so it is requested again on `visibilitychange`". WebKit refuses a request made without a user gesture, so on iPad the re-request fails and the screen sleeps after the first switch away. Remedy: R1.

### R1: Wake Lock re-request on iPad
Finding: 1, INFORMATIONAL, 8/10, accepted scope item 6, reviewer: Claude (with web evidence)
Plan baseline: D5/E3 "held while build mode is open"; D13 race fix; scope item 6 "requested again on `visibilitychange`"
Runtime evidence: no wake-lock code exists yet; WebKit 254545 and 255363 say a request without transient activation is refused
Comparison grid:
| Commitment | Current | A | B |
|---|---|---|---|
| when the lock is re-requested | on visibilitychange | on the next tap or key that advances, whenever not held | on visibilitychange (unchanged) |
| D12 quiet line | shown on refusal | shown only when a gesture-backed request is refused | shown on every refusal, including the iPad visibility case |
| D13 race fix | approved | unchanged | unchanged |
Question D21: re-request the keep-awake lock on the next tap instead of on returning to the page?
Header: Wake re-request
Options:
A) Re-request on next tap (recommended): every step advance is a tap, so a lost lock is re-requested inside that gesture, which iPad allows. Effort S (human ~1h / CC ~5min). The lock comes back on iPad after switching apps, and the same code works on Android and desktop. The screen can dim once if nobody taps before the timeout.
B) Keep visibilitychange: as written. Effort S. Works on Android and desktop. On iPad the lock never comes back after a switch and the quiet line shows wrongly.
State: approved
Actual answer: A, D21 answer "A) Re-request on next tap"
Accepted scope: a lost lock is re-requested inside the next advancing tap or key press whenever it isn't held. D12's quiet line shows only when a gesture-backed request is refused. D13 is unchanged. One test: a dropped lock, then a tap, means requested again.
History: none

### Section 1: Architecture

**Design twice, for `buildSteps`, the new public engine surface:**
- **Shape A (chosen):** `buildSteps(graph, segments, result, partOf): BuildItem[]`. Order, bands, loop closing, run notes, warnings and adapter steps all sit behind one call that returns a plain list. The screen and the sheet only render it.
- **Shape B:** BuildMode calls `assemblyOrder` and reads `GraphResult` itself, and the engine exports only helpers. The UI would then own the loop-closing and note rules, the sheet would need a second copy (red flag 6: two ways to do one task), and node tests couldn't reach them.
- A hides more behind less, so A it is.

**Red flags screened:**
1. Leakage: the note text comes from `bendWords` (engine), not a second sentence in the UI.
2. Hand-synced list: band names are derived from the band number (`floor`, `ramps up to level n`, `level n`), not listed by hand.
3. Split ownership: the resume index is written only by `buildSession`.

The other five red flags don't apply.

**Findings:**
2. [INFORMATIONAL] (confidence: 9/10) engine/src/view3d/mesh.ts:105, "`pieceRanges` … Each piece's run of triangle indices in `plankTop`". Only the top is indexed, and the build order differs from the segment order, so "build once, draw a range" would need the buffers reordered and the side, groove and beam meshes indexed too. Remedy: R3, then R2.
3. [INFORMATIONAL] (confidence: 7/10) accepted sheet item 6, "label overlap on dense layouts, paper size". Open. Remedy: R4.

### R2-R5: answers

| Record | Question | Answer | Accepted scope |
|---|---|---|---|
| R3 | D22: how each step's picture is made | A) Rebuild per step | Filter the scene input to the pieces down so far plus the next one and call `buildScene` on every step. Budget 250 ms at the ceiling [estimated]. No change to how meshes are built. |
| R2 | D23: how much of the next piece lights up | A) Whole piece | `buildScene` takes an optional `highlight` piece id and routes that piece's top, sides and grooves into highlight meshes. The 3D view never passes it. One node test. |
| R4 | D24: the sheet's labels and paper | A) Fit page + full step list | Each band's drawing is scaled to one landscape page (`@page`, so the printer picks A4 or Letter). Numbers sit at piece midpoints, 8pt minimum. A table follows with every step: number, part code, name, band and note. |
| R5 | D25: tap versus swipe | A) 10 px tap, 50 px swipe | Pointer events. Under 10 px of movement is a tap. A horizontal move of 50 px or more, larger than the vertical move, is a swipe. Anything else is ignored. |

Section 1 dispositions: finding 2 resolved by D22 (R3) and D23 (R2), and finding 3 by D24 (R4). Also settled: D25 (R5).

The Viewer3D work these imply is part of the approved scope, so no further questions were needed:
- `SceneArrays.pieceBounds`, computed in `buildScene`'s segment loop
- props `focus` (piece ids), `orbit` (false in build mode, which also turns off the arrow-key handler at Viewer3D.tsx:410-436) and `highlight`, passed through to `buildScene`
- a `join` mark kind for the rings, drawn on the existing sprite path

### Section 2: Code quality

4. [INFORMATIONAL] (confidence: 9/10) app/src/layoutStore.ts:592-601. The `payload: StoredGraph = {pieces…, welds…, anchors…}` is built inline. D18 needs the same bytes, so it is extracted as `storedGraphOf(graph)` (D26).

Also checked:
- **Reuse.** `usedCounts` and `adapterShortfall` (inventoryModel.ts:129, :46) serve E1 and D16 with no second copy. `bendWords` serves D14 and `failureOf` serves D19.
- **Error handling.** Each `buildSession` function catches only what its API throws: QuotaExceededError and SecurityError on setItem, SyntaxError on parse, NotAllowedError on the lock. A failure surfaces through D12's line.
- **Complexity.** `buildSteps` splits into order, then `loopClosers` (union-find), then `runNotes`, then `adapterSteps`. Each has fewer than 5 branches.

Dispositions: finding 4 accepted (D26 A). Accepted scope: `storedGraphOf` in layoutStore.ts is used by `saveGraph` and `buildSession`. There is one test that the hash changes when only an anchor moves. The save format is pinned byte-for-byte against a fixture, so the extraction can't change stored layouts (required regression proof, IRON RULE).

### Section 3: Tests

Framework: vitest. Two projects, node `*.test.ts` and dom `*.dom.test.tsx` (vitest.config.ts). The scripted browser check in each PR comes from the 3D plan's D15.

```
CODE PATHS                                              USER FLOWS
[+] engine/src/graph/buildSteps.ts                      [+] Build a layout
  ├── order + band cards (bandOf)   [GAP→T1 ★★★]          ├── [GAP→T3] Build it → pull list → steps → Built
  ├── loopClosers (union-find)      [GAP→T1 ★★★]          ├── [GAP→T3] tap on a button does not advance
  │    twice-welded piece, two-group bridge                ├── [GAP→T3] swipe right back, 10/50 px rule (D25)
  ├── runNotes closes/beyond/unchecked, ok:false [GAP→T1]  ├── [GAP→T3] keys Right/Space/Left; live region text
  └── adapterSteps                   [GAP→T1]              ├── [GAP→T3] system Back leaves (D10), step kept
[+] engine/src/view3d/mesh.ts                              └── [GAP→E2E scripted] tablet viewport, 2-level layout
  ├── highlight routes the whole piece [GAP→T2]          [+] Resume
  └── pieceBounds                    [GAP→T2]              ├── [GAP→T3] reopen same layout → same step
[+] app/src/Viewer3D.tsx                                    ├── [GAP→T3] move one run → step 0 (D18)
  ├── focus fit (joins / new-run overview, D17) [GAP→T2]   └── [GAP→T3] corrupt key → step 0
  ├── orbit off ignores arrows + drag  [GAP→T2]          [+] Error states
  └── join rings, none when no joins   [GAP→T2]            ├── [GAP→T3] lazy chunk fails → Try again/Reload (D19)
[+] app/src/buildSession.ts                                ├── [★★★ EXISTS] 3D panel states (view3d.dom.test.tsx)
  ├── resume read/write/clamp          [GAP→T3]            ├── [GAP→T3] wake refused → one quiet line (D12)
  ├── wake lock: request, race (D13), retap (D21) [GAP→T3] └── [GAP→T3] storage blocked → one quiet line
  └── history push/pop                 [GAP→T3]
[+] app/src/layoutStore.ts storedGraphOf [GAP→T3, golden] [+] Print
[+] app/src/BuildSheet.tsx                                 ├── [GAP→T4] bands drawn, earlier faint, numbers
  ├── per band, earlier faint, numbers [GAP→T4]            └── [GAP→T4] step table complete for 1 and many pieces
  └── step table, parts + adapters     [GAP→T4]
[+] scripts/chunkBudget.ts (unchanged) [★★★ EXISTS] build code absent from index-*.js

COVERAGE: 2/30 paths have tests today (new code)  |  all 28 gaps are assigned to T1-T4
QUALITY target: ★★★ on buildSteps, buildSession and the input rules; ★★ on the sheet
```

Every planned test carries a value card in the test plan artifact. No test is retired. Regression risk: the save format (golden, required) and the 3D view's own scene. The existing `view3dMesh`, `viewer3dScene` and `view3d.dom` tests must stay green unchanged, since `highlight` and `orbit` default to off.

Dispositions: no new choices. The test requirements are the required proof of approved decisions.

### Section 4: Performance

- **Per step.** Filtering the input is O(pieces). `buildScene` runs in the 3D viewer's time [estimated: up to ~240 ms at 10,000 segments, a few ms at 100]. One scene is alive at a time and disposed on rebuild (eng D16).
- **`buildSteps`.** O(pieces + welds), plus near-linear union-find, once on entry.
- **The sheet.** One SVG per band. At the ceiling that is up to 10,000 `<text>` elements. They print fine, and render time is unknown at that size. The scripted browser check measures it, so no number is invented here.
- **Memory.** Bounded by the viewer's ceiling. The resume key is under 100 bytes.

No issues found.

### Outside voice (eng phase): Codex, gpt-6-astra, completed

There were five findings. All were checked against the code: useEditorKeys.ts:40, Viewer3D.tsx:268, verdictView.ts:133, Viewer3D.tsx:215 and :308.

| Finding | Severity | Decision | Accepted scope |
|---|---|---|---|
| OV-E1 editor shortcuts stay live | High | D27 A | `useEditorKeys` gets an enabled flag, false while building. The editor canvas and 3D view unmount. A DOM test presses Cmd+Z, Esc and R and checks the graph is unchanged. |
| OV-E2 the next piece can be hidden | High | D28 A | A semi-transparent copy of the next piece is drawn over everything. A node(three) test checks its material ignores depth. The scripted pass uses a dense raised layout. |
| OV-E3 the sheet leaves out the verdict | High | D29 A | Page 1 carries the verdict sentence and reason. A test prints an impossible layout and finds it. |
| OV-E4 D24 overlap (reopened) | Medium | D30 A | Dense bands split across pages at a scale with no overlapping labels. The test is a dense fixture with no overlapping label boxes. D24's single page and step table stay for ordinary layouts. |
| OV-E5 latency is unproven | Medium | D31 A | The scripted pass times tap to next frame on the 10,000-segment layout and an ordinary one, and reports both. Over 250 ms at the ceiling reopens D22. |

There is no remaining disagreement.

### TODO choices (eng)

No new TODOs proposed. Every finding was resolved in scope.

### Decision ledger: approval readiness (eng)

Approval readiness: PASS. Rows checked against actual answers:
- D20 (structure)
- D21 (R1)
- D22 (R3)
- D23 (R2)
- D24 (R4, amended by D30)
- D25 (R5)
- D26 (storedGraphOf)
- D27 to D31 (outside voice)

The CEO rows D1 to D19 are carried unchanged. The save-format golden is required regression proof for D26 under the IRON RULE, not a separate choice.

### Eng reality rows

```
REALITY: premise-table pass 9 premises with receipts (assembly.ts:55, mesh.ts:105, Viewer3D.tsx:268, Viewer3D.tsx:410, layoutStore.ts:591, useEditorKeys.ts:40, verdictView.ts:133, inventoryModel.ts:129, View3DPanel.tsx:24), unverified=0
REALITY: already-done pass no build-mode code on origin/main; assemblyOrder only (engine/src/graph/assembly.ts:59)
REALITY: surface-check pass no CLI or HTTP surface; browser APIs only; vitest projects per vitest.config.ts:24
REALITY: binding-decisions pass CEO D1-D19 carried; R21 kept app/src/App.tsx:29; chunk budget scripts/chunkBudget.ts:17
REALITY: numbers pass 128.13/129.07 kB [measured: scripts/chunkBudget.ts:17]; per-step latency [estimated, re-measure before gate per D31]; 4 new modules [estimated]
REALITY: deferred-asks pass no linked issue; backlog entry docs/plan/brio-TODOS.md:383
REALITY: pr-count pass 4 PRs, one per lane step; queue cost one CI run and one merge each [estimated]; order at docs/plan/2026-10-31-build-mode.md:336
PLAN_REALITY: phase=eng rows=7/7 missing=none unverified=0 verdict=complete
```

## Eng required outputs

### NOT in scope (eng additions)

- Instancing or reordering the mesh buffers per build step. Declined in D22 in favour of a rebuild per step.
- Re-requesting the wake lock on `visibilitychange`. Replaced by a request on the next tap (D21).
- Highlighting the top only. Declined in D23.

### What already exists (eng)

The CEO table stands. Shared code: `storedGraphOf` (D26).
- **Callers:** `saveGraph` (layoutStore.ts:591) and `buildSession`'s resume key.
- **Lines:** about 10 moved and about 3 added, so roughly 7 lines are saved in implementation. With the golden and anchor tests, the total change grows by about 40 lines.
- **Blast radius:** the save path. It is guarded by the golden and by the existing layoutStore tests.

### Failure modes (eng)

| New path | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| buildSteps loop closing | twice-welded piece missed | T1 | union-find | correct note |
| per-step rebuild | 10,000-piece pause | D31 pass | measured, reopens D22 | brief pause, measured |
| next-piece visibility | hidden under a bridge | T2, scripted | ghost (D28) | piece shows through |
| editor shortcuts | Cmd+Z mid-build | T3 | suspended (D27) | nothing changes |
| wake lock | iPad switch-away | T3 | re-request on tap (D21) | screen stays on after next tap |
| sheet dense band | overlapping numbers | T4 | split (D30) | readable pages |
| sheet impossible layout | no warning on paper | T4 | verdict block (D29) | the reason in print |

There are 0 critical gaps: every path has a test, handling and a visible outcome.

### Worktree parallelization

| Step | Modules touched | Depends on |
|---|---|---|
| T1 buildSteps | engine/src/graph | — |
| T2 viewer props | engine/src/view3d, app/src (Viewer3D) | — |
| T3 build screen + session | app/src | T1, T2 |
| T4 sheet | app/src (BuildSheet) | T1 |

- Lane A: T1, then T4.
- Lane B: T2.
- Launch A and B, merge both, then T3.
- Conflict flag: T3 and T4 both touch `app.css` and the App entry buttons. Sequence them: T4 merges first, then T3 rebases.

### Implementation Tasks (eng revision)

These replace the CEO list above. Each task comes from a finding or decision.

- [ ] **T1 (P1, human: ~1.5d / CC: ~45min)** — engine — `buildSteps`: one list (pull, band cards, pieces, built). `loopClosers` by union-find, `runNotes` (D14, D15, D9, ok:false), `adapterSteps` (D16). Export `bandOf`.
  - Surfaced by: Section 1 design-twice Shape A; CEO D7, D9, D14-D16
  - Files: engine/src/graph/buildSteps.ts, engine/src/graph/assembly.ts, engine/test/buildSteps.test.ts
  - Verify: node tests (twice-welded, two-group bridge, ok:false, beyond, adapter, one piece), each with a mutation run
- [ ] **T2 (P1, human: ~1.5d / CC: ~45min)** — viewer — `buildScene({highlight})` covers the whole piece (D23). `pieceBounds`. Viewer3D gets `focus` (joins, or the new-run overview, D17), `orbit` off including the arrow handler (D8), a `join` mark ring (E2), and the see-through ghost (D28).
  - Surfaced by: Section 1 findings 2 and 3; D22, D23, D28
  - Files: engine/src/view3d/mesh.ts, app/src/Viewer3D.tsx, engine/test/view3dMesh.test.ts, app/src/viewer3dScene.test.ts
  - Verify: node(three) tests; the existing 3D tests pass unchanged
- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — app — BuildMode and buildSession.
  - Covers: entry and exit, editor suspension (D27), tap and swipe 10/50 px (D25), keys, live region, history (D10), resume keyed by `storedGraphOf` (D18, D26), wake lock with race fix and re-request on tap (D13, D21), quiet lines (D12), lazy load and boundary (D11, D19), pull list with adapters (E1, D16).
  - Surfaced by: accepted scope items 1-10; D10-D13, D18-D21, D25-D27
  - Files: app/src/BuildMode.tsx, app/src/buildSession.ts, app/src/layoutStore.ts, app/src/useEditorKeys.ts, app/src/App.tsx (entry and suspend only), app/src/storageKeys.ts, app/src/app.css, tests alongside
  - Verify: DOM tests per the test plan; save-format golden; chunkBudget unchanged; scripted tablet pass with tap-to-frame numbers (D31)
- [ ] **T4 (P1, human: ~2d / CC: ~1h)** — app — BuildSheet.
  - Covers: one page per band with earlier bands faint, dense bands split (D30), step numbers, step table, parts and adapters, verdict block (D29), the ways in.
  - Surfaced by: sheet scope items 1-7; D24, D29, D30
  - Files: app/src/BuildSheet.tsx, app/src/app.css (@media print), tests alongside
  - Verify: DOM tests (bands, numbers, table, impossible layout); dense fixture with no overlapping label boxes; greyscale print preview
- [ ] **T5 (P2, human: ~2h / CC: ~10min)** — docs — DESIGN.md build-mode rule; close the backlog entry
  - Files: DESIGN.md, docs/plan/brio-TODOS.md
  - Verify: read-through

Assumption: features at ~30x and tests at ~50x human to CC.

### Unresolved decisions (eng)

None.

### Eng completion summary

- Step 0: Scope Challenge — scope accepted as-is (smaller arrangement, D20)
- Reality rows: 7/7 applicable rows emitted, 0 unverified premises
- Architecture Review: 2 issues found (finding 2: build-once range; finding 3: sheet labels)
- Code Quality Review: 1 issue found (finding 4: storedGraphOf)
- Test Review: diagram produced, 28 gaps identified, all assigned to T1-T4
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed, 5 findings, all resolved (D27-D31)
- Parallelization: 2 lanes, 2 parallel / 1 sequential (T3)
- Lake Score: 5/5 (D21, D23, D24, D26 chose 10/10; D30 reopened D24, so D24 is counted once at its latest answer)

## Design spec (design review 2026-10-31)

Every item was decided individually (D32-D53). No mockups exist, because the image generator has no OpenAI key, so this text is the visual contract.

**Step 0, the pull list (D32, D35, D39).** In order:
1. The heading "Get these out of the box".
2. The verdict's glyph and sentence (D44).
3. When resuming, "Picking up at step 12." When the layout changed, "This layout changed since last time. Starting from the first piece." (D35)
4. An aligned list: part name, code, and count in `.num`. A part Your box lacks shows "2 short" in `--ink` 600 with no colour. Adapters are included (D16).
5. Start, or Continue when resuming. This is the only filled `--ink` button. Start again appears as a text button when resuming.
6. Print the sheet as an outline button, then Back to editor as a text button.
7. "Tap anywhere for the next piece. Swipe back to go back." (D39)

**Piece step, label block (D33, D45).**
- The adapter line comes first when present ("Adapter first: male-male", at name size).
- Then the name in `--build-name`: 40px Plex Sans 600, line-height 1.15, wrapping to at most 2 lines. The block grows to fit and the text never shrinks.
- Then the code in `--build-code`: 28px Plex Mono `.num` 500.
- Then notes, then "Step n of N" in `--build-meta` (16px `--ink-soft`).
- On viewports narrower than 600px the sizes are 32/24/15.
- The ground is `--paper`. `--ink` measures 13.43:1 on it and `--ink-soft` 5.21:1.
- One line of space is kept for a quiet line (D36).

**Picture (D42, D43, D34).**
- Pieces already down are drawn in `--slab-side` with no grooves.
- The next piece is full `--track-fill` with grooves and a 3px `--ink` edge.
- The see-through copy (D28) is `--track-fill` at `--ghost-opacity` with the same opaque 3px `--ink` edge.
- Join rings are the armed-end mark: a `--paper` disc with a 3px `--ink` ring, camera-facing and always on top, one per joined end.
- On steps that start a new run, the overview fills the picture, with a square close-up of the next piece in one corner (paper ground, ink edge, the same camera direction). A thin `--ink` line runs from the inset to the piece's spot.

**Warnings (D44, D52).**
- These use the verdict line's glyph, colour token and sentence, at code size:
  - the step-0 verdict
  - "won't meet" (beyond), in the verdict's own words
  - "This run of track couldn't be checked." with its reason
- The bend note is plain `--ink`.

**Band cards (D41).** They use the same layout as a piece step. The picture shows everything down so far with no highlight. The label block reads "Floor done." at name size and "Now the ramps that climb to level 1." at code size. There is no border, shadow or panel.

**Last screen (D38).**
- "That's the last piece." at name size, then "All N pieces are down." in `.num`.
- If the verdict isn't a pass, its glyph and sentence follow.
- Then Back to editor (primary) and Print the sheet.

**States (D37, D36).**
- The current step stays until the next picture has drawn. Then picture, label and counter change in the same frame.
- Past 300 ms, the counter reads "Drawing…" in `--ink-soft`.
- The quiet lines (D12) show once per visit, on whichever screen they happen, in the kept space, and are announced.

**Motion (D46).** Every change is an instant cut. `--settle-ms` is never used in build mode. A test asserts there is no transition or animation CSS on the build-mode root.

**Input (D40, D50, D51).**
- After a new step has drawn, taps are ignored for 400 ms. Key auto-repeat is ignored.
- On step screens there are only two visible controls, Back to editor and Print the sheet. They are 48px outline buttons in the label block's end corner, with `--s4` around them where taps do nothing.
- "Previous step" and "Next step" are real buttons. They stay visually hidden until they get keyboard focus, then show at 48px. They are always available to screen readers.
- On entry, focus goes to the build region, labelled "Build mode, step 12 of 34". On exit it returns to Build it.

**Layout (D49).**
- Landscape (aspect 1.2 or wider): the picture sits beside a `--paper` label column, about 68/32, with `--s5` padding and text top-aligned.
- Portrait and phones: the picture takes about 65% of the height, with the label block after it.
- Desktop: the same rule inside the window, with the picture at most 1400px wide.
- Text never shrinks; the picture takes the space that's left.

**Sheet (D47, D48, D53).**
- Page 1 opens with "Build order" (Plex Sans 600, 18pt), then "N pieces · date · ChooChooCAD" in 9pt `--ink-soft`, then the verdict block with its glyph. Later pages carry a 9pt running header with "page n of m".
- The current band is drawn as 0.75pt `--ink` outlines on white. Earlier bands use a `--rule` fill with no outline.
- Step numbers are `.num` at 8pt or larger, in a white disc with a 0.75pt `--ink` ring. A number that still collides moves to the nearest free spot, with a 0.5pt `--ink` leader line back to its piece.
- A step with a note gets an asterisk on its number, and the sentence goes in the step table.
- A band split across pages gets a small band map on each page with that page's area outlined, plus matching edge labels (A1→A2).

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (11 rules); full UI scope |
  | Step 0               | 5/10 initial; all 7 dimensions; no mockups  |
  | Pass 1  (Info Arch)  | 6/10 → 9/10 after fixes (D32-D34)          |
  | Pass 2  (States)     | 5/10 → 9/10 after fixes (D35-D38)          |
  | Pass 3  (Journey)    | 6/10 → 9/10 after fixes (D39, D40)         |
  | Pass 4  (AI Slop)    | 8/10 → 9/10 after fixes (D41)              |
  | Pass 5  (Design Sys) | 4/10 → 9/10 after fixes (D42-D48)          |
  | Pass 6  (Responsive) | 4/10 → 9/10 after fixes (D49-D51)          |
  | Pass 7  (Decisions)  | 2 resolved (D52, D53), 0 deferred          |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items proposed                            |
  | Approved Mockups     | 0 generated, 0 approved                     |
  | Decisions made       | 22 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 4/10 → 9/10                                 |
  +====================================================================+
```

Each pass stops at 9 because there are no rendered mockups yet. Pixel-level judgement waits for /design-review on the live build.

**Storyboard (Pass 3):**
```
STEP | USER DOES                     | FEELS                 | SPECIFIED BY
1    | taps Build it                 | curious               | scope 1
2    | reads pull list, gets parts   | prepared / short of X | D32, E1, D39
3    | taps through floor pieces     | rhythm, confidence    | D37, D40, D42
4    | band card                     | a breather            | E4, D41
5    | a loop closes                 | reassured             | D7, D15, D44
6    | leaves, comes back later      | expects to resume     | D35, D36
7    | last piece                    | done                  | D38
```

**Litmus (outside voices):**
- Brand on the first screen: Codex said no. Addressed by D32's heading and verdict.
- Visual anchor: yes.
- Scannable: yes.
- One job per section: yes.
- Cards: no (D41).
- Motion: none (D46).
- Premium without shadows: yes.
- Hard rejections: 0.

**NOT in scope (design):**
- Mockups. The image generator needs an OpenAI key that only the owner can set up.
- A layout thumbnail on step 0 (D32 chose none).
- Celebration or animation on the last screen (D38, D46).

**What already exists:**
- DESIGN.md rules 1, 2, 3, 7, 8, 10 and 11
- tokens `--slab-side`, `--track-fill`, `--ghost-opacity`, `--rule`, `--ink`/`--ink-soft` with measured ratios, `--s1`-`--s5`
- the 2D armed-end ring and preview language
- the verdict line's glyph, colour and sentence
- the 3D view's delayed "Loading" rule (300 ms)

**Unresolved decisions:** none.

**Implementation tasks (design additions, folded into the eng tasks):**
- T2 gains the dimmed done pieces, the inked next piece, the see-through copy styling and the new-run close-up inset (D34, D42, D43).
- T3 gains the step-0 order and copy, label tokens, the adapter line, resume and changed-layout lines, the quiet-line placement, the hold-then-swap state, the 400 ms tap guard, the corner controls with their dead zone, focus-revealed Previous and Next buttons, the aspect-ratio layout, instant cuts, and the last-screen copy (D32, D33, D35-D41, D44-D46, D49-D52).
- T4 gains the sheet title, the verdict block glyph, token styling, asterisk notes, leader lines and band maps (D47, D48, D53).
- New build type tokens go in tokens.css with their measured ratios (D45).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 5 | CLEAR | 4 proposals, 4 accepted, 0 deferred |
| Outside Review | `codex exec` (plan-review) | Independent 2nd opinion | 15 | completed | CEO phase: 6 findings, 6 resolved; eng phase: 5 findings, 5 resolved; 0 unresolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 11 | ISSUES OPEN | 31 issues, 0 critical gaps (all resolved or assigned to tasks) |
| Design Review | `/plan-design-review` | UI/UX gaps | 6 | CLEAR | score: 4/10 → 9/10, 22 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** Codex (gpt-6-astra) completed the CEO, eng and design phases. In the design phase it ran with a native Claude subagent. Every finding was resolved by an owner decision: CEO D14-D19, eng D27-D31, and design folded into D32-D53.
- **CROSS-MODEL:** In the design phase, Codex and the Claude subagent agreed on the unspecified highlight versus rule 1, the missing 60cm sizes and the double-tap and navigation gaps. Codex alone found new-run framing, coincident labels and the "Built" overclaim. The subagent alone found the adapter-line order, the verdict-glyph rule 2 gap and the motion statement. No contradictions.
- **VERDICT:** CEO CLEARED. Eng is ready to implement (0 unresolved, 0 critical gaps). Design is CLEAR: 9/10 on every pass, 0 unresolved. Run /design-review on the live build.

NO UNRESOLVED DECISIONS
