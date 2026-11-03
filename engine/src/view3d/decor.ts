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

/** The box's bottom and top, millimetres above the table, or null for wood that is not decoration. */
export function decorSpan(b: Segment, riseMm: number): { readonly zb: number; readonly zt: number } | null {
  if (!b.decor) return null;
  const floor = b.decor.floorLevel * riseMm;
  return { zb: floor + b.decor.bottomMm, zt: floor + b.decor.topMm };
}
