/**
 * WHAT A PHOTO READING MAY CHANGE (plan 2026-11-02: C1, C2, OV7, OV8;
 * tolerance 1mm, owner 2026-11-03).
 *
 * Value: protects=a figure needs two photos within 0.5mm; a switch fit off by
 * more than 1mm does not count; a part changes only when every required
 * figure agrees; a published part that the photos agree with keeps its
 * figures; one they contradict by more than 1mm is replaced and named; the
 * recorded 216mm trial passes these same rules
 * Value: fails_when=one photo is enough, the agreement band widens, partial
 * readings promote a part, or confirmation overwrites published figures
 * Value: why_new=no photo readings existed
 * Value: seam=none; readings are written by hand here as they will be in
 * photoReadings.ts
 * Value: no_claim=whether a reading is accurate; the 216mm trial owns that
 */

import { describe, expect, it } from 'vitest';
import { agreedFigure, photoOutcome, PHOTO_READINGS, TOLERANCE_MM, TRIAL, type PhotoReading } from './photoReadings.js';
import { BUILT_IN } from './library.js';
import { toXY } from '../src/geom/cyclotomic.js';

const reading = (valueMm: number, photo: string, extra: Partial<PhotoReading> = {}): PhotoReading => ({
  partId: 'A',
  figure: 'lengthMm',
  valueMm,
  photo,
  on: '2026-11-03',
  ...extra,
});

describe('one figure (C2, OV7)', () => {
  it('two photos within 0.5mm agree on their mean', () => {
    expect(agreedFigure([reading(144.2, 'a.jpg'), reading(144.6, 'b.jpg')])).toBeCloseTo(144.4, 9);
  });

  /*
   * MUTATION PROOF, run: the `> AGREE_MM` spread check removed fails with
   * `expected 144.3 to be null`.
   */
  it('0.6mm apart is not agreement', () => {
    expect(agreedFigure([reading(144.0, 'a.jpg'), reading(144.6, 'b.jpg')])).toBe(null);
  });

  /*
   * MUTATION PROOF, run: the distinct-photo count replaced by
   * `usable.length < 2` fails with `expected 144.1 to be null`.
   */
  it('two readings of the same photo are one photo', () => {
    expect(agreedFigure([reading(144.0, 'a.jpg'), reading(144.2, 'a.jpg')])).toBe(null);
  });

  it('a fitted shape that misses the photo by more than 1mm does not count', () => {
    expect(agreedFigure([reading(150, 'a.jpg', { fitResidualMm: 1.2 }), reading(150.1, 'b.jpg')])).toBe(null);
  });
});

describe('one part (C1, OV8)', () => {
  const two = (figure: string, v: number) => [reading(v, 'a.jpg', { figure }), reading(v + 0.2, 'b.jpg', { figure })];

  /*
   * MUTATION PROOF, run: the `missing.length > 0` return removed fails with
   * `expected 'measured' to be 'partial'`.
   */
  it('nothing changes until every required figure agrees', () => {
    const r = photoOutcome('unverified', { lengthMm: 216, riseMm: 64 }, two('lengthMm', 216));
    expect(r.kind).toBe('partial');
    expect(r.kind === 'partial' && r.missing).toEqual(['riseMm']);
  });

  /*
   * MUTATION PROOF, run: the 'confirmed' return removed fails with
   * `expected 'measured' to be 'confirmed'`: a photo would overwrite the guide.
   */
  it('a published part the photos agree with keeps its figures', () => {
    expect(photoOutcome('published', { lengthMm: 144 }, two('lengthMm', 144.7)).kind).toBe('confirmed');
  });

  it('a published figure the photos contradict is replaced, and named', () => {
    expect(photoOutcome('published', { lengthMm: 144 }, two('lengthMm', 145.5))).toEqual({
      kind: 'measured',
      figures: { lengthMm: 145.6 },
      contradicted: ['lengthMm'],
    });
  });

  it('an unverified part takes the photo figures', () => {
    const r = photoOutcome('unverified', { lengthMm: 216 }, two('lengthMm', 216.1));
    expect(r.kind === 'measured' && r.figures.lengthMm).toBeCloseTo(216.2, 9);
  });
});

/*
 * MUTATION PROOF, run: TOLERANCE_MM set back to 0.5 fails with
 * `expected 0.6999999999999886 to be less than or equal to 0.5`: the trial
 * read about 0.7mm long, which only the owner's 1mm accepts.
 */
it('the recorded 216mm trial passes the rules it cleared (EO7)', () => {
  const agreed = agreedFigure(TRIAL.readings.map((r) => ({ partId: 'trial', figure: 'lengthMm', valueMm: r.valueMm, photo: r.photo, on: TRIAL.on })));
  expect(agreed).not.toBe(null);
  expect(Math.abs(agreed! - TRIAL.knownMm)).toBeLessThanOrEqual(TOLERANCE_MM);
});

/*
 * A PART HELD AS MEASURED MATCHES ITS PHOTOS (eng finding 5: the figure lives
 * in the part and in its readings, so the two must not drift).
 *
 * MUTATION PROOFS, run:
 * - the T switch's curved end held at xy(108, 108), the printed figure: `curvedEndOutMm:
 *   expected 2.4749999999999943 to be less than or equal to 1`.
 * - one T reading of curvedEndOutMm dropped: `expected 'partial' to be 'measured'`.
 */
describe('every part measured from photos', () => {
  const measured = BUILT_IN.filter((p) => p.dimensions.status === 'user-measured');

  it('the T switch is one, and only parts with readings are', () => {
    expect(measured.map((p) => p.id)).toEqual(['T']);
    for (const p of measured) expect(PHOTO_READINGS.some((r) => r.partId === p.id), p.id).toBe(true);
  });

  it("the T switch's held ends are its readings, within 1mm", () => {
    const t = BUILT_IN.find((p) => p.id === 'T');
    if (t?.kind !== 'multi-road') throw new Error('T is not a multi-road piece');
    const [throughX] = toXY(t.ports[1]!.at.pos);
    const [alongX, outY] = toXY(t.ports[2]!.at.pos);
    const held = { throughMm: throughX, curvedEndAlongMm: alongX, curvedEndOutMm: outY };
    const r = photoOutcome('unverified', held, PHOTO_READINGS.filter((x) => x.partId === 'T'));
    expect(r.kind).toBe('measured');
    if (r.kind !== 'measured') return;
    for (const [f, v] of Object.entries(held)) expect(Math.abs(r.figures[f]! - v), f).toBeLessThanOrEqual(TOLERANCE_MM);
  });
});
