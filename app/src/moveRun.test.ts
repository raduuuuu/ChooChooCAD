/**
 * MOVING A WHOLE RUN, EXACTLY (decisions E6, D10, D14, D13/D20, eng D6).
 *
 * Value: protects=a run moves rigidly by whole millimetres and 22.5 degree
 * turns with every frame exact, so a closed loop stays closed; a move that
 * would put an end on an end it cannot join is refused and changes nothing; a
 * facing landing of the other kind joins, including into a loop that does not
 * close, without moving any of it
 * Value: fails_when=the move rounds, turns about the wrong point, moves more or
 * less than the run, lets a clash through, or a join re-lays track
 * Value: why_new=moving placed track is new
 * Value: seam=none (the pure model)
 * Value: no_claim=the overlap geometry itself; overlap.ts and
 * engine/test/plankOverlap.test.ts own it
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { add, sub, toXY } from '../../engine/src/geom/cyclotomic.js';
import { placeAll, portFrame, residuals } from '../../engine/src/graph/frames.js';
import { frameForPortAt, opposed, portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { addPiece, EMPTY_GRAPH, moveRun, shiftMm, snapRunMove, weldEnds } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const count = (id: string) => portsOf(resolve(id)).length;

const chain = (ids: readonly string[], from: Graph = EMPTY_GRAPH, anchor?: Parameters<typeof addPiece>[7]) => {
  let graph = from;
  let at: ReturnType<typeof addPiece>['select'] = null;
  ids.forEach((id, i) => {
    const next = addPiece(graph, id, 'left', count(id), at, ports, undefined, i === 0 ? anchor : undefined);
    graph = next.graph;
    at = next.select;
  });
  return { graph, at: at! };
};
const frames = (g: Graph) => placeAll(g, ports).frames;

describe('a run moves rigidly', () => {
  /*
   * MUTATION PROOFS, run:
   * - turning about the model origin instead of the grabbed piece: the pivot
   *   spec fails with `expected [ +0, +0, +0, +0, +0, 202, +0, 202 ] to deeply
   *   equal [ +0, +0, 202, +0, 202, +0, +0, +0 ]` (the pivot moved).
   * - the heading not turned: the same spec fails, the pivot landing elsewhere.
   * - the run's own ends counted as obstacles: the plain shift is refused,
   *   `expected 'two ends of the same kind would meet' to be null`.
   */
  it('shifts every piece of the run by exactly the whole millimetres asked', () => {
    const { graph } = chain(['A', 'E', 'A']);
    const { graph: moved, refused } = moveRun(graph, ports, graph.pieces[1]!.pieceId, { turns: 0, by: shiftMm(100, -30) });
    expect(refused).toBeNull();
    const was = frames(graph);
    for (const [id, f] of frames(moved)) {
      expect(f.pos, id).toEqual(add(was.get(id)!.pos, shiftMm(100, -30)));
      expect(f.heading, id).toBe(was.get(id)!.heading);
    }
    expect(moved.welds).toEqual(graph.welds);
  });

  it('turns about the grabbed piece, and a closed loop still closes', () => {
    let { graph, at } = chain(Array(8).fill('E'));
    graph = weldEnds(graph, at, { pieceId: graph.pieces[0]!.pieceId, port: 0 });
    const grabbed = graph.pieces[3]!;
    const pivot = portFrame(placeAll(graph, ports), ports, grabbed, 0).pos;
    const { graph: turned } = moveRun(graph, ports, grabbed.pieceId, { turns: 3, by: shiftMm(0, 0) });
    // The pivot does not move; everything else turned three sixteenths.
    expect(portFrame(placeAll(turned, ports), ports, grabbed, 0).pos).toEqual(pivot);
    expect(frames(turned).get(grabbed.pieceId)!.heading).toBe((frames(graph).get(grabbed.pieceId)!.heading + 3) % 16);
    expect(residuals(turned, ports, placeAll(turned, ports)).every((r) => r.closes)).toBe(true);
  });

  it('moves only its own run', () => {
    const first = chain(['A', 'A']).graph;
    const both = chain(['A'], first, { pos: shiftMm(0, 500), heading: 0 }).graph;
    const other = both.pieces[2]!.pieceId;
    const { graph: moved } = moveRun(both, ports, both.pieces[0]!.pieceId, { turns: 0, by: shiftMm(50, 0) });
    expect(frames(moved).get(other)).toEqual(frames(both).get(other));
  });
});

describe('where a run may land', () => {
  /*
   * MUTATION PROOFS, run:
   * - no conflict refusal: `expected null to be 'two ends of the same kind
   *   would meet'`.
   */
  it('is refused, changing nothing, when its end would sit on an end of the same kind', () => {
    const a = chain(['A']).graph; // peg at its far end (x = 144)
    // A second straight, its own run, lying 500mm above.
    const both = chain(['A'], a, { pos: shiftMm(0, 500), heading: 0 }).graph;
    // Move it down so its far end (a peg) lands on the first one's far end.
    const result = moveRun(both, ports, both.pieces[1]!.pieceId, { turns: 8, by: shiftMm(288, -500) });
    expect(result.refused).toBe('two ends of the same kind would meet');
    expect(result.graph).toBe(both);
  });

  it('joins when its end lands on a free end of the other kind, facing it', () => {
    const a = chain(['A']).graph;
    const both = chain(['A'], a, { pos: shiftMm(0, 500), heading: 0 }).graph;
    // Its start (a socket) onto the first one's far end (a peg), same heading.
    const result = moveRun(both, ports, both.pieces[1]!.pieceId, { turns: 0, by: shiftMm(144, -500) });
    expect(result.refused).toBeNull();
    expect(result.joined).toBe(1);
    expect(result.graph.welds).toHaveLength(1);
  });

  /*
   * WOOD ON WOOD, as a palette drop is refused for it (overlap.ts).
   *
   * MUTATION PROOFS, run:
   * - moveRun's wood check skipped (`if (geometry && false)`): "lying along"
   *   fails with `expected null to be 'it would lie over other track'`.
   * - the check refusing any overlap at all, not only the run's own
   *   (`over.length > 0`): "moved off" fails with `expected 'it would lie
   *   over other track' to be null`.
   */
  const geometry = { resolve };
  const twoRuns = () => chain(['A'], chain(['A']).graph, { pos: shiftMm(0, 500), heading: 0 }).graph;

  it('is refused, changing nothing, when it would lie along other track', () => {
    const both = twoRuns();
    // 10 mm off the first straight and 50 mm back: no end near any end.
    const result = moveRun(both, ports, both.pieces[1]!.pieceId, { turns: 0, by: shiftMm(-50, -490) }, geometry);
    expect(result.refused).toBe('it would lie over other track');
    expect(result.graph).toBe(both);
  });

  it('may come to rest beside other track, edges touching', () => {
    const both = twoRuns();
    const result = moveRun(both, ports, both.pieces[1]!.pieceId, { turns: 0, by: shiftMm(-50, -460) }, geometry);
    expect(result.refused).toBeNull();
  });

  it('may be moved off track it already lies over, even with other overlaps left', () => {
    // Three straights: the first two lie over each other; the third is moved.
    const stacked = chain(['A'], chain(['A']).graph, { pos: shiftMm(20, 10), heading: 0 }).graph;
    const three = chain(['A'], stacked, { pos: shiftMm(0, 500), heading: 0 }).graph;
    const result = moveRun(three, ports, three.pieces[2]!.pieceId, { turns: 0, by: shiftMm(0, 100) }, geometry);
    expect(result.refused).toBeNull();
  });

  /*
   * REVERSED 2026-10-23 (backlog D7): this move was refused, because the join
   * re-laid the loop. The forest now picks the gap by weld order, so the
   * join moves nothing and the move is allowed.
   *
   * MUTATION PROOF, run: `spanningForest` back to leaving over whatever its
   * walk did not use: `expected 'joining there would shift pieces of a…' to
   * be null`.
   */
  it('joins a loop that does not close without moving any of it (eng D6, D7)', () => {
    // The eng review's probe, declared straight-first so the join enters the
    // loop through its switch.
    const loop = (() => {
      let { graph, at } = chain(['L', 'E', 'E', 'E', 'L', 'E', 'E', 'E']);
      graph = weldEnds(graph, at, { pieceId: graph.pieces[0]!.pieceId, port: 2 });
      return graph;
    })();
    const place = placeAll(loop, ports);
    const spare = loop.pieces[4]!;
    const spareFrame = portFrame(place, ports, spare, 2);
    const straight: Piece = { pieceId: 'probe', partId: 'A', turn: 'left' };
    const by = ports(straight).findIndex((p) => p.polarity !== ports(spare)[2]!.polarity);
    const target = frameForPortAt(ports(straight)[by]!.at, opposed(spareFrame));
    // Start the straight 200mm away along x, then move it onto the spare road.
    const away = { pos: add(target.pos, shiftMm(200, 0)), heading: target.heading };
    const root = loop.pieces[0]!.pieceId;
    const graph: Graph = {
      pieces: [straight, ...loop.pieces],
      welds: loop.welds,
      anchors: new Map([...(loop.anchors ?? []), [root, place.frames.get(root)!], ['probe', away]]),
    };
    const result = moveRun(graph, ports, 'probe', { turns: 0, by: sub(target.pos, away.pos) });
    expect(toXY(sub(target.pos, away.pos)).map(Math.round)).toEqual([-200, 0]);
    expect(result.refused).toBeNull();
    expect(result.graph.welds).toHaveLength(loop.welds.length + 1);
    const was = placeAll(graph, ports).frames;
    const now = placeAll(result.graph, ports).frames;
    for (const p of loop.pieces) expect(now.get(p.pieceId), p.pieceId).toEqual(was.get(p.pieceId));
    expect(now.get('probe')).toEqual(target);
  });
});

describe('a dropped run snaps onto a nearby end', () => {
  /*
   * MUTATION PROOFS, run:
   * - the radius ignored: `expected { Object (turns, by) } to be { Object
   *   (turns, by) }` (a far drop snapped anyway).
   * - the snap turn without the half turn, so the ends would point the same
   *   way: `expected { turns: 8, by: [ 144, … ] } to deeply equal …`.
   */
  const setup = () => {
    const a = chain(['A']).graph;
    // A second straight 500mm above, its own run.
    return chain(['A'], a, { pos: shiftMm(0, 500), heading: 0 }).graph;
  };

  it('within the radius: the exact move that makes the ends meet, facing, and it joins', () => {
    const both = setup();
    // Dropped 7mm short of meeting: its start would be at (137, 0), the peg at (144, 0).
    const asked = { turns: 0, by: shiftMm(137, -500) };
    const snapped = snapRunMove(both, ports, both.pieces[1]!.pieceId, asked, 20);
    expect(snapped).toEqual({ turns: 0, by: shiftMm(144, -500) });
    expect(moveRun(both, ports, both.pieces[1]!.pieceId, snapped).joined).toBe(1);
  });

  it('outside the radius, or with a radius of zero, the move is unchanged', () => {
    const both = setup();
    const asked = { turns: 0, by: shiftMm(137, -500) };
    expect(snapRunMove(both, ports, both.pieces[1]!.pieceId, asked, 5)).toBe(asked);
    expect(snapRunMove(both, ports, both.pieces[1]!.pieceId, asked, 0)).toBe(asked);
  });
});
