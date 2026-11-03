/**
 * WHAT A PHOTO READING MAY CHANGE (plan 2026-11-02: C1, C2, OV7, OV8).
 *
 * Value: protects=a figure needs two photos within 0.5mm; a switch fit off by
 * more than 0.5mm does not count; a part changes only when every required
 * figure agrees; a published part that the photos agree with keeps its
 * figures; one they contradict is replaced and named
 * Value: fails_when=one photo is enough, the agreement band widens, partial
 * readings promote a part, or confirmation overwrites published figures
 * Value: why_new=no photo readings existed
 * Value: seam=none; readings are written by hand here as they will be in
 * photoReadings.ts
 * Value: no_claim=whether a reading is accurate; the 216mm trial owns that
 */

import { describe, expect, it } from 'vitest';
import { agreedFigure, photoOutcome, PHOTO_READINGS, type PhotoReading } from './photoReadings.js';

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

  it('a fitted shape that misses the photo by more than 0.5mm does not count', () => {
    expect(agreedFigure([reading(150, 'a.jpg', { fitResidualMm: 0.8 }), reading(150.1, 'b.jpg')])).toBe(null);
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
    expect(photoOutcome('published', { lengthMm: 144 }, two('lengthMm', 144)).kind).toBe('confirmed');
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

it('no reading lands before the 216mm trial (EO7)', () => {
  expect(PHOTO_READINGS).toEqual([]);
});
