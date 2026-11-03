/**
 * WHICH PIECES ARE MEASURED: the library's tick (docs/plan/2026-11-03-verified-mark.md).
 *
 * A piece is measured when a check on a real piece backs EVERY figure it is
 * using now, within TOLERANCE_MM (decision 9A):
 *
 *   figures the piece holds ──▶ each one backed by
 *                                 two agreeing photos (agreedFigure), the 216mm trial,
 *                                 or one reading by hand (PIECE_MEASUREMENTS)
 *                               ──▶ all within ±1mm of what the piece holds? ──▶ measured
 *
 * Derived, never stored: a stored correction that moves a figure further than
 * that drops the tick, because the figure in use was never checked.
 */

import { toXY } from '../src/geom/cyclotomic.js';
import type { Part } from '../src/parts/schema.js';
import { PIECE_MEASUREMENTS, type PieceMeasurement } from './measurements.js';
import { agreedFigure, PHOTO_READINGS, TOLERANCE_MM, TRIAL, type PhotoReading } from './photoReadings.js';

/** The 216mm trial photographed the long straight, D. */
const TRIAL_PART = 'D';

const TRIAL_READINGS: readonly PhotoReading[] = TRIAL.readings.map((r) => ({
  partId: TRIAL_PART,
  figure: 'lengthMm',
  valueMm: r.valueMm,
  photo: r.photo,
  on: TRIAL.on,
}));

/**
 * The figures a check can back, by the names readings use. A straight is its
 * length; a three-ended switch is its straight road's end and its curved
 * road's end, from the heel (as photoReadings.ts reads the T switch). Other
 * shapes have no figures here yet, so nothing can mark them.
 */
function heldFigures(part: Part): Readonly<Record<string, number>> | null {
  if (part.kind === 'straight') return { lengthMm: part.lengthMm };
  if (part.kind === 'multi-road' && part.ports.length === 3) {
    const [throughMm] = toXY(part.ports[1]!.at.pos);
    const [curvedEndAlongMm, curvedEndOutMm] = toXY(part.ports[2]!.at.pos);
    return { throughMm: throughMm!, curvedEndAlongMm: curvedEndAlongMm!, curvedEndOutMm: curvedEndOutMm! };
  }
  return null;
}

/** One figure's checked value: two agreeing photos, else a reading by hand, else nothing. */
function checked(partId: string, figure: string, from: Readings): number | null {
  const photos = from.photos.filter((r) => r.partId === partId && r.figure === figure);
  const fromPhotos = agreedFigure(photos);
  if (fromPhotos !== null) return fromPhotos;
  return from.byHand.find((m) => m.partId === partId && m.figure === figure)?.valueMm ?? null;
}

/** What a tick can rest on: photo readings (the trial among them) and readings by hand. */
export interface Readings {
  readonly photos: readonly PhotoReading[];
  readonly byHand: readonly PieceMeasurement[];
}

export const READINGS: Readings = { photos: [...PHOTO_READINGS, ...TRIAL_READINGS], byHand: PIECE_MEASUREMENTS };

/** Whether a check on a real piece backs every figure this part is using now. */
export function isMeasured(part: Part, from: Readings = READINGS): boolean {
  const held = heldFigures(part);
  if (!held) return false;
  return Object.entries(held).every(([figure, value]) => {
    const v = checked(part.id, figure, from);
    return v !== null && Math.abs(v - value) <= TOLERANCE_MM;
  });
}
