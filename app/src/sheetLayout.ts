/**
 * THE PRINTED SHEET'S PAGES (build mode plan, sheet scope 1-6; D24, D30, D47,
 * D48). Pure: where each band's drawing goes on paper, at what scale, split
 * into how many pages, and where every step number sits.
 *
 *   band ─▶ fit its drawing to one landscape page (D24)
 *        ─▶ any two numbers closer than a disc apart? enlarge until they are
 *           not, and split the band into a grid of pages (D30), at most
 *           MAX_TILE_SIDE a side
 *        ─▶ place numbers in step order; one that still lands on another
 *           (two pieces with the same middle, or past the cap) moves to the
 *           nearest free spot with a leader line back to its piece (D48)
 *
 * Paper sizes are in millimetres. The printable box is the smaller of A4 and
 * Letter in landscape, less margins, so either printer paper fits (D24).
 */

import type { Segment } from '../../engine/src/geom/fk.js';
import type { BuildItem } from '../../engine/src/graph/buildSteps.js';
import { segmentMid } from './trackPath.js';

/** The drawing's box on paper, mm: A4 and Letter landscape, less 10mm margins and a header. */
export const PAGE_MM = { w: 257, h: 150 } as const;
/** A step number's disc radius on paper, mm: an 8pt number in a ring (D47). */
export const DISC_MM = 2.6;
/** Margin kept round the track inside the page, in layout mm. */
const PAD_MM = 30;
/** A band splits into at most this many pages a side; past it, leader lines carry the rest (D48). */
export const MAX_TILE_SIDE = 4;

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly w: number;
  readonly h: number;
}

export interface SheetLabel {
  readonly step: number;
  readonly pieceId: string;
  /** The piece's middle, layout mm. */
  readonly at: readonly [number, number];
  /** Where the number's disc is drawn, layout mm. */
  readonly disc: readonly [number, number];
  /** The disc moved off the piece: a leader line runs back to `at`. */
  readonly leader: boolean;
  /** The step carries a note; the number gets an asterisk and the sentence goes in the table (D47). */
  readonly note: boolean;
}

export interface SheetPage {
  readonly band: number;
  /** Row and column of this page in its band's grid, and the grid's size; 1 x 1 when the band fits one page. */
  readonly tile: { readonly row: number; readonly col: number; readonly rows: number; readonly cols: number };
  /** The part of the layout this page shows, layout mm. */
  readonly view: Box;
  /** The whole band's box, for the page map (D48). */
  readonly bandBox: Box;
  /** Paper mm per layout mm. */
  readonly scale: number;
  readonly labels: readonly SheetLabel[];
  /** Pieces drawn faint (earlier bands) and in full (this band). */
  readonly earlier: readonly string[];
  readonly current: readonly string[];
}

type Piece = Extract<BuildItem, { kind: 'piece' }>;

function boxOf(points: readonly (readonly [number, number])[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (x0 === Infinity) return { minX: 0, minY: 0, w: 1, h: 1 };
  return { minX: x0 - PAD_MM, minY: y0 - PAD_MM, w: x1 - x0 + 2 * PAD_MM, h: y1 - y0 + 2 * PAD_MM };
}

/** The smallest distance between two of the points that are not on top of each other, by a grid hash. */
export function nearestApart(points: readonly (readonly [number, number])[], cell: number): number {
  const grid = new Map<string, (readonly [number, number])[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  let best = Infinity;
  for (const p of points) {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (d > 1 && d < best) best = d;
        }
      }
    }
    const k = key(p[0], p[1]);
    const list = grid.get(k);
    if (list) list.push(p);
    else grid.set(k, [p]);
  }
  return best;
}

/** Discs placed in step order: each at its piece's middle if free, else the nearest free spot round it. */
function placeLabels(
  wanted: readonly { step: number; pieceId: string; at: readonly [number, number]; note: boolean }[],
  view: Box,
  scale: number,
): SheetLabel[] {
  const r = DISC_MM / scale; // disc radius in layout mm
  const gap = 2 * r * 1.05;
  const cell = gap;
  const grid = new Map<string, (readonly [number, number])[]>();
  const key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const free = (x: number, y: number) => {
    // The centre stays on the page; a disc may hang into the 10mm margin by its radius.
    if (x < view.minX || y < view.minY || x > view.minX + view.w || y > view.minY + view.h) return false;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (Math.hypot(x - q[0], y - q[1]) < gap) return false;
      }
    }
    return true;
  };
  const out: SheetLabel[] = [];
  for (const w of wanted) {
    let spot: readonly [number, number] = w.at;
    let leader = false;
    if (!free(w.at[0], w.at[1])) {
      search: for (let ring = 1; ring <= 6; ring++) {
        const d = ring * gap;
        const n = 8 * ring;
        for (let k = 0; k < n; k++) {
          const a = (2 * Math.PI * k) / n;
          const x = w.at[0] + Math.cos(a) * d;
          const y = w.at[1] + Math.sin(a) * d;
          if (free(x, y)) {
            spot = [x, y];
            leader = true;
            break search;
          }
        }
      }
    }
    const k = key(spot[0], spot[1]);
    const list = grid.get(k);
    if (list) list.push(spot);
    else grid.set(k, [spot]);
    out.push({ step: w.step, pieceId: w.pieceId, at: w.at, disc: spot, leader, note: w.note });
  }
  return out;
}

export function sheetPages(items: readonly BuildItem[], segments: readonly Segment[]): readonly SheetPage[] {
  const pieces = items.filter((i): i is Piece => i.kind === 'piece');
  const segsOf = new Map<string, Segment[]>();
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    const list = segsOf.get(s.pieceId);
    if (list) list.push(s);
    else segsOf.set(s.pieceId, [s]);
  }
  const mid = (pieceId: string): readonly [number, number] => {
    const s = segsOf.get(pieceId)?.[0];
    if (!s) return [0, 0];
    const m = segmentMid(s);
    return [m.x, m.y];
  };
  const bands = [...new Set(pieces.map((p) => p.band))];
  const pages: SheetPage[] = [];
  const earlier: string[] = [];
  for (const band of bands) {
    const current = pieces.filter((p) => p.band === band);
    const ids = [...earlier, ...current.map((p) => p.pieceId)];
    const pts: (readonly [number, number])[] = [];
    for (const id of ids) for (const s of segsOf.get(id) ?? []) pts.push([s.from.x, s.from.y], [s.to.x, s.to.y], (() => { const m = segmentMid(s); return [m.x, m.y] as const; })());
    const bandBox = boxOf(pts);
    const fit = Math.min(PAGE_MM.w / bandBox.w, PAGE_MM.h / bandBox.h);
    const wanted = current.map((p) => ({ step: p.step, pieceId: p.pieceId, at: mid(p.pieceId), note: p.note !== null }));
    // Enlarge until the closest two numbers no longer touch (D30), within the cap (D48).
    const apart = nearestApart(wanted.map((w) => w.at), (2 * DISC_MM) / fit);
    const need = apart === Infinity ? fit : (2 * DISC_MM * 1.05) / apart;
    const scale = Math.min(Math.max(fit, need), fit * MAX_TILE_SIDE);
    const cols = Math.max(1, Math.ceil((bandBox.w * scale) / PAGE_MM.w - 1e-9));
    const rows = Math.max(1, Math.ceil((bandBox.h * scale) / PAGE_MM.h - 1e-9));
    const tw = PAGE_MM.w / scale;
    const th = PAGE_MM.h / scale;
    // The band sits in the middle of its pages, not against the first one's edge (design review FINDING-006).
    const x0 = bandBox.minX - (cols * tw - bandBox.w) / 2;
    const y0 = bandBox.minY - (rows * th - bandBox.h) / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Row 0 is the TOP of the printed band: the drawing is flipped like the
        // canvas (y up on the floor), so the top row holds the highest y.
        const view: Box = { minX: x0 + col * tw, minY: y0 + (rows - 1 - row) * th, w: tw, h: th };
        const here = wanted.filter((w) => w.at[0] >= view.minX && w.at[0] < view.minX + tw && w.at[1] >= view.minY && w.at[1] < view.minY + th);
        pages.push({
          band,
          tile: { row, col, rows, cols },
          view,
          bandBox,
          scale,
          labels: placeLabels(here, view, scale),
          earlier: [...earlier],
          current: current.map((p) => p.pieceId),
        });
      }
    }
    earlier.push(...current.map((p) => p.pieceId));
  }
  return pages;
}

/** A page's name in its band's grid: rows by letter, columns by number, "A1" (D48). */
export const tileName = (row: number, col: number) => `${String.fromCharCode(65 + row)}${col + 1}`;
