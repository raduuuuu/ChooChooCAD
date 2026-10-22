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
 * WHAT IS NOT HERE. The other switches found on MakerWorld do not fit
 * `SwitchPart`, which is one straight road and one diverging arc from a heel:
 *
 *   I, J     three-way (straight plus an E either side): four ends
 *   O, P     Y switch (an E1 either side, no straight road)
 *   F, G     parallel offset, 47mm apart over 150 (Isaxon)
 *   F1, G1   parallel offset, 46mm apart over 144 or 147 (AU3D)
 *
 * Each needs a part kind the schema does not have yet.
 */

import type { DimensionSource, PartEnds, SlopBudget, SwitchPart } from '../src/parts/schema.js';

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

/** Socket at the heel, pegs on both roads: switch_curved_l and _o1. */
const SOCKET_HEEL: PartEnds = { start: 'socket', end: 'peg' };
/** Peg at the heel, sockets on both roads: switch_curved_m and _p1. */
const PEG_HEEL: PartEnds = { start: 'peg', end: 'socket' };

const PROFILE = {
  heightMm: 0,
  gaugeWidthMm: 26,
  plankWidthMm: 40,
  plankThicknessMm: 12,
  grooveWidthMm: 6,
} as const;

export const SWITCH_SEEDS: readonly SwitchPart[] = [
  {
    id: 'L', brand: 'BRIO', kind: 'switch', name: 'Curved switch',
    throughLengthMm: 144, arcSteps: 2, innerRadiusMm: 182,
    dimensions: REPRODUCTION, slop: ESTIMATED_SLOP, ends: SOCKET_HEEL, ...PROFILE,
  },
  {
    id: 'M', brand: 'BRIO', kind: 'switch', name: 'Curved switch, peg heel',
    throughLengthMm: 144, arcSteps: 2, innerRadiusMm: 182,
    dimensions: REPRODUCTION, slop: ESTIMATED_SLOP, ends: PEG_HEEL, ...PROFILE,
  },
  {
    id: 'O1', brand: 'BRIO', kind: 'switch', name: 'Short curved switch',
    throughLengthMm: 108, arcSteps: 2, innerRadiusMm: 90,
    dimensions: REPRODUCTION, slop: ESTIMATED_SLOP, ends: SOCKET_HEEL, ...PROFILE,
  },
  {
    id: 'P1', brand: 'BRIO', kind: 'switch', name: 'Short curved switch, peg heel',
    throughLengthMm: 108, arcSteps: 2, innerRadiusMm: 90,
    dimensions: REPRODUCTION, slop: ESTIMATED_SLOP, ends: PEG_HEEL, ...PROFILE,
  },
];
