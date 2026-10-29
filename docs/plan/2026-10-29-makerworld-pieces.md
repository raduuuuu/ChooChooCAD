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
| X (star) | 216 straight plus 90° arcs at 108 each side | peg heel, socket on all three roads (Fantastic Plastic Person) | 795599 |
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
