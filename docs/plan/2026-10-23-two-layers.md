# Two-layer circuits

Status: CEO review in progress (2026-10-23). Nothing here is approved until the
ledger row says so.

## The ask

"I think we should start allowing 2 layered circuits." (owner, 2026-10-23)

Two levels of track: the floor and one raised level. Track on the raised level
may pass over floor track. Ramps join the two.

## What the repo already says

- The owner chose two layers at D9 of the 2026-10-07 CEO review, down from an
  instructed cap of three. The third layer is a filed P2 TODO with the upgrade
  trigger "the first layout that needs a bridge over a bridge"
  (`docs/plan/brio-TODOS.md:652`).
- The whole layer feature was deferred on 2026-10-08 with the calibration
  afternoon: "The layer work cannot start without that number"
  (`docs/plan/brio-TODOS.md:789-792`). The number is the clearance margin,
  CALIBRATION.md Q5: ramp rise minus plank thickness minus tallest vehicle.
  Plank is published (12mm). Rise (64mm) and vehicle (44mm,
  `engine/data/brio.ts:239`) are estimates. Margin today: 64 - 12 - 44 = 8mm
  [estimated].
- CALIBRATION.md Q4: is the ascending track's 216mm its run or its slope
  length? If slope, the run is about 206.34mm, irrational, and exact closure
  dies for any layout with a ramp. `engine/data/brio.ts:12` asserts "216 run";
  unmeasured. A retailer lists the two-piece set at 21.6cm long and 6cm high,
  which fits "216 run" but does not settle it.
- Supports: the 2026-10-07 review chose to STATE that supports are not checked
  rather than check them (decision 2f1af71e, TODO "Support and pier
  modelling", `docs/plan/brio-TODOS.md:681`).
- The ascending track N/N1 is not in the catalogue: "needs a rise field the
  schema does not have" (`engine/data/sources.ts:247`, `:347`).
- `Part.heightMm` exists, continuous by decision 12A
  (`engine/src/parts/schema.ts:273-279`), and nothing reads it for geometry.
- Overlap today is one flat floor: any two planks sharing more than 100mm² are
  IMPOSSIBLE unless welded or meeting end to end
  (`engine/src/graph/overlap.ts:164`). The verdict copy says "Track can only
  cross on a crossing piece or a bridge" (`app/src/VerdictLine.tsx:452`).

## Decision ledger

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| L1 (owner) | How a piece knows its level | derived from ramps along welds (level 0 floor, 1 raised); no saved field | B flag, C continuous: declined | approved | D1 answer "A) Derived from ramps", 2026-10-23. Scope: level source only |
| L2 (owner) | Ramp run: is 216mm the run? (CALIBRATION Q4) | 216 is the run: the ramp is a 216mm straight in plan that rises one level; labelled estimated; Q4 stays open | B wait, C 206: declined | approved | D2 answer "A) Take 216 as the run", 2026-10-23 |
| L3 (owner) | Bridge clearance (CALIBRATION Q5) | build on 64 - 12 - 44 = 8mm [estimated], one constant; the verdict names the estimate and that supports are not checked | B wait: declined | approved | D3 answer "A) Build on 8mm, say so", 2026-10-23 |

## Answered: L1 (D1 → A)

## currentDecision-archived (L1)
Commitment comparison:

Commitment | Source | Current | A derived | B flag | C continuous
---|---|---|---|---|---
Where level comes from | pending | none | walk over welds, ramps add +1/-1 | user sets per piece | walk heightMm, any rise
New saved field | pending | none | none (parts only) | `raised` per piece | `heightMm` per piece/anchor
Loop rise = fall check | pending | none | exact integer, at closing welds | still needed (flag vs ramp disagree) | exact only if rises are integers
Cap of two (D9) | owner D9 | 2 | enforced: level outside 0..1 refused | enforced at set time | not a level count; cap meaningless
Overlap rule | overlap.ts:164 | one floor | same level only; a ramp clashes with both | same | needs height intervals
Runs with no ramp | pending | floor | floor | can be raised alone | any height

Question: D1 — L1: How should a piece know which level it is on?
Header: Level source
A) Derived from ramps (recommended)
A ramp's high end is one level above its low end; every other piece takes the level of what it is welded to, the same way it takes its position. Effort M, risk low; no saved-file change; a loop must rise as much as it falls, checked exactly. ✅ No new saved field, so old files load unchanged and no level can disagree with the track ✅ Rise-equals-fall is an integer check at closing welds, reusing the spanning forest ❌ A raised run with no ramp (on supports only) cannot be expressed
B) A raised flag per piece
The user marks pieces as raised; ramps must sit between a floor and a raised piece. Effort M, risk medium; a new per-piece field in the saved file. ✅ Can express a raised run on supports with no ramp at all ✅ Easy to explain: select, mark raised ❌ Flag and ramps can disagree, so it needs the same consistency check as A plus a refusal path and a saved-format change
C) Continuous height walk
Walk heightMm along welds like position, any rise, ready for risers and books. Effort L, risk high; exact only while every rise is an integer. ❌ Throws away the two-level cap you chose at D9 ✅ No later migration if risers arrive ✅ Matches decision 12A's continuous field

## Answered: L2 (D2 → A)

## currentDecision-archived (L2)
Commitment comparison:

Commitment | Source | Current | A run=216 | B wait | C slope, 206
---|---|---|---|---|---
Ramp footprint length | Q4 | none | 216, a plain straight in the lattice | none until measured | 206, rounded, per-ramp error stated
Exact closure with ramps | product claim | n/a | kept | n/a | lost: each ramp carries ~0.34mm stated error
Provenance label | T46 | n/a | estimated, Q4 still open | n/a | estimated
Feature start | pending | blocked | now | after the afternoon | now
Evidence | retailer: set 21.6cm long, 6cm high | | fits a 216 run | | contradicts the retailer box

Question: D2 — L2: Do we take the ramp's 216mm as the ground it covers?
Header: Ramp run
A) Take 216 as the run (recommended)
Treat the ascending track as a 216mm straight on the floor plan that rises one level; label it estimated and leave Q4 open on the calibration sheet. Effort S, risk low. ✅ Exact closure survives ramps; the ramp is a plain straight to the engine ✅ Matches brio.ts:12 and a retailer's 21.6cm box length ❌ If the tape says slope, every ramp layout is off by about 9.7mm per ramp
B) Wait for the tape measure
Do not start layers until Q4 is measured on real track. Effort S (zero implementation), risk low. ✅ Nothing built on an unmeasured number ✅ One tape measure settles it ❌ Layers wait on an afternoon that has been deferred since 2026-10-08
C) Slope: round the run to 206
Treat 216 as the slope length and round the run to 206mm, stating the per-ramp error. Effort M, risk medium. ✅ Safe if 216 really is the slope ❌ Ramps leave the exact lattice: every ramp loop carries a stated error ❌ Contradicts the retailer box length

## Answered: L3 (D3 → A)

## currentDecision-archived (L3)
Commitment comparison:

Commitment | Source | Current | A build on 8mm, stated | B wait
---|---|---|---|---
Clearance figure | Q5 | 8mm, two of three numbers estimated | 8mm [estimated], one constant | measured first
What the verdict says over a crossing | pending | n/a | crossing allowed; the note names the estimate and that supports are not checked (decision 2f1af71e) | n/a
Feature start | pending | blocked | now | after the afternoon

Question: D3 — L3: Build bridges on the estimated 8mm clearance?
Header: Clearance
A) Build on 8mm, say so (recommended)
Allow track to pass under the raised level using the 8mm estimate, and say in the verdict that clearance and supports are not measured or checked. Effort S, risk medium. ✅ Layers ship now ✅ The verdict is honest about the guess, as the EXCEEDS decision of 2026-10-19 requires ❌ If a real train is taller than 52mm, a bridge the app accepts will not pass
B) Wait for the afternoon
Measure the rise and your tallest train before any bridge is allowed. Effort S (zero implementation), risk low. ✅ No bridge accepted on a guess ✅ CALIBRATION.md's contingency table says exactly what to do with the result ❌ Layers wait on the afternoon

## Planned file changes (estimate, for mode selection)

engine: parts/schema.ts (ramp rise), data/brio.ts (N ramp), data/sources.ts
(unblock N), graph/levels.ts (new: level walk and rise-equals-fall),
graph/overlap.ts (same level only), graph/solve.ts (verdict fields).
app: layoutModel.ts (ghost and drop fit by level), TrackCanvas.tsx (draw
raised over floor), app.css, VerdictLine.tsx (copy), GraphListing.tsx (level
in the list), App.tsx (palette, notes).
tests: levels.test.ts, plankOverlap.test.ts, a views test, a dom test.
About 17 files [estimated].

## Mode

Mode: SCOPE REDUCTION; approved decisions: L1 (D1 A), L2 (D2 A), L3 (D3 A).
Provenance: actual question answer, "Scope reduction (recommended)", 2026-10-23.

## Proposed minimum core (pending per-item decisions below)

1. Ramp part N (BRIO 33332) in the catalogue: 216mm run, rises one level, estimated.
2. Level walk over the spanning forest: ramps step +1/-1, everything else inherits; rise equals fall checked at closing welds; level outside 0..1 refused.
3. Overlap only within a level; a ramp clashes with both levels.
4. Verdict: crossings between levels allowed; a note names the 8mm estimate and that supports are not checked; IMPOSSIBLE for a loop that does not rise as it falls and for a third level.
5. Ghost, drop and move checks see levels.
6. Raised pieces drawn after floor pieces.
7. "raised" in the piece list; the level in placing announcements (R2).

## NOT in scope

- A distinct raised look: deferred (R1, D4), filed in brio-TODOS.md.
- Bridge pieces, supports and piers: TODO "Support and pier modelling" stands (decision 2f1af71e).
- A third level: TODO "A third layer" stands; its trigger has not fired.
- Curved ascending track: not in the catalogue.
- Measuring Q4/Q5: the calibration afternoon stays deferred; L2 and L3 build on estimates.

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| R1 (owner) | A raised look for raised track (DESIGN.md rule 2: shape carries meaning) | DEFERRED to brio-TODOS.md (P1, design pass) | B keep: declined | deferred | D4 answer "A) Defer to TODOS.md", 2026-10-23 |
| R2 (owner) | Level in the piece list and announcements | KEPT: "raised" in the list, the level in placing announcements | B defer: declined | approved | D5 answer "A) Keep it in scope", 2026-10-23 |

## Section 1: Architecture

```
 saved layout (unchanged)              catalogue: + ramp N (rise 1, estimated)
        |                                        |
        v                                        v
  spanningForest --> placeAll --> frames (pos, heading)  + level per piece
                         |                         `- ramp port 1 = level + 1
                         v
        connectorSites  (the one shared "which ends share a spot" key)
         |-> findVertexClashes
         |-> landingOf -> ghostFit / drop guard / moveRun / autoJoin
         `-> findPlankOverlaps   + same level only; a ramp is both
                                |
  levels check: rise = fall at closing welds; span <= 2 levels
                                v
                     solveGraph verdict -> VerdictLine, list, canvas order
```

Finding A1 (CRITICAL GAP): `connectorSites` keys ends by plan position only
(`engine/src/graph/feasible.ts:166`), and clashes, the preview, the drop guard,
auto-join and moveRun all read it. A raised end above a floor end would clash
or auto-join.

Note (covered by L1/D1): levels are relative per run, normalised so the lowest
piece is the floor; a down-ramp from a floor loop raises that loop, and the
announcement says so.

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| A1 (Section 1) | Ends at one spot on different levels | Frame gains `level`; compose adds a port's rise; the connectorSites key is level + position; levels normalised per run (lowest = 0), never saved | B map, C leave: declined | approved | D6 answer "A) Level in the frame", 2026-10-23 |
| E1 (Section 2) | Preview and drop for a level fault (third level, loop that does not come down) | ghostFit reports a `level` conflict with its reason; a drop or run move that causes one is refused with the same reason | B verdict only: declined | approved | D7 answer "A) Yes, as a conflict", 2026-10-23 |
| S1 (Section 3) | A submission cannot change a part's rise | rise comes from the built-in only: a stored submission's rise is ignored and a correction of a rising part keeps the built-in rise, as `endCount` does (library.ts:103) | B validate: declined | approved | D8 answer "A) The built-in only", 2026-10-23 |
| I1 (Section 4) | Removing a ramp from a bridge | a split captures the cut-off half's level in its anchor, as positions are captured today; saved anchors gain an optional `level` (0 or 1, absent = floor; any other value is dropped on load like an out-of-range heading, E9); a run's levels start from its root anchor's level, then shift up if any piece would sit below the floor | B fall: declined | approved | D9 answer "A) It stays raised", 2026-10-23. Amends L1/A1 "never saved" for anchors only |

## Answered: A1 (D6 → A)

## currentDecision-archived (A1)
Commitment | Source | Current | A level in Frame | B level map | C leave
---|---|---|---|---|---
Where level lives | L1 | none | Frame.level, compose adds port rise | Placement.levels map | none
Spot key | feasible.ts:166 | xy | level + xy, one place | level + xy, each caller passes level | xy
Callers changed | | | none beyond the key (frames carry it) | ghostFit, moveRun, autoJoin, landingOf each | none
Saved anchors | layoutStore.ts:71 | pos, heading | level not saved: normalised per run | not saved | n/a
Raised end over floor end | | clash | no clash, no join | no clash, no join | clash, or a wrong join

Question: D6 — A1: How do ends on different levels stay apart?
Header: Level key
A) Level in the frame (recommended)
B) A separate level map
C) Leave the key as it is

## Section 2: Error and rescue map

```
CODEPATH                     | WHAT CAN GO WRONG                       | CLASS / RESULT
-----------------------------|-----------------------------------------|------------------------------
level walk (placeAll)        | closing weld joins two levels            | LevelMismatch -> IMPOSSIBLE
                             | run spans 3 levels                       | ThirdLevel -> IMPOSSIBLE
                             | run has no ramp                          | none: level 0
overlap (same level only)    | raised over floor                        | allowed, clearance note (L3)
                             | anything over a ramp                     | PlankOverlap -> IMPOSSIBLE
connectorSites (A1)          | raised end over floor end                | separate spots: no clash
ghostFit / drop / moveRun    | placing makes a third level or a mismatch| E1: pending
load (layoutStore)           | old file, no ramps                       | every piece level 0, verdict unchanged
                             | file with N in an older build            | unknown part: existing loader refusal
```

Nothing throws on the new paths; each fault becomes a verdict reason with a
place to mark. Gap E1: a preview or drop that creates a level fault is not
flagged until after it is placed.

## Answered: E1 (D7 → A)

## currentDecision-archived (E1)
Question: D7 — E1: Should the preview and the drop flag a level fault?
A) Yes, as a conflict (recommended)
B) Verdict only

## Section 3: Security and threat model

No new endpoint, secret, dependency or network path. The one new input is the
part record's rise, and part records also arrive from storage as user
submissions.

Finding S1: `looksLikePart` (`engine/data/library.ts:160`) checks known fields
and passes the object through, so a stored submission carrying a rise field
would load as a ramp. And `resolveLibrary` (`library.ts:104`) replaces a
built-in with a better-ranked submission of the same id: the ramp N is
`estimated`, so any "measured" correction of N without a rise silently turns
the ramp flat. Threat: corrupted or hand-edited storage; likelihood low, impact
medium (verdicts change with no visible cause). Precedent: `endCount`
(`library.ts:103`) already refuses a submission that changes a part's end count.

## Answered: S1 (D8 → A)

## currentDecision-archived (S1)
Question: D8 — S1: Where does a part's rise come from?
A) The built-in only (recommended)
B) Validate it on submissions

## Section 4: Data flow and interaction edge cases

```
place/drop/move -> placeAll (frames + level) -> normalise per run (lowest = 0)
   -> connectorSites (level + xy) -> landing / overlap / level faults
   -> verdict + announcement
shadow: no ramp -> all 0; third level -> conflict (E1); mismatch -> conflict (E1)
```

INTERACTION | EDGE CASE | HANDLED? | HOW
---|---|---|---
Place a ramp at an end | up or down | yes | R steps through the ports, as today: entering at the low end climbs, at the high end descends
Ramp down from a floor loop | the loop must become raised | yes | normalisation; announcement says the run is now raised (L1)
Drag a raised run over floor track | allowed | yes | same-level overlap (core 3) and level spot key (A1)
Undo/redo | levels | yes | derived from the graph snapshot; nothing stored
Remove the only ramp of a bridge | raised half has no ramp | GAP I1 | the half drops to the floor and overlaps the track under it, which breaks "remove never moves surviving track" (2026-10-22, D19:A)
Very large layouts | level walk | yes | one pass over the existing forest

No async ordering: every path is synchronous over an immutable graph.

## Answered: I1 (D9 → A)

## currentDecision-archived (I1)
Question: D9 — I1: When a ramp is removed, does the raised half stay raised?
A) It stays raised: the anchor keeps its level (recommended)
B) It falls to the floor, announced

## Section 5: Code quality

- One engine function answers "what level faults does this layout have", read
  by both the verdict and the preview/drop (E1). Two copies could disagree,
  which is what decision D2 of 2026-10-22 forbids for the spot key. Determined
  by E1 and A1; no new behaviour.
- Names: `Port.rise` (levels gained from the entry, 0 or 1), `Frame.level`.
  `compose` adds the local rise; `IDENTITY.level` is 0.
- `findPlankOverlaps` reads a level per segment; a ramp's segment carries both.
- Nothing new branches more than five ways. No issues beyond the above.

## Section 6: Tests

Every pin records a mutation that is RUN, per CLAUDE.md.

NEW THING | TEST | HAPPY | FAILURE | EDGE
---|---|---|---|---
level walk | engine unit (levels.test.ts) | bridge loop: up ramp, raised run over a floor straight, down ramp, verdict closes | loop with one up ramp only: mismatch at the closing weld | down ramp from a floor loop raises it; run with no ramp all 0
third level | engine unit | n/a | two up ramps in series: third level | anchored raised run plus an up ramp
overlap by level | plankOverlap.test.ts | raised over floor: no overlap | floor over floor: overlap kept | a ramp under raised track: overlap
spot key (A1) | feasible test | raised end over floor end: no clash, no join | same-level coincidence: clash kept | ghost raised end over a free floor end: clear
preview/drop (E1) | app unit + dom | n/a | ghost making a third level: red with the reason; drop refused | run move that mismatches: refused
rise source (S1) | trustBoundary test | built-in N rises | stored part with a rise: flat; measured correction of N: keeps rise | n/a
split level (I1) | layoutStore + edit tests | remove a bridge ramp: raised half stays raised, reload keeps it | anchor level 7: dropped to floor | old file: unchanged
regression | existing differential and fixture suites | every existing layout gives the same verdict | n/a | n/a
copy (R2, L3) | views test | list says raised; note names 8mm estimate and unchecked supports | n/a | no note when nothing crosses

2am-Friday test: the bridge loop fixture, end to end through solveGraph,
plus "every existing fixture unchanged".
Hostile QA: a ramp pair built down-then-up from a floor run, and deleting
each piece of a bridge one at a time.

## Section 7: Performance

The level walk rides the existing forest pass, O(pieces). The spot key grows
by one integer. Overlap does strictly less work (cross-level pairs skipped).
Drawing order makes two passes over the same segments, the same tag count.
No issues found.

## Section 8: Observability

Client-only app with no telemetry. The debugging record is the crash repro
(`app/src/repro.ts`), which copies the stored layout: it carries the new
anchor level because that is part of the saved anchors. Each level fault is a
named verdict reason with a canvas mark and an announcement. No issues found.

## Section 9: Deployment and rollback

No deploy target; ships as a merged PR. Saved format gains one optional
anchor field (I1); files without it load unchanged. Rollback: revert the PR. A file saved with ramps then loads in the old build
with N unknown, which the existing loader reports. CORRECTED by OV5: a
ramp-less raised run (I1) loads in the old build with its anchor level
silently dropped, so it lands on the floor. Accepted at D14 and stated in the
PR body; no storage guard.

## Section 10: Long-term trajectory

Debt: two estimated numbers (Q4 run, Q5 clearance) behind one constant each,
labelled in the verdict. The third-layer TODO gets cheaper: levels are
integers already, so widening the cap is a bound change plus the faults.
Reversibility 4/5: one optional saved field. No issues found.

## Section 11: Design and UX

UI scope: ramp in the palette, the clearance note, two new fault reasons and
their marks, the list and announcement words, the preview's level conflict,
drawing order.

FEATURE | EMPTY | ERROR | SUCCESS | PARTIAL
---|---|---|---|---
bridge | no ramps: nothing new shown | mismatch or third level: red reason, mark at the spot | crossing allowed, note names the estimate | ramp placed, loop open: plain open-loop verdict

DESIGN.md: the new copy uses `.num` for numbers (rule 4) and no directional
words (rule 7); new marks are shape-coded (rule 2). The raised look itself is
deferred (R1). Recommend /plan-design-review before building.

## Outside voice (Codex, gpt-6-astra, completed)

Five findings, all verified against the source:
- OV1 High: `ghostFit` checks only the new piece (layoutModel.ts:346, :405); a placement that re-levels a run is never checked against the pieces whose level changed.
- OV2 High: `residuals.closes` is position and heading only (frames.ts:181); `openUnmetJoins` (edit.ts:71) trusts it, so a level-mismatched weld can steer placement after a delete.
- OV3 Medium: `snapRunMove` ranks targets by plan distance over `sites.placed` (layoutModel.ts:709), so an end on the other level can attract a drag.
- OV4 Medium: hit targets for ends and joints are overlays above all track (TrackCanvas.tsx:748, :854), so a floor end under a bridge takes clicks meant for the bridge.
- OV5 Medium: the old loader keeps only pos and heading (layoutStore.ts:493); reverting silently flattens a ramp-less raised run. Section 9's "rollback: revert the PR" was wrong as written.

| ID and owner | Contract and evidence | Current | Proposed | Status | Exact approval and scope |
|---|---|---|---|---|---|
| OV1 (outside) | Preview of a re-levelling placement | when a placement shifts any existing piece's level, ghostFit and the drop check the whole candidate layout for overlaps and level faults; otherwise the local check stands | B keep local: declined | approved | D10 answer "A) Apply: full check on re-level", 2026-10-23 |
| OV2 (outside) | Level mismatch in residuals | `WeldResidual` gains `levelSteps`; `closes` requires gap 0, heading 0 and level 0; the verdict names a level mismatch as its own reason, never as a 0mm gap; openUnmetJoins opens such welds | B separate: declined | approved | D11 answer "A) Apply: meets needs equal levels", 2026-10-23 |
| OV3 (outside) | Snap across levels | snapRunMove considers only free ends on the moved end's level | B keep: declined | approved | D12 answer "A) Apply: same-level snap only", 2026-10-23 |
| OV4 (outside) | Click targets at crossings | the canvas draws floor track and its targets, then raised track and its targets; floor ends under a bridge stay reachable through the piece list | B defer: declined | approved | D13 answer "A) Apply: raised targets on top", 2026-10-23 |
| OV5 (outside) | Rollback of saved raised runs | no guard; the PR body and Section 9 state that a revert flattens ramp-less raised runs | B storage key: declined | approved | D14 answer "A) State the risk, no guard", 2026-10-23. Accepted shortcut, completeness 7/10 |

Approval readiness: PASS. Checked rows and answers: L1 (D1 A), L2 (D2 A),
L3 (D3 A), R1 deferred (D4 A), R2 (D5 A), A1 (D6 A), E1 (D7 A), S1 (D8 A),
I1 (D9 A), OV1 (D10 A), OV2 (D11 A), OV3 (D12 A), OV4 (D13 A), OV5 (D14 A),
TODO custom ramps skipped (D15 B). Mode: SCOPE REDUCTION (answered). No
unanswered rows.

# Accepted plan (what to build)

Engine
1. Ramp N (BRIO 33332) in the built-in catalogue: a 216mm straight in plan,
   `Port.rise` 1 at its far end, `estimated` (L2). `sources.ts` stops listing
   N as blocked.
2. `Frame.level`: `compose` adds the local port's rise; `IDENTITY.level` 0;
   placeAll starts each run from its root anchor's level (absent = 0) and
   shifts the run up if any piece would sit below the floor (L1, A1, I1).
3. `WeldResidual.levelSteps`; `closes` needs gap 0, heading 0 and level 0
   (OV2). The verdict reports a level mismatch as its own reason.
4. One engine function for level faults (third level; loop that does not come
   back down), read by the verdict and by the preview/drop (E1, Section 5).
5. `connectorSites` keys ends by level and position (A1); `PlacedPort` carries
   its level.
6. `findPlankOverlaps`: only same-level pairs; a ramp's segment counts on both
   levels.
7. Rise comes from the built-in only: a stored submission's rise is ignored;
   a correction of a rising part keeps the built-in rise (S1).
8. A split captures the cut-off half's level in its anchor (I1).

App
9. ghostFit reports a `level` conflict with its reason; a drop or run move that
   causes one is refused with the same reason (E1). When a placement shifts any
   existing piece's level, the preview and drop check the whole candidate
   layout (OV1).
10. snapRunMove considers only free ends on the moved end's level (OV3).
11. Canvas draws floor track and its click targets, then raised track and its
    targets (core 6, OV4).
12. Saved anchors gain optional `level` (0 or 1); any other value is dropped on
    load like an out-of-range heading (I1).
13. Verdict note when any track crosses another level: clearance 8mm estimated
    (64 rise, 12 plank, 44 train), supports not checked (L3). Numbers in
    `.num`, no directional words.
14. "raised" in the piece list; the level in placing announcements, including
    "the run is now raised" when a ramp re-levels a run (R2, L1 note).
15. PR body states: reverting flattens ramp-less raised runs (OV5).

## NOT in scope

- A distinct raised look: deferred to brio-TODOS.md (D4 A).
- Custom and third-party ramps: skipped (D15 B); S1 keeps rise built-in only.
- A storage guard against a revert: declined (D14 A), logged as an accepted
  shortcut (decision 4483263e).
- Supports, piers, bridge pieces; a third level; curved ramps: existing TODOs
  stand, untouched by this review.
- Measuring Q4/Q5: deferred with the calibration afternoon; L2 and L3 build on
  labelled estimates.

## What already exists

- Spanning forest and placeAll (`frames.ts:70`): the level walk rides it.
- `connectorSites` as the single spot key (`feasible.ts:144`): A1 changes it
  once and five callers inherit.
- `findPlankOverlaps` (`overlap.ts:164`): gains a level filter.
- `openUnmetJoins` (`edit.ts:71`): inherits OV2 through `closes`.
- Anchor capture on split (`model.ts:126`): carries level for I1.
- `endCount` guard (`library.ts:103`): the pattern S1 copies.
- Out-of-range heading drop on load (`layoutStore.ts:489`): the pattern for
  anchor level validation.
- Full-check-on-join in the preview (`App.tsx:810`): the pattern OV1 copies.
- `Part.heightMm` (`schema.ts:279`): left alone; levels are integers.

## Dream state delta

CURRENT: one flat floor; any crossing is IMPOSSIBLE. THIS PLAN: two levels,
ramps, bridges over floor track, faults flagged before placing. 12-MONTH
IDEAL: measured clearance, a raised look, supports, a third level and printed
ramps. This plan is on that path and makes the third level a bound change.

## Error and rescue registry

CODEPATH | FAILURE | RESCUED | USER SEES
---|---|---|---
placeAll level walk | run below floor | shift up (normalise) | nothing wrong; announcement if re-levelled
residuals (OV2) | level mismatch at a closing weld | verdict reason | "this loop doesn't come back down", mark at the weld
level faults | third level | verdict reason; preview conflict; drop refused | reason and mark
ghostFit (E1, OV1) | placement re-levels a run into other track | full check | red preview, refused drop
snapRunMove (OV3) | other-level end in range | filtered | no snap
load anchor level | not 0 or 1 | dropped, counted as today | the existing dropped-anchor notice
library load (S1) | stored rise | ignored | nothing

## Failure modes registry

```
CODEPATH        | FAILURE MODE                  | RESCUED? | TEST? | USER SEES?        | LOGGED?
----------------|-------------------------------|----------|-------|-------------------|--------
levels walk     | mismatch at closing weld      | Y        | Y     | verdict reason    | n/a (client)
levels walk     | third level                   | Y        | Y     | reason + mark     | n/a
ghostFit        | re-level into other track     | Y (OV1)  | Y     | red preview       | n/a
snapRunMove     | cross-level snap              | Y (OV3)  | Y     | no snap           | n/a
canvas clicks   | floor target under bridge     | Y (OV4)  | Y     | raised wins       | n/a
edit removePiece| re-level via mismatched weld  | Y (OV2)  | Y     | nothing moves     | n/a
layoutStore load| bad anchor level              | Y        | Y     | dropped-anchor msg| n/a
revert of PR    | ramp-less raised run flattens | N        | N     | silent            | n/a  <- accepted (D14 A), stated in PR
```

No CRITICAL GAP: the one unrescued silent row is an accepted, logged shortcut.

## Diagrams

Produced: system architecture (Section 1), data flow with shadow paths
(Section 4), error flow (registry above). No new state machine: a level is a
pure function of the graph. Deployment and rollback: a merged PR and a revert
(Section 9). Stale diagram audit: the ASCII block in `feasible.ts` describing
the spot key (`feasible.ts:133-143`) will need "level and position" when A1
lands; no other diagram in the touched files describes positions only.

## Reality rows

REALITY: premise-table   pass     12 claims, all with receipts (brio-TODOS.md:652, :789; CALIBRATION.md:138-180; brio.ts:12, :239; schema.ts:273; sources.ts:247; overlap.ts:164; feasible.ts:166; library.ts:103-104, :160; layoutStore.ts:493), unverified=2 (ramp rise 64mm, vehicle 44mm: estimates by design)
REALITY: already-done    pass     git log origin/main --since=2026-10-20 -i --grep "level|layer|ramp|elevat|bridge": 4 hits (791f278, 494469e, 57963c1, 4ee00ba), none implement levels (wording only)
REALITY: surface-check   pass     no CLI command, flag or route is added; commands used (bun run test/typecheck/build) exist in package.json:6
REALITY: binding-decisions finding D19:A (remove never moves surviving track) forced I1 and OV2; D2 of 2026-10-22 (one spot key) forced A1; D9 cap of two kept; decision 2f1af71e (state, don't check supports) kept in L3
REALITY: numbers         pass     8mm = 64 - 12 - 44 [estimated: CALIBRATION.md:176]; 206.34 = sqrt(216^2-64^2) [measured: arithmetic]; 9.7mm/ramp = 216 - 206.34 [derived]; about 17 files [estimated]
REALITY: deferred-asks   pass     no linked issue; the original brief's "multiple levels, bridges" (open-work.md:846) is now partly carried: levels and bridges yes, supports no
REALITY: pr-count        pass     no .gstack/ship-policy.json; one PR, branched from main after the previous merge; base main at commit 6e013ac (memory: do not stack PRs)
PLAN_REALITY: 7/7 rows present, unverified=2

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.
Ratios assumed: features ~30x, tests ~50x.

- [ ] **T1 (P1, human: ~1 day / CC: ~30min)** — engine — Frame.level, Port.rise, ramp N, level-normalised placeAll
  - Surfaced by: L1, L2, A1, I1
  - Files: engine/src/graph/model.ts, engine/src/graph/frames.ts, engine/data/brio.ts, engine/data/sources.ts, engine/src/parts/schema.ts
  - Verify: levels.test.ts bridge loop and down-ramp re-level; mutation run per CLAUDE.md
- [ ] **T2 (P1, human: ~4h / CC: ~15min)** — engine — level in residuals, level faults, spot key, overlap filter
  - Surfaced by: OV2, E1, A1, core 3
  - Files: engine/src/graph/frames.ts, engine/src/graph/feasible.ts, engine/src/graph/overlap.ts, engine/src/graph/solve.ts, engine/src/graph/edit.ts
  - Verify: raised end over floor end neither clashes nor joins; mismatch opens on delete; all existing fixtures unchanged
- [ ] **T3 (P1, human: ~2h / CC: ~10min)** — engine — rise from the built-in only
  - Surfaced by: S1
  - Files: engine/data/library.ts
  - Verify: stored part with a rise loads flat; measured correction of N keeps its rise
- [ ] **T4 (P1, human: ~1 day / CC: ~30min)** — app — preview, drop, move and snap see levels
  - Surfaced by: E1, OV1, OV3
  - Files: app/src/layoutModel.ts, app/src/editorReducer.ts
  - Verify: ghost making a third level is red with the reason; re-levelling ghost gets the full check; snap ignores other-level ends
- [ ] **T5 (P1, human: ~4h / CC: ~20min)** — app — anchor level save/load and split capture
  - Surfaced by: I1
  - Files: app/src/layoutStore.ts, engine/src/graph/edit.ts
  - Verify: remove a bridge's ramp, reload, raised half still raised; anchor level 7 dropped
- [ ] **T6 (P1, human: ~1 day / CC: ~30min)** — app — canvas order and click targets by level
  - Surfaced by: core 6, OV4
  - Files: app/src/TrackCanvas.tsx, app/src/app.css
  - Verify: dom test: click on a bridge over a floor joint selects the bridge
- [ ] **T7 (P1, human: ~4h / CC: ~20min)** — app — verdict note, fault reasons, list and announcements
  - Surfaced by: L3, R2, E1, OV2
  - Files: app/src/VerdictLine.tsx, app/src/GraphListing.tsx, app/src/announce.ts, app/src/App.tsx
  - Verify: views test for the 8mm note and "raised"; no note when nothing crosses
- [ ] **T8 (P2, human: ~15min / CC: ~2min)** — docs — spot-key comment, CALIBRATION Q4/Q5 note, PR body rollback warning
  - Surfaced by: stale diagram audit, OV5
  - Files: engine/src/graph/feasible.ts, CALIBRATION.md
  - Verify: read the diff

## Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SCOPE REDUCTION                             |
  | System Audit         | layers shelved 2026-10-08 on unmeasured Q4/Q5; |
  |                      | one xy spot key; flat overlap rule          |
  | Step 0               | L1 derived levels, L2 216 run, L3 8mm stated; |
  |                      | R1 raised look deferred, R2 list kept       |
  | Section 1  (Arch)    | 1 issue found (A1, critical gap, resolved)  |
  | Section 2  (Errors)  | 9 error paths mapped, 1 GAP (E1, resolved)  |
  | Section 3  (Security)| 1 issue found, 0 High severity (S1)         |
  | Section 4  (Data/UX) | 6 edge cases mapped, 1 unhandled (I1, resolved) |
  | Section 5  (Quality) | 0 issues found (one shared fault function)  |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 0 issues found                              |
  | Section 8  (Observ)  | 0 gaps found                                |
  | Section 9  (Deploy)  | 1 risk flagged (OV5, accepted)              |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 2 (Q4, Q5)  |
  | Section 11 (Design)  | 0 issues; design review recommended         |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (5 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 7 rows, 0 CRITICAL GAPS                     |
  | Failure modes        | 8 total, 0 CRITICAL GAPS                    |
  | TODOS.md updates     | 2 proposed (1 added, 1 skipped)             |
  | Scope proposals      | 0 proposed, 0 accepted (REDUCTION)          |
  | CEO plan             | skipped by mode                             |
  | Outside voice        | codex (gpt-6-astra) completed, 5 findings   |
  | Lake Score           | 8/9 recommendations chose complete option   |
  | Diagrams produced    | 3 (architecture, data flow, error flow)     |
  | Stale diagrams found | 1 (feasible.ts spot-key comment)            |
  | Unresolved decisions | 0                                           |
  | Reality rows         | 7/7 rows (PLAN_REALITY), 2 unverified       |
  +====================================================================+
```

Unresolved decisions: none.

# Eng review (2026-10-23)

Target: docs/plan/2026-10-23-two-layers.md (this file), the CEO-cleared plan.
Report file: this file. Design doc: none (owner skipped /office-hours for this
feature in the CEO review).

## Scope Challenge

What already solves each sub-problem: see "What already exists" above; every
row re-checked against source. Additional evidence for this review:
- `renderGraph` (`engine/src/graph/render.ts:60`) draws from
  `placement.frames`, so a level carried in Frame reaches the canvas segments
  with no second walk.
- The save serialiser copies anchor fields by name:
  `anchors: [...(graph.anchors ?? [])].map(([id, f]) => [id, { pos: [...f.pos], heading: f.heading }])`
  (`app/src/layoutStore.ts:552`). I1's level is dropped on save unless this
  line changes; T5 already names layoutStore.ts.
- Frame literals: 10 in source (`model.ts:63,167,189,194,265,270`,
  `layoutModel.ts:113`, `layoutStore.ts:190,274,552`), 73 in tests.

Complexity: about 17 changed files [estimated: plan task list T1-T8], 0 new
classes, 1 new module proposed in Section 5 ("one engine function" for level
faults; location unstated). Trips the 8-file gate.

Search: no new infrastructure, concurrency or framework pattern; an integer
field on an existing value type. Search not needed.

TODOS cross-reference: "A third layer" (brio-TODOS.md) gets cheaper; "A raised
look" (filed by the CEO review) depends on this; "Canvas marks keep their
screen size" applies to the new fault marks. Nothing blocks this plan.

Scope record: feature answers: none asked (no cuts proposed; CEO scope
reduction already applied); structure: Smaller arrangement (eng D1, 2026-10-23):
level faults live in engine/src/graph/frames.ts beside residuals, no levels.ts;
accepted scope: the CEO accepted plan unchanged; pending remedies: SC1.
Scope Challenge result: scope accepted as-is.

## Decision ledger (eng)

### SC1: How Frame carries its level
Finding: 1, P2, confidence 9/10, engine/src/graph/model.ts:39-43 and 63, reviewer native.
`export interface Frame { readonly pos: Cyc; readonly heading: number; }` and
`export const IDENTITY: Frame = { pos: ZERO, heading: 0 };`. 10 source and 73
test literals build frames without a level; layoutStore.ts:552 serialises
anchors field by field.
Plan baseline: A1 (CEO D6 A): Frame gains `level`; never saved except anchors (I1).
Runtime evidence: 0 levels today; every frame is implicitly floor.
Comparison grid:
Commitment | Current | A optional, absent = floor | B required
---|---|---|---
Frame type | pos, heading | `level?: number`, read only through `levelOf(f)` | `level: number`
compose / opposed / frameForPortAt | no level | write `level` only when non-zero | always write it
Existing 73 test literals and toEqual on frames | pass | pass unchanged | every literal edited
Saved files with no raised track | as today | byte-identical | gain `level: 0` unless filtered
Risk | n/a | a reader forgets levelOf and treats undefined as 0 by accident (same answer) or as NaN in arithmetic | none from absence
Question D2:
D2 — SC1: Should a frame's level be optional (missing = floor) or always present?
Header: Frame level
Options:
A) Optional, missing = floor (recommended)
B) Always present
State: approved
Actual answer: A) Optional, missing = floor (eng D2, 2026-10-23)
Accepted scope: `Frame.level?: number`; read only through `levelOf(f)` (0 when absent) in model.ts; compose, opposed and frameForPortAt write `level` only when non-zero; the saver writes anchor `level` only when non-zero; a guard spec fails if any source file outside model.ts reads `.level` on a Frame. Prior learning applied: four-regex-versions-of-an-import-guard-all-got-defeated (10/10, 2026-10-20): the guard walks the TypeScript AST (property accesses named `level` whose receiver type is Frame), not a regex.
History: none

## Eng Section 1: Architecture

```
 anchors (pos, heading, level?) ──► placeAll (forest walk; compose adds rise)
                                        │  normalise per run: shift up if any level < 0
                                        ▼
                         frames (pos, heading, level?) ───────────────┐
            ┌──────────────┬───────────────┬───────────────┐          │
            ▼              ▼               ▼               ▼          ▼
     residuals        connectorSites   renderGraph     captureAnchors  moveRun
  (closes needs       key = level+pos  segments carry  copies whole    builds the
   level 0; faults    (A1)             level; ramp =   frame (I1)      root anchor
   beside it, D1)                      both levels                     (finding 1)
            │              │               │
            ▼              ▼               ▼
        verdict      landing/clash/    overlap (same level) + canvas order (OV4)
                     snap (OV3)
```

Findings, most severe first:

1. [P1] (confidence: 9/10) app/src/layoutModel.ts:607-610 — moveRun builds the
   dragged run's new root anchor field by field:
   `const moved: Frame = { pos: add(...), heading: norm16(rootFrame.heading + move.turns) };`
   With I1, a ramp-less raised run's level lives only in its root anchor, so
   dragging it would drop it to the floor. The fix is necessary implementation
   of the approved I1 contract (a raised run stays raised; remove and move never
   change surviving track's level): moveRun copies `levelOf(rootFrame)` into
   the new anchor. Test: drag a ramp-less raised run; it stays raised.
2. [P2] (confidence: 8/10) app/src/layoutModel.ts:489 — `movesAnything`
   compares `JSON.stringify(f) !== JSON.stringify(frame)`. Auto-join's "never
   moves placed track" rule therefore depends on a canonical frame: a level of
   0 written explicitly by one path and absent from another would read as a
   move and silently refuse every auto-join. Determined by SC1 (level written
   only when non-zero, normalisation included); required test: auto-join on a
   floor layout still joins after the change.
3. Note, no issue: a manual join (editorReducer.ts:604, `weldEnds`) between a
   raised end and a floor end of two separate runs is a tree weld, so the
   second run is re-laid at the first run's level, the same way positions are
   re-laid today, and the existing moved-piece announcement counts it because
   frames compare whole. As a closing weld it fails `closes` (OV2).

Dispositions: 1 accepted under I1 (CEO D9 A), required implementation;
2 accepted under SC1 (eng D2 A), required test; 3 no change.
Distribution: no new artifact. Security: no new surface beyond S1.

## Eng Section 2: Code quality

- Level faults beside residuals in frames.ts (eng D1); one key function for
  spots (`latticeKey` gains the level, `feasible.ts:166`); one reader
  `levelOf` (SC1). No duplicated behaviour introduced.
- Naming: the schema already has `heightMm`, continuous by decision 12A
  (`schema.ts:279`), read by nothing. The plan adds an integer rise beside it.
  Two height notions on one record will confuse a reader; the new field's
  docblock must say that levels are integers by L1 and `heightMm` is unused.
- Shared-code rubric: no extraction proposed; `levelOf` has 6+ planned
  callers (compose, opposed, frameForPortAt, latticeKey, renderGraph,
  moveRun) in one module boundary.
- Stale diagram: the `connectorSites` docblock (`feasible.ts:133-143`) says
  ends are "keyed the same exact way"; update to name the level.
No issues found beyond the docblock notes, which ride the implementing commits.

## Eng Section 3: Tests (in progress)

Framework: vitest, two projects (CLAUDE.md "Testing"): node `*.test.ts`,
dom `*.dom.test.tsx`.

Finding T1: [P1] (confidence: 9/10) engine/test/differential.test.ts:67 —
`const BRIO = BUILT_IN.filter((p) => p.brand === 'BRIO' && p.kind !== 'switch').map((p) => p.id);`
feeds `randomChain` (`:74`), which draws `BRIO[Math.floor(rand() * BRIO.length)]`.
Adding N to the catalogue (a) puts a ramp into chain layouts the legacy
engine cannot express (every chain piece is laid entry first, so every ramp in
a chain climbs and a closed chain with one never comes back down), and (b)
changes BRIO.length, so every seeded random layout in the corpus changes. The
plan's regression promise, "every existing layout gives the same verdict",
would be tested against a different corpus than today's.

Finding T2 (factual mapping, no behaviour change): the schema's dimension
status has no "estimated" value (`published | community-measured |
unverified`), and engine/test/analytic.test.ts:714-726 requires every part
outside BRIO_PARTS to be unverified. L2's "labelled estimated" therefore
lands as `dimensions.status: 'unverified'` with the source naming CALIBRATION
Q4, which surfaces through the existing unverified channel (13A dotted
outline and the trust note). No question: it is the only label the schema has
for "what this number means is unconfirmed".

### T1: How ramps enter the differential harness
Finding: T1 above.
Plan baseline: CEO Section 6 regression row: "existing differential and
fixture suites: every existing layout gives the same verdict".
Runtime evidence: differential.test.ts:67 and :74 as quoted.
Comparison grid:
Commitment | Current | A freeze corpus + ramp suite | B ramps in the chain corpus
---|---|---|---
Legacy corpus | BRIO non-switch parts | same list minus rising parts, so byte-identical draws | N added; every seeded layout changes
Ramp coverage | none | new graph-only seeded enumeration: random runs with up and down ramps, asserting closes iff rise = fall and faults iff > 2 levels | chains with ramps vs a legacy verdict reduced by "a closed chain with a ramp never comes back down"
Regression promise | n/a | proven on today's exact corpus | proven on a new corpus
Question D3:
D3 — T1: How do ramps enter the differential test?
Header: Ramp harness
Options:
A) Freeze corpus, add ramp suite (recommended)
B) Ramps in the chain corpus
State: approved
Actual answer: A) Freeze corpus, add ramp suite (eng D3, 2026-10-23)
Accepted scope: differential.test.ts excludes parts with a rise from `BRIO`, with a comment naming why, so the seeded corpus is byte-identical; a new engine/test/levels.test.ts seeded enumeration builds runs with up and down ramps and asserts the level residual of each closing weld is zero iff the signed rises around its loop balance (planar closure still also needs gap 0 and heading 0), a level fault iff any world-space PORT sits outside levels 0..1 after normalisation (so an anchored raised run plus an up ramp is a fault), and level-blind verdict fields equal to the same run with each ramp swapped for a D straight. Corrected 2026-10-23 per eng outside voice EOV1/EOV4: the approved D3 wording ("closes only when it rises as much as it falls", "a third level is flagged") was right; this formalisation had widened it.
History: none

### Coverage diagram

```
CODE PATHS (proposed)                                   USER FLOWS
[+] engine/src/graph/model.ts                            [+] Build a bridge
  ├── levelOf / compose / opposed / frameForPortAt         ├── [GAP→planned ★★★] place up ramp, raised run over floor, down ramp, loop closes
  │   └── [GAP→planned ★★★] rise added; 0 never written     ├── [GAP→planned ★★★] [→E2E dom] click on bridge over a floor joint selects bridge (OV4)
  │       (frames toEqual unchanged; AST guard, SC1)        └── [GAP→planned ★★ ] list says "raised"; announcement "run is now raised"
[+] engine/src/graph/frames.ts                           [+] Edit a bridge
  ├── placeAll normalise (shift up)                        ├── [GAP→planned ★★★] remove the ramp: raised half stays raised; reload keeps it (I1)
  │   ├── [GAP→planned] no ramp → all floor                ├── [GAP→planned ★★★] drag a ramp-less raised run: stays raised (eng S1 #1)
  │   └── [GAP→planned] down ramp from floor → run raised  └── [GAP→planned ★★★] drag near a bridge: no cross-level snap (OV3)
  ├── residuals.closes needs level 0 (OV2)               [+] Mistakes
  │   └── [GAP→planned] delete from a level-mismatched      ├── [GAP→planned ★★★] ghost makes a third level: red, reason; drop refused (E1)
  │       loop opens the weld, nothing moves                ├── [GAP→planned ★★★] ghost raises a run into raised track: full check, red (OV1)
  └── level faults (D1)                                     └── [GAP→planned ★★ ] loop that never comes down: verdict reason + mark
      ├── [GAP→planned] mismatch                         [+] Old files
      └── [GAP→planned] third level                         └── [★★★ TESTED] every existing layout same verdict: differential corpus frozen (T1) + all fixture suites
[+] engine/src/graph/feasible.ts  latticeKey(level,pos)
  └── [GAP→planned ★★★] raised end over floor end: no clash, no join; same level: clash kept
[+] engine/src/graph/overlap.ts   same-level filter
  └── [GAP→planned ★★★] raised over floor: none; floor over floor: kept; anything over a ramp: kept
[+] engine/data/library.ts  rise from built-in (S1)
  └── [GAP→planned ★★★] stored rise ignored; measured correction of N keeps rise
[+] app/src/layoutStore.ts  anchor level save/load (I1)
  └── [GAP→planned ★★★] round trip; level 7 dropped; level 0 never written
[+] app/src/layoutModel.ts  ghostFit/moveRun/snap/movesAnything
  └── [GAP→planned ★★★] auto-join on a floor layout still joins (eng S1 #2)
[+] engine/test/levels.test.ts  seeded ramp enumeration (T1)

COVERAGE: all proposed paths have a planned test; existing behaviour covered by
the frozen differential corpus and the 820 existing specs.
```

Every planned spec follows CLAUDE.md: the mutation that breaks it is RUN and
its comment quotes the real failure. Tests made obsolete: none. Test pyramid:
mostly node unit; three dom specs (click order, drag, preview).

Dispositions: T1 accepted (eng D3 A); T2 factual, no change.

## Eng Section 4: Performance

- Level walk: one integer add per forest edge inside the existing placeAll
  pass; O(pieces). Normalise: one min over the run, O(pieces).
- Spot key: `latticeKey` gains a prefix; the map size is unchanged.
- Overlap: cross-level pairs skip the clip, strictly less work.
- OV1 full check: triggered only when a ghost's lowest level would be below
  the floor, an O(1) test on the cursor end's level and the ramp's direction;
  the full check reuses the existing join-path check (App.tsx:810), already
  measured acceptable for previews.
- Canvas: two passes over the same segments; tag count unchanged; the 10,000
  piece ceiling (decision 2026-10-15) still applies.
No issues found.

## Eng outside voice (Codex, gpt-6-astra, completed)

```
1. High — level-range oracle admits forbidden elevations (anchored raised run + up ramp spans 2 levels but reaches level 2; check every port, frames.ts:58, :82).
2. High — repair advice assumes every straight is flat: N passes isClean (repair.ts:81), removal/insert checks only planar gap (repair.ts:138), caller solve.ts:307.
3. Medium — S1 keeps rise but a correction can change N's kind to a curve (library.ts:103 guards end count only; SubmitPart.tsx:99 offers curve).
4. Medium — "closes iff rise = fall" is false: balanced ramps can still leave a planar gap (frames.ts:174).
Recommendation: revise before implementation.
```

All four verified by reading the cited lines. EOV1 and EOV4 are factual
corrections of this review's test wording back to the approved D3 text (no
behaviour change; applied above in T1's accepted scope, and the level-fault
definition is "any port outside levels 0..1", as CEO L1 already stated).
EOV2 and EOV3 need answers.

### EOV2: Repair advice and ramps
Finding: EOV2, High, confidence 9/10, engine/src/graph/repair.ts:81 `const isClean = (p: Part): p is StraightPart => p.kind === 'straight' && ...` and :138 removal by planar gap only; reviewer codex.
Plan baseline: not covered by any row.
Runtime evidence: as quoted; pieceRepair runs when the bound fails (solve.ts:307).
Comparison grid:
Commitment | Current | A exclude rising parts | B keep
---|---|---|---
Repair candidates | every clean straight | flat straights only | includes N
Removal suggestions | any clean straight in the loop | flat straights only | may remove a ramp
Question D4: D4 — EOV2: Should repair advice ever add or remove a ramp?
Options:
A) Apply: flat straights only (recommended)
B) Keep current
State: approved
Actual answer: A) Apply: flat straights only (eng D4, 2026-10-23)
Accepted scope: `isClean` in repair.ts also requires no rise, so rising parts are never repair candidates or removals; test: a balanced bridge loop with a planar gap a D straight would fix gets no ramp removal suggestion.

### EOV3: Correcting a rising part
Finding: EOV3, Medium, confidence 9/10, engine/data/library.ts:103 `if (held && endCount(held.part) !== endCount(s.part)) continue;`, SubmitPart.tsx:99 builds a curve or a straight; reviewer codex.
Plan baseline: S1 (CEO D8 A): rise from the built-in only; a correction keeps it.
Comparison grid:
Commitment | Current | A keep kind for rising parts | B keep
---|---|---|---
Correction of N as a curve | would yield a curved ramp | refused (row skipped like an end-count change) | curved ramp
Corrections of flat parts | unchanged | unchanged | unchanged
Question D5: D5 — EOV3: Can a correction turn the ramp into a curve?
Options:
A) Apply: same kind only (recommended)
B) Keep current
State: approved
Actual answer: A) Apply: same kind only (eng D5, 2026-10-23)
Accepted scope: resolveLibrary skips a submission that changes the kind of a built-in part with a rise, beside the endCount guard (library.ts:103); test: a stored curve correction of N leaves N a 216mm rising straight.

Eng approval readiness: PASS. Checked: structure (eng D1 Smaller), SC1
(eng D2 A), T1 (eng D3 A), EOV2 (eng D4 A), EOV3 (eng D5 A); Section 1
finding 1 under CEO I1 (D9 A); finding 2 under SC1; EOV1/EOV4 factual
corrections back to the approved D3 wording; regression contract carried from
CEO Section 6 and frozen by T1. No pending rows.

## Eng: NOT in scope

Nothing new deferred by this review. The CEO list above stands.

## Eng: What already exists (re-checked)

captureAnchors copies whole frames (`edit.ts:35-50`), so I1 needs no change
there; renderGraph reads `placement.frames` (`render.ts:60`); movesAnything
compares JSON frames (`layoutModel.ts:489`); repair filters with `isClean`
(`repair.ts:81`); the endCount guard (`library.ts:103`) is the model for EOV3.

## Eng: Failure modes (additions)

```
CODEPATH            | FAILURE MODE                          | TEST? | HANDLED?      | USER SEES
--------------------|---------------------------------------|-------|---------------|-----------------
moveRun             | raised ramp-less run dropped to floor | Y     | level copied  | nothing wrong
movesAnything       | level:0 written, every join "moves"   | Y     | SC1 canonical | joins still made
repair              | advice removes a ramp                 | Y     | EOV2 filter   | no such advice
resolveLibrary      | correction makes a curved ramp        | Y     | EOV3 guard    | row skipped
level faults        | anchored raised run + up ramp         | Y     | ports 0..1    | third-level fault
differential corpus | corpus shifts silently                | Y     | T1 frozen     | n/a
```
Critical gaps: 0.

## Eng: Worktree parallelization

| Step | Modules touched | Depends on |
|------|----------------|------------|
| Engine levels (frames, model, feasible, overlap, solve, repair, edit) | engine/src/graph, engine/src/parts | — |
| Catalogue and trust (N, S1, EOV3) | engine/data | — |
| Preview, drop, move, snap (E1, OV1, OV3, moveRun level) | app/src (layoutModel, editorReducer) | Engine levels |
| Saved anchors (I1) | app/src (layoutStore) | Engine levels |
| Canvas order and targets (OV4) | app/src (TrackCanvas, app.css) | Engine levels |
| Words (L3 note, R2, fault reasons) | app/src (VerdictLine, GraphListing, announce, App) | Engine levels |

Lane A: Engine levels + Catalogue (engine/; sequential, shared types).
Then Lanes B (layoutModel + editorReducer), C (layoutStore), D (TrackCanvas),
E (verdict words) in parallel; conflict flag: App.tsx is touched by B (ghost
status) and E (notes), so B and E coordinate or E lands second.
Execution order: A. Then B + C + D + E. One PR (do not stack).

## Implementation Tasks
Synthesized from the CEO and eng findings. Supersedes the CEO task list above
where they differ (eng adds T9-T12 and amends T1, T2, T4).
Ratios assumed: features ~30x, tests ~50x.

- [ ] **T1 (P1, human: ~1 day / CC: ~30min)** — engine — Frame.level (optional, SC1), Port.rise, ramp N (unverified, T2 finding), normalised placeAll
  - Surfaced by: CEO L1, L2, A1, I1; eng SC1
  - Files: engine/src/graph/model.ts, engine/src/graph/frames.ts, engine/src/parts/schema.ts, engine/data/brio.ts, engine/data/sources.ts
  - Verify: levels.test.ts; the 820 existing specs unchanged; mutation runs per CLAUDE.md
- [ ] **T2 (P1, human: ~4h / CC: ~15min)** — engine — level residual, level faults beside it (ports 0..1), spot key, overlap filter
  - Surfaced by: CEO OV2, E1, A1; eng D1, EOV1
  - Files: engine/src/graph/frames.ts, engine/src/graph/feasible.ts, engine/src/graph/overlap.ts, engine/src/graph/solve.ts, engine/src/graph/render.ts
  - Verify: anchored raised run + up ramp is a fault; raised end over floor end: no clash, no join
- [ ] **T3 (P1, human: ~2h / CC: ~10min)** — engine — rise from built-in only; corrections of rising parts keep their kind
  - Surfaced by: CEO S1; eng EOV3
  - Files: engine/data/library.ts
  - Verify: stored rise ignored; curve correction of N skipped
- [ ] **T4 (P1, human: ~1 day / CC: ~30min)** — app — preview/drop/move/snap see levels; moveRun keeps the anchor level
  - Surfaced by: CEO E1, OV1, OV3; eng Section 1 finding 1
  - Files: app/src/layoutModel.ts, app/src/editorReducer.ts
  - Verify: drag a ramp-less raised run, it stays raised; auto-join on a floor layout still joins
- [ ] **T5 (P1, human: ~4h / CC: ~20min)** — app — anchor level save (non-zero only) and load (0..1)
  - Surfaced by: CEO I1; eng scope evidence layoutStore.ts:552
  - Files: app/src/layoutStore.ts
  - Verify: remove a bridge ramp, reload, raised half stays raised
- [ ] **T6 (P1, human: ~1 day / CC: ~30min)** — app — canvas draw order and click targets by level
  - Surfaced by: CEO core 6, OV4
  - Files: app/src/TrackCanvas.tsx, app/src/app.css
  - Verify: dom spec: click on a bridge over a floor joint selects the bridge
- [ ] **T7 (P1, human: ~4h / CC: ~20min)** — app — clearance note, fault reasons, "raised" in list and announcements
  - Surfaced by: CEO L3, R2, E1, OV2
  - Files: app/src/VerdictLine.tsx, app/src/GraphListing.tsx, app/src/announce.ts, app/src/App.tsx
  - Verify: views test for the note and "raised"; no note when nothing crosses
- [ ] **T8 (P2, human: ~15min / CC: ~2min)** — docs — connectorSites docblock, rise vs heightMm docblock, CALIBRATION Q4/Q5 note, PR body revert warning
  - Surfaced by: CEO stale diagram, OV5; eng Section 2
  - Files: engine/src/graph/feasible.ts, engine/src/parts/schema.ts, CALIBRATION.md
  - Verify: read the diff
- [ ] **T9 (P1, human: ~3h / CC: ~15min)** — tests — freeze the differential corpus; seeded ramp enumeration
  - Surfaced by: eng T1 (D3 A), EOV1, EOV4
  - Files: engine/test/differential.test.ts, engine/test/levels.test.ts
  - Verify: differential draws identical to main; levels.test passes and fails under the recorded mutations
- [ ] **T10 (P1, human: ~1h / CC: ~5min)** — engine — repair never adds or removes a rising part
  - Surfaced by: eng EOV2 (D4 A)
  - Files: engine/src/graph/repair.ts, engine/test/repair.test.ts
  - Verify: balanced bridge with a planar gap gets no ramp removal advice
- [ ] **T11 (P1, human: ~1h / CC: ~10min)** — tests — AST guard: no `.level` read on a Frame outside model.ts
  - Surfaced by: eng SC1 (D2 A); prior learning four-regex-versions-of-an-import-guard-all-got-defeated
  - Files: engine/test/levelAccess.test.ts
  - Verify: injecting `f.level` in frames.ts fails the guard
- [ ] **T12 (P2, human: ~30min / CC: ~5min)** — tests — canonical frames: level 0 never serialised
  - Surfaced by: eng Section 1 finding 2
  - Files: app/src/layoutModel.test.ts
  - Verify: writing `level: 0` in normalisation fails the auto-join spec

## Eng completion summary

- Step 0: Scope Challenge — scope accepted as-is (structure: smaller arrangement)
- Reality rows: 7/7 applicable rows emitted (PLAN_REALITY phase=eng complete), 2 unverified premises
- Architecture Review: 2 issues found
- Code Quality Review: 0 issues found
- Test Review: diagram produced, 1 gap identified
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 0 items proposed to user
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed, 4 findings (2 factual corrections, 2 accepted)
- Parallelization: 5 lanes, 4 parallel / 1 sequential
- Lake Score: 4/5 = answers picking a 10/10 option / answers scored for Completeness (SC1 scored 9/9)

# Design review (2026-10-23)

Target: this plan. DESIGN.md exists (11 rules); all decisions calibrate
against it. Mockups: not generated (the gstack designer needs an OpenAI key
that is not set up). Initial rating 4/10: the plan names its UI pieces but
specifies almost none of them; a ramp would draw exactly like a D straight.

Outside voices: codex (gpt-6-astra) completed, 6 findings, no hard rejection;
Claude subagent completed, 8 findings. Merged into the passes below.

## Design decisions

| # | Issue | Decision | Answer |
|---|---|---|---|
| 1 | A legal bridge looked like an illegal overlap; a ramp like a D straight | Bridge casing: floor track gets a gap in `--floor` (the canvas ground; corrected from `--paper` by eng re-run D2) where raised track passes over it, drawn as a casing stroke. Rise chevron: an ink chevron on each ramp pointing up the slope. Both `vector-effect: non-scaling-stroke`, `pointer-events: none`, styled in app.css. The full raised look stays deferred (TODO narrowed). | 1A |
| 2 | Ramp direction and run re-levelling invisible before Place | The placing strip status adds "Climbs from the floor to the raised level." or "Comes down to the floor.", plus "Placing it raises the whole run." when normalisation would shift the run; the strip's status region announces it. | 2A |
| 3 | Caveat shown only on crossings and could be truncated | A sibling note like AdapterNote, never truncated. Whenever any track is raised: "Raised track: supports are not checked." When raised track also crosses: "It crosses other track at <num>N</num> place(s); clearance is about <num>8</num>mm (<num>64</num>mm rise, <num>12</num>mm plank, <num>44</num>mm train), estimated." N counts crossing pairs, as the overlap count does. | 3A |
| 4 | "Nothing to fix. Build it." beside the caveat | Exact layouts with raised track: "The track fits. Check the supports and the clearance under each bridge before you build." Floor-only layouts unchanged. | 4A |
| 5 | Silent no-snap near the other level; refused drags only announced | A visible status after each drop (eng re-run D1: not during the drag) showing "That end is on the other level." and every refusal reason the drag already announces (closes the backlog item "show a refused drag's reason on screen"). Correction recorded: the reviewer first claimed a visible refusal reason already existed; it does not. | 5A (asked twice, corrected) |

| 6 | New fault marks unspecified | "Loop never comes back down": a ring with a step (two short bars at different heights) at each closing joint whose levels differ, counted per joint. "Third level": a ring with a double chevron on each ramp whose high end would reach level 2, counted per ramp. Both `--fail`, 4-unit strokes in drawing units like the existing red marks (eng re-run D5), `pointer-events: none`, own classes (`level-mismatch-mark`, `third-level-mark`); a clash at the same spot wins the mark, and the sentence counts every fault and adds "N is not marked, because a clash is drawn there" as the adapter note does (eng re-run D4). | 6A |
| 7 | Rule 7 vs height words | DESIGN.md rule 7 gains: "Words for track height (floor, raised, climbs, comes down) are physical facts, not screen positions, and are allowed. 'Above' and 'below' stay banned even for height, because they read as screen positions." | 7A |
| 8 | Fault copy | Reason: "Can't be built. <num>N</num> joint(s) join track at two different levels: the loop climbs and never comes back down." Action: "Add a ramp so the loop comes back down to the level it left, or turn one ramp round." Reason: "Can't be built. <num>N</num> ramp(s) would lift track to a third level. Only two levels are supported." Action: "Turn that ramp round or remove it." | 8A |
| 9 | Crossing message points at a bridge piece | Reason ends: "Track can only cross on a crossing piece, or raised on ramps over the other track." `ACTION_WHEN_CROSSING`: "Move one of the crossing pieces so the two no longer touch, or raise one on ramps." Pinned specs updated. | 9A |
| 10 | `--fail` 1.78:1 on `--track-groove` (measured; 3.76:1 fill, 6.09:1 paper) | Every red fault mark (`clash-mark`, which crossings reuse; `bad-joint-mark`; the two new level marks) draws its red strokes over a `--paper` stroke 2 units wider, in drawing units like the red strokes (eng re-run D5; the screen-size TODO stays open for all marks); tokens.css records 6.09:1. (Reviewer first said "five marks"; there are four classes.) | 10B |
| 11 | Levels by ear in the list | Each end's description says "floor" or "raised"; ramp ends are named "low end" and "high end"; raised pieces add "raised" to their description, not their name; a joint across levels lists both. | 11A |
| 12 | Ramp in the palette | Named "Ascending track", code N, part number 33332; thumbnail carries the 1A rise chevron in ink; the existing unverified dotted outline marks it unverified; placed with the straights after D. | 12A |

Reused, not asked: placing a red preview stays allowed and a red drop stays
refused (decision of 2026-10-22, CEO E1), so a level fault in the preview
keeps "You can still place it" and a level-fault drop is refused with its
reason (codex design finding 6).

## Design storyboard (Pass 3)

```
STEP | USER DOES                     | FEELS        | PLAN SPECIFIES
1    | picks Ascending track         | curious      | chevron thumbnail, unverified outline (12A)
2    | aims it, presses R            | in control   | strip: "Climbs from the floor..." / "Comes down..." (2A)
3    | lays raised track over floor  | unsure       | casing gap shows over and under (1A)
4    | closes the loop               | rewarded     | green, caveat note, raised action (3A, 4A)
5    | adds a ramp that goes too high| corrected    | red preview + reason, double-chevron mark, exact copy (6A, 8A)
6    | drags near the bridge         | not confused | drag status: "That end is on the other level." (5A)
7    | listens via the list          | oriented     | floor/raised per end, low/high ramp ends (11A)
```
Time horizons: 5 seconds, a bridge reads as a bridge (1A); 5 minutes, every
level change is said before it happens (2A, 5A); long term, the verdict never
claims supports or clearance it did not check (3A, 4A).

## Design: NOT in scope

- The full raised look (R1): still deferred; 1A adds only the casing and the chevron.
- A hint for floor ends hidden under a bridge: filed as a P3 TODO.
- Mockups: designer unavailable (no OpenAI key).

## Design: What already exists

Strip status and glyph (socket adapter work), AdapterNote (never truncated),
the mark pattern in TrackCanvas.tsx:1065-1100, `.num`, the unverified dotted
outline, the GraphListing name/description convention, DESIGN.md rules 1-11.

## Design Implementation Tasks
Ratios assumed: features ~30x, tests ~50x.

- [ ] **DT1 (P1, human: ~4h / CC: ~20min)** — canvas — bridge casing gap and ramp rise chevron
  - Surfaced by: design 1A
  - Files: app/src/TrackCanvas.tsx, app/src/app.css
  - Verify: dom spec counts casing strokes and chevrons; the casing is a millimetre stroke (no non-scaling); the chevron is non-scaling ink like the adapter mark; both pointer-events none (corrected per eng re-run outside voice)
- [ ] **DT2 (P1, human: ~2h / CC: ~10min)** — strip — ramp direction and re-level sentence
  - Surfaced by: design 2A
  - Files: app/src/App.tsx
  - Verify: dom spec: R flips the sentence; re-levelling preview says the run will be raised
- [ ] **DT3 (P1, human: ~3h / CC: ~15min)** — verdict — raised caveat note, raised exact action, fault copy, crossing copy
  - Surfaced by: design 3A, 4A, 8A, 9A
  - Files: app/src/VerdictLine.tsx, app/src/verdictAction.ts
  - Verify: views specs for each exact string; caveat never truncated with three or more notes
- [ ] **DT4 (P1, human: ~4h / CC: ~20min)** — drag — visible drop-outcome status for the level hint and every refusal reason, shown on release (eng re-run D1)
  - Surfaced by: design 5A (closes "show a refused drag's reason on screen")
  - Files: app/src/TrackCanvas.tsx, app/src/App.tsx, app/src/usePaletteDrag.ts or the run-drag hook
  - Verify: dom spec: a refused drop shows its reason on screen until the next action; a release near an other-level end shows the hint; the existing one-solve-per-release spec still passes
- [ ] **DT5 (P1, human: ~3h / CC: ~15min)** — canvas — two level-fault marks and the paper halo on every red mark
  - Surfaced by: design 6A, 10B
  - Files: app/src/TrackCanvas.tsx, app/src/app.css, app/src/tokens.css
  - Verify: marks counted equal sentence counts; stylesheet-text spec finds the halo rule
- [ ] **DT6 (P1, human: ~3h / CC: ~15min)** — list — level per end, ramp end names
  - Surfaced by: design 11A
  - Files: app/src/GraphListing.tsx, app/src/announce.ts
  - Verify: dom spec reads "low end", "high end", "floor", "raised" from descriptions; names unchanged
- [ ] **DT7 (P2, human: ~1h / CC: ~5min)** — palette — ramp name, code and chevron thumbnail
  - Surfaced by: design 12A
  - Files: app/src/App.tsx, app/src/trackPath.ts
  - Verify: palette spec finds "Ascending track" with the chevron class
- [ ] **DT8 (P2, human: ~15min / CC: ~2min)** — docs — DESIGN.md rule 7 height-word sentence; narrow the raised-look TODO
  - Surfaced by: design 7A, 1A
  - Files: DESIGN.md, docs/plan/brio-TODOS.md
  - Verify: read the diff

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | DESIGN.md present (11 rules); UI scope: canvas,|
  |                      | strip, verdict, list, palette, drag        |
  | Step 0               | 4/10 initial; all 7 dimensions              |
  | Pass 1  (Info Arch)  | 5/10 → 8/10 after fixes                     |
  | Pass 2  (States)     | 4/10 → 9/10 after fixes                     |
  | Pass 3  (Journey)    | 6/10 → 8/10 after fixes                     |
  | Pass 4  (AI Slop)    | 3/10 → 9/10 after fixes                     |
  | Pass 5  (Design Sys) | 6/10 → 9/10 after fixes                     |
  | Pass 6  (Responsive) | 5/10 → 9/10 after fixes                     |
  | Pass 7  (Decisions)  | 1 resolved (12A), 0 deferred                |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (3 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 1 item proposed (added); 1 TODO narrowed    |
  | Approved Mockups     | 0 generated, 0 approved (designer unavailable)|
  | Decisions made       | 12 added to plan                            |
  | Decisions deferred   | 0                                           |
  | Overall design score | 3/10 → 8/10                                 |
  +====================================================================+
```

Remaining below 10: raised track that crosses nothing still looks like floor
track (R1, deferred); hidden-end hint (P3 TODO); new tokens' ratios to be
recorded at build time.

Unresolved decisions: none.

# Eng review re-run (2026-10-23), scoped to design 1A, 2A, 5A, 11A

Scope Challenge: about 7 files [estimated: TrackCanvas.tsx, app.css,
App.tsx, the run-drag hook, GraphListing.tsx, announce.ts, tokens.css], 0 new
classes: under the 8-file gate, so no structure question. Scope accepted
as-is. Design doc: none (owner skipped /office-hours for this feature).

Findings:
- RR1 [P1] (confidence: 9/10) app/src/TrackCanvas.tsx:686-688 and
  docs/plan/2026-10-22-editing-and-canvas.md:210-211 — the drag contract is
  "the dragged ink moves by an SVG transform on its group; no solve and no
  full re-render per move. One solve on release." Snapping itself happens only
  on release (`onCommit: (d) => onRunMove?.(d, 24 / ...)`, TrackCanvas.tsx:504).
  Design 5A says the status shows "during a drag", which needs per-move
  solving and breaks that contract; and the snap it explains does not exist
  until release anyway.
- RR2 [P2] (confidence: 8/10) design 1A — the overlap finder returns only a
  centroid and an area per crossing (`overlap.ts:242`), not the region, so a
  clipped gap needs new geometry. A casing stroke (each raised non-ramp piece
  drawn first as a wider stroke in the canvas ground colour) makes the same
  gap with no geometry. Factual correction: the canvas ground is `--floor`
  (`app.css:28`, `#ece6da`), not `--paper`; a gap in `--paper` would show as
  a pale outline round all raised track.
- 2A: no issue. "Placing it raises the whole run" reuses OV1's O(1) test
  (ghost's lowest level below the floor).
- 11A: no issue. Port 0 of N is always the low end (rise on port 1), so
  "low end" and "high end" are static per port; `endName` gains one branch.

### RR1: When the drag status shows
Question D1: D1 — RR1: Should the drag status show during the drag or after the drop?
Options:
A) After the drop (recommended)
B) Live during the drag
State: approved
Actual answer: A) After the drop (eng re-run D1, 2026-10-23)
Accepted scope: on release, the drop's outcome (each refusal reason the drop already announces, or "Didn't join: that end is on the other level." only when the drop joined nothing and a free end on the other level was within snap range, derived from the actual snap outcome; corrected per eng re-run outside voice finding 3) shows in a visible status on the canvas edge until the next action; nothing is checked per move (2026-10-22 drag contract kept). Amends design 5A's "during a drag".

### RR2: How the bridge gap is drawn
Question D2: D2 — RR2: Casing stroke or clipped geometry for the bridge gap?
Options:
A) Casing stroke in --floor (recommended)
B) Clip the floor plank by crossing regions
State: approved
Actual answer: A) Casing stroke in --floor (eng re-run D2, 2026-10-23)
Accepted scope: before the raised wood, each raised non-ramp piece is drawn as a stroke 8mm wider than its plank in `--floor`, butt-capped, in millimetres (geometry, so it scales); no engine change. Corrects design 1A's `--paper` to `--floor`.

### Eng re-run outside voice (codex, gpt-6-astra, completed)

Five findings (4 Medium, 1 Low), all verified. Two were corrections to this
review's own wording (the snap-hint predicate must follow the actual snap
outcome; DT1 tested the casing as non-scaling), applied above. Three needed
answers:

| ID | Finding | Answer | Accepted scope |
|---|---|---|---|
| RR3 | No truthful wording for out-of-range levels | D3 A | a preview with a level fault shows the fault's reason (8A) in the strip instead of the direction sentence; a level-2 end is described as "third level (not allowed)"; a joint across levels names both |
| RR4 | Count vs a clash hiding a level mark | D4 A | count every level fault; add "N is not marked, because a clash is drawn there", as the adapter note does |
| RR5 | Halo non-scaling, red strokes scaling | D5 A | the new marks and every halo use drawing units like the existing red marks; the screen-size TODO stays open for all marks |

Re-run approval readiness: PASS. RR1 (D1 A), RR2 (D2 A), RR3 (D3 A), RR4
(D4 A), RR5 (D5 A); corrections applied to design rows 1, 5, 6, 10 and tasks
DT1, DT4.

Re-run completion summary:
- Step 0: Scope Challenge: scope accepted as-is (about 7 files, under the gate)
- Reality rows: carried from the first eng run (7/7, 2 unverified); no new premises beyond the cited lines
- Architecture Review: 2 issues found (RR1, RR2)
- Code Quality Review: 0 issues found
- Test Review: 1 gap (DT1 test wording), corrected
- Performance Review: 0 issues found (drag contract kept by RR1)
- Failure modes: 0 critical gaps
- Unresolved decisions: 0
- Outside voice: codex (gpt-6-astra), completed, 5 findings
- Parallelization: unchanged (design tasks join lanes C, D, E)
- Lake Score: 3/5

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 4 | CLEAR | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | codex (gpt-6-astra), automatic in each review | Independent 2nd opinion | 5 | completed | CEO 5, eng 4, design 6, eng re-run 5; all resolved |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | ISSUES OPEN (all mapped to tasks) | 3 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | CLEAR | score: 3/10 → 8/10, 12 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | not run |

- **OUTSIDE COVERAGE:** codex, plan-review phase, completed in the CEO review, the eng review, the eng re-run and the design review; every finding resolved or corrected.
- **CROSS-MODEL:** In the re-run, the native pass found the drag-contract conflict and the casing technique. Codex found the count-versus-suppression contradiction, the mixed scaling, the false-hint predicate and the impossible-level wording. There was no overlap, so each caught what the other missed.
- **VERDICT:** CEO + DESIGN CLEARED. Eng review covers the whole plan, including the design additions; its log status reads issues_open only because resolved findings still count. Ready to implement.

NO UNRESOLVED DECISIONS
