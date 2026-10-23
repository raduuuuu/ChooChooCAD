/**
 * BRIO part data.
 *
 * Dimensions transcribed from the woodenrailway.info track guide and Track Math
 * pages, cross-checked against published BRIO figures. All lengths and radii are
 * integers in millimetres, which is what makes the exact-lattice residual work.
 *
 *   A2 = 54   A3 = 72   A1 = 108   A = 144   D = 216
 *   and   A1 = 2*A2, D = 2*A1, 2*D = 3*A
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

import type { DimensionSource, Part, PartEnds, SlopBudget } from '../src/parts/schema.js';
import { RAMP_SEEDS } from './rampSeeds.js';
import { SWITCH_SEEDS } from './switchSeeds.js';
import { THIRD_PARTY_SEEDS } from './thirdParty.js';

/** Placeholder. Not measured. See CALIBRATION WARNING above. */
const ESTIMATED_SLOP: SlopBudget = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated',
};

/**
 * Every BRIO piece has one male and one female end. Recorded the same way round
 * for all of them, which is the convention that makes append-only placement safe:
 * peg meets socket all the way round, including at the closing seam.
 *
 * Not a measurement and not brand trivia. See `Polarity` in the schema.
 */
const STANDARD_ENDS: PartEnds = { start: 'socket', end: 'peg' };

/** Every BRIO figure here comes from one reference, read directly on 2026-10-09. */
const BRIO_PUBLISHED: DimensionSource = {
  status: 'published',
  source: 'woodenrailway.info/track/brio-track-guide and /track/track-math',
  note: 'Straight lengths and their relations agree with the catalogue. Curve figures are INNER radii; see innerRadiusMm.',
};

/**
 * Track profile, PUBLISHED. Source, verbatim:
 *
 *   "A typical piece of BRIO track is 40mm wide and 12mm high, with two 6mm wide
 *    grooves that are 3mm deep, spaced 20mm apart, measuring 26mm from center to
 *    center."   -- woodenrailway.info/track/brio-track-guide
 *
 * These replace two wrong values that shipped on 2026-10-08. `gaugeWidthMm` held
 * 40, which is the PLANK WIDTH under the wrong name, and `plankWidthMm` held a
 * 44mm ESTIMATE invented for a number that was already in the file. The plank
 * thickness is a bonus: `CALIBRATION.md` lists it as an unknown gating elevation
 * work, and it turns out to be published.
 */
const PLANK_WIDTH_MM = 40;
const PLANK_THICKNESS_MM = 12;
const GAUGE_WIDTH_MM = 26;
/** Published in the same sentence as the gauge: two 6mm grooves, 3mm deep. */
const GROOVE_WIDTH_MM = 6;

export const BRIO_PARTS: readonly Part[] = [
  // Straights
  {
    id: 'A2', brand: 'BRIO', kind: 'straight', name: 'Mini straight',
    partNumber: '33333', lengthMm: 54,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'A1', brand: 'BRIO', kind: 'straight', name: 'Short straight',
    partNumber: '33334', lengthMm: 108,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'A', brand: 'BRIO', kind: 'straight', name: 'Medium straight',
    partNumber: '33335', lengthMm: 144,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'D', brand: 'BRIO', kind: 'straight', name: 'Long straight',
    partNumber: '33341', lengthMm: 216,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'A3', brand: 'BRIO', kind: 'straight', name: 'Middle straight',
    lengthMm: 72,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  /*
   * B2 and C2: the polarity variants, and the reason connector polarity is not
   * hypothetical.
   *
   * Same 54mm length as A2, differing ONLY in their ends. Source: "the B1 and C1
   * track are an A1 length with two male and two female connectors," and the
   * same holds for B2 and C2 against A2. These ship in the CURRENT #33333 Mini
   * Straight pack, which "contains two A2, and one each of B2 and C2", so a
   * double-peg and a double-socket piece are in a pack on sale today.
   *
   * Consequence worth knowing before you place one: appending B2 after any
   * normal piece puts a peg against a peg, and the polarity check added on
   * 2026-10-08 correctly refuses it. That is not a bug in either. Real builders
   * use B and C pieces precisely to fix an orientation that will not meet, which
   * is a placement question the append-only editor cannot express yet.
   */
  {
    id: 'B2', brand: 'BRIO', kind: 'straight', name: 'Mini straight, two pegs',
    partNumber: '33333', lengthMm: 54,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'peg', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'C2', brand: 'BRIO', kind: 'straight', name: 'Mini straight, two sockets',
    partNumber: '33333', lengthMm: 54,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'socket', end: 'socket' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  /*
   * B, C, B1 AND C1 (task K1): the same polarity pair at the A and A1 lengths.
   *
   * Source, verbatim: "the B1 and C1 track are an A1 length with two male and
   * two female connectors". The piece table lists B and C beside A at 144 the
   * same way, as "retired polarity variants": out of production, and still in
   * the boxes of anyone with older sets, which is who needs them in a planner.
   *
   * WHICH IS WHICH follows B2 and C2 above, B the pegs and C the sockets. For
   * B1 and C1 the sentence above says it; for B and C it is the same naming,
   * and the one MakerWorld replica set that models all four (Fantastic Plastic
   * Person, 784269) has the pegs on B and the sockets on C, checked off its
   * meshes on 2026-10-22. No part numbers: none is published for these, and
   * this file does not write down a number it cannot source.
   */
  {
    id: 'B', brand: 'BRIO', kind: 'straight', name: 'Medium straight, two pegs',
    lengthMm: 144,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'peg', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'C', brand: 'BRIO', kind: 'straight', name: 'Medium straight, two sockets',
    lengthMm: 144,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'socket', end: 'socket' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'B1', brand: 'BRIO', kind: 'straight', name: 'Short straight, two pegs',
    lengthMm: 108,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'peg', end: 'peg' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'C1', brand: 'BRIO', kind: 'straight', name: 'Short straight, two sockets',
    lengthMm: 108,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: { start: 'socket', end: 'socket' }, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  // Curves. 45 degrees = 2 steps of 22.5.
  {
    id: 'E', brand: 'BRIO', kind: 'curve', name: 'Large curve',
    partNumber: '33342', innerRadiusMm: 182, arcSteps: 2,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
  {
    id: 'E1', brand: 'BRIO', kind: 'curve', name: 'Short curve',
    partNumber: '33337', innerRadiusMm: 90, arcSteps: 2,
    dimensions: BRIO_PUBLISHED,
    slop: ESTIMATED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: GAUGE_WIDTH_MM, plankWidthMm: PLANK_WIDTH_MM,
    plankThicknessMm: PLANK_THICKNESS_MM, grooveWidthMm: GROOVE_WIDTH_MM,
  },
];

/**
 * BUILT-IN parts only, for the default resolver.
 *
 * The LIBRARY is what the app actually places from, and it lives in library.ts
 * because it includes user submissions that override these. This map exists so
 * that engine tests and the default `resolve` argument keep working without the
 * app's storage: it is the built-in tier, not the whole library.
 */
const BY_ID = new Map<string, Part>(
  [...BRIO_PARTS, ...RAMP_SEEDS, ...SWITCH_SEEDS, ...THIRD_PARTY_SEEDS].map((p) => [p.id, p]),
);

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
