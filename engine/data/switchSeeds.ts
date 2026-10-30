/**
 * BRIO switches, as UNVERIFIED seeds measured off 3D-print reproductions.
 *
 * READ THIS BEFORE TRUSTING ANYTHING IN HERE.
 *
 * No manufacturer figure exists for a switch's diverging leg (see
 * `SWITCH_GEOMETRY_ABSENT` in sources.ts and `CALIBRATION.md` Q6). What exists
 * are MakerWorld models that reproduce BRIO switches. On 2026-10-22 their 3MF
 * files were downloaded and the geometry read straight off the meshes: each
 * connector's end face was located, giving a position and an outward
 * direction, and the relation between two end faces gives the straight
 * length, the turn, and the radius of the arc tangent to both. Peg or socket
 * was read from whether anything protrudes past the face.
 *
 * The method was checked on pieces whose figures ARE published: on the same
 * files it recovers D 216, A 144, A1 108, A3 72, A2 54, E at a 202mm
 * centreline and E1 at 110, all to within 0.1mm.
 *
 * What the reproductions say about the switches below:
 *
 *   L, M    through road 144, diverging road 45 degrees at a 202mm centreline
 *           (an E), heel shared by both roads. The arc fitted from the far
 *           end's along-track and across-track offsets agrees to 0.15mm, so
 *           there is no heel offset to within that.
 *   O1, P1  through road 108, diverging road 45 degrees at about 110mm (an
 *           E1). The two fits are 109.3 and 110.2, so the far end sits about
 *           0.2mm off a true E1 arc.
 *
 * The through lengths and inner radii also agree with woodenrailway.info's
 * piece table (`BRIO_PIECE_TABLE` in sources.ts: L/M 144 and 182, O1/P1 108
 * and 90). The ARC and the HEEL OFFSET come from the reproductions alone.
 *
 * WHY THIS IS `unverified` AND NOT `community`. These are one designer's model
 * (Cactus 973). A reproduction is a copy of the part, not a measurement of
 * it, and a designer who assumed "switch = A plus E" would have drawn exactly
 * these files, so their agreement with the catalogue may be circular rather
 * than confirmation. A user who measures a real switch submits the figure
 * under the same id, and that overrides the seed (`resolveLibrary`).
 *
 * Each switch is a multi-road piece (schema.ts `MultiRoadPart`): its three
 * ends are listed, heel 0, straight road 1, curved road 2, the numbering the
 * old switch kind used, so every saved layout's joints still name the same
 * ends (eng review D4; switchRegression.test.ts holds them to commit
 * 86e3eaa).
 *
 * THE H CROSSING (eng review D3) comes from the same Cactus 973 set,
 * `cross_h`: two 108 straights crossing at both midpoints at 90 degrees, ends
 * read at (108, 0), (54, -54) and (54, 54) to 0.1mm, peg at the start of each
 * road and socket at its end. The 108 agrees with A1.
 *
 * WHAT IS NOT HERE YET. H1, H2, I/J, O/P, T, X and EE were measured and fit
 * this kind; they arrive in the next change. F/G, F1/G1 and the Lillabo
 * multi-road pieces do not sit on the whole-millimetre grid (TODO "Multi-road
 * pieces that sit off the whole-millimetre grid").
 */

import type { Cyc } from '../src/geom/cyclotomic.js';
import type { DimensionSource, MultiRoadPart, Polarity, SlopBudget } from '../src/parts/schema.js';

/** Same placeholder as every other part. Nobody has measured a switch joint. */
const ESTIMATED_SLOP: SlopBudget = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated',
};

const REPRODUCTION: DimensionSource = {
  status: 'unverified',
  source:
    'MakerWorld 1001504 "Brio Train Track Replicas" by Cactus 973 (switch_curved_l, ' +
    'switch_curved_m, switch_short_curved_o1, switch_short_curved_p1), measured off ' +
    'the 3MF meshes on 2026-10-22',
  note:
    'A 3D-print reproduction, not a measurement of a real switch. Through length and ' +
    'radius agree with the woodenrailway.info piece table; the 45-degree arc and the ' +
    'shared heel come only from the reproduction. Upgrade when someone measures a ' +
    'real switch (CALIBRATION.md Q6).',
};

const PROFILE = {
  heightMm: 0,
  gaugeWidthMm: 26,
  plankWidthMm: 40,
  plankThicknessMm: 12,
  grooveWidthMm: 6,
} as const;

const ORIGIN: Cyc = [0, 0, 0, 0, 0, 0, 0, 0];
/** A point x along the piece and y across it, in whole millimetres. */
const xy = (x: number, y: number): Cyc => [x, 0, 0, 0, y, 0, 0, 0];

const BRANCH = {
  label: 'Branch to the other side',
  verb: 'branch it to the other side',
  after: 'Now branches to the other side.',
} as const;

const other = (p: Polarity): Polarity => (p === 'peg' ? 'socket' : 'peg');

/**
 * A curved switch: a straight road and a 45-degree arc from one heel, both
 * roads ending the opposite way to the heel (pegs on both with a socket heel,
 * or the reverse), which is what every reproduction measured shows.
 *
 * `curvedEnd` is the arc's far end written out, r * (zeta^4 - zeta^6) for a
 * centreline r, so the data states the measured point and the road check in
 * multiRoad.test.ts has something to disagree with.
 */
function curvedSwitch(
  id: string,
  name: string,
  heel: Polarity,
  throughMm: number,
  innerRadiusMm: number,
  curvedEnd: Cyc,
): MultiRoadPart {
  const road = other(heel);
  return {
    id, brand: 'BRIO', kind: 'multi-road', name,
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: heel, name: 'heel', kind: 'heel' },
      { at: { pos: xy(throughMm, 0), heading: 0 }, polarity: road, name: 'straight road' },
      { at: { pos: curvedEnd, heading: 2 }, polarity: road, name: 'curved road' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: throughMm } },
      { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm, arcSteps: 2, side: 'left' } },
    ],
    sizeLabel: `r${innerRadiusMm + PROFILE.plankWidthMm / 2}`,
    flip: BRANCH,
    dimensions: REPRODUCTION, slop: ESTIMATED_SLOP, ...PROFILE,
  };
}

export const SWITCH_SEEDS: readonly MultiRoadPart[] = [
  // Socket heel, pegs on both roads: switch_curved_l. E arc, centreline 202.
  curvedSwitch('L', 'Curved switch', 'socket', 144, 182, [0, 0, 0, 0, 202, 0, -202, 0]),
  // Peg heel, sockets on both roads: switch_curved_m.
  curvedSwitch('M', 'Curved switch, peg heel', 'peg', 144, 182, [0, 0, 0, 0, 202, 0, -202, 0]),
  // switch_short_curved_o1 and _p1. E1 arc, centreline 110.
  curvedSwitch('O1', 'Short curved switch', 'socket', 108, 90, [0, 0, 0, 0, 110, 0, -110, 0]),
  curvedSwitch('P1', 'Short curved switch, peg heel', 'peg', 108, 90, [0, 0, 0, 0, 110, 0, -110, 0]),
];

const CROSSING_SOURCE: DimensionSource = {
  status: 'unverified',
  source:
    'MakerWorld 1001504 "Brio Train Track Replicas" by Cactus 973 (cross_h), ' +
    'measured off the 3MF mesh on 2026-10-29',
  note:
    'A 3D-print reproduction, not a measurement of a real crossing. Ends at (108, 0), ' +
    '(54, -54) and (54, 54) to 0.1mm; each road runs peg to socket. Upgrade when ' +
    'someone measures a real H.',
};

/**
 * THE H CROSSING: two 108 straights crossing at their midpoints, at 90
 * degrees. Its mirror image is the same crossing turned a quarter, so it
 * has no F (`flip` absent); R reaches every way it goes on.
 */
export const CROSSING_SEEDS: readonly MultiRoadPart[] = [
  {
    id: 'H', brand: 'BRIO', kind: 'multi-road', name: 'Crossing',
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'peg', name: "first road's near end" },
      { at: { pos: xy(108, 0), heading: 0 }, polarity: 'socket', name: "first road's far end" },
      { at: { pos: xy(54, -54), heading: 12 }, polarity: 'peg', name: "second road's near end" },
      { at: { pos: xy(54, 54), heading: 4 }, polarity: 'socket', name: "second road's far end" },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 108 } },
      { from: 2, to: 3, shape: { kind: 'straight', lengthMm: 108 } },
    ],
    sizeLabel: '108×108',
    dimensions: CROSSING_SOURCE, slop: ESTIMATED_SLOP, ...PROFILE,
  },
];
