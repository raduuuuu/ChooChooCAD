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
import { bendLimit, Q1_LOOP } from '../data/bendLimit.js';
import { solveLayout } from '../src/solver/result.js';

/** The engine's verdict on the Q1 loop (E E E E D E E E E A, a 72mm residual), with the bend in use now. */
export function engineOnQ1(): Pick<LayoutEvaluation, 'verdict' | 'gapMm' | 'lambda'> {
  const r = solveLayout({ placements: Q1_LOOP.map((partId) => ({ partId, turn: 'left' as const })), closed: true });
  return evaluateLayout(r, BRIO_SLOP.calibrationStatus);
}

/** The engine's word on the Q1 loop beside the floor's. */
export function q1Finding(m: Measurements, e = engineOnQ1()): string {
  const bend = e.lambda === null ? 'no bend figure' : `${Math.round(e.lambda * bendLimit().deg * 100) / 100} degrees of bend at the worst joint`;
  const engine = `the engine says ${e.verdict}: a ${Math.round(e.gapMm)}mm gap needing ${bend}`;
  const { closes, feel, leftoverGapMm } = m.q1;
  if (closes === null) return `Q1: not answered yet; ${engine}.`;
  if (!closes) {
    const left = leftoverGapMm === null ? '' : `, leaving about ${leftoverGapMm}mm`;
    return `Q1: it does not close on the floor${left}; ${engine}. They agree.`;
  }
  if (e.verdict === 'EXCEEDS') {
    return (
      `Q1: it closes on the floor (${feel ?? 'feel not recorded'}) but ${engine}. ` +
      'THE MOST IMPORTANT RESULT ON THE SHEET: the engine refuses a loop that closes, so its bend limit is wrong in direction, not just imprecise.'
    );
  }
  return `Q1: it closes on the floor (${feel ?? 'feel not recorded'}); ${engine}. They agree.`;
}

/**
 * The BRIO bend limit in use, where it came from, and, when it was inferred
 * from Q1, how far the solver's refinement could have moved it above the true
 * minimum (eng review D13).
 */
export function bendLine(): string {
  const b = bendLimit();
  const margin = b.status === 'inferred' ? `; refinement could overstate it by at most ${Math.round(b.marginDeg * 1000) / 1000} degrees` : '';
  return `Bend limit: ${Math.round(b.deg * 1000) / 1000} degrees, ${b.status} (${b.source})${margin}.`;
}

export function report(m: Measurements): string[] {
  return [
    `Joint stretch: ${BRIO_SLOP.axialMm}mm (${m.q2.pullApartMm === null ? 'still the estimate' : `measured ${m.measuredOn}`}; estimate ${ESTIMATES.axialMm}mm).`,
    `Train height: ${CLEARANCE.trainMm}mm (${CLEARANCE.trainMeasured ? 'measured' : 'still the estimate'}).`,
    bendLine(),
    '',
    q1Finding(m),
    ...findings(m),
  ];
}

if (import.meta.main) {
  console.log(report(MEASUREMENTS).join('\n'));
}
