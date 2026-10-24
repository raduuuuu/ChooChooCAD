/**
 * THE EDITOR REUSES THE PLACEMENT APP ALREADY MADE (brio-TODOS.md P1,
 * "`solveGraph` computes a second placement", the `nextRunAnchor` half).
 *
 * A palette pick with nothing selected put the new run beside the track by
 * placing the whole layout again, on every click: 58ms at 42,000 pieces. App
 * now hands the reducer its placement with the graph it is of, and the
 * reducer uses it for that graph only.
 *
 * Value: protects=the handed placement is read when the graph is the same
 * object, and ignored for any other graph
 * Value: fails_when=the reducer places afresh anyway (the cost returns), or
 * trusts a placement of a different graph (a run lands in the wrong place)
 * Value: seam=`reduce` with a placement doctored to differ from the true one,
 * so which one was read shows in where the new run starts
 * Value: no_claim=the timing itself
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { reduce, type EditorState } from './editorReducer.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

const graph: Graph = {
  pieces: [{ pieceId: 'p', partId: 'A', turn: 'left' }],
  welds: [],
  anchors: new Map<string, Frame>([['p', { pos: fromInt(0), heading: 0 }]]),
};
/** The same straight, stood on end: 144mm tall instead of flat, so the next run clears more. */
const doctored = placeAll(graph, ports, new Map([['p', { pos: fromInt(0), heading: 4 }]]));
const state: EditorState = { graph, cursor: null, armed: null };
const pickedAt = (placed?: { graph: Graph; placement: typeof doctored }) =>
  reduce(state, { kind: 'pick', partId: 'A' }, ports, { resolve, ...(placed ? { placed } : {}) }).ghost?.frame;

describe('the new run is measured on the placement handed in', () => {
  /*
   * MUTATION PROOFS, run:
   * - `placementOf` ignoring what it is handed (always `placeAll`): fails
   *   with `expected { …(2) } to not deeply equal { …(2) }`.
   * - `placementOf` skipping the identity check (`known ?` alone): fails
   *   with `expected { …(2) } to deeply equal { …(2) }`.
   */
  it('used for the same graph, ignored for any other', () => {
    const honest = pickedAt();
    expect(pickedAt({ graph, placement: doctored })).not.toEqual(honest);
    expect(pickedAt({ graph: { ...graph }, placement: doctored })).toEqual(honest);
  });
});
