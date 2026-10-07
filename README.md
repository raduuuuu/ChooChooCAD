# brio-designer

MVP of the engine for a BRIO wooden-track layout designer. Answers one question
no existing tool answers: **will this layout actually work?**

```
bun install        # once
bun run dev        # the UI, at http://localhost:5173
bun run test       # 21 tests
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

**Stage 2, a Chebyshev LP.** BRIO's Vario System is deliberate give in every
joint. So the remaining question is whether bounded per-joint slop can absorb a
fixed residual without any single joint going past its limit. Written as a
minimax linear program, three things fall out instead of being bolted on:

- `t*` is the worst joint's normalised slop usage. `t* <= 1` means it works.
  That IS the fair-spread guarantee, as an optimum rather than a hope.
- The primal solution is the per-joint usage report the UI needs.
- `t* > 1` tells the user how much more give would have been required.

Solved with `yalps` (MIT, pure TypeScript). Roughly 3 equality rows and a few
hundred bounded variables: microseconds, exact optimum.

## The UI

Desktop editor. Click palette pieces to append them to the chain; the circular
arrow on a curve adds it turning right. Three presets load the known cases.

Hierarchy is deliberate and in this order: the canvas dominates, then one
unmistakable verdict line, then the palette. No sidebar and no toolbar strip:
navigation will be full-screen modes you enter and leave, because the canvas is
meant to dominate. A card appears only where the card IS the interaction, which
on this screen means palette pieces and nothing else.

Joint verdicts render on four channels rather than one, because colour alone
fails roughly one man in twelve and vanishes in greyscale print:

```
  O   open circle    PASS      under 80% of the joint's give
  /\  triangle       TIGHT     80-100%, seat it firmly
  X   cross          FAIL      over budget
  ?   dotted + ?     UNKNOWN   could not be checked (never shown as green)
  dotted outer ring            the tolerance behind this verdict is ESTIMATED
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
schema carries the status field and `evaluateJoint` surfaces it in its reasons
for exactly this reason.

The same applies to `VEHICLE.heightMm` and `maxGradePercent`.

## Known limitation, measured not guessed

Where you cut a closed loop is arbitrary, so rotating the piece order must not
change the answer. Two bugs were found here, in this order:

1. The closure constraint was incomplete. Position was enforced but angular slop
   was never required to sum to zero, so the solver could land the seam in the
   right place facing the wrong direction. Adding that third row cut the
   order-dependence from `1.7e-1` to `1.9e-3`.
2. The linearisation needs re-solving from the updated pose. Five passes drive
   the remaining gap to about `1e-8` mm.

After both fixes the spread **plateaus at about `1.9e-3`** in worst-ratio and
does not shrink with more passes: the two cut points converge to genuinely
different optima. That is 0.003 degrees of a 1.5-degree budget, on a budget
nobody has measured, so the verdict is gauge-independent while the exact ratio
is not. The property test asserts exactly that and no more. Revisit if real
measurements ever make the third decimal place meaningful.

## Layout

```
engine/
  data/brio.ts              part data + vehicle scalars, all 'estimated'
  src/parts/schema.ts       multi-brand parametric schema, continuous heightMm
  src/geom/cyclotomic.ts    exact Z[zeta16] arithmetic
  src/geom/pose.ts          exact forward kinematics
  src/solver/residual.ts    stage 1: exact residual + joint sensitivities
  src/solver/lp.ts          stage 2: Chebyshev minimax LP via yalps
  src/solver/refine.ts      sequential passes; see limitation above
  src/solver/result.ts      SolveResult union, finiteness assert, strict predicate
  src/geom/fk.ts            float walker + drawable segments, shared
  src/joints/evaluate.ts    the ONE shared joint predicate, five future consumers
  test/analytic.test.ts     known-answer fixtures + solver contract properties
  test/render.test.ts       SVG arc centres, so arcs cannot silently bow wrong
app/
  src/App.tsx               layout-as-home shell
  src/TrackCanvas.tsx       SVG track + four-channel joint glyphs
  src/VerdictLine.tsx       grey-is-not-green, names the axis
  src/tokens.css            PROVISIONAL tokens
```

`evaluateJoint` is deliberately the only place a joint verdict is computed. The
verdict line, the per-joint glyphs, build-mode warnings, the diagnostics panel
and fix ranking all render it; none recomputes it. Five implementations would
drift, and the visible symptom of drift is the product contradicting itself.

## Provenance

Part dimensions are transcribed from the woodenrailway.info track guide and
Track Math pages. Whether that curated compilation is protected is an open
question to settle before publishing the data. BRIO is a live trademark and no
product name has been chosen.
