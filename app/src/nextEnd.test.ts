/**
 * "NEXT END": WHERE IT GOES, AND CHOOSING ANOTHER END WHILE JOINING (plan
 * 2026-11-14, design DD7; eng ED4).
 *
 * Value: protects=the end after the chosen one in the list, round to the
 * first after the last, and nowhere when there is no other end; while
 * joining, `armEnd` moves the chosen end without joining anything and
 * without an Undo step, and says which end is now chosen
 * Value: fails_when=stepping stops at the last end, offers a step with one
 * end, joins the two ends instead of moving the choice, or costs an Undo step
 * Value: why_new=a second tap on another end while joining JOINS them, so
 * there was no way to say "I meant the other end" on a phone
 * Value: seam=none (pure functions and the reducer)
 * Value: no_claim=that a button sends these yet (the phone's shell, a later
 * step); which ends are in the list, which is `endsWithinReach`'s
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece, type Port, type PortRef } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { endsWithinReach, nextEndAfter, ringFor, type ClickableEnd, type EndRing } from './trackPath.js';

const ref = (pieceId: string): PortRef => ({ pieceId, port: 0 });

describe('the end after the chosen one', () => {
  /*
   * MUTATION PROOFS, run:
   * - no wrap (`reach[i + 1] ?? null`): `expected null to deeply equal
   *   { pieceId: 'a', port: 0 }`.
   * - the length guard dropped: `expected { pieceId: 'a', port: 0 } to be
   *   null` (one end steps to itself).
   */
  it('steps along the list and round again', () => {
    const reach = [ref('a'), ref('b'), ref('c')];
    expect(nextEndAfter(ref('a'), reach)).toEqual(ref('b'));
    expect(nextEndAfter(ref('b'), reach)).toEqual(ref('c'));
    expect(nextEndAfter(ref('c'), reach)).toEqual(ref('a'));
  });

  it('is nowhere with one end, with none, or when the chosen end is not listed', () => {
    expect(nextEndAfter(ref('a'), [ref('a')])).toBeNull();
    expect(nextEndAfter(ref('a'), [])).toBeNull();
    expect(nextEndAfter(ref('z'), [ref('a'), ref('b')])).toBeNull();
  });
});

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);
/** Two straights laid apart: four free ends, none joined. */
function twoRuns(): EditorState {
  let s: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
  s = act(s, { kind: 'add', partId: 'A', turn: 'left' });
  s = act({ ...s, cursor: null }, { kind: 'add', partId: 'A', turn: 'left' });
  return s;
}

describe('choosing another end while joining', () => {
  /*
   * MUTATION PROOFS, run:
   * - `armEnd` handed on to `clickPort`: `expected null to deeply equal
   *   { pieceId: 'p1', port: 0 }` (it joined the two ends, so none is chosen).
   * - `armEnd` remembering a step (`...remember(state, 'join')`): `expected
   *   [ …(3) ] to have a length of 2 but got 3`.
   */
  it('moves the chosen end, joins nothing and makes no Undo step', () => {
    const laid = twoRuns();
    const [p, q] = laid.graph.pieces.map((x) => x.pieceId) as [string, string];
    const armed = act(laid, { kind: 'clickPort', ref: { pieceId: p, port: 1 } });
    const moved = act(armed, { kind: 'armEnd', ref: { pieceId: q, port: 0 } });
    expect(moved.armed).toEqual({ pieceId: q, port: 0 });
    expect(moved.cursor).toEqual({ pieceId: q, port: 0 });
    expect(moved.graph.welds.length).toBe(0);
    expect(moved.graph).toBe(armed.graph);
    expect(moved.past).toHaveLength(armed.past!.length);
    expect(describeAction(armed, { kind: 'armEnd', ref: { pieceId: q, port: 0 } }, moved, resolve)).toMatch(
      /^Selected .+\. Choose another free end to join it to\.$/,
    );
  });

  /*
   * MUTATION PROOF, run: the `state.armed === null` guard dropped: `expected
   * { pieceId: 'p1', port: 0 } to be null` (it starts a join nobody asked for).
   */
  it('does nothing when no end is chosen, or the end is gone', () => {
    const laid = twoRuns();
    const q = laid.graph.pieces[1]!.pieceId;
    expect(act(laid, { kind: 'armEnd', ref: { pieceId: q, port: 0 } }).armed).toBeNull();
    const armed = act(laid, { kind: 'clickPort', ref: { pieceId: q, port: 0 } });
    expect(act(armed, { kind: 'armEnd', ref: { pieceId: 'gone', port: 0 } })).toBe(armed);
  });
});

describe('the ring Next end walks', () => {
  const end = (pieceId: string, x: number, order: number): ClickableEnd => ({ ref: ref(pieceId), x, y: 0, order });
  // a and b are 3mm apart; c is 20mm from a: all three within one tap of a.
  const ENDS = [end('a', 0, 0), end('b', 3, 1), end('c', 20, 2)];
  /** Press Next end `presses` times starting from a tap on `a`, as App does. */
  const walk = (presses: number) => {
    let ring: EndRing | null = null;
    let chosen = ref('a');
    const seen = [chosen.pieceId];
    for (let i = 0; i < presses; i++) {
      ring = ringFor(ring, chosen);
      const next = nextEndAfter(chosen, endsWithinReach(ring.anchor, ENDS, 1))!;
      ring = { anchor: ring.anchor, stepped: next };
      chosen = next;
      seen.push(chosen.pieceId);
    }
    return seen;
  };

  /*
   * MUTATION PROOF, run: `ringFor` anchoring on the chosen end every time:
   * `expected [ 'a', 'b', 'a', 'b' ] to deeply equal [ 'a', 'b', 'c', 'a' ]`
   * (the two close ends hand the choice back and forth; c is never reached).
   */
  it('gives every end in reach its turn, then comes round', () => {
    expect(walk(3)).toEqual(['a', 'b', 'c', 'a']);
  });

  /*
   * MUTATION PROOF, run: `ringFor` always keeping the old ring: `expected
   * { …(2) } to deeply equal { …(2) }` (a tap on c is still walked from a).
   */
  it('a tap on another end starts a new ring there', () => {
    const stepped: EndRing = { anchor: ref('a'), stepped: ref('b') };
    expect(ringFor(stepped, ref('b'))).toBe(stepped);
    expect(ringFor(stepped, ref('c'))).toEqual({ anchor: ref('c'), stepped: null });
    expect(ringFor(null, ref('c')).anchor).toEqual(ref('c'));
  });
});
