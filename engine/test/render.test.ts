/**
 * Render geometry.
 *
 * The canvas emits SVG arc commands, and an SVG arc is specified by its
 * endpoints plus flags rather than by its centre. Get the sweep flag wrong and
 * every arc bulges the wrong way: the eight-curve circle renders as a flower,
 * while the endpoints, and therefore every other test, stay perfectly correct.
 *
 * So assert the thing that actually pins it down. The SVG spec (F.6.5) gives a
 * closed form for the centre implied by an arc command; for a circle made of
 * eight curves, all eight must resolve to the same centre.
 */

import { describe, expect, it } from 'vitest';
import { getPart } from '../data/brio.js';
import { walkFloat, type Segment } from '../src/geom/fk.js';
import type { Layout } from '../src/parts/schema.js';

/** The sweep flag the renderer uses. Must match TrackCanvas.segmentPath. */
const SWEEP_FOR_LEFT = 1;

/** SVG F.6.5 endpoint-to-centre conversion, for rx = ry = r and phi = 0. */
function svgArcCentre(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  largeArc: 0 | 1,
  sweep: 0 | 1,
): [number, number] {
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const d2 = dx * dx + dy * dy;
  const factor = Math.sqrt(Math.max(0, (r * r) / d2 - 1));
  const sign = largeArc !== sweep ? 1 : -1;
  const cx = sign * factor * dy + (x1 + x2) / 2;
  const cy = sign * factor * -dx + (y1 + y2) / 2;
  return [cx, cy];
}

function centreOf(s: Segment): [number, number] {
  const sweep = (s.sweep === 'left' ? SWEEP_FOR_LEFT : 1 - SWEEP_FOR_LEFT) as 0 | 1;
  return svgArcCentre(s.from.x, s.from.y, s.to.x, s.to.y, s.radiusMm!, 0, sweep);
}

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

describe('SVG arc rendering', () => {
  it('all eight arcs of the circle share one centre', () => {
    const { segments } = walkFloat(loop(Array(8).fill('E')), getPart);
    expect(segments).toHaveLength(8);
    const centres = segments.map(centreOf);
    // First curve starts at the origin heading +x, so the centre is 182mm to
    // its left: straight up the y axis.
    expect(centres[0]![0]).toBeCloseTo(0, 6);
    expect(centres[0]![1]).toBeCloseTo(182, 6);
    for (const c of centres) {
      expect(c[0]).toBeCloseTo(centres[0]![0], 6);
      expect(c[1]).toBeCloseTo(centres[0]![1], 6);
    }
  });

  it('the opposite sweep flag would put the centre somewhere else entirely', () => {
    // Guards the assertion above against passing for the wrong reason.
    const { segments } = walkFloat(loop(Array(8).fill('E')), getPart);
    const s = segments[0]!;
    const wrong = svgArcCentre(s.from.x, s.from.y, s.to.x, s.to.y, s.radiusMm!, 0, 0);
    expect(Math.hypot(wrong[0] - 0, wrong[1] - 182)).toBeGreaterThan(100);
  });

  it('a right turn centres on the opposite side', () => {
    const { segments } = walkFloat(
      { placements: [{ partId: 'E', turn: 'right' }], closed: false },
      getPart,
    );
    const c = centreOf(segments[0]!);
    expect(c[0]).toBeCloseTo(0, 6);
    expect(c[1]).toBeCloseTo(-182, 6);
  });

  it('emits one segment per placed piece, with curves carrying a radius', () => {
    const { segments, poses } = walkFloat(
      loop([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D']),
      getPart,
    );
    expect(segments).toHaveLength(10);
    expect(poses).toHaveLength(11);
    expect(segments.filter((s) => s.kind === 'curve').every((s) => s.radiusMm === 182)).toBe(true);
    expect(segments.filter((s) => s.kind === 'straight').every((s) => s.radiusMm === undefined)).toBe(true);
  });
});
