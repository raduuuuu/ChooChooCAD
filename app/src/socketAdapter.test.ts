/**
 * SOCKET TO SOCKET, WHILE PLACING AND MOVING (socket adapter plan, items 1
 * and 4; X1; outside voice OV1, OV3, OV5).
 *
 * Value: protects=an adapter way round is offered after every ordinary way,
 * reachable by R, never chosen by default, counted when made, and a drag snap
 * prefers an ordinary joint only among moves that would be accepted
 * Value: fails_when=the adapter way is de-duplicated away, R cannot reach it,
 * a default or a moved preview lands it, or a snap preference refuses a drop
 * that fits
 * Value: why_new=socket-to-socket was refused everywhere before
 * Value: seam=none (the pure model and reducer)
 * Value: no_claim=the pointer path (browser) and the wording (socketAdapter
 * dom spec)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { placeAll, portFrame } from '../../engine/src/graph/frames.js';
import { frameForPortAt, opposed, portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import {
  addPiece,
  defaultFit,
  EMPTY_GRAPH,
  fitOptions,
  frameAt,
  ghostFit,
  moveRun,
  rotateCycle,
  shiftMm,
  snapRunMove,
} from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports, { resolve });

/** A whole-mm position plus a heading in sixteenths of a turn. */
const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc,
  heading,
});

/** One medium straight from the origin: its start (port 0) is a socket, its far end a peg. */
const oneStraight = () => addPiece(EMPTY_GRAPH, 'A', 'left', 2, null, ports).graph;

describe('the ways a part can go on at a socket end', () => {
  /*
   * MUTATION PROOFS, run:
   * - the adapter flag left out of the de-duplication key: the straight
   *   spec fails with `expected [ { port: 1, turn: 'right' } ] to have a
   *   length of 2 but got 1` (the adapter way merged into the ordinary one).
   * - adapter ways not sorted last: the curve spec fails with `expected [
   *   false, true, false, true ] to deeply equal [ false, false, true, true ]`.
   */
  it('a straight onto a straight’s start: the ordinary way, then the adapter way', () => {
    const g = oneStraight();
    const start = { pieceId: g.pieces[0]!.pieceId, port: 0 };
    expect(ports(g.pieces[0]!)[0]!.polarity).toBe('socket');
    const { options, refused } = fitOptions(g, ports, start, 'A');
    expect(refused).toBe(false);
    expect(options).toHaveLength(2);
    expect(options[0]!.adapter).toBeUndefined();
    expect(options[1]!.adapter).toBe(true);
  });

  it('a curve: both ordinary bends come before either adapter bend', () => {
    const g = oneStraight();
    const { options } = fitOptions(g, ports, { pieceId: g.pieces[0]!.pieceId, port: 0 }, 'E');
    expect(options.map((o) => o.adapter === true)).toEqual([false, false, true, true]);
    expect(options[0]!.adapter === true).toBe(false);
  });

  it('a two-socket piece on a socket: only adapter ways, offered, not refused', () => {
    const g = oneStraight();
    const startRef = { pieceId: g.pieces[0]!.pieceId, port: 0 };
    const { options, refused } = fitOptions(g, ports, startRef, 'C');
    expect(refused).toBe(false);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o.adapter)).toBe(true);
    const fit = ghostFit(g, ports, { partId: 'C', at: startRef, frame: null, ...options[0]! });
    expect(fit.conflicts).toEqual([]);
    expect(fit.adapterHere).toBe(true);
  });

  it('a two-peg piece on a peg is still refused, peg on peg', () => {
    const g = oneStraight();
    const far = { pieceId: g.pieces[0]!.pieceId, port: 1 };
    expect(fitOptions(g, ports, far, 'B').refused).toBe(true);
    const fit = ghostFit(g, ports, { partId: 'B', at: far, frame: null, port: 0, turn: 'left' });
    expect(fit.conflicts).toEqual([{ kind: 'here', polarity: 'peg' }]);
  });
});

describe('R reaches the adapter way; the default never lands it', () => {
  /*
   * MUTATION PROOFS, run:
   * - `rotateCycle` back to the same turn only: the straight's R spec fails
   *   with `expected 1 to be +0` (R did nothing; Flip is hidden for straights).
   * - `ghostAt` keeping the old turn among adapter ways too (OV5): the moved
   *   preview spec fails with `expected +0 to be 1`, the adapter way landed.
   * - `defaultFit` counting an adapter fit as closing: the gap spec fails with
   *   `expected { port: 1, turn: 'left' } to deeply equal { port: 1, turn:
   *   'right' }` (the second ordinary way, whose far join needs an adapter).
   */
  it('R on a straight at a socket end steps to the adapter way and back', () => {
    const picked = act({ ...START, graph: oneStraight(), cursor: null }, { kind: 'pick', partId: 'A' });
    const g = picked.graph;
    const atStart = act(picked, { kind: 'moveGhost', ref: { pieceId: g.pieces[0]!.pieceId, port: 0 } });
    expect(atStart.ghost!.port).toBe(1);
    const turned = act(atStart, { kind: 'rotateGhost' });
    expect(turned.ghost!.port).toBe(0);
    const back = act(turned, { kind: 'rotateGhost' });
    expect(back.ghost!.port).toBe(1);
    expect(rotateCycle(fitOptions(g, ports, { pieceId: g.pieces[0]!.pieceId, port: 0 }, 'A').options, 'left').length).toBe(2);
  });

  it('a preview moved from a peg end to a socket end lands the ordinary way', () => {
    const g = oneStraight();
    const id = g.pieces[0]!.pieceId;
    const atPeg = act({ ...START, graph: g, cursor: { pieceId: id, port: 1 } }, { kind: 'pick', partId: 'A' });
    expect(atPeg.ghost!.turn).toBe('left');
    const moved = act(atPeg, { kind: 'moveGhost', ref: { pieceId: id, port: 0 } });
    expect(moved.ghost!.port).toBe(1);
  });

  it('closing a gap never chooses an adapter over an ordinary way', () => {
    // A curve at a straight's start. A curve's adapter way lies on the same
    // arc as the ordinary way of the other turn, ends swapped, so a target at
    // the far end of the SECOND adapter way is met plainly by it and with an
    // adapter by the second ordinary way; the first ordinary way meets
    // nothing. Every fit that closes needs an adapter somewhere, so the
    // default must be the first ordinary way, unchanged.
    const g0 = oneStraight();
    const startRef = { pieceId: g0.pieces[0]!.pieceId, port: 0 };
    const { options } = fitOptions(g0, ports, startRef, 'E');
    const adapterWay = options.filter((o) => o.adapter)[1]!;
    const frame = frameAt(g0, ports, placeAll(g0, ports), startRef, 'E', adapterWay);
    const probe: Piece = { pieceId: 'probe', partId: 'E', turn: adapterWay.turn };
    const own = placeAll({ pieces: [probe], welds: [], anchors: new Map([['probe', frame]]) }, ports);
    const farEnd = portFrame(own, ports, probe, 1 - adapterWay.port);
    // A straight whose start (a socket) faces that far end (a peg).
    const target: Piece = { pieceId: 'target', partId: 'A', turn: 'left' };
    const anchor = frameForPortAt(ports(target)[0]!.at, opposed(farEnd));
    const g: Graph = {
      pieces: [...g0.pieces, target],
      welds: g0.welds,
      anchors: new Map([...(g0.anchors ?? []), [g0.pieces[0]!.pieceId, placeAll(g0, ports).frames.get(g0.pieces[0]!.pieceId)!], ['target', anchor]]),
    };
    const closing = ghostFit(g, ports, { partId: 'E', at: startRef, frame: null, ...adapterWay });
    expect(closing.joinsTo).not.toBeNull();
    expect(closing.adapterHere).toBe(true);
    expect(ghostFit(g, ports, { partId: 'E', at: startRef, frame: null, ...options[1]! }).joins).toEqual([
      { to: { pieceId: 'target', port: 0 }, adapter: true },
    ]);
    expect(defaultFit(g, ports, startRef, 'E')).toEqual(options[0]);
  });
});

describe('joins made with an adapter are counted', () => {
  /*
   * MUTATION PROOF, run: `autoJoin` never counting adapters: fails with
   * `expected +0 to be 1`.
   */
  it('a run moved so its start faces another start joins with one adapter', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A', turn: 'left' },
        { pieceId: 'r', partId: 'A', turn: 'left' },
      ],
      welds: [],
      // a's start (socket) at the origin faces -x; r is turned round and far away.
      anchors: new Map([
        ['a', at(0, 0, 0)],
        ['r', at(0, 500, 8)],
      ]),
    };
    // r turned round has its start at its anchor, facing +x: put it at the origin.
    const result = moveRun(g, ports, 'r', { turns: 0, by: shiftMm(0, -500) }, { resolve });
    expect(result.refused).toBeNull();
    expect(result.joined).toBe(1);
    expect(result.adapters).toBe(1);
  });
});

describe('a drag snap prefers an ordinary joint only among moves that fit (OV3)', () => {
  /*
   * A medium straight `a0` from the origin (its far end, a peg, at x = 144
   * facing +x); a straight `a2` turned round with its start (a socket) facing
   * +x; and the run `r`, a straight far away, dragged so its start (a socket)
   * lands near both: `a0`'s peg is an ordinary target, `a2`'s socket an
   * adapter one, nearer.
   *
   * MUTATION PROOFS, run:
   * - candidates ranked by distance only: the first spec fails with `expected
   *   { turns: +0, …(1) } to deeply equal { turns: +0, …(1) }` (the nearer
   *   adapter target won).
   * - no acceptance check (the first ranked candidate always wins): the second
   *   spec fails the same way (the ordinary snap, which lies over a2, won).
   */
  const graphWith = (a2: Frame): Graph => ({
    pieces: [
      { pieceId: 'a0', partId: 'A', turn: 'left' },
      { pieceId: 'a2', partId: 'A', turn: 'left' },
      { pieceId: 'r', partId: 'A', turn: 'left' },
    ],
    welds: [],
    anchors: new Map([
      ['a0', at(0, 0, 0)],
      ['a2', a2],
      ['r', at(400, 200, 0)],
    ]),
  });

  it('both fit: the ordinary target wins over a nearer adapter one', () => {
    const g = graphWith(at(150, 50, 8));
    const dragged = { turns: 0, by: shiftMm(148 - 400, 40 - 200) };
    const snapped = snapRunMove(g, ports, 'r', dragged, 100, { resolve });
    expect(snapped).toEqual({ turns: 0, by: shiftMm(144 - 400, 0 - 200) });
  });

  it('the ordinary snap would lie over track: the adapter snap is used, not refused', () => {
    const g = graphWith(at(150, 10, 8));
    const dragged = { turns: 0, by: shiftMm(149 - 400, 8 - 200) };
    const snapped = snapRunMove(g, ports, 'r', dragged, 100, { resolve });
    expect(snapped).toEqual({ turns: 0, by: shiftMm(150 - 400, 10 - 200) });
    expect(moveRun(g, ports, 'r', snapped, { resolve }).refused).toBeNull();
  });
});
