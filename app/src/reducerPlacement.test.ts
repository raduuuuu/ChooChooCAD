/**
 * THE EDITOR REUSES THE PLACEMENT AND THE DRAWING APP ALREADY MADE
 * (brio-TODOS.md P1, "`solveGraph` computes a second placement", the
 * `nextRunAnchor` half and its port scan; the drop's wood check).
 *
 * A palette pick with nothing selected put the new run beside the track by
 * placing the whole layout again, on every click: 58ms at 42,000 pieces. App
 * now hands the reducer its placement with the graph it is of, and the
 * reducer uses it for that graph only.
 *
 * Value: protects=the handed placement and drawing are read when the graph is
 * the same object, and ignored for any other graph
 * Value: fails_when=the reducer places afresh anyway (the cost returns), or
 * trusts a placement of a different graph (a run lands in the wrong place)
 * Value: seam=`reduce` with a placement or drawing doctored to differ from the
 * true one, so which one was read shows in where the new run starts, or in
 * whether a drop over track is refused
 * Value: no_claim=the timing itself
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll, type Placement } from '../../engine/src/graph/frames.js';
import { renderGraph, type GraphRender } from '../../engine/src/graph/render.js';
import { portsOf, type Frame, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { shiftMm } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

const graph: Graph = {
  pieces: [{ pieceId: 'p', partId: 'A', turn: 'left' }],
  welds: [],
  anchors: new Map<string, Frame>([['p', { pos: fromInt(0), heading: 0 }]]),
};
/** The same straight, stood on end: 144mm tall instead of flat, so the next run clears more. */
const doctored = placeAll(graph, ports, new Map([['p', { pos: fromInt(0), heading: 4 }]]));
const truth = placeAll(graph, ports);
const drawn = (placement: Placement): GraphRender => renderGraph(graph, ports, resolve, placement);
const state: EditorState = { graph, cursor: null, armed: null };
type Placed = { graph: Graph; placement: Placement; render: GraphRender };
const pickedAt = (placed?: Placed) =>
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
    expect(pickedAt({ graph, placement: doctored, render: drawn(doctored) })).not.toEqual(honest);
    expect(pickedAt({ graph: { ...graph }, placement: doctored, render: drawn(doctored) })).toEqual(honest);
  });

  /*
   * MUTATION PROOF, run: the reducer not handing `nextRunAnchor` the drawn
   * ends (`drawnOf(...)?.ports` dropped from both calls): fails with
   * `expected { …(2) } to not deeply equal { …(2) }`.
   */
  it('the run is measured on the drawn ends, not by placing each one again', () => {
    expect(pickedAt({ graph, placement: truth, render: drawn(doctored) })).not.toEqual(pickedAt());
  });
});

describe('a drop over track is judged on the drawing handed in', () => {
  // The straight runs 0..144 on y = 0; the new one floats 10 mm off it, so
  // only the wood check can refuse it (paletteDrop.test.ts, the crossing bug).
  const act = (st: EditorState, a: EditorAction, placed?: Placed) =>
    reduce(st, a, ports, { resolve, ...(placed ? { placed } : {}) });
  const floated = act(act(state, { kind: 'pick', partId: 'A' }), { kind: 'floatGhost', pos: shiftMm(-50, 10) });
  const dropped = (placed?: Placed) => act(floated, { kind: 'dropGhost' }, placed).graph.pieces.length;

  /*
   * MUTATION PROOFS, run:
   * - `withSegments` returning `geometry` unchanged: fails with `expected 1
   *   to be 2 // Object.is equality`.
   * - `drawnOf` skipping the identity check (`known ?` alone): fails with
   *   `expected 2 to be 1 // Object.is equality`.
   */
  it('read for the same graph, so an empty drawing lets it land; drawn afresh for any other', () => {
    expect(dropped()).toBe(1);
    const empty: GraphRender = { segments: [], ports: [] };
    expect(dropped({ graph, placement: truth, render: empty })).toBe(2);
    expect(dropped({ graph: { ...graph }, placement: truth, render: empty })).toBe(1);
  });
});
