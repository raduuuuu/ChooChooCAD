/**
 * DECORATED PIECES (decorated-pieces plan 2026-11-03, CEO D2, eng D1/D2):
 * real pieces that work exactly like a standard part, with decoration on
 * them. Each names the built-in part whose track it has (`base`) and its
 * own decoration, measured from a printable model; the library builds the
 * full part from the two (library.ts `deriveDecorated`). Nothing here
 * restates the base's ends, length or joint give.
 *
 * The pieces themselves arrive one at a time (plan tasks T3-T5).
 */

import type { DecorShape, DecorSlab, DimensionSource } from '../src/parts/schema.js';

export interface DecoratedSpec {
  readonly id: string;
  readonly name: string;
  /** The built-in part whose track this piece has. */
  readonly base: string;
  readonly decor: readonly DecorShape[];
  /** Where the DECORATION's figures come from; the track's are the base's. */
  readonly dimensions: DimensionSource;
  /** A catalogue number, only for a verified match of a real piece (CEO D3). */
  readonly partNumber?: string;
  /**
   * A one-sided decoration's noun ("platform"): F puts it on the other side
   * of the track, the ends unchanged (eng D5, design 5A).
   */
  readonly oneSided?: string;
}

/*
 * THE LEVEL CROSSING (plan T3), read off 3MF 681643: the printed crossing
 * (HP) with a barrier post at two opposite corners, 38 along and 36.5 across
 * from where the roads cross, each 10 square and 31 tall, and a 107 arm on
 * each. The arms are drawn raised (open) and are not solid: a lowered arm
 * is a toy's moving part, not wood a layout is planned around.
 */
const post = (x: number, y: number): DecorSlab => ({ kind: 'slab', atMm: [x, y], lengthMm: 10, widthMm: 10, bottomMm: 0, topMm: 31, noun: 'barrier post' });
const arm = (x: number, y: number): DecorSlab => ({ kind: 'slab', atMm: [x, y], lengthMm: 6, widthMm: 6, bottomMm: 31, topMm: 132, solid: false, noun: 'barrier' });

/*
 * THE STATION STRAIGHT (plan T4; re-measured for the detail pilot,
 * docs/plan/2026-11-05-rich-graphics.md, owner B1), read off 3MF 1995429 and
 * its assembly guide: a medium straight (A, 144) whose platform clips to one
 * side by two dowels. On that side, from the plank's edge (20 across): the
 * platform, 144 by 104 and 16 tall, with its street stairs (79 by 22) beyond
 * it; on the platform, the station building (one `station` shape: hall,
 * barrel roof, clock tower and cap, sign, lines). The first reading (2026-11-03)
 * took the roof part for the hall, so the hall was 47 tall and the roof
 * stopped at 100; the walls are 65 parts seated 5 into the platform, and
 * the roof is a barrel on top of them. Where the hall stands on the platform
 * and which way its parts face are read from the designer's photos, so they
 * are estimated. Drawn on the right of the piece as it runs from its socket;
 * F puts it on the other side.
 */
const slab = (x: number, y: number, l: number, w: number, bottomMm: number, topMm: number, noun: string): DecorSlab =>
  ({ kind: 'slab', atMm: [x, y], lengthMm: l, widthMm: w, bottomMm, topMm, noun });

export const DECORATED_SEEDS: readonly DecoratedSpec[] = [
  {
    id: 'LC', name: 'Level crossing', base: 'HP',
    decor: [post(113, 36.5), post(37, -36.5), arm(113, 36.5), arm(37, -36.5)],
    dimensions: {
      status: 'unverified',
      source: 'a printed design, measured off the 3MF mesh on 2026-11-03',
      note: 'Barrier posts 10 square and 31 tall at two opposite corners, 38 along and 36.5 across from the crossing point; arms 107 long, drawn raised.',
    },
  },
  {
    id: 'SS', name: 'Station straight', base: 'A', oneSided: 'platform',
    decor: [
      slab(72, -72, 144, 104, 0, 16, 'platform'),
      slab(72, -135, 79, 22, 0, 14, 'stairs'),
      {
        kind: 'station',
        atMm: [72, -85],
        hall: { lengthMm: 140, widthMm: 69, wallMm: 5, bottomMm: 16, topMm: 76 },
        openings: [
          { side: 1, fromMm: -60, toMm: 19, topMm: 64 },
          { side: -1, fromMm: -23, toMm: 19, topMm: 64 },
        ],
        roof: { lengthMm: 144, widthMm: 78, baseMm: 5, radiusMm: 31, topMm: 123 },
        vents: [
          { atMm: [-55, 9.5], sizeMm: 14, topMm: 123 },
          { atMm: [54, -18], sizeMm: 10, topMm: 116 },
        ],
        tower: { atMm: [0, 19], sizeMm: 40, bottomMm: 81, topMm: 136 },
        cap: [
          { sizeMm: 50, bottomMm: 131, topMm: 139 },
          { sizeMm: 40, bottomMm: 139, topMm: 144 },
          { sizeMm: 30, bottomMm: 144, topMm: 151 },
        ],
        clock: { sizeMm: 30, centreMm: 106.5, recessMm: 3 },
        sign: { fromMm: 27, toMm: 62, bottomMm: 33, topMm: 58 },
        lines: [{ acrossMm: 57, lengthMm: 138.8, widthMm: 3.8, heightMm: 16 }],
      },
    ],
    dimensions: {
      status: 'unverified',
      source: "a printed design, measured off the 3MF meshes and its assembly guide on 2026-11-05 (first on 2026-11-03, when the hall was read off the roof part); the hall's place on the platform, which way its parts face, and the sign's and lines' places estimated from the designer's photos",
      note: 'Platform 144 by 104, 16 tall; stairs 79 by 22. Hall walls 140 by 69, 5 thick, from the platform (16) to 76, open through both long walls (79 and 42 wide, 48 tall from the platform). Roof 144 by 78: a 5 slab under a half-round barrel of 31, to 114, vents to 123. Clock tower 40 square from 81 to 136 under a stepped cap 50, 40 and 30 to 151; its round clock is drawn square (design DR7).',
    },
  },
  /*
   * THE TUNNEL STRAIGHT (plan T5), read off 3MF 607215: a long straight (D,
   * 216) under a 200 tunnel shell standing on the floor astride the plank,
   * centred on it. The shell is 51 wide outside, its walls 6 thick (39
   * between them), straight to 60, then a round arch to 85.5 outside: the
   * opening is 79.5 from the floor to the arch's underside.
   */
  {
    id: 'TT', name: 'Tunnel straight', base: 'D',
    decor: [{ kind: 'vault', atMm: [108, 0], lengthMm: 200, widthMm: 51, wallMm: 6, springMm: 60, topMm: 85.5, noun: 'tunnel' }],
    dimensions: {
      status: 'unverified',
      source: 'a printed design, measured off the 3MF mesh on 2026-11-03',
      note: 'A 200 shell, 51 wide outside with 6 walls (39 inside), straight to 60, arched to 85.5; 79.5 from the floor to the underside of the arch.',
    },
  },
];
