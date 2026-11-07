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

import type { DecorBarrier, DecorCanopy, DecorShape, DecorSlab, DecorVault, DecorWheel, DimensionSource, Paint } from '../src/parts/schema.js';

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
 * THE LEVEL CROSSING (plan T3; re-measured for detail, 2026-11-05, owner:
 * correct the boxes), read off 3MF 681643 and its separate parts: the
 * printed crossing (HP) with a barrier at two opposite corners. Each stands
 * on a round base 20 across and 12 tall (track height), its centre 38 along
 * and 36.5 across from where the roads cross; a 10 square post rises from
 * it to 31, standing 3.8 further out along the piece, forked at the top for
 * the arm's hinge at 23.8. The arm: a 13.7 hinge disc, then a bar 8 wide and
 * 4.4 thick reaching 100 from the hinge, painted in diagonal stripes whose
 * edges are 8 apart. The arms are drawn raised (open) and are not solid: a
 * lowered arm is a toy's moving part, not wood a layout is planned around.
 * Which way the bar's wide face turns is estimated.
 */
const barrier = (x: number, y: number, out: 1 | -1): DecorBarrier => ({
  kind: 'barrier', atMm: [x, y],
  base: { diameterMm: 20, topMm: 12 },
  post: { sizeMm: 10, topMm: 31, offsetMm: out * 3.8 },
  arm: { hingeMm: 23.8, lengthMm: 100, widthMm: 8, thickMm: 4.4, discMm: 13.7, stripesMm: Array.from({ length: 10 }, (_, k) => 14.8 + 8 * k) },
});

/*
 * THE TUNNEL'S STONEWORK (detail plan 2026-11-05, owner: every joint), read
 * off 3MF 607215: a grid of joints over its whole outside, rings every 12.94
 * along from 8.1, courses every 5.76 up each wall from 1.5, and around the
 * arch every 13.2 degrees either side of the crown. Which end of the shell
 * the first ring is nearer is estimated (8.1 from one end, 10.75 from the
 * other).
 */
const STONES = {
  ringsMm: Array.from({ length: 15 }, (_, k) => 8.1 + 12.94 * k),
  wallMm: Array.from({ length: 11 }, (_, k) => 1.5 + 5.76 * k),
  archDeg: Array.from({ length: 13 }, (_, k) => 90 + 13.2 * (k - 6)),
};

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


/*
 * THE METRO PIECES (owner's photos 2026-11-07: three of the tunnel and two
 * of the station from above on millimetre paper, lying on their sides and
 * end-on, and two of the station standing, end-on and from the front). Both
 * are a long straight (D, 216) with a dark grey portal over each end, the
 * same on both (owner): a round ring on square feet, 80 wide and 80 tall,
 * its opening 62 across, 18 along the track, the two 203 apart outside.
 *
 *   seen along the track          tunnel: a red tube between the portals,
 *     ___      ______             66 wide and 72 tall, ribbed, an M sign on
 *    /   \    /  roof \           its side
 *   | ( ) |  |  o      )         station: a building on the right, round
 *   |_|=|_|  |__|______|         beech ends (a circle of 49 over straight
 *   portal   platform  wall      sides, a hole bored through), a dark
 *                                 barrel roof down to a back wall, a white
 *   platform 22 high, posters, doors and benches on the back wall inside,
 *   a red band and the M sign along the roof's front edge.
 *
 * READ, NOT MEASURED. Lengths and widths are the top views', each edge
 * scaled for its height from a camera 756 above the paper (solved from the
 * reference straight's top); the cross-sections are the end-on photos'
 * proportions, scaled by the portal's width. Heights within about 5mm, the
 * station's inside within about 10 (read across its depth).
 */
const RED: Paint = { fill: '--paint-red', line: '--ink' };
const METRO: Paint = { fill: '--paint-metro', line: '--paper' };
const WHITE: Paint = { fill: '--paper', line: '--ink' };
/** The dark inside of an opening (the station's roof slots). */
const SHADOW: Paint = { fill: '--ink', line: '--paper' };
const BEECH: Paint = { fill: '--track-fill', line: '--ink-soft' };
/** The portals: their outer faces 203 apart, centred on the 216 track; each 18 along. */
const PORTAL_FROM = 6.5;
const PORTAL_LEN = 18;
const portal = (x: number): DecorVault => ({ kind: 'vault', atMm: [x, 0], lengthMm: PORTAL_LEN, widthMm: 80, wallMm: 9, springMm: 40, topMm: 80, noun: 'portal', paint: METRO });
/*
 * Each portal's walls flare out at the floor to the track's end (the side
 * photo): drawn as a foot under each wall, 25 tall, from the portal's outer
 * face out to the end.
 */
const FOOT_TOP = 25;
const feet = (outer: number, out: 1 | -1): DecorSlab[] =>
  [1, -1].map((side) => ({ kind: 'slab', atMm: [outer + (out * PORTAL_FROM) / 2, side * 35.5], lengthMm: PORTAL_FROM, widthMm: 9, bottomMm: 0, topMm: FOOT_TOP, noun: 'portal', paint: METRO }));
const portals = [portal(PORTAL_FROM + PORTAL_LEN / 2), portal(216 - PORTAL_FROM - PORTAL_LEN / 2), ...feet(PORTAL_FROM, -1), ...feet(216 - PORTAL_FROM, 1)];
/** Between the portals. */
const INNER_FROM = PORTAL_FROM + PORTAL_LEN;
const INNER_LEN = 216 - 2 * INNER_FROM;
const flat = (x: number, y: number, l: number, w: number, bottomMm: number, topMm: number, noun: string, paint: Paint, solid = true): DecorSlab =>
  ({ kind: 'slab', atMm: [x, y], lengthMm: l, widthMm: w, bottomMm, topMm, noun, paint, ...(solid ? {} : { solid: false as const }) });
/** An M sign: a red disc `proud` thick with a white face, facing across the piece from `y` (outward: `out` = +1 to the left, -1 to the right). */
const sign = (x: number, y: number, out: 1 | -1, centreMm: number, diameterMm: number, noun: string, proud = 2): DecorWheel[] => [
  { kind: 'wheel', atMm: [x, y + (out * proud) / 2], centreMm, diameterMm, thickMm: proud, noun, paint: RED },
  { kind: 'wheel', atMm: [x, y + out * (proud + 0.5)], centreMm, diameterMm: diameterMm * 0.7, thickMm: 1, noun, paint: WHITE },
];

/*
 * The station's shell, seen along the track: the round ends' circle, just
 * inside them (52 round (-82, 53)), from its front edge where the ends are
 * cut flat, 41 from the track's centre and 85 up, over the top and down to
 * the back (-134), on a back wall to the floor. From above it covers the
 * platform (the top view: owner, 2026-11-07, "the top doesn't look quite
 * right" when it stopped at 56 from the track).
 */
const SHELL = { across: -82, z: 53, r: 52, front: -41 } as const;
const arc = (r: number, fromDeg: number, toDeg: number, steps: number): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    return [SHELL.across + r * Math.cos(a), SHELL.z + r * Math.sin(a)];
  });
/** Where the roof's front edge is: on the circle over the round ends' flat cut. */
const FRONT_DEG = (Math.acos((SHELL.front - SHELL.across) / SHELL.r) * 180) / Math.PI;
/** The front edge's height: 85. */
const FRONT_Z = SHELL.z + SHELL.r * Math.sin((FRONT_DEG * Math.PI) / 180);
/** Along the station inside its round ends (each 15 thick, flush with the portals' outer faces). */
const END = 15;
const HALL_FROM = PORTAL_FROM + END;
const HALL_LEN = 216 - 2 * HALL_FROM;
/** The doors, across the middle of the back wall. */
const DOORS = { from: 77, to: 131 };
/*
 * Each round end (the end-on photo): a beech disc 106 across standing on the
 * floor, its centre 82 to the right of the track's, cut flat 41 from the
 * track's centre where the portal stands against it; a hole 27 bored through
 * it, chamfered to 51. Drawn only, like every wheel; a box the disc's size,
 * solid and not drawn, keeps the end in the clash check and in 2D.
 */
const DISC = { across: -82, r: 53, outer: -135, cut: -41 } as const;
const roundEnd = (x: number): DecorShape[] => [
  { kind: 'wheel', axis: 'along', atMm: [x, DISC.across], centreMm: DISC.r, diameterMm: 2 * DISC.r, thickMm: END, chordMm: DISC.cut - DISC.across, ringsMm: [27, 51], noun: 'station', paint: BEECH },
  { kind: 'slab', atMm: [x, (DISC.outer + DISC.cut) / 2], lengthMm: END, widthMm: DISC.cut - DISC.outer, bottomMm: 0, topMm: 2 * DISC.r, drawn: false, noun: 'station', paint: BEECH },
];
/** An M sign lying near the top of the barrel, where the roof is all but flat: a red disc with a white face, its bottom at `z`. */
const roofSign = (x: number, y: number, z: number, diameterMm: number): DecorWheel[] => [
  { kind: 'wheel', axis: 'up', atMm: [x, y], centreMm: z + 2, diameterMm, thickMm: 4, noun: 'sign', paint: RED },
  { kind: 'wheel', axis: 'up', atMm: [x, y], centreMm: z + 4.5, diameterMm: diameterMm * 0.7, thickMm: 1, noun: 'sign', paint: WHITE },
];
/*
 * The opening in the roof's top over the doors (the top view): a raised
 * dark frame 70 along and 28 deep on the roof's front edge, a little over
 * it, round two slots split by a bar along it.
 */
const ROOF_SLOTS = { along: 70, from: -66, to: -38, top: 104 } as const;
const shell = (r: number, fromDeg: number, x: number, l: number, thickMm: number, paint: Paint, noun: string): DecorCanopy =>
  ({ kind: 'canopy', alongMm: x, lengthMm: l, sectionMm: arc(r, fromDeg, 180, 12), thickMm, lipMm: 0, noun, paint });

export const DECORATED_SEEDS: readonly DecoratedSpec[] = [
  {
    id: 'LC', name: 'Level crossing', base: 'HP',
    decor: [barrier(113, 36.5, 1), barrier(37, -36.5, -1)],
    dimensions: {
      status: 'unverified',
      source: 'a printed design, measured off the 3MF meshes on 2026-11-05 (first on 2026-11-03, when each post was read as one 10 square box); which way the arm faces estimated',
      note: 'Barriers at two opposite corners, their round bases 20 across and 12 tall, 38 along and 36.5 across from the crossing point; posts 10 square to 31, 3.8 further out; arms 100 from a hinge at 23.8, 8 wide and 4.4 thick, striped, drawn raised.',
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
    decor: [{ kind: 'vault', atMm: [108, 0], lengthMm: 200, widthMm: 51, wallMm: 6, springMm: 60, topMm: 85.5, noun: 'tunnel', joints: STONES }],
    dimensions: {
      status: 'unverified',
      source: 'a printed design, measured off the 3MF mesh on 2026-11-03, its stone joints on 2026-11-05; which end the joints start from estimated',
      note: 'A 200 shell, 51 wide outside with 6 walls (39 inside), straight to 60, arched to 85.5; 79.5 from the floor to the underside of the arch. Stone joints every 12.94 along, every 5.76 up the walls, every 13.2 degrees around the arch.',
    },
  },
  /*
   * THE METRO TUNNEL: the long straight under a red tube 66 wide and 72
   * tall (walls 3 thick, straight to 39, then round), its ribs every 23.9,
   * between the two portals; in its middle a raised collar 38 round a dark
   * hole 30 across in its roof, and an M sign 22 across standing 6 proud on each
   * side (from above they read as two stubs).
   */
  {
    id: 'MT', name: 'Metro tunnel', base: 'D',
    decor: [
      ...portals,
      { kind: 'vault', atMm: [108, 0], lengthMm: INNER_LEN, widthMm: 66, wallMm: 3, springMm: 39, topMm: 72, noun: 'tunnel', paint: RED,
        joints: { ringsMm: Array.from({ length: 6 }, (_, k) => ((k + 1) * INNER_LEN) / 7), wallMm: [], archDeg: [] } },
      { kind: 'wheel', axis: 'up', atMm: [108, 0], centreMm: 71, diameterMm: 38, thickMm: 8, ringsMm: [30], noun: 'tunnel', paint: RED },
      // The hole itself, dark, just over the collar's top.
      { kind: 'wheel', axis: 'up', atMm: [108, 0], centreMm: 75.2, diameterMm: 30, thickMm: 0.4, noun: 'tunnel', paint: SHADOW },
      ...sign(108, 33, 1, 32, 22, 'sign', 6),
      ...sign(108, -33, -1, 32, 22, 'sign', 6),
    ],
    dimensions: {
      status: 'unverified',
      source: "the owner's photos of a real one, 2026-11-07: lengths and widths read off the top view with each edge's height allowed for, the cross-section off the end-on photos scaled by the portal",
      note: 'A long straight under a red tube 167 long, 66 wide and 72 tall, ribbed, between two portals 18 along, 80 wide and 80 tall with a 62 opening; the portals 203 apart outside. Heights within about 5mm; a ruler would settle them.',
    },
  },
  /*
   * THE METRO STATION: the long straight between the portals, and on its
   * right the station: round beech ends 15 thick (a hole 27 bored through,
   * chamfered to 51), the dark shell from its front edge at 85 over to the
   * back wall, the red band under that edge and the M sign over it, the
   * white platform 22 high with its red edge, and on the back wall inside
   * two posters, the double doors and two benches; outside, the doors again
   * curving up over the roof to its frame, and the red knob that slides
   * them, low on the back, two M signs near
   * the top of the back, and the opening in the roof's top over the doors.
   * The doors' windows are not drawn. F puts it on the left.
   */
  {
    id: 'MS', name: 'Metro station', base: 'D', oneSided: 'station',
    decor: [
      ...portals,
      ...roundEnd(PORTAL_FROM + END / 2),
      ...roundEnd(216 - PORTAL_FROM - END / 2),
      flat(108, -131, HALL_LEN, 6, 0, SHELL.z, 'station', METRO),
      shell(SHELL.r, FRONT_DEG, 108, HALL_LEN, 6, METRO, 'roof'),
      flat(108, SHELL.front - 1.5, HALL_LEN, 3, FRONT_Z - 8, FRONT_Z, 'roof', RED, false),
      ...sign(108, SHELL.front, 1, FRONT_Z + 8, 16, 'sign'),
      flat(108, -76, INNER_LEN, 104, 0, 22, 'platform', WHITE),
      flat(108, -27.5, INNER_LEN, 2, 22, 22.4, 'platform', RED, false),
      // Inside, on the back wall: posters, the doors, benches with their backs.
      flat(48.5, -127.5, 32, 1, 54, 78, 'poster', WHITE, false),
      flat(148.5, -127.5, 32, 1, 54, 78, 'poster', WHITE, false),
      flat((DOORS.from + 104) / 2, -127.25, 104 - DOORS.from - 0.5, 1.5, 24, 72, 'doors', RED, false),
      flat((104 + DOORS.to) / 2, -127.25, DOORS.to - 104 - 0.5, 1.5, 24, 72, 'doors', RED, false),
      ...[47, 160].flatMap((x) => [flat(x, -121, 45, 10, 33, 39, 'bench', RED, false), flat(x, -126.5, 45, 2, 39, 50, 'bench', RED, false)]),
      // Outside: the doors on the wall and up the curve, and the knob.
      flat((DOORS.from + DOORS.to) / 2, -134.75, DOORS.to - DOORS.from, 1.5, 20, SHELL.z, 'doors', RED, false),
      // A curved sliding panel: from the roof frame's back edge, over the top, down to the wall.
      shell(SHELL.r + 0.8, (Math.acos((ROOF_SLOTS.from - SHELL.across) / SHELL.r) * 180) / Math.PI, (DOORS.from + DOORS.to) / 2, DOORS.to - DOORS.from, 1, RED, 'doors'),
      { kind: 'wheel', atMm: [108, -137], centreMm: 12, diameterMm: 10, thickMm: 4, noun: 'knob', paint: RED },
      // Outside, near the top of the barrel's back: two M signs, 22 across.
      ...roofSign(44, -96, 101, 22),
      ...roofSign(168, -96, 101, 22),
      // The opening in the roof's top, its frame and its two dark slots.
      flat(108, (ROOF_SLOTS.from + ROOF_SLOTS.to) / 2, ROOF_SLOTS.along, ROOF_SLOTS.to - ROOF_SLOTS.from, FRONT_Z - 1, ROOF_SLOTS.top, 'roof', METRO, false),
      flat(108, -58, ROOF_SLOTS.along - 8, 10, ROOF_SLOTS.top - 3, ROOF_SLOTS.top + 0.2, 'roof', SHADOW, false),
      flat(108, -46, ROOF_SLOTS.along - 8, 10, ROOF_SLOTS.top - 3, ROOF_SLOTS.top + 0.2, 'roof', SHADOW, false),
    ],
    dimensions: {
      status: 'unverified',
      source: "the owner's photos of a real one, 2026-11-07: lengths and widths read off the top view with each edge's height allowed for, the cross-section off the end-on photo scaled by the portal, the inside off the front photo",
      note: 'A long straight between two portals 80 wide and 80 tall, 203 apart outside; on its right a station 203 long: round beech ends (a circle of 49 round 57 up over straight sides), a dark roof following the round ends from their flat cut (85 up) to a back wall 134 across, a platform 22 high, posters, doors and benches inside. Heights within about 5mm, the inside within about 10; a ruler would settle them.',
    },
  },
];
