/**
 * DECORATION IN 3D (decorated-pieces plan 2026-11-03, eng D1/D4): where a
 * decoration box stands, from its measured heights. A structure's body is
 * drawn as tall as the levels it fills; a decoration is drawn as measured,
 * a 6mm road surface as 6mm, never as a level-tall block (eng O4).
 *
 * Shapes with their own drawing (a roof, an arch) join this module with the
 * pieces that need them.
 */

import type { Segment } from '../geom/fk.js';

/**
 * A vault's cross-section (eng D10): its outer and inner outlines, each from
 * one foot over the arch to the other, as (across, height) points; the
 * arch is a half circle on the straight walls. `steps` cuts each half circle.
 */
export function vaultSection(
  widthMm: number, wallMm: number, springMm: number, steps = 12,
): { readonly outer: readonly (readonly [number, number])[]; readonly inner: readonly (readonly [number, number])[] } {
  const ring = (r: number) => {
    const pts: (readonly [number, number])[] = [[-r, 0]];
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI - (Math.PI * i) / steps;
      pts.push([r * Math.cos(a), springMm + r * Math.sin(a)]);
    }
    pts.push([r, 0]);
    return pts;
  };
  return { outer: ring(widthMm / 2), inner: ring(widthMm / 2 - wallMm) };
}

/** The box's bottom and top, millimetres above the table, or null for wood that is not decoration. */
export function decorSpan(b: Segment, riseMm: number): { readonly zb: number; readonly zt: number } | null {
  if (!b.decor) return null;
  const floor = b.decor.floorLevel * riseMm;
  return { zb: floor + b.decor.bottomMm, zt: floor + b.decor.topMm };
}
