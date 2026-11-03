/**
 * The ascending track, the one part that changes level (two-layer plan,
 * docs/plan/2026-10-23-two-layers.md, decisions L1 and L2).
 *
 * 216mm is taken as the RUN, the floor distance it covers, so the ramp is an
 * ordinary 216mm straight to the exact walk and loops through it still close
 * exactly (owner decision L2, 2026-10-23). Nobody has measured whether 216 is
 * the run or the length along the slope: if it is the slope, the run is
 * sqrt(216^2 - 61^2), about 207.2mm, and every ramp loop is off by about
 * 8.8mm per ramp (the 61mm rise is the owner's, measurements.ts Q5). That is `CALIBRATION.md` Q4, still open, which is why this
 * part is `unverified` (eng review finding T2: the schema has no "estimated"
 * dimension status, and unverified is the honest one) and sits outside
 * `GENERIC_PARTS`, whose parts are all published.
 *
 * The rise, 61mm measured by the owner (published 64), is used only by the
 * clearance note and the 3D view
 * (`CLEARANCE` below): to the engine a ramp climbs exactly one level.
 */

import type { DimensionSource, Part } from '../src/parts/schema.js';
import { clearance, jointSlop } from './calibration.js';
import { MEASUREMENTS } from './measurements.js';

const RAMP_SOURCE: DimensionSource = {
  status: 'unverified',
  source: 'the published piece table: N, Ascending, 216mm; CALIBRATION.md Q4 (run or slope, unmeasured)',
  note: '216mm taken as the floor run (owner decision L2, 2026-10-23). If it is the slope length, the run is about 207.2mm (with the measured 61mm rise).',
};

export const RAMP_SEEDS: readonly Part[] = [
  {
    id: 'N', brand: 'GENERIC', kind: 'straight', name: 'Ramp',
    partNumber: '33332', lengthMm: 216, rise: 1,
    dimensions: RAMP_SOURCE,
    slop: jointSlop(MEASUREMENTS),
    ends: { start: 'socket', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6,
  },
  /*
   * N1: "an N track with two male connectors. It was bundled with #33397, the
   * Reversible Bridge, a double track bridge with female connectors on both
   * ends" (the published track guide, read 2026-10-23). No
   * part number of its own. The letter was reassigned once: in 1997 N1 named a
   * double ascending track; this is the later meaning, as the site uses it.
   *
   * WHY IT MATTERS. Coming down means entering a ramp at its high end, and
   * turning an N round swaps its ends: straight after ordinary track that is
   * peg against peg at the top. A two-socket piece (C, C1, C2) before it fixes
   * the top, but then the N's low end, a socket, meets the next socket and
   * needs a male-male adapter. An N1 after the two-socket piece puts every peg
   * into a socket with no adapter. Same length and rise as N; only the ends
   * differ.
   */
  {
    id: 'N1', brand: 'GENERIC', kind: 'straight', name: 'Ramp, two pegs',
    lengthMm: 216, rise: 1,
    dimensions: {
      ...RAMP_SOURCE,
      source: 'the published track guide: N1 is an N track with two male connectors; CALIBRATION.md Q4 (run or slope, unmeasured)',
    },
    slop: jointSlop(MEASUREMENTS),
    ends: { start: 'peg', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6,
  },
];

/**
 * The clearance under a bridge, millimetres, for the verdict's note only
 * (decision L3): ramp rise minus plank thickness minus the tallest train.
 * The plank is published ("40mm wide and 12mm high", the published track
 * guide). The rise is the owner's: 61mm from a 73mm ramp top, where the guide
 * says 64 (measurements.ts Q5, 2026-11-03).
 * The train's height is the estimate, and the note names it as the one guess
 * in the figure until Q5 of `measurements.ts` is filled in (`trainMeasured`).
 */
export const CLEARANCE = clearance(MEASUREMENTS);
