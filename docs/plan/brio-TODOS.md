# TODOS — BRIO Track Designer

Created 2026-10-06 by /plan-ceo-review. The repo exists now
(`raduuuuu/brio-designer`, private); this is the exported copy that lives in
the tree, and `docs/plan/README.md` says where the canonical one is.

## DONE 2026-10-23 — A raised look for raised track

Raised track casts an offset shadow onto the floor and a ramp's shadow tapers
from its low end to its high end (owner's choice of the cast shadow over pier
marks and a heavier outline, which rule 11 reserves for selection). Recorded in
DESIGN.md rule 11; `--track-shadow` measured 3.03:1 on `--floor`.

## P3 — Point mouse users to the list for ends hidden under a bridge

**DONE (2026-10-24).** When a free floor end's centre lies on raised wood, the
canvas shows one quiet line at top left: "1 free end is under raised track.
Reach it from “This layout, as a list”." The plank test is `onPlank` in
overlap.ts. Specs: app/src/hiddenEndHint.test.ts.

**What:** When a free floor end sits under raised track, show a one-line hint
that it can be reached from the piece list.

**Why:** Raised track wins clicks where it crosses floor track (OV4 of the
2026-10-23 two-layer review), so such an end is reachable only through the
list. Keyboard users already use the list; a mouse user may not know it exists.

**Context:** Filed by the 2026-10-23 design review. Rare: needs an end exactly
under a bridge. **Effort:** human ~2h / CC ~10min. **Priority:** P3.
**Depends on:** two-layer circuits landing.

## P2 — Community custom-part registry

**What:** Let the part database accept community-defined parametric parts, so
users can register 3D-printed track pieces and design with them.

**Why:** A large ecosystem of printable BRIO-compatible parts already exists and
is in active use — 45-degree short curves, 60-degree IKEA-compatible curves,
flexible sections, ramps, and a parametric generator. No design tool can touch
any of them. This is the clearest platform play available: each registered part
makes the tool more useful to every other user.

**Pros:** Becomes the hub for the printed-track ecosystem. Compounding value per
part. Targets exactly the large-layout builders this product is aimed at, who
are the people printing custom pieces.

**Cons:** User-submitted part geometry is a new trust and moderation surface. A
wrong dimension makes the solver confidently wrong, which is the one failure
this product cannot afford.

**Context:** The enabling work is already in scope and already decided —
E5 put brand, gauge width and explicit connector geometry in the part schema;
12A made height continuous so arbitrary risers are representable; E6 provides
the backend and a moderation queue. A community part is therefore just another
row with the same fields. No new concepts are required.

What is missing: a submission flow, a review process, and a trust level per
community part. Likely shape: `trustLevel: submitted | community-confirmed |
measured`, surfaced through 13A's dotted-outline channel, which already exists
for exactly this purpose (E5's calibrationStatus).

**Sequencing note (why this is P2 and not now):** the registry's hard problem is
trusting submitted dimensions, and that cannot be solved before trust in your
OWN dimensions is solved. 8A commits to a physical calibration corpus across
five brands. Until that process exists and is proven, there is no yardstick to
judge a community part against. Build the registry after the calibration
pipeline works and community parts can be given a meaningful trust level.

**Effort:** human M → S with AI assistance
**Priority:** P2
**Depends on:** E5 part schema (in scope), E6 backend (in scope), 8A calibration
pipeline (in scope, must be working first)

---

## Recorded in the CEO plan, not yet decided

These were surfaced as delight opportunities during the expansion ceremony but
not presented as individual decisions. Full context lives in
`ceo-plans/2026-10-06-brio-track-designer.md` under "NOT in scope".

- **E7 Kid mode** (S) — big targets, no menus, drive-the-train only, layout locked
- **E8 Table / room bounds** (S) — declare your table or rug, warn on overhang
- **E9 Photo-based inventory** (L, speculative) — CV counts scattered track by type
- **E10 Symmetry / mirror + auto-complete-the-loop** (M) — pick two open ends,
  fill the gap from inventory

---

## P1 (pre-launch) — IP: data provenance and product naming

Added 2026-10-06 by /plan-eng-review (D20). Blocks public launch only; blocks
nothing in development.

**What:** two questions needing counsel, not engineering.
1. The part database is a wholesale transcription of woodenrailway.info's curated
   measurement tables. Raw measurements of physical objects are facts, but a
   curated compilation of them may be protected. Determine whether permission is
   needed, or whether the data should be independently re-derived from physical
   measurement (which T16's corpus work partly does anyway).
2. BRIO is a live trademark. No product name has actually been chosen yet — the
   plan document's title is the reviewer's working label, not a decision — so
   settle whether the eventual name may reference BRIO, or whether it must be
   descriptive with a compatibility statement instead.

**Why:** the plan carries a full COPPA and GDPR-K posture and had zero lines on
either of these. The licence question that originally accompanied them is gone:
`@salusoft89/planegcs` was LGPL-2.0-or-later and D19A removed it; the replacement
`yalps` is MIT, so there is no copyleft obligation left in the engine.

**Pros:** surfaces before launch rather than after. The provenance note is needed
regardless for T40's calibration provenance, which commits to recording raw
measurements with their derivation.

**Cons:** neither question is answerable without counsel, so this is a reminder
rather than work. The naming half may be premature.

**Context:** whoever picks this up should know that the engineering-side licence
work is already done by virtue of the D19A engine change. What remains is purely
legal.

**A third question, added 2026-10-22 by /plan-ceo-review (owner's answer to
D2).** The four switch seeds (L, M, O1, P1 in `engine/data/switchSeeds.ts`) are
dimensions read off the 3MF files of MakerWorld model 1001504 by Cactus 973,
licensed Creative Commons Attribution-NonCommercial-ShareAlike. Other MakerWorld
models were used only to compare against, and one (784269, Fantastic Plastic
Person) to confirm which end of B and C carries the pegs. The licences seen on
those pages were CC BY-NC-SA, CC BY-NC and MakerWorld's "Standard Digital File";
784269's own licence was not checked. A dimension is
probably a fact rather than a work, but the NonCommercial terms matter if the
product is ever sold, and nobody has checked whether reading measurements off a
licensed model is use of the model. This does not unblock K9 (set manifests),
which waits on the woodenrailway.info question above; MakerWorld supplies no
box contents.

**Effort:** human ~1 day of counsel time / CC: not compressible, not an AI task
**Priority:** P1 pre-launch
**Depends on / blocked by:** nothing. Should be settled before any public launch
or before the part database is published in a repo.


---

# Deferred by /plan-ceo-review 2026-10-07 (SCOPE REDUCTION)

Nine decisions, W1-W9. Six blocks of work were deferred here. **Nothing below
was cut.** Each item keeps the design decisions already made about it; only its
delivery was resequenced behind the minimum viable core (K1-K8: correct cited
tolerances, free placement with multi-cycle solve, levels and bridges with the
traversal checker, full BRIO catalogue, save/load, tests, undo/redo, planar
overlap).

Reason the core comes first: the engine's slop budgets were a guess roughly 3x
too tight, so every verdict the product gave was probably wrong. Distribution
features built on top of that would have distributed the error.

## P1 — Inventory, manifests, constrained palette and buy list

**What:** Declare which BRIO sets you own; constrain the palette to owned pieces;
produce a shortfall buy list when a layout needs more.

**Why:** Answers "can I build this with what I own", and the buy list is the most
obviously shareable and monetisable surface in the plan.

**Pros:** Strong retention and the one feature a parent would forward. Makes
every verdict actionable rather than theoretical.

**Cons:** A second data model and a second source of truth, added to a product
whose first source of truth was numerically wrong until W1.

**Context:** T28 (inventory model, add-by-set manifests, constrained palette),
T29 (shortfall banner with part codes, buy list, rebuild-with-what-I-have),
T38 (which-sets-do-you-own empty state, skippable). T39's rotate-into-overlap
guard was NOT deferred: it folds into the K2 drag work, where collision handling
has to exist anyway, and W9 added planar overlap detection to the core engine.
Deferred at D2 on 2026-10-07.

**Effort:** human ~1 week / CC ~2 hours
**Priority:** P1
**Depends on:** K1 correct tolerances, K4 full part catalogue (set manifests need
the real catalogue to reference)

---

## P1 — Backend: library, publish, moderation, auth

**What:** Hono API with email-only auth, library browse and fork, publish to a
pending queue, admin moderation, server-side inventory filtering, stable cursor
pagination, idempotent publish.

**Why:** The library is the one feature that compounds: every published layout
makes the tool more useful to everyone else.

**Pros:** Compounding value. The design decisions are already made and recorded
(D4 chose the optimistic publish view; G5 specified the pending-link page rather
than a bare 404; G6 specified the one-tap rename nudge), so none of that has to
be re-decided.

**Cons:** Accounts, a database, hosting, a moderation queue and a children's
privacy posture, all taken on at once. Publishing a tool whose verdicts are
wrong distributes the error.

**Context:** T34, T35, T36, T42, T43, plus design rows G3 (dense library rows,
shortfall text never truncated), G4 (author sees their layout as published
immediately while it stays out of public browse), G5 (pending-link page).
Local save/load (K5) was KEPT in core, so work surviving the tab closing does
not depend on this. A shareable layout file covers much of what sharing needs
without operating a service. Deferred at D3 on 2026-10-07.

**Effort:** human ~3-4 weeks / CC ~1 day, plus ongoing moderation duty
**Priority:** P1
**Depends on:** K5 layout document (the wire format is the file format), and the
IP questions below should be settled before anything is published publicly

---

## P2 — 3D viewer, build mode and the printable sheet

**What:** 3D viewer with procedurally generated meshes instanced per part type;
build mode as a tablet-first step walkthrough in physical assembly order; a
printable build sheet; step position persisted across navigation.

**Why:** The only part of the plan that touches the physical build, which is
where the pain actually is, and where multi-level layouts really fail.

**Pros:** The design work is done and recorded: D3 chose build mode and library
as the two designed surfaces, G1 fixed the hierarchy (next piece dominant, name
and part code legible at 60cm, step position small), G2 chose a swipe-back
gesture deliberately instead of a visible button. Nothing needs re-deciding.

**Cons:** Both surfaces are downstream of an editor that cannot yet place a
switch or a second level, so building them now means building against a model
that cannot express what they would walk you through.

**Context:** T31, T33, T41, G1, G2. **This deferral reverses N2 on sequencing
only.** After OR-6 disproved the original justification for these two surfaces,
the CEO re-review examined them as N2 and N3 and the user chose to keep both.
D4 on 2026-10-07 resequenced them behind the core; the decision that they are
worth building stands, as do G1 and G2.

**Effort:** human ~2-3 weeks / CC ~4 hours
**Priority:** P2
**Depends on:** K2 arbitrary topology, K3 levels and bridges, T18 assembly order

---

## P2 — Animated train playback and the completion arc

**What:** Deterministic fixed-timestep train traversal rendered as an animation,
with the completion state and its copy.

**Why:** Watching a train clear a bridge is the one moment that makes the
clearance check believable rather than abstract.

**Pros:** The most convincing possible proof that a layout works.

**Cons:** Needs a vehicle model and an animation loop before the editor can place
the ramps and bridges it would be driving over.

**Context:** C1 had already split T16 into two halves. The headless half (the
connectivity, grade and under-bridge clearance checker) was KEPT in core as K3,
along with C2's vehicle scalars and C5's traversability fixture, because it
carries the entire correctness value. Only the animation and its copy are
deferred: the T16 animation half, N6 (what the animation says on completion) and
G6's completion-arc tone. **G6's other two tone rules were NOT deferred** -
near-miss-is-normal and user-as-witness-on-calibration describe the verdict line
that already exists and stay in core. T40 (invalidate and stop a running
simulation when the layout is edited) travels with this item, since there is no
running simulation to invalidate until the animation exists.
**This reverses N3 on the animation only.** Deferred at D5 on 2026-10-07.

**Effort:** human ~1 week / CC ~3 hours
**Priority:** P2
**Depends on:** K3 levels and bridges, C2 vehicle scalars being measured rather
than estimated (otherwise the animation dramatises a guess)

---

## P2 — Nudge-to-fit

**What:** Discrete search over the Z[zeta16] lattice for the smallest change that
makes a failing layout close: piece substitution, repositioning, slop
redistribution.

**Why:** Turns "this does not work" into "swap this one piece", which is the most
delightful thing the engine could do with the maths it already has.

**Pros:** The exact lattice makes the search space enumerable rather than
approximate, so this is genuinely tractable here in a way it is not in
floating-point CAD. This is the clearest payoff of the cyclotomic choice.

**Cons:** The hardest algorithm in the plan. Wants correct slop budgets and a
working multi-cycle solver underneath it, both of which are core work.

**Context:** T17. T11 (mapping LP infeasibility's binding rows to suspect joint
ids) was KEPT in core as part of K1, so a FAIL verdict still names which joints
are the problem; nudge-to-fit is the expensive upgrade from "named" to
"self-solving". E10 (auto-complete-the-loop: pick two open ends, fill the gap
from inventory) remains undecided and was never in scope. Deferred at D6 on
2026-10-07.

**Effort:** human ~2 weeks / CC ~1 day
**Priority:** P2
**Depends on:** K1 correct budgets, K2 multi-cycle solve, and inventory above if
the search is to respect what you own

---

## P2 — Launch operations and the physical calibration corpus

**What:** Fuzz harness with a logged seed; GitHub Actions running Vitest with the
analytic tier gating before the corpus; feature flags; content-free opt-in
telemetry with a BUILD OUTCOME signal; runbooks; the worker hostile-input
wall-clock bound; and the physical corpus of built-and-measured layouts split
into a calibration set and a never-fitted validation set.

**Why:** The corpus is the only thing that can ever confirm the derived budgets
against reality, and W1 made derivation the basis of every verdict in the
product. A CI gate would have caught the order-independence bug automatically
instead of by inspection.

**Pros:** Turns "the engine has never met real track" from a permanent condition
into a scheduled one.

**Cons:** This is the operational apparatus of a live service, and there is no
service: zero commits, zero users, no deployment. The corpus additionally needs
physical track, floor space and hours of measurement.

**Context:** T14, T21, T22, T23, T37, T45, T47. Two items were NOT deferred:
T46 (calibration provenance - commit raw measurements with their derivation)
moved INTO core K1, because W1's derivation has to record its source and
derivation beside the numbers regardless; and T19/T20 (analytic and property
tests) stay in core as K6 and run locally in under a second.
**W1 already demoted T22** from calibration prerequisite to held-out validation,
so it no longer blocks confident verdicts - it is what would eventually
CONFIRM them. No pre-launch gate was attached. Deferred at D7 on 2026-10-07.

**Effort:** human ~2 weeks / CC ~4 hours, plus physical measurement time
**Priority:** P2 for the ops; the corpus should be P1 before any public launch
claim of accuracy
**Depends on:** K1 derived budgets existing to validate against. Owning or
borrowing a substantial amount of real BRIO track.

---

## Accepted residual risks of the 2026-10-07 reduction

1. **No automated regression gate.** CLOSED 2026-10-14 by task X1b: CI now
   runs typecheck, tests and build on every push. Left in place because the
   accepted-risk record should show what was accepted, not be rewritten.
   As originally written: the 21 tests run only when someone
   remembers. A solver regression ships silently until the next manual run.
2. **The engine has never met real track.** W1 replaced a guess with a
   derivation from two agreeing published sources, which is better evidence but
   is not measurement. A wrong published dimension now propagates with a
   `published` label and no dotted-ring hedge.
3. **Single-player only.** No library, so no compounding value from other
   people's layouts for as long as the core takes.
4. **FAIL is a dead end.** T11 names the binding joints but proposes no fix.
5. **A pathological layout can freeze the tab.** T14's time budget was deferred.

---

## P2 — Failure replay and solver inspector

**What:** Freeze the layout at the moment of failure, zoom to the suspect joint,
report measured-versus-budget per joint.

**Why:** Debuggability three weeks after a report is currently zero: no logs, no
persisted state. W10 now populates `suspectJoints`, so the data this needs will
exist for the first time.

**Pros:** Turns "it said my loop fails and it doesn't" into something
reproducible. Both bugs found in this engine so far (the missing angular closure
row, and the greedy-versus-minimax reporting) were found by reading code rather
than by observing behaviour, which is slow.

**Cons:** A developer-facing tool for a product with no users and one developer.
K5's save/load already makes a failing layout transmissible, which covers most
of the practical need far more cheaply.

**Context:** T32 from the eng review. The 2026-10-07 CEO review left it unplaced
and resolved it at D13. It is mostly a view over data that will already exist
rather than new computation.

**Effort:** human M / CC S (human ~4 days / CC ~2 hours)
**Priority:** P2
**Depends on:** W10 suspectJoints population (core), K1 per-joint usage report
(core), K5 save/load for reproducing a reported layout (core)

---

# Deferred by /plan-ceo-review 2026-10-07 (second reduction, after the engine reopened)

Context: the eng review measured the committed solver and found it hard-fails on
buildable 321-piece layouts and flips verdicts on piece order at 42 pieces. R18
reopened the engine. This review then re-decided the product shape around a new
user instruction: multi-layer tracks, capped at three layers, modelled on PCB
layouts.

## P1 — Switches and the coupled multi-cycle solve

> **CORRECTED 2026-10-09 by the fourth eng review.** This entry described work
> that no longer exists. A coupled minimax solve over a cycle basis with
> per-(joint, cycle) sensitivities was the LP that decision R21 DELETED, and
> there is nothing left to couple: the verdict is now a necessary-condition
> bound, `gap <= sum of give`, which is order-independent because addition is.
> `Depends on: K0c engine repair proven` is likewise stale, because R21 removed
> K0c. What remains is graph TOPOLOGY, not numerical method, and it is no longer
> deferred: it is the live C-series (C6 graph model, C8 spanning forest and
> per-cycle bound, C9 basis-independent reporting). The original text is kept
> below for history.
>
> One correction to the Pros paragraph as well: it claims the eng review
> "confirmed that one spanning forest can serve both the cycle basis and the pose
> walker". That remains true and is now an approved requirement (D6 of the fourth
> eng review), but the forest has THREE consumers, not two: the exact pose walk,
> the float render walk, and cycle extraction.

**What:** Track branching. A switch puts one joint on two cycles at once, so the
cycles can no longer be solved independently and need a coupled minimax solve
over a full cycle basis, with per-(joint, cycle) sensitivities and a
spanning-forest walker.

**Why:** Switches are what large real layouts are made of, and the exact lattice
makes arbitrary topology genuinely tractable here in a way floating-point CAD
never is. This is the part of the plan with real technical edge.

**Pros:** Unlocks the layouts serious builders actually make. The design is
already analysed: the eng review's D1 settled the arrangement and confirmed that
one spanning forest can serve both the cycle basis and the pose walker (parent
pointers give pose propagation downward and fundamental cycles upward to the LCA).

**Cons:** It is the largest work item in the plan, and it sits directly on top of
the measured defects. Adding cycles to a solver that fails on one cycle is the
specific mistake R18 was raised to avoid.

**Context:** Deferred at D4 (2026-10-07) in favour of **multiple independent
components without switches**, which was kept in v1. That choice is cheap for a
precise reason worth preserving: with no switches, no joint is ever shared
between components, so the constraint system is block-diagonal and the solve is
the existing single-cycle machinery run once per component. Switches are exactly
what breaks that property. Revisit once K0c's repair has proven itself on one
cycle, with the gauge sweep passing across every cut point at four sizes.

**WHAT THE 2026-10-15 ENUMERATION FIX LEFT FOR THIS TASK.** One thing, and it
is smaller than the first version of this note claimed.

`CYCLE_WORK_BUDGET` is unpinned against a frame target, the same gap
`CYCLE_RANK_CEILING` has (eng finding E13). 150,000 weld-slots was chosen by
measurement -- it refuses the worst dense layout in 12-22ms and still answers a
legitimate 10,000-piece layout in full -- but not derived from a frame budget.
A real switch catalogue is what makes it measurable against something.

**CORRECTED, SAME DAY.** This note first said that the dense-sharing-graph
regime and the budget were "unreachable until a part carries a third port", and
that the refusal wording could therefore wait for this task. Both were wrong,
and the reasoning error is worth keeping: shared pieces do NOT require extra
ports. Two fundamentals share a piece whenever that piece sits in both of them,
and a second weld on ONE port is enough to put it there. `loadGraph` validated
a weld's port RANGE and never its OCCUPANCY, so a stored layout could claim the
same track end many times over and reach the dense regime with nothing but
ordinary two-port parts. Measured: 11,058ms of frozen main thread from a
303,940-byte blob the loader accepted without a word. The port count was never
the gate; the trust boundary was. Both were fixed on the branch instead of
deferred here.


**Effort:** human ~3-4 weeks / CC ~4 hours
**Priority:** P1 for v2
**Depends on:** K0c engine repair proven; K4's switch part with its centreline shift

---

## P1 — Drag-and-drop, with undo, the drop-overlap guard and keyboard parity

**What:** One body of work, not four features: pieces drag from the palette and
reposition after placement; a rigid forward-kinematics preview during the drag
with one solve on release; undo/redo over layout-document snapshots with
keyboard shortcuts; a guard that refuses a drop overlapping an existing piece;
and keyboard equivalents for place, rotate and remove plus ARIA landmarks so the
editor is not mouse-only.

**Why:** "A graphical editor that allows the user to drag and drop" was a named
ask in the original brief. v1 does not deliver it. Appending pieces to the end is
tedious beyond a few dozen pieces.

**Pros:** Delivers a named brief ask. The interaction is already designed: 9A
specified the rigid preview and the single settle on release, and the eng
review's R17 worked through the solve-trigger question. Undo's design is settled
by T27, including the trap of snapshotting solver output rather than the document.

**Cons:** Drag makes undo, the overlap guard and keyboard parity mandatory rather
than optional, so v1 would grow by four things rather than one. It is the largest
remaining app-side item.

**Context:** Deferred at D5 (2026-10-07) with an explicitly accepted ceiling:
the v1 editor is Completeness 4/10 as an editor, logged as decision
`cebd0e6d-567b-4811-9f0d-62c6f4d10b87`. **Upgrade trigger: the first time a
layout exceeds roughly 40 pieces in practice, or any edit richer than append is
needed (repositioning or rotating a placed piece).** The eng review's R17 is
suspended, so the solve-trigger question reopens with this. Note finding 12:
undo consumes K5's document type, so K5's type must land before undo.

**Effort:** human ~2 weeks / CC ~2 hours
**Priority:** P1 for v2
**Depends on:** K5's layout document type (not its file I/O); R16's fingerprint
re-decision; K0c repair for the solve-on-release contract

> **IN PLAN 2026-10-22.** The upgrade trigger fired ("any edit richer than append": remove any
> piece). Drag-and-drop is accepted scope in `docs/plan/2026-10-22-editing-and-canvas.md` (E6),
> delivered as PRs 4 and 5 after seams+grid, select/remove and ghost placement. Prerequisites
> checked there: K5's document type is the persisted Graph; K0c is moot (R21); R16 needs no new field
> because snapping is exact lattice arithmetic. Undo becomes multi-step (supersedes U5, D12).

---

## P2 — A manual join can re-lay a loop that does not close (filed by /plan-eng-review 2026-10-22, D7)

**What:** Make `spanningForest` (engine/src/graph/forest.ts) prefer the previous tree edges when a
weld merges two components, so no join or edit re-lays track that was already placed.

**Why:** Measured with a probe: a run whose loop misses by 389 mm, joined exactly and facing at the
spare road of a switch inside that loop, moved three pieces 507-611 mm and turned them two steps.
The forest walks each component from its first-declared piece, so a join changes the entry point and
a different weld becomes the loop's gap.

**Pros:** No join of any kind moves track; auto-join could then always join (eng D6 currently skips
the risky ones and announces manual-join movement).

**Cons:** Changes which joint the verdict reports as a loop's gap on such layouts; touches the most
heavily tested engine code, so the forest/verdict fixtures must be re-run and reconciled.

**Context:** Found in the eng review of docs/plan/2026-10-22-editing-and-canvas.md (ENG-R5). The
editing plan's before/after frame comparison (D19 for remove/break, D6 for auto-join) is the guard
until this lands; start from that comparison and make it pass for manual joins too.

**Effort:** human M / CC S
**Priority:** P2
**Depends on:** the editing plan's before/after frame comparison (PR 2)

> **DONE 2026-10-23.** Fixed in `spanningForest` rather than by remembering the previous tree: the
> closing welds are now chosen by weld ORDER (union-find in declaration order; a weld joining pieces
> already connected closes), and the walk follows tree welds only. A new weld can never change an
> earlier weld's status, so an exact join moves nothing, whichever piece the walk enters at. The
> full suite, including the differential harness and every verdict fixture, passed unchanged except
> the two specs that pinned D6's refusal, which now pin the join being welded with no frame moving.
> The D6 before/after guard in `autoJoin` and `moveRun` stays as a backstop; nothing reaches it today.

---

## P2 — Draw your table or room on the grid (deferred by /plan-ceo-review 2026-10-22, E4)

**What:** A width x depth input that draws the table or room outline on the metric grid, so "does
it fit" is answered on screen.

**Why:** The grid (R4) shows size in centimetres, but comparing it with a real table is still
mental arithmetic, and fit is the question people actually have.

**Pros:** Builds directly on the grid; small UI; high value for anyone planning on a fixed surface.

**Cons:** A new persisted value, which in this codebase means a loader that reports losses, a
lossy-load notice, its own acted flag and mounted save-gate specs (see suppression.dom.test.tsx).
Where the rectangle sits relative to the layout also needs deciding (origin, or draggable).

**Context:** Deferred at D7 (2026-10-22) to keep the editing plan free of a fourth storage key.
Start from the grid helper (`gridStep` in trackPath.ts once PR 1 lands) and the inventory store as
the model for a small persisted value.

**Effort:** human M / CC S
**Priority:** P2
**Depends on:** the metric grid (PR 1 of the 2026-10-22 editing plan)

> **DONE 2026-10-23.** Owner ruling: the outline is centred on the track and only its size is saved
> (`brio.table.v0`), so the "origin or draggable" question closed as neither. "Your table" sits beside
> "Your box"; the outline draws over the grid and under the track, red when the track hangs over, and
> a caption names the overhang against the table's own sides. The fit is measured on the plank edges
> and curve bulges (`trackExtent` in `app/src/tableModel.ts`), not on `renderBounds`, and the table is
> tried both ways round. Its own notice, dismissal, acted flag and save gate, pinned in
> `app/src/tableOutline.dom.test.tsx`.

---

## Open and unassigned: the overlap narrowphase primitive

> **DONE 2026-10-23, after an owner bug report:** two planks laid across each other drew as one
> merged shape that read as a switch, and the verdict said nothing. `engine/src/graph/overlap.ts`
> cuts each plank into convex quads (curves in 5.6 degree slices), clips pairs from different pieces
> through a spatial hash, and reports pairs sharing over 100 mm². It uses the catalogue's plank width
> (40 mm). Exempt: a piece against itself (a switch's roads), welded pieces, and pieces with ends on
> one exact spot (the vertex check owns those). It feeds IMPOSSIBLE in the verdict, the canvas
> markers and the placing preview. Measured at 69 ms for 10,000 pieces. The drop guard followed the
> same day: `ghostFit` takes optional part geometry and reports an `over` conflict, the reducer is
> handed it, so a palette drop onto track places nothing (6A). A placed run moved onto track (drag,
> arrow keys, strip buttons) is refused the same way, through `moveRun`: "it would lie over other
> track". Overlaps the move neither causes nor keeps are left to the verdict.

> **SUPERSEDED 2026-10-09 by the fourth eng review.** Decision D10 of the CEO
> re-review replaced the whole footprint-overlap approach with an exact
> coincident-connector refusal: no two non-adjacent connector positions may be
> exactly equal. That is one `equals()` loop over integer coordinates, so it
> needs no AABB filter, no narrowphase, no arc-against-arc test and no measured
> plank width. It shipped on 2026-10-08 in `engine/src/feasible.ts` and catches
> both known false passes, the 16xE double circle at 9 pairs and the 8L+8R
> tangency at 2 pairs, while leaving the 8xE circle and the stadium clean.
>
> The AABB inflation table below is still correct and still worth keeping, because
> it is the reason a bounding-box test could never have been the decision
> primitive. What is dead is the conclusion: an exact arc-and-segment narrowphase
> is NOT the likely answer and is not needed. What remains genuinely uncovered is
> narrower than this entry implies: a plank crossing a plank mid-span, with no
> connector coincidence anywhere. That needs a measured plank width and follows
> the calibration deferral.
>
> Measured 2026-10-09: the shipped check costs 11.02ms and reports 25,359 pairs
> at 640 stacked curves, which is about an eighth of the 204,480 pairs recorded
> against decision A4 for the footprint approach.

Not deferred, not decided. X4 kept planar overlap in v1, but the primitive that
actually decides overlap has no owner.

R15 chose AABB all-pairs over a spatial grid, and that cost reasoning is sound:
this check runs once per edit over static geometry, not sixty times a second
over moving bodies. But **AABB is a reject filter, not a decision primitive.**
Measured inflation for the real parts:

```
  E curve (r182, 45deg), best orientation   1.46x its true footprint
  E curve rotated 22.5deg                   3.11x
  E curve rotated 45deg                     3.80x
  D straight (216x40) at 45deg              3.79x
```

BRIO headings are multiples of 22.5 degrees, so the inflated cases are the common
ones, and a check whose job is to REFUSE layouts would refuse buildable ones. An
exact arc-and-segment narrowphase is the likely answer: arc-against-arc reduces
to a centre-distance test against the radii plus an angular-interval check.
Needs a decision before X4 is implemented.

---

# Deferred by /plan-ceo-review 2026-10-07 (third pass, after the layer instruction)

## P1 — Multiple independent components (several separate tracks in one layout)

**DONE (2026-10-24).** The premise below is from the chain engine and no longer
holds. The graph engine already kept several runs: each run has its own anchor,
a lattice point with a heading in sixteenths (so exact closure holds per run),
and runs are placed, dragged, snapped and checked for overlap against each
other. What was missing was the verdict speaking about each run. It said
"Nothing to fix. Build it." beside a second run still open, said a turned loop's
reason twice without naming the loop, and read two closed loops as one. Now
`solveGraph` returns a `runs` summary (count, open, and each loop's lowest
piece number), and the verdict says "Both loops close exactly", "1 other run of
track is not a loop yet." with "Join the free ends of the open run, or remove
it." in place of "Build it", and "In the loop through piece 9." beside a gap or
a turn when there are several loops. Specs: app/src/verdictRuns.test.ts.

**What:** Let a layout hold more than one connected run of track, so a loop can
sit beside or under another unrelated loop.

**Why:** Real large layouts are several tracks, not one. It was approved at D4
and then reversed at Y1.

**Pros:** Cheap on the solver: with no switches no joint is shared between
components, so the constraint system is block-diagonal and each component solves
with the existing single-cycle machinery run once per component. The outside
voice established the cheapest implementation is a `Document { components:
Layout[] }` wrapper plus a map over `solveLayout` plus a reducer, with ZERO lines
changed in `fk.ts`, `residual.ts` or `result.ts`.

**Cons:** Needs a component origin, which does not exist: `fk.ts:58-60` and
`pose.ts:61` hardcode the origin and `Layout` has no field for it. Setting an
origin is repositioning, which reopens the append-only decision.

**Context:** Reversed at Y1 (2026-10-07) because multi-component and append-only
are incompatible as decided: a second component would default to the origin,
overlap the first, and be correctly failed by the overlap check with no user
action available to fix it. **Hard requirement for whoever picks this up: a
component origin MUST be a lattice point in Z[zeta16] with a heading that is a
multiple of 22.5 degrees, or exact closure dies for that component.** That makes
the snap/vertex-identity epsilon a prerequisite, and it is still undecided.

**Effort:** human ~2 weeks / CC ~2 hours, mostly the origin and its snapping
**Priority:** P1 for v2
**Depends on:** the snap epsilon decision; drag-and-drop (positioning is repositioning)

---

## P2 — A third layer (bridge over a bridge)

**What:** Widen the per-placement `elevated` boolean back to an integer layer
index so a layout can stack two levels of bridge.

**Why:** The user originally instructed a cap of three layers and then chose two
at D9 on cost grounds. A bridge over a bridge is a real layout.

**Pros:** The boolean-to-index widening is small in isolation, and rise-equals-fall
stays exact either way (a count comparison becomes an integer sum).

**Cons:** It brings back cap enforcement at append, reject-with-reason paths for
out-of-range levels, the adjacent-vias-only rule so floor-to-top needs two ramps,
and 3-way overlap partitioning.

**Context:** Accepted ceiling logged as decision
`f6bc20a3-29a8-4643-84d0-9ab8d6e63999`. **Upgrade trigger: the first layout that
needs a bridge over a bridge.** Ordering hazard worth heeding: the per-placement
field is part of the saved file format once K5 ships, so if stacked bridges are
ever likely, widen BEFORE any file exists.

**Effort:** human ~1 week / CC ~1 hour
**Priority:** P2
**Depends on:** nothing, but cheaper before K5 ships than after

---

## P2 — Support and pier modelling

**What:** Support and riser parts in the catalogue, a requirement that elevated
runs be supported, and pier footprints participating in the same-level overlap
test so a pier landing on lower track is a short.

**Why:** Raised BRIO track does not float. It rests on risers or stacked track,
and those occupy floor footprint. In the user's own example, a loop crossing over
a track that continues underneath, the pier frequently lands on the lower track.

**Pros:** Turns the layer feature from geometrically trustworthy into physically
trustworthy, which is the difference between a drawing and a build plan.

**Cons:** A new part class with its own placement rules, and the plan has no
support dimensions to work from.

**Context:** Raised by the outside voice and verified by absence from the plan,
the schema and K4's part list. v1 chose at D10 to STATE the gap rather than check
it, with accepted ceiling logged as decision
`2f1af71e-4277-4cab-ae07-bd5f205d0b7f`. **Upgrade trigger: the first report of a
bridge that passed but could not be supported, or support parts entering the
catalogue.** Until then the verdict says plainly that support is not verified.

**Effort:** human ~2 weeks / CC ~2 hours
**Priority:** P2
**Depends on:** K4's catalogue; measured support dimensions

## Retire or annotate the eight stale G-tasks from the first design review

**What:** Annotate G1-G5, G6's two cut arcs, G8's joint-glyph framing and G10's
joint-data framing as deferred to v2, naming the scope decision that cut each
surface. Keep the specifications intact; remove only the implication that they
are current P1 work.

**Why:** Eight of the twelve design tasks target surfaces the CEO re-review cut
hours after they were written. G1 and G2 are build mode, G3 is library browse,
G4 and G5 are publish and moderation. G10 is worse than stale: it specifies a
keyboard-navigable text view of per-joint data, justified on the grounds that
`evaluateJoint` already produced every needed fact, and R21 deleted that data.
Following G10 as written leads to a dead end rather than to a wrong but
buildable feature.

**Pros:** Anyone opening the backlog stops planning against four surfaces that
are not being built. The specifications survive for v2, and they are good work:
the library card-grid rejection on structural grounds and the three failure-arc
tone rules are the strongest design reasoning in the plan.

**Cons:** It is a TODO about TODOs, and it needs revisiting the moment any cut
surface returns.

**Context:** Added by the second design review, 2026-10-08, decision 26A. The
first design review ran on 2026-10-07 against a seven-surface product; the CEO
re-review reduced v1 to a single-chain append-only validator the same day, and
the eng review then deleted the minimax LP at R21. Nobody re-read the design
backlog against either change, which is why the second review's audit step had
to reconstruct it. G10's replacement is decision 20A: a live region plus a
keyboard-navigable list of the chain, retargeted from per-joint verdicts, which
no longer exist, to per-piece facts, which do.

**Effort:** human ~30min / CC ~5min
**Priority:** P2
**Depends on:** nothing

## P2 — Where the app is published, and whether the fonts may travel with it

**What:** the half of the old CI entry that X1b did NOT do. A decision about
where the app is published, and whether the self-hosted woff2 fonts plus their
OFL licence file travel with it. The OFL requires the licence to accompany the
fonts, and they are this project's first bundled assets.

**Why:** CI landed on 2026-10-14 (X1b) and runs typecheck, tests and build on
every push, so the testing half of this entry is done and moved to Completed.
The distribution question it was bundled with is untouched and is not a CI
question at all.

**Context:** the CI half was added by the third eng review, 2026-10-08, decision
D16 option A. Its stated blocker, "CI needs a remote, and a remote needs the two
P1 pre-launch questions resolved", was resolved differently than expected: X1
created a PRIVATE remote, which carries none of the provenance exposure a public
one would, so CI stopped being blocked without the counsel questions closing.
Those questions still gate a PUBLIC remote and any deploy.

**Effort:** human S / CC S. **Priority:** P2.
**Depends on / blocked by:** overlaps "Deploy the app to a URL" below; the same
counsel question gates both.
## P1 — Tolerances, the calibration afternoon, and everything gated on it

> **READY TO MEASURE 2026-10-24.** The path from the floor to the engine is
> built: `docs/calibration-sheet.html` to print, `engine/data/measurements.ts`
> to copy it into, `engine/data/calibration.ts` deriving the give and the
> train height from it (marked measured only where read), and `bun run
> calibration` reading every answer against CALIBRATION.md's contingency table,
> with the Q1 loop checked against the engine's verdict. What is left is the
> afternoon itself.

**What:** The physical measurement afternoon described in `CALIBRATION.md`, and
every decision that depends on its numbers: the per-joint slop budgets, plank
width, plank thickness, the ramp rise, vehicle height, the 216mm datum, and the
bridge clearance margin.

**Why:** Every non-exact verdict the product gives is arithmetic on a guess.
`engine/data/brio.ts` labels every slop budget `estimated`. The bound's hedged
middle band, the footprint overlap tier and the whole elevation feature all read
numbers nobody has measured.

**Pros:** It is the cheapest item on the list by a wide margin, one afternoon,
and it unblocks more than anything else of comparable size: the tolerance band,
the footprint tier, the 8L+8R tangency via footprints, the ramp datum and the
clearance margin.

**Cons:** It needs real track, floor space and an afternoon, and it cannot be
done by an agent. It is the only item on this list with that property.

**Context:** Deferred by direct user instruction on 2026-10-08: "forget the
tolerance and the calibration document for now (put it in the backlog)." This
supersedes the measure-first recommendation two consecutive outside voices made,
and it was taken with the consequences stated. What follows from it:

- **Elevation, layers, ramps and clearance are deferred entirely.** Q5's own
  contingency row says single-level bridges become impossible if the clearance
  margin is zero or negative, and the margin is 8mm composed of three unmeasured
  figures. The layer work cannot start without that number.
- **The footprint overlap tier is deferred** with plank width, which
  `CALIBRATION.md:76` records is not the gauge and is written down nowhere.
  Decision D10 (2026-10-08) replaced it with an exact coincident-connector check
  that needs no measurement and catches both known false passes, so the loss is
  smaller than it was: what remains uncovered is near-miss adjudication and
  visible non-joint crossings.
- **The verdict stays permanently hedged** for anything that is not an exact
  closure. `NEEDS_GIVE` reports numbers derived from `estimated` budgets and says
  so; that disclosure is now permanent rather than temporary.
- **One measurement escaped the backlog by becoming a task dependency.** Under
  decision D9 (2026-10-08) switches are accepted as approximate, with a stated
  per-switch error. You cannot state an error you have not measured, so the
  switch's diverging-leg angle and lateral offset must be obtained before
  switches ship. Published BRIO dimensions may answer it without calipers.

**Effort:** human ~1 afternoon / CC ~0 (this one does not compress)
**Priority:** P1
**Depends on:** real track and floor space

# Deferred by /plan-ceo-review 2026-10-13 (SELECTIVE EXPANSION)

## P2 — The polarity marker, and three things it does not yet do (filed by /ship, 2026-10-16)

A refused joint is now marked on the canvas (`App.tsx`'s `badJoints`, drawn by
`TrackCanvas` as a ring and bar). Three limits were found in review and left
deliberately, rather than widened mid-branch:

**1. The marker sits at end `a`, which is not always both ends.** For a tree
weld the two ends coincide and one mark is the whole truth. A CLOSING weld can
have a gap -- that is exactly what the `gaps` annotation exists to draw -- and
then end `b` is somewhere else and unmarked, with `a` chosen by click order
rather than by meaning. Fix: mark both ends when they differ, or the midpoint
with a leader.

MINIMAL REPRODUCTION, from the Codex outside review and verified here. Weld
the two ends of a SINGLE B2 to each other. Two clicks in the editor: arm port
0, click port 1 of the same piece (`clickPort` only refuses the identical
port, so a self-weld is reachable). The engine places the ends at `(0,0)` and
`(54,0)`, reports ONE polarity violation, and claims both ports -- so both
polarity dots disappear and the single marker lands on `(0,0)`. Reverse the
click order and the same violation on the same geometry puts the marker on
`(54,0)` instead. The verdict stays IMPOSSIBLE throughout, so this is
misleading fault localisation rather than a false pass. Note the rendering
specs cannot catch it: they hand `badJoints` coordinates directly and so
bypass the resolution in `App.tsx` that chooses the end.

**2. When a layout has BOTH a polarity violation and a clash, only the
polarity sentence prints.** `VerdictLine`'s IMPOSSIBLE branch is a ternary on
`polarityCount > 0`, so the clash rings on the canvas are named by no number.
This PREDATES the polarity marker (the ternary is unchanged on `main`), but
the marker makes it visible: the canvas now carries two kinds of red mark and
the words account for one. Fix: render both sentences when both counts are
above zero, and add a `viewOf`/`VerdictLine` spec for the both-present case,
which nothing covers today.

**3. The two red marks differ only by size and glyph.** A clash is r=28 with
an X, a refused joint r=18 with a bar, both in `--fail` at the same stroke
width. In greyscale they differ by shape alone, the bar is outside the
canvas's existing glyph vocabulary, and when both land on one spot the result
is a bar inside an X inside two rings. Fix: make the difference structural (a
dashed ring, say), or suppress the inner mark where they coincide.

**Also unfiled until now:** ~~`render.ts` tests `kind === 'heel'` inline, while
the polarity check reaches the same exemption through `weldHasPolarity`.~~
**Resolved 2026-10-22 by deleting the exemption.** A heel is a peg or a socket
like any end, so neither copy exists any more and there is nothing to share.
**And** the `badJoints` resolution in `App.tsx` (weld lookup, guards,
end choice) has no spec of its own -- only its rendering is covered. Fix:
extract it beside `gapAnnotations` in `trackPath.ts` and spec it.

**Found by the Step 11 adversarial pass, after the fix budget closed:**
`badJoints` builds its `byPort` Map on EVERY edit, including the common case
where `polarityViolations` is empty. Near the canvas ceiling that is roughly
20,000 strings and Map entries allocated per keystroke for nothing. One line
fixes it -- `if (result.polarityViolations.length === 0) return [];` before
the Map -- and it has no correctness impact, which is why it is filed rather
than applied: the review's three-cycle fix limit was already reached, and an
unreviewed edit at that point is what the limit exists to prevent. The same
guard is worth considering for the `gaps` memo above it.

Also noted: `badJoints` returns `[]` both when nothing is wrong and when the
layout is above the drawing ceiling. Harmless today, because the canvas shows
its own notice and the verdict sentence stays truthful, but the empty array is
ambiguous for anyone who reuses it.

**Effort:** human ~1d / CC ~1h for all of it. **Priority:** P2, except item 2
which is P1 because it is user-visible today.

## P2 — Offer only polarity-compatible free ends in the editor

**DONE (2026-10-24).** With an end selected, the editor refuses a join that can
never be built: two pegs, or ends on different levels (only a ramp joins
levels). Two sockets are NOT refused: since the adapter work they join through
a male-male adapter. The refused ends are dimmed on the canvas with the reason
in their name and hover title, the layout list names the reason, and clicking
one makes no joint and says why. One rule, `joinRefusal` in layoutModel.ts;
the verdict-level checks stay as the backstop for stored layouts. Specs:
app/src/joinRefusal.test.ts.

**What:** When one free end is armed, grey out or ignore the free ends that
cannot physically mate with it, so the editor stops inviting a join it will
then refuse. Keep the verdict-level check as a backstop for layouts restored
from storage, which bypass the click path entirely.

**Why deferred (D4, 2026-10-13):** The failure is already caught and reported,
not silent: `findWeldPolarityViolations` is tested and IMPOSSIBLE outranks an
exact closure. And the editor is about to change shape when switches land.
(This said a heel would be exempt from polarity altogether. It is not: since
2026-10-22 a heel is checked like any end, so the rule this entry describes
needs no switch special case.)

**Upgrade trigger:** after the switch catalogue row (S2) ships and the set of
port kinds has settled.

**Origin:** task C2 of the fourth eng review, second half. The first half,
polarity in the schema, already shipped.

**A THIRD HALF NOBODY HAD FILED, now shipped (2026-10-16).** This entry is
about the EDITOR refusing to offer a bad join. It assumed all along that the
user could see what they were joining, and they could not. Reported from the
live site: "there is no difference when i place a piece with 2 pegs or 2
sockets or a normal one." Measured on woodentrain.world, A2, B2 and C2 drew
BYTE-IDENTICAL geometry -- four paths each, same `d`, same fills, two
identical hollow dots -- so a layout the polarity check refuses looked exactly
like one it accepts, and the only difference reached the user as a sentence
after the join was already made.

The check was never broken: A2+B2 reports one violation and says so. What was
missing was the picture. `RenderedPort` now carries `polarity`, derived with
the same `portPolarity` the check applies. (It also carried a heel exemption
held in two copies, one in `render.ts` and one in `weldHasPolarity`; both were
deleted on 2026-10-22 when the heel became an ordinary connector.)
(This paragraph said "so the two cannot drift" until the documentation audit
caught it contradicting `render.ts`, which says plainly that it is a separate
copy.) The canvas draws a peg filled and a socket hollow at the same radius,
which adds no ink to a dense layout. Every new spec carries a mutation
proof that was RUN, recorded beside the spec itself rather than counted here.

This does NOT close the entry above. Showing which end is which is not the
same as declining to offer a join that cannot work, and the deferral reason
for that half still stands.

## P3 — Finish splitting App.tsx

**What:** Extract persistence, palette rendering and the inventory/submission
wiring out of `App.tsx` into their own modules, following the pattern that
already produced `layoutModel.ts` and `trackPath.ts`.

**Why:** 627 lines owning five responsibilities: persistence, palette, presets,
inventory and the part-submission form. Both React defects of 2026-10-13 lived
in this file, and a third one did on 2026-10-14: the StrictMode-defeated save
guard (finding E1).

It GREW from 584 despite T4 extracting the editor state, because T5 then added
the two notice regions and the save-suppression condition. Worth stating plainly
rather than implying the split is making the file smaller: so far it has not.

**UPDATED 2026-10-14:** editor state is OUT, extracted by task T4 into
`app/src/editorReducer.ts` with 15 tests. That was the piece the Context note
below carved out, so this entry is correctly still open for the other four.
Persistence is the next clearest boundary, and `layoutStore.ts` now carries the
largest suite in the app, which makes moving its wiring out of `App.tsx`
cheaper than it was. (No count here on purpose: that figure drifted three times
in two days, twice inside the commit that corrected it.)

**Pros:** Each extracted piece becomes testable with no DOM, which is how
`layoutModel.ts` and `trackPath.ts` are already covered. Smaller diffs on the
file that three separate tasks want to touch.

**Cons:** A pure refactor with no user-visible change. It touches the same file
as P6-2's palette work and K7's base-level control, so doing it mid-flight
would conflict.

**Context:** E2 of the fifth eng review (2026-10-13) extracts ONLY the four
state updaters into `editorReducer.ts`, because that is the smallest change
that makes the eight-clicks defect testable. The rest of the split was scoped
out deliberately, not forgotten. Start by moving persistence, which has the
clearest boundary and already has its key constants in `storageKeys.ts`.

**Effort:** human M / CC S. **Priority:** P3.
**Depends on / blocked by:** E2 landing first. Best done when no switch work is
in flight.

## P2 — Measure a real BRIO switch (filed by T1, under the calibration deferral)

**What:** With a physical BRIO switch and calipers, record its through-road
length, diverging-leg radius and arc, and the heel offset. Then compute the
rounding residual against the 22.5-degree lattice.

**Why:** Task T1 (2026-10-13) searched four source classes and found no citable
figure: manufacturer pages for 33344 and 33346, retailer specs, patent and
dimensioned drawings, and woodenrailway.info's track guide, which is the
citation behind every other dimension in the catalogue. The full enumeration is
in `CALIBRATION.md` Q6. Without a number, the switch catalogue row cannot ship
and the engine's switch support stays reachable only from tests.

**Pros:** Unblocks the one feature the graph rewrite was built for. The engine,
the heel semantics, the editor and the per-cycle machinery are all finished and
tested; this is the only missing input.

**Cons:** Needs a physical part and calipers, so it cannot be done from a
keyboard. The residual may turn out to exceed E1's ceiling, in which case the
honest answer is that a BRIO switch is not modellable on this lattice.

**Context:** Filed under the EXISTING calibration deferral rather than as new
scope, because the user deferred measurement work on 2026-10-07 and the fifth
CEO review retired four elevation tasks for following it. `CALIBRATION.md` Q6
lists the four measurements and the method. E1 of the fifth eng review makes
the residual the number a verdict gets checked against, so recording it is the
point, not an extra.

**Effort:** human S (one afternoon with the part) / CC: cannot be done by CC.
**Priority:** P2.
**Depends on / blocked by:** owning a BRIO switch. Blocks task T2 entirely.

## P2 — Deploy the app to a URL (filed by the CEO review, 2026-10-13)

**What:** Put the current app on a public URL. One hour, after a remote exists.

**Why:** Nothing this project has built in three weeks is visible to anyone
outside one machine. The moat is real (exact Z[zeta16] closure plus sourced
dimensions is hard to copy and hard to do in floating-point CAD) and it is
undemonstrated and undated. The competitive risk is not that someone builds a
better cyclotomic solver; it is that a generic generative tool plus a photo of
someone's pieces becomes good enough at the user's actual question first.

**Pros:** Forces the font OFL distribution question this file already says is
owed. Makes the thing shareable, which is a precondition for any user contact.

**Cons:** Touches the P1 data-provenance question: a public deploy publishes the
transcribed dimensions, exactly as a public remote would. Gated on the same
counsel, or on X3 converting the catalogue to self-measured figures.

**Context:** Raised as M2 by the CEO voice in the /autoplan run of 2026-10-13,
which noted deployment has gone untouched across six reviews.

**Effort:** human S / CC S. **Priority:** P2.
**Depends on / blocked by:** X1 (a remote), and either counsel or X3.

## P3 — A direct `solveGraph` suite (filed by the eng review, 2026-10-14)

**MOSTLY OVERTAKEN 2026-10-15. Re-checked before trusting it; three of its
facts no longer hold.** It said `solve.ts` had "exactly one importer among the
15 test files"; it now has four (`differential`, `trustBoundary`, `cycles`,
`verdictView`). It said `TOO_MANY_LOOPS` "by construction cannot be" exercised
because the chain model has no rank above 1; `engine/test/cycles.test.ts` now
drives it and `TOO_BIG_TO_CHECK` directly through `solveGraph` on graph
fixtures, which the chain model never had to reach. And the union has six
return sites now, not five.

**What is actually left:** the new `rank > 0 && cycles.length === 0` arm has
no spec driving its FIRING, because nothing can drive it (every fundamental
traces; a weld naming a missing piece throws first). Its misfire direction is
pinned. The non-finite `NUMERIC` cause IS covered, at
`engine/test/differential.test.ts`. The clash-precedence ordering is pinned
only at the `viewOf` layer. Both narrow.

**Why still deferred:** the branches that mattered got specs as a side effect
of the work that needed them, which is the principle this project applies: a
test earns its place by catching something the existing layers cannot. Pick
the remainder up with K1.

**Effort:** human M / CC S. **Priority:** P3.
**Depends on / blocked by:** nothing. Scheduled with K1's wave by preference.

## P2 — The success state's payoff beat (filed by the design review, 2026-10-13)

**What:** For a validator whose entire purpose is telling you the loop closes,
the reward for closing it is currently one CSS class. The interaction state
table written into `docs/plan/2026-10-13-open-work.md` has five states across
three surfaces, and Success is the thinnest cell in it: no reinforcement, no
motion, no change of weight. Every other cell got work this phase.

**Why:** the phase that just ran is a hardening phase, and four of its five
states are about things going wrong. The one state the product exists to produce
is the one nobody designed.

**Effort:** human S / CC S. **Priority:** P2.
**Depends on / blocked by:** nothing. Named here so the next design pass starts
from it rather than rediscovering it.

## P3 — CONTRIBUTING.md (filed by the DX review, 2026-10-14)

**What:** no contributor documentation exists.

**Why deferred rather than scheduled:** there is no remote, so there is nobody to
contribute. The project's own value test — an artifact written before its
consumer exists is waste — rejects it today. The DX phase recorded this as a
deliberate deferral rather than a gap.

**Effort:** human S / CC S. **Priority:** P3.
**Depends on / blocked by:** X1 (a remote), and a second person.

## P3 — Five dead exports, and a test keeping one alive (filed by /ship, 2026-10-14)

**What:** `walkFloat`, `bounds` and `nominalFinalHeading` (`engine/src/geom/fk.ts`),
`breakWeld` (`app/src/layoutModel.ts`) and `VEHICLE` (`engine/data/brio.ts`) have
no production caller anywhere in `app/`, `engine/` or `try.ts`.

**Why it is worth a line:** `walkFloat`'s only remaining caller is its own test,
and until 2026-10-14 `.gstack/pregate.json` declared `engine/test/render.test.ts`
as the test lane for `engine/src/graph/render.ts` on the strength of it. The lane
was green, the module it named had zero coverage, and the live renderer `App.tsx`
draws from was untested. The lane is fixed; the dead code is what let it look
fine. `breakWeld` is also listed in task U5's file set, so check before deleting:
U5 may be about to give it a caller.

**Effort:** human S / CC S. **Priority:** P3. `/test-audit` territory.
**Depends on / blocked by:** nothing. Confirm U5's intent for `breakWeld` first.

## Completed

### DONE — A recovered orphan could be placed inside a surviving run (P0, fixed 2026-10-15)

**Was:** `loadGraph` re-anchored orphans into lanes chosen by stepping over
occupied ANCHOR POINTS. An anchor names where a component starts; a run
marching along the lane axis occupies lanes its root never mentions, so an
orphan could land on an already-welded joint inside it. A welded end is spoken
for, so `findVertexClashes` reported it rather than excusing it the way it
excuses two free ends meeting, and the verdict read "Can't be built" about a
layout the user built correctly.

**Fix:** the loader clears the FOOTPRINT of everything already placed, which is
what `layoutModel.nextRunAnchor` has always done for the in-app path. It takes
port geometry (`PortsOf`) instead of a port count, which it needed anyway to
validate weld indices, so the parameter got smaller rather than larger.

ONE placement, not one per orphan: moving an anchor along zeta^4 without
changing its heading translates a component rigidly, so every component's
height is measured once and the orphans are stacked using those heights.
MEASURED linear, 400 orphans in 1.4ms and 800 in 2.6ms.

**It took three commits, and the first two were wrong.** The footprint rule
landed in `57b891e`, which then left a stale provisional anchor on orphans
that are not component roots. `captureAnchors` prefers an existing anchor over
the frame a piece was actually at, so the first "Remove last" promoted that
piece to a root and the stale lane won: measured 0 clashes at load and 2 after
one edit, at the same coordinate as the original P0. `06e513f` deletes the
anchor instead, and a differential sweep of 3205 app-built layouts with every
single-edit follow-up found 0 violations against 298 on its parent.

The same commit found `isCyc` accepting any finite coefficient, so a stored
anchor of eight 1e308s produced NaN coordinates that make every closure and
clash test silently answer "no". Tightened to safe integers, then tightened
again: 2^53 - 1 is a safe integer and still breaks exactness, reporting an
eight-curve loop that closes exactly as `closesExactly: false`. The ceiling is
2^31.

**Verified:** the two specs that pinned the original are un-skipped and pass.
Reverting to the anchor-point rule fails 6 tests including both; never
advancing the frontier between orphans fails the two-orphan case; deleting the
non-root anchor deletion fails the lifecycle spec. In the browser, the exact
reproducing layout now reads "Not a loop yet. 2 separate runs of track" with
the position notice still shown, where it used to read "Can't be built".

Also removed on the way: an optional port-count parameter that let the suite
exercise a weaker branch than production, and an `orphans.indexOf(id)` inside
the loop over `orphans` that I wrote in the first draft of the fix.

### P1 — No remote, no backup, no CI
**Completed:** 2026-10-14 (tasks X1 and X1b)

`raduuuuu/brio-designer`, created private and verified `PRIVATE` by
`gh repo view --json visibility` BEFORE anything was pushed, which is the order
this entry's own Cons section asked for: a public remote would have touched the
counsel-gated provenance question, a private one carries none of it. A fresh
clone installs, typechecks, runs 261 tests and builds. CI followed in the same
hour, so the entry's "Unlocks CI" prediction held.

### P2 — Continuous integration (the testing half)
**Completed:** 2026-10-14 (task X1b)

`.github/workflows/ci.yml` runs typecheck, tests and build on push and
pull_request, bun pinned to 1.3.14 and the runner pinned to `ubuntu-24.04`.
Verified by deliberate breakage, not by assumption: `PLANK_WIDTH_MM` 40 -> 41
failed CI red at `engine/test/analytic.test.ts:341`.

A first attempt at that proof is worth recording, because it found something.
`CYCLE_RANK_CEILING` 20 -> 3 passed CI green at the time: cycles.test.ts
imported the constant and built fixtures as `CYCLE_RANK_CEILING + 5`, which is
right for the behaviour under test but pinned no VALUE. Changing it to 3
silently narrowed what the product will rank, with no test objecting.

**NO LONGER SILENT, re-run 2026-10-15: that mutation now fails five specs**,
because the dense-sharing-graph block added with the work budget builds
fixtures at fixed ranks (14 and 20) rather than relative to the constant, and
a ceiling of 3 refuses them. The ceiling's VALUE is still unpinned against a
frame target, which is the part of E13 that remains; what is closed is the
"no test objecting" half. Tracked as eng
finding E13 in `docs/plan/2026-10-13-open-work.md`.

The distribution and font-licence half of the old entry is NOT done and stays
open above.

### DONE — The cycle enumeration froze the tab for 12 seconds (P0, fixed 2026-10-15)

**Was:** `cycles.ts` walked `for (let mask = 1; mask < 1 << rank; mask++)` with
per-subset work proportional to the selected fundamentals' total length. At the
accepted `CYCLE_RANK_CEILING = 20` that is 1,048,575 subsets, and the solve runs
synchronously inside render, so the cost landed on the main thread with no
timeout and no cancel. A freeze is not a throw, so `ErrorBoundary` could not
catch it.

**Fixed in two parts, because the first part was not enough.**

**Part one, the enumeration.** `forEachConnectedSubset` visits only the
CONNECTED subsets of the fundamental-sharing graph (fundamental i adjacent to j
when their piece sets intersect). Lossless, not a heuristic: a disconnected
subset's symmetric difference is a disconnected even subgraph, and
`traceSimpleCycle` already rejects anything that is not one simple circuit, so
every subset skipped could only ever have been discarded. On today's catalogue
the sharing graph has no edges at all, so the walk yields `rank` subsets instead
of 2^rank - 1:

```
  rank 12 /  96 pieces      41ms  ->  0.75ms
  rank 16 / 128 pieces     521ms  ->  0.33ms
  rank 18 / 144 pieces    2348ms  ->  0.37ms
  rank 20 / 160 pieces   12289ms  ->  1.65ms
```

**Part two, the budget, which the review caught.** Part one shipped with a cap
of 20,000 SUBSETS, and subsets are the wrong axis. A subset costs the total
length of the fundamentals it selects, and a fundamental is as long as the tree
path between its closing weld's ends, so cost scales with PIECE count while the
rank ceiling bounds only rank. Measured on a dense sharing graph built from
ordinary two-port parts:

```
  rank 14,  8402 pieces   16,383 subsets, UNDER the 20,000 cap, so nothing
                          truncated at all: 6905ms and then a normal verdict
  rank 20,  6302 pieces   capped, but only after spending 8875ms getting there
```

The first is the worse one: a seven-second frozen tab and no refusal. So the
budget is now `CYCLE_WORK_BUDGET = 150_000` counted in weld-slots and charged
BEFORE each subset's work, which makes it independent of layout size:

```
  analyseCycles on a dense graph    602 pieces 14ms   2102 12ms
                                   5102 pieces 11ms   8402 20ms
  a legitimate 10,000-piece layout at rank 20   answered in full, 10ms
```

Flat in piece count, which is the property that was missing.

**Part three, the trust boundary.** The dense regime was reachable because
`loadGraph` validated a weld's port RANGE and never its OCCUPANCY, so a stored
layout could weld the same track end twenty times. Each duplicate becomes
another closing weld, which inflates the rank AND makes the sharing graph
dense. Measured end to end before the check existed: a 303,940-byte blob loaded
with NO discarded sentence and the solve then blocked for 11,058ms, with
`ErrorBoundary` unable to fire and the key never cleared, so every reload did it
again. `loadGraph` now refuses the whole layout, the same call it already makes
for an out-of-range port index, because a weld is a declared intent about two
specific ends and there is no way to tell which duplicate was meant.

**Part four, the sentence.** Both limits used to report `TOO_MANY_LOOPS` with
`${rank} independent loops is more than this can rank`, and `verdictAction` then
advised "Break this into fewer loops". At rank 14 that is simply untrue -- 14 is
inside the ceiling of 20 -- and the advice points at loops that are not the
problem. `CycleSpace.truncated` is now `false | 'rank' | 'work'` and the work
case gets its own reason, `TOO_BIG_TO_CHECK`.

**Part five, the two things that were actually freezing the tab.** Round two
found that bounding `analyseCycles` had not stopped a large layout freezing,
because two other things on the same path were unbounded and BOTH ran outside
every bound added above.

`findVertexClashes` compared all pairs of ports, and it runs before the rank
ceiling and before `analyseCycles`, on every branch including `rank === 0`. Its
own `gstack-shortcut(dec-f333f98f)` note said to upgrade "when a layout exceeds
roughly 500 ports" and nothing enforced it. Measured on 20 clean rings of
ordinary straights -- every port claimed once, no duplicate weld, catalogue
parts only, so no guard anywhere objects -- a 1MB stored layout of 10,000
pieces took 8337ms in that scan alone and still reported "ok". It now groups
ports by their exact lattice position, which is the replacement that decision
note already prescribed: 8337ms becomes 16-18ms across runs, and the output is byte-identical
across 582 fixtures (every catalogue part at both turns as chains and loops,
400 random soups, the 16xE double circle, the 8L8R tangent pair; 749 clash
records in all).

`App.tsx` passed a `slop` callback that did `graph.pieces.find(...)`, and
`giveOfWeld` calls it once per edge, so the solve was O(welds x pieces) at the
only call site that matters. Clean quadratic -- 23ms at 4,000 pieces rising
to 1,426ms at 32,000, against 0.4ms and 2.2ms with a Map -- with the budget
never firing, because the engine prices weld-slots assuming a slot is O(1)
and a scanning callback breaks that from outside. Both callers now pass a
Map. (Measured as the lookup mechanism, one call per weld end, which is what
`App.tsx`'s comment records and what anyone can re-run; an earlier version of
this paragraph quoted `analyseCycles` timings on a fixture it never named.)

End to end on the same fixture, `solveGraph`:

```
   1,000 pieces   101ms  ->    8ms
   5,000 pieces  2332ms  ->   21ms
  10,000 pieces  9114ms  ->   45ms
  20,000 pieces      --   ->   86ms
```

**STILL OPEN, and this is the honest limit of the fix.** Nothing caps
`pieces.length` or `welds.length` at load, so the remaining cost is linear
rather than bounded. `solveGraph` also still runs on the synchronous render
path and still recomputes `placeAll` instead of taking the placement
`App.tsx` memoized: its own P1, still open.

**CORRECTION, 2026-10-15.** This entry used to end the paragraph above with
"a layout whose ports genuinely all coincide is still quadratic in the
coincidences (792ms at 1,000 stacked pieces, which produces 999,000 clash
records -- work proportional to the answer)". That was true of the grouping
fix alone, and grouping is exactly why: when every port is at ONE position,
every port lands in one group and the comparison inside that group is still
all-pairs. A later commit on this same branch removed it, by reformulating
the rule per PIECE instead of per pair (`graph/feasible.ts`, which now
retracts the same phrase in its own comment). MEASURED on this branch at
1,000 stacked pieces: **2.2ms and 2 records**, against the 792ms and 999,000
this paragraph claimed. The coincident case is no longer the quadratic
exception to the fix; there is no quadratic exception left.

**Correctness evidence, and WHERE IT LIVES, which the first version of this
entry got wrong.** It cited three differential runs -- 33,867 graphs on 6 or
fewer vertices, 5,054 hostile random graphs, 3,315 graphs comparing `gapMm`,
`giveMm` and `withinGive` -- as though they were repo artifacts. They were
review-time measurements made by reviewers in scratch directories and they
exist nowhere in the tree. Citing them here as evidence was the same defect
as a mutation comment nobody ran, one level up: a durable document asserting a
run a reader cannot reproduce.

What IS committed and reproducible:

- `engine/test/cycles.test.ts`, `forEachConnectedSubset` vs a brute-force
  subset walk over 660 random sharing graphs: identical sets, no duplicates.
- `sharingGraph`'s five specs, including the shared-piece branch that no
  catalogue layout can reach.
- The `analyseCycles`-level spec that loses a real loop (3 cycles become 2)
  the moment the sharing graph is replaced with zeros.

What was measured during review and is NOT in the tree, recorded as such: the
three runs above, plus a 582-fixture byte-identical check of
`findVertexClashes` and a 1,202-set byte-identical check of `sharingGraph`,
both done at the terminal while changing those two functions. Worth redoing as
committed differentials; filed below rather than claimed here.

Give is still reduced over each cycle's OWN welds, so T6 is untouched, and
`closesExactly` comes from residuals rather than the enumeration, so the exact
verdict never depended on the walk.

**Suite: 446 passing, ZERO skipped.** Three trees, three numbers, because the
first version of this line conflated two of them: the merge base `0cba762` is
399 passing with 2 skipped (401 total), the mid-branch commit `11dbfd5` is 405
passing with none skipped, and HEAD is 446 passing with none skipped. No tree
has ever had 405 specs with 2 skipped.

**THE REVIEW FOUND MORE IN THE COMMENTS THAN IN THE CODE**, which is this
repo's recurring defect and the reason the test file now opens with a note
about it. Four mutation claims I wrote were wrong and all four were caught by
running them: a reversed `expected false to be true` (really
`expected true to be false`), a predicted `[ 0, 2 ]` that was `[ 1, 2 ]`, a
claim that one mutation would HANG when it fails in 9ms, and a failure count of
four that was really five. A fifth was wrong only because I truncated the
output. None of them weakened a test; all of them were records a reader is told
to trust instead of re-running.

**Two coverage holes the review closed.** The sharing graph's edge-finding
branch was unreachable from the whole suite -- made to throw, all 405 specs
passed -- and so was `analyseCycles`' USE of it: replacing the adjacency with
all zeros, the exact "missing edge" false-pass direction, also left everything
green. Both are now pinned, the second by a theta graph that loses a real loop
(3 cycles become 2) the moment the wiring breaks. Separately,
`verdictView.test.ts` claimed to check that every `VerdictKind` is reachable
while holding a hand-maintained array, which a SUBSET satisfies; adding a kind
left it green. It is a `Record<VerdictKind, true>` now, so tsc fails instead.

**And one spec of mine that flaked.** The first dense-graph timing specs timed
the whole `analyse()` -- including `placeAll` over 8402 pieces -- against a
100ms bound, and failed 2 runs in 8 at 162ms and 100.19ms. They now time
`analyseCycles` alone against 250ms, which still catches the regression by 27x,
and 10 consecutive runs are clean.


### DONE — The overlap scan was quadratic in coincident ports (P0, fixed 2026-10-15)

**Was:** `findVertexClashes` emitted one record per PAIR of vertices in a
place, which is C(k,2) when k of them land together. Grouping by exact lattice
position (earlier the same day) made the SPREAD case linear and did nothing
here, because when ports coincide the group is the layout.

**It needed no hostile input.** `E` turns 45 degrees, so eight close a circle
and an open run laps the same EIGHT places. 800 `add` actions through the real
reducer -- one palette click each -- reached 39,699 records, visible by 200
clicks. A second route needed no curves at all: a blob with no welds and no
anchors stacks every piece at the identity, 32KB for 999,000 records.

```
  lapped run of E     old       new    old records   new records
    1,000 pieces     48ms       3ms        62,124              8
    4,000 pieces    825ms       8ms       998,499              8
    8,000 pieces   5907ms      29ms     3,996,999              8

  pile at identity
    1,000 pieces    968ms       8ms       999,000              2
    2,000 pieces   4922ms      16ms     3,998,000              2
```

`solveGraph` end to end on the 8,000-piece lapped run is 63ms. In the browser a
446KB layout of 4,000 lapped curves renders a verdict in 333ms.

**Fixed by REFORMULATING the rule, not re-deciding it.** The old rule reported
a place when either some vertex there was welded, or some pair of pieces had
free ends in two or more places. The second half is what cost C(k,2), and it
does not need pairs: two pieces share two all-free places exactly when both
SPAN the same pair of places, and a piece has two ports, so it spans at most
one pair. Counting per piece instead of per pair gives the identical answer in
one linear pass.

**VERIFIED IDENTICAL over 1,088 fixtures** -- every catalogue part at both
turns as chains and loops of 3/4/8/9/16/17/24 pieces, 700 random soups, lapped
runs of 9/17/33/64 of every part, piles of 2..60 loose pieces, mixed-part
piles, the 16xE double circle and the 8L8R tangent pair. The set of reported
PLACES is identical in all 1,088 and no layout changes verdict.

**A FIRST ATTEMPT WAS WRONG IN BOTH DIRECTIONS AND WAS REVERTED**, which is
why the differential above is the headline. It read the file's "a third thing
landing on it is a clash" as covering loose ends and reported any place holding
three or more vertices: measured, that flipped 84 layouts from fine to
impossible -- three loose ends meeting at one point, which the product calls an
invitation. A second attempt classified each place as either welded or free,
losing 30 places, because a place can hold a welded vertex AND two or more free
ones, and the old pair walk let the welded pairs become clashes while the
free-free pairs there still counted toward the pile-up. Both were caught by the
differential, not by reasoning.

**What changed for the user:** the count is PLACES, not pairs of ends. That is
forced -- a place can hold n vertices and C(n,2) is quadratic in the input --
and it is also the right number, because `clashMarkers` already dedupes to one
marker per place and over 582 of those fixtures the old count disagreed with
the markers drawn in 142 of the 241 that clash at all. The copy follows it:
"8 spots have track ends in exactly the same place" rather than "8 pairs of
track ends land in...". This is the same defect `feasible.ts` records being
half-fixed once before, when the 16xE double circle said 32 over 8 markers:
counting vertex pairs matched that case only because each place held exactly
two vertices. 16xE still reports 8, verified in the browser, and the tangent
pair still reports 1. The mechanism lives in `feasible.ts`; this entry keeps
the history.

**Specs:** the lapped run and the pile each have one, asserting the place count
and a 300ms backstop. The record COUNT is the primary assertion, because
restoring the pair walk fails it by five orders of magnitude
(`1000 pieces, 62124 records: expected 62124 to be 8`) long before any clock.


## P2 — The review backlog: findings that need judgement, not a keystroke (filed by /ship, 2026-10-14)

The /ship pre-landing review ran six specialists over this branch. Seven criticals
were fixed in the ship itself and the mechanical findings folded into one commit.
These are the rest: real, evidenced, and each needing a decision rather than an
edit. Grouped so one sitting can close a group.

**A. Duplicated constants with no owner.** The same failure shape the project has
already shipped: a value retyped in two places with a comment claiming the other
enforces it.
- `BRAND_LABEL` is byte-identical in `App.tsx` and `SubmitPart.tsx`, and the brand
  list is duplicated as `BRAND_ORDER` / `BRANDS` with the same six members in the
  same order. Adding a brand is a compile error in both; RENAMING one's label
  silently diverges the palette heading from the form's dropdown.
- The BRIO profile (40 / 12 / 26 / 6) exists three times: named but unexported in
  `brio.ts`, as bare literals on every `thirdParty.ts` seed, and again as
  `PROFILE_DEFAULTS` in `SubmitPart.tsx`. The slop budget is duplicated the same
  way (`ESTIMATED_SLOP`, `UNMEASURED_SLOP`, an inline literal). A corrected
  measurement has to be applied in three files and nothing fails if one is missed
  -- which is exactly how `gaugeWidthMm` held the plank width for three days.
  **Needs:** a decision on where shared data constants live. `schema.ts` owns
  `Brand`; `brio.ts` owns the figures.

**B. Dead exports, and one test keeping a function alive.** `walkFloat`, `bounds`,
`nominalFinalHeading` (`geom/fk.ts`), `breakWeld` (`layoutModel.ts`), `VEHICLE`
(`brio.ts`), `IKEA_CONNECTOR` (`thirdParty.ts`), `KNOWN_ABSENT`,
`SWITCH_GEOMETRY_ABSENT`, `STRAIGHT_CITATION`, `CURVE_ARC_CITATION` (`sources.ts`),
`INITIAL_SELECTION` (`editorReducer.ts`), `weldsTouching` (`graph/edit.ts`),
`presetLayout` (`presets.ts`). **Check U5 before deleting `breakWeld`:** it is in
U5's file list, so U5 may be about to give it its first caller. `graphEdit.test.ts`
guards `removeWeld` at the engine boundary and should stay regardless.
**Needs:** `/test-audit`, and the U5 question answered first.

**C. Tests pinned to paths the user no longer takes.**
- `presets.test.ts` solves through `solveLayout(presetLayout(...))`, the CHAIN
  engine the app no longer calls. The app builds a preset through `editorReducer`
  and judges it with `solveGraph`/`viewOf`, so a regression in the reducer's preset
  wiring leaves the pin green. `presetLayout` exists only to feed it.
- Only the blank-canvas preset is solver-checked. Stadium's `note: 'exact'` and
  Near miss's `'72mm short'` are rendered as button titles and never verified.
  Measured today: Stadium closes exactly, Near miss is 72mm. Both true, both would
  silently become lies.
- `graphFeasible.test.ts` asserts `clashes(g).length > 0` where the chain engine's
  equivalent pins exact counts and pairs. Measured: 8L+8R returns exactly 1 clash
  at [0,0]; two stacked A pieces 2; the open 16-run 9.
- `analytic.test.ts` holds published figures as test-local literals (`OUTER = 222`,
  the 40/12/26 profile) that exist in `sources.ts` only inside free-text
  `conflict.note` strings, where no test can read them. K2 is the task that fixes
  this properly.
- `cycles.test.ts` asserts wall-clock `< 250ms`, which on a shared CI runner turns
  a correct refusal into a red build. The structural assertions beside it already
  prove the behaviour.

**D. Input validation: bounds, not just types.** `loadGraph` checks shapes but no
magnitudes. A weld port passes on `typeof === 'number'`, so `NaN`, `-1`, `2.5` and
`1e9` are written into the accepted graph and `portFrame` throws on the next solve
-- the loader declares a blob valid and the app crashes to the boundary on every
load. `pieceId` has no length or charset bound (this is what made the repro
injection reachable), and `Number.isInteger(1e300)` is true so an anchor can sit
1e300 lattice units away. Welds are also spread (`{ ...a }`), carrying unknown
attacker-chosen properties into saved state. **Same class as E9**, which this ship
fixed for `heading` only.

**E. Design and accessibility, needing layout work.**
- `.inventory-row` is a 6-column grid with three `nowrap` columns inside a
  `minmax(260px, 1fr)` track, so its min-content exceeds its area and the refusal
  message -- the visible half of the guard against a discarded inventory -- is
  clipped and painted over by the next row.
- No `<h1>` in the application document; the editor jumps straight to `<h2>`.
- `.port:focus-visible` and `.port.is-armed` have equal specificity, so a port
  armed from the KEYBOARD composes into the heavy ink disc task W3 removed. Mouse
  users are unaffected, which is why it survived.
- `SubmitPart` refuses a number with no message at all: `parseMm` returns null for
  `12,5` (a European decimal comma) and the only signal is a disabled button at
  0.4 opacity, about 2.37:1. The inventory panel solves the same problem properly
  one file over.
- At >=1000px `.notice` has a column span but no row, so the data-loss notice
  renders at the BOTTOM of the screen under the palette; `.shortfall` is not in the
  span list at all.
- The inventory count field is 32px until `pointer: coarse`, while DESIGN.md rule
  10 holds 44px unconditionally on data entry and `.submit-field input` does.

**F. One engine duplication.** `solveGraph` recomputes `placeAll` even though
`App.tsx` already memoized that exact placement and passed it to `renderGraph`, so
the drawing and the verdict build two separate forests and agree only because
`spanningForest` is deterministic -- the property `forest.ts` says it exists to
guarantee by construction. ~0.6ms at 160 pieces, so this is correctness-shaped, not
speed-shaped. Also `differential.test.ts` re-implements the UI's verdict precedence
and gets it BACKWARDS (returns `reason` before checking clashes, where `viewOf`
promotes IMPOSSIBLE), so the harness the file calls "the gate" cannot see the
divergence it exists for.

**Effort:** human ~2d / CC ~3h across all six groups. **Priority:** P2.
**Depends on / blocked by:** B waits on U5's intent for `breakWeld`; the
`analytic.test.ts` half of C is K2's job.

## P1 — `solveGraph` computes a second placement instead of accepting the one App.tsx already made (filed by /ship, 2026-10-14)

**`solveGraph` HALF DONE (2026-10-24).** `solveGraph(graph, ports, resolve,
slop, placement, library?)` takes the placement as a required argument and
places nothing itself; App.tsx hands it the same `placement` memo the canvas
draws from, so a clash mark is in the drawing's frame by construction. Spec:
engine/test/solvePlacement.test.ts.

**`nextRunAnchor` HALF DONE (2026-10-24).** App hands the reducer its
placement with the graph it is of (`FitGeometry.placed`), and `placementOf`
in editorReducer.ts uses it when handed that same graph object, else places
afresh. That covers the unattached add and pick (`nextRunAnchor`), and the
float, drop and join-refusal checks, which also placed the layout again.
Measured at 42,000 pieces before the change: `placeAll` 48ms of
`nextRunAnchor`'s 68ms, the port scan the other 26ms. Spec:
app/src/reducerPlacement.test.ts. **Still open:** the port scan, and
`solveGraph`'s own `renderGraph` call, which repeats App's `render` memo.

**What:** `App.tsx` builds `placement = placeAll(graph, ports)` and passes it to
`renderGraph`. `solveGraph` does not take it — `solve.ts:90` calls
`placeAll(graph, ports)` itself. So the canvas draws from placement A and the
verdict, including `findVertexClashes` whose `at` coordinates `TrackCanvas`
draws markers at, is computed from placement B.

**Why it matters:** they agree today only because `placeAll` is pure and
deterministic. Nothing enforces it, and `placeAll` takes an `anchors` third
parameter defaulting to `graph.anchors`. The moment any caller passes explicit
anchors to one and not the other, the clash markers land somewhere the drawing
never drew, and the two modules disagree about where a piece is — which is the
exact failure T4's single forest was built to make impossible. It also repeats
the forest and placement work on every edit, plus twice more per delete in
`captureAnchors`.

**What it costs, MEASURED 2026-10-15** (this entry carried no price when it was
filed, which is why it sat at P1 without anyone being able to weigh it). On a
42,000-piece layout, one `placeAll` is the dominant term of a ~191ms
`solveGraph`, and the per-edit sequence recomputes `portFrame` across three to
four callers. The duplicate placement is real work, not a theoretical tidy-up.

**A THIRD placement nobody filed: `nextRunAnchor`.** `layoutModel.ts:84` runs
its own `placeAll` AND then scans every port through `portFrame` to find the
vertical extent, and `addPiece` calls it whenever a piece does NOT attach
(`layoutModel.ts:134`, gated on `!attaching && graph.pieces.length > 0`) — that
is every palette click with nothing selected. MEASURED, as the delta between an
unattached and an attached add:

```
   1,000 pieces    1.9ms
   5,000 pieces    8.9ms
  20,000 pieces   31.2ms
  42,000 pieces   58.5ms   (vs 1.1ms for an attached add at the same size)
```

Linear per click, so O(k·n) across a session: the cost is paid again, in full,
on every unattached add. At 42,000 pieces an unattached add is ~53x an attached
one. This is the most expensive thing on the add path and it appears in no other
entry; the two placements named above are `App.tsx`'s and `captureAnchors`'.

**Fix:** `solveGraph(graph, ports, resolve, slop, placement)` — accept it, do
not derive it. `App.tsx`'s comment then becomes true by construction rather
than by convention; it currently says so and is wrong, which is corrected in
place at `cc89914` pending this. `nextRunAnchor` is a separate half: it needs
the placement passed in too, and its port scan wants the extent it already
computed rather than a fresh `portFrame` per port.

**Effort:** human ~1h / CC ~15m for the `solveGraph` half; human ~2h / CC ~20m
for the `nextRunAnchor` half. **Priority:** P1.
**Depends on / blocked by:** nothing.

## P1 — `TrackCanvas` is not virtualised (filed by /ship as a P0, 2026-10-15; the freeze was bounded the same day)

**What:** this branch made the engine linear and the freeze relocated one
layer out, into the render that consumes the engine's answer in the SAME
synchronous pass. MEASURED on 120,000 loose straights -- 3.72M stored chars,
inside a ~5MB quota, which `loadGraph` accepts with `discarded=none` and
`droppedAnchors=0`:

```
  loadGraph                        29ms
  placeAll      (canvas memo)      58ms
  renderGraph   (canvas memo)     185ms
  solveGraph    (verdict memo)    274ms   <- the whole engine
  layoutTrust                       5ms
  saveGraph     (per-edit effect)  25ms
  TrackCanvas render             3153ms   <- 1.2M SVG elements, 96MB markup
```

At 161,000 pieces (4.99M chars, exactly at quota) the canvas is 5,172ms and
1.6M elements. The 3,153ms figure is `renderToStaticMarkup`, which is a FLOOR:
client-side reconciliation plus SVG layout and paint of 1.2M nodes, each free
port carrying `onClick`/`onKeyDown`/`tabIndex`, is strictly worse and is an
OOM candidate.

**Why it is worse than slow:** it is inside render, so it is an uncatchable
frozen tab. `ErrorBoundary` never fires, `GRAPH_STORAGE_KEY` is never cleared,
and every reload repeats it. That is the identical shape of the two P0s this
branch just closed.

**THIS IS THE FOURTH TIME THE BOUND HAS MOVED ONE LAYER OUT, and that is the
finding, not the milliseconds.** Round one capped subsets while per-subset
cost still scaled with pieces. Round two capped enumeration work while the
all-pairs clash scan ran upstream of it. Round three grouped that scan while
the coincident case stayed quadratic. This round made the clash scan linear in
every case, and the render downstream of it is now the binding constraint. The
engine comment that says "`solveGraph` end to end on the 8,000-piece lapped
run is 63ms" was and is true, and it invited exactly the inference that the
tab was fine; it now carries this measurement beside it.

**Mechanism:** `app/src/TrackCanvas.tsx` emits roughly 10 DOM nodes per piece
-- `maxLayers x segments` `<path>` plus 3 `<circle>` per FREE port -- with no
cap and no virtualisation. `maxLayers` and the inner `layers(s.partId)` are
computed in the render body rather than a `useMemo`, so every render repeats
`4 x segments` `resolve()` calls and allocations on top.

**Pre-existing:** `TrackCanvas` is untouched by this branch. It is filed as a
P0 anyway because the branch is what made it binding, and because a reader of
the engine's own numbers would now conclude the opposite.

**HALF FIXED 2026-10-15. The freeze is gone; virtualisation is not done.**

`CANVAS_SEGMENT_CEILING` is 10,000 pieces (`app/src/TrackCanvas.tsx`). Above
it the canvas renders "Too much track to draw: N pieces" with a line saying
the layout is still there and still checked, instead of drawing. The verdict
is unaffected, because `solveGraph` does not depend on the canvas -- so a
layout too big to draw is still CHECKED, which keeps the refusal honest.

The value is set from measurement rather than taste. MEASURED through
`renderToStaticMarkup`, which is a floor for what a browser then does:

```
   2,000 pieces     76ms    40,000 tags    1.6MB
   5,000 pieces    169ms   100,000 tags    4.0MB
  10,000 pieces    453ms   200,000 tags    8.0MB
  20,000 pieces    793ms   400,000 tags   16.1MB
  40,000 pieces   1474ms   800,000 tags   32.2MB
```

About 20 tags per piece, linear. 10,000 is where the draw stays under about
half a second, and it is more than an order of magnitude above the few
hundred pieces the cap entry below calls a big floor. Three specs pin the
boundary at exactly the ceiling, one piece above it, and the copy.

A note on the number first proposed: 20,000 was offered as "about 200,000
SVG nodes, measured ~250ms", which was an extrapolation from a LAPPED run --
fewer free ports per piece, so fewer circles per piece. Measured directly on
loose pieces, 20,000 is 400,000 tags and 793ms, and 200,000 tags is 10,000
pieces at 453ms. The measurement moved the value.

**WHAT REMAINS:** virtualisation -- draw what the viewport covers, so no
layout is ever too big to open and the ceiling can go away rather than being
tuned. Also `maxLayers` and the inner `layers(s.partId)` are still computed
in the render body rather than a `useMemo`, so every render repeats
`4 x segments` `resolve()` calls under the ceiling as well as over it.

**Effort:** human ~3d / CC ~4h for virtualisation; human ~1h / CC ~10m for
the render-body memo. **Priority:** P1 now the freeze is bounded (was P0).
**Depends on / blocked by:** nothing; the ceiling makes it safe to take later.

**FIXED IN THIS BRANCH, the one part that was one line:**
`Math.max(...segments.map(...))` passed one argument per segment. MEASURED:
node/V8, the engine Chrome runs, throws `RangeError: Maximum call stack size
exceeded` at 125,000 arguments; bun/JSC, which is what `vitest` runs under,
returns fine at 161,000 -- so every spec in this repo passed while the browser
threw. A 161,000-piece blob is 4.99M chars and loads clean, so the throw
landed inside render, `ErrorBoundary` painted the crash screen, and its only
exit (`clearAndReload`) also deletes the inventory and the submitted parts,
which `library.ts` records as impossible to recreate. Replaced with a loop.

### DONE — `CYCLE_RANK_CEILING` refused layouts the work budget answers in microseconds (P2, fixed 2026-10-15)

**What:** MEASURED -- 21 separate 8-curve circles, 168 pieces, every loop
closing exactly, reachable by 21 weld clicks with no stored layout involved:
`TOO_MANY_LOOPS`, "21 independent loops is more than this can rank", in 1.1ms.
Twenty of the same circles answer `ok` with `closesExactly: true` in 4.8ms.

**Why it matters:** the ceiling was sized when the enumeration was `2^rank`
subsets, and this branch deleted that justification -- the comment saying
`2^rank` "no longer describes anything" -- while keeping the number. On a
two-port catalogue `sharingGraph` is all zeros, the walk emits exactly `rank`
singletons, and those 21 circles spend 168 of a 150,000-slot budget. The
work budget is the real bound now; 20 is a leftover.

`SUBSET_MASK_BITS` is 31, so the int32 mask supports a ceiling of 31 with no
representation change. Invariant 3 is not broken -- the verdict is a grey "?"
rather than a green pass, and clashes are still reported on this branch -- but
refusing a correct, ordinary layout is the mirror of it, and 21 loops on a big
floor is not an exotic shape.

**FIXED 2026-10-15.** `CYCLE_RANK_CEILING` is now `SUBSET_MASK_BITS`, so the
ceiling IS the representation and the two can no longer drift apart. MEASURED
after: 21 circles answer `closesExactly` in 5.4ms, 31 circles in 2.1ms, and 32
are refused in 1.4ms. The work budget does the bounding, which is the only
bound with a measurement behind it.

**Effort:** spent, CC ~20m. **Priority:** done.

## P1 — Nothing bounds a layout's size (filed by /ship, 2026-10-14; the clash scan itself was fixed 2026-10-15, both halves)

**What:** `loadGraph` validates every field's type and never bounds
`pieces.length` or `welds.length`. `findVertexClashes` compares all pairs of
ports. Measured on an open run (rank 0, so this is NOT the cycle-enumeration
P0):

```
   100 pieces     200 ports   solveGraph      5 ms   blob    9 KiB
   500 pieces    1000 ports   solveGraph     27 ms   blob   48 KiB
  1000 pieces    2000 ports   solveGraph     66 ms   blob   95 KiB
  2000 pieces    4000 ports   solveGraph    267 ms   blob  194 KiB
  4000 pieces    8000 ports   solveGraph   1148 ms   blob  391 KiB
  8000 pieces   16000 ports   solveGraph   4702 ms   blob  786 KiB
```

Clean quadratic. A ~5MB `localStorage` budget holds roughly 50,000 pieces,
which is about 5x10^9 pairs, on the order of minutes per render, doubled by
StrictMode in development.

**HALF FIXED 2026-10-15. The quadratic is gone; the absence of a cap is not.**

`findVertexClashes` now groups ports by their exact lattice position instead
of comparing all pairs -- the replacement `gstack-shortcut(dec-f333f98f)`
already prescribed -- so the figures above no longer reproduce. Measured on 20
rings of ordinary straights, anchored apart so nothing overlaps:

```
   1,000 pieces   clash scan  85ms ->  3ms   solveGraph  101ms ->  8ms
   5,000 pieces               2221 ->  8                 2332  -> 21
  10,000 pieces               8337 -> 16-18              9114  -> 45
  20,000 pieces                 --  -> 33                  --  -> 86
```

Byte-identical output over 582 fixtures. `App.tsx`'s scanning `slop` callback
was the other half of the end-to-end figure and is now a Map.

**WHAT REMAINS, which is what this entry is now about.** Linear is not
bounded. Both halves of the clash scan are now linear -- the spread case by
grouping on the exact lattice position, the coincident case by counting
pile-ups per piece rather than per pair -- so what is left here is purely the
absence of a size cap. Nothing caps `pieces.length` or `welds.length` in `loadGraph`, so a
large enough stored layout still costs whatever it costs, and a freeze is
still not a throw. Two specifics for whoever takes it:

1. **The cap is unwritten.** It is the cheap half and it converts an
   unrecoverable hang into the recoverable refusal every other loader failure
   already gets (notice, `GRAPH_RESCUE_KEY` copy, suppressed save). The
   port-occupancy refusal added the same day does NOT help: it rejects a weld
   on an already-claimed port, and this needs only a large number of
   perfectly legal pieces.
2. **The all-coincident case is FIXED** (2026-10-15, see the DONE entry): a
   pile of 1,000 stacked pieces was 999,000 records in 968ms and is now 2
   records in 8ms, because the count is places rather than pairs of ends.

Also still open and unrelated to the cap: `solveGraph` runs synchronously
inside a render `useMemo`, and `App.tsx` calls `placeAll` once itself and
`solve.ts` calls it again.

**Why it is worse than slow:** it is a HANG, not a throw.
`getDerivedStateFromError` never fires, so the crash screen never paints and
the "Clear saved data" button is unreachable — permanently, on every reload.
Every other failure in this app has an escape; this one does not.

**Fix:** two halves. The cheap half is a hard piece/weld cap in `loadGraph`,
refusing the whole layout above it, which turns an unrecoverable hang into a
recoverable refusal with a notice and a rescue copy. The real half is the
spatial grid `graph/feasible.ts:115-123` already describes, keyed on the exact
lattice position and never on a tolerance. That same comment names the limit —
"Upgrade when a layout exceeds roughly 500 ports" — and nothing enforces it.
The cap value is a product decision: 500 ports is about 250 pieces, which may
be below what someone with a big floor actually builds.

**Effort:** human ~1d / CC ~2h. **Priority:** P1 (the cap alone is ~20m).
**Depends on / blocked by:** the cap value needs an owner's call.

## P1 — The three save functions swallow every failure, including the one the code says must be surfaced (filed by /ship, 2026-10-14)

**SAVE HALF DONE (2026-10-24).** All four saves (`saveGraph`, `saveTable`,
`saveInventory`, `saveSubmissions`) now return whether storage took the write.
App.tsx keeps one flag per store and shows a dismissable notice naming what was
not stored: "Not saved: this browser refused to store your layout. It stays on
screen, but is lost when you close or reload this tab. …". An empty layout or
parts list that fails to save loses nothing, so the notice waits for the first
piece; a later save that succeeds takes its store off the notice. Specs:
app/src/saveFailure.dom.test.tsx. **Still open:** the rescue copy's share of
the quota (the "Compounding" paragraph below). Evicting it would delete bytes
the user may need, so it wants a decision, not a keystroke.

**What:** `saveGraph`, `saveInventory` and `saveSubmissions` each wrap
`localStorage.setItem` in an empty `catch`. Private browsing and a full quota
both throw. The app then silently stops persisting anything, for the rest of
the session, with no notice.

`library.ts:193-196` is explicit that this is not acceptable for one of them:
"unlike the chain this IS data the user cannot trivially recreate, so the
caller should surface a failure." `saveSubmissions` returns `void`, so the
caller cannot. The obligation is unmeetable as typed.

**Compounding:** `loadGraph.rescue()` copies the full refused blob to a second
key. A 2.5MB bad graph plus its 2.5MB rescue copy sits at the ~5MB origin
budget, after which all three saves start throwing. The safety net can consume
the budget of the thing it protects.

**Fix:** have the three save functions return whether they succeeded, surface a
failure for the submissions at minimum, and cap or evict the rescue copy rather
than letting it compete for the live budget.

**Effort:** human ~2h / CC ~30m. **Priority:** P1.
**Depends on / blocked by:** nothing.

## P2 — `dimensions.status` is a self-asserted claim, which blocks sharing (filed by /ship, 2026-10-14)

**What:** `looksLikePart` now validates that `dimensions.status` is a KNOWN
value, and `trustRank` fails closed on unknown ones. Neither checks that the
claim is EARNED. A stored row asserting `status: 'user-measured'` outranks
`published` by design — rank 0 beats rank 1 — which is correct and deliberate
while storage is local: a user who measures their own parts with calipers
SHOULD outrank a catalogue figure, and `trustBoundary.test.ts` pins exactly
that as desired behaviour.

**Why it is still filed:** `library.ts:28-33` records sharing as the documented
next step and calls turning it on "a transport change". It is not. The schema
has no way to distinguish "I measured this" from "someone claims they measured
this", so the moment a submission can arrive from another user, rank 0 is an
open door. `at` is attacker-supplied too and compared as a string, so
`at: "9999-01-01"` wins every same-rank tie permanently.

**Fix (before any sharing, not now):** re-derive `user-measured` locally from a
device-local marker written at submit time and never read from the blob, and
make `at` server-stamped rather than trusted.

**Effort:** human ~1d design / CC ~2h. **Priority:** P2, but a HARD BLOCKER on
the sharing feature.
**Depends on / blocked by:** blocks the backend/publish work above.

## P2 — Documentation: README.md denies most of what this release shipped (filed by /ship's docs audit, 2026-10-14)

**RE-CONFIRMED 2026-10-15 with the exact lines, so this does not need
re-deriving.** Four claims are flatly false against the shipped code, and the
README is the first thing a reader checks it against:

- `:96` "The layout verdict has four states" -- there are ten `VerdictKind`s,
  five of them failure kinds.
- `:105` "The engine is single-cycle" and `:119` "Single cycle only. A layout
  is a chain, optionally closed." -- the graph engine ranks up to
  `CYCLE_RANK_CEILING = 20` independent loops, and the UI renders "N of M
  loops". This one is the most jarring: the branch that bounded that
  enumeration left the README saying it cannot happen.
- `:126` "No inventory, no 3D, no build mode, no library." -- there is an
  inventory (`inventoryModel.ts`), a library and a submissions pipeline
  (`engine/data/library.ts`, `SubmitPart`).

Left to this entry rather than patched in passing, because scoping the chain
engine (`engine/src/solver`) apart from the graph engine is the actual job and
it is prose, not a one-line correction.

**What:** the docs audit returned `blocked`. It made four factual corrections
(test count, `bun run typecheck`, the split U7a/U7b reference, the third
exported plan copy) and refused the rest as owner territory. `README.md`
contradicts shipped code in eight places: "Single cycle only", "Switches …
Not here", "No inventory … no library", "No drag-and-drop. Pieces append and
remove from the end of the chain", and "the overlap check is specified and
unbuilt". All of those now exist.

**Also:** `README.md` calls `tokens.css` "PROVISIONAL" with "a researched
design system … separate work", while `DESIGN.md` says it IS the design system
and commit `d7238cb` is titled "stop telling people to throw it away". One of
the two states the project's position; which one is the owner's call. `README`
line 89 says "There are no per-joint glyphs" while its own Layout tree still
lists "four-channel joint glyphs". The Layout tree predates the graph rewrite
and omits about 25 modules. And `DESIGN.md` plus all of `docs/plan/` are
reachable from neither entry point, so the only explanation-quadrant docs for
this release cannot be found.

**Fix:** `/document-generate` for the README rewrite and the missing how-to
coverage. Not a ship job: it rewrites the introduction, "The UI" and the whole
"What this MVP does NOT do" section.

**Effort:** human ~3h / CC ~45m. **Priority:** P2.
**Depends on / blocked by:** nothing.

## P2 — A no-op edit counts as consent to overwrite, and an engine throw from a handler is uncatchable (filed by /ship, 2026-10-14)

Two small correctness items from the delta review, both narrow enough to
defer and both real.

> **DONE 2026-10-22 in PR 1 of `docs/plan/2026-10-22-editing-and-canvas.md`.** Item 1: the graph's
> acknowledgement is now `EditorState.edited`, set by `reduce` only when the graph changes
> (suppression.dom.test.tsx, "selecting an end writes nothing"). Item 2 turned out NOT to be a defect
> for the editor: `dispatch` calls the reducer only inside the `setEditor` updater, React discards a
> throw from its eager computation and recomputes during render, and the boundary catches it. The
> planned catch in `dispatch` was built, shown to change nothing, and removed;
> editFailure.dom.test.tsx pins the real hazard, computing the next state in the handler. Code that
> calls the engine directly from a pointer handler (drag, PR 4) must still route through `dispatch`.

**1. `setUserHasActed(true)` fires on every dispatch**, including actions the
reducer turns into no-ops: a click on an already-selected port, `clear` on an
empty canvas. That flips `lossUnacknowledged` false, the effect dep arrays
change, and the saves run. A click that changes nothing visible is read as
consent to overwrite stored bytes. Mitigated but not closed by the `rescued`
check landed in `d49dd87`: with a rescue copy the original is recoverable, so
the cost is bounded. **Fix:** set the flag from the reducer's RESULT rather
than the attempt — only when `reduce` returns a graph that differs from the
previous one.

**2. A throw out of `placeAll` is only catchable on the render path.** From
`App.tsx` a React error boundary catches it and the crash screen appears. From
`graph/edit.ts` through the editor reducer the throw is inside an event
handler, where boundaries do not catch: console error, frozen UI, no crash
screen, no repro. Pre-existing and unchanged by this ship; the comment in
`frames.ts` now says so rather than implying the boundary always catches.
**Fix:** catch in `dispatch` and re-throw into state so the boundary sees it.

**Effort:** human ~2h / CC ~25m for both. **Priority:** P2.
**Depends on / blocked by:** nothing.

## P1 — The give bound ignores angular slop entirely, which can make a definite "will not fit" false (filed by /ship's docs audit, 2026-10-14)

**What:** `totalGiveMm` (`engine/src/solver/residual.ts:135`) sums
`axialMaxMm` across joints and nothing else. `angularMaxDeg` is recorded on
every `Joint` by the schema and is **read nowhere** in `engine/src` or
`app/src`. Verified by grep: every occurrence is an assignment.

**Why it matters, in the engine's own terms.** The docblock twelve lines above
that function states the rule: `totalGiveMm` backs a NECESSARY condition, "gap
exceeds give, therefore this definitely will not fit", and that is "only sound
if the give figure is an upper bound on the give really available", because
understating give "would turn the one definite verdict this engine makes into a
false one, which is the worst failure mode here."

If a joint's angular play contributes real give, then omitting it understates
the total, `gap > give` fires on layouts that would actually seat, and the
engine reports IMPOSSIBLE about track that fits. That is the third invariant,
from the other side: a passing layout styled as a failure.

**Is the contribution real?** Unknown, and that is the point.
`CALIBRATION.md`'s opening argues the lever arms are on the order of 300mm
against axial budgets around 1mm, so a small rotation moves a layout's far end
much further than a pull-apart does. If that holds, the engine is ignoring the
larger of the two effects. Nobody has measured it; the evidence is "a few
degrees".

**History:** the minimax LP deleted at decision R21 did model the angular
budget. Dropping it left `angularMaxDeg` in the schema as a vestige and left
`CALIBRATION.md` asserting an angular-dominated verdict for a release that had
stopped computing one. The sheet is corrected; the engine gap is this entry.

**Fix:** either model angular give in the bound (needs the measurement, so it
is gated on the calibration afternoon), or state in the schema and the verdict
copy that the bound is axial-only and argue why that is still an upper bound.
Deleting `angularMaxDeg` is the third option and the worst: it would erase the
evidence that the question exists.

**Effort:** human ~half a day plus the measurement / CC ~1h once a number
exists. **Priority:** P1.
**Depends on / blocked by:** the calibration afternoon (`CALIBRATION.md` Q2).

**Partly addressed 2026-10-19, and NOT closed.** This entry asked for one of
two fixes: model angular give in the bound, or "state in the schema and the
verdict copy that the bound is axial-only and argue why that is still an upper
bound". Tasks X7, T1 and T2 did the stating, in `SlopBudget`'s docblock, in
`totalGiveMm`'s docblock, in the trust register as the `axial-only-give` kind,
and in the verdict copy. **The argument was not made, because it cannot be:**
the eng review of 2026-10-19 established that no measurement is needed to know
the figure is not an upper bound, since a real term is missing AND the
per-joint value is `Math.max` of two per-part summaries. So the verdict stopped
claiming a definite non-fit instead: it now says a gap exceeds the MODELLED
give. This entry stays open on the modelling half.

## P1 — `HEADING_MISMATCH` refuses layouts on the same unproven bound, one branch before give is considered (filed by /plan-eng-review's outside voice, 2026-10-19)

**What:** `solveGraph` returns `HEADING_MISMATCH` whenever
`space.rotationBroken` is true, which it computes from any nonzero
`headingSteps` on a closing weld. That return happens BEFORE any give
assessment, so the angular budget is not consulted even in principle. The user
is told "The track does not come back pointing the right way."
(`app/src/verdictAction.ts`).

**Why it matters.** Joints rotate. A dozen small rotations distributed around a
loop can change the accumulated heading, which is exactly what an angular give
budget would quantify. With no angular bound anywhere in the engine, the
product treats every nonzero NOMINAL heading mismatch as physically
uncorrectable. That does not establish that any particular refused layout
actually seats, but it does mean the refusal rests on the same unproven
assumption the sibling entry above describes, and it was never disclosed.

**Why it is filed rather than fixed.** The sibling was fixable by removing a
claim, because "the gap exceeds the modelled allowance" is a true statement the
arithmetic supports. There is no equivalent true statement here: the engine has
no modelled heading allowance to compare against, so there is nothing to scope
the claim to. Saying so needs a derivation of how much accumulated heading
error distributed joint rotation can absorb, which is geometry plus a measured
angular figure.

**Found by:** the Codex outside voice during `/plan-eng-review` on 2026-10-19
(finding OV3), verified natively against `engine/src/graph/solve.ts` and
`app/src/verdictAction.ts`. The native review had looked only at the `EXCEEDS`
path and missed this one.

**Fix:** derive the absorbable heading error, then either consult it in
`solveGraph` before refusing, or scope the refusal's wording the way `EXCEEDS`
was scoped. Deleting the check is not an option: a heading mismatch is a real
failure, and most of them will be gross rather than marginal.

**Effort:** human ~2 days including the geometry / CC ~2h once the bound
exists. **Priority:** P1.
**Depends on / blocked by:** the calibration afternoon
(`CALIBRATION.md` Q2) for the angular figure, and a derivation that does not
exist yet.

## P1 — `Math.max` and `calibrationStatus: 'measured'` do not establish an upper bound, so the give disclosure can retire on evidence that does not support retiring it (filed by /plan-eng-review's outside voice, 2026-10-19)

**What:** two separate gaps in the same chain.

1. `computeResidual` sets each joint's `axialMaxMm` to `Math.max` of the two
   parts' `slop.axialMm`. Taking the larger of two per-part summaries avoids
   the smaller estimate; it does not prove that a real peg in a real socket
   cannot exceed both. The existing docblock argues max over min on contract
   grounds, which is correct and is a different claim from being an upper
   bound.
2. The `estimated-give` trust disclosure is gated on
   `parts.some((p) => p.slop.calibrationStatus !== 'measured')`. The day task
   X3 records measured figures, that disclosure retires. But measuring one
   joint on one afternoon bounds nothing across brands, specimens, or worn
   track.

**Why it matters.** Together these mean the product can get QUIETER without
getting more correct: the caveat disappears on the strength of a measurement
that does not support the conclusion the caveat was protecting. This is a
sibling of the defect task X7 fixed, inside the very guard X7 split, and the
native review did not see it.

**Found by:** the Codex outside voice during `/plan-eng-review` on 2026-10-19
(finding OV4), verified natively against `engine/src/solver/residual.ts`.

**Fix:** X3's verify list now requires a stated measurement scope and an
aggregation rule that yields a maximum rather than a mean, which blocks the
naive path at its source. What remains here is the engine half: decide whether
`axialMaxMm` should carry a derived upper bound rather than a max of
summaries, and whether `calibrationStatus` is the right gate for retiring a
soundness caveat at all.

**Effort:** human ~1 day / CC ~2h. **Priority:** P1.
**Depends on / blocked by:** X3's measurement scope being defined (done, in the
task body); the engine half depends on what the measurement actually yields.


## P1 — `loadGraph` reports a rescue for bytes that were never at risk, on the legacy-chain path (filed by /ship, 2026-10-14)

**What:** `loadGraph`'s legacy-blob path returns `rescued: rescue(legacy)`
while `raw` is null, i.e. `GRAPH_STORAGE_KEY` held nothing. `App.tsx` turns
that into `noRescueCopy: !graphLoad.rescued`, which gates the graph save.

**The failure:** a user upgrading from the old `brio.chain.v0` format with a
full quota. The rescue write fails, `noRescueCopy` is true, and graph saves
are held until an explicit Dismiss -- protecting bytes that do not exist,
because `saveGraph` writes `GRAPH_STORAGE_KEY` and never touches the chain
key. They build a track and nothing is saved, behind a banner that only says
the canvas started empty. That is verbatim the failure `layoutStore.ts`'s own
docstring calls worse than the bug the gate fixes, now on a third path.

Two of the five return paths (`nothing stored`, and `droppedAnchors === 0`)
also return `rescued: false` and so set `noRescueCopy` true, but `layoutNotice`
is undefined on both, so `savesSuppressed` short-circuits first. They are safe
by accident rather than by construction, which is worth fixing in the same
pass.

**Fix:** make the flag mean "there were live bytes and we failed to copy them
aside". Either have `loadGraph` return `rescued: true` on the legacy path's
success and false only when live bytes could not be copied, or add a
`hadLiveBytes` field and gate on `discarded !== undefined && !rescued &&
hadLiveBytes`.

**Effort:** human ~1h / CC ~15m. **Priority:** P1.
**Depends on / blocked by:** nothing.

## P2 — The crash repro can report a failure the app cannot produce (filed by /ship, 2026-10-14)

**What:** `repro.ts` wraps `resolveLibrary` in a try/catch that falls back
wholesale to `BUILT_IN`. Reproduced: a stored graph using a user-submitted part
`MINE`, plus a submissions blob holding the valid `MINE` row and one junk row.
`resolveLibrary` throws on the junk row, the catch discards the whole set,
`MINE` disappears, and the generated file dies at `makeResolver` with
`unknown part id: MINE`.

The real app never sees this: `App.tsx` resolves from
`loadSubmissionsResult`'s `looksLikePart`-filtered rows, which drop the junk
row and keep `MINE`. So the maintainer reading the dump chases a fabricated
error instead of the user's.

Not a regression -- before the guard the same input exited 1 having printed
nothing, which was worse -- but an incomplete fix.

**Fix:** have the repro mirror the app and run the parsed submissions through
the same per-row filter, keeping the good rows. Falling back to `BUILT_IN`
should be the last resort, and the dump should name the rows it dropped.

**Effort:** human ~1h / CC ~15m. **Priority:** P2.
**Depends on / blocked by:** nothing.

## P3 — The 24-state suppression table restates the implementation (filed by /ship, 2026-10-14)

**What:** `layoutStore.test.ts`'s exhaustive table checks each state against an
"independently written" rule, `lost && (noRescueCopy === true ||
!userHasActed)`. That is a De Morgan transliteration of the function's three
early returns, in the same order. It is exhaustive over the declared domain and
does kill every behaviour-changing mutation run against it, so it earns its
place -- but it cannot catch a wrong POLICY, because both sides encode the same
policy.

Concretely, it was blind to the one-flag-three-gates bug fixed on 2026-10-14:
`userHasActed` is a free variable in the table, so nothing there could see that
one flag fed three gates. That is now pinned separately, by
`app/src/suppression.dom.test.tsx`, which mounts App over three damaged stores
and checks that each action writes only its own store's blob.

**Fix:** derive the oracle from the UI instead of the function -- assert that
each gate's hold state matches its banner's render condition. Then the table
tests a claim about the product rather than a restatement of the code.

**Effort:** human ~2h / CC ~25m. **Priority:** P3.
**Depends on / blocked by:** nothing.

## P2 — `droppedAnchors` counts entries, and a valid anchor can lose to a bad one (filed 2026-10-15)

**What:** two small defects in the same loop, both pre-existing and both
surfaced by the review of the orphan-lane fix.

`droppedAnchors` counts stored ENTRIES, not affected pieces. The anchors field
is an array out of an untrusted blob and may name an id twice, so two
unreadable entries for one piece report "2 had unreadable positions" when one
piece is affected. The notice overstates the loss.

Worse: when an id has BOTH an unreadable entry and a VALID one, the valid
position is discarded. The good entry is taken into `anchorMap`, then the id
is in `orphans` regardless, so it is re-laned anyway. Measured: a valid
`[0,0,0,0,432,0,0,0]` replaced by lane 3. Safe -- no clash results -- but a
recoverable position is thrown away for no reason.

**Fix:** count `new Set` of affected ids for the notice, and skip the
provisional lane for any id `anchorMap` already holds a valid frame for.

**Effort:** human ~45m / CC ~10m. **Priority:** P2.
**Depends on / blocked by:** nothing.

## P2 — `captureAnchors` honours a stale anchor on any demoted root, not just orphans (filed 2026-10-15)

**What:** the orphan-lane fix closed one case of a general problem.
`weldEnds` appends a weld without touching anchors, so merging two components
leaves the demoted component's root anchor in place. `clickPort` is the
user-facing path that does it, and `undo` or a future `breakWeld` is the
promotion that makes `captureAnchors` read that anchor again.

**Why it is milder than the P0 it resembles:** the stale anchor is a real
position the component once held, not a manufactured lane, so the measured
simple case (add, add, add, add, weld, break) reports 0 clashes. It is wrong
rather than dangerous. But `layoutStore.ts`'s comment that "something does
read it" applies verbatim to valid non-root anchors too.

**Fix:** have `weldEnds` drop the anchor of any root it demotes, or have
`captureAnchors` prefer the measured frame for a root whose anchor predates
its last topology change.

**Effort:** human ~2h / CC ~25m. **Priority:** P2.
**Depends on / blocked by:** relates to U5, which wires `breakWeld` to the UI
and makes the promotion path reachable deliberately rather than only via undo.

## P3 — Two give caveats ride on a verdict that says no give is needed (filed by /qa, 2026-10-19)

**What:** On the EXACT verdict the headline reads "This works. Closes exactly, no
give needed at any joint." Directly beneath it the trust register prints two lines
about the give figure: `estimated-give` ("Joint give is estimated, not measured, so
the give total and any verdict resting on it are provisional.") and `axial-only-give`
("The give total counts pull-apart slack only, and the play from joints rotating is
not modelled."). Observed live in a browser at `localhost` on branch
`scope-the-exceeds-verdict`; see `.gstack/qa-reports/qa-report-localhost-2026-10-19.md`
and its `screenshots/exact-state.jpg`.

**Why it matters.** The verdict has just said the give figure is not load-bearing for
this layout, and then two lines qualify it anyway. That is noise in the one state
where the engine is most certain, and it is the state a happy user sees most often.
It also dilutes the caveats where they DO matter: a reader who learns to skip them on
every exact layout will skip them on the refusal too.

**History.** Half of this predates the change. `estimated-give` has always been gated
only on `calibrationStatus`, so it fired on EXACT before anything here. The
`axial-only-give` rule added on 2026-10-19 is unconditional by design, so it doubled
the line count and made the oddity visible.

**Fix:** a product decision first, not a code change. Either suppress give caveats
when `closesExactly` is true, on the grounds that a verdict needing no give cannot be
wrong about the give, or keep them and accept this as the register's standing
behaviour. Note the first option weakens the `axial-only-give` rule's whole argument,
which is that the disclosure must survive conditions rather than disappear under them,
so it is not obviously right. No regression test was written, deliberately: writing
one would freeze a behaviour nobody has chosen.

**Effort:** human ~1h to decide plus ~30m to implement / CC ~15m once decided.
**Priority:** P3.
**Depends on / blocked by:** nothing technical; it needs the product call.

## P3 — The axial-only disclosure is unreadable on any layout holding a third-party part (filed by /qa, 2026-10-19)

**What:** The verdict shows at most `TRUST_INLINE_LIMIT` (2) disclosures, serious
kinds first. Any unverified third-party part adds a serious `unverified-size` note,
which takes a slot and pushes `axial-only-give` into the overflow count. Reproduced
live: with the Near miss preset plus one Playtive 60mm straight, the register rendered

```
shown:    "PLAYTIVE-60 has a size nobody has measured, so this answer is exact about an estimate."
          "Joint give is estimated, not measured, so the give total and any verdict resting on it are provisional."
overflow: "and 1 more note about this layout."
```

The hidden note is the axial-only one. The overflow sentence is deliberately
non-interactive (finding E7), and the full list is only reachable through task U7a,
which is unbuilt. So the engine emits a disclosure the product cannot show.

**Why it matters, and why it is P3 rather than P1.** This was raised during the
2026-10-19 eng review as finding F5 and was the reason that review first proposed
raising the inline limit. That proposal was superseded: the EXCEEDS headline now
scopes its own claim ("Exceeds the modelled give"), so a reader who never sees the
hidden note is no longer misled by the verdict. Confirmed in the same browser run,
where the headline kept its scoped wording while the note was truncated away. What
remains is an information gap, not a wrong claim.

**Fix:** ships with U7a, which makes the full list reachable. Raising
`TRUST_INLINE_LIMIT` is NOT the fix and was explicitly rejected: `axial-only-give` is
emitted last and the sort is stable, so it is the first thing truncated at any limit,
and a four-issue layout hides it again at 3. `app/src/verdictLine.test.ts` already
pins both the singular overflow wording and that the headline keeps its claim while
the note is hidden, so the behaviour is protected while this waits.

**Effort:** human 0 here / CC 0 here; absorbed by U7a.
**Priority:** P3.
**Depends on / blocked by:** U7a (build the graph listing), currently unscheduled.

## P2 — Nothing has ever verified what the verdict announces, and the text inside the live region just changed (filed by /qa, 2026-10-19)

**What:** The verdict is announced through a polite, atomic live region:
`app/src/VerdictLine.tsx:214-216` carries `role="status"`, `aria-live="polite"` and
`aria-atomic="true"`. On 2026-10-19 the EXCEEDS sentence inside that region was
rewritten and a fifth disclosure kind was added to the `aria-describedby` sibling.
**No test, no probe and no human has ever confirmed what a screen reader says when
that region changes.** The `/qa` browser pass on the same day covered the rendered
text and the console and explicitly scored Accessibility as untested.

**Why it matters.** `aria-atomic="true"` means the WHOLE region re-announces on every
change, by design, because a verdict is only true whole. Every piece a builder places
re-announces the entire sentence. That sentence is now longer than it was, so the
cost of the atomic choice went up in a change that never measured it. If the
announcement is too long or repeats on every click, a screen-reader user hears the
editor talk over itself while placing track.

**What is NOT the gap, so nobody re-investigates it.** The structural half is already
right and tested in a browser: task W1 moved `<Trust>` and `<Action>` OUT of the live
region into an `aria-describedby` sibling precisely so they do not re-announce, and
`aria-describedby` is omitted rather than pointed at an empty element. Confirmed in
the DOM on 2026-10-19. The gap is the announcement itself, not the markup.

**This is NOT blocked on E11.** E11 (a real DOM test environment) blocks event-driven
assertions: that Enter activates a free end, focus order, a second Enter welding.
Hearing what VoiceOver says needs a human with VoiceOver, which this project's own
machine already has. Thirty minutes with the screen reader on would settle it, and no
infrastructure has to land first. Note also that the automated tooling cannot close
this one: `renderToStaticMarkup` dispatches nothing, and gstack's headless browser
clicks by element ref rather than tabbing, so neither can hear an announcement or
exercise focus order.

**Fix:** turn VoiceOver on, place pieces until the verdict changes between states, and
record what is actually announced at each transition, including whether the
disclosures are reachable on demand through `aria-describedby` and whether the region
is reachable by keyboard at all. Write the result down. Only then decide whether
`aria-atomic` is still the right call for a sentence this length, and whether the
design review's standing decision ("the verdict region gets `aria-live="polite"` and
nothing else becomes announced") still holds now that the sentence has grown.

**Effort:** human ~30m to listen and record / CC ~0 for the listening, ~30m to act on
what it finds. **Priority:** P2.
**Depends on / blocked by:** nothing. Owner-owned because it needs a human ear.

## P2 — E1's centreline is derived from an unpublished outer radius, and nothing says so (filed by /ship's adversarial pass, 2026-10-20)

**What:** `centrelineRadiusMm` (`engine/src/parts/schema.ts:391-393`) returns
`part.innerRadiusMm + part.plankWidthMm / 2`. For part E that derivation has an
independent published witness: the source states E's inner radius as 182 and its
outer as 222, their difference is the plank width and their midpoint is the
centreline, and `engine/test/sources.test.ts` checks exactly that. For E1 there
is no such witness. The source states E1's inner radius as 90 and **never states
its outer radius at all**, so E1's centreline is an inference from a published
plank width, not a published figure.

**Why it matters.** `engine/data/sources.ts` says in its own docblock that E1's
outer radius "is never published and must not be inferred from the plank width
silently". The engine then performs precisely that inference for every E1 in
every layout, and nothing in the verdict path marks the result as derived. The
source page additionally warns that the printed large-curve diameter "does not
appear to correspond to any actual measurements on the track", so the figures in
this family are the ones least safe to extend by arithmetic.

This is the product's cardinal rule, not a test gap: a verdict resting on E1
geometry is resting on a number nobody published, and the user is not told.

**Scope note.** Pre-existing behaviour, not introduced by K2. K2 made it
visible by writing down which outer radii are published.

**Candidate shape:** a provenance flag on a derived centreline, surfaced in the
trust register the way `estimated-give` and `axial-only-give` already are, so a
layout containing E1 discloses that its curve geometry is partly inferred.

## P3 — The track profile has a third, unpinned copy in thirdParty.ts (filed by /ship's adversarial pass, 2026-10-20)

**What:** K2 made `engine/data/brio.ts` and `engine/data/sources.ts` two
independent transcriptions, compared in `engine/test/sources.test.ts`. A third
copy exists: `engine/data/thirdParty.ts` restates `gaugeWidthMm: 26`,
`plankWidthMm: 40` and `plankThicknessMm: 12` as literals in its seeds, and
those seeds are merged into the catalogue lookup map (`engine/data/brio.ts:173`).
The pins iterate `BRIO_PARTS` only, so the seed copies are covered by nothing.

**Why it matters.** A drifted `plankWidthMm` in a seed shifts
`centrelineRadiusMm` for that part by half the drift, with no spec failing. The
seeds are `unverified`, so a verdict involving them is already hedged, which
caps the damage but does not remove it.

## P3 — Remaining holes in the catalogue/source independence guard (filed by /ship's adversarial pass, 2026-10-20)

**What:** `engine/test/sources.test.ts` asserts `brio.ts` does not import
`sources.ts`, because if it did, every pin in that file would compare one
constant with itself and the suite would stay green. The guard is now a
TypeScript AST walk with filesystem resolution, proven against 19 probes. Four
coupling forms still escape it, each listed in the spec's own docblock:

- a subpath-import alias such as `#sources`, which `split('#')` reduces to the
  empty specifier. No `imports` map in `package.json`, no `paths` in
  `tsconfig.json` and no vite or vitest alias exists today, so nothing uses it.
- an indirected require, `const r = require; r('./sources.js')`.
- `import.meta.glob('./sources*')`.
- a transitive coupling through another module. `brio.ts`'s only value import is
  `./thirdParty.js`, which imports nothing but `../src/parts/schema.js`.

**Why it matters.** This one spec protects every other pin in the file, so its
holes are leveraged. None is a plausible accident: each requires deliberately
unusual syntax, whereas the accident the guard was built for, a direct import
added during a tidy-up, is now caught in sixteen forms. A module-graph walk
would close all four.

## P3 — Test-quality items left after the K2 review (filed by /ship's review, 2026-10-20)

**What:** four small items, none of which blocks anything:

- `TRACK_PROFILE.grooveDepthMm` and `grooveSpacingMm` have no catalogue
  counterpart, so their only check is against the verbatim sentence in
  `RESOLVED[2]`. That catches a typo or a one-sided edit but not a misreading of
  the source written into both places. The needles are also matched against the
  whole note rather than being anchored to the `Verbatim:` quote span.
- `TRACK_PROFILE` and the other source constants are `as const`, which is
  compile-time only, and are not `Object.freeze`d. No production reach, since
  only tests import them, but a test that mutated one would corrupt later specs
  in the same process.
- `engine/test/analytic.test.ts`'s 18mm-lattice spec still uses
  `expect(row, ids).toBeDefined()`, which this project's conventions forbid.
  Pre-existing and outside K2's files.
- `docs/plan/2026-10-13-open-work.md` carries roughly six stale internal line
  pointers: `line 458` and `line 460` point at blank lines, and `2058`, `538`
  and `417-420` point at unrelated content. Two were corrected during this
  review; the rest need re-deriving, and the convention should move to task ids
  or heading anchors so they stop rotting.

## DONE — Three interaction routes to the cursor bug have no interactive test (filed by /ship's review, 2026-10-20; done 2026-10-22)

**What:** the reported append bug had five routes to a null cursor. All five are
closed and pinned in `app/src/editorReducer.test.ts`. Review then showed only
four are reachable: the non-closing preset needs synthetic input, because every
shipped preset closes exactly. Of the four, two are pinned only at the reducer,
by constructing the state and calling `reduce` directly: a weld that consumes
neither end of the cursor, and disarming. The browser QA run drove disarm and
reload through the real app.

**Why it matters.** The two defects this repository has actually shipped here
were both WIRING, not model: eight palette clicks building eight runs because
each handler read a stale `selected` from its render closure, and a reload
restoring the graph without a cursor. A reducer spec cannot see either. The
gap is `vitest.config.ts` collecting `.test.ts` only, in the node environment
with no DOM, so nothing can dispatch a click; `renderToStaticMarkup` renders
but cannot fire events. This is task E11, and these three routes are concrete
cases waiting on it.

**Unblocked 2026-10-22: E11 has landed.** Write these as `app/**/*.dom.test.tsx`
files in the `dom` project (see `CLAUDE.md`); `app/src/App.dom.test.tsx` shows the
pattern, mounting `App` in `StrictMode` and driving it with `user-event`.

**Done 2026-10-22**, in `app/src/cursorRoutes.dom.test.tsx`, driving the real App:
deselecting the end the next piece attaches to, and eight palette clicks
dispatched from one render (the first shipped defect). Reload is
`reload.dom.test.tsx`. **One route was not real:** "a weld that consumes neither
end of the cursor" cannot happen through the UI, because selecting an end also
moves the cursor there, so a join always consumes it. Trying to drive it found a
real gap instead: a join that consumed the cursor nulled it even with free ends
left, and the next piece started a separate run. By the owner's ruling the
cursor now resumes on the newest free end (`resumeCursor`), as Remove last and a
reload do; closing the last loop still clears it.

## P3 — The cursor ring shrinks with the board (filed by /ship's review, 2026-10-20)

**What:** `vector-effect: non-scaling-stroke` now keeps the ring's stroke and
its dashes at a fixed device size, so the dash channel survives any zoom. The
ring's RADIUS still scales with the canvas: measured at 40 straights, the r=21
ring is about 7 device pixels across.

**Why it matters.** It is not wrong, since every port mark scales together and
the ring still reads as dashed against the armed ring's solid stroke, which is
what DESIGN.md rule 2 requires. But a 7-pixel ring carrying 3-pixel dashes is
close to the floor, and a larger layout goes below it. If large boards become
normal, the port marks need a scale floor rather than another per-rule fix.
Measurement and method: `.gstack/qa-reports/20261020T163029Z-split-cursor/`.

## P3 — `add` is the one transition that can still hand back a null cursor unchecked (filed by /ship's review, 2026-10-20)

**What:** `undo`, `preset` and `initialEditor` all derive their cursor through
`resumeCursor`. The `add` branch takes `next.select` straight from `addPiece`,
which returns null whenever a part has one port or fewer
(`app/src/layoutModel.ts:137`). That would be a fifth accidental route to the
reported bug, and no spec watches it.

**Why it matters.** It is unreachable today only because every catalogue part
has exactly two ports and `looksLikePart` restricts submissions to
`straight`/`curve`. `layoutModel.ts:118` already names the case that changes
that: "when a one-port buffer or T2's three-port switch makes the unattached
step reachable". On the day a buffer stop lands, this fix regresses on a path
its tests do not cover. Either derive from `resumeCursor` when `next.select` is
null, or add the spec with a one-port stub part.

**Related, same shape:** `clickPort`'s arming branch sets `cursor` and `armed`
to the clicked ref with no freeness check, so calling the exported `reduce`
with a click on an already-welded port yields a stale cursor and the next piece
starts a new run. Not reachable from the canvas, which only renders free ports,
so this is defensive only.

## DONE — The App.tsx wiring pin is a source-text check and wants E11 (filed by /ship's review, 2026-10-20; done 2026-10-22)

**What:** `app/src/editorReducer.test.ts` proves the reload fix is WIRED by
reading `App.tsx` as text. An adversarial review defeated two earlier versions
of it (a `.slice(0, 1)` on the ports argument, and a wrapper that dropped the
cursor after the call); both are closed, and the spec now pins the call's
position and both arguments as one expression.

**Why it matters.** It still cannot prove the initializer runs, that React
calls it, or that the ports function it receives is right -- only that those
exact bytes are present. Every further evasion is another regex. The property
wants one DOM test that mounts `App` with a stored graph and asserts the cursor
came back, which is task E11. Until then this pin is the only thing between a
correct `initialEditor` and a call site that ignores it.

**Unblocked 2026-10-22: E11 has landed.** Seed `localStorage` with a graph before
`render(<App />)` in a `*.dom.test.tsx`, add a piece, and assert it joined the run;
then this source-text pin can be retired.

**Done 2026-10-22.** `app/src/reload.dom.test.tsx` saves a three-curve run,
mounts App in StrictMode, adds a piece and checks it joined the saved run
("4 pieces, open at both ends", announced as joined to the end of piece 3).
The source-text pin in `editorReducer.test.ts` is retired. Both mutations it
recorded were re-run against the mount: a nulled cursor fails the verdict
check, and a narrowed port list, which the old pin also caught, fails the
announcement because the piece goes on the wrong end.

**Same treatment for the save-gate wiring, 2026-10-22.** `layoutStore.test.ts`'s
`describe('the suppression wiring is present in App.tsx')` sliced App.tsx by
string offsets to check which action set which store's flag. It is replaced by
`app/src/suppression.dom.test.tsx`: the graph, inventory and submissions stores
are seeded with losses, App is mounted, and a graph edit, an inventory change
and a submission must each write only their own blob, with the graph's
no-rescue-copy exception checked by failing the rescue write. Twenty mutations
of the wiring were run and every one fails a spec, including the four graph-gate
mutations that only the text check used to catch.

## P2 — What the MakerWorld switch seeds left open (filed 2026-10-22)

**What landed:** four BRIO switches (L, M, O1, P1) in the library as
`unverified` seeds, measured off the 3MF meshes of Cactus 973's MakerWorld
reproductions (`engine/data/switchSeeds.ts`). In the same change the heel
stopped being exempt from give and polarity: port 0 is the plank's end face
and carries a peg or a socket, and the exemption came from an earlier model
in which the heel was a point inside the piece.

**Still open:**
1. **The other switches need part kinds the schema does not have.** I/J
   (three-way, four ends), O/P (a Y: an E1 either side, no straight road),
   F/G and F1/G1 (parallel offset roads, 46 to 47mm apart). All were found
   and measured; none fits `SwitchPart`.
2. ~~**T3b's switch disclosure has not landed**, so a layout with a seed switch
   carries only the generic unverified-size note.~~ **Done 2026-10-22**: a
   layout with a switch now says its geometry is modelled, not measured.
3. **`BRIO_PIECE_TABLE` is stale for these four.** Its rows for L/M and O1/P1
   still say `needs-graph`; they are now present as seeds, and the graph has
   existed since the rewrite.
4. **The seeds rest on one designer.** AU3D independently agrees on the O/P
   Y-switch geometry, but nobody else modelled L/M. A real measurement (the
   entry above, and `CALIBRATION.md` Q6) replaces them through the normal
   submission override.

**Priority:** P2. Items 1 and 2 are the ones a user meets first.

## DONE — A turned-round piece reads "turning right" in the layout list (filed 2026-10-22; done 2026-10-22)

**What landed:** the editor now puts a piece on whichever way round lets peg
meet socket (`orientation` in `app/src/layoutModel.ts`). Reported: the M switch
(socket roads) then an E was "Can't be built", because the E went on by its
socket start. Now it goes on by its peg, with its stored turn flipped so it
bends the way the palette button asked along the direction of building; it ends
exactly where L-then-E does. A piece with no end of the other kind (B, C, B2,
C2 onto the wrong end) is still refused, honestly.

**What is left:** the graph listing names a piece's bend from its own start
(`pieceName` in `GraphListing.tsx`). A turned-round E's start is its free far
end, so it reads "turning right" although the user pressed "Add Large curve"
(left) and sees it bend left as they build. True in the list's own frame,
surprising in the user's. Options: name the bend from the end that was joined
first, or say "turned round" beside it.

**Priority:** P3. No verdict or geometry is wrong; it is wording.

**Done 2026-10-22.** Took the first option. `laidFrom` in `GraphListing.tsx`
finds the end each piece went on by (its first joint to an earlier-placed
piece), and a piece that went on by anything but its start is named from that
end and says so: M then E reads "Piece 2: Large curve (E), turning left, joined
by its end". A piece that started a run, or went on by its start, reads as
before. Pinned in `GraphListing.test.ts` through the real reducer.

---

## P2 — Canvas marks keep their screen size (filed by /plan-design-review 2026-10-23)

**DONE (2026-10-24).** Every red fault mark (clash, refused joint, both level
faults) and the adapter diamond are enlarged by one factor, `markScale` in
TrackCanvas.tsx, so none is drawn below 0.75px per millimetre; the red strokes
are non-scaling, 3px on a 5px paper halo (app.css `.red-mark`). DESIGN.md
rule 11 records the floor. Spec: app/src/markScale.dom.test.tsx.

**What:** Give the red clash mark, the red refused-joint mark and the adapter diamond a minimum
on-screen size, and the two red marks non-scaling strokes.

**Why:** The canvas shrinks a big board to fit, and these marks are drawn in millimetres, so they
thin and shrink to dots (DESIGN.md rule 11), exactly where a fault or an adapter is hardest to find.

**Pros:** Every mark stays findable at any zoom, on one consistent scale.

**Cons:** Touches three marks and their specs; the size floor needs the measured pixels-per-mm,
which exists only after layout (`shown.pxPerMm` in TrackCanvas).

**Context:** Found in the design review of docs/plan/2026-10-23-socket-adapter.md (D11, D12). The
adapter diamond's stroke is non-scaling since that review (7A); its size and both red marks are not.

**Effort:** human S / CC S
**Priority:** P2
**Depends on:** nothing

