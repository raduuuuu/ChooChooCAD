/**
 * AN EXACT JOIN MOVES NO TRACK (backlog D7, ENG-R5 of the 2026-10-22 editing
 * plan).
 *
 * The probe this pins: run A, one straight, declared first; run B, a loop
 * through a switch that misses by a long way. A is laid so its end meets the
 * switch's spare road exactly, facing it, and the two are welded. Nothing
 * should move. It moved three of B's pieces 507 to 611 mm and turned them,
 * because the forest walked each component from its first-declared piece:
 * after the join B was entered at the switch, and a different weld became the
 * loop's gap.
 *
 * Value: protects=welding two ends that already meet leaves every piece where
 * it was drawn, wherever the walk enters
 * Value: fails_when=which welds close a loop depends on where the walk starts
 * Value: why_new=the before/after frame guards (D19, eng D6) refuse or
 * announce such moves; nothing made them impossible
 * Value: seam=none (spanningForest and placeAll, pure)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { toXY } from '../src/geom/cyclotomic.js';
import { placeAll, portFrame } from '../src/graph/frames.js';
import { spanningForest } from '../src/graph/forest.js';
import { norm16, portsOf, type Frame, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

/*
 * Run B, built the way the app builds one, piece after piece: three large
 * curves, then switch L entered at its heel (0) with its curved road (2)
 * carrying on, three more curves and a medium straight, and the straight
 * welded back to the first curve. Eight curves would close; seven and a
 * straight do not, so that last weld is far apart. The switch's straight
 * road (1) is the spare end, MID-loop: that is what makes the entry point
 * matter.
 */
const B_PIECES: Piece[] = [
  { pieceId: 'c0', partId: 'E', turn: 'left' },
  { pieceId: 'c1', partId: 'E', turn: 'left' },
  { pieceId: 'c2', partId: 'E', turn: 'left' },
  { pieceId: 'sw', partId: 'L', turn: 'left' },
  { pieceId: 'c3', partId: 'E', turn: 'left' },
  { pieceId: 'c4', partId: 'E', turn: 'left' },
  { pieceId: 'c5', partId: 'E', turn: 'left' },
  { pieceId: 's', partId: 'A', turn: 'left' },
];
const w = (a: string, ap: number, b: string, bp: number): Weld => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } });
const B_WELDS: Weld[] = [
  w('c0', 1, 'c1', 0),
  w('c1', 1, 'c2', 0),
  w('c2', 1, 'sw', 0),
  w('sw', 2, 'c3', 0),
  w('c3', 1, 'c4', 0),
  w('c4', 1, 'c5', 0),
  w('c5', 1, 's', 0),
  w('s', 1, 'c0', 0),
];
const RUN_A: Piece = { pieceId: 'a', partId: 'A', turn: 'left' };

/** Where run A must sit so its port 0 meets the switch's spare road, facing it. */
function anchorForA(): Frame {
  const bOnly: Graph = { pieces: B_PIECES, welds: B_WELDS };
  const spare = portFrame(placeAll(bOnly, ports), ports, B_PIECES[3]!, 1);
  // Lay A welded to the spare road and read where that puts it.
  const joined: Graph = {
    pieces: [...B_PIECES, RUN_A],
    welds: [...B_WELDS, { a: { pieceId: 'sw', port: 1 }, b: { pieceId: 'a', port: 0 } }],
  };
  const frame = placeAll(joined, ports).frames.get('a')!;
  // Sanity: A's port 0 is on the spare road, facing it.
  const end = portFrame(placeAll(joined, ports), ports, RUN_A, 0);
  expect(end.pos).toEqual(spare.pos);
  expect(end.heading).toBe(norm16(spare.heading + 8));
  return frame;
}

describe('an exact join moves no track', () => {
  /*
   * MUTATION PROOF, run: forest.ts back to leaving over whatever its walk did
   * not use (the code before D7): the join spec fails with `expected [ { id:
   * 'c3', mm: 292.9, …(1) }, …(3) ] to deeply equal []`, and the declaration
   * spec with `expected [ 3 ] to deeply equal [ 7 ]`.
   */
  it('joining a run declared first onto the spare road of a gappy loop', () => {
    // Before: two runs, A declared FIRST, each anchored where it is drawn.
    const before: Graph = {
      pieces: [RUN_A, ...B_PIECES],
      welds: B_WELDS,
      anchors: new Map([
        ['a', anchorForA()],
        ['c0', placeAll({ pieces: B_PIECES, welds: B_WELDS }, ports).frames.get('c0')!],
      ]),
    };
    const after: Graph = {
      ...before,
      welds: [...B_WELDS, { a: { pieceId: 'sw', port: 1 }, b: { pieceId: 'a', port: 0 } }],
    };
    const was = placeAll(before, ports).frames;
    const now = placeAll(after, ports).frames;
    const moved = [...was.keys()]
      .map((id) => {
        const [x0, y0] = toXY(was.get(id)!.pos);
        const [x1, y1] = toXY(now.get(id)!.pos);
        return { id, mm: Math.round(Math.hypot(x1 - x0, y1 - y0) * 10) / 10, turned: now.get(id)!.heading !== was.get(id)!.heading };
      })
      .filter((m) => m.mm > 1e-6 || m.turned);
    expect(moved).toEqual([]);
  });

  it('the welds that close loops do not depend on which piece is declared first', () => {
    const forward = spanningForest({ pieces: [RUN_A, ...B_PIECES], welds: B_WELDS });
    // The same loop, declared from the switch: the walk now starts mid-loop.
    const fromSwitch = spanningForest({ pieces: [...B_PIECES.slice(3), ...B_PIECES.slice(0, 3)], welds: B_WELDS });
    expect(fromSwitch.closing).toEqual(forward.closing);
    // The last weld declared is the one that closes, as on a chain.
    expect(forward.closing).toEqual([B_WELDS.length - 1]);
  });
});
