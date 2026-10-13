/**
 * The renderer's arc convention, pinned against what the renderer ACTUALLY emits.
 *
 * An SVG arc is specified by its endpoints plus flags rather than by its centre.
 * Get the sweep flag wrong and every arc bulges the wrong way: the eight-curve
 * circle renders as a flower, while the endpoints, and therefore every other
 * test in the suite, stay perfectly correct.
 *
 * So these tests PARSE the flag out of `segmentPath`'s output and feed that to
 * the SVG spec's endpoint-to-centre formula. They never restate the flag. The
 * previous version of this file declared its own `SWEEP_FOR_LEFT = 1` and
 * compared the spec against that copy, which made it a circular pin: inverting
 * the renderer's literal left all 50 tests green, proven by mutation. Reading
 * the flag from the renderer's own output is what makes these assertions bite.
 */

import { describe, expect, it } from 'vitest';
import { getPart } from '../../engine/data/brio.js';
import { walkFloat, type Segment } from '../../engine/src/geom/fk.js';
import { centrelineRadiusMm } from '../../engine/src/parts/schema.js';
import type { Layout, Part } from '../../engine/src/parts/schema.js';
import { clashMarkers, segmentPath } from './trackPath.js';

/** SVG F.6.5 endpoint-to-centre conversion, for rx = ry = r and phi = 0. */
function svgArcCentre(
  x1: number, y1: number, x2: number, y2: number,
  r: number, largeArc: 0 | 1, sweep: 0 | 1,
): [number, number] {
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const d2 = dx * dx + dy * dy;
  const factor = Math.sqrt(Math.max(0, (r * r) / d2 - 1));
  const sign = largeArc !== sweep ? 1 : -1;
  return [sign * factor * dy + (x1 + x2) / 2, sign * factor * -dx + (y1 + y2) / 2];
}

/**
 * Pull the arc's numbers back out of the renderer's own `d` string. This is the
 * whole point: the flag under test comes from the renderer, not from this file.
 */
function parseArc(d: string): { x1: number; y1: number; x2: number; y2: number; r: number; largeArc: 0 | 1; sweep: 0 | 1 } {
  const m = d.match(
    /^M (-?[\d.e+-]+) (-?[\d.e+-]+) A (-?[\d.e+-]+) (-?[\d.e+-]+) 0 ([01]) ([01]) (-?[\d.e+-]+) (-?[\d.e+-]+)$/,
  );
  if (!m) throw new Error(`not an arc path: ${d}`);
  return {
    x1: Number(m[1]), y1: Number(m[2]), r: Number(m[3]),
    largeArc: Number(m[5]) as 0 | 1, sweep: Number(m[6]) as 0 | 1,
    x2: Number(m[7]), y2: Number(m[8]),
  };
}

function centreOfRenderedArc(s: Segment): [number, number] {
  const a = parseArc(segmentPath(s));
  return svgArcCentre(a.x1, a.y1, a.x2, a.y2, a.r, a.largeArc, a.sweep);
}

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

describe('the rendered arc convention', () => {
  it('all eight arcs of the circle resolve to one centre, as the renderer draws them', () => {
    const { segments } = walkFloat(loop(Array(8).fill('E')), getPart);
    expect(segments).toHaveLength(8);
    const centres = segments.map(centreOfRenderedArc);
    // Derived from the part: the first curve starts at the origin heading +x,
    // so its centre is ITS OWN radius to the left, straight up the y axis.
    // Pinning the radius value is analytic.test.ts's source-comparison test.
    const r = centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    expect(centres[0]![0]).toBeCloseTo(0, 6);
    expect(centres[0]![1]).toBeCloseTo(r, 6);
    for (const c of centres) {
      expect(c[0]).toBeCloseTo(centres[0]![0], 6);
      expect(c[1]).toBeCloseTo(centres[0]![1], 6);
    }
  });

  it('the opposite flag would put the centre somewhere else entirely', () => {
    // Guards the assertion above against passing for the wrong reason: if both
    // flags gave the same centre, the test would prove nothing.
    const { segments } = walkFloat(loop(Array(8).fill('E')), getPart);
    const a = parseArc(segmentPath(segments[0]!));
    const flipped = svgArcCentre(a.x1, a.y1, a.x2, a.y2, a.r, a.largeArc, (1 - a.sweep) as 0 | 1);
    const r = centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    expect(Math.hypot(flipped[0] - 0, flipped[1] - r)).toBeGreaterThan(100);
  });

  it('a right turn centres on the opposite side', () => {
    const { segments } = walkFloat(
      { placements: [{ partId: 'E', turn: 'right' }], closed: false },
      getPart,
    );
    const c = centreOfRenderedArc(segments[0]!);
    const r = centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    expect(c[0]).toBeCloseTo(0, 6);
    expect(c[1]).toBeCloseTo(-r, 6);
  });

  it('a left and a right turn emit DIFFERENT sweep flags', () => {
    // The direct statement of the thing that was unpinned. If the renderer ever
    // emits one flag for both directions, every other assertion here could
    // still be satisfied by a consistent-but-wrong convention.
    const l = walkFloat({ placements: [{ partId: 'E', turn: 'left' }], closed: false }, getPart);
    const r = walkFloat({ placements: [{ partId: 'E', turn: 'right' }], closed: false }, getPart);
    expect(parseArc(segmentPath(l.segments[0]!)).sweep).not.toBe(
      parseArc(segmentPath(r.segments[0]!)).sweep,
    );
  });

  it('a straight emits a line, with no arc flags to get wrong', () => {
    const { segments } = walkFloat({ placements: [{ partId: 'D' }], closed: false }, getPart);
    const d = segmentPath(segments[0]!);
    expect(d).toMatch(/^M [\d.e+-]+ [\d.e+-]+ L [\d.e+-]+ [\d.e+-]+$/);
    expect(() => parseArc(d)).toThrow();
  });
});

describe('clashMarkers', () => {
  const at = (x: number, y: number) => ({ at: [x, y] as const });

  it('draws one marker per distinct place', () => {
    expect(clashMarkers([at(10, 20), at(30, 40)])).toHaveLength(2);
  });

  /*
   * T12's invariant, stated as a property rather than a count: every
   * reported clash's position is marked, and no position is marked twice.
   * Four joins meeting at one spot is six reported pairs and ONE problem.
   */
  it('every reported position is marked exactly once', () => {
    const clashes = [at(0, 0), at(0, 0), at(0, 0), at(0, 0), at(0, 0), at(0, 0), at(7, 9)];
    const markers = clashMarkers(clashes);
    const wanted = new Set(clashes.map((c) => `${c.at[0]},${c.at[1]}`));
    const drawn = markers.map((m) => `${m[0]},${m[1]}`);
    expect(new Set(drawn)).toEqual(wanted);
    expect(drawn).toHaveLength(wanted.size);
  });

  it('distinguishes places that differ by a fraction of a millimetre', () => {
    // The engine decides coincidence exactly, in the lattice. Nothing here
    // may round two separate places into one.
    expect(clashMarkers([at(10, 20), at(10.000001, 20)])).toHaveLength(2);
  });

  it('nothing reported means nothing drawn', () => {
    expect(clashMarkers([])).toEqual([]);
  });
});
