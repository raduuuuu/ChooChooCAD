/**
 * WHICH PIECES THE LIBRARY MARKS MEASURED (docs/plan/2026-11-03-verified-mark.md,
 * decisions 4, 5B, 9A, 13A).
 *
 * Value: protects=the tick goes to exactly the pieces a check on a real piece
 * backs (the T switch from photos, the long straight from the 216mm trial),
 * the reference straight only once the owner's own reading is in, and never
 * to a figure that moved further than 1mm from what was read
 * Value: fails_when=the trial stops counting, one photo or no reading earns a
 * tick, or a corrected figure keeps it
 * Value: why_new=no measured mark existed
 * Value: seam=none: the real readings and catalogue
 * Value: no_claim=whether a reading is accurate (photoReadings.test.ts and
 * the 216mm trial own that)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { isMeasured, READINGS } from '../data/measured.js';
import type { PieceMeasurement } from '../data/measurements.js';
import type { Part } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const straight = (id: string) => resolve(id) as Extract<Part, { kind: 'straight' }>;

describe('the measured tick', () => {
  /*
   * MUTATION PROOFS, run:
   * MUTATION PROOF, run: the trial readings left out of READINGS fails
   * with `expected [ 'A', 'T' ] to deeply equal [ 'A', 'D', 'T' ]`.
   */
  it('goes to the medium and long straights and the T switch, and nothing else yet', () => {
    expect(BUILT_IN.filter((p) => isMeasured(p)).map((p) => p.id)).toEqual(['A', 'D', 'T']);
  });

  /*
   * MUTATION PROOF, run: hand readings ignored fails with `expected false to
   * be true`.
   */
  it("the reference straight A gets it from the owner's own reading, within 1mm of 144 (13A)", () => {
    const a = straight('A');
    const reading = (valueMm: number) => ({
      ...READINGS,
      byHand: [{ partId: 'A', figure: 'lengthMm', valueMm, on: '2026-11-03', how: 'digital caliper' }] as PieceMeasurement[],
    });
    // The owner's own 143.5 (steel ruler, 2026-11-03) is the recorded one.
    expect(isMeasured(a)).toBe(true);
    expect(isMeasured(a, { ...READINGS, byHand: [] })).toBe(false);
    expect(isMeasured(a, reading(144.4))).toBe(true);
    expect(isMeasured(a, reading(145.2))).toBe(false);
  });

  /*
   * MUTATION PROOF, run: the ±1mm comparison dropped (any reading counts)
   * fails with `expected true to be false`: a corrected D kept the tick.
   */
  it('a correction that moves a figure more than 1mm from what was read drops it (9A)', () => {
    const d = straight('D');
    expect(isMeasured({ ...d, lengthMm: 217 })).toBe(true);
    expect(isMeasured({ ...d, lengthMm: 218 })).toBe(false);
  });

  /*
   * MUTATION PROOF, run: `agreedFigure` replaced by the first photo's value
   * fails with `expected true to be false`: one photo earned a tick.
   */
  it('one photo is not enough: the trial with a single reading does not mark D', () => {
    const oneTrialPhoto = { ...READINGS, photos: READINGS.photos.filter((r) => !(r.partId === 'D' && r.photo !== '84401.jpg')) };
    expect(isMeasured(straight('D'), oneTrialPhoto)).toBe(false);
  });
});
