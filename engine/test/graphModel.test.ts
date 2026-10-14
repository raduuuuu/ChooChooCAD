import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { add, equals, magnitude, scale, sub, zetaPow, ZERO } from '../src/geom/cyclotomic.js';
import { spanningForest } from '../src/graph/forest.js';
import { placeAll, portFrame, residuals, closesExactly } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const chain = (ids: string[], closed: boolean) =>
  graphFromChain({ placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed });

describe('the spanning forest', () => {
  it('a closed 8-curve circle has cycle rank 1', () => {
    const f = spanningForest(chain(Array(8).fill('E'), true));
    expect(f.closing.length).toBe(1);
    expect(f.roots).toEqual(['p0']);
    expect(f.order.length).toBe(8);
  });

  it('an open chain has rank 0', () => {
    expect(spanningForest(chain(Array(8).fill('E'), false)).closing.length).toBe(0);
  });

  /*
   * rank = E - V + CC, asserted against the forest rather than recomputed
   * from the same formula. Two disjoint closed circles is the case that
   * catches a forest which quietly assumes one component.
   */
  it('two disjoint circles give two components and rank 2', () => {
    const one = chain(Array(8).fill('E'), true);
    const two = chain(Array(8).fill('E'), true);
    const shift = (id: string) => `b${id}`;
    const merged: Graph = {
      pieces: [...one.pieces, ...two.pieces.map((p) => ({ ...p, pieceId: shift(p.pieceId) }))],
      welds: [
        ...one.welds,
        ...two.welds.map((w) => ({
          a: { ...w.a, pieceId: shift(w.a.pieceId) },
          b: { ...w.b, pieceId: shift(w.b.pieceId) },
        })),
      ],
    };
    const f = spanningForest(merged);
    expect(f.roots.length).toBe(2);
    expect(f.closing.length).toBe(2);
    expect(f.closing.length).toBe(merged.welds.length - merged.pieces.length + f.roots.length);
  });

  it('the visit order is deterministic', () => {
    const g = chain(['A2', 'E', 'A1', 'E', 'D'], true);
    expect(spanningForest(g).order).toEqual(spanningForest(g).order);
    // Declaration order, which is also the order the chain engine walked.
    expect(spanningForest(g).order).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
    // And the weld left over is the closing one, not an interior weld.
    expect(spanningForest(g).closing).toEqual([4]);
  });
});

describe('placing pieces', () => {
  it('the 8-curve circle closes exactly, with no tolerance', () => {
    const g = chain(Array(8).fill('E'), true);
    const r = residuals(g, ports, placeAll(g, ports));
    expect(r.length).toBe(1);
    expect(closesExactly(r)).toBe(true);
    expect(r[0]!.gap).toEqual(ZERO);
    expect(r[0]!.headingSteps).toBe(0);
  });

  it('the stadium closes exactly', () => {
    const g = chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'], true);
    expect(closesExactly(residuals(g, ports, placeAll(g, ports)))).toBe(true);
  });

  it('a near miss does not close, and says so exactly', () => {
    const g = chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'A'], true);
    const r = residuals(g, ports, placeAll(g, ports));
    expect(r[0]!.closes).toBe(false);
    /*
     * 216 - 144 = 72mm short, exactly, with no tolerance anywhere.
     *
     * SIGN CONVENTION: the gap is where the closing port IS minus where it
     * HAS to be, so it is the correction you would apply to that port. The
     * direction therefore depends on which side of the weld is `b`, which is
     * a property of how the weld was declared and not of the layout. Only
     * the magnitude is reported to the user, and T7's differential harness
     * is what checks this against the chain engine.
     */
    expect(magnitude(r[0]!.gap)).toBeCloseTo(72, 9);
    expect(r[0]!.gap).toEqual(scale(zetaPow(0), 72));
    expect(r[0]!.headingSteps).toBe(0);
  });

  it('one straight lands its far port exactly one length along', () => {
    const g = chain(['A'], false);
    const p = placeAll(g, ports);
    const far = portFrame(p, ports, g.pieces[0]!, 1);
    expect(far.pos).toEqual(scale(zetaPow(0), 144));
    expect(far.heading).toBe(0);
  });
});

/*
 * THE CROSSING. T2's acceptance test, and the reason the model is ports in a
 * local frame rather than routes between ends.
 *
 * A crossing is one rigid piece carrying two tracks that intersect. Its two
 * routes share NO port, so a route-based model learns nothing about ports 2
 * and 3 from walking 0 to 1, and the two halves drift apart depending on
 * which route you traverse first. Here both routes read off one frame, so
 * rigidity is structural: there is nothing to keep in sync.
 *
 * Declared inline rather than added to the catalogue, because the catalogue
 * is two-ended by decision (R22) until the graph lands. The model does not
 * care, which is the point being tested.
 */
describe('a four-port crossing stays rigid', () => {
  const ARM = 108;
  const crossingPorts: readonly Port[] = [
    { kind: 'end', at: { pos: ZERO, heading: 8 } },
    { kind: 'end', at: { pos: scale(zetaPow(0), ARM), heading: 0 } },
    // The second track, at 90 degrees (4 steps), crossing the midpoint.
    {
      kind: 'end',
      at: { pos: sub(scale(zetaPow(0), ARM / 2), scale(zetaPow(4), ARM / 2)), heading: 12 },
    },
    {
      kind: 'end',
      at: { pos: add(scale(zetaPow(0), ARM / 2), scale(zetaPow(4), ARM / 2)), heading: 4 },
    },
  ];
  const withCrossing = (piece: Piece): readonly Port[] =>
    piece.partId === 'CROSSING' ? crossingPorts : ports(piece);

  /*
   * The invariant is PAIRWISE, and getting that wrong was my first attempt.
   *
   * Comparing "port i relative to the welded port" across two placements
   * compares against two different bases and fails for a rigid piece, which
   * is a bug in the test rather than the model. What is actually frame-
   * independent is the relation between each PAIR of ports: the distance
   * between them, and the difference of their headings. Those are properties
   * of the piece, so they must be identical however the piece is reached.
   *
   * This is exactly what a route-based model cannot guarantee. Ports 2 and 3
   * are on the other track, reachable by no route from port 0, so their
   * relation to ports 0 and 1 would depend on the traversal.
   */
  const pairwise = (viaPort: number) => {
    const g: Graph = {
      pieces: [
        { pieceId: 'lead', partId: 'A' },
        { pieceId: 'x', partId: 'CROSSING' },
      ],
      welds: [{ a: { pieceId: 'lead', port: 1 }, b: { pieceId: 'x', port: viaPort } }],
    };
    const p = placeAll(g, withCrossing);
    const f = [0, 1, 2, 3].map((i) => portFrame(p, withCrossing, g.pieces[1]!, i));
    const out: string[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const d = sub(f[i]!.pos, f[j]!.pos);
        // Squared length in the integer coordinate vector: frame-independent
        // under the rotations zeta^k applies, and exact.
        const d2 = d.reduce((acc, v) => acc + v * v, 0);
        const dh = (((f[i]!.heading - f[j]!.heading) % 16) + 16) % 16;
        out.push(`${i}-${j} d2=${d2} dh=${dh}`);
      }
    }
    return out;
  };

  it('its ports keep the same pairwise relations whichever port is welded', () => {
    expect(pairwise(2)).toEqual(pairwise(0));
    expect(pairwise(3)).toEqual(pairwise(0));
    expect(pairwise(1)).toEqual(pairwise(0));
  });

  it('the crossing really does have two separate tracks', () => {
    // Ports 0-1 are one track, 2-3 the other, and no weld relates them: if
    // the model were route-based this is the information that would be lost.
    const rel = pairwise(0);
    expect(rel).toHaveLength(6);
    expect(new Set(rel).size).toBeGreaterThan(1);
  });

  it('a crossing welded on one arm still places its other arm', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'lead', partId: 'A' },
        { pieceId: 'x', partId: 'CROSSING' },
      ],
      welds: [{ a: { pieceId: 'lead', port: 1 }, b: { pieceId: 'x', port: 0 } }],
    };
    const p = placeAll(g, withCrossing);
    const arm = portFrame(p, withCrossing, g.pieces[1]!, 3);
    expect(equals(arm.pos, ZERO)).toBe(false);
  });
});
