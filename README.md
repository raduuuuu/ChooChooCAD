# ChooChooCAD

MVP of the engine for a BRIO wooden-track layout designer. Answers one question
no existing tool answers: **will this layout actually work?**

```
bun install        # once
bun run dev        # the UI, at http://localhost:5173
bun run test       # the whole suite, nothing skipped
bun try.ts         # one layout from the command line; edit PIECES at the top
```

## What this MVP proves

The engine is two stages, and the split is the whole idea.

**Stage 1, exact.** Every BRIO heading is a multiple of 22.5 degrees and every
straight length is a whole number of millimetres, so every reachable pose is an
exact element of `Z[zeta16]`, the 16th cyclotomic integers. The closure residual
of a layout is therefore an exact algebraic constant and "does this loop close"
is an integer equality test. No floating point, no convergence, no NaN.

That matters because the usual framing is wrong. It is often said that
45-degree curves make loop closure impossible, since diagonals come out as
multiples of sqrt(2). They do, but closure is a decidable Diophantine condition,
not an impossibility: an element `a + b*sqrt2` is zero only when `a` and `b` are
both zero, so exact closures exist and the tests find them.

```
8 x E (radius 182, 45 deg)       residual exactly 0
8 x E1 (radius 90)               residual exactly 0
4E + D + 4E + D  (stadium)       residual exactly 0
4E + D + 4E + A                  residual exactly 72mm  (216 - 144)
```

**Stage 2, a bound, not an allocation.** BRIO's Vario System is deliberate give
in every joint, so when a loop does not close exactly the remaining question is
whether the joints can absorb the gap. This reports a **necessary condition**:

```
  gap  <=  sum of every joint's give      ->  it MIGHT fit
  gap  >   sum of every joint's give      ->  it definitely does NOT fit
```

That is all the available data supports, and the verdict says so. It never
claims the gap *will* be absorbed, only that it is not ruled out.

There used to be a Chebyshev minimax linear program here that allocated the gap
joint by joint and reported a per-joint ratio. It was deleted, deliberately,
and the reasons are worth recording because they were measured rather than felt:

- Every defect ever found in this engine lived in it. It returned a hard failure
  on buildable 321-piece layouts, blocked for 4.6 seconds at 641 pieces,
  exhausted its refinement budget from 21 pieces onward, and **flipped a
  user-visible verdict between "won't fit" and "tight" depending on which piece
  happened to be listed first** at 42 pieces.
- Its precision was manufactured. It sliced a ratio at 0.8 using tolerances this
  very repository labels `estimated`. A threshold on a guess.
- Deleting it removed about 350 lines, took the failure taxonomy from eight
  reasons to three, and left the engine with **no runtime dependencies at all**.

What was lost is real: the tool can no longer say *which* joint is the problem.
That returns when the tolerances are measured rather than guessed, which is what
`CALIBRATION.md` exists to do.

One property came for free. The bound is a sum over joints, and addition does
not care about order, so the gauge dependence that made the old solver
contradict itself is now **impossible rather than merely small**. The test
asserts it exactly, at every cut point, with no tolerance.

```
measured, same fixtures, before and after the deletion
  n=321   hard failure, 2323ms   ->   ok, 0.8ms
  n=641   4629ms                 ->   1.4ms
  42-piece gauge sweep: verdict flipped   ->   one verdict, one gap, every cut
```

## The UI

Desktop editor. Click palette pieces to append them to the chain; the circular
arrow on a curve adds it turning right. Three presets load the known cases.

Hierarchy is deliberate and in this order: the canvas dominates, then one
unmistakable verdict line, then the palette. No sidebar and no toolbar strip:
navigation will be full-screen modes you enter and leave, because the canvas is
meant to dominate. A card appears only where the card IS the interaction, which
on this screen means palette pieces and nothing else.

**There are no per-joint glyphs.** There used to be, on four channels (colour,
shape, a ratio on hover, and a dotted ring when the tolerance was unmeasured),
and it was the best accessibility work in this project. It is gone because the
solver that produced per-joint ratios is gone: with nothing to say about an
individual joint, drawing a marker on each one would assert that each was
checked. The four channels come back with per-joint allocation.

The layout verdict has four states and the middle one is deliberately hedged:

```
  O   EXACT        closes exactly, no give needed anywhere
  /\  NEEDS GIVE   gap is inside the total give; may well seat, not a promise
  X   EXCEEDS      gap is larger than the total give; definitely will not fit
  ?   UNKNOWN      could not be checked. NEVER rendered as a pass
```

SVG rather than a canvas library, for now. The engine is single-cycle and there
is no drag yet, so nothing needs a scene graph; SVG gives exact arcs, native
dotted strokes for the estimated-tolerance channel, and it prints legibly in
greyscale, which the build sheet will need. A real canvas layer becomes the
right call when drag-and-drop and large layouts arrive.

Styling lives entirely in `app/src/tokens.css` and is PROVISIONAL. A researched
design system is separate work; these tokens exist so the first screen is not
assembled from browser defaults.

## What this MVP does NOT do

- **No drag-and-drop.** Pieces append and remove from the end of the chain,
  because the engine models a chain. Free placement needs arbitrary topology.
- **Single cycle only.** A layout is a chain, optionally closed. Switches create
  multiple cycles sharing joints, which needs a coupled solve over a full cycle
  basis. Not here.
- **No traversal checker.** Connectivity, grade and under-bridge clearance are
  designed but unbuilt, so the verdict line has only one axis today. Its shape
  already accounts for a second one.
- **No inventory, no 3D, no build mode, no library.**
- **The settle is partial.** Joint glyphs transition with a stagger that
  propagates outward from the changed piece, which is the intent. The track path
  itself does not morph; that needs the real canvas layer.
- **Phone is refused, not degraded.** Under 620px the editor says to use a
  larger screen rather than cramming a track editor into 375px.

## The numbers are not measured

Every slop budget in `engine/data/brio.ts` is `calibrationStatus: 'estimated'`.
Nobody has put calipers on real track. They are plausible placeholders
(0.8mm axial, 1.5 degrees angular) and they must be fitted against a physical
corpus of built-and-measured layouts, split into a calibration set and a
never-fitted validation set, before any verdict is shown to a user as confident.

Until then every verdict the engine produces is arithmetic on a guess. The
schema carries the status field and `evaluateLayout` surfaces it in its reasons
for exactly this reason.

The same applies to `VEHICLE.heightMm` and `maxGradePercent`.

## Known limitations, measured not guessed

**The bound is weak at scale, by construction.** Give accumulates with joint
count while the gap does not, so a 641-piece layout with a 54mm gap has 512mm of
give and sits comfortably inside the bound. That is correct and nearly
uninformative. Being inside the bound means the gap *could* fit if any joint
could absorb any share of it, which the geometry does not guarantee.

**Every tolerance is still a guess.** See below.

**A layout that crosses itself is still blessed.** Sixteen large curves traverse
the same circle twice and report `EXACT`, because nothing checks whether two
pieces occupy the same floor. The overlap check is specified and unbuilt.

## Layout

```
engine/
  data/brio.ts              part data + vehicle scalars, all 'estimated'
  data/sources.ts           published figures + citations the catalogue is checked against
  src/parts/schema.ts       multi-brand parametric schema, continuous heightMm
  src/geom/cyclotomic.ts    exact Z[zeta16] arithmetic
  src/geom/pose.ts          exact forward kinematics
  src/solver/residual.ts    stage 1: exact residual + per-joint give
  src/solver/result.ts      stage 2: the bound; SolveResult union, finiteness assert
  src/geom/fk.ts            float walker + drawable segments, shared
  src/joints/evaluate.ts    the ONE shared LAYOUT predicate
  test/analytic.test.ts     known-answer fixtures + solver contract properties
  test/sources.test.ts      the one place brio.ts is compared against sources.ts
  test/render.test.ts       SVG arc centres, so arcs cannot silently bow wrong
app/
  src/App.tsx               layout-as-home shell
  src/TrackCanvas.tsx       SVG track + four-channel joint glyphs
  src/VerdictLine.tsx       grey-is-not-green, names the axis
  src/tokens.css            PROVISIONAL tokens
```

`evaluateLayout` is deliberately the only place a verdict is computed. The
verdict line renders it; build mode and the diagnostics panel will too. None
recomputes it. Independent implementations drift, and the visible symptom of
drift is the product contradicting itself.

## Licence, and what it does and does not cover

The source code is MIT licensed. See `LICENSE`.

**The MIT grant covers the code, not the part data.** Part dimensions in
`engine/data/` are transcribed from the woodenrailway.info track guide and
Track Math pages. Individual measurements of physical objects are facts, but a
curated compilation of them may be protected, and that question is open. It was
filed as a pre-launch item before this went public and is still unresolved, so
the MIT licence should not be read as a grant over that compilation: it is not
mine to give until the question is settled or the figures are re-derived from
physical measurement.

If you are the maintainer of woodenrailway.info and object to this use, open an
issue and I will take the data down.

The self-hosted IBM Plex fonts are SIL Open Font License 1.1, and both notices
ship with the build at `/fonts/`.

BRIO is a live trademark of BRIO AB. This project is not affiliated with,
endorsed by, or connected to BRIO. The name `woodentrain.world` is descriptive
and deliberately does not reference the trademark.
