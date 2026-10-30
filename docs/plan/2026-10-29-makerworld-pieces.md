# Every piece on MakerWorld (2026-10-29)

Owner asked to "scrape makerworld and add every single piece you can find to
the library, including special pieces, switches, etc." Scope chosen: **phased,
all BRIO types**. PR 1 adds every piece that fits today's part kinds, and after
that there is one PR per new kind. Every figure here is `unverified`: it was
read off a 3D-print reproduction's mesh, not a real piece.

## How the data was gathered

- **Search.** 34 keyword searches of the MakerWorld search API returned 2,435
  models. 844 of them are wooden-railway track: the title or tags name
  BRIO/Lillabo/wooden, and the title names a track piece. They break down as
  177 ramps/bridges/spirals, 105 adapters, 75 crossings, 68 switches, 51
  curves, 47 straights, 41 flex pieces and 17 buffer stops; the rest are mixed.
- **Download.** 77 models were chosen to cover every BRIO type, plus the IKEA,
  Lidl and Hape reproductions. 135 3MF instances were downloaded; 5 were
  restricted. A logged-in session is needed, and a captcha appears after
  about 46 downloads in quick succession.
- **Measurement.** Ports were read off the meshes the same way `switchSeeds.ts`
  was: an end face is a vertical wall about 40mm across, and its centre and
  outward normal give a port. A port is a peg when material stands more than
  5mm proud of its face. The method recovers the published straights to
  0.1mm, and A2, B2, C2, L and M with the right polarity.

## Scope: what counts as a piece

- **In:** reproductions of a brand's real pieces (Cactus 973, AU3D, Isaxon for
  BRIO; Vamuss for Lillabo).
- **Out, each with its own sizing rather than a copy of a brand's part:**
  - designers' own track systems: TerTerro (145/100/50 straights, curves at a
    206 centreline), JJ 3D printing (50/100/150/200, curves at about 127 and
    200), KYZ, CavemanDesigns, and oymate's customizer;
  - flex and wobbly track;
  - spirals;
  - the M.verbeke 90° bridge ramps.
- **Out because the lattice cannot hold them:** angles off the 22.5° grid,
  namely the AU3D and ph_neutral 60° three-way splits and the Lidl curves in
  10° steps.

TerTerro's straights happen to match the Lillabo lengths below. That is noted,
but not counted as corroboration, because nothing says TerTerro copied
Lillabo.

## PR 1: fits today's kinds (this PR)

| Piece | Source | Measured | Modelled |
|---|---|---|---|
| IKEA-50/100/145/205/240 straights | Vamuss 2181560 | 50.0, 100.0, 145.0, 205.0, 240.0 | as measured |
| IKEA-C22 / C45 / C90 curves | Vamuss 2181560 | centreline 202.1–202.6 | 202 (inner 182), arcSteps 1/2/4 |

IKEA-150 stays because layouts and tests use its id. Its note now says it was
a customizer default and that the reproduction has a 145 and no 150.

BRIO has nothing new that fits today's kinds. The T switch fits the shape of
`SwitchPart`, but AU3D's reproduction has a socket on the arc end and a peg on
the straight end, and `PartEnds` gives both roads one polarity. It therefore
waits for the multi-road kind.

## Later phases: one general kind, then data

Every multi-ended reproduction measured so far is exact on the 22.5° lattice:
integer positions and integer radii. So rather than one kind per shape, the
next engine PR adds **one** general kind:

- **ports** at exact poses in the part's own frame, each with its own polarity;
- **roads**, each a straight or an arc between two of those ports.

After that, each family below is a data-only PR. Buffer stops need a second,
smaller change: a part with one port.

| BRIO | Shape, as measured | Polarity (heel first) | Source |
|---|---|---|---|
| H | 108 × 108 cross at 90°, crossing at both midpoints | each road peg/socket | Cactus 973 `cross_h` |
| H1 | 116 × 116 cross at 90°, midpoints | one road socket/socket, the other peg/peg | Cactus 973 `cross_h1` |
| H2 | 144 straight crossed by a 144 diagonal at 45°, midpoints | each road peg/socket | Cactus 973 `criss_cross_h2` |
| I, J | 144 straight plus an E arc (202) each side from one heel | I socket heel / pegs; J the reverse | Cactus 973 `switch_double_curved_i/j` |
| O, P | Y: two E1 arcs (110), ±45° from one heel | O socket heel / pegs; P the reverse | Cactus 973 `switch_short_curved_o/p` |
| T | 216 straight plus a 90° arc at a 108 centreline (inner 88) | AU3D: socket heel, peg on the straight, socket on the arc | AU3D 904802, RyeBread 526629, kolar.majkl 688457 agree |
| X (star) | 216 straight plus 90° arcs at 108 each side | peg heel, socket on the straight and one arc, peg on the other arc (Fantastic Plastic Person; corrected 2026-10-30 from the reading) | 795599 |
| EE | two concentric 45° curves 46 apart, centrelines 202 and 248 | sockets in, pegs out | AU3D 887239 |
| F1, G1 | 144 straight plus a branch ending parallel, 46 over | F1 socket heel / pegs; G1 the reverse | AU3D 892305 |
| F, G | symmetric fork to two tracks 47 apart over 150 | F socket heel / pegs; G two sockets in, peg out | Isaxon 3121622 |
| R, S | buffer stop: one end | — | TerTerro 55130, CUBEUNi 1732324, Petr Bartusek 778196 |

Lillabo has its own multi-road pieces in the same Vamuss set: a crossing of two
145 straights, a Y of two 45° curves, and a 45° curve plus straight.

### Facts these change

- **T and X are NOT approximate.** `BRIO_PIECE_TABLE` marks them
  `approximate-radius` on woodenrailway.info's footnote ("within 2mm of E1").
  Three independent reproductions put the arc at a 108 centreline, which is
  an integer and therefore exact. That correction belongs in the T/X PR.
- **F and G need a half millimetre.** The fork's two ends sit ±23.5 off the
  heel's line. The lattice holds integers only, so F/G will be modelled with
  one end at 23 and one at 24, or with the frame moved so that one road runs
  straight, with the 0.5mm stated per part.
- **F1/G1's diverging road** is an S-shaped reverse curve, not one arc. Its
  ends are exact; the road between them is drawing only. The overlap check
  needs a footprint for it, which the general kind must provide.

### Not found on MakerWorld

F2/G2 (triple parallel), H3 (curved crossing), K, K1, L1/M1, Q (five-point),
U/V (car ramps), and EE1 (in AU3D's set but not in the instances downloaded).
These stay as table rows until someone finds a reproduction or measures one.

## Eng review of the multi-road type (2026-10-30)

Target: this file, section "Later phases: one general kind, then data" (the
multi-road part type). Reviewer: /plan-eng-review, Claude, at main 86e3eaa.

### Scope record

feature answers: D2 = defer F1/G1 and F/G (only straight and arc roads in the
new type; both families get a TODO naming the S-bend and the 23.5mm offset);
D3 = PR A ships the multi-road type plus the H crossing, PR B ships H1, H2, I,
J, O, P, T, X, EE and the three Lillabo pieces plus the T/X `BRIO_PIECE_TABLE`
correction; structure: D4 = B, smaller arrangement (the new type replaces
`SwitchPart`; L, M, O1 and P1 become its data with ports heel 0, straight 1,
curved 2; three part kinds: straight, curve, multi-road); accepted scope: PR A
= the multi-road type replacing SwitchPart, the four switch seeds re-expressed,
the H crossing; PR B = the 12 remaining lattice-exact pieces; buffer stops stay
a later one-port PR as planned; pending remedies: SC1, SC2, SC4, SC6.

Factual correction (no behavior change): D2's question said 12 of 16 measured
multi-road pieces fit straight-and-arc roads. The count is 13 of 17: H, H1, H2,
I, J, O, P, T, X, EE plus the Lillabo crossing, Y and curve-plus-straight fit;
F, G, F1, G1 do not. Line 62 above ("every multi-ended reproduction measured so
far is exact on the 22.5 lattice") is false for F/G and F1/G1, as lines 95-101
already say; D2 resolves it.

### Scope Challenge findings

1. SC1 [CRITICAL] (confidence: 9/10) engine/src/graph/render.ts:110-122 — the
   renderer draws road i from port 0 to port i (`// Port 0 is the entry; every
   other port is the far end of one road.`) and takes every arc's side from
   `piece.turn` (`sweep: piece.turn === 'right' ? 'right' : 'left'`). A
   crossing's second road joins ports 2 and 3, not port 0, and I/J have arcs on
   both sides, so both would be drawn wrong, and `overlap.ts` builds its plank
   footprint from these same segments.
2. SC2 [CRITICAL] (confidence: 8/10) engine/data/library.ts:98 — `const
   endCount = (p: Part): number => (p.kind === 'switch' ? 3 : 2);` guards
   corrections ("a two-ended part standing in for a switch leaves any joint on
   the switch's third end pointing at nothing"). On a four-ended crossing it
   returns 2, so a straight submitted under the id `H` would be accepted and
   every weld on ports 2 and 3 would throw `piece p0 has no port 2`.
3. SC3 [INFORMATIONAL] (confidence: 7/10) engine/src/geom/pose.ts:49 and
   engine/src/geom/fk.ts:84 — the chain walkers refuse only `kind ===
   'switch'`. Any new kind reaching the curve branch fails to typecheck
   (`centrelineRadiusMm` takes `CurvePart | SwitchPart`), so tsc catches it; the
   refusal just has to name the new kind. No question needed.
4. SC4 [CRITICAL] (confidence: 9/10) engine/src/joints/trust.ts:78 — `const
   switches = parts.filter((p) => p.kind === 'switch');` drives the "geometry is
   modelled, not measured" note. A layout with a crossing and no switch would
   lose that note, although the crossing is just as much modelled.
5. SC5 (resolved by D2) — plan line 62's "exact on the lattice" premise is
   false for F/G and F1/G1.
6. SC6 [INFORMATIONAL] (confidence: 9/10) a hand-synced "is this a switch"
   list: App.tsx:188 (`switchIds`, fed to SubmitPart.tsx:80
   `correctsSwitch`), library.ts:98, trust.ts:78, ghostKeys.ts:58/90,
   GraphListing.tsx:67/123. Each answers "does this piece have more than two
   ends / what are its ends called" separately.
7. SC7 (resolved by D3) — about 9 PRs in the plan as written.

## Decision ledger

### R1: How the renderer draws a multi-road piece's roads (SC1)
Finding: 1, CRITICAL, 9/10, engine/src/graph/render.ts:110-122, Claude.
Plan baseline: the plan says "roads, each a straight or an arc between two of
those ports" (line 67), with no rule for drawing them.
Runtime evidence: render.ts draws port 0 to port i and sweeps every arc by
`piece.turn` (read 2026-10-30 at 86e3eaa).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R1 road drawing | port 0 to port i, arc side = piece.turn | each road names its two ports and its own arc side; drawn start port to end port, side mirrored by `turn`; overlap uses the same segments | unchanged; roads must start at port 0 |
| D2/D3/D4 scope | approved | unchanged | unchanged, but H cannot be expressed, which contradicts D3 |
| SC2, SC4, SC6 | pending | pending | pending |
Question D5:
D5 — Draw each road between the two ends it names, with its own arc side?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D4 settled).
ELI10: The renderer assumes every road starts at a piece's first end and that
every arc bends the way the whole piece is flipped. A crossing's second road
starts at its third end, and the I/J switch bends one arc left and one right.
Both would be drawn wrong, and the overlap check uses the drawing's outline.
Stakes if we pick wrong: crossings are drawn as a fan from one corner, and
overlap is checked against that wrong outline.
Recommendation: A because the crossing ships in PR A (D3) and cannot be drawn
under the current rule.
Completeness: A=10/10, B=3/10
Header: Road drawing
Options:
A) Each road names its ends (recommended)
Each road is drawn from its start port, heading reversed, to its end port. An arc's side comes from the road and is mirrored when the piece is flipped. overlap.ts keeps using these segments. Tests: H draws two crossing straights; I draws one arc each side. (human: ~3h / CC: ~15min)
B) Keep the port-0 rule
Roads must start at port 0, so H, H1, H2, X and EE cannot be described and D3's crossing cannot ship. (human: 0 / CC: 0)

State: approved
Actual answer: A, "Each road names its ends" (D5, 2026-10-30)
Accepted scope: each road names its start and end port and its own arc side; render.ts draws start port (heading reversed) to end port, arc side mirrored by `turn`; overlap.ts unchanged and fed by these segments; tests: H draws two crossing straights, I draws one arc each side, regression pin on the L/M/O1/P1 segments.
History: none

### R2: The end count that guards corrections (SC2)
Finding: 2, CRITICAL, 8/10, engine/data/library.ts:98, Claude.
Plan baseline: not in the plan.
Runtime evidence: `endCount` returns 3 for kind 'switch' and 2 otherwise
(read at 86e3eaa); `looksLikePart` admits only straight and curve submissions,
so every correction of a multi-road piece is two-ended.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R2 end count | 3 for switch, else 2 | `portsOf(part).length` for every part | unchanged (2 for the new kind) |
| R1 road drawing | approved (D5) | unchanged | unchanged |
| SC4, SC6 | pending | pending | pending |
Question D6:
D6 — Count a piece's ends from its ports when deciding whether a correction may replace it?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D5 settled).
ELI10: A user can submit a measured correction that replaces a built-in piece
with the same id. The library refuses it when the end count differs, so welds
never point at an end that vanished. That count is hard-coded: 3 for a switch,
2 for everything else. A crossing has 4 ends, so a straight submitted as "H"
would pass and every layout welded to the crossing's third or fourth end would
throw "piece p0 has no port 2".
Stakes if we pick wrong: a saved layout with a crossing stops opening after a
mistaken correction.
Recommendation: A because the count then comes from the same ports the solver
uses, so it cannot drift.
Completeness: A=10/10, B=2/10
Header: End count
Options:
A) Count from the ports (recommended)
endCount becomes portsOf(part).length. Test: a straight submitted with a crossing's id is refused and the crossing stays. (human: ~30min / CC: ~5min)
B) Leave the hard-coded count
A 4-ended piece counts as 2, so a two-ended correction replaces it and its welds on ports 2 and 3 throw. (human: 0 / CC: 0)

State: approved
Actual answer: A, "Count from the ports" (D6, 2026-10-30)
Accepted scope: library.ts `endCount` becomes `portsOf(part).length`; test: a straight submitted under a crossing's id is refused and the crossing stays.
History: none

### R3: The "modelled, not measured" note for every multi-road piece (SC4)
Finding: 4, CRITICAL, 9/10, engine/src/joints/trust.ts:78, Claude.
Plan baseline: not in the plan.
Runtime evidence: the note fires on `kind === 'switch'` only (read at 86e3eaa).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R3 modelled note | switches only | every multi-road piece; wording "this piece's geometry is modelled, not measured" / plural | switches only; a crossing layout gets only the generic unverified note |
| R1, R2 | approved (D5, D6) | unchanged | unchanged |
| SC6 | pending | pending | pending |
Question D7:
D7 — Give every multi-road piece the "geometry is modelled, not measured" note?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D6 settled).
ELI10: A layout with a switch says its geometry is modelled, not measured,
because the shape is the engine's model of the piece, whatever its numbers'
source. That note is keyed to the switch type, which D4 replaces. A crossing
is modelled the same way, so without a change a crossing layout would lose the
note, and so would the switches once they move to the new type.
Stakes if we pick wrong: layouts with switches or crossings stop saying their
shape is modelled.
Recommendation: A because D4 removes the switch type the note is keyed to, so
it has to move anyway.
Completeness: A=10/10, B=3/10
Header: Modelled note
Options:
A) Every multi-road piece (recommended)
The note fires for any piece of the multi-road type and names pieces, not switches ("This piece's geometry is modelled, not measured." / "These pieces' ..."). Test: an H-only layout carries the note; an L layout still does. (human: ~1h / CC: ~10min)
B) Switches only
The note is kept for the four switches by id, so a crossing layout gets only the generic unverified-size note. (human: ~30min / CC: ~5min)

State: approved
Actual answer: A, "Every multi-road piece" (D7, 2026-10-30)
Accepted scope: trust.ts fires the modelled note for every multi-road piece, worded for pieces ("This piece's geometry is modelled, not measured." / "These pieces' geometry is modelled, not measured."); tests: an H-only layout carries it, an L layout still does.
History: none

### R4: Where a piece's end names, flip wording and size label come from (SC6)
Finding: 6, INFORMATIONAL, 9/10, App.tsx:188/794/1148, SubmitPart.tsx:80,
ghostKeys.ts:58/90, GraphListing.tsx:67/123, Claude.
Plan baseline: "After that, each family below is a data-only PR" (line 69).
Runtime evidence: each of those lines branches on `kind === 'switch'` with
hard-coded words ("heel", "straight road", "curved road", "Branch to the
other side") or a radius label (`r${centrelineRadiusMm(part)}`) that a
crossing has no value for.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R4 names and labels | per-kind code in 4 app files | the multi-road data carries each port's name, the flip wording (or none when the mirror changes nothing) and the palette size label; app reads them; one `isMultiRoad(part)` for SubmitPart and App | per-kind code: app branches on part id for each new family |
| PR B data-only | plan claim, false today | true | false: each family edits app code |
| R1-R3 | approved | unchanged | unchanged |
Question D8:
D8 — Put each multi-road piece's end names, flip wording and size label in its data?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D7 settled).
ELI10: The app names a switch's ends "heel", "straight road" and "curved road",
says "Branch to the other side" for F, and labels palette cards with a length
or a radius. All of that is code written for one switch shape. A crossing has
four ends, no single radius, and flipping it changes nothing. If the words
live in each piece's data, PR B is data only, as the plan promises; if they
stay in code, every family edits four app files.
Stakes if we pick wrong: PR B touches app code for each of 12 pieces, or a
crossing is announced as "curved road" and labelled with a radius it lacks.
Recommendation: A because it is what makes the plan's "data-only" PR B true.
Completeness: A=10/10, B=5/10
Header: End names
Options:
A) Names and labels in the data (recommended)
Each multi-road part lists port names, flip wording (absent when the mirror is the same piece) and a palette label; ghostKeys, GraphListing, App and SubmitPart read them through one isMultiRoad check. Tests: H's ends read by name in the list; F is hidden for H; L keeps "heel", "straight road", "curved road". (human: ~4h / CC: ~25min)
B) Per-kind code in the app
The app keeps branching, now by part id, and each data PR adds its words to four app files. (human: ~1h per family / CC: ~10min per family)

State: approved
Actual answer: A, "Names and labels in the data" (D8, 2026-10-30)
Accepted scope: each multi-road part lists its port names, its flip wording (absent when the mirror is the same piece) and its palette label; ghostKeys, GraphListing, App and SubmitPart read them through one `isMultiRoad(part)`; tests: H's ends read by name in the list, F is hidden for H, L keeps "heel", "straight road", "curved road".
History: none

Scope Challenge result: scope reduced per recommendation (D2 defers F1/G1 and
F/G; D3 and D4 rearrange without cutting). MODE = SCOPE_REDUCED.

### R5: The shape of the multi-road data (design-twice, Section 1)
Finding: Architecture A1, INFORMATIONAL, 8/10, engine/src/graph/model.ts:181
(`portsOf`), Claude.
Plan baseline: "ports at exact poses in the part's own frame, each with its
own polarity; roads, each a straight or an arc between two of those ports"
(lines 66-67): shape 1 below, without a consistency check.
Runtime evidence: `portsOf` already returns `Port[]` in the local frame, and
every consumer (frames, feasible, render ports, assembly) reads only that.
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R5 data shape | plan: ports + roads, unchecked | ports listed (pose, polarity, name) + roads naming two ports and a straight/arc shape; a test walks every road of every built-in multi-road part and requires its end to EQUAL the named port exactly | roads only (start frame + shape); ports derived by de-duplicating road ends, numbered in derivation order |
| port numbering | n/a | written in the data, so L/M/O1/P1 keep 0/1/2 by construction | follows the derivation order; must be pinned by test |
| R1-R4 | approved | unchanged | unchanged |
Question D9:
D9 — List each piece's ends and check its roads against them exactly, or derive the ends from the roads?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D8 settled).
ELI10: A multi-road piece can be written two ways. Shape A lists its ends
(position, peg or socket, name) and lists its roads between them; a test walks
every road and requires it to land exactly on the end it names, so a typo in
either list fails. Shape B lists only roads, and the ends are worked out from
where the roads stop. B has no repeated data, but end numbers come out of the
working-out, and saved layouts refer to ends by number.
Stakes if we pick wrong: in B, a reordered road renumbers a piece's ends and
saved welds point at the wrong ends; in A, two lists must agree, and only the
test makes them.
Recommendation: A because end numbers are what saved layouts store (D4 pins
0/1/2 for the switches), and an exact check turns the repeated data into a
second witness for every measurement.
Completeness: A=10/10, B=7/10
Header: Data shape
Options:
A) Ends listed, roads checked (recommended)
Ports (exact pose, polarity, name) and roads (port pair + straight length or arc radius/steps/side) are both data; a test walks each road of every built-in multi-road part and requires exact equality with its end port, and port 0 at the entry pose. (human: ~3h / CC: ~20min)
B) Ends derived from roads
Roads only; ports come from de-duplicating road ends, numbered in that order, with a test pinning the switches' numbering. (human: ~4h / CC: ~25min)

State: approved
Actual answer: A, "Ends listed, roads checked" (D9, 2026-10-30)
Accepted scope: multi-road data = ports (exact pose, polarity, name) + roads (port pair + straight length or arc inner radius/steps/side); a test walks every road of every built-in multi-road part and requires exact equality with its end port, and port 0 at the entry pose.
History: none

### Section 1: Architecture

Two shapes (design-twice): A, ports listed and roads checked; B, ports
derived from roads. Picked A (D9). Depth: `portsOf` already hides every piece
behind `Port[]`, and A keeps that the whole public surface; the solver,
frames, feasible, assembly and levels need no change.

```
  part data (multi-road)            portsOf(part, turn)          consumers (unchanged)
  ports[i] {at, polarity, name} --> turn 'right': conj each   --> frames / feasible /
  roads[j] {from, to, shape}        pose (new exact conj)        assembly / levels
         |                                                        
         +--> renderGraph: one segment per ROAD, start port  --> overlap.ts footprint,
              (heading reversed) to end port, arc side        canvas, table model
              mirrored by the same conj rule
  test: walk(roads[j] from ports[from]) == ports[to], exactly; ports[0] == entry pose
```

Findings (confidence format):
- [INFORMATIONAL] (confidence: 9/10) engine/src/geom/cyclotomic.ts — no
  conjugate exists (exports: fromInt, add, sub, scale, isZero, equals,
  mulZetaPow, zetaPow, toXY, magnitude). Flipping a listed-port piece needs an
  exact mirror, zeta^k to zeta^-k. Necessary work under D9; one function used
  by both `portsOf` and the renderer's arc side, so the two cannot disagree.
- [INFORMATIONAL] (confidence: 9/10) engine/src/parts/schema.ts:272 —
  `readonly ends: PartEnds;` sits on `PartBase`, and `portPolarity`
  (model.ts:263) returns `ends.start` for port 0 and `ends.end` for the rest.
  Per-port polarity (plan line 66, needed by H1 and T) means `ends` moves onto
  StraightPart and CurvePart and `portPolarity` reads the port. Necessary work;
  readers are model.ts:198-200/264, repair.ts:92 (straights only),
  feasible.ts:142 (chain, two-ended only), library.ts:211 (submissions).
- No change needed: overlap.ts:279 skips pairs within one piece, so a
  crossing's two roads crossing each other are not a clash; the pile-up span
  loop (feasible.ts:565-573) already counts every pair of a piece's free ends.
- Red flags: 6 (two ways) is closed by D4, plus a validator rule that a
  multi-road part has at least 3 ports, so it cannot become a second way to
  write a straight or a curve. 8 (hand-synced list) is closed by D9's exact
  test and D6's derived end count.
- Production failure, new path: a mistyped port pose in PR B. Caught by D9's
  exact road walk before merge; the user never sees it.

Dispositions: R5 approved (D9); conj and per-port polarity are necessary work
under D4/D9 and the plan's per-port polarity; nothing else pending.

### Section 2: Code quality

- [INFORMATIONAL] (confidence: 9/10) stale docblocks the change makes false:
  schema.ts:167-179 ("'crossing' is deliberately NOT here yet"), schema.ts:336
  ("NO PUBLISHED SWITCH IS IN THE CATALOGUE" on `SwitchPart`, which goes),
  model.ts:5-9 and :181-187 (two-ended catalogue), render.ts:13-16 ("A switch
  draws two"), pose.ts:36-46 (refusal names switches), trust.ts:65-76. Update
  in the same commits.
- [INFORMATIONAL] (confidence: 8/10) engine/data/sources.ts `BRIO_PIECE_TABLE`
  rows for L/M and O1/P1 still say `needs-graph` (TODO P2 item 3); PR A
  touches those parts, so it corrects them; T/X stay for PR B (D3).
- Shared code: no extraction beyond D6/D8's `portsOf(part).length` and
  `isMultiRoad`; no other pair of callers shares a contract.

Dispositions: both are necessary documentation of approved changes; no
question.

### R6: Regression contract for the four switches moving to the new type (Section 3, IRON RULE)
Finding: Test T1, CRITICAL, 9/10, engine/data/switchSeeds.ts:86 (`export const
SWITCH_SEEDS: readonly SwitchPart[]`), Claude.
Plan baseline: D4 approved replacing SwitchPart and keeping ports heel 0,
straight 1, curved 2; no regression contract written yet.
Runtime evidence: existing pins cover switch port POSES against independent
catalogue parts (switchSeeds.test.ts:51-62, both turns) and polarity through
`p.ends` (switchSeeds.test.ts:68-74, which must be rewritten when `ends` leaves
the multi-road type). Nothing pins a switch's drawn segments: render.test.ts
pins sweep for curves only (render.test.ts:90-94).
Comparison grid:
| Choice | Current | A | B |
|---|---|---|---|
| R6 regression proof | port poses and polarity pinned; segments not | before the rewrite, freeze `portsOf` (both turns), every port's polarity and `renderGraph` segments for L, M, O1, P1 at 86e3eaa into a fixture; after, deep-equal; existing pins kept (polarity pin moved to `portPolarity`) | existing pins only, with the polarity pin moved to `portPolarity` |
| intended differences | n/a | trust wording (D7) only | same |
| R1-R5 | approved | unchanged | unchanged |
Question D10:
D10 — Freeze the four switches' ends and drawing before replacing their type, and require them unchanged after?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D9 settled).
ELI10: D4 rewrites L, M, O1 and P1 in the new type. Today's tests check where
their ends land and which are pegs, against plain straights and curves, so a
wrong end would be caught. Nothing checks how a switch is DRAWN: the road
segments, their radius and which side the arc bends. D5 rewrites exactly that
code. A frozen copy taken before the change, compared after, catches any
difference in ends, polarity or drawing.
Stakes if we pick wrong: a switch could draw its arc on the wrong side, or
check overlap against the wrong outline, with every test green.
Recommendation: A because D5 changes the drawing loop and nothing pins a
switch's segments today.
Completeness: A=10/10, B=6/10
Header: Switch pins
Options:
A) Freeze, then compare (recommended)
Capture portsOf for both turns, every port's polarity and the renderGraph segments for L, M, O1 and P1 at 86e3eaa into a fixture, and assert deep equality after the rewrite. Keep the existing pins; move the polarity pin from p.ends to portPolarity. Only intended difference: D7's wording. (human: ~2h / CC: ~10min)
B) Existing pins only
Keep the pose and polarity pins; switch drawing stays unpinned through the render rewrite. (human: ~30min / CC: ~5min)

State: approved
Actual answer: A, "Freeze, then compare" (D10, 2026-10-30)
Accepted scope: before the rewrite, freeze portsOf (both turns), every port's polarity and renderGraph segments for L, M, O1, P1 at 86e3eaa into a fixture; after, deep-equal; existing pins kept, polarity pin moved from p.ends to portPolarity; only intended difference is D7's wording.
History: none

### Section 3: Tests

Framework: vitest (`bun run test`), engine tests in engine/test, app tests
beside their files (`*.test.ts`, `*.dom.test.tsx`).

```
CODE PATHS (PR A)                                        USER FLOWS
[+] portsOf(multi-road, turn)                            [+] Place an H from the palette
  |-- [GAP] listed ports, left           -> D9 walk test   |-- [GAP] ghost fits by any of 4 ends (R cycles 4) -> ghostKeys/ghostFit
  |-- [GAP] mirrored (conj), right       -> conj + H/I test |-- [GAP] F hidden for H (D8)            -> ghostKeys.test
  |-- [★★★ TESTED] switches L/M/O1/P1    switchSeeds:51    |-- [GAP] list names H's ends (D8)      -> GraphListing.test
  |      + [GAP] frozen fixture (D10)                      [+] Weld track to all four H ends
[+] portPolarity(part, i) per port                         |-- [GAP] loop through the crossing closes -> graphFeasible
  |-- [★★ TESTED] two-ended  render.test:132               [+] Correct a piece (SubmitPart)
  |-- [GAP] H1 socket/socket + peg/peg road (PR B)        |-- [GAP] straight submitted as "H" refused (D6) -> trustBoundary
[+] renderGraph: one segment per road (D5)               [+] Verdict sentence
  |-- [★★ TESTED] straights/curves  render.test:90        |-- [GAP] H-only layout says "modelled" (D7) -> switchTrust
  |-- [GAP] H: two crossing straights, ports 0-1 / 2-3
  |-- [GAP] I: arcs on both sides (PR B), mirrored
[+] overlap: same-piece roads exempt  [★★ TESTED] plankOverlap (pair skip) + [GAP] H vs a straight across it
[+] library endCount = ports.length (D6)   [GAP]
[+] trust modelled note (D7)               [★★ TESTED] switches; [GAP] H
[+] data validator (D9): every road lands exactly on its port; port 0 = entry; >= 3 ports   [GAP]
[+] chain refusal names multi-road         [★★ TESTED] switches.test:295 (kept)
[+] differential pool excludes multi-road  [★★ TESTED] differential.test:75 (filter rewritten)

COVERAGE (PR A): 6/19 paths tested today (32%) | GAPS: 13, all unit-level; 0 E2E, 0 eval
```

Required tests (PR A), each with its value card:
1. engine/test/multiRoad.test.ts, D9 walk: every built-in multi-road part,
   each road walked from its start port lands EXACTLY on its end port, port 0
   is the entry pose, at least 3 ports.
   Value: protects=each road agrees exactly with its listed end; fails_when=a port pose or road length/radius/steps is mistyped; why_new=no multi-road data exists; seam=none; no_claim=that the reproduction matches real BRIO track
2. engine/test/multiRoad.test.ts, mirror: H and L under turn 'right' equal
   the conj of turn 'left' port by port, and conj(zeta^k) = zeta^-k for k in
   0..15 with toXY giving (x, -y).
   Value: protects=a flipped piece is the exact mirror; fails_when=conj drops a sign or a coefficient; why_new=no conj exists; seam=none; no_claim=none beyond protects
3. engine/test/switchRegression.test.ts (D10): frozen 86e3eaa fixture of ports
   (both turns), polarities and segments for L, M, O1, P1, deep-equal.
   Value: protects=switch ends, polarity and drawing survive the type change; fails_when=port order, arc side or radius drifts; why_new=segments of switches are unpinned; seam=none; no_claim=nothing about pieces added after the freeze
4. engine/test/render.test.ts, add rows: H gives two straight segments
   (ports 0-1 and 2-3) crossing at the midpoint; a fixture with a right-side
   road under turn 'left' draws sweep 'right' (D5).
   Value: protects=roads drawn between their own ports with their own side; fails_when=render goes back to port 0 or piece.turn; why_new=render.test pins curves only; seam=none; no_claim=SVG path text (trackPath.test owns it)
5. engine/test/trustBoundary.test.ts, add a case (D6): a straight submission
   with id H is refused; H keeps 4 ports.
   Value: protects=a correction cannot drop ends; fails_when=endCount is hard-coded again; why_new=only the switch case is pinned; seam=none; no_claim=the submission form's own refusal
6. engine/test/switchTrust.test.ts, add a row (D7): H-only layout carries
   "This piece's geometry is modelled, not measured."; update the switch rows.
   Value: protects=the modelled note covers every multi-road piece; fails_when=the note keys on a part id list or old kind; why_new=only switches are covered; seam=none; no_claim=wording of other trust notes
7. engine/test/graphFeasible.test.ts, add rows: a straight laid across H
   (not welded) is an overlap; a loop welded through H's two roads closes
   EXACT; the existing CROSSING fixture in graphModel.test.ts switches to the
   real H part.
   Value: protects=the crossing joins verdicts like any piece; fails_when=same-piece exemption widens or a road is missing from the footprint; why_new=the fixture crossing is a test-local port list; seam=none; no_claim=physical clearance at the crossing's centre
8. app/src/ghostKeys.test.ts and GraphListing.test.ts, add rows (D8): F is
   null for H; R reads "Next end on"; H's four ends are named from its data;
   L still reads heel / straight road / curved road.
   Value: protects=names and keys come from data; fails_when=a kind branch returns; why_new=only switch wording is pinned; seam=none; no_claim=screen-reader timing

Tests made obsolete: switchSeeds.test.ts:68-74 reads `p.ends` (moves to
`portPolarity`); graphModel.test.ts:119-175 test-local crossing (replaced by
the real H).

Dispositions: T1 regression contract approved (D10); tests 1-8 are the
required proof of D5-D10 and need no further approval.

### Section 4: Performance

No issues found. `portsOf` runs per piece per solve; a multi-road piece
mirrors at most 4 ports with integer arithmetic, the same order of work as
today's `arcEnd`. The pile-up span loop is quadratic in ports PER PIECE, so 6
pairs for a crossing [measured: feasible.ts:567-573, ports per piece <= 4],
and linear in pieces as before.

### Outside voice (Codex, gpt-6-astra, completed)

Four findings, all verified by the parent reviewer against the code:
- OV1 High, app/src/layoutModel.ts:234 — `fitOptions` keys a way by where the
  ends land, not which of them are pegs (`const key = (adapter ? 'adapter|' :
  '') + own.map((p) => JSON.stringify(compose(frame, p.at)))`). A symmetric
  crossing has several ways onto one end that land its ends on the same spots
  with pegs and sockets swapped, and all but one are dropped.
- OV2 High, engine/src/graph/feasible.ts:567 — the pile-up rule counts the
  places a PIECE's free ends sit; two pieces sharing two places is a pile-up.
  Two EE double curves laid end to end, or two Y switches facing each other,
  share two places with no piece on top of another, so unwelded they are
  reported as a clash. The review wrongly called this code unchanged.
- OV3 High, plan line 86 — the Lillabo crossing measures 145 x 145 with its
  second road at x = 72.4-72.5 (mw/measured.tsv, `Cross-145.step`), off the
  whole-millimetre lattice; and the Lillabo "Y" files measure a second road at
  (40.6, 43.3) heading 135 and (83.9, 83.9) heading 90 r83.9, which is not the
  "Y of two 45 degree curves" line 86 claims. The three Lillabo pieces are not
  proven lattice-exact.
- OV4 Medium, app/src/layoutModel.ts:178 — `portCount > 1 ? { pieceId, port:
  joinBy === 0 ? 1 : 0 } : null` continues building from port 1 or 0. An H
  joined by its port 2 continues from port 0, on the other road, where port 3
  is the end straight ahead.

### R7: Ways onto an end that differ only in which ends are pegs (OV1)
Finding: OV1, High, 9/10, app/src/layoutModel.ts:234, Codex (verified).
Plan baseline: not in the plan.
Runtime evidence: the de-duplication key is landed positions plus the
adapter flag, no polarity (read at 86e3eaa).
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R7 fit key | positions + adapter flag | positions with each end's polarity + adapter flag | unchanged | bounded probe first: list H's ways with and without polarity, then decide | deferred to a TODO; H ships with ways missing |
| two-ended parts | ways as today | unchanged (a straight's turned-round way is already split by the adapter flag): pinned by the existing ghostFit tests | unchanged | unchanged | unchanged |
| R1-R6 | approved | unchanged | unchanged | unchanged | unchanged |
Question D11:
D11 — Count two ways onto an end as different when the same spots get different pegs and sockets?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D10 settled).
ELI10: When you attach a piece, R steps through every different way it can go
on. "Different" is decided by where its ends land. A crossing turned a
quarter-turn lands its ends on the same four spots, but with the pegs and
sockets in other places, so it joins the next track differently. Today those
ways are thrown away as duplicates, so some crossings can't be placed the way
the user needs.
Stakes if we pick wrong: a user who needs a socket on the left of a crossing
can never get it, and the next joint shows "can't be built".
Recommendation: A because the ways are physically different and the change
leaves every two-ended piece's R order as it is.
Completeness: A=10/10, B=4/10, C=8/10, D=4/10
Header: Fit key
Options:
A) Apply this change (recommended)
The key adds each landed end's polarity. Tests: H onto a socket offers every distinct peg/socket arrangement; ghostFit's existing R order for two-ended parts is unchanged. (human: ~1h / CC: ~10min)
B) Keep this row's current value
Ways that differ only in polarity stay merged; some crossing placements are unreachable. (human: 0 / CC: 0)
C) Investigate before choosing
Probe H's ways with and without polarity in the key, report the counts, then ask again. No change approved. (human: ~30min / CC: ~5min)
D) Defer this proposed change only
File a TODO; PR A ships H with the merged ways. (human: ~5min / CC: ~2min)

State: approved
Actual answer: A, "Apply this change" (D11, 2026-10-30)
Accepted scope: fitOptions' de-duplication key adds each landed end's polarity (adapter flag kept); tests: H onto a socket offers every distinct peg/socket arrangement; ghostFit's existing R order for two-ended parts unchanged.
History: none

### R8: The pile-up rule for pieces with several roads (OV2)
Finding: OV2, High, 8/10, engine/src/graph/feasible.ts:563-573, Codex (verified
by reading; the EE case needs the PR B data to run).
Plan baseline: Section 1 of this review said the span loop needs no change.
That was wrong; this record supersedes it.
Runtime evidence: `placesOfPiece` collects every place a piece has a free end
in, and any pair named by two pieces is a pile-up (read at 86e3eaa).
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R8 pile-up unit | per piece: any two shared free places | per ROAD: the pair of places one road's two free ends sit in; a pair named by roads of two different pieces is a pile-up | unchanged | probe first: build two EE end to end and two facing Ys, report the verdicts, then ask | TODO; PR B's EE and O/P ship with false clashes |
| two-ended parts | as today | identical by construction (one road = the piece), proven by a differential over the existing generated corpus with zero differences | as today | as today | as today |
| switch layouts | as today | may change where a piece spans two roads' ends; each changed verdict listed in the PR, overlap.ts still checks bodies | as today | as today | as today |
| R1-R7 | approved | unchanged | unchanged | unchanged | unchanged |
Question D12:
D12 — Decide "two pieces on top of each other" per road instead of per piece?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D11 settled).
ELI10: Two loose pieces that share BOTH their end spots are lying on top of
each other, and the engine reports that as a pile-up. That rule was written
when every piece had one road. A double curve has two parallel roads, so two
of them laid end to end share two spots (inner and outer) without overlapping
at all, and two Y switches facing each other do the same. They would be
reported as impossible until the user joins both. Asking it per road (do two
ROADS share both their ends?) gives the same answer for every two-ended piece
and the right one for multi-road pieces.
Stakes if we pick wrong: valid double-track and passing-loop layouts show
"can't be built" whenever their joints are open.
Recommendation: A because it is a reformulation, not a new rule: identical on
every existing two-ended layout, which a differential proves.
Completeness: A=10/10, B=3/10, C=8/10, D=4/10
Header: Pile-up rule
Options:
A) Apply this change (recommended)
Count spans per road. Differential over the existing generated corpus: zero changed verdicts on two-ended layouts; layouts with switches are diffed too and every changed one listed in the PR (a straight from a switch's straight end to its curved end stops being a pile-up and is left to the overlap check). Tests: two EE end to end, unwelded, no clash (PR B); a straight lying on L's straight road is still a pile-up (PR A). (human: ~3h / CC: ~20min)
B) Keep this row's current value
Per piece; EE end to end and facing Ys report a clash while unwelded. (human: 0 / CC: 0)
C) Investigate before choosing
Build the two cases on the current rule, report what it says, then ask again. No change approved. (human: ~1h / CC: ~10min)
D) Defer this proposed change only
TODO; PR B ships EE and O/P with the false clash. (human: ~5min / CC: ~2min)

State: approved
Actual answer: A, "Apply this change" (D12, 2026-10-30)
Accepted scope: the pile-up span count is per road (the pair of places one road's two free ends sit in; a pair named by roads of two different pieces is a pile-up); differential over the existing generated corpus with zero changed verdicts on two-ended layouts, switch layouts diffed and every change listed in the PR; tests: a straight on L's straight road is still a pile-up (PR A), two EE end to end unwelded give no clash (PR B).
History: Section 1's "no change needed" for the span loop is superseded by this record.

### R9: The three Lillabo multi-road pieces in PR B (OV3)
Finding: OV3, High, 9/10, plan line 86, Codex; parent verified in
mw/measured.tsv (scratchpad): `Cross-145.step` ports at (72.4, 72.5) and
(72.5, -72.5); `y-fmm.step` second road at (40.6, 43.3) heading 135;
`y-fmm-tt.step` a road ending at (83.9, 83.9) heading 90.
Plan baseline: D3 put the Lillabo crossing, Y and curve-plus-straight in PR B.
Runtime evidence: the crossing's half-length 72.5 is not a whole millimetre,
and the two Y files do not show "two 45 degree curves" at all.
Comparison grid (whole-candidate scope):
| Choice | Current disposition | A Include | B Defer | C Cut | D Hold |
|---|---|---|---|---|---|
| R9 Lillabo crossing, Y, curve-plus-straight | in PR B (D3) | stays in PR B, needs fractional or rounded ports | moved to the off-grid TODO from D2, to be re-measured and decided there | dropped from the plan | stop and discuss |
| PR B BRIO pieces (H1, H2, I, J, O, P, T, X, EE) | in PR B | unchanged | unchanged | unchanged | unchanged |
| R1-R8 | approved | unchanged | unchanged | unchanged | unchanged |
Question D13:
D13 — Take the three Lillabo multi-road pieces out of PR B and add them to the off-grid TODO?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D12 settled).
ELI10: D3 put a Lillabo crossing, Y and curve-plus-straight in PR B, on the
plan's word that they fit the whole-millimetre grid. The measurements say
otherwise. The crossing is 145mm, so its middle sits at 72.5mm, a half. The two
"Y" files don't show two 45 degree curves at all: one has a road ending
heading backwards, the other a 90 degree curve of about 84mm radius. I wrote
line 86 from file names, not from these numbers.
Stakes if we pick wrong: PR B either rounds a measured half millimetre without
saying so, or ships pieces whose shape nobody has checked.
Recommendation: B because the crossing hits the same half-millimetre question
D2 deferred, and the Ys need re-measuring before anyone can describe them.
Note: options differ in kind, not coverage — no completeness score.
Header: Lillabo multi
Options:
A) Include
Keep them in PR B; the crossing needs rounding 72.5 or fractional ports, and the Ys are written from files whose shape is unclear. (human: ~1 day / CC: ~1h)
B) Defer (recommended)
PR B carries the nine BRIO pieces only. The Lillabo three join D2's off-grid TODO, with the 72.5 offset and the odd Y readings written down. (human: ~10min / CC: ~3min)
C) Cut
Drop them from the plan entirely; nothing records the measurements. (human: 0 / CC: 0)
D) Hold
Stop here and discuss before deciding. (human: — / CC: —)

State: approved
Actual answer: B, "Defer" (D13, 2026-10-30)
Accepted scope: PR B carries the nine BRIO pieces only (H1, H2, I, J, O, P, T, X, EE) plus the T/X table correction; the Lillabo crossing, Y and curve-plus-straight join D2's off-grid TODO with the 72.5 offset and the Y readings recorded.
History: D3 had put the three Lillabo pieces in PR B.

### R10: Which end building continues from after a multi-road piece (OV4)
Finding: OV4, Medium, 9/10, app/src/layoutModel.ts:178, Codex (verified).
Plan baseline: not in the plan.
Runtime evidence: `portCount > 1 ? { pieceId, port: joinBy === 0 ? 1 : 0 } :
null` (read at 86e3eaa): joined by port 0, continue at 1; otherwise at 0.
Comparison grid:
| Choice | Current | A | B | C | D |
|---|---|---|---|---|---|
| R10 continue-from end | 1 if joined by 0, else 0 | the other end of the FIRST listed road through the joined end (D9's roads) | unchanged | probe the four switches and H first, then ask | TODO; H ships continuing on the wrong road |
| switches L/M/O1/P1 | heel -> 1, either road end -> 0 | identical: road 0-1 is listed first, and each road end's road leads to 0 | unchanged | unchanged | unchanged |
| R1-R9 | approved | unchanged | unchanged | unchanged | unchanged |
Question D14:
D14 — After placing a multi-road piece, continue from the far end of the road you came in on?
Project/branch/task: ChooChooCAD main, the multi-road type (D2-D13 settled).
ELI10: After you place a piece, the editor selects one of its free ends so the
next piece goes on there. The rule is "the end opposite the one you joined",
written as port 1 or port 0. On a crossing joined by its third end, that picks
the first end, on the other road, so the next piece turns a right angle. With
D9 each piece lists its roads, so "the other end of the road I came in on"
can be read straight off the data.
Stakes if we pick wrong: building through a crossing turns the user's line
90 degrees, every time.
Recommendation: A because the roads are already data (D9), and the switches
keep exactly today's choice.
Completeness: A=10/10, B=4/10, C=8/10, D=4/10
Header: Continue from
Options:
A) Apply this change (recommended)
Continue from the other end of the first listed road that contains the joined end. Tests: H joined by port 2 selects port 3; L joined by heel selects port 1, by either road end selects the heel (unchanged). (human: ~1h / CC: ~10min)
B) Keep this row's current value
Joined by 0 continues at 1, otherwise at 0; H joined by port 2 continues at port 0. (human: 0 / CC: 0)
C) Investigate before choosing
Probe the four switches and H under both rules, report, then ask. No change approved. (human: ~30min / CC: ~5min)
D) Defer this proposed change only
TODO; PR A ships H continuing on the perpendicular road. (human: ~5min / CC: ~2min)

State: approved
Actual answer: A, "Apply this change" (D14, 2026-10-30)
Accepted scope: addPiece continues from the other end of the first listed road containing the joined end; tests: H joined by port 2 selects port 3; L joined by heel selects port 1, by either road end selects the heel (unchanged).
History: none

## Decision ledger summary

Approval readiness: PASS. Checked R1 (D5), R2 (D6), R3 (D7), R4 (D8), R5
(D9), R6 (D10), R7 (D11), R8 (D12), R9 (D13), R10 (D14), each with its actual
answer above; scope answers D2, D3, D4 in the scope record; the off-grid TODO
is covered by D2 and D13's accepted scope.

## Review outputs (eng review, 2026-10-30)

### Premise table

| Premise | Claim | Receipt | Verdict |
|---|---|---|---|
| P1 | every multi-ended reproduction is exact on the lattice | plan line 62; F/G at 23.5, F1/G1 S-bend, lines 95-101 | FALSE (D2) |
| P2 | the Lillabo set has a crossing of two 145 straights, a Y of two 45 curves | plan line 86; mw/measured.tsv `Cross-145.step` 72.5, `y-fmm.step` heading 135 | FALSE (D13) |
| P3 | after the engine PR each family is data-only | plan line 69; App.tsx:794, ghostKeys.ts:58, GraphListing.tsx:67 | FALSE today, true after D8 |
| P4 | ports in a local frame make a piece rigid | engine/src/graph/model.ts:13-24, graphModel.test.ts:119 | TRUE |
| P5 | per-port polarity is needed | measured H1 (socket/socket + peg/peg) and T, plan lines 75, 79; model.ts:263 | TRUE |
| P6 | the overlap check exempts a piece's own roads | engine/src/graph/overlap.ts:279 | TRUE |

unverified=0

### NOT in scope
- F1/G1 and F/G: off-grid roads (D2), in the P2 TODO.
- The Lillabo crossing and Ys: off-grid and unclear readings (D13), same TODO.
- R/S buffer stops: a one-port kind, its own later PR (plan line 70).
- User submissions of multi-road pieces: `looksLikePart` still admits only
  straight and curve; a multi-road correction form is not planned.
- Raised multi-road pieces: the new type is flat; ramps stay straights.

### What already exists
- `portsOf` / `Port[]` (model.ts:181) already carries poses in the local
  frame; frames, feasible, assembly and levels reuse it unchanged.
- The overlap pair-skip within one piece (overlap.ts:279) already lets a
  crossing's roads cross each other.
- A test-local crossing fixture (graphModel.test.ts:119-175) already proves
  rigidity for four ports; it switches to the real H.
- `orientation`/`fitOptions` (layoutModel.ts) already handle any port count;
  only the key (D11) and the continuation (D14) change.

### Failure modes
| New path | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| multi-road data | mistyped port pose or road | D9 walk test | build fails | nothing (caught pre-merge) |
| mirror (conj) | sign error mirrors wrongly | mirror test | none at runtime | wrong drawing; caught by test |
| road drawing | arc on wrong side | D10 fixture, render rows | none at runtime | caught by test |
| correction of H | two-ended correction accepted | trustBoundary row (D6) | refused at load | built-in H kept |
| pile-up per road | a real pile-up missed | differential + L-road row | overlap.ts still checks bodies | clash still reported |
| continuation | wrong end selected | layoutModel row (D14) | user can pick any end | wrong selection, recoverable |

Critical gaps: 0.

### Worktree parallelization strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Freeze switch fixture (D10) | engine/test | — |
| Multi-road type, conj, ports, polarity, validator | engine/src/parts, engine/src/geom, engine/src/graph, engine/data | freeze |
| Render roads, pile-up per road, trust, end count | engine/src/graph, engine/src/joints, engine/data | type |
| App: names, fit key, continuation | app/src | type |
| PR B data | engine/data, engine/test | PR A merged |

Lane A: freeze -> type -> render/pile-up/trust/end count (engine).
Lane B: app changes (app/src), after the type lands in lane A.
Execution order: lane A's first two steps, then A's rest and B in parallel,
then merge; PR B after PR A merges. Conflict flag: both lanes read
engine/src/parts/schema.ts; lane B must not edit it.

## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~10min)** — engine/test — Freeze L, M, O1, P1 ports (both turns), polarities and segments at 86e3eaa
  - Surfaced by: Section 3 — R6 regression contract (D10)
  - Files: engine/test/switchRegression.test.ts, engine/test/fixtures/
  - Verify: `bun run test` green before any engine edit
- [ ] **T2 (P1, human: ~1 day / CC: ~45min)** — engine — Multi-road type replacing SwitchPart; ports with pose, polarity, name; roads; `ends` onto straight/curve; exact conj
  - Surfaced by: Scope D4, Section 1 R5 (D9), conj and per-port polarity findings
  - Files: engine/src/parts/schema.ts, engine/src/graph/model.ts, engine/src/geom/cyclotomic.ts, engine/data/switchSeeds.ts, engine/src/geom/pose.ts, engine/src/geom/fk.ts
  - Verify: T1 fixture deep-equal; D9 walk test; mirror test
- [ ] **T3 (P1, human: ~3h / CC: ~15min)** — engine/src/graph/render.ts — Draw each road between its own ports with its own side
  - Surfaced by: SC1 (D5)
  - Files: engine/src/graph/render.ts, engine/test/render.test.ts
  - Verify: H gives two crossing straights; T1 fixture unchanged
- [ ] **T4 (P1, human: ~30min / CC: ~5min)** — engine/data/library.ts — endCount from portsOf
  - Surfaced by: SC2 (D6)
  - Files: engine/data/library.ts, engine/test/trustBoundary.test.ts
  - Verify: straight submitted as H refused
- [ ] **T5 (P1, human: ~1h / CC: ~10min)** — engine/src/joints/trust.ts — Modelled note for every multi-road piece
  - Surfaced by: SC4 (D7)
  - Files: engine/src/joints/trust.ts, engine/test/switchTrust.test.ts
  - Verify: H-only layout carries the note
- [ ] **T6 (P1, human: ~3h / CC: ~20min)** — engine/src/graph/feasible.ts — Pile-up counted per road, with differential
  - Surfaced by: OV2 (D12)
  - Files: engine/src/graph/feasible.ts, engine/test/graphFeasible.test.ts, engine/test/differential.test.ts
  - Verify: zero changed verdicts on two-ended layouts; switch changes listed in the PR
- [ ] **T7 (P1, human: ~4h / CC: ~25min)** — app — End names, flip wording, palette label from data; one isMultiRoad
  - Surfaced by: SC6 (D8)
  - Files: app/src/ghostKeys.ts, app/src/GraphListing.tsx, app/src/App.tsx, app/src/SubmitPart.tsx and their tests
  - Verify: H's ends named; F hidden for H; L wording unchanged
- [ ] **T8 (P1, human: ~1h / CC: ~10min)** — app/src/layoutModel.ts — Fit key includes polarity
  - Surfaced by: OV1 (D11)
  - Files: app/src/layoutModel.ts, app/src/ghostFit.test.ts
  - Verify: H offers every peg/socket arrangement; two-ended R order unchanged
- [ ] **T9 (P1, human: ~1h / CC: ~10min)** — app/src/layoutModel.ts — Continue from the far end of the road joined
  - Surfaced by: OV4 (D14)
  - Files: app/src/layoutModel.ts, app/src/layoutModel.test.ts
  - Verify: H joined by port 2 selects 3; L unchanged
- [ ] **T10 (P1, human: ~2h / CC: ~15min)** — engine/data — The H crossing (Cactus 973 `cross_h`) and its validator pins
  - Surfaced by: D3
  - Files: engine/data/switchSeeds.ts (or a renamed multi-road seed file), engine/data/library.ts, engine/test/multiRoad.test.ts, engine/test/graphModel.test.ts
  - Verify: D9 walk test; loop through H closes EXACT
- [ ] **T11 (P2, human: ~1h / CC: ~10min)** — docs and sources — Update stale docblocks; BRIO_PIECE_TABLE rows for L/M/O1/P1
  - Surfaced by: Section 2
  - Files: schema.ts, model.ts, render.ts, pose.ts, trust.ts, engine/data/sources.ts
  - Verify: sources.test.ts green
- [ ] **T12 (P1 for PR B, human: ~1 day / CC: ~1h)** — engine/data — H1, H2, I, J, O, P, T, X, EE plus the T/X table correction; EE end-to-end no-clash test
  - Surfaced by: D3, D13, D12
  - Files: engine/data/*, engine/test/*
  - Verify: D9 walk test on all nine; `bun run test`

### Unresolved decisions
None.

### Completion summary
- Step 0: Scope Challenge — scope reduced per recommendation (D2; D13 later)
- Reality rows: 7/7 applicable rows emitted, 0 unverified premises
- Architecture Review: 3 issues found (data shape, missing conj, `ends` on the base type)
- Code Quality Review: 2 issues found
- Test Review: diagram produced, 13 gaps identified
- Performance Review: 0 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 1 item (covered by D2 and D13's approved scope)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex (gpt-6-astra), completed, 4 findings, all verified and accepted (D11-D14)
- Parallelization: 2 lanes, 1 parallel / 1 sequential
- Lake Score: 9/10 (D5-D12 and D14 picked their 10/10 option; D2 picked 8/10; D1, D3, D4 and D13 were unscored)

REALITY: premise-table finding 6 premises, 2 FALSE (lattice, Lillabo), unverified=0 docs/plan/2026-10-29-makerworld-pieces.md:62
REALITY: already-done pass git log origin/main since 2026-10-29 over the seven named files and --grep multi-road/crossing: no hits 86e3eaa
REALITY: surface-check pass the one command named, `bun run test`, exists as "test": "vitest run --config vitest.config.ts" package.json:6
REALITY: binding-decisions pass socket-to-socket stays an adapter joint and Frame.level stays optional; nothing here reintroduces an overruled default engine/src/parts/schema.ts:200-202
REALITY: numbers finding D2's "12 of 16" re-derived as 13 of 17 from the measured table; effort figures are [estimated] docs/plan/2026-10-29-makerworld-pieces.md:72-84
REALITY: deferred-asks pass owner asked for every piece; F/G, F1/G1, Lillabo multi-road and buffer stops are each deferred with a reason docs/plan/brio-TODOS.md:31
REALITY: pr-count finding plan implied about 9 PRs; D3 makes it 2 plus the later buffer-stop PR; no .gstack/ship-policy.json docs/plan/2026-10-29-makerworld-pieces.md:69

### Suppressed findings (appendix)
- (confidence 4/10) Two multi-road pieces sharing two places across DIFFERENT
  roads might still hide a real body overlap from the pile-up rule after D12;
  overlap.ts checks bodies, so it is expected to report it. Verify with the
  differential's switch diffs.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 4 | CLEAR (2026-10-23, two-layer plan; not run on this plan) | mode: SCOPE_REDUCTION, 0 critical gaps |
| Outside Review | codex (gpt-6-astra), automatic in `/plan-eng-review` | Independent 2nd opinion | 13 | completed | 4 findings, all verified, accepted as D11-D14 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 9 | ISSUES OPEN (all mapped to tasks T1-T12) | 18 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 4 | CLEAR (2026-10-23, another plan; not run on this plan) | score: 3/10 → 8/10, 12 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review phase, completed on 2026-10-30 at 86e3eaa: 4 findings (OV1 fit key, OV2 pile-up per road, OV3 Lillabo off-grid, OV4 continuation), all confirmed against the code.
- **CROSS-MODEL:** the native review missed all four outside findings, and was wrong about one: Section 1 said the pile-up loop needed no change, and OV2 showed it did. The outside review did not dispute any native finding (SC1-SC6, R5, R6).
- **VERDICT:** no review is CLEAR for this plan; Eng Review is ISSUES OPEN with every finding decided and mapped to a task — eng review required

NO UNRESOLVED DECISIONS
