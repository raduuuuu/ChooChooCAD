/**
 * HOW A PREVIEWED PIECE CAN GO ON, WHERE IT LANDS, AND WHAT IT JOINS
 * (decisions R3, 18A, ENG-R4, D13, D20, eng D6; ENG-R1's shared map).
 *
 * Value: protects=the orientation options for an end are the real distinct
 * ways the part fits, with the automatic one first; the preview's frame is
 * exactly where Place puts the piece; a peg landing on a facing socket
 * joins, and a landing that is crossed, same-kind, crowded, or would shift a
 * loop that does not close does not
 * Value: fails_when=options repeat or include a same-kind join, the preview
 * frame drifts from the placed one, or auto-join welds a crossed or gappy
 * landing
 * Value: why_new=all new with the preview
 * Value: seam=none (pure model and engine, no DOM)
 * Value: no_claim=track crossing track mid-piece; the engine never checks it
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { connectorSites, landingOf } from '../../engine/src/graph/feasible.js';
import { placeAll, portFrame } from '../../engine/src/graph/frames.js';
import { frameForPortAt, opposed, portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { addPiece, autoJoin, EMPTY_GRAPH, fitOptions, frameAt, weldEnds } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const count = (id: string) => portsOf(resolve(id)).length;

const run = (ids: readonly string[]) => {
  let graph: Graph = EMPTY_GRAPH;
  let at: ReturnType<typeof addPiece>['select'] = null;
  for (const id of ids) {
    const next = addPiece(graph, id, 'left', count(id), at, ports);
    graph = next.graph;
    at = next.select;
  }
  return { graph, at: at! };
};

describe('the ways a part can go on at an end', () => {
  /*
   * MUTATION PROOFS, run:
   * - no de-duplication: `expected [ 'left', 'left', 'right' ] to deeply equal
   *   [ 'left', 'right' ]`, and the straight gets 3 options instead of 1.
   * - no polarity filter: `expected [ 'left', 'left' ] to deeply equal [
   *   'left', 'right' ]`, and the two-peg piece is no longer refused.
   * - the preview frame not turned to face the end: `E {"port":0,"turn":
   *   "left"}: expected { Object (pos, heading) } to deeply equal ...`.
   */
  it('a large curve onto a straight: two, left and right, the automatic one first', () => {
    const { graph, at } = run(['A']);
    const { options, refused } = fitOptions(graph, ports, at, 'E');
    expect(refused).toBe(false);
    expect(options.map((o) => o.turn).sort()).toEqual(['left', 'right']);
    expect(options).toHaveLength(2);
  });

  it('a straight onto a straight: one, because left and right lie the same', () => {
    const { graph, at } = run(['A']);
    expect(fitOptions(graph, ports, at, 'A').options).toHaveLength(1);
  });

  it('a two-peg piece onto a peg: the automatic choice, flagged refused', () => {
    const { graph, at } = run(['A']);
    // A's far end is a peg; B is pegs at both ends.
    expect(ports(graph.pieces[0]!)[at.port]!.polarity).toBe('peg');
    const { options, refused } = fitOptions(graph, ports, at, 'B');
    expect(refused).toBe(true);
    expect(options).toHaveLength(1);
  });

  /*
   * ENG-R4: the preview is computed for one piece, not by re-laying the
   * layout, so it must equal the real placement exactly.
   */
  it('the preview frame is exactly where Place puts the piece, for every option', () => {
    for (const [ids, partId] of [[['A', 'E', 'E'], 'E'], [['A'], 'L'], [['E', 'E'], 'A']] as const) {
      const { graph, at } = run(ids);
      const placement = placeAll(graph, ports);
      for (const fit of fitOptions(graph, ports, at, partId).options) {
        const preview = frameAt(graph, ports, placement, at, partId, fit);
        const placed = addPiece(graph, partId, 'left', count(partId), at, ports, fit).graph;
        const newest = placed.pieces[placed.pieces.length - 1]!;
        expect(placeAll(placed, ports).frames.get(newest.pieceId), `${partId} ${JSON.stringify(fit)}`).toEqual(preview);
      }
    }
  });
});

describe('what an end landing at a spot meets', () => {
  /*
   * MUTATION PROOFS, run:
   * - no facing check: `expected { kind: 'joins', with: { …(2) } } to match
   *   object { kind: 'conflict', reason: 'facing' }`.
   * - a joined end counted as free: the lone-joined-end spec fails with the
   *   same `joins` result. Survived until that spec was added, because every
   *   other spot in these fixtures holds two ends.
   */
  it('joins a free facing end of the other kind; a same-kind or joined one is a conflict', () => {
    const { graph } = run(['A', 'A']);
    const placement = placeAll(graph, ports);
    const sites = connectorSites(graph, ports, placement);
    const [p0] = graph.pieces;
    const start = portFrame(placement, ports, p0!, 0);
    const startPolarity = ports(p0!)[0]!.polarity;
    const other = startPolarity === 'peg' ? 'socket' : 'peg';
    const facing = { pos: start.pos, heading: (start.heading + 8) % 16 };

    expect(landingOf(sites, facing, other)).toEqual({ kind: 'joins', with: { pieceId: p0!.pieceId, port: 0 } });
    expect(landingOf(sites, facing, startPolarity)).toMatchObject({ kind: 'conflict', reason: 'polarity' });
    expect(landingOf(sites, { pos: start.pos, heading: (start.heading + 4) % 16 }, other)).toMatchObject({
      kind: 'conflict',
      reason: 'facing',
    });
    // The joint between the two straights: two ends there, both joined.
    const joint = portFrame(placement, ports, p0!, 1);
    expect(landingOf(sites, joint, other)).toMatchObject({ kind: 'conflict', reason: 'crowded' });
  });

  it('an end that is joined but alone at its spot is still taken', () => {
    // The closing join of a loop with a gap: each of its ends sits alone.
    let { graph, at } = run(['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A']);
    graph = weldEnds(graph, at, { pieceId: graph.pieces[0]!.pieceId, port: 0 });
    const placement = placeAll(graph, ports);
    const sites = connectorSites(graph, ports, placement);
    const lone = portFrame(placement, ports, graph.pieces[0]!, 0);
    const kind = ports(graph.pieces[0]!)[0]!.polarity === 'peg' ? 'socket' : 'peg';
    expect(landingOf(sites, { pos: lone.pos, heading: (lone.heading + 8) % 16 }, kind)).toMatchObject({
      kind: 'conflict',
      reason: 'crowded',
    });
  });
});

describe('auto-join', () => {
  /*
   * MUTATION PROOF, run: drop the `movesAnything` guard in `autoJoin`. The
   * gappy-loop spec fails with `auto-join welded a landing that re-lays the
   * gappy loop: expected 1 to be +0`. Its first version declared the straight
   * last, passed for the wrong reason, and was rebuilt.
   */
  it('closes a hand-built circle when the eighth curve lands on the first', () => {
    const { graph } = run(Array(8).fill('E'));
    const last = graph.pieces[7]!.pieceId;
    const { graph: joined, joined: n } = autoJoin(graph, ports, last);
    expect(n).toBe(1);
    expect(joined.welds).toHaveLength(8);
  });

  it('leaves a crossed landing unwelded (D20)', () => {
    // A straight, then a second run placed so its start sits on the first's
    // start at a right angle. Same spot, opposite kind, not facing.
    const first = run(['A']).graph;
    const place = placeAll(first, ports);
    const start = portFrame(place, ports, first.pieces[0]!, 0);
    const crossed = addPiece(first, 'A', 'left', 2, null, ports, undefined, {
      pos: start.pos,
      heading: (start.heading + 4) % 16,
    }).graph;
    expect(autoJoin(crossed, ports, crossed.pieces[1]!.pieceId).joined).toBe(0);
  });

  it('leaves a join unwelded when it would re-lay a loop that does not close (eng D6)', () => {
    // The eng review's probe: a loop closed with a gap, a second switch inside
    // it, and a separate straight lying exactly on that switch's spare road,
    // facing it, peg to socket.
    let { graph, at } = run(['L', 'E', 'E', 'E', 'L', 'E', 'E', 'E']);
    graph = weldEnds(graph, at, { pieceId: graph.pieces[0]!.pieceId, port: 2 });
    const place = placeAll(graph, ports);
    const spare = graph.pieces[4]!;
    const spareFrame = portFrame(place, ports, spare, 2);
    const spareKind = ports(spare)[2]!.polarity;
    const straight: Piece = { pieceId: 'probe', partId: 'A', turn: 'left' };
    const by = ports(straight).findIndex((p) => p.polarity !== spareKind);
    const anchor = frameForPortAt(ports(straight)[by]!.at, opposed(spareFrame));
    /*
     * DECLARED FIRST, which is what makes the join dangerous: the merged run
     * is then entered from the straight, through the switch, so a different
     * weld becomes the loop's gap. Declared last, the run is still entered at
     * the loop's own root and nothing moves (found writing this spec: the join
     * is then correctly allowed).
     */
    const root = graph.pieces[0]!.pieceId;
    const landed: Graph = {
      pieces: [straight, ...graph.pieces],
      welds: graph.welds,
      anchors: new Map([...(graph.anchors ?? []), [root, place.frames.get(root)!], ['probe', anchor]]),
    };
    const newest = straight;

    // The premise: it really is a facing, opposite-kind landing on a free end.
    const placed = placeAll(landed, ports);
    expect(
      landingOf(connectorSites(landed, ports, placed), portFrame(placed, ports, newest, by), ports(newest)[by]!.polarity, new Set([newest.pieceId])),
    ).toEqual({ kind: 'joins', with: { pieceId: spare.pieceId, port: 2 } });

    expect(autoJoin(landed, ports, newest.pieceId).joined, 'auto-join welded a landing that re-lays the gappy loop').toBe(0);
  });
});
