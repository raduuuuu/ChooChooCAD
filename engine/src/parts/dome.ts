/**
 * A DOMED ROOF'S SURFACE (the Action Tunnel Station, owner's photos
 * 2026-11-08): a groin vault, two barrels crossing. One spans `archMm`
 * along the track in a round arch, rising `alongRiseMm` to the middle (the
 * arch in the side view, its ends the wings in the end view); the other runs
 * the whole length, arched
 * `acrossRiseMm` across at the ends (the hoods in the end view) and rising
 * with the first toward the middle, so the two meet in an X from the corners
 * to the crown (the top view). One formula for the drawing and for the seeds
 * that stand things under it.
 *
 *   u, v in [-1, 1]: along from the dome's centre over half its length, and
 *   across over half its width at that point along.
 *   half width  w(u) = widthMm / 2 + bulgeMm * (1 - u^2)^2
 *   the arch    q = sqrt(1 - s^2), s along over half `archMm` (0 past it)
 *   top height  z(u, v) = baseMm + max(A q, (C + (A - C) q) (1 - v^2))
 *               A = alongRiseMm, C = acrossRiseMm
 */

import type { DecorDome } from './schema.js';

/** Half the dome's width `u` along it, from the middle out. */
export const domeHalfWidth = (d: DecorDome, u: number): number => d.widthMm / 2 + d.bulgeMm * (1 - u * u) ** 2;

/** The dome's top, `along` from its centre and `across` from its middle line, above the floor; its rim's height outside it. */
export function domeTop(d: DecorDome, along: number, across: number): number {
  const u = Math.max(-1, Math.min(1, along / (d.lengthMm / 2)));
  const v = Math.max(-1, Math.min(1, across / domeHalfWidth(d, u)));
  const [arch, vault] = barrels(d, along, v);
  return d.baseMm + Math.max(arch, vault);
}

/** Which barrel is on top `along`, `across`: the arch over the track or the vault along it; a crease between them is where they swap. */
export function domeBarrel(d: DecorDome, along: number, across: number): 'arch' | 'vault' {
  const u = Math.max(-1, Math.min(1, along / (d.lengthMm / 2)));
  const [arch, vault] = barrels(d, along, Math.max(-1, Math.min(1, across / domeHalfWidth(d, u))));
  return arch >= vault ? 'arch' : 'vault';
}

/** The two barrels' heights over the corners: the arch across the track, the vault along it. */
function barrels(d: DecorDome, along: number, v: number): [number, number] {
  const s = Math.min(1, Math.abs(along) / ((d.archMm ?? d.lengthMm) / 2));
  const q = Math.sqrt(1 - s * s);
  const a = d.alongRiseMm, c = d.acrossRiseMm;
  return [a * q, (c + (a - c) * q) * (1 - v * v)];
}
