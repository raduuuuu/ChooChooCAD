import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { Q1_LOOP } from '../data/bendLimit.js';
import { bendRender, bentShifts } from '../src/graph/bendPose.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';
import { fromInt } from '../src/geom/cyclotomic.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** A closed loop of catalogue parts, built in order and anchored at piece 0. */
const loop = (ids: readonly string[]): Graph => {
  const n = ids.length;
  const pieces: Piece[] = ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' }));
  const welds: Graph['welds'][number][] = ids.map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${(i + 1) % n}`, port: 0 } }));
  return { pieces, welds, anchors: new Map([['p0', { pos: fromInt(0), heading: 0 }]]) };
};

/** The layout drawn, exact and bent, and the far apart each joint's two ends are drawn, mm. */
function drawn(g: Graph) {
  const placement = placeAll(g, ports);
  const r = solveGraph(g, ports, resolve, (id) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId).slop.axialMm, placement);
  if (!r.ok) throw new Error(r.reason);
  const exact = renderGraph(g, ports, resolve, placement);
  const shifts = bentShifts(g, placement, ports, r.bend);
  const bent = bendRender(exact, shifts);
  const apart = (render: typeof exact) => {
    const at = new Map(render.ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
    return g.welds.map((w) => {
      const a = at.get(`${w.a.pieceId}#${w.a.port}`)!;
      const b = at.get(`${w.b.pieceId}#${w.b.port}`)!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    });
  };
  return { r, exact, bent, shifts, exactApart: apart(exact), bentApart: apart(bent) };
}

describe('a loop that closes with bend is drawn closed (the Q1 loop, 2026-10-30)', () => {
  /*
   * THE OWNER'S REPORT: the Q1 loop's verdict said "closes with bend" while
   * the canvas drew its 72mm gap. Drawn bent, every joint's two ends meet to
   * within the joint's 2mm stretch and the half-millimetre the solve settles to.
   *
   * MUTATION PROOF, run: the turn's sign not flipped for a joint crossed
   * against its own direction (`(leavesA ? 1 : -1) * j.turn` read as
   * `j.turn`) passes here, where the tree crosses every joint forwards, and
   * fails the next spec, which declares half the joints backwards: `expected
   * 32.213112551767054 to be less than or equal to 2.5`.
   */
  it('draws every joint of the Q1 loop meeting, where the exact drawing leaves 72mm', () => {
    const { r, exactApart, bentApart, shifts } = drawn(loop(Q1_LOOP));
    expect(r.ok && r.lead!.status).toBe('closes');
    expect(Math.max(...exactApart)).toBeCloseTo(72, 6);
    expect(Math.max(...bentApart)).toBeLessThanOrEqual(2.5);
    // The anchored piece stays put; the rest move.
    expect(shifts.get('p0')).toEqual([0, 0, 0]);
    expect(shifts.size).toBe(Q1_LOOP.length);
  });

  it('meets as well when the walk crosses joints against their own direction', () => {
    // The second half's welds declared b to a, so the tree crosses them against their own direction.
    const g = loop(Q1_LOOP);
    const welds = g.welds.map((w, i) => (i >= 5 ? { a: w.b, b: w.a } : w));
    const { r, bentApart } = drawn({ ...g, welds });
    expect(r.ok && r.lead!.status).toBe('closes');
    expect(Math.max(...bentApart)).toBeLessThanOrEqual(2.5);
  });

  it('leaves exact and beyond loops as placed', () => {
    const circle = drawn(loop(['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E']));
    expect(circle.shifts.size).toBe(0);
    expect(circle.bent).toBe(circle.exact);
    // Short curves: the same 72mm on a much shorter lever, beyond the tested bend.
    const beyond = drawn(loop(['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A']));
    expect(beyond.r.ok && beyond.r.lead!.status).toBe('beyond');
    expect(beyond.shifts.size).toBe(0);
  });
});
