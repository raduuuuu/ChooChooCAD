/**
 * WHICH ENDS "NEXT END" STEPS THROUGH (plan 2026-11-14, design DD7; eng ED4).
 *
 * Value: protects=the list is the chosen end first, then the other reachable
 * free ends within a tap's radius of it, nearest first, equal distances in
 * the order laid; the radius is a tap's at the scale shown (never under 44px
 * across); an end that is gone or hidden gives an empty list
 * Value: fails_when=the chosen end is missing or not first, a far end is
 * offered, a nearer end comes after a farther one, a tie flips order between
 * renders, or the radius ignores the scale
 * Value: why_new=on a phone two ends 3mm apart sit under one fingertip, and
 * nothing let the user say "the other one"
 * Value: seam=none (pure)
 * Value: no_claim=that a button calls this yet (the phone's shell, a later
 * step); which ends the canvas hides, which is `clickableEndsOf`'s
 */

import { describe, expect, it } from 'vitest';
import type { PortRef } from '../../engine/src/graph/model.js';
import { END_HIT_MM, endsWithinReach, type ClickableEnd } from './trackPath.js';

const end = (pieceId: string, x: number, y: number, order: number): ClickableEnd => ({ ref: { pieceId, port: 0 }, x, y, order });
const ids = (refs: readonly PortRef[]) => refs.map((r) => r.pieceId);
const CHOSEN: PortRef = { pieceId: 'c', port: 0 };
/** One screen pixel a millimetre: the radius is the drawn 26mm. */
const LARGE = 1;

describe('the ends within reach of the chosen end', () => {
  /*
   * MUTATION PROOFS, run:
   * - no radius filter: `expected [ 'c', 'near', 'far', 'out' ] to deeply
   *   equal [ 'c', 'near', 'far' ]`.
   * - sorted farthest first: `expected [ 'c', 'far', 'near' ] to deeply
   *   equal [ 'c', 'near', 'far' ]`.
   * - the chosen end not put first (sorted by drawing order alone): `expected
   *   [ 'far', 'near', 'c' ] to deeply equal [ 'c', 'near', 'far' ]`.
   */
  it('the chosen end first, then nearest first; an end past the radius is left out', () => {
    const ends = [end('far', 20, 0, 0), end('near', 5, 0, 1), end('c', 0, 0, 2), end('out', END_HIT_MM + 1, 0, 3)];
    expect(ids(endsWithinReach(CHOSEN, ends, LARGE))).toEqual(['c', 'near', 'far']);
  });

  /*
   * MUTATION PROOF, run: the tie broken by `q.e.order - p.e.order` (the one
   * on top first, as `pickEnd` does): `expected [ 'c', 'second', 'first' ]
   * to deeply equal [ 'c', 'first', 'second' ]`.
   */
  it('ends the same distance away keep the order they were laid in', () => {
    const ends = [end('c', 0, 0, 0), end('first', 10, 0, 1), end('second', -10, 0, 2)];
    expect(ids(endsWithinReach(CHOSEN, ends, LARGE))).toEqual(['c', 'first', 'second']);
    expect(ids(endsWithinReach(CHOSEN, [...ends].reverse(), LARGE))).toEqual(['c', 'first', 'second']);
  });

  /*
   * A layout shown small: 0.2px a millimetre, so a 44px tap covers 110mm
   * each way. An end 100mm off is under the same fingertip.
   *
   * MUTATION PROOF, run: the radius fixed at `END_HIT_MM`: `expected [ 'c' ]
   * to deeply equal [ 'c', 'wide' ]`.
   */
  it('the radius is a tap’s at the scale shown, never under 44px across', () => {
    const ends = [end('c', 0, 0, 0), end('wide', 100, 0, 1)];
    expect(ids(endsWithinReach(CHOSEN, ends, LARGE))).toEqual(['c']);
    expect(ids(endsWithinReach(CHOSEN, ends, 0.2))).toEqual(['c', 'wide']);
  });

  /*
   * MUTATION PROOF, run: a missing chosen end measured from the origin
   * instead of returning nothing: `expected [ { pieceId: 'near', port: +0 } ] to
   * deeply equal []`.
   */
  it('a chosen end that is hidden or gone has nothing to step through', () => {
    expect(endsWithinReach(CHOSEN, [end('near', 5, 0, 0)], LARGE)).toEqual([]);
    expect(endsWithinReach(CHOSEN, [], LARGE)).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: the chosen end found by its piece alone: `expected
   * [ { pieceId: 'c', port: 1 }, …(1) ] to deeply equal [ { pieceId: 'c',
   * port: +0 }, …(1) ]`.
   */
  it('two ends of one piece are told apart by their end, not the piece', () => {
    const ends: ClickableEnd[] = [
      { ref: { pieceId: 'c', port: 1 }, x: 4, y: 0, order: 0 },
      { ref: { pieceId: 'c', port: 0 }, x: 0, y: 0, order: 1 },
    ];
    expect(endsWithinReach(CHOSEN, ends, LARGE)).toEqual([
      { pieceId: 'c', port: 0 },
      { pieceId: 'c', port: 1 },
    ]);
  });
});
