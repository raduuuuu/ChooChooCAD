/**
 * THE FLOOR'S NUMBERS REACH THE ENGINE, AND ONLY AS FAR AS THEY WERE READ
 * (CALIBRATION.md, "After the afternoon"; task V3).
 *
 * Value: protects=a blank sheet changes nothing; a filled Q2 becomes the give
 * every BRIO part shares, marked measured only when both of its numbers were
 * read; a reading that cannot be right stops the load, naming the field; each
 * answer is read against the contingency row CALIBRATION.md decided in
 * advance; the Q1 loop is checked against the engine's own verdict
 * Value: fails_when=a null stops meaning "keep the estimate", the axial give
 * is understated (the bound it backs is only sound as an upper bound), a half
 * measured budget claims 'measured', or a contingency row is misread
 * Value: why_new=the measurement afternoon had a prose sheet and no path from
 * a caliper reading to `engine/data/brio.ts` other than hand-editing it
 * Value: seam=the pure derivation in `calibration.ts`, fed built Measurements;
 * the shipped `measurements.ts` only through `checkMeasurements`
 * Value: no_claim=that the derivation's reading of Q2 is the right physics.
 * It is the conservative one, chosen because `totalGiveMm` backs a NECESSARY
 * condition; the measurement itself may say otherwise
 */

import { describe, expect, it } from 'vitest';
import { checkMeasurements, clearance, ESTIMATES, findings, jointSlop, type Measurements } from '../data/calibration.js';
import { MEASUREMENTS } from '../data/measurements.js';
import { engineOnQ1, q1Finding } from '../tools/calibration.js';

const BLANK: Measurements = {
  measuredOn: null,
  method: null,
  q1: { closes: null, feel: null, leftoverGapMm: null, trainRuns: null },
  q2: { pullApartMm: null, pushStopMm: null, bendDeg: null, bendSidewaysMm: null, bendOverMm: null },
  q3: { overallMm: null, withoutPegMm: null, pegNeckDiameterMm: null, socketThroatWidthMm: null },
  q4: { runMm: null, slopeMm: null },
  q5: { vehicleHeightMm: null, riseMm: null, plankThicknessMm: null },
  q6: { throughMm: null, chordMm: null, offsetMm: null },
};

type Patch = { [Q in keyof Measurements]?: Measurements[Q] extends object ? Partial<Measurements[Q]> : Measurements[Q] };
const read = (p: Patch): Measurements => {
  const m = { ...BLANK, measuredOn: '2026-10-25' } as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    m[k] = v !== null && typeof v === 'object' ? { ...(BLANK as unknown as Record<string, object>)[k], ...v } : v;
  }
  return m as unknown as Measurements;
};

describe('a blank sheet changes nothing', () => {
  it('the estimates stand, marked estimated, and nothing is reported', () => {
    expect(jointSlop(BLANK)).toEqual({ axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' });
    expect(clearance(BLANK)).toEqual({ riseMm: 64, plankMm: 12, trainMm: 44, trainMeasured: false });
    expect(findings(BLANK)).toEqual([]);
    expect(() => checkMeasurements(BLANK)).not.toThrow();
  });

  it('the shipped sheet loads', () => {
    expect(() => checkMeasurements(MEASUREMENTS)).not.toThrow();
  });
});

describe('Q2 becomes the give', () => {
  /*
   * MUTATION PROOFS, run:
   * - axial without the stop subtracted (`m.q2.pullApartMm - 0`): fails with
   *   `expected 2.4 to be 1.9 // Object.is equality`.
   * - 'measured' when either number was read (`axial !== null || angular !==
   *   null`): fails with `expected 'measured' to be 'estimated'`.
   */
  it('axial is the whole travel; measured only when both numbers were read', () => {
    const both = jointSlop(read({ q2: { pullApartMm: 2.4, pushStopMm: 0.5, bendSidewaysMm: 10, bendOverMm: 144 } }));
    expect(both.axialMm).toBe(1.9);
    expect(both.angularDeg).toBeCloseTo((Math.atan2(10, 144) * 180) / Math.PI, 12);
    expect(both.calibrationStatus).toBe('measured');

    const axialOnly = jointSlop(read({ q2: { pullApartMm: 2.4 } }));
    expect(axialOnly.axialMm).toBe(2.4);
    expect(axialOnly.angularDeg).toBe(ESTIMATES.angularDeg);
    expect(axialOnly.calibrationStatus).toBe('estimated');

    expect(jointSlop(read({ q2: { pullApartMm: 1, bendDeg: 4 } })).angularDeg).toBe(4);
  });

  /*
   * MUTATION PROOF, run: the measuredOn check removed: fails with `expected
   * [Function] to throw an error`.
   */
  it('a reading that cannot be right stops the load, naming the field', () => {
    expect(() => checkMeasurements({ ...read({ q2: { pullApartMm: 2 } }), measuredOn: null })).toThrow(/measuredOn/);
    expect(() => checkMeasurements(read({ q3: { overallMm: -216 } }))).toThrow(/q3\.overallMm/);
    expect(() => checkMeasurements(read({ q2: { pullApartMm: 1, pushStopMm: 2 } }))).toThrow(/pushStopMm/);
    expect(() => checkMeasurements(read({ q2: { bendSidewaysMm: 3 } }))).toThrow(/go together/);
  });
});

describe('each answer meets the row decided for it', () => {
  it('Q4: the run, the plank, or neither', () => {
    expect(findings(read({ q4: { runMm: 215.5 } }))[0]).toMatch(/216 is the RUN/);
    expect(findings(read({ q4: { runMm: 206.5, slopeMm: 216 } }))[0]).toMatch(/216 is the PLANK/);
    expect(findings(read({ q4: { runMm: 190 } }))[0]).toMatch(/Re-measure/);
  });

  /*
   * MUTATION PROOF, run: the thin band's lower edge moved (`margin > 0` to
   * `margin > -10`): fails with `expected 'Q5: 64mm rise - 12mm plank - 55mm
   * tra…' to match /Zero or less/`.
   */
  it('Q5: comfortable, thin, or no bridge at all', () => {
    expect(findings(read({ q5: { vehicleHeightMm: 40 } }))[0]).toMatch(/= 12mm clearance\. Comfortably positive/);
    expect(findings(read({ q5: { vehicleHeightMm: 50 } }))[0]).toMatch(/= 2mm clearance\. Thin/);
    expect(findings(read({ q5: { vehicleHeightMm: 55 } }))[0]).toMatch(/Zero or less/);
    expect(clearance(read({ q5: { vehicleHeightMm: 50 } })).trainMeasured).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the arc's angle as asin instead of 2 asin: fails
   * with `expected 'Q6: the diverging road is an arc of 2…' to match /an
   * arc of 45 degrees at 202mm centrel…/`.
   */
  it('Q6: an arc read as chord and offset lands back on the lattice it came from', () => {
    const r = 202;
    const t = Math.PI / 4;
    const x = r * Math.sin(t);
    const y = r * (1 - Math.cos(t));
    const [line] = findings(read({ q6: { chordMm: Math.hypot(x, y), offsetMm: y } }));
    expect(line).toMatch(/an arc of 45 degrees at 202mm centreline radius; snapped to 2 lattice steps its end moves 0mm/);
  });
});

describe('Q1 against the engine', () => {
  it('the engine sees the 72mm loop CALIBRATION.md describes', () => {
    expect(engineOnQ1().gapMm).toBeCloseTo(72, 9);
  });

  /*
   * MUTATION PROOF, run: the EXCEEDS branch removed from `q1Finding`: fails
   * with `expected 'Q1: it closes on the floor (comfortab…' to match
   * /MOST IMPORTANT/`.
   */
  it('closing on the floor while the engine says EXCEEDS is the headline', () => {
    // lambda 2 is twice the bend limit; the sentence states it in degrees.
    const no = { verdict: 'EXCEEDS', gapMm: 72, lambda: 2 } as const;
    const maybe = { verdict: 'NEEDS_GIVE', gapMm: 72, lambda: 1 } as const;
    expect(q1Finding(BLANK, no)).toMatch(/^Q1: not answered yet; the engine says EXCEEDS: a 72mm gap needing [\d.]+ degrees of bend at the worst joint\.$/);
    expect(q1Finding(read({ q1: { closes: true, feel: 'comfortable' } }), no)).toMatch(/MOST IMPORTANT/);
    expect(q1Finding(read({ q1: { closes: true, feel: 'comfortable' } }), maybe)).toMatch(/They agree\.$/);
    expect(q1Finding(read({ q1: { closes: false, leftoverGapMm: 60 } }), no)).toMatch(/leaving about 60mm.*They agree/);
  });
});
