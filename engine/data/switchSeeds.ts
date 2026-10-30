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
 * THE REST (`MULTI_ROAD_SEEDS`, below): H1, H2, I, J, O, P, T, X and EE,
 * each read the same way and each exact on the grid. Their sources are on
 * each part.
 *
 * WHAT IS NOT HERE. F/G, F1/G1 and the Lillabo multi-road pieces do not sit
 * on the whole-millimetre grid (TODO "Multi-road pieces that sit off the
 * whole-millimetre grid").
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

/** Where a reproduction came from, as a `DimensionSource`. */
const reproduction = (source: string, note: string): DimensionSource => ({
  status: 'unverified',
  source: `${source}, measured off the 3MF mesh on 2026-10-29`,
  note: `A 3D-print reproduction, not a measurement of the real piece. ${note}`,
});

const cactus = (file: string, note: string): DimensionSource =>
  reproduction(`MakerWorld 1001504 "Brio Train Track Replicas" by Cactus 973 (${file})`, note);

/** E's far end, 45 degrees left, at a 202 centreline: 202 * (zeta^4 - zeta^6). */
const E_LEFT: Cyc = [0, 0, 0, 0, 202, 0, -202, 0];
/** The same arc to the right: 202 * (zeta^2 - zeta^4). */
const E_RIGHT: Cyc = [0, 0, 202, 0, -202, 0, 0, 0];
/** E1's far ends, at a 110 centreline. */
const E1_LEFT: Cyc = [0, 0, 0, 0, 110, 0, -110, 0];
const E1_RIGHT: Cyc = [0, 0, 110, 0, -110, 0, 0, 0];

const CROSSING_ENDS = [
  "first road's near end",
  "first road's far end",
  "second road's near end",
  "second road's far end",
] as const;

const TURN_OVER = { label: 'Turn over', verb: 'turn it over', after: 'Turned over.' } as const;
const BEND = { label: 'Bend the other way', verb: 'bend it the other way', after: 'Now bends the other way.' } as const;

/**
 * Three-way switch: a straight road and an E arc either side, from one heel.
 * Its mirror image is itself, so it has no F; R reaches every way on.
 */
function threeWay(id: string, name: string, heel: Polarity, file: string): MultiRoadPart {
  const road = other(heel);
  return {
    id, brand: 'BRIO', kind: 'multi-road', name,
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: heel, name: 'heel', kind: 'heel' },
      { at: { pos: xy(144, 0), heading: 0 }, polarity: road, name: 'straight road' },
      { at: { pos: E_LEFT, heading: 2 }, polarity: road, name: 'curved road' },
      { at: { pos: E_RIGHT, heading: 14 }, polarity: road, name: 'other curved road' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 144 } },
      { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm: 182, arcSteps: 2, side: 'left' } },
      { from: 0, to: 3, shape: { kind: 'arc', innerRadiusMm: 182, arcSteps: 2, side: 'right' } },
    ],
    sizeLabel: 'r202',
    dimensions: cactus(file, 'Ends at (144, 0) and (142.9, +/-59.2) heading +/-45: an E either side of an A, to 0.2mm.'),
    slop: ESTIMATED_SLOP, ...PROFILE,
  };
}

/** Y switch: an E1 arc either side from one heel, no straight road. No F. */
function ySwitch(id: string, name: string, heel: Polarity, file: string): MultiRoadPart {
  const road = other(heel);
  return {
    id, brand: 'BRIO', kind: 'multi-road', name,
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: heel, name: 'heel', kind: 'heel' },
      { at: { pos: E1_LEFT, heading: 2 }, polarity: road, name: 'curved road' },
      { at: { pos: E1_RIGHT, heading: 14 }, polarity: road, name: 'other curved road' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'arc', innerRadiusMm: 90, arcSteps: 2, side: 'left' } },
      { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm: 90, arcSteps: 2, side: 'right' } },
    ],
    sizeLabel: 'r110',
    dimensions: cactus(file, 'Ends at (77.8, +/-32.2) heading +/-45: an E1 either side, to 0.2mm.'),
    slop: ESTIMATED_SLOP, ...PROFILE,
  };
}

/**
 * Every other multi-road piece found on MakerWorld that sits exactly on the
 * grid (eng review D3, PR B).
 */
export const MULTI_ROAD_SEEDS: readonly MultiRoadPart[] = [
  {
    id: 'H1', brand: 'BRIO', kind: 'multi-road', name: 'Crossing, 116',
    // One road socket to socket, the other peg to peg, as measured.
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'socket', name: CROSSING_ENDS[0] },
      { at: { pos: xy(116, 0), heading: 0 }, polarity: 'socket', name: CROSSING_ENDS[1] },
      { at: { pos: xy(58, -58), heading: 12 }, polarity: 'peg', name: CROSSING_ENDS[2] },
      { at: { pos: xy(58, 58), heading: 4 }, polarity: 'peg', name: CROSSING_ENDS[3] },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 116 } },
      { from: 2, to: 3, shape: { kind: 'straight', lengthMm: 116 } },
    ],
    sizeLabel: '116×116',
    dimensions: cactus(
      'cross_h1',
      'Ends at (116, 0) and (58, +/-58); one road two sockets, the other two pegs. 116 agrees with the piece table.',
    ),
    slop: ESTIMATED_SLOP, ...PROFILE,
  },
  {
    id: 'H2', brand: 'BRIO', kind: 'multi-road', name: 'Criss-cross',
    // The diagonal crosses the straight at its middle at 45 degrees:
    // 72 -/+ 72 * zeta^2.
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'peg', name: CROSSING_ENDS[0] },
      { at: { pos: xy(144, 0), heading: 0 }, polarity: 'socket', name: CROSSING_ENDS[1] },
      { at: { pos: [72, 0, -72, 0, 0, 0, 0, 0], heading: 10 }, polarity: 'peg', name: CROSSING_ENDS[2] },
      { at: { pos: [72, 0, 72, 0, 0, 0, 0, 0], heading: 2 }, polarity: 'socket', name: CROSSING_ENDS[3] },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 144 } },
      { from: 2, to: 3, shape: { kind: 'straight', lengthMm: 144 } },
    ],
    sizeLabel: '144×144',
    // The diagonal leans one way; turned over it leans the other.
    flip: TURN_OVER,
    dimensions: cactus(
      'criss_cross_h2',
      'Ends at (144, 0), (21.1, -50.9) and (122.9, 50.9): a 144 diagonal through the middle at 45 degrees, to 0.1mm.',
    ),
    slop: ESTIMATED_SLOP, ...PROFILE,
  },
  threeWay('I', 'Three-way switch', 'socket', 'switch_double_curved_i'),
  threeWay('J', 'Three-way switch, peg heel', 'peg', 'switch_double_curved_j'),
  ySwitch('O', 'Y switch', 'socket', 'switch_short_curved_o'),
  ySwitch('P', 'Y switch, peg heel', 'peg', 'switch_short_curved_p'),
  {
    id: 'T', brand: 'BRIO', kind: 'multi-road', name: 'T switch',
    // A 216 straight and a quarter circle at a 108 centreline: 108 * (1 + zeta^4).
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'socket', name: 'heel', kind: 'heel' },
      { at: { pos: xy(216, 0), heading: 0 }, polarity: 'peg', name: 'straight road' },
      { at: { pos: xy(108, 108), heading: 4 }, polarity: 'socket', name: 'curved road' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 216 } },
      { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm: 88, arcSteps: 4, side: 'left' } },
    ],
    sizeLabel: 'r108',
    flip: BRANCH,
    dimensions: reproduction(
      'MakerWorld 904802 "BRIO T-Switch T" by AU3D (T-Switch 216mm)',
      'Ends at (216, 0) and (108, 108) heading 90 to 0.1mm: a 108 centreline (88 inner). RyeBread ' +
        '526629 and kolar.majkl 688457 put the arc in the same place but disagree on polarity (all ' +
        "sockets; socket, socket, peg); AU3D's socket heel, peg straight and socket arc are used.",
    ),
    slop: ESTIMATED_SLOP, ...PROFILE,
  },
  {
    id: 'X', brand: 'BRIO', kind: 'multi-road', name: 'Star switch',
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'peg', name: 'heel', kind: 'heel' },
      { at: { pos: xy(216, 0), heading: 0 }, polarity: 'socket', name: 'straight road' },
      { at: { pos: xy(108, 108), heading: 4 }, polarity: 'socket', name: 'curved road' },
      { at: { pos: xy(108, -108), heading: 12 }, polarity: 'peg', name: 'other curved road' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 216 } },
      { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm: 88, arcSteps: 4, side: 'left' } },
      { from: 0, to: 3, shape: { kind: 'arc', innerRadiusMm: 88, arcSteps: 4, side: 'right' } },
    ],
    sizeLabel: 'r108',
    // Its two curved roads end differently, so turned over it is another piece.
    flip: TURN_OVER,
    dimensions: reproduction(
      'MakerWorld 795599 "Brio Compatible Switches" by Fantastic Plastic Person (X)',
      'Ends at (216, 0) and (108, +/-108) to 0.1mm: a 108 centreline (88 inner). Peg heel, socket ' +
        'straight, one curved road ending in a socket and the other in a peg.',
    ),
    slop: ESTIMATED_SLOP, ...PROFILE,
  },
  {
    id: 'EE', brand: 'BRIO', kind: 'multi-road', name: 'Large double curve',
    // Two concentric 45-degree curves 46 apart: the inner an E (202), the
    // outer at 248, starting 46 to the right (-46 * zeta^4).
    ports: [
      { at: { pos: ORIGIN, heading: 8 }, polarity: 'socket', name: 'inner start' },
      { at: { pos: E_LEFT, heading: 2 }, polarity: 'peg', name: 'inner end' },
      { at: { pos: xy(0, -46), heading: 8 }, polarity: 'socket', name: 'outer start' },
      { at: { pos: [0, 0, 0, 0, 202, 0, -248, 0], heading: 2 }, polarity: 'peg', name: 'outer end' },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'arc', innerRadiusMm: 182, arcSteps: 2, side: 'left' } },
      { from: 2, to: 3, shape: { kind: 'arc', innerRadiusMm: 228, arcSteps: 2, side: 'left' } },
    ],
    sizeLabel: 'r202/248',
    flip: BEND,
    dimensions: reproduction(
      'MakerWorld 887239 "BRIO Double Curved Track EE & EE1" by AU3D (Double Curved Track - left)',
      'Outer start at (0, -46); ends at (142.8, 59.2) and (175.4, 26.6) heading 45, centrelines 202 ' +
        'and 248, to 0.1mm. Sockets in, pegs out.',
    ),
    slop: ESTIMATED_SLOP, ...PROFILE,
  },
];
