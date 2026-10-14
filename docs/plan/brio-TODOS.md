# TODOS — BRIO Track Designer

Created 2026-10-06 by /plan-ceo-review. The repo exists now
(`raduuuuu/brio-designer`, private); this is the exported copy that lives in
the tree, and `docs/plan/README.md` says where the canonical one is.

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

---

## Open and unassigned: the overlap narrowphase primitive

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

## P2 — Offer only polarity-compatible free ends in the editor

**What:** When one free end is armed, grey out or ignore the free ends that
cannot physically mate with it, so the editor stops inviting a join it will
then refuse. Keep the verdict-level check as a backstop for layouts restored
from storage, which bypass the click path entirely.

**Why deferred (D4, 2026-10-13):** The failure is already caught and reported,
not silent: `findWeldPolarityViolations` is tested and IMPOSSIBLE outranks an
exact closure. And the editor is about to change shape when switches land, at
which point a heel is exempt from polarity altogether and the rule would be
rewritten. Doing it now is doing it twice.

**Upgrade trigger:** after the switch catalogue row (S2) ships and the set of
port kinds has settled.

**Origin:** task C2 of the fourth eng review, second half. The first half,
polarity in the schema, already shipped.

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

**What:** `engine/src/graph/solve.ts` has exactly one importer among the 15 test
files: `engine/test/differential.test.ts`. So the verdict union's five return
sites are exercised only where the chain engine can follow, and `TOO_MANY_LOOPS`
by construction cannot be: the chain model has no concept of rank above 1.

**Why deferred rather than scheduled:** the branch is guarded by
`CYCLE_RANK_CEILING = 20`, which is tested directly in `engine/test/cycles.test.ts`
one layer down, and no defect points at it. The principle this project has been
applying holds: a test earns its place by catching something the existing layers
cannot. Pick this up with K1, when nine more parts widen the union's input space.

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
`CYCLE_RANK_CEILING` 20 -> 3 passed CI green: `engine/test/cycles.test.ts`
imports the constant and builds fixtures as `CYCLE_RANK_CEILING + 5`, which is
right for the behaviour under test but pins no VALUE. Changing it to 3 silently
narrows what the product will rank, with no test objecting. Tracked as eng
finding E13 in `docs/plan/2026-10-13-open-work.md`.

The distribution and font-licence half of the old entry is NOT done and stays
open above.

## P0 — The cycle enumeration freezes the tab for 12 seconds (filed by /ship, 2026-10-14)

**What:** `engine/src/graph/cycles.ts:186` walks `for (let mask = 1; mask < 1 << rank; mask++)`
with per-subset work proportional to the selected fundamentals' total length. Every
edit re-solves synchronously inside render, so the cost lands on the main thread with
no timeout, no cancel and no worker. A freeze is not a throw, so `ErrorBoundary`
cannot catch it.

**Measured on the committed tree, twice, by two independent probes** (the second was
this session re-deriving the first rather than trusting it):

```
  rank 12 /  96 pieces      48ms     cycles kept 12
  rank 16 / 128 pieces     569ms     cycles kept 16
  rank 18 / 144 pieces    2563ms     cycles kept 18
  rank 20 / 160 pieces   12179ms     cycles kept 20
```

The recorded figures the rank-20 ceiling was chosen against (2ms@12, 15ms@16,
471ms@20) understate the shipped worst case by up to 26x, because rank alone does
not determine cost: piece count does, and nothing caps pieces or welds. The same
rank 20 costs about 1.1s at 20 pieces and 12.2s at 160.

**Why the work is provably wasted, which is what makes this cheap to fix:** every
part in the catalogue has exactly 2 ports, and both `weldEnds` and `addPiece` only
weld FREE ports, so no piece can carry a third weld. Every fundamental cycle is
therefore vertex-disjoint from every other, `traceSimpleCycle`'s degree-2 filter
rejects every mask of popcount >= 2, and `cycles kept == rank` in every topology
probed. At rank 20 that is 1,048,555 subsets of pure waste out of 1,048,575.

**Fix:** build the fundamental-sharing graph once (fundamental i adjacent to j when
their piece sets intersect) and enumerate only its CONNECTED subsets. On today's
catalogue that collapses to `rank` iterations and costs nothing. The full cycle space
is still covered the moment a 3-port switch lands, so T6's no-pooling guarantee is
unchanged — which matters, because "give is never pooled across cycles" is one of the
three invariants no task may weaken.

Separately worth doing: move `solveGraph` off the synchronous render path, and give
it the placement `App.tsx` already memoized (`solve.ts:85` recomputes `placeAll`, so
the drawing and the verdict build two separate forests and rely on determinism rather
than construction to agree).

**A failing timing test is already written and SKIPPED** at
`engine/test/cycles.test.ts`, so the spec is in the repo rather than in this entry.
Un-skip it to start.

**Effort:** human ~1d / CC ~1h. **Priority:** P0.
**Depends on / blocked by:** nothing. Deferred from the 2026-10-14 ship by owner
decision D5, to keep a core-engine algorithm change out of a PR already carrying six
critical fixes.

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

## P0 — A recovered orphan can be placed inside a surviving run, which manufactures a false "can't be built" (filed by /ship, 2026-10-14)

**What:** `layoutStore.loadGraph` re-anchors pieces whose stored anchor was
unreadable into free "lanes" along `zeta^4`. The occupancy check de-duplicates
ROOT ANCHOR POINTS only. A run that marches along the lane axis occupies lanes
its root does not name, so an orphan can be dropped into the middle of it.

**Measured at `a95408d`:** two 216mm straights (`D`) welded into a run anchored
at the identity with `heading: 4`, plus one orphan, yields
`MANUFACTURED CLASHES = 1` at `[1.3226185430791415e-14, 216]`. p0 spans lane 0
to lane 1 and p1 spans lane 1 to lane 2; p1's root is at lane 1 but only roots
are anchored, so `taken` does not contain it. The orphan takes lane 1 and lands
on p1's already-welded port 0. A welded end is spoken for, so
`findVertexClashes` pushes it straight to `clashes` rather than excusing it the
way it excuses two free ends meeting. `viewOf` then returns IMPOSSIBLE and the
verdict reads "Can't be built" about a layout the user built correctly.

**Why it matters more than a wrong position:** the notice says part of your
track may be in the wrong place. It never says the verdict below it is wrong.
The twenty-line comment at the lane search argues explicitly that a visible
wrong position beats an invisible wrong verdict — and then produces the wrong
verdict anyway. The product's only output is a trustworthy verdict.

**Fix:** place each orphan past the BOUNDING BOX of everything already placed,
not past occupied root points. `layoutModel.nextRunAnchor` already does this
correctly for the in-app path, computing clearance from `maxY - minY`; the
loader uses a strictly weaker rule for the same decision because it has part
ids but no port geometry. Either thread a `PortsOf` into `loadGraph`, or return
the orphan ids and let `App.tsx` place them through `nextRunAnchor`. The second
is cleaner: the resolver already lives there.

**Regression pin:** `app/src/layoutStore.test.ts`, `describe.skip('an orphan
lane clears a survivor RUN, not just its anchor')`. Both cases fail when
un-skipped — 1 clash instead of 0, and lane 1 instead of lane 3. Do not delete
it to make the suite green.

**Why deferred rather than fixed in the ship:** this is the THIRD attempt at
this one bug. The first shipped `anchorMap.size + k + 1`, which counted
survivors; the second shipped the root-point `taken` set, which is this. Both
were written under ship pressure and both were wrong. The correctness argument
runs through lattice projections and the fix changes a module signature.

**Effort:** human ~3h / CC ~40m. **Priority:** P0.
**Depends on / blocked by:** nothing.

## P1 — `solveGraph` computes a second placement instead of accepting the one App.tsx already made (filed by /ship, 2026-10-14)

**What:** `App.tsx` builds `placement = placeAll(graph, ports)` and passes it to
`renderGraph`. `solveGraph` does not take it — `solve.ts:85` calls
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

**Fix:** `solveGraph(graph, ports, resolve, slop, placement)` — accept it, do
not derive it. `App.tsx`'s comment then becomes true by construction rather
than by convention; it currently says so and is wrong, which is corrected in
place at `cc89914` pending this.

**Effort:** human ~1h / CC ~15m. **Priority:** P1.
**Depends on / blocked by:** nothing.

## P1 — Nothing bounds a layout's size, and the clash scan is quadratic in ports, so a large stored layout hangs render uncatchably (filed by /ship, 2026-10-14)

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
one flag fed three gates. That is now pinned separately, by a test asserting
the three gate calls use three distinct flags.

**Fix:** derive the oracle from the UI instead of the function -- assert that
each gate's hold state matches its banner's render condition. Then the table
tests a claim about the product rather than a restatement of the code.

**Effort:** human ~2h / CC ~25m. **Priority:** P3.
**Depends on / blocked by:** nothing.
