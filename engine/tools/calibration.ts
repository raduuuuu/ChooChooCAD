/**
 * `bun run calibration`: what the readings in `engine/data/measurements.ts`
 * change, printed in the order CALIBRATION.md asks the questions.
 *
 * Read-only. It writes nothing; the part data already reads the same file,
 * so filling it in IS writing the numbers into the engine. This only says
 * what that did, and runs the one check nothing else can: Q1, the loop the
 * engine calls a definite no, against what the floor said.
 */

import { BRIO_SLOP } from '../data/brio.js';
import { CLEARANCE } from '../data/rampSeeds.js';
import { ESTIMATES, findings, type Measurements } from '../data/calibration.js';
import { MEASUREMENTS } from '../data/measurements.js';
import { evaluateLayout, type LayoutEvaluation } from '../src/joints/evaluate.js';
import { solveLayout } from '../src/solver/result.js';

/** E E E E D E E E E A: the CALIBRATION.md Q1 loop, a 72mm residual. */
const Q1_LOOP = ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A'];

/** The engine's verdict on the Q1 loop, with the give in use now. */
export function engineOnQ1(): Pick<LayoutEvaluation, 'verdict' | 'gapMm' | 'totalGiveMm'> {
  const r = solveLayout({ placements: Q1_LOOP.map((partId) => ({ partId, turn: 'left' as const })), closed: true });
  return evaluateLayout(r, BRIO_SLOP.calibrationStatus);
}

/** The engine's word on the Q1 loop beside the floor's. */
export function q1Finding(m: Measurements, e = engineOnQ1()): string {
  const engine = `the engine says ${e.verdict}: a ${Math.round(e.gapMm)}mm gap against ${Math.round(e.totalGiveMm * 100) / 100}mm of give`;
  const { closes, feel, leftoverGapMm } = m.q1;
  if (closes === null) return `Q1: not answered yet; ${engine}.`;
  if (!closes) {
    const left = leftoverGapMm === null ? '' : `, leaving about ${leftoverGapMm}mm`;
    return `Q1: it does not close on the floor${left}; ${engine}. They agree.`;
  }
  if (e.verdict === 'EXCEEDS') {
    return (
      `Q1: it closes on the floor (${feel ?? 'feel not recorded'}) but ${engine}. ` +
      'THE MOST IMPORTANT RESULT ON THE SHEET: the give is larger than the engine thinks, and its numbers are wrong in direction, not just imprecise.'
    );
  }
  return `Q1: it closes on the floor (${feel ?? 'feel not recorded'}); ${engine}. They agree.`;
}

export function report(m: Measurements): string[] {
  const slopFrom = BRIO_SLOP.calibrationStatus === 'measured' ? `measured ${m.measuredOn}` : 'still the estimate';
  return [
    `Joint give: ${BRIO_SLOP.axialMm}mm axial, ${Math.round(BRIO_SLOP.angularDeg * 100) / 100} degrees (${slopFrom}; estimate ${ESTIMATES.axialMm}mm, ${ESTIMATES.angularDeg} degrees).`,
    `Train height: ${CLEARANCE.trainMm}mm (${CLEARANCE.trainMeasured ? 'measured' : 'still the estimate'}).`,
    '',
    q1Finding(m),
    ...findings(m),
  ];
}

if (import.meta.main) {
  console.log(report(MEASUREMENTS).join('\n'));
}
