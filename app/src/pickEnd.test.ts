/**
 * WHICH END A CLICK MEANS (plan 2026-11-01; eng E1, X1; design DR9).
 *
 * Value: protects=a click on stacked ends reaches the end that can join:
 * two stacked, three with a refused middle; a lone armed end still un-selects
 * and a lone refused end still says why; the nearer of two joinable ends
 * wins and ties go to the one on top; a floor end under raised wood is never
 * reachable; on touch an end is never under 44px across
 * Value: fails_when=the armed end takes the second click, a refused end
 * traps it, a hidden end is picked, or the touch floor goes
 * Value: why_new=the top-drawn dot took every click
 * Value: seam=pure functions the canvas calls
 * Value: no_claim=real pointer hit-testing (the browser check in the PR)
 */

import { describe, expect, it } from 'vitest';
import type { RenderedPort } from '../../engine/src/graph/render.js';
import { clickableEndsOf, END_HIT_MM, endHitRadiusMm, pickEnd, type ClickableEnd } from './trackPath.js';

const end = (pieceId: string, x: number, order: number, y = 0): ClickableEnd => ({ ref: { pieceId, port: 0 }, x, y, order });
const none = () => false;
const ref = (pieceId: string) => ({ pieceId, port: 0 });

describe('pickEnd', () => {
  /*
   * MUTATION PROOF, run: the joinable search skipped (armed falls straight
   * to itself): `expected { pieceId: 'top', port: +0 } to deeply equal {
   * pieceId: 'under', port: +0 }`.
   */
  it('two ends on one spot: the second click reaches the one beneath', () => {
    const ends = [end('under', 0, 0), end('top', 0, 1)];
    expect(pickEnd([0, 0], ends, 26, null, none)).toEqual(ref('top'));
    expect(pickEnd([0, 0], ends, 26, ref('top'), none)).toEqual(ref('under'));
  });

  /*
   * MUTATION PROOF, run: refused ends not excluded from the joinable search:
   * `expected { pieceId: 'pegs', port: +0 } to deeply equal { pieceId: 'ok',
   * port: +0 }`.
   */
  it('three on one spot with a refused middle: the joinable one wins', () => {
    const ends = [end('ok', 0, 0), end('pegs', 0, 1), end('armed', 0, 2)];
    const refused = (r: { pieceId: string }) => r.pieceId === 'pegs';
    expect(pickEnd([0, 0], ends, 26, ref('armed'), refused)).toEqual(ref('ok'));
  });

  it('a lone armed end un-selects; a lone refused end is still the one clicked', () => {
    expect(pickEnd([0, 0], [end('armed', 0, 0)], 26, ref('armed'), none)).toEqual(ref('armed'));
    const refused = (r: { pieceId: string }) => r.pieceId === 'pegs';
    expect(pickEnd([5, 0], [end('pegs', 0, 0), end('armed', 200, 1)], 26, ref('armed'), refused)).toEqual(ref('pegs'));
  });

  /*
   * MUTATION PROOF, run: the sort reversed to farthest first: `expected {
   * pieceId: 'far', port: +0 } to deeply equal { pieceId: 'near', port: +0 }`.
   */
  it('the nearer of two joinable ends wins; a tie goes to the one on top; nothing in reach is null', () => {
    expect(pickEnd([0, 0], [end('far', 20, 1), end('near', 3, 0), end('armed', 0, 2)], 26, ref('armed'), none)).toEqual(ref('near'));
    expect(pickEnd([0, 0], [end('low', 5, 0), end('high', -5, 1)], 26, null, none)).toEqual(ref('high'));
    expect(pickEnd([0, 0], [end('away', 30, 0)], 26, null, none)).toBe(null);
  });
});

describe('clickableEndsOf', () => {
  const port = (pieceId: string, level: number, free = true): RenderedPort =>
    ({ pieceId, port: 0, x: 0, y: 0, h: 0, free, level }) as unknown as RenderedPort;

  /*
   * MUTATION PROOF, run: the hidden set ignored: `expected [ 'floor',
   * 'hidden', 'raised' ] to deeply equal [ 'floor', 'raised' ]`.
   */
  it('free ends only, a floor end under raised wood left out, floor before raised', () => {
    const got = clickableEndsOf([port('raised', 1), port('floor', 0), port('hidden', 0), port('welded', 0, false)], new Set(['hidden#0']));
    expect(got.map((e) => e.ref.pieceId)).toEqual(['floor', 'raised']);
    expect(got.map((e) => e.order)).toEqual([0, 1]);
  });
});

describe('endHitRadiusMm (DR9)', () => {
  /*
   * MUTATION PROOF, run: `coarse` ignored (always 26): `expected 26 to be
   * 44`.
   */
  it('26mm with a mouse; on touch at least 22px each side', () => {
    expect(endHitRadiusMm(false, 0.5)).toBe(END_HIT_MM);
    expect(endHitRadiusMm(true, 0.5)).toBe(44);
    expect(endHitRadiusMm(true, 2)).toBe(END_HIT_MM);
  });
});
