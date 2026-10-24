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
import { clearance, jointSlop } from './calibration.js';
import { MEASUREMENTS } from './measurements.js';

const RAMP_SOURCE: DimensionSource = {
  status: 'unverified',
  source: 'woodenrailway.info piece table: N, Ascending, 216mm; CALIBRATION.md Q4 (run or slope, unmeasured)',
  note: '216mm taken as the floor run (owner decision L2, 2026-10-23). If it is the slope length, the run is about 206.34mm.',
};

export const RAMP_SEEDS: readonly Part[] = [
  {
    id: 'N', brand: 'BRIO', kind: 'straight', name: 'Ramp',
    partNumber: '33332', lengthMm: 216, rise: 1,
    dimensions: RAMP_SOURCE,
    slop: jointSlop(MEASUREMENTS),
    ends: { start: 'socket', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6,
  },
  /*
   * N1: "an N track with two male connectors. It was bundled with #33397, the
   * Reversible Bridge, a double track bridge with female connectors on both
   * ends" (woodenrailway.info/track/brio-track-guide, read 2026-10-23). No
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
    id: 'N1', brand: 'BRIO', kind: 'straight', name: 'Ramp, two pegs',
    lengthMm: 216, rise: 1,
    dimensions: {
      ...RAMP_SOURCE,
      source: 'woodenrailway.info/track/brio-track-guide: N1 is an N track with two male connectors; CALIBRATION.md Q4 (run or slope, unmeasured)',
    },
    slop: jointSlop(MEASUREMENTS),
    ends: { start: 'peg', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6,
  },
];

/**
 * The clearance under a bridge, millimetres, for the verdict's note only
 * (decision L3): ramp rise minus plank thickness minus the tallest train.
 * The rise and the plank are published: "Raises or lowers the track by 64mm"
 * and "40mm wide and 12mm high" (woodenrailway.info/track/brio-track-guide).
 * The train's height is the estimate, and the note names it as the one guess
 * in the figure until Q5 of `measurements.ts` is filled in (`trainMeasured`).
 */
export const CLEARANCE = clearance(MEASUREMENTS);
