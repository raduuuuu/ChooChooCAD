/**
 * FROM THE FLOOR TO THE ENGINE (CALIBRATION.md, "After the afternoon").
 *
 * `measurements.ts` holds the raw readings; this file is the only place they
 * become engine numbers. Every reading is optional: a null keeps the estimate
 * it would have replaced, and `calibrationStatus` moves to 'measured' only
 * when every number in that budget came off the floor.
 *
 * Also the findings: what each answer means, taken row by row from the
 * contingency table in CALIBRATION.md, so nobody re-derives it on the day.
 * The Q1 cross-check needs the solver, which imports the part data, so it
 * lives in `engine/tools/calibration.ts` instead.
 */

import type { SlopBudget } from '../src/parts/schema.js';

type Num = number | null;

export interface Measurements {
  readonly measuredOn: string | null;
  readonly method: string | null;
  readonly q1: {
    readonly closes: boolean | null;
    readonly feel: 'strained' | 'comfortable' | null;
    readonly leftoverGapMm: Num;
    readonly trainRuns: boolean | null;
  };
  readonly q2: {
    readonly pullApartMm: Num;
    readonly pushStopMm: Num;
    readonly bendDeg: Num;
    readonly bendSidewaysMm: Num;
    readonly bendOverMm: Num;
  };
  readonly q3: {
    readonly overallMm: Num;
    readonly withoutPegMm: Num;
    readonly pegNeckDiameterMm: Num;
    readonly socketThroatWidthMm: Num;
  };
  readonly q4: { readonly runMm: Num; readonly slopeMm: Num };
  readonly q5: { readonly vehicleHeightMm: Num; readonly riseMm: Num; readonly plankThicknessMm: Num };
  readonly q6: { readonly throughMm: Num; readonly chordMm: Num; readonly offsetMm: Num };
}

/** The guesses every reading replaces. Not measured; see brio.ts CALIBRATION WARNING. */
export const ESTIMATES = {
  axialMm: 0.8,
  angularDeg: 1.5,
  /** PUBLISHED, not estimated: "Raises or lowers the track by 64mm". */
  riseMm: 64,
  /** PUBLISHED, not estimated: "40mm wide and 12mm high". */
  plankMm: 12,
  trainMm: 44,
} as const;

const numbers = (m: Measurements): [string, number][] =>
  (['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const).flatMap((q) =>
    Object.entries(m[q])
      .filter((e): e is [string, number] => typeof e[1] === 'number')
      .map(([k, v]): [string, number] => [`${q}.${k}`, v]),
  );

/**
 * Throws, naming the field, on a reading that cannot be right. Run when the
 * part data loads, so a typo stops the tests rather than reaching a verdict.
 */
export function checkMeasurements(m: Measurements): void {
  const filled = numbers(m);
  for (const [k, v] of filled) {
    if (!Number.isFinite(v) || v < 0) throw new Error(`measurements.ts ${k}: ${v} is not a length or angle`);
  }
  const anything = filled.length > 0 || m.q1.closes !== null || m.q1.trainRuns !== null;
  if (anything && (m.measuredOn === null || !/^\d{4}-\d{2}-\d{2}$/.test(m.measuredOn))) {
    throw new Error('measurements.ts: set measuredOn to the YYYY-MM-DD the numbers were read');
  }
  const { pullApartMm, pushStopMm, bendSidewaysMm, bendOverMm } = m.q2;
  if (pullApartMm !== null && pushStopMm !== null && pushStopMm > pullApartMm) {
    throw new Error('measurements.ts q2: pushStopMm is past pullApartMm; the joint would have no travel');
  }
  if ((bendSidewaysMm === null) !== (bendOverMm === null)) {
    throw new Error('measurements.ts q2: bendSidewaysMm and bendOverMm go together');
  }
  if (bendOverMm === 0) throw new Error('measurements.ts q2.bendOverMm: 0 is not a length');
}

const deg = (rad: number): number => (rad * 180) / Math.PI;

/** The in-plane bend at the limit, in degrees, however it was read; null if not read. */
export function measuredBendDeg(m: Measurements): number | null {
  const { bendDeg: d, bendSidewaysMm: s, bendOverMm: over } = m.q2;
  if (d !== null) return d;
  if (s !== null && over !== null) return deg(Math.atan2(s, over));
  return null;
}

/**
 * One joint's give, for every BRIO part.
 *
 * Axial is the whole travel, pull-apart limit minus push-together stop: the
 * stretch the bend model lets a joint use (0 up to this, one-sided). A
 * missing stop counts as 0. The angular figure here is the PART's; BRIO
 * joints take their bend limit from `bendLimit.ts`, which prefers this
 * reading when Q2's bend was measured.
 */
export function jointSlop(m: Measurements): SlopBudget {
  const axial = m.q2.pullApartMm === null ? null : m.q2.pullApartMm - (m.q2.pushStopMm ?? 0);
  const angular = measuredBendDeg(m);
  return {
    axialMm: axial ?? ESTIMATES.axialMm,
    angularDeg: angular ?? ESTIMATES.angularDeg,
    calibrationStatus: axial !== null && angular !== null ? 'measured' : 'estimated',
  };
}

/** The bridge subtraction's three numbers, and whether the train's came off the floor. */
export function clearance(m: Measurements) {
  return {
    riseMm: m.q5.riseMm ?? ESTIMATES.riseMm,
    plankMm: m.q5.plankThicknessMm ?? ESTIMATES.plankMm,
    trainMm: m.q5.vehicleHeightMm ?? ESTIMATES.trainMm,
    trainMeasured: m.q5.vehicleHeightMm !== null,
  } as const;
}

/** Within this, a reading "is" 216mm: two careful reads with a steel rule. */
const SAME_MM = 2;
const LATTICE_STEP_DEG = 22.5;

const mm = (x: number): string => `${Math.round(x * 100) / 100}mm`;

/**
 * What the readings say, one line per answered question, each ending in the
 * CALIBRATION.md contingency it triggers. Q1 is the tool's, see the header.
 */
export function findings(m: Measurements): string[] {
  const out: string[] = [];
  const slop = jointSlop(m);

  if (m.q2.pullApartMm !== null) {
    const a = slop.axialMm;
    const reading =
      `Q2: one joint travels ${mm(a)} (pull ${mm(m.q2.pullApartMm)}, stop ${mm(m.q2.pushStopMm ?? 0)}), ` +
      `against the ${mm(ESTIMATES.axialMm)} estimate.`;
    out.push(
      a < 1
        ? `${reading} Much under 1mm: most near misses will read as definite failures; re-examine the bound's threshold before the UI copy.`
        : a > 3
          ? `${reading} Over 3mm: the bound will rarely say no; the value shifts onto exact closure and the gap report.`
          : `${reading} Inside the 1 to 3mm band the plan expected.`,
    );
    if ((m.q2.pushStopMm ?? 0) > 0) {
      out.push('Q2: the joint has a hard stop short of touching; the engine credits only the travel between the stop and the pull-apart limit.');
    }
  }
  const bend = measuredBendDeg(m);
  if (bend !== null) {
    out.push(
      `Q2: the bend limit is ${Math.round(bend * 100) / 100} degrees, against the ${ESTIMATES.angularDeg} estimate. ` +
        'It is the BRIO bend limit every verdict uses (engine/data/bendLimit.ts), ahead of the one inferred from Q1.',
    );
  }

  const { overallMm, withoutPegMm } = m.q3;
  if (overallMm !== null || withoutPegMm !== null) {
    const datum =
      withoutPegMm !== null && Math.abs(withoutPegMm - 216) <= SAME_MM
        ? '216 is the length without the peg, which is how the engine joins pieces.'
        : overallMm !== null && Math.abs(overallMm - 216) <= SAME_MM
          ? '216 includes the peg: joined pieces are shorter than the engine thinks, and every closure inherits it.'
          : 'neither reading is 216: re-check the reading before anything else.';
    out.push(`Q3: overall ${overallMm === null ? '-' : mm(overallMm)}, without peg ${withoutPegMm === null ? '-' : mm(withoutPegMm)}. ${datum}`);
  }

  const { runMm, slopeMm } = m.q4;
  if (runMm !== null) {
    out.push(
      Math.abs(runMm - 216) <= SAME_MM
        ? `Q4: the run is ${mm(runMm)}, so 216 is the RUN. Everything proceeds; the ramp can lose its unverified mark.`
        : slopeMm !== null && Math.abs(slopeMm - 216) <= SAME_MM
          ? `Q4: the run is ${mm(runMm)} and the slope 216, so 216 is the PLANK. Exact closure does not survive a ramp: decide between a stated per-ramp error and rounding the run to 206mm before any ramp code.`
          : `Q4: the run is ${mm(runMm)}, which is neither 216 nor the 206.34 a 216 slope implies. Re-measure.`,
    );
  }

  if (m.q5.vehicleHeightMm !== null || m.q5.riseMm !== null || m.q5.plankThicknessMm !== null) {
    const c = clearance(m);
    const margin = c.riseMm - c.plankMm - c.trainMm;
    const sum = `Q5: ${mm(c.riseMm)} rise - ${mm(c.plankMm)} plank - ${mm(c.trainMm)} train = ${mm(margin)} clearance.`;
    out.push(
      margin >= 5
        ? `${sum} Comfortably positive: the layer feature stands as built.`
        : margin > 0
          ? `${sum} Thin: the verdict must say the margin is thin and name it in millimetres; track flexes.`
          : `${sum} Zero or less: single-level bridges are impossible, and the two-layer feature needs a design change, not a tuning change.`,
    );
  }

  const { throughMm, chordMm, offsetMm } = m.q6;
  if (throughMm !== null) {
    const straight = [54, 72, 108, 144, 216].find((s) => Math.abs(throughMm - s) <= SAME_MM);
    out.push(
      straight === undefined
        ? `Q6: the through road is ${mm(throughMm)}, not one of the catalogue straights.`
        : `Q6: the through road is ${mm(throughMm)}, the ${straight}mm straight.`,
    );
  }
  if (chordMm !== null && offsetMm !== null) {
    if (offsetMm >= chordMm || chordMm === 0) {
      out.push('Q6: the offset is not less than the chord, so these are not one arc. Re-measure.');
    } else {
      // A circular arc leaving the heel tangent to the through road: the
      // offset is chord^2 / 2r, and the arc's angle is 2 asin(offset / chord).
      const r = (chordMm * chordMm) / (2 * offsetMm);
      const theta = 2 * Math.asin(offsetMm / chordMm);
      const steps = Math.round(deg(theta) / LATTICE_STEP_DEG);
      const snapped = (steps * LATTICE_STEP_DEG * Math.PI) / 180;
      const x = Math.sqrt(chordMm * chordMm - offsetMm * offsetMm);
      const miss = Math.hypot(x - r * Math.sin(snapped), offsetMm - r * (1 - Math.cos(snapped)));
      out.push(
        `Q6: the diverging road is an arc of ${Math.round(deg(theta) * 10) / 10} degrees at ${mm(r)} centreline radius; ` +
          `snapped to ${steps} lattice step${steps === 1 ? '' : 's'} its end moves ${mm(miss)}. ` +
          'That residual is what decides whether a switch fits the lattice (eng review E1).',
      );
    }
  }

  return out;
}
