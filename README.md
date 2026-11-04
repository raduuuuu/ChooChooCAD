# ChooChooCAD

A layout designer for wooden toy-train track that answers one question no
other tool answers: **will this layout actually work?** Live at
[woodentrain.world](https://woodentrain.world).

```
bun install          # once
bun run dev          # the app, at http://localhost:5173
bun run test         # the whole suite, nothing skipped
bun run typecheck    # strict, must be clean
bun run build        # the production build, rooted at app/
bun run calibration  # what your floor measurements change
bun try.ts           # one layout from the command line; edit PIECES at the top
```

## What it does

- **Design on a canvas.** Drag pieces from the palette onto free ends, move
  and rotate whole runs, undo and redo. Switches, crossings, buffer stops and
  several loops in one layout all work.
- **A verdict on every change.** One line says whether the layout works, and
  why:

  ```
    O    This works.        closes; nothing needs forcing
    /\   Tight.             closes only by using the joints' give; may well seat, not a promise
    X    Beyond / Can't     needs more bend than has been tested, or can't be built
                            (track overlaps, ends that don't join, a level out of reach)
    ?    Could not check    never shown as a pass
  ```

- **Two levels.** Ramps lift track one level; bridges, risers and a track
  support carry it. Track crossing underneath is checked, and the verdict says
  when your train may not pass under raised track, a bridge or a tunnel.
- **Decorated pieces.** A station straight, a tunnel straight and a level
  crossing work exactly like their plain pieces and can be swapped in place.
- **See it in 3D**, raised level, bridges and decoration included.
- **Build mode.** Step through the layout piece by piece, with a pull list of
  what to take out of the box.
- **What you own.** Count your pieces; the palette marks what you would run
  out of, and the layout says what it is short of.
- **Add or correct a piece** you have measured yourself; your figure outranks
  anything shipped.
- **Share a layout** as a link; it opens read-only, on a phone too.

Phones get a read-only view; editing needs a screen at least 620px wide.

## The pieces and their sizes

The main system, "Generic", uses the published sizes of the common wooden
track. Two other systems sit on shelves of their own because they differ
physically: **Small-peg** track has smaller pegs and holes and does not plug
into Generic, and **Look-alike** track is sold as compatible but nobody has
confirmed it. Their sizes come from 3D-print reproductions and say so.

Every size records where it came from, and the verdict says when an answer
rests on a size nobody has measured. Pieces checked against a real one carry a
measured mark.

## How the check works

**Stage 1, exact.** Every heading is a multiple of 22.5 degrees and every
straight is a whole number of millimetres, so every position a piece can reach
is an exact element of `Z[zeta16]`, the 16th cyclotomic integers. Whether a
loop closes is an integer equality test: no floating point, no tolerance, no
NaN. It is often said that 45-degree curves make closure impossible because
diagonals come out as multiples of sqrt(2). They do, but an element
`a + b*sqrt2` is zero only when `a` and `b` are both zero, so exact closures
exist and the tests find them.

```
8 x E (radius 182, 45 deg)       residual exactly 0
8 x E1 (radius 90)               residual exactly 0
4E + D + 4E + D  (stadium)       residual exactly 0
4E + D + 4E + A                  residual exactly 72mm  (216 - 144)
```

**Stage 2, what the joints can give.** Wooden track has deliberate play in
every joint. When a loop does not close exactly, the check asks whether the
joints can take up the gap, by stretching and by bending:

```
  gap  within what the joints are known to give   ->  it MIGHT fit
  gap  beyond it                                  ->  not promised: past what has been tested
```

It never claims the gap *will* be absorbed, only that it is not ruled out. An
earlier per-joint optimiser was deleted on purpose: it flipped a user-visible
verdict depending on which piece was listed first, and its precision rested on
guessed tolerances. A bound over all the joints cannot depend on their order.

## What is not checked, or not measured yet

- **Supports.** Raised track is not checked for a support under it; the
  verdict says so on every raised layout.
- **The joints.** Joint stretch is measured (2mm, pulled apart). The bend
  limit is inferred from one loop of one set that closed and carried a train;
  a direct reading would replace it.
- **The ramp.** It is modelled 216mm long; one floor reading said 225.
- **The train.** Clearances use one 55mm train, the owner's tallest. Under
  raised track it leaves about -6mm, and the verdict says the train may not
  pass.
- **Large layouts.** The bound grows with the number of joints, so on a very
  large layout "might fit" says little.

The open readings are on the printable calibration sheet
(`docs/calibration-sheet.html`, every question with a drawing), and
`bun run calibration` shows what each answer changes. What is planned is in
`docs/plan/generic-TODOS.md`.

## Where things are

```
engine/
  data/            the pieces, where each size came from, and the owner's measurements
  src/geom/        exact Z[zeta16] arithmetic and the piece walker
  src/graph/       layouts as graphs: placement, closure, overlaps, levels, bends, build steps
  src/joints/      the give bound and what a verdict is worth (trust notes)
  src/view3d/      the 3D meshes, decoration included
  tools/           calibration and the measure-from-a-photo tools
app/
  src/App.tsx            the editor
  src/TrackCanvas.tsx    the SVG canvas
  src/VerdictLine.tsx    the verdict and its notes
  src/Viewer3D.tsx       the 3D view
  src/BuildMode.tsx      build mode
  src/tokens.css         every colour, type and spacing value (the rules are in DESIGN.md)
docs/
  calibration-sheet.html, and plan/: plans, reviews, the TODO list and its archive
```

## Licence, and what it does and does not cover

The source code is MIT licensed. See `LICENSE`.

**The MIT grant covers the code, not the part data.** Part dimensions in
`engine/data/` are partly transcribed from a published track guide's tables.
Individual measurements of physical objects are facts, but a curated
compilation of them may be protected, and that question is open. It is not
mine to grant until it is settled or the figures are re-derived from physical
measurement.

If you maintain that guide and object to this use, open an issue and I will
take the data down.

The self-hosted IBM Plex fonts are SIL Open Font License 1.1, and both notices
ship with the build at `/fonts/`.

Wooden toy-train track is made by several companies, and their names are
trademarks of their owners. This project is not affiliated with, endorsed by
or connected to any of them, and names none of them. "Generic", "Small-peg"
and "Look-alike" describe kinds of track, not brands. The name
`woodentrain.world` is descriptive.
