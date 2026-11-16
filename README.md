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
  out of, and the layout says what it is short of. "These are mine" raises your counts to the layout
  on screen in one tap, and "Copy what is short" gives the pieces and
  adapters a layout still needs as text.
- **My layouts.** Keep several layouts under names of your own, in this
  browser, and open any of them again. The one on screen is put aside first.
- **Add or correct a piece** you have measured yourself; your figure outranks
  anything shipped.
- **Share a layout** as a link; it opens read-only, on a phone too.

A phone edits too, in a layout of its own: the plan, the verdict, and the
pieces in a sheet that opens over the controls.

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
joints can take up the gap, by stretching and by bending. A small linear
program finds the smallest share of each joint's limit, the same share at
every joint, that closes every loop; the bent loop is then re-walked exactly
and anything left over is reported. A joint shared by two loops has its give
once, never once per loop.

```
  closes with every joint within its limit   ->  closes, and says how far the worst joint bends
  needs more than that                       ->  beyond the tested bend, never "will not fit"
```

An earlier per-joint optimiser was deleted on purpose: it flipped a
user-visible verdict depending on which piece was listed first. The bend
solver orders its model canonically, so the same layout gets the same answer
however it was built.

## What is not checked, or not measured yet

- **Supports.** Raised track is checked for a support (a track support, a
  ramp's high end, or a structure's raised road) at least every F4 along
  it, once F4 is measured; until then the verdict says supports are not
  checked. Track ending in mid-air past its last support is reported, not
  judged.
- **The joints.** Joint stretch is measured (2mm, pulled apart). The bend
  limit is inferred from one loop of one set that closed and carried a train;
  a direct reading would replace it.
- **The ramp.** It is modelled 216mm long; one floor reading said 225.
- **The train.** Clearances use one 55mm train, the owner's tallest. Under
  raised track it leaves about -6mm, and the verdict says the train may not
  pass.
- **Large layouts.** The bend solve has one fixed work budget per layout
  (about half a second on a laptop), and a layout can have at most 31
  independent loops. Past either, the verdict says it could not check the layout;
  it never guesses.

The open readings are on the printable calibration sheet
(`docs/calibration-sheet.html`, every question with a drawing), and
`bun run calibration` shows what each answer changes. What is planned is in
`docs/plan/generic-TODOS.md`.

## What the site sends, and what it never does

There is no account and no server of mine. A layout, your saved layouts, your
box, your table and the parts you add are kept in your own browser and are
never sent anywhere. A shared link holds its layout after the `#` in the
address, which browsers do not send to any server.

The editor counts visits with [GoatCounter](https://www.goatcounter.com),
through a copy of its script that is kept in this repository
(`app/public/count.js`). It sets no cookie and stores nothing in your browser.

**For each visit**, one request carries:

- the page's path, or just `/shared-link` or `/piece-preview` when the address
  holds a shared layout or a piece preview, whatever it holds;
- the page's title, which is the same for everyone;
- the address of the page you came from, when your browser gives one;
- the width of your screen in pixels;
- whether the browser looks automated;
- anything after a `?` in the address. The site puts nothing there itself, so
  this is empty unless the link you followed added something.

**For each of these ten actions**, one request carries the action's name and
nothing else about the page: no layout, no piece count, nothing you typed.

- Shared a link
- Opened build mode
- Switched to 3D
- Placed a preset
- Opened Your box
- Added a part
- Saved to a file
- Opened a layout file
- Opened a link in the editor
- Own layout first said "This works"

Like any request, these reach GoatCounter's servers from your IP address with
your browser's name; what is kept of those is GoatCounter's to say. The same
is true of the host that serves the pages, GitHub Pages.

To leave your own visits out, use a content blocker, or set `skipgc` to `t`
in this site's local storage: the script then sends nothing.

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

## Versions

Every merge to `main` is deployed and is a version: `package.json` holds the
number, [CHANGELOG.md](CHANGELOG.md) says what changed in each, and the
deploy tags it and publishes it under
[Releases](https://github.com/raduuuuu/ChooChooCAD/releases). The app shows
the version it is running.

## Licence, and what it does and does not cover

The source code is MIT licensed. See `LICENSE`.

**The MIT grant covers the code.** Part dimensions in `engine/data/` are
partly transcribed from a published track guide's tables. Individual
measurements of physical objects are facts, and I consider their use here to
raise no issue (2026-11-14). That is my own view as the maintainer, not legal
advice.

If you maintain that guide and object to this use, open an issue and I will
take the data down.

The self-hosted IBM Plex fonts are SIL Open Font License 1.1, and both notices
ship with the build at `/fonts/`.

Wooden toy-train track is made by several companies, and their names are
trademarks of their owners. This project is not affiliated with, endorsed by
or connected to any of them, and names none of them. "Generic", "Small-peg"
and "Look-alike" describe kinds of track, not brands. The name
`woodentrain.world` is descriptive.
