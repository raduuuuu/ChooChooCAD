/**
 * The table or room the track has to fit on (backlog E4, owner ruling
 * 2026-10-23: the outline is centred on the track, and only its size is saved).
 *
 * WHY CENTRED AND NOT PLACED. The question people bring is "does it fit", and
 * for a rectangle under a layout that has one answer whatever the position:
 * the track's own extent against the table's, each way round. Centring the
 * outline shows that answer with an equal overhang either side, and saves no
 * position, so there is no second persisted value to go stale as the layout
 * grows. A draggable outline was offered and declined.
 *
 * WHY THE FOOTPRINT AND NOT `renderBounds`. `renderBounds` covers the
 * centreline's ends, which is right for framing a view and wrong for a fit:
 * it misses half a plank on every outside edge and a curve's bulge past its
 * ends. A fit that says "fits" with 2 cm of wood over the edge is the one
 * answer this feature cannot get wrong, so the extent here is the plank edges,
 * exactly.
 */

import type { Segment } from '../../engine/src/geom/fk.js';
import { TABLE_STORAGE_KEY } from './storageKeys.js';
import type { LoadResult } from './inventoryModel.js';

/** Width and depth in whole millimetres, as entered. `null` is no table. */
export type Table = { readonly widthMm: number; readonly depthMm: number } | null;

export interface Extent {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The smallest and largest side this accepts, in centimetres. */
export const TABLE_MIN_CM = 10;
export const TABLE_MAX_CM = 2000;

/**
 * A side as typed, in centimetres, to whole millimetres, or `null` to refuse.
 *
 *   '120'   -> 1200
 *   '80.5'  -> 805
 *   ''      -> null    no side is not a side; the field shows as invalid
 *   '5'     -> null    under TABLE_MIN_CM: a typo, not a table
 *   'abc'   -> null
 */
export function sanitizeSideCm(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < TABLE_MIN_CM || n > TABLE_MAX_CM) return null;
  return Math.round(n * 10);
}

/**
 * Where the wood actually reaches: every plank edge, curves included.
 *
 * A straight's plank is a rectangle, so its four corners bound it. A curve's
 * edges are two concentric arcs; each is bounded by its two ends plus any
 * point where it crosses due east, north, west or south of its centre, since
 * that is where an arc reaches past its own ends. Both are exact, which is
 * the point: see the file comment.
 */
export function trackExtent(
  segments: readonly Segment[],
  plankHalfWidth: (partId: string) => number,
): Extent | null {
  if (segments.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const s of segments) {
    const half = plankHalfWidth(s.partId);
    if (s.kind === 'straight') {
      for (const p of [s.from, s.to]) {
        const nx = -Math.sin(p.h) * half;
        const ny = Math.cos(p.h) * half;
        take(p.x + nx, p.y + ny);
        take(p.x - nx, p.y - ny);
      }
      continue;
    }
    // The centre, as `plankEdges` and `labelSpot` find it.
    const r = s.centrelineRadiusMm ?? 0;
    const sign = s.sweep === 'left' ? 1 : -1;
    const cx = s.from.x - Math.sin(s.from.h) * r * sign;
    const cy = s.from.y + Math.cos(s.from.h) * r * sign;
    const a0 = Math.atan2(s.from.y - cy, s.from.x - cx);
    const a1 = Math.atan2(s.to.y - cy, s.to.x - cx);
    // Signed sweep from a0 to a1, the short way: no BRIO curve turns past 180.
    let span = a1 - a0;
    while (span > Math.PI) span -= 2 * Math.PI;
    while (span <= -Math.PI) span += 2 * Math.PI;
    const crossings: number[] = [];
    for (let k = -4; k <= 4; k++) {
      const a = (k * Math.PI) / 2;
      const t = (a - a0) / span;
      if (t > 0 && t < 1) crossings.push(a);
    }
    for (const radius of [r - half, r + half]) {
      for (const a of [a0, a1, ...crossings]) take(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    }
  }
  return { minX, minY, maxX, maxY };
}

export interface TableFit {
  /** The track's size along x and along y, in mm. */
  readonly trackW: number;
  readonly trackD: number;
  /** The table as drawn: along x and along y, in mm. */
  readonly drawnW: number;
  readonly drawnD: number;
  /** How far the track runs past the table along x and along y, in mm; 0 when it does not. */
  readonly overW: number;
  readonly overD: number;
  readonly fits: boolean;
  /** Whether the outline is drawn with the user's depth along x. */
  readonly turned: boolean;
  /** The outline, centred on the track. */
  readonly outline: Extent;
}

/**
 * The fit, each way round, and the outline in whichever way round is better.
 *
 * A table has no right way round on a floor plan, so the user's width and
 * depth are tried both ways. The better one is the one that fits, else the one
 * with the smaller total overhang; a tie keeps the order as entered.
 */
export function tableFit(extent: Extent, table: NonNullable<Table>): TableFit {
  const trackW = extent.maxX - extent.minX;
  const trackD = extent.maxY - extent.minY;
  const tryWay = (w: number, d: number) => {
    const overW = Math.max(0, trackW - w);
    const overD = Math.max(0, trackD - d);
    return { w, d, overW, overD, total: overW + overD };
  };
  const asEntered = tryWay(table.widthMm, table.depthMm);
  const turned = tryWay(table.depthMm, table.widthMm);
  const best = turned.total < asEntered.total ? turned : asEntered;
  const cx = (extent.minX + extent.maxX) / 2;
  const cy = (extent.minY + extent.maxY) / 2;
  return {
    trackW,
    trackD,
    drawnW: best.w,
    drawnD: best.d,
    overW: best.overW,
    overD: best.overD,
    fits: best.total === 0,
    turned: best === turned,
    outline: { minX: cx - best.w / 2, minY: cy - best.d / 2, maxX: cx + best.w / 2, maxY: cy + best.d / 2 },
  };
}

/** A length in mm as whole centimetres, rounded up: a size never reads smaller than it is. */
const cmUp = (mm: number): number => Math.ceil(mm / 10 - 1e-9);
/** A table side in mm as centimetres, as the user typed it (one decimal at most). */
const cmAsEntered = (mm: number): string => String(mm / 10);

/**
 * The fit as one sentence, for under the canvas.
 *
 * It names the TABLE'S sides, not "long" and "wide": the outline may be drawn
 * turned, so the drawing's x is not always the side the user called width.
 * The track's size is listed in the table's order for the same reason.
 *
 * Track sizes and overhangs round UP to the centimetre, so "fits" is never
 * contradicted by its own numbers: an overhang of 0.3 mm is "1 cm", never
 * "0 cm".
 */
export function fitSentence(fit: TableFit, table: NonNullable<Table>): string {
  const w = cmAsEntered(table.widthMm);
  const d = cmAsEntered(table.depthMm);
  // Along the user's width first, then along their depth.
  const [alongW, alongD] = fit.turned ? [fit.trackD, fit.trackW] : [fit.trackW, fit.trackD];
  const [overW, overD] = fit.turned ? [fit.overD, fit.overW] : [fit.overW, fit.overD];
  const tableText = `${w} × ${d} cm table`;
  const trackText = `the track is ${cmUp(alongW)} × ${cmUp(alongD)} cm`;
  if (fit.fits) return `Fits your ${tableText}: ${trackText}.`;
  let over: string;
  if (overW > 0 && overD > 0) {
    over = w === d
      ? `${cmUp(overW)} cm and ${cmUp(overD)} cm over its ${w} cm sides`
      : `${cmUp(overW)} cm over its ${w} cm side and ${cmUp(overD)} cm over its ${d} cm side`;
  } else {
    over = overW > 0 ? `${cmUp(overW)} cm over its ${w} cm side` : `${cmUp(overD)} cm over its ${d} cm side`;
  }
  return `Too big for your ${tableText}: ${trackText}, ${over}.`;
}

/*
 * Persistence. Same discipline as the inventory: a blob that is not exactly
 * a valid table is DISCARDED with a sentence saying so, never repaired. The
 * fallback is no table, which only hides an outline; nothing else reads it.
 */
const STORAGE_KEY = TABLE_STORAGE_KEY;
const UNREADABLE = 'Your saved table size could not be read, so the table outline was removed.';

const validSide = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isInteger(v) &&
  v >= TABLE_MIN_CM * 10 &&
  v <= TABLE_MAX_CM * 10;

export function loadTable(): LoadResult<Table> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { value: null };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { value: null, discarded: UNREADABLE };
    }
    const { widthMm, depthMm } = parsed as Record<string, unknown>;
    if (!validSide(widthMm) || !validSide(depthMm)) return { value: null, discarded: UNREADABLE };
    return { value: { widthMm, depthMm } };
  } catch {
    return { value: null, discarded: UNREADABLE };
  }
}

export function saveTable(table: Table): void {
  try {
    if (table === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ widthMm: table.widthMm, depthMm: table.depthMm }));
  } catch {
    // Private browsing and full quotas both throw; see saveInventory.
  }
}
