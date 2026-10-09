/**
 * Floating-point forward kinematics, shared.
 *
 * The exact integer walk in pose.ts decides closure. This one produces the
 * actual configuration in millimetres, optionally with joint slop applied, and
 * is used by two callers that would otherwise each reimplement the arc maths:
 *
 *   solver/refine.ts  needs the slopped configuration to re-linearise
 *   the renderer      needs the drawn path and the joint positions
 *
 * Arc derivations, from heading h (radians), radius r, arc angle th:
 *
 *   left   disp = r * ( sin(h+th) - sin(h),  cos(h) - cos(h+th) )   h += th
 *   right  disp = r * ( sin(h) - sin(h-th),  cos(h-th) - cos(h) )   h -= th
 */

import { centrelineRadiusMm, type Layout, type Part } from '../parts/schema.js';

export interface Slop {
  axialMm: number;
  angularRad: number;
}

export interface FPose {
  x: number;
  y: number;
  /** Heading in radians. */
  h: number;
}

/** One drawable piece: where it starts, and the arc or line it traces. */
export interface Segment {
  readonly kind: 'straight' | 'curve';
  readonly from: FPose;
  readonly to: FPose;
  /** Curves only: CENTRELINE radius in mm, which is what gets drawn. */
  readonly centrelineRadiusMm?: number;
  readonly sweep?: 'left' | 'right';
  readonly partId: string;
}

export interface FkResult {
  /** n+1 poses: the start, then after each piece (slop included). */
  readonly poses: readonly FPose[];
  readonly segments: readonly Segment[];
}

/**
 * Walk the layout in floats. Slop entry i is applied at the joint AFTER piece i:
 * an axial extension along the current heading, then an angular deflection that
 * swings everything downstream.
 */
export function walkFloat(
  layout: Layout,
  resolve: (id: string) => Part,
  slop: readonly Slop[] = [],
): FkResult {
  let x = 0;
  let y = 0;
  let h = 0;
  const poses: FPose[] = [{ x, y, h }];
  const segments: Segment[] = [];

  layout.placements.forEach((placement, i) => {
    const part = resolve(placement.partId);
    const turn = placement.turn ?? 'left';
    const from: FPose = { x, y, h };

    if (part.kind === 'straight') {
      x += part.lengthMm * Math.cos(h);
      y += part.lengthMm * Math.sin(h);
      segments.push({ kind: 'straight', from, to: { x, y, h }, partId: part.id });
    } else {
      const r = centrelineRadiusMm(part);
      const th = (part.arcSteps * Math.PI) / 8;
      if (turn === 'left') {
        x += r * (Math.sin(h + th) - Math.sin(h));
        y += r * (Math.cos(h) - Math.cos(h + th));
        h += th;
      } else {
        x += r * (Math.sin(h) - Math.sin(h - th));
        y += r * (Math.cos(h - th) - Math.cos(h));
        h -= th;
      }
      segments.push({
        kind: 'curve',
        from,
        to: { x, y, h },
        centrelineRadiusMm: r,
        sweep: turn,
        partId: part.id,
      });
    }

    const s = slop[i];
    if (s) {
      x += s.axialMm * Math.cos(h);
      y += s.axialMm * Math.sin(h);
      h += s.angularRad;
    }

    poses.push({ x, y, h });
  });

  return { poses, segments };
}

/** Nominal final heading in radians, with no slop applied. */
export function nominalFinalHeading(
  layout: Layout,
  resolve: (id: string) => Part,
): number {
  let steps = 0;
  for (const pl of layout.placements) {
    const part = resolve(pl.partId);
    if (part.kind === 'curve') {
      steps += (pl.turn ?? 'left') === 'left' ? part.arcSteps : -part.arcSteps;
    }
  }
  return (steps * Math.PI) / 8;
}

/** Bounding box of a configuration, in millimetres. */
export function bounds(poses: readonly FPose[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poses) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
