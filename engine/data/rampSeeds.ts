/**
 * The ascending track, the one part that changes level (two-layer plan,
 * docs/plan/2026-10-23-two-layers.md, decisions L1 and L2).
 *
 * 216mm is taken as the RUN, the floor distance it covers, so the ramp is an
 * ordinary 216mm straight to the exact walk and loops through it still close
 * exactly (owner decision L2, 2026-10-23). Nobody has measured whether 216 is
 * the run or the length along the slope: if it is the slope, the run is
 * sqrt(216^2 - 64^2), about 206.34mm, and every ramp loop is off by about
 * 9.7mm per ramp. That is `CALIBRATION.md` Q4, still open, which is why this
 * part is `unverified` (eng review finding T2: the schema has no "estimated"
 * dimension status, and unverified is the honest one) and sits outside
 * `BRIO_PARTS`, whose parts are all published.
 *
 * The rise of 64mm is estimated too, and only the clearance note uses it
 * (`CLEARANCE` below): to the engine a ramp climbs exactly one level.
 */

import type { DimensionSource, Part } from '../src/parts/schema.js';

const RAMP_SOURCE: DimensionSource = {
  status: 'unverified',
  source: 'woodenrailway.info piece table: N, Ascending, 216mm; CALIBRATION.md Q4 (run or slope, unmeasured)',
  note: '216mm taken as the floor run (owner decision L2, 2026-10-23). If it is the slope length, the run is about 206.34mm.',
};

export const RAMP_SEEDS: readonly Part[] = [
  {
    id: 'N', brand: 'BRIO', kind: 'straight', name: 'Ascending track',
    partNumber: '33332', lengthMm: 216, rise: 1,
    dimensions: RAMP_SOURCE,
    slop: { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' },
    ends: { start: 'socket', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6,
  },
];

/**
 * The clearance under a bridge, millimetres, for the verdict's note only
 * (decision L3): ramp rise minus plank thickness minus the tallest train.
 * Rise and train are estimates; the plank is published.
 */
export const CLEARANCE = {
  riseMm: 64,
  plankMm: 12,
  trainMm: 44,
} as const;
