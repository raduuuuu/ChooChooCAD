# TODOS — ChooChooCAD

The open work, and only the open work. The repo is `raduuuuu/ChooChooCAD`
(public, deployed to woodentrain.world). This copy in the tree is the
authoritative one (`docs/plan/README.md`).

**Cleaned 2026-11-16** (/plan-ceo-review, `docs/plan/2026-11-16-whats-next.md`).
Every entry that was finished, superseded, shelved or folded into another
moved word for word to `docs/plan/TODOS-archive.md`, under a heading that says
what became of it. Nothing was cut. An entry below either keeps its original
text, with a dated line saying what changed, or is a short current entry
whose history is in the archive.

How to read it: the four parts are in the order the work should happen.
A heading's P1, P2 or P3 is its priority inside its part.

---

# 1. Only the owner can do these

They outrank everything an agent can build: until they are done, the verdicts
rest on unmeasured sizes and every priority below is a guess.

## P1 — Read the usage dashboard

**What:** Open the counter's dashboard. Do visits arrive? Does anyone reach
"This works" (the `action/works` event)? What share of visits is phones?
**Why:** The counter has been live since 2026-11-05 and has never been read.
Offline use, kid mode and the swap suggestion were all deferred on
2026-11-16 to wait for this.
**Context:** Built and kept as it is (decision D9, 2026-11-14): ten fixed
action names in `app/src/linkFragment.ts`, never the layout. The script also
sends the page title, the referrer, the screen width and the query string
with each visit (`app/public/count.js:25-30`); README does not yet say so
(part 3, "Checkup: three things").
**Effort:** owner, about 10 minutes. **Depends on:** nothing.

## P1 — The floor afternoon (calibration readings still open)

**What:** The readings on the calibration sheet's "Still open" list
(`docs/calibration-sheet.html`), copied into `engine/data/measurements.ts`:

- **F4, the span between two supports.** The supports check is built and
  switched off until this one number is read
  (`engine/src/graph/supports.ts`; `measurements.ts` `f4.supportGapMm`).
  Filling it in turns the check on with no code change.
- **The ramp's run** (its own entry below).
- **Q2, the bend** at a joint: replaces the inferred bend limit with a
  measured one.
- **Q6, a real switch:** three figures (`throughMm`, `chordMm`, `offsetMm`).
  The switches shipped as unverified seeds read off printed models.
- **F2** (a train under a bridge), **plank thickness**, and the **Q1b**
  loop's leftover gap.
- **The ruler heights of the seven structures built from photos:** S1 and S2
  (the elevated station and its arch), M1 (the metro tunnel; T4 decides the
  fit), M2, B1, K1 and D1. Each stays unverified until read.

**Why:** 57 of 71 built-in pieces are unverified and 9 calibration figures
are still `null` [measured 2026-11-16]. This is the only work that makes a
verdict physically true, and no agent can do it.
**Context:** `bun run calibration` reads every answer against
`CALIBRATION.md`. Every reading asked for has a drawing on the sheet
(AGENTS.md, "Photos and measurements"). The history of this entry, the switch
entry and the supports entry is in the archive.
**Effort:** owner, one afternoon. **Depends on:** real track and floor space.

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

## P1 — The real-phone pass (plan 2026-11-14, task T12)

**What:** Use the phone editor on a real phone, upright and sideways, with
one hand: Escape and focus in the Pieces and More sheets, the keyboard over a
panel's field, a screen reader, a second phone browser, "Next end" at a real
scale, the verdict's "Show less", and the train (also wagons on a ramp or a
bridge, and a three-way switch).
**Why:** The phone editor, the train and the version line have only ever been
looked at in a headless browser.
**Effort:** owner, about an hour. **Depends on:** nothing.

## P2 — Confirm or change five choices the agent made

Each shipped on the agent's judgement, not on the owner's word:

- The phone's strip row reserves 100px (the plan said 52px).
- "Next end" measures its ring from the end chosen first, and while joining
  it steps the chosen end.
- On a phone the put-aside notice lives in More.
- Clear leaves an older put-aside layout alone.
- The phone's verdict starts whole and is folded by a tap; the choice lasts
  the browser session.

**Effort:** owner, about 10 minutes.

---

# 2. Accepted on 2026-11-16, not yet built

Decided in `docs/plan/2026-11-16-whats-next.md`. Each is its own pull request,
none stacked. The version numbers assume this order and nothing merged in
between; if `main` has moved, the part that goes up stays and the number
follows (AGENTS.md).

## P2 — Several saved layouts (S1 takes 1.1.1 to 1.1.2, patch; S2 takes 1.1.2 to 1.2.0, minor)

**What:** "My layouts": name a layout, keep several in the browser, reopen
any of them.
**Why:** Today the browser keeps one layout and one put aside
(`app/src/storageKeys.ts:38,87`); a second layout pushes the first out
unless it is saved to a file by hand.
**Planned 2026-11-16:** `docs/plan/2026-11-16-saved-layouts.md` holds the
owner's seven decisions, the design, the storage design (one key per layout,
no index), the tests and the outside review. Two pull requests: S1, the
store and `openInEditor` made safe to reuse, with nothing a visitor can
reach; S2, the panel and the crash screen's two answers, switched on.
**For the owner in S2:** the crash screen's first answer keeps saved layouts
and removes added parts, so a saved layout that uses one will not open until
the part is added again (the plan, "A saved layout can outlive a piece it
uses").
**Effort:** human ~1.5 weeks / CC ~4.5 h. **Depends on:** nothing.

---

# 3. Open, waiting for a trigger

Each is real and none is next. The trigger is in the entry.

## P2 — The joint's tap area on a phone

**What:** "Break this joint" is drawn in millimetres, so on a fitted plan it
is 12 to 25px on a phone, far under the 44px floor (DESIGN.md rule 10). Free
ends got a pixel floor (`endHitRadiusMm`); joints did not.
**Why not yet:** a bigger joint target competes with selecting the piece
under it, so which wins needs the owner's decision first. The layout list
breaks a joint by name meanwhile.
**Context:** Found by `/design-review` on 2026-11-15. Fixed since, from the
same review: the sideways verdict's column, the Pieces sheet's 13px notes,
the verdict's fold and the 3D view's how-to line.
**Effort:** human ~1 d / CC ~1 h. **Depends on:** the decision.

## P3 — On a wide screen the palette stops short of the foot when "Run a train" shows

**What:** At 1000px and up the palette spans the grid's named rows, and the
"Run a train" control (and Finish the loop) are placed in a row after them,
in the plan's column only. So the palette ends about 48px above the foot of
the screen and the strip beside the control is empty.
**Why not yet:** nothing is hidden (the palette scrolls) and no one has
asked. Seen while fixing the notice's place on 2026-11-16 (#300), which gave
notices and the shortfall rows of their own and left this as it was.
**Effort:** human ~2 h / CC ~20 min. **Depends on:** nothing.

## P2 — Checkup: three things offered on 2026-11-16 and not chosen

- **README says nothing about the usage counter.** One short section saying
  what `count.js` sends (the page title, the referrer, the screen width, the
  query string and the ten action names; never the layout), in the plain
  words README uses for sizes.
- **No linter and no dead-code check** run in CI (`/health` scored on
  typecheck and tests alone). Decide whether one earns its place.
- **The remote branch `photo-guide-2x`** is merged and can go
  (`repo-org-review` is kept on purpose).

**Effort:** human ~3 h / CC ~30 min for the first; the other two are
decisions. **Depends on:** nothing.

Not stored across visits, so not part of the crash screen's list: the two
fold states kept for a browser session (`generic.verdict.notes.open`,
`generic.verdict.phone.open`). A crash report does not carry them.

## P2 — Works offline, installs to the home screen (deferred 2026-11-16)

**What:** A phone keeps a copy of the app, so it opens with no signal and
can sit on the home screen.
**Why deferred:** the owner chose to wait for the dashboard's phone share and
the real-phone pass.
**Context:** There is no manifest and no service worker today. The hard part
is not the cache: a kept copy must still pick up each new version (every
merge deploys; the app shows its version, `app/src/appVersion.tsx`), and
"This layout was changed in another tab" must keep working.
**Effort:** human ~1 week / CC ~3 h. **Depends on:** the dashboard.

## P2 — Nudge-to-fit: suggest a swap when a loop misses (deferred again 2026-11-16)

**2026-11-16:** "Finish the loop" shipped on 2026-11-14: for a layout with exactly one joint that does not meet, it offers up to four flat pieces from the box that close it exactly (`engine/src/graph/fill.ts`, `engine/src/graph/repair.ts`). Still open, and deferred by the owner on 2026-11-16 until it is known where that leaves people stuck: swapping one piece for another, several gaps at once, and raised track. The text below is the original entry.

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

## P3 — Kid mode (deferred 2026-11-16)

**What:** A locked view for a small child: the layout cannot be changed, the
controls are big, and the only thing to do is run the train.
**Why deferred:** the train has not been watched on a real phone yet; the
real-phone pass decides it.
**Context:** Idea E7 of the first plan. The train exists
(`engine/src/graph/route.ts`, `app/src/playback.ts`) and so does a read-only
screen (`app/src/FriendScreen.tsx`).
**Effort:** human ~3 d / CC ~2 h. **Depends on:** the real-phone pass.

## P3 — Ideas recorded and never decided

- **Photo-based inventory** (E9, large, speculative): count scattered track
  from a photo.
- **Mirror a layout** (the other half of E10; auto-complete shipped as
  "Finish the loop").
- **An owned-only palette filter** (from the 2026-11-05 inventory list).

## P3 — The community-pieces plan's unbuilt tasks

**What:** Of `docs/plan/2026-11-08-community-pieces.md`: the community
verdict caveat (its T8), "confirmed by N readers" (T9), and the pilot's
second half, one outside contributor (T6).
**Why not yet:** they matter once an outside piece exists. The only two
piece issues so far were the owner's dry runs.
**Context:** This replaces the "Community custom-part registry" entry of
2026-10-06 (in the archive): intake by GitHub issue and the contributor
brief is built.
**Effort:** human ~1 week / CC ~5 h. **Depends on:** a first outside sender.

## P2 — Review the library and regroup the palette

**What:** The owner's request of 2026-11-08: "I want a complete review of the
library and categorization of parts" (community-pieces plan, row AD1; its
tasks T11, the audit, and T12, the palette regroup). 71 built-in pieces today.
**Why:** Asked for outright and never built [measured 2026-11-14: no audit or
regroup commit after the plan's pull requests #189 and #191].
**Context:** It concerns the pieces already built in and how the palette
groups them. It does not wait for an outside contributor.
**Effort:** human ~3 d / CC ~3 h. **Depends on:** nothing. Offered again at
the next planning round.

## P3 — A fuzz harness, and the physical corpus

**What:** A fuzz harness with a logged seed for the solver; and a corpus of
layouts built on the floor and measured, split into a calibration set and a
set never fitted to.
**Why:** The corpus is what would confirm the derived joint budgets against
real track.
**Context:** What is left of "Launch operations" (in the archive): CI, the
weekly checkup and the usage counter exist; feature flags, runbooks and the
worker time bound belonged to a backend that was scrapped.
**Effort:** harness human ~2 d / CC ~1 h; the corpus is the owner's, with
track. **Depends on:** the floor afternoon for the corpus.

## P3 — Failure replay and solver inspector

**2026-11-16:** lowered to P3. The crash report carries the layout and now the version, and a layout file or link makes any failing layout reproducible. Trigger: the first wrong verdict reported by someone else that these do not reproduce.

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

## P3 — Finish splitting App.tsx

**2026-11-16:** `App.tsx` is 2,518 lines [measured], up from 2,360 two days earlier: the phone editor's wiring landed in it. The piece shelves are out (`app/src/Palette.tsx`, #275). Persistence and the panels are not. Offered on 2026-11-16 and not chosen. The figures in the text below are from October.

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

## P3 — Canvas virtualisation, a load cap and one memo

**What:** Draw only what the viewport covers, so no layout is too big to
open; decide a cap in `loadGraph`; memoise `maxLayers`
(`app/src/TrackCanvas.tsx:555`).
**Why not yet:** the freeze is bounded. Above 10,000 pieces the canvas says
"Too much track to draw" and the layout is still checked; share links stop
at 500 pieces. The load cap is also in "Hardening" above.
**Context:** The measurements and the history are in the archive.
**Effort:** virtualisation human ~3 d / CC ~4 h; the memo ten minutes.
**Depends on:** nothing. Trigger: layouts of thousands of pieces in real use.

## P2 — `dimensions.status` is a self-asserted claim, which blocks sharing (filed by /ship, 2026-10-14)

**2026-11-16:** the sharing backend this blocks was scrapped on 2026-11-05, so nothing is blocked today. A piece arriving by a contributor link goes through the untrusted-part validator (`engine/data/untrustedPart.ts`) and is never ranked as the reader's own measurement. Kept because the gap returns with any future sharing of parts.

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

**2026-11-16:** still true: `PROFILE_DEFAULTS` in `app/src/SubmitPart.tsx:32` and the literals in the seed files. The joint-give constants are copied the same way (`ESTIMATED_SLOP` in `engine/data/bufferSeeds.ts:25` and `engine/data/structureSeeds.ts:27`, with others in the seed files): a corrected figure must be applied in each. The duplicated brand labels it absorbed from the review backlog are gone.

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

**2026-11-16:** `toBeDefined()` is still in `engine/test/analytic.test.ts` (lines 370, 620, 634, 877).

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

**2026-11-16:** end marks got a screen-size floor in #278 (`markScale`, `app/src/TrackCanvas.tsx:205`). Whether the keyboard cursor's ring is under that floor was not re-measured; check it in a browser before closing this.

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

## P3 — Richer 3D pieces (deferred, D1, 2026-11-04)

**What:** cut wheel grooves, peg and socket shapes and plank-end outlines read from the owner's top-view photos (heights estimated and marked), finer decoration on the eight decorated pieces; build mode keeps D42.
**Why:** the 3D view would look like real track. It changes no answer, so it waits behind the wrong-answer fixes.
**Context:** full design in docs/plan/2026-11-04-partnership-pitch.md ("Accepted scope", D9, D10); 3,000-triangle budget (engine/test/decorated.test.ts).
**Effort:** human L / CC M. **Priority:** P3. **Depends on:** nothing.
**2026-11-05, station pilot (branch station-detail):** the Station straight now draws its measured model (open hall, barrel roof, vents, tower, stepped cap) with 1px detail lines (clock, sign, platform line) shown only when close, and its boxes match the model (B1). Plan and results: docs/plan/2026-11-05-rich-graphics.md. Then (same day) the tunnel's stonework and the level crossing's barriers, with the crossing's boxes corrected. Still open: the Elevated station (needs measuring; no printable model found, so photos and a ruler); the track itself (grooves, pegs, plank ends).

**2026-11-06, the Elevated station (branch elevated-station-measured):** built from the owner's four photos (one from straight above on millimetre paper, three side-on). The plan comes from the top view, its perspective solved from the deck's straight against the loose straight (camera 665mm up). Heights come from the side views, scaled from the deck straight's end, with the camera height solved from the base's two edges; the two readings agree within 10mm. Its boxes: the base (201 by 126, under the deck, its two ends past the deck not solid: owner, a ramp joins the deck directly), the deck frame, two pillars, the platform, the lift tower and car, the clock and its cap, and a new curved-roof shape (`canopy`) that collides stretch by stretch at the heights it reaches. Status stays unverified: heights are good to about 5mm, and the platform's and the lift car's lengths are estimated. A ruler reading of H1 to H3 (calibration sheet S1) would settle them. Still open: the track itself.

## P3 — Paint the printed pieces in 3D from their model files (deferred by /plan-ceo-review, 2026-11-07, D3)

**What:** Once the Elevated station is painted (docs/plan/2026-11-07-3d-colour.md), paint the printed pieces whose 3MF assigns a filament per part, and leave any without clear per-part colours in the house grey.

**Colours found (3MF `Metadata/model_settings.config`, one extruder per part; `project_settings.config` `filament_colour`):** Station straight: roof #164B35, walls and tower #6F5034, ground, stairs and ramps #5B6579, sign and bench #C12E1F, platform lines #FFFFFF, clock and plan #000000, rail #8E9089. Tunnel straight: one body #7C4B00. Level crossing: body #E8DBB7, barrier arms #C12E1F and #FFFFFF. Riser, track support and bridges: not checked yet.

**Why deferred:** the owner chose to judge paint on the Elevated station (their own photos) first. Note (outside review, O4): the printed station is drawn as one composite shape (engine/data/library.ts:140), so painting it needs a paint per part inside that shape, not only the per-shape `paint` field. Two of these are reds (#C12E1F) that must be measured clear of `--fail` like the station's.

**Effort:** human M / CC S
**Priority:** P3
**Depends on:** the Elevated station's paint shipping

## Repo checkups: decide after four weekly runs (2026-11-08, repo-checkups plan)

**2026-11-16:** one deep checkup has run (2026-11-15, no red findings). No scheduled weekly run yet: the first is due 2026-11-16.

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

## Parked — Move the repository to a `woodentrain` organisation (2026-11-12, #255)

- **The move (parked by the owner, 2026-11-11: "delete it for now, I'll come
  back to it later").** The review is in PR #255 (closed); its plan,
  `docs/plan/2026-11-10-repo-and-org.md`, is kept on the `repo-org-review`
  branch. Decided there: one repository (R1), an organisation (R2) named
  `woodentrain` (R3), and a runbook whose steps 1 to 5 (organisation,
  transfer, the www CNAME, the custom domain, domain verification) are the
  owner's. When it resumes: the contributor brief is at version 2 since #257,
  so the link PR (step 6) makes it version 3, and every link added since
  2026-11-10 needs recounting. **Effort:** S (owner) + S (CC).
  **Priority:** P3.

---

# 4. Shelved or scrapped by the owner

Not open work. The full entries are in the archive.

- **Partnership and outreach** (shelved 2026-11-04): the maker data pack,
  links from the shopping list to a shop, the set planner, a mark on each
  joint where two systems meet, an embeddable view, maker names behind a
  licence switch. Plan: `docs/plan/2026-11-04-partnership-pitch.md`.
- **A backend: library, publish, moderation, accounts** (scrapped
  2026-11-05, "any legal risk, scrap it"). Reopen only with counsel's answer
  on the four points in the archived entry.
- **Sets** (dropped 2026-11-05): no set manifests, no "which sets do you
  own".
- **The IP question** (closed by the owner, 2026-11-14 and 2026-11-16):
  "There is no issue with the part IP". README's licence section says so.
