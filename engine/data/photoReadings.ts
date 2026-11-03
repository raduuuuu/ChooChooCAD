/**
 * READINGS TAKEN FROM THE OWNER'S PHOTOS, and the rules that decide what a
 * reading may change (plan 2026-11-02: C1, C2, OV7, OV8).
 *
 *   readings of one figure ──▶ two photos agree within AGREE_MM? (C2)
 *                              any switch fit off by more than AGREE_MM? (OV7: not counted)
 *   every required figure agreed? ── no ──▶ 'partial': nothing changes (OV8)
 *                                 └─ yes ─▶ part unverified          ──▶ 'measured': the photo figures replace it
 *                                           published, all within     ──▶ 'confirmed': figures kept, photo recorded (C1)
 *                                           published, one off by more ─▶ 'measured', and the PR says which (C1)
 *
 * Photos are never committed (SEC1). A reading names its photo by the local
 * file name only, so a figure can be traced on the owner's machine.
 *
 * Empty until the 216mm trial (EO7) passes: no figure lands before the method
 * has measured a piece whose answer is known.
 */

import type { DimensionStatus } from '../src/parts/schema.js';

export interface PhotoReading {
  readonly partId: string;
  /** The figure read, by its field name on the part, e.g. 'lengthMm'. */
  readonly figure: string;
  readonly valueMm: number;
  /** The photo's local file name (never committed). */
  readonly photo: string;
  /** When it was read, YYYY-MM-DD. */
  readonly on: string;
  /** For a switch or crossing: how far the fitted shape misses the photographed ends (OV7). */
  readonly fitResidualMm?: number;
}

export const PHOTO_READINGS: readonly PhotoReading[] = [];

/** Two photos must agree this closely, and a fitted shape must match this closely (C2, OV7). */
export const AGREE_MM = 0.5;

/** One figure's agreed value: two or more usable readings, from different photos, within AGREE_MM. */
export function agreedFigure(readings: readonly PhotoReading[]): number | null {
  const usable = readings.filter((r) => (r.fitResidualMm ?? 0) <= AGREE_MM);
  if (new Set(usable.map((r) => r.photo)).size < 2) return null;
  const values = usable.map((r) => r.valueMm);
  if (Math.max(...values) - Math.min(...values) > AGREE_MM) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type PhotoOutcome =
  | { readonly kind: 'partial'; readonly missing: readonly string[] }
  | { readonly kind: 'confirmed' }
  | { readonly kind: 'measured'; readonly figures: Readonly<Record<string, number>>; readonly contradicted: readonly string[] };

/**
 * What the photos may do to one part. `required` is every figure the part
 * needs, with its current value; heights included where the part has one (C3).
 */
export function photoOutcome(
  status: DimensionStatus,
  required: Readonly<Record<string, number>>,
  readings: readonly PhotoReading[],
): PhotoOutcome {
  const agreed: Record<string, number> = {};
  const missing: string[] = [];
  for (const figure of Object.keys(required)) {
    const v = agreedFigure(readings.filter((r) => r.figure === figure));
    if (v === null) missing.push(figure);
    else agreed[figure] = v;
  }
  if (missing.length > 0) return { kind: 'partial', missing };
  const contradicted = Object.keys(required).filter((f) => Math.abs(agreed[f]! - required[f]!) > AGREE_MM);
  if (status === 'published' && contradicted.length === 0) return { kind: 'confirmed' };
  return { kind: 'measured', figures: agreed, contradicted };
}
