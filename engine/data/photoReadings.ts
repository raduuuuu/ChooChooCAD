/**
 * READINGS TAKEN FROM THE OWNER'S PHOTOS, and the rules that decide what a
 * reading may change (plan 2026-11-02: C1, C2, OV7, OV8; tolerance 1mm by the
 * owner after the 216mm trial, 2026-11-03).
 *
 *   readings of one figure ──▶ two photos agree within AGREE_MM? (C2)
 *                              any switch fit off by more than TOLERANCE_MM? (OV7: not counted)
 *   every required figure agreed? ── no ──▶ 'partial': nothing changes (OV8)
 *                                 └─ yes ─▶ part unverified          ──▶ 'measured': the photo figures replace it
 *                                           published, all within     ──▶ 'confirmed': figures kept, photo recorded (C1)
 *                                           published, one off by more ─▶ 'measured', and the PR says which (C1)
 *
 * Photos are never committed (SEC1). A reading names its photo by the local
 * file name only, so a figure can be traced on the owner's machine.
 *
 * Every figure landed from photos is good to ±TOLERANCE_MM, and says so.
 * The method was cleared by the 216mm trial (EO7) recorded in TRIAL. A part
 * held as 'user-measured' must match its readings (photoReadings.test.ts).
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

/*
 * The T switch (2026-11-03): photos 84404 and 84405, each with the medium
 * straight beside it. Along and out are the curved road's end measured from
 * the heel along the straight and out from its centreline. Its fit residual
 * is how far the whole-millimetre model, (108, 106), sits from the photos'
 * agreed (108.50, 105.53): 0.69mm.
 */
const T_PHOTOS = [
  { photo: '84404.jpg', throughMm: 216.43, alongMm: 108.5, outMm: 105.71 },
  { photo: '84405.jpg', throughMm: 216.49, alongMm: 108.49, outMm: 105.34 },
] as const;

export const PHOTO_READINGS: readonly PhotoReading[] = T_PHOTOS.flatMap((p) => [
  { partId: 'T', figure: 'throughMm', valueMm: p.throughMm, photo: p.photo, on: '2026-11-03' },
  { partId: 'T', figure: 'curvedEndAlongMm', valueMm: p.alongMm, photo: p.photo, on: '2026-11-03', fitResidualMm: 0.69 },
  { partId: 'T', figure: 'curvedEndOutMm', valueMm: p.outMm, photo: p.photo, on: '2026-11-03', fitResidualMm: 0.69 },
]);

/**
 * ±1mm, the owner's call after the 216mm trial (2026-11-03): what a photo
 * figure is good to. A fitted shape must match this closely (OV7), a
 * published figure is overruled only by more than this (C1), and the trial
 * had to read its known piece this closely (EO7). The trial's two photos both
 * read about 0.7mm long, an offset not yet explained (the method, or the
 * owner's pieces).
 */
export const TOLERANCE_MM = 1;

/** Two photos of one figure must agree this closely (C2; the owner kept it at 0.5mm, 2026-11-03). */
export const AGREE_MM = 0.5;

/** The 216mm trial (EO7): a long straight read through the whole method, the medium straight as reference. */
export const TRIAL = {
  on: '2026-11-03',
  knownMm: 216,
  readings: [
    { photo: '84401.jpg', valueMm: 216.52 },
    { photo: '84402.jpg', valueMm: 216.88 },
  ],
} as const;

/** One figure's agreed value: two or more usable readings, from different photos, within AGREE_MM. */
export function agreedFigure(readings: readonly PhotoReading[]): number | null {
  const usable = readings.filter((r) => (r.fitResidualMm ?? 0) <= TOLERANCE_MM);
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
  const contradicted = Object.keys(required).filter((f) => Math.abs(agreed[f]! - required[f]!) > TOLERANCE_MM);
  if (status === 'published' && contradicted.length === 0) return { kind: 'confirmed' };
  return { kind: 'measured', figures: agreed, contradicted };
}
