# TODOS — Generic Track Designer

Created 2026-10-06 by /plan-ceo-review. The repo is `raduuuuu/ChooChooCAD`
(renamed from `ChooChooCAD`; public, deployed to woodentrain.world); this is
the exported copy that lives in the tree, and `docs/plan/README.md` says where
the canonical one is.

**Tidied 2026-11-01.** Every finished entry's heading now starts with DONE or
CLOSED, so a heading that still names a priority is open work. Bodies are kept
as written.

**2026-11-04:** finished entries moved word for word to `docs/plan/TODOS-archive.md`;
only open work stays here (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md).

## P2 — The ramp measures 225mm on the floor, not 216 (filed by /plan-eng-review 2026-10-30)

**What:** Re-measure the ramp N's run flat on the floor, end face to end face. If
it is 225mm, set N's run to 225 and drop its unverified mark.
**Why:** The 2026-10-30 readings give run 225mm and slope 230mm; the app uses 216,
so every ramp is drawn 9mm short. The two readings disagree slightly (a 64mm rise
over 225mm needs about 234mm of slope), which is why one re-measure comes first.
**Pros:** One number; 225 is a whole millimetre, so exact closure survives ramps.
**Cons:** None beyond the re-measure.
**Context:** Left out of the joint-bend design by owner decision (Premise 3).
`bun run calibration` prints the Q4 result. Part in engine/data/rampSeeds.ts.
**Depends on:** the re-measure.

## P2 — Community custom-part registry

**What:** Let the part database accept community-defined parametric parts, so
users can register 3D-printed track pieces and design with them.

**Why:** A large ecosystem of printable Generic-compatible parts already exists and
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
`ceo-plans/2026-10-06-generic-track-designer.md` under "NOT in scope".

- **E7 Kid mode** (S) — big targets, no menus, drive-the-train only, layout locked
- **E8 Table / room bounds** (S) — declare your table or rug, warn on overhang
- **E9 Photo-based inventory** (L, speculative) — CV counts scattered track by type
- **E10 Symmetry / mirror + auto-complete-the-loop** (M) — pick two open ends,
  fill the gap from inventory

---

## P1 (pre-launch) — IP: data provenance and product naming

**2026-11-04 status (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** the naming half is done in what the app shows (product named; Generic brand; trait names "Small-peg"/"Look-alike", app/src/traitNames.test.ts). Still open: Q1 provenance of the transcribed tables, the licence terms of the replica-derived switch seeds, and maker names in internal ids and the `Brand` enum (engine/src/parts/schema.ts). Q2 below was garbled by the brand find-and-replace. Partnership outreach is shelved, so this stays P1 for counsel, not code.

Added 2026-10-06 by /plan-eng-review (D20). Blocks public launch only; blocks
nothing in development.

**OVERDUE (noted 2026-11-01).** This said to settle these questions before the
part database is published in a repo or deployed. Both have happened: the repo
is public and the app is live at woodentrain.world. The questions are still
open and still need counsel.

**What:** two questions needing counsel, not engineering.
1. The part database is a wholesale transcription of the published guide's curated
   measurement tables. Raw measurements of physical objects are facts, but a
   curated compilation of them may be protected. Determine whether permission is
   needed, or whether the data should be independently re-derived from physical
   measurement (which T16's corpus work partly does anyway).
2. Generic is a live trademark. No product name has actually been chosen yet — the
   plan document's title is the reviewer's working label, not a decision — so
   settle whether the eventual name may reference Generic, or whether it must be
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
dimensions read off the 3MF files of one printed replica set,
licensed Creative Commons Attribution-NonCommercial-ShareAlike. Other printed
models were used only to compare against, and one to confirm which end of B and C carries the pegs. The licences seen on
those pages were CC BY-NC-SA, CC BY-NC and the hosting site's "Standard Digital File";
one model's own licence was not checked. A dimension is
probably a fact rather than a work, but the NonCommercial terms matter if the
product is ever sold, and nobody has checked whether reading measurements off a
licensed model is use of the model. This does not unblock K9 (set manifests),
which waits on the published guide question above; printed reproductions supply no
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
traversal checker, full Generic catalogue, save/load, tests, undo/redo, planar
overlap).

Reason the core comes first: the engine's slop budgets were a guess roughly 3x
too tight, so every verdict the product gave was probably wrong. Distribution
features built on top of that would have distributed the error.

## P2 — Inventory: a copyable buy list, and what can I build with what I have

**2026-11-05 (/plan-ceo-review, docs/plan/2026-11-05-inventory-by-part.md):** SETS ARE DROPPED (owner: "not set but rather part dependent"): no set manifests, no "which sets do you own" screen. The owner chose "simple first": Your box was made always reachable and stripped back to a plain list of counts (branch simple-box). Left here for later, when the owner wants "more complex things": a copyable buy list for the layout; "What can I build" checking ready layouts against the box; "These are mine" (raise each count to what the layout on screen uses); about five more ready layouts so that list is worth opening; an owned-only palette filter. The paragraphs below describe the older set-based plan.

**2026-11-04 (D6, P1 → P2, narrowed) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** per-piece counts, quick-fills, the shortfall list and greyed unowned cards exist (inventoryModel.ts, Inventory.tsx, App.tsx). What remains is only: declaring sets you own (set manifests), a copyable buy list, and rebuild-with-what-I-have.

**What:** Declare which Generic sets you own; constrain the palette to owned pieces;
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

**2026-11-04 (partnership CEO review, D1):** deferred again; a maker partner
could supply exact set contents, saving the counting. Plan:
docs/plan/2026-11-04-partnership-pitch.md.

---

## P2 — Animated train playback and the completion arc

**2026-11-04 (D5):** absorbs "The success state's payoff beat" (archived). The train height it waited on is measured (55).

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
borrowing a substantial amount of real Generic track.

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

# Deferred by /plan-ceo-review 2026-10-07 (third pass, after the layer instruction)

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

## P2 — Calibration readings still open (umbrella)

**2026-11-04 (D6, P1 → P2 umbrella) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** the open physical readings, each with its own entry or sheet question: ramp run 225 vs 216 ("The ramp measures 225mm"), Q2 bend, a real switch ("Measure a real Generic switch"), F4 support span ("Check that raised track is held up"), F2 train under a bridge (the P1 clearance entry), plank thickness, Q1b. The rise is no longer null: 61 (measurements.ts q5).

**MOSTLY DONE (2026-10-30, PR #72).** The afternoon happened. Joint stretch
and the train's height are measured and in `engine/data/measurements.ts`; the
Q1 loop closed and carried a train, which is where the Generic bend limit now
comes from (`engine/data/bendLimit.ts`, status `inferred`). Still `null`, and
each read as published or estimated until someone measures it: the bend
itself (Q2, `bendDeg` or `bendSidewaysMm`/`bendOverMm`), the ramp rise and
plank thickness (published 64 and 12), the Q1b loop's leftover gap, and a
real switch's three figures (`throughMm`, `chordMm`, `offsetMm`; its own P2
below). Every one of them gets an engineering diagram on the sheet before it
is asked for. The history below is kept as written.

**2026-11-01.** A layout of interlocking loops that closes on the floor was
refused by the bend checker's work budget, not by the calibration (#105, #106).
Q2 now has its plan-view drawing on the calibration sheet; a Q2 reading would
replace the inferred limit with a measured one.

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
`engine/data/generic.ts` labels every slop budget `estimated`. The bound's hedged
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
  switches ship. Published Generic dimensions may answer it without calipers.

**Effort:** human ~1 afternoon / CC ~0 (this one does not compress)
**Priority:** P1
**Depends on:** real track and floor space

# Deferred by /plan-ceo-review 2026-10-13 (SELECTIVE EXPANSION)

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

## P2 — Measure a real Generic switch (filed by T1, under the calibration deferral)

**Still open, no longer blocking (2026-11-01).** Switches shipped as
unverified seeds read off printed models, so the catalogue row this entry
said could not ship did. A measured switch would turn its seed into a
verified part; Q6 on the calibration sheet asks for the three figures.

**What:** With a physical Generic switch and calipers, record its through-road
length, diverging-leg radius and arc, and the heel offset. Then compute the
rounding residual against the 22.5-degree lattice.

**Why:** Task T1 (2026-10-13) searched four source classes and found no citable
figure: manufacturer pages for 33344 and 33346, retailer specs, patent and
dimensioned drawings, and the published track guide, which is the
citation behind every other dimension in the catalogue. The full enumeration is
in `CALIBRATION.md` Q6. Without a number, the switch catalogue row cannot ship
and the engine's switch support stays reachable only from tests.

**Pros:** Unblocks the one feature the graph rewrite was built for. The engine,
the heel semantics, the editor and the per-cycle machinery are all finished and
tested; this is the only missing input.

**Cons:** Needs a physical part and calipers, so it cannot be done from a
keyboard. The residual may turn out to exceed E1's ceiling, in which case the
honest answer is that a Generic switch is not modellable on this lattice.

**Context:** Filed under the EXISTING calibration deferral rather than as new
scope, because the user deferred measurement work on 2026-10-07 and the fifth
CEO review retired four elevation tasks for following it. `CALIBRATION.md` Q6
lists the four measurements and the method. E1 of the fifth eng review makes
the residual the number a verdict gets checked against, so recording it is the
point, not an extra.

**Effort:** human S (one afternoon with the part) / CC: cannot be done by CC.
**Priority:** P2.
**Depends on / blocked by:** owning a Generic switch. Blocks task T2 entirely.

## P2 — The review backlog: findings that need judgement, not a keystroke (filed by /ship, 2026-10-14)

**2026-11-04 (D5):** item B absorbs "Five dead exports" (still dead: walkFloat, nominalFinalHeading, bounds in fk.ts; VEHICLE in generic.ts). Item A's profile copies move to "The track profile has a third, unpinned copy".

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
- The Generic profile (40 / 12 / 26 / 6) exists three times: named but unexported in
  `generic.ts`, as bare literals on every `thirdParty.ts` seed, and again as
  `PROFILE_DEFAULTS` in `SubmitPart.tsx`. The slop budget is duplicated the same
  way (`ESTIMATED_SLOP`, `UNMEASURED_SLOP`, an inline literal). A corrected
  measurement has to be applied in three files and nothing fails if one is missed
  -- which is exactly how `gaugeWidthMm` held the plank width for three days.
  **Needs:** a decision on where shared data constants live. `schema.ts` owns
  `Brand`; `generic.ts` owns the figures.

**B. Dead exports, and one test keeping a function alive.** `walkFloat`, `bounds`,
`nominalFinalHeading` (`geom/fk.ts`), `breakWeld` (`layoutModel.ts`), `VEHICLE`
(`generic.ts`), `IKEA_CONNECTOR` (`thirdParty.ts`), `KNOWN_ABSENT`,
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

## P3 — Canvas virtualisation and a layout-size cap (merged: "TrackCanvas is not virtualised" + "Nothing bounds a layout's size")

**2026-11-04 (D6, P1 → P3, merged) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** a 10,000-piece canvas ceiling (TrackCanvas.tsx:59,818) and the linear engine already stop the freeze; share links cap at 500 pieces. What remains: decide a load cap in `loadGraph`, and memoise `maxLayers` (TrackCanvas.tsx:536-541), a ten-minute fix.

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

**2026-11-04 (D5):** absorbs the review backlog's item A. Now six or more copies: thirdParty.ts:126,233-271, bufferSeeds.ts:41, rampSeeds.ts:39,65, structureSeeds.ts:28, SubmitPart.tsx:32.

**What:** K2 made `engine/data/generic.ts` and `engine/data/sources.ts` two
independent transcriptions, compared in `engine/test/sources.test.ts`. A third
copy exists: `engine/data/thirdParty.ts` restates `gaugeWidthMm: 26`,
`plankWidthMm: 40` and `plankThicknessMm: 12` as literals in its seeds, and
those seeds are merged into the catalogue lookup map (`engine/data/generic.ts:173`).
The pins iterate `GENERIC_PARTS` only, so the seed copies are covered by nothing.

**Why it matters.** A drifted `plankWidthMm` in a seed shifts
`centrelineRadiusMm` for that part by half the drift, with no spec failing. The
seeds are `unverified`, so a verdict involving them is already hedged, which
caps the damage but does not remove it.

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

## P2 — Check that raised track is held up (filed by /plan-ceo-review, 2026-11-03)

**2026-11-06: built, waiting on F4.** `engine/src/graph/supports.ts` checks every raised stretch between held places (a track support whose 25×52 footprint the centre line crosses, turned within 22.5°; a ramp's high end; a structure's raised road) against F4, read from `measurements.ts` `f4.supportGapMm`. Owner decisions: a warning with the X naming the piece, the verdict unchanged; track ending in mid-air reported as not checked; placement by centre line, roughly along. While `f4.supportGapMm` is null the verdict still says "supports are not checked". Filling it in turns the check on with no code change. Tests: engine/test/supports.test.ts, app/src/supportsNote.test.ts.

**2026-11-04 (D5):** absorbs "Support and pier modelling" (archived). Measurement: calibration sheet F4, the span between two supports.

**What:** Replace the blanket "Raised track: supports are not checked." note with a real check: every raised piece has a track support (TS), a riser or a structure under it within a measured reach, and the verdict names the piece that isn't held up.

**Why:** It is the last part of "will this layout work?" the app doesn't check, and the measured track support (PR #130) makes it checkable.

**Needs first:** one measurement from the owner, with a diagram: how far a raised straight can reach past its support before it sags or tips. Without it the check would guess and raise false alarms.

**Context:** Deferred in docs/plan/2026-11-03-next-parts-ceo-review.md (D4), to keep that round on decorated pieces.

**Effort:** human L / CC M
**Priority:** P2
**Depends on:** the reach measurement

## DONE — A short list when a piece has three or more versions (P3, filed in decorated-pieces T6, 2026-11-04; built 2026-11-07)

**Built 2026-11-07** with the metro tunnel and station, which gave the long straight (D) its third version: `app/src/VersionList.tsx`, tested by `app/src/versionList.dom.test.tsx`; the tripwire is retired.

**What:** Design 3A says a piece with three or more versions to swap to shows a short list instead of one "Make it a <name>" button each. Today the strip shows one button per version.

**Why not now:** no piece has more than one version yet (A: station, D: tunnel, HP: level crossing), so the list could not be shown or tested on a real piece.

**Designed 2026-11-04** (/plan-design-review, D3-D9): the whole family with the current piece marked "now", one "Make it…" button that opens it in place, blocked versions greyed with their reason, the standard keyboard flow. Spec in docs/plan/2026-11-04-version-list-and-trait-names.md. `app/src/versionListTripwire.test.ts` fails the day a piece reaches three swaps.

**Context:** app/src/App.tsx `selectedSwaps`; docs/plan/2026-11-03-next-parts-ceo-review.md, design decision 3.

**Effort:** human S / CC S
**Priority:** P3
**Depends on:** a third version of one base piece

---

## P2 — "Checked with catalogue sizes." overstates photo-read pieces (filed by /plan-design-review, 2026-11-08, D19)

**What:** the friend screen's always-shown sentence (`CATALOGUE_SIZES`, app/src/linkWords.ts:36) names photo-read sizes when a shared layout uses an unverified photo-drawn piece: "Checked with catalogue sizes and sizes read from photos."
**Why:** DESIGN.md rule 13 makes this sentence the friend screen's promise; today it is untrue for layouts using the stations, crane, tunnel and other photo pieces.
**Pros:** the trust screen stops overstating. **Cons:** one more sentence variant beside the community one (docs/plan/2026-11-08-community-pieces.md, design D8).
**Context:** found in the design review of the community-pieces plan; that plan fixes the community case only. Start at linkWords.ts and FriendScreen.
**Effort:** human S / CC S. **Priority:** P2. **Depends on:** nothing.

## P2 — Wire the approved analytics (D8, 2026-11-04)

**2026-11-04, built (branch analytics), site code set (`raduuuuu`):** `app/public/count.js` (the reviewed copy, sha-pinned), `countedPath`/`counterPath`/`counterTag` in app/src/linkFragment.ts, inserted by main.tsx in production only. `GOATCOUNTER_CODE` is `raduuuuu`. Left: after the deploy, open the GoatCounter dashboard and confirm visits arrive, and that a shared link shows as `/shared-link`.

**2026-11-05, actions added (branch count-actions):** the owner reversed P4's "visits only" ("what people do in the app"). Ten fixed action names are sent as GoatCounter events (`ACTIONS` in app/src/linkFragment.ts): share, build-it, view-3d, preset, your-box, add-part, save-file, open-file, open-in-editor, and works (the user's own layout first saying "This works", once per page load). Each event carries its name and title only; never the layout, a piece count or the page title. They show on the dashboard under paths starting `action/`.


**What:** wire the privacy-friendly page counter exactly as approved on 2026-11-01 (docs/plan/2026-11-01-editing-tjunction-analytics.md); no other tracking.
**Why:** the app is live and nothing says whether anyone opens it, builds a layout or reaches a "this works" verdict; every other priority is a guess until then.
**Pros:** already designed and approved; small. **Cons:** little to learn until people know the app exists.
**Context:** approved 2026-11-01, never built, never tracked; surfaced by all three reviewers of (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md).
**Effort:** human S / CC S. **Priority:** P2. **Depends on:** nothing.

## P3 — Richer 3D pieces (deferred, D1, 2026-11-04)

**What:** cut wheel grooves, peg and socket shapes and plank-end outlines read from the owner's top-view photos (heights estimated and marked), finer decoration on the eight decorated pieces; build mode keeps D42.
**Why:** the 3D view would look like real track. It changes no answer, so it waits behind the wrong-answer fixes.
**Context:** full design in docs/plan/2026-11-04-partnership-pitch.md ("Accepted scope", D9, D10); 3,000-triangle budget (engine/test/decorated.test.ts).
**Effort:** human L / CC M. **Priority:** P3. **Depends on:** nothing.
**2026-11-05, station pilot (branch station-detail):** the Station straight now draws its measured model (open hall, barrel roof, vents, tower, stepped cap) with 1px detail lines (clock, sign, platform line) shown only when close, and its boxes match the model (B1). Plan and results: docs/plan/2026-11-05-rich-graphics.md. Then (same day) the tunnel's stonework and the level crossing's barriers, with the crossing's boxes corrected. Still open: the Elevated station (needs measuring; no printable model found, so photos and a ruler); the track itself (grooves, pegs, plank ends).

**2026-11-06, the Elevated station (branch elevated-station-measured):** built from the owner's four photos (one from straight above on millimetre paper, three side-on). The plan comes from the top view, its perspective solved from the deck's straight against the loose straight (camera 665mm up). Heights come from the side views, scaled from the deck straight's end, with the camera height solved from the base's two edges; the two readings agree within 10mm. Its boxes: the base (201 by 126, under the deck, its two ends past the deck not solid: owner, a ramp joins the deck directly), the deck frame, two pillars, the platform, the lift tower and car, the clock and its cap, and a new curved-roof shape (`canopy`) that collides stretch by stretch at the heights it reaches. Status stays unverified: heights are good to about 5mm, and the platform's and the lift car's lengths are estimated. A ruler reading of H1 to H3 (calibration sheet S1) would settle them. Still open: the track itself.

# Shelved: partnership (owner, 2026-11-04)

The owner shelved partnership and outreach "for now" (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md). Kept here, not open work; the plan is docs/plan/2026-11-04-partnership-pitch.md (status SHELVED).

## SHELVED — Maker data pack (D3)

**What:** a documented file format, a sample file and an importer: a maker's
official sizes, part numbers and joint tolerances turn their pieces from
`unverified` to `published`, with the verified mark.
**Why:** the one thing only a maker can give; it makes every verdict on their
track exact instead of "exact about an estimate".
**Pros:** turns "share your data" into "fill in this sheet". **Cons:** pays off
only when a maker sends figures.
**Context:** reuses `DimensionSource`, the verified mark (`measured.ts`) and the
trust register. Shape it around the maker's own format (CAD, spreadsheet).
**Effort:** M. **Depends on:** a maker's reply.

## SHELVED — Links from the shopping list to the maker's shop (D4)

**What:** each piece a layout is short of links to the maker's shop by part
number, or fills a basket.
**Why:** a sales channel a maker can measure.
**Pros:** part numbers already exist on several pieces. **Cons:** brand-linked
selling needs the partner's agreement and terms.
**Context:** builds on the shopping list in the P1 inventory entry.
**Effort:** S. **Depends on:** the P1 inventory by set; a partner agreement.

## SHELVED — Set planner (D5)

**What:** pick a boxed set; see layouts it builds that close exactly, and
"add these pieces to build this bigger one".
**Why:** shows what only an exact closure engine can promise; sells add-ons.
**Pros:** the clearest "only we can do this" story. **Cons:** needs set
contents and a layout generator that does not exist.
**Context:** exact closure in `engine/src/geom/cyclotomic.ts`; the 670-layout
corpus (`app/test/verdictCorpus.ts`) shows the kind of layouts to search.
**Effort:** L. **Depends on:** the P1 inventory by set; set contents.

## SHELVED — Mark each joint where two systems meet (D6)

**What:** on the canvas, in the verdict and in build mode, mark every joint
where pieces of two systems that don't join meet, instead of one sentence for
the whole layout. Adapter advice waits for a measured adapter.
**Why:** answers "my old track doesn't fit the new set" precisely.
**Pros:** uses facts the app already holds (`brandFit`, each piece's system).
**Cons:** a new kind of canvas mark to design (DESIGN.md rule 11).
**Context:** `layoutTrust`'s 'brands-do-not-join' note in `engine/src/joints/trust.ts`.
**Effort:** S. **Depends on:** nothing; ideally a measured adapter.

## SHELVED — Embeddable "try this set" view (D7)

**What:** a view a maker can put on a product page: the layout, the verdict,
the 3D view and "open in the full planner".
**Why:** puts the app in front of the maker's customers.
**Pros:** the read-only link view (`LinkRoute.tsx`) already does most of it and
stands in for it in a demo. **Cons:** embedding in other sites brings sizing
and security work.
**Effort:** M. **Depends on:** a maker agreeing to embed it.

## SHELVED — Maker names behind a licence switch (D8)

**What:** per track system, a switch that shows the maker's own names and part
numbers when a licence allows; off by default, trait names otherwise.
**Why:** a partner may want their brand visible.
**Pros:** small: one name table per system. **Cons:** no maker names may enter
the code before a signed licence (`app/src/traitNames.test.ts` guards this).
**Effort:** S. **Depends on:** a signed licence.

## SHELVED — Backend: library, publish, moderation, auth (scrapped 2026-11-05)

**2026-11-05, SCRAPPED (/plan-ceo-review, docs/plan/2026-11-05-see-shared-layouts.md):** the owner's rule was "any legal risk, scrap it". A public page of approved, unattributed builds still carries the sender's IP address (GDPR, COPPA), needs the sender's licence to show the layout, makes the owner the publisher (DSA duties in the EU), and widens the open IP P1. A private inbox and the full library were declined with it. Reopen only with counsel's answer on these four points.

**2026-11-04 (D6, P1 → P3) (/plan-ceo-review 2026-11-04, app-focus review, docs/plan/2026-11-04-app-focus-review.md):** sharing already works without a server (app/src/shareLink.ts, LinkRoute.tsx); no user asks for a library yet; blocked by "dimensions.status is a self-asserted claim" and by the IP entry anyway.

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
**Priority:** none (scrapped)
**Depends on:** K5 layout document (the wire format is the file format), and the
IP questions below should be settled before anything is published publicly

---

## P3 — Paint the printed pieces in 3D from their model files (deferred by /plan-ceo-review, 2026-11-07, D3)

**What:** Once the Elevated station is painted (docs/plan/2026-11-07-3d-colour.md), paint the printed pieces whose 3MF assigns a filament per part, and leave any without clear per-part colours in the house grey.

**Colours found (3MF `Metadata/model_settings.config`, one extruder per part; `project_settings.config` `filament_colour`):** Station straight: roof #164B35, walls and tower #6F5034, ground, stairs and ramps #5B6579, sign and bench #C12E1F, platform lines #FFFFFF, clock and plan #000000, rail #8E9089. Tunnel straight: one body #7C4B00. Level crossing: body #E8DBB7, barrier arms #C12E1F and #FFFFFF. Riser, track support and bridges: not checked yet.

**Why deferred:** the owner chose to judge paint on the Elevated station (their own photos) first. Note (outside review, O4): the printed station is drawn as one composite shape (engine/data/library.ts:140), so painting it needs a paint per part inside that shape, not only the per-shape `paint` field. Two of these are reds (#C12E1F) that must be measured clear of `--fail` like the station's.

**Effort:** human M / CC S
**Priority:** P3
**Depends on:** the Elevated station's paint shipping


## Repo checkups: decide after four weekly runs (2026-11-08, repo-checkups plan)

- **Propose `/checkup` to gstack (C3, deferred).** After four weekly runs of
  the checkup **and** at least one deep `/checkup` run, open a gstack issue
  with what each check caught and its false alarms. Propose only the steps
  that work in any repository: 3 (settings and alerts), 5 (gstack's audits),
  6 (docs against the code) and 7 (one fix pull request per kind of finding).
  Steps 1, 2, 4 and 8 depend on this repo's `checkup.yml`, its checker and the
  `/checkup done at <sha>` protocol, so they stay here. Lead with findings
  that `/health`, `/cso` and `/test-audit` alone would have missed. Why
  deferred: gstack now cuts skills that show no measured gain over a plain
  model (its 1.98 changelog retired `/investigate` and `/plan-eng-review` on
  eval results), so a proposal needs run evidence. Re-checked 2026-11-09
  (plan-ceo-review D1): 0 weekly runs, 0 deep runs; deferral kept.
  **Effort:** S to M. **Priority:** P2.
- **OpenSSF Scorecard (C5, deferred).** Weekly, its score copied into the
  tracking issue, if the first month shows a second report earns attention.
  **Effort:** S. **Priority:** P3.

## Contributor brief: other LLMs (2026-11-10, contributor-brief plan, C3)

- **The brief for other LLMs (C3, deferred).** The contributor brief
  (`app/public/contributor-brief.md`) is written for a Claude chat with code
  execution. Other assistants could follow it once they can clone the
  repository, run Bun and an image converter in a sandbox, and hand a file
  back to the sender; `briefLink.ts`, the untrusted-part validator and the
  preview link already work for any of them. Before widening it: run the
  brief end to end in one other assistant, note each step it couldn't do, and
  decide whether one brief can cover both or a second one is needed. Why
  deferred: the owner, 2026-11-09, "Only Claude in the beginning but we can do
  it for others afterwards". **Effort:** M. **Priority:** P3.
