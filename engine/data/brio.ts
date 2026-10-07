/**
 * BRIO part data.
 *
 * Dimensions transcribed from the woodenrailway.info track guide and Track Math
 * pages, cross-checked against published BRIO figures. All lengths and radii are
 * integers in millimetres, which is what makes the exact-lattice residual work.
 *
 *   A2 = 54   A1 = 108   A = 144   D = 216      and   A1 = 2*A2, D = 2*A1, 2*D = 3*A
 *   E  = radius 182 at 45 degrees (#33342)
 *   E1 = radius  90 at 45 degrees (#33337)
 *   N  = 216 run, rises 64mm      (#33332)
 *
 * PROVENANCE WARNING: the part DB is a transcription of a third-party curated
 * measurement compilation. Whether that compilation is protected is an open
 * legal question flagged pre-launch, not settled here.
 *
 * CALIBRATION WARNING: every slop budget below is 'estimated'. Nobody has put
 * calipers on real track yet. These numbers are placeholders chosen to be
 * plausible, and they MUST be fitted against a physical corpus (built and
 * measured layouts, split into calibration and held-out validation sets) before
 * any verdict is shown to a user as confident. Until then the UI is required to
 * mark affected verdicts as estimated.
 */

import type { Part, SlopBudget } from '../src/parts/schema.js';

/** Placeholder. Not measured. See CALIBRATION WARNING above. */
const ESTIMATED_SLOP: SlopBudget = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated',
};

export const BRIO_PARTS: readonly Part[] = [
  // Straights
  {
    id: 'A2', brand: 'BRIO', kind: 'straight', name: 'Mini straight',
    partNumber: '33333', lengthMm: 54, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
  {
    id: 'A1', brand: 'BRIO', kind: 'straight', name: 'Short straight',
    partNumber: '33334', lengthMm: 108, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
  {
    id: 'A', brand: 'BRIO', kind: 'straight', name: 'Medium straight',
    partNumber: '33335', lengthMm: 144, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
  {
    id: 'D', brand: 'BRIO', kind: 'straight', name: 'Long straight',
    partNumber: '33341', lengthMm: 216, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
  // Curves. 45 degrees = 2 steps of 22.5.
  {
    id: 'E', brand: 'BRIO', kind: 'curve', name: 'Large curve',
    partNumber: '33342', radiusMm: 182, arcSteps: 2, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
  {
    id: 'E1', brand: 'BRIO', kind: 'curve', name: 'Short curve',
    partNumber: '33337', radiusMm: 90, arcSteps: 2, gaugeWidthMm: 40,
    slop: ESTIMATED_SLOP, heightMm: 0,
  },
];

const BY_ID = new Map(BRIO_PARTS.map((p) => [p.id, p]));

export function getPart(id: string): Part {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`unknown part id: ${id}`);
  return p;
}

/**
 * Vehicle scalars, used by the traversal checker for grade and clearance.
 *
 * Deliberately two numbers rather than a rolling-stock model: the checker
 * performs no derailment physics, so wheelbase, bogie pivot and coupler swing
 * are not required. Both are 'estimated' and must be measured alongside the
 * track corpus.
 */
export const VEHICLE = {
  heightMm: 44,
  maxGradePercent: 30,
  calibrationStatus: 'estimated' as const,
};
