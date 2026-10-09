/**
 * Render geometry, engine side.
 *
 * This file used to also pin the SVG sweep flag, and it did so against its own
 * hand-copied `SWEEP_FOR_LEFT = 1` rather than against the renderer. That made
 * it a circular pin: inverting the renderer's literal left the whole suite
 * green, proven by mutation during the fourth eng review. Those assertions now
 * live in `app/src/trackPath.test.ts`, where they parse the flag out of
 * `segmentPath`'s actual output, and the flag itself has one owner in
 * `app/src/trackPath.ts`.
 *
 * What stays here is the part that is genuinely about the engine: that the float
 * walk emits one segment per placed piece and carries a radius only for curves.
 */

import { describe, expect, it } from 'vitest';
import { getPart } from '../data/brio.js';
import { walkFloat } from '../src/geom/fk.js';
import type { Layout } from '../src/parts/schema.js';

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

describe('the float walk', () => {
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
