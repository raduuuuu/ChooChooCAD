/**
 * T3 and T11: editing without moving track nobody touched.
 *
 * The plan's verify for T3 is precise and both halves of it matter: breaking
 * an interior weld leaves both halves EXACTLY where they were, and neither
 * loses exact closure. The first half is about not teleporting; the second is
 * about not introducing an epsilon while avoiding the teleport.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { removePiece, removeWeld, weldsTouching } from '../src/graph/edit.js';
import { placeAll, residuals, closesExactly } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

/** Two circles joined by one weld, so breaking it splits the layout in two. */
function twoCirclesBridged(): Graph {
  const a = graphFromChain({
    placements: Array(8).fill({ partId: 'E', turn: 'left' }),
    closed: true,
  });
  const b = graphFromChain({
    placements: Array(8).fill({ partId: 'E', turn: 'left' }),
    closed: true,
  });
  const rename = (id: string) => `b${id}`;
  return {
    pieces: [...a.pieces, ...b.pieces.map((p) => ({ ...p, pieceId: rename(p.pieceId) }))],
    welds: [
      ...a.welds,
      ...b.welds.map((w) => ({
        a: { ...w.a, pieceId: rename(w.a.pieceId) },
        b: { ...w.b, pieceId: rename(w.b.pieceId) },
      })),
    ],
  };
}

describe('T3: breaking a weld leaves both halves where they were', () => {
  it('a split does not teleport the orphaned half to the origin', () => {
    const g = twoCirclesBridged();
    // One component to begin with? No: the two circles are not joined, so
    // this is already two. Join them, then break the join.
    const joined: Graph = {
      ...g,
      welds: [...g.welds, { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'bp0', port: 0 } }],
    };
    const before = placeAll(joined, ports);
    expect(before.forest.roots).toHaveLength(1);

    const bridge = joined.welds.length - 1;
    const after = removeWeld(joined, ports, bridge);
    const placed = placeAll(after, ports);
    expect(placed.forest.roots).toHaveLength(2);

    // EVERY piece, both halves, exactly where it was. Not "close to".
    for (const piece of joined.pieces) {
      expect(placed.frames.get(piece.pieceId), piece.pieceId).toEqual(
        before.frames.get(piece.pieceId),
      );
    }
  });

  it('neither half loses exact closure', () => {
    const g = twoCirclesBridged();
    const joined: Graph = {
      ...g,
      welds: [...g.welds, { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'bp0', port: 0 } }],
    };
    const after = removeWeld(joined, ports, joined.welds.length - 1);
    const place = placeAll(after, ports);
    const rs = residuals(after, ports, place);
    // Two circles, two cycles, both still exact.
    expect(rs).toHaveLength(2);
    expect(closesExactly(rs)).toBe(true);
  });

  /*
   * CAPTURED, NEVER RE-DERIVED. An anchor written once must not be rewritten
   * by a later edit, or the frame stops being the exact lattice point it was
   * captured as and starts being whatever the most recent walk produced.
   */
  it('an anchor already written is never rewritten', () => {
    const g = twoCirclesBridged();
    const joined: Graph = {
      ...g,
      welds: [...g.welds, { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'bp0', port: 0 } }],
    };
    const once = removeWeld(joined, ports, joined.welds.length - 1);
    const captured = new Map(once.anchors);
    // Another edit elsewhere, which re-runs the capture.
    const twice = removeWeld(once, ports, 0);
    for (const [id, frame] of captured) {
      expect(twice.anchors!.get(id), id).toEqual(frame);
    }
  });

  it('anchors are exact lattice points, not floats', () => {
    const g = twoCirclesBridged();
    const joined: Graph = {
      ...g,
      welds: [...g.welds, { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'bp0', port: 0 } }],
    };
    const after = removeWeld(joined, ports, joined.welds.length - 1);
    for (const [, frame] of after.anchors!) {
      expect(Number.isInteger(frame.heading)).toBe(true);
      for (const coefficient of frame.pos) expect(Number.isInteger(coefficient)).toBe(true);
    }
  });
});

describe('T11: deleting a piece takes its welds with it', () => {
  it('leaves no edge pointing at a missing piece', () => {
    const g = graphFromChain({
      placements: Array(8).fill({ partId: 'E', turn: 'left' }),
      closed: true,
    });
    // p3 is interior: it carries two welds.
    expect(weldsTouching(g, 'p3')).toHaveLength(2);
    const after = removePiece(g, ports, 'p3');

    const ids = new Set(after.pieces.map((p) => p.pieceId));
    expect(ids.has('p3')).toBe(false);
    for (const w of after.welds) {
      expect(ids.has(w.a.pieceId), `${w.a.pieceId} missing`).toBe(true);
      expect(ids.has(w.b.pieceId), `${w.b.pieceId} missing`).toBe(true);
    }
    expect(after.welds).toHaveLength(g.welds.length - 2);
  });

  it('the rest of the track stays exactly put', () => {
    const g = graphFromChain({
      placements: Array(8).fill({ partId: 'E', turn: 'left' }),
      closed: true,
    });
    const before = placeAll(g, ports);
    const after = removePiece(g, ports, 'p3');
    const placed = placeAll(after, ports);
    for (const piece of after.pieces) {
      expect(placed.frames.get(piece.pieceId), piece.pieceId).toEqual(
        before.frames.get(piece.pieceId),
      );
    }
  });

  it('deleting the last piece of a loop leaves an open run, not a broken graph', () => {
    const g = graphFromChain({
      placements: Array(8).fill({ partId: 'E', turn: 'left' }),
      closed: true,
    });
    const after = removePiece(g, ports, 'p0');
    const place = placeAll(after, ports);
    expect(place.forest.closing).toHaveLength(0);
    expect(place.frames.size).toBe(7);
  });

  it('a deleted piece does not leave its own anchor behind', () => {
    const g = twoCirclesBridged();
    const joined: Graph = {
      ...g,
      welds: [...g.welds, { a: { pieceId: 'p0', port: 0 }, b: { pieceId: 'bp0', port: 0 } }],
    };
    const split = removeWeld(joined, ports, joined.welds.length - 1);
    expect([...split.anchors!.keys()]).toContain('bp0');
    const after = removePiece(split, ports, 'bp0');
    // Its anchor is gone with it: an anchor pinning a piece that no longer
    // exists would be dead state that outlives what it described.
    expect([...after.anchors!.keys()]).not.toContain('bp0');
  });
});
