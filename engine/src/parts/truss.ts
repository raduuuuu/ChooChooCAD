/**
 * A TRUSS ARCH'S CHORDS (Sydney bridge plan 2026-11-03): one formula for the
 * drawing (view3d/decor.ts) and for the solid ribs a tall arch blocks with
 * (library.ts, owner 2026-11-09). A chord runs through both springings, at
 * `springMm` above the piece's floor at `fromMm` and `toMm` along it, and
 * through its crown at the middle: circular, or parabolic when asked.
 */

import type { DecorTruss } from './schema.js';

/** A truss arch's chords in 3D: this deep, and twice this across. */
export const TRUSS_CHORD_MM = 4;
export const TRUSS_HALF_MM = 2;
/** A tall arch's solid ribs are cut into steps this long, each as tall as its chord over it. */
export const TRUSS_RIB_STEP_MM = 12;

/** The chord through both springings and a crown `crownMm` above the floor, as height above the floor `a` along the piece. */
export function trussChord(t: DecorTruss, crownMm: number): (a: number) => number {
  const { fromMm, toMm, springMm } = t;
  const half = (toMm - fromMm) / 2, rise = crownMm - springMm;
  if (t.parabolic) return (a) => springMm + rise * (1 - ((a - fromMm - half) / half) ** 2);
  if (t.elliptical) return (a) => springMm + rise * Math.sqrt(Math.max(0, 1 - ((a - fromMm - half) / half) ** 2));
  const r = (half * half + rise * rise) / (2 * rise);
  return (a) => crownMm - (r - Math.sqrt(Math.max(0, r * r - (a - fromMm - half) ** 2)));
}

/**
 * A band's underside, as height above the floor `a` along the piece: the
 * outer chord less the crown's depth all along, or for an elliptical arch the
 * outer chord shrunk about the springings' middle to the inner crown, its
 * legs as thick across as the band is deep at the crown, nearly. Never below
 * the springing.
 */
export function trussBandUnderside(t: DecorTruss): (a: number) => number {
  const outer = trussChord(t, t.crownMm), spring = t.springMm;
  if (!t.elliptical) return (a) => Math.max(spring, outer(a) - (t.crownMm - t.innerCrownMm));
  const mid = (t.fromMm + t.toMm) / 2, shrink = (t.innerCrownMm - spring) / (t.crownMm - spring);
  return (a) => spring + shrink * (outer(mid + (a - mid) / shrink) - spring);
}
