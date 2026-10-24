/**
 * A REFUSED JOINT IS MARKED WHERE IT IS, AND SAID WITH EVERYTHING ELSE RED
 * (brio-TODOS.md P2, "The polarity marker, and three things it does not yet
 * do").
 *
 * Value: protects=both ends of a refused weld are marked when they are apart,
 * whichever was clicked first; a clash already drawn on a spot holds it, and
 * a joint left with no mark is counted; the IMPOSSIBLE sentence names the
 * clashes and crossings beside the refused joints instead of only the joints
 * Value: fails_when=the mark goes back to end `a` alone, the bar is drawn
 * inside a clash's X again, or the sentence drops the clashes when there are
 * refused joints too
 * Value: why_new=limits 1, 2 and 3 of that entry, filed 2026-10-16 and left
 * open; the resolution in App.tsx had no spec of its own, only its drawing
 * Value: seam=the real engine (`placeAll`, `renderGraph`, `solveGraph`) on a
 * self-welded B2, the entry's own reproduction, then `badJointMarks` and
 * `VerdictLine` as App calls them
 * Value: no_claim=App's wiring of the two (`refusedMarks`), which is three
 * lines and runs in every App dom test
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Weld } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { badJointMarks } from './trackPath.js';
import { VerdictLine } from './VerdictLine.js';
import { viewOf } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** One B2, its two pegs welded to each other: the Codex reproduction. */
const selfWeld = (w: Weld): Graph => ({
  pieces: [{ pieceId: 'p', partId: 'B2', turn: 'left' }],
  welds: [w],
  anchors: new Map<string, Frame>([['p', { pos: fromInt(0), heading: 0 }]]),
});
const marksOf = (g: Graph, taken: readonly (readonly [number, number])[] = []) => {
  const placement = placeAll(g, ports);
  const result = solveGraph(g, ports, resolve, () => 0.8, placement);
  return badJointMarks(
    result.polarityViolations.map((v) => v.weld),
    g.welds,
    renderGraph(g, ports, resolve, placement).ports,
    taken,
  );
};
const xs = (m: ReturnType<typeof marksOf>) => m.marks.map(([x]) => Math.round(x)).sort((a, b) => a - b);

describe('a refused joint is marked at both ends', () => {
  /*
   * MUTATION PROOF, run: end `a` alone (`[w.a]` in place of `[w.a, w.b]`):
   * fails with `expected [ +0 ] to deeply equal [ +0, 54 ]`.
   */
  it('whichever end was clicked first', () => {
    const forward = marksOf(selfWeld({ a: { pieceId: 'p', port: 0 }, b: { pieceId: 'p', port: 1 } }));
    const backward = marksOf(selfWeld({ a: { pieceId: 'p', port: 1 }, b: { pieceId: 'p', port: 0 } }));
    expect(xs(forward)).toEqual([0, 54]);
    expect(xs(backward)).toEqual([0, 54]);
  });

  it('once, where the two ends meet', () => {
    // Two B2s, peg to peg at x = 54: a tree weld, both ends on one spot.
    const g: Graph = {
      pieces: [
        { pieceId: 'p', partId: 'B2', turn: 'left' },
        { pieceId: 'q', partId: 'B2', turn: 'left' },
      ],
      welds: [{ a: { pieceId: 'p', port: 1 }, b: { pieceId: 'q', port: 0 } }],
      anchors: new Map<string, Frame>([['p', { pos: fromInt(0), heading: 0 }]]),
    };
    expect(xs(marksOf(g))).toEqual([54]);
  });

  /*
   * MUTATION PROOFS, run:
   * - the clash spots ignored (`taken.some(...)` always false): fails with
   *   `expected [ +0, 54 ] to deeply equal [ 54 ]`.
   * - `hidden` never counted: fails with `expected +0 to be 1 // Object.is
   *   equality`.
   */
  it('a clash drawn on the spot holds it, and a joint with no mark left is counted', () => {
    const g = selfWeld({ a: { pieceId: 'p', port: 0 }, b: { pieceId: 'p', port: 1 } });
    const one = marksOf(g, [[0, 0]]);
    expect(xs(one)).toEqual([54]);
    expect(one.hidden).toBe(0);
    const both = marksOf(g, [[0, 0], [54, 0]]);
    expect(both.marks).toEqual([]);
    expect(both.hidden).toBe(1);
  });
});

describe('the sentence names every red mark', () => {
  /** The self-welded B2, and two loose straights laid on top of each other far away. */
  const g: Graph = {
    pieces: [
      { pieceId: 'p', partId: 'B2', turn: 'left' },
      { pieceId: 'q', partId: 'A', turn: 'left' },
      { pieceId: 'r', partId: 'A', turn: 'left' },
    ],
    welds: [{ a: { pieceId: 'p', port: 0 }, b: { pieceId: 'p', port: 1 } }],
    anchors: new Map<string, Frame>([
      ['p', { pos: fromInt(0), heading: 0 }],
      ['q', { pos: fromInt(1000), heading: 0 }],
      ['r', { pos: fromInt(1000), heading: 0 }],
    ]),
  };
  const text = (polarityUnmarked = 0) => {
    const result = solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports));
    return renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(result), polarityUnmarked })).replace(/<[^>]+>/g, '');
  };

  /*
   * MUTATION PROOF, run: the clash clause removed from the refused-joint
   * sentence: fails with `expected 'XCan’t be built. 1 joint puts two end…'
   * to contain 'And 2 spots have two or more track en…'`.
   */
  it('refused joints and clashes together, and how many joints have no mark', () => {
    expect(text()).toContain('Can’t be built. 1 joint puts two ends of the same kind together, and those do not fit.');
    expect(text()).toContain('And 2 spots have two or more track ends on top of each other.');
    expect(text(1)).toContain('1 is not marked, because a clash is drawn there.');
  });
});
