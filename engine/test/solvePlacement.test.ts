/**
 * THE VERDICT READS THE PLACEMENT IT IS HANDED (brio-TODOS.md P1, "`solveGraph`
 * computes a second placement").
 *
 * Value: protects=`solveGraph` places nothing itself: where it finds a clash
 * or a crossing is where the caller's placement put the pieces
 * Value: fails_when=`solveGraph` goes back to calling `placeAll` on its own,
 * so the verdict and the drawing can read two placements
 * Value: why_new=the canvas drew from App's placement and the verdict from a
 * second one; they agreed only because `placeAll` is deterministic
 * Value: seam=`solveGraph` directly, handed a placement whose anchors differ
 * from the graph's own
 * Value: no_claim=that App passes the same placement it draws from; the
 * required parameter and App's one `placement` memo carry that
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { fromInt } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { solveGraph } from '../src/graph/solve.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** Two lone straights, a metre apart by the graph's own anchors. */
const g: Graph = {
  pieces: [
    { pieceId: 'p', partId: 'A', turn: 'left' },
    { pieceId: 'q', partId: 'A', turn: 'left' },
  ],
  welds: [],
  anchors: new Map<string, Frame>([
    ['p', { pos: fromInt(0), heading: 0 }],
    ['q', { pos: fromInt(1000), heading: 0 }],
  ]),
};
/** The same two, laid one on top of the other. */
const stacked = new Map<string, Frame>([
  ['p', { pos: fromInt(0), heading: 0 }],
  ['q', { pos: fromInt(0), heading: 0 }],
]);
const solve = (anchors?: ReadonlyMap<string, Frame>) =>
  solveGraph(g, ports, resolve, () => 0.8, placeAll(g, ports, anchors));

describe('solveGraph takes the placement, it does not make one', () => {
  /*
   * MUTATION PROOF, run: the first line of `solveGraph` re-deriving it
   * (`placement = placeAll(graph, ports);`): fails with `expected [] to have
   * a length of 2 but got +0`.
   */
  it('stacked by the placement handed in: the clash is reported there', () => {
    expect(solve().clashes).toHaveLength(0);
    expect(solve(stacked).clashes).toHaveLength(2);
  });
});
