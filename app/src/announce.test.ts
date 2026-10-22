/**
 * EVERY EDITING ACTION SAYS WHAT IT DID, AND NOTHING SAYS WHAT DID NOT HAPPEN.
 *
 * Value: protects=the region-3 sentence names the pieces and ends the way the
 * graph listing does, for every action, and is null when an action changed
 * nothing
 * Value: fails_when=a sentence names the wrong end or piece, joining and
 * selecting are confused, or a no-op announces itself
 * Value: why_new=U7b adds per-action announcements
 * Value: seam=`describeAction` is pure; the reducer supplies real states
 * Value: no_claim=nothing about whether a screen reader speaks it, which the
 * live region in App.tsx and `GraphListing.dom.test.tsx` cover
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { initialEditor, reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { addPiece, EMPTY_GRAPH } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const step = (s: EditorState, action: EditorAction) => {
  const next = reduce(s, action, ports);
  return { next, said: describeAction(s, action, next, resolve) };
};
const chain = (n: number): EditorState => {
  let s = START;
  for (let i = 0; i < n; i++) s = reduce(s, { kind: 'add', partId: 'E', turn: 'left' }, ports);
  return s;
};

/*
 * AN OPEN CHAIN, built piece by piece WITHOUT auto-join. Since decision D13 an
 * eighth large curve placed by hand closes the circle by itself, so a chain of
 * eight built through `reduce` is a loop. These specs need the open chain a
 * layout restored from storage can still hold, so it is built from the model.
 */
const openChain = (n: number, partId = 'E'): EditorState => {
  let graph = EMPTY_GRAPH;
  let at: PortRef | null = null;
  for (let i = 0; i < n; i++) {
    const next = addPiece(graph, partId, 'left', portsOf(resolve(partId)).length, at, ports);
    graph = next.graph;
    at = next.select;
  }
  return initialEditor(graph, ports);
};

describe('describeAction', () => {
  it('says where a placed piece went', () => {
    expect(step(START, { kind: 'add', partId: 'E', turn: 'left' }).said).toBe(
      'Added piece 1, Large curve (E), starting a new run.',
    );
    expect(step(chain(1), { kind: 'add', partId: 'A', turn: 'left' }).said).toBe(
      'Added piece 2, Medium straight (A), joined to the end of piece 1.',
    );
  });

  /*
   * MUTATION PROOF, run: delete the join branch from the `clickPort` case.
   * Fails with `expected 'Selection cleared.' to be 'Joined the end of piece 8
   * to the start of piece 1.'`: a join would be announced as a cancel. (Swapping
   * the join and select checks does NOT fail it, because a join leaves nothing
   * armed, so the select branch cannot fire first.)
   */
  it('tells selecting, joining and clearing apart', () => {
    const s = openChain(8);
    const end8 = { pieceId: s.graph.pieces[7]!.pieceId, port: 1 };
    const start1 = { pieceId: s.graph.pieces[0]!.pieceId, port: 0 };
    const sel = step(s, { kind: 'clickPort', ref: end8 });
    expect(sel.said).toBe('Selected the end of piece 8. Choose another free end to join it to.');
    expect(step(sel.next, { kind: 'clickPort', ref: start1 }).said).toBe(
      'Joined the end of piece 8 to the start of piece 1.',
    );
    expect(step(sel.next, { kind: 'clickPort', ref: end8 }).said).toBe('Selection cleared.');
  });

  it('names both ends of a broken joint, and what an undo reversed', () => {
    const s = chain(4);
    const w = s.graph.welds[1]!;
    const broke = step(s, { kind: 'breakWeld', a: w.a, b: w.b });
    expect(broke.said).toBe('Broke the joint between the end of piece 2 and the start of piece 3.');
    expect(step(broke.next, { kind: 'undo' }).said).toBe('Undid the break. The joint is back.');
    expect(step(chain(2), { kind: 'undo' }).said).toBe('Undid the last piece.');
  });

  it('says what Remove last, Clear and a preset did', () => {
    expect(step(chain(3), { kind: 'removeLast' }).said).toBe('Removed piece 3, Large curve (E).');
    expect(step(chain(3), { kind: 'clear' }).said).toBe('Cleared the layout.');
    expect(step(START, { kind: 'preset', ids: Array(8).fill('E') }).said).toBe('Loaded a layout of 8 pieces.');
  });

  /*
   * MUTATION PROOF, run: delete the `prev === next` guard. Fails with
   * `expected 'Removed piece 0.' to be null`.
   */
  it('says nothing when the action changed nothing', () => {
    expect(step(START, { kind: 'undo' }).said).toBeNull();
    expect(step(START, { kind: 'removeLast' }).said).toBeNull();
    const s = chain(2);
    const free = { pieceId: s.graph.pieces[1]!.pieceId, port: 1 };
    expect(step(s, { kind: 'breakWeld', a: free, b: free }).said).toBeNull();
  });
});
