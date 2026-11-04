# Partnership pitch: what to build before reaching out (CEO review, 2026-11-04)

**STATUS: SHELVED (owner, 2026-11-04): "let's forget about any partnership and outreach for now, let's focus purely on the app".** Paused at document approval; never approved. Its richer-3D design is kept as the P3 TODO "Richer 3D pieces"; the seven partner items sit under "Shelved: partnership" in generic-TODOS.md. See docs/plan/2026-11-04-app-focus-review.md.

The owner plans to contact people at the two big wooden-track makers (the
Generic-system maker and the small-peg maker) and asked which features would
make a partnership interesting. Strategy-only review; mode SELECTIVE
EXPANSION. Maker names stay out of the app and the codebase (memory rule,
2026-11-04); this document names them only as "the Generic-system maker" and
"the small-peg maker".

## Premise (0A)

The real problem under the question: the app's answers rest on sizes nobody
has published. Generic joint give is an estimate; every small-peg and
look-alike piece is `unverified`. A maker is the one party that can fix that
at the source. The pitch is a trade: their data for a planner that tells their
customers "this layout will work, and here is what to buy". Features are worth
building now only if they make that trade visible in a demo.

Awkward fact for the small-peg maker: the app tells their customers that their
track does not plug into Generic. True, documented, and the first thing their
people will notice.

Do-nothing cost: the outreach shows the app as it is: a strong checker with
plain slab 3D, no sets, no maker's name, no shop. The "what's in it for us"
is left to imagine.

## Landscape (Layers 1-3)

- Layer 1: model-railway planners with large part libraries exist
  (one covers 200+ track systems); none checks whether a wooden
  layout closes or whether its joints can absorb the gap.
- Layer 2: the Generic-system maker's own app is a play app for preschoolers,
  not a planner; the small-peg maker's range is still sold and was refreshed
  (new locomotive, magnetic couplings). Search results were thin and partly
  SEO spam; treat as indicative.
- Layer 3: the conventional pitch is "features for the maker's customers".
  The stronger one is "the maker's data makes the planner exact, and the
  planner makes the maker's sets sell": the value runs both ways and only
  starts once data flows.

## What already exists (0B)

| Partner-relevant need | Existing code |
|---|---|
| Will it work | exact closure (`engine/src/geom/cyclotomic.ts`), joint-give bound, bend check, trust register (`engine/src/joints/trust.ts`) |
| What you own | per-piece inventory, shortfall line, "would exceed" card marks (`app/src/Inventory.tsx`, `App.tsx`) |
| Build it | build mode with steps and pull list (`app/src/BuildMode.tsx`) |
| Show it | 3D viewer (`engine/src/view3d/mesh.ts`, `decor.ts`), share links and read-only link view (`app/src/shareLink.ts`, `LinkRoute.tsx`) |
| Trust it | dimension sources, verified mark, part origins (`engine/data/sources.ts`, `measured.ts`, `origins.ts`) |

## Dream state (0C)

```
TODAY                              THIS PLAN                         12-MONTH IDEAL
unbranded planner, sizes      ->   3D pieces that look like the  ->  maker-supplied data, their sets
mostly measured by us,             real ones: cut grooves, peg       as the unit people own and buy,
slab 3D, brands unnamed            and socket shapes, finer          names shown under licence,
                                   decoration                        "plan it, check it, buy it"
```

## Scope decisions (0G, cherry-pick)

| # | Candidate | Effort | Risk | Decision | Owner's answer |
|---|-----------|--------|------|----------|----------------|
| 1 | Inventory by set: sets you own fill in the pieces, skippable first step, shopping list | M | low | DEFERRED | D1 "Defer to TODOS.md" |
| 2 | Richer 3D pieces: cut grooves, peg and socket shapes, plank ends, finer decoration, from our own measured shapes | L | medium | ACCEPTED | D2 "Add to scope" |
| 3 | Maker data pack: format, sample file, importer; supplied pieces become `published` | M | low | DEFERRED | D3 "Defer to TODOS.md" |
| 4 | Links from the shopping list to the maker's shop by part number | S | low | DEFERRED | D4 "Defer to TODOS.md" |
| 5 | Set planner: layouts a box builds that close, "add these to build this" | L | medium | DEFERRED | D5 "Defer to TODOS.md" |
| 6 | Mark each joint where two systems meet (canvas, verdict, build mode) | S | low | DEFERRED | D6 "Defer to TODOS.md" |
| 7 | Embeddable "try this set" view for product pages | M | medium | DEFERRED | D7 "Defer to TODOS.md" |
| 8 | Maker names and part numbers behind a per-system licence switch | S | medium | DEFERRED | D8 "Defer to TODOS.md" |

Also offered, not taken up: printable build instructions; anonymous counts of
pieces people are short of (privacy-sensitive).

## Accepted scope: richer 3D pieces (D2)

Why this passes the premise test: it is the demo's visual hook, not the trade
itself. A maker judges the app first by whether their pieces look like their
pieces; the trade (their data, our exact planner) is the deferred data pack
(D3), the first follow-up once a maker replies.

Who it serves: the demo for the Generic-system maker. Small-peg pieces have
no groove width and no photos, so they look as they do today until someone
photographs one; the small-peg maker's pitch rests on the deferred items.

What the person sees in the 3D view and in build mode's per-step render:

- Wheel grooves cut into the plank, not painted strips: two grooves of the
  part's groove width and depth (Generic: 6mm wide, 3mm deep, gauge 26, from
  the published profile, `TRACK_PROFILE` in `engine/data/sources.ts`). A part
  with no groove width keeps a bare top, as today.
- The peg as a neck and a round head, the socket as the matching round hole
  and throat, plank-end corners as the pieces have them. OUTLINES are read
  from the owner's existing top-view photos (`photos/`, never committed) with
  the photo tool: a reading is accepted when two photos agree within
  `AGREE_MM` (0.5mm, `engine/data/photoReadings.ts`), and the figure is then
  claimed good to ±1mm (`TOLERANCE_MM`) (D9). A piece with no usable top-view
  photo (today every small-peg and look-alike piece) keeps today's plain end;
  its grooves still follow the groove rule above. HEIGHTS (peg head, top-edge rounding, both named in the owner's D9 answer) are not
  visible from above: drawn from the plank thickness and marked as estimates
  in the piece's dimension note (`DimensionSource.note`) (D9). Never from a
  maker's mesh.
- Finer decoration on the decorated pieces and structures, and only these:
  station straight, tunnel straight, level crossing, riser, tunnel with
  overpass, and the three bridges; only with shapes from the shared set in
  `decor.ts` (a new shape kind is a new decision).
- Build mode (D10): keeps D42 of `docs/plan/2026-10-31-build-mode.md`. The next piece shows cut grooves; pieces
  already down stay plain tops, so the next piece still stands out.

Implementation owner must prove (strategy-only review):

- where groove depth lives per part (today only `grooveWidthMm` is a part
  field; depth is in `TRACK_PROFILE`), and that "no groove figures" means no
  `grooveWidthMm`;
- each photo-read outline figure is recorded like the T switch's readings
  (`engine/data/photoReadings.ts`), two photos agreeing within the existing
  rule;
- the approved per-piece budget holds: 3,000 triangles (F5, approved as eng
  D8 on 2026-11-03, enforced by `engine/test/decorated.test.ts`), checked for
  switches and crossings too, whose cut grooves multiply the top faces;
- the 3D view stays responsive: at least 30 frames a second while orbiting
  the largest corpus layout, on a mid-range tablet or its emulation (the
  implementation owner names the device);
- grooves meet cleanly where two groove paths cross (switch frogs, the
  crossings) with geometry built ahead of time, no boolean cutting while the
  view runs;
- the one text surface D9's "marked as estimates" needs (the dimension note
  is held today but no screen shows it): the piece's card tooltip or the
  trust notes; this is the only non-drawing change in D2;
- which Generic pieces the photos cover: the peg, socket and plank-end
  outline is one connector shared by every Generic piece, so one agreed pair
  of photos covers them all; list the photos used before starting;
- the verdict, collision bodies and 2D canvas do not change: drawing only, so
  the 670-layout verdict corpus stays at 0 changed;
- grooves and pegs read at the viewer's starting angle and in build mode.

## Deferred (TODOS.md)

Items 1 and 3-8 above, each with its context, in `docs/plan/generic-TODOS.md`
under "Partnership" (2026-11-04). Item 1 is a note on the existing P1
inventory entry.

## Decision ledger

| ID and owner | Current | Status | Exact approval and scope |
|---|---|---|---|
| MODE (owner) | SELECTIVE EXPANSION | approved | answer to the mode question, 2026-11-04 |
| D1 inventory by set | deferred | deferred | "Defer to TODOS.md" |
| D2 richer 3D | in scope | approved | "Add to scope": grooves, pegs and sockets, plank ends, finer decoration, own measurements |
| D3 data pack | deferred | deferred | "Defer to TODOS.md" |
| D4 shop links | deferred | deferred | "Defer to TODOS.md" |
| D5 set planner | deferred | deferred | "Defer to TODOS.md" |
| D6 joint marks | deferred | deferred | "Defer to TODOS.md" |
| D7 embed | deferred | deferred | "Defer to TODOS.md" |
| D8 licensed names | deferred | deferred | "Defer to TODOS.md" |
| D9 shape sources | outlines from photos, heights estimated and marked | approved | "Photos + marked estimate" |
| D10 build mode | keep D42 | approved | "Keep D42" |
