/**
 * A DOMED ROOF'S SURFACE (the Action Tunnel Station, owner's photos
 * 2026-11-08): arched along the track and across it, wider in the middle.
 * One formula for the drawing and for the seeds that stand things under it.
 *
 *   u, v in [-1, 1]: along from the dome's centre over half its length, and
 *   across over half its width at that point along.
 *   half width  w(u) = widthMm / 2 + bulgeMm * (1 - u^2)
 *   top height  z(u, v) = baseMm + alongRiseMm * (1 - u^2) + acrossRiseMm * (1 - v^2)
 */

import type { DecorDome } from './schema.js';

/** Half the dome's width `u` along it, from the middle out. */
export const domeHalfWidth = (d: DecorDome, u: number): number => d.widthMm / 2 + d.bulgeMm * (1 - u * u);

/** The dome's top, `along` from its centre and `across` from its middle line, above the floor; its rim's height outside it. */
export function domeTop(d: DecorDome, along: number, across: number): number {
  const u = Math.max(-1, Math.min(1, along / (d.lengthMm / 2)));
  const v = Math.max(-1, Math.min(1, across / domeHalfWidth(d, u)));
  return d.baseMm + d.alongRiseMm * (1 - u * u) + d.acrossRiseMm * (1 - v * v);
}
