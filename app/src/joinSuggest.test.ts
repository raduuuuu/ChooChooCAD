/**
 * ENDS THAT NEARLY MEET ARE OFFERED AS ONE-PRESS JOINS (design review 28B,
 * 2026-10-31).
 *
 * Value: protects=two free ends on one level, close and facing, get one Join
 * offer between them, and pressing it makes the same join two clicks would
 * Value: fails_when=the distance, facing or level rule is dropped, an end is
 * offered twice, a refused join is offered, or `joinEnds` does nothing
 * Value: why_new=the join had no entry point but clicking dots; nothing
 * suggested a join before
 * Value: seam=none (pure helper and the reducer, no DOM)
 * Value: no_claim=how the button looks or where it sits on screen; that is
 * the dom spec and the browser
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph, type RenderedPort } from '../../engine/src/graph/render.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { PRESETS } from './presets.js';
import { joinSuggestions, SUGGEST_JOIN_MM } from './trackPath.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const yes = () => true;

/** Near miss with its closing joint broken: a loop whose ends stop 72mm apart. */
const openedNearMiss = (): EditorState => {
  const s = reduce(START, { kind: 'preset', ids: PRESETS.find((p) => p.label === 'Near miss')!.pieces }, ports);
  const w = s.graph.welds[s.graph.welds.length - 1]!;
  return reduce(s, { kind: 'breakWeld', a: w.a, b: w.b }, ports);
};
const portsOfState = (s: EditorState) => renderGraph(s.graph, ports, resolve, placeAll(s.graph, ports)).ports;

const end = (pieceId: string, x: number, y: number, h: number, level?: number): RenderedPort => ({
  pieceId, port: 0, x, y, h, free: true, polarity: 'peg', ...(level === undefined ? {} : { level }),
});

describe('which free ends are offered a join', () => {
  /*
   * MUTATION PROOF, run: SUGGEST_JOIN_MM back to the first-proposed 60:
   * `expected [] to have a length of 1 but got +0`.
   */
  it('offers the opened Near miss loop one join, midway between its ends', () => {
    const offers = joinSuggestions(portsOfState(openedNearMiss()), yes);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.at).toEqual([-36, 0]);
    expect(offers[0]!.level).toBe(0);
  });

  /*
   * MUTATION PROOFS, run:
   * - the "each points at the other" check removed: `expected [ { …(4) } ] to
   *   have a length of +0 but got 1` (back to back).
   * - the facing check (`-Math.cos(p.h - q.h) < facing`) removed: `expected
   *   [ { …(4) } ] to have a length of +0 but got 1` (the T: one end points
   *   at the other, which points across). The side-by-side case alone did not
   *   catch this: the points-at check rejects it too (mutation run, survived).
   */
  it('offers nothing to ends back to back, side by side, too far, or on two levels', () => {
    // Back to back: facing away from each other, 40mm apart.
    expect(joinSuggestions([end('a', 0, 0, Math.PI), end('b', 40, 0, 0)], yes)).toHaveLength(0);
    // Side by side, both pointing the same way.
    expect(joinSuggestions([end('a', 0, 0, 0), end('b', 0, 40, 0)], yes)).toHaveLength(0);
    // A T: a points at b, but b points across, 90 degrees off.
    expect(joinSuggestions([end('a', 0, 0, 0), end('b', 40, 0, Math.PI / 2)], yes)).toHaveLength(0);
    // Facing, but past the limit.
    expect(joinSuggestions([end('a', 0, 0, 0), end('b', SUGGEST_JOIN_MM + 1, 0, Math.PI)], yes)).toHaveLength(0);
    // Facing and close, but one is raised.
    expect(joinSuggestions([end('a', 0, 0, 0), end('b', 40, 0, Math.PI, 1)], yes)).toHaveLength(0);
    // And the same pair, facing and close on one level, is offered.
    expect(joinSuggestions([end('a', 0, 0, 0), end('b', 40, 0, Math.PI)], yes)).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: the `used` check removed: `expected [ { …(4) }, { …(4) } ]
   * to have a length of 1 but got 2`.
   */
  it('offers each end once, to its nearest partner', () => {
    const offers = joinSuggestions([end('a', 0, 0, 0), end('b', 30, 0, Math.PI), end('c', 50, 0, Math.PI)], yes);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.b.pieceId).toBe('b');
  });

  it('never offers a join the editor would refuse', () => {
    expect(joinSuggestions(portsOfState(openedNearMiss()), () => false)).toHaveLength(0);
  });
});

describe('pressing Join makes the join', () => {
  /*
   * MUTATION PROOF, run: the reducer's `joinEnds` case returns `state`:
   * `expected 9 to be 10`.
   */
  it('welds the two ends, as arming one and clicking the other would', () => {
    const open = openedNearMiss();
    const [offer] = joinSuggestions(portsOfState(open), yes);
    const joined = reduce(open, { kind: 'joinEnds', a: offer!.a, b: offer!.b }, ports);
    expect(joined.graph.welds.length).toBe(open.graph.welds.length + 1);
    expect(joined.armed).toBeNull();
  });

  it('sets aside an end that was armed elsewhere instead of joining it', () => {
    const open = openedNearMiss();
    const [offer] = joinSuggestions(portsOfState(open), yes);
    const armedA = reduce(open, { kind: 'clickPort', ref: offer!.a }, ports);
    const joined = reduce(armedA, { kind: 'joinEnds', a: offer!.b, b: offer!.a }, ports);
    expect(joined.graph.welds.length).toBe(open.graph.welds.length + 1);
  });
});
