/**
 * THE PRINTED SHEET'S PAGES (build mode plan: sheet 1-6; D24, D30, D47, D48).
 *
 * Value: protects=an ordinary band fits one page with every number on its
 * piece; a dense band splits into pages at a scale where numbers never
 * touch; two pieces with the same middle get one number moved aside on a
 * leader line; each band page draws the earlier bands faint
 * Value: fails_when=the enlargement, the leader search or the earlier-band
 * list goes
 * Value: why_new=no sheet existed
 * Value: seam=none: real segments from the renderer for the presets;
 * hand-made segments for the dense and coincident cases
 * Value: no_claim=what a printer does with the SVG (the print-preview check)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import type { BuildItem } from '../../engine/src/graph/buildSteps.js';
import { buildSteps } from '../../engine/src/graph/buildSteps.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { DISC_MM, PAGE_MM, sheetPages, tileName, type SheetPage } from './sheetLayout.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

function circle(): { items: readonly BuildItem[]; segments: readonly Segment[] } {
  const ids = Array(8).fill('E');
  const g: Graph = {
    pieces: ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
    welds: ids.map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${(i + 1) % 8}`, port: 0 } })),
  };
  const segments = renderGraph(g, ports, resolve, placeAll(g, ports)).segments;
  return { items: buildSteps(g, segments, { ok: true, bend: [], adapterJoints: [] }), segments };
}

/** Hand-made straights along x, `gap` mm apart, all in one band. */
function row(n: number, gap: number, band = 0): { items: BuildItem[]; segments: Segment[] } {
  const segments: Segment[] = [];
  const items: BuildItem[] = [{ kind: 'pull' }];
  for (let i = 0; i < n; i++) {
    const x = i * gap;
    segments.push({ kind: 'straight', from: { x, y: 0, h: 0 }, to: { x: x + 10, y: 0, h: 0 }, partId: 'A', pieceId: `q${band}-${i}` } as Segment);
    items.push({ kind: 'piece', step: i + 1, pieceId: `q${band}-${i}`, partId: 'A', band, phase: 'floor', onto: [], adapter: false, note: null });
  }
  items.push({ kind: 'last', pieces: n });
  return { items, segments };
}

/** Every pair of discs on a page, in paper mm. */
function closest(page: SheetPage): number {
  let best = Infinity;
  const ls = page.labels;
  for (let i = 0; i < ls.length; i++) {
    for (let j = i + 1; j < ls.length; j++) {
      best = Math.min(best, Math.hypot(ls[i]!.disc[0] - ls[j]!.disc[0], ls[i]!.disc[1] - ls[j]!.disc[1]) * page.scale);
    }
  }
  return best;
}

describe('an ordinary layout', () => {
  it('one page, every number on its own piece, no leader lines', () => {
    const { items, segments } = circle();
    const pages = sheetPages(items, segments);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.tile).toEqual({ row: 0, col: 0, rows: 1, cols: 1 });
    expect(pages[0]!.labels.map((l) => l.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pages[0]!.labels.every((l) => !l.leader)).toBe(true);
    expect(closest(pages[0]!)).toBeGreaterThanOrEqual(2 * DISC_MM);
  });
});

describe('a dense band (D30)', () => {
  /*
   * MUTATION PROOF, run: no enlargement (`scale = fit`): `expected 1 to be
   * greater than 1`, the band stays on one page and its numbers need leaders.
   */
  it('splits into pages at a scale where no two numbers touch, and needs no leader lines', () => {
    const { items, segments } = row(120, 25);
    const pages = sheetPages(items, segments);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) {
      expect(closest(p)).toBeGreaterThanOrEqual(2 * DISC_MM);
      expect(p.labels.filter((l) => l.leader)).toEqual([]);
      // Each page is one paper page.
      expect(p.view.w * p.scale).toBeCloseTo(PAGE_MM.w, 6);
    }
    // Every number is on exactly one page.
    expect(pages.flatMap((p) => p.labels.map((l) => l.step)).sort((a, b) => a - b)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(tileName(0, 2)).toBe('A3');
    expect(tileName(1, 0)).toBe('B1');
  });
});

describe('two pieces with the same middle (D48)', () => {
  /*
   * MUTATION PROOF, run: the leader search removed (every disc at its
   * piece's middle): `expected false to be true // Object.is equality`, the
   * second number left on top of the first.
   */
  it('one number moves aside on a leader line; the discs never touch', () => {
    const { items, segments } = row(2, 0);
    const pages = sheetPages(items, segments);
    expect(pages).toHaveLength(1);
    const [a, b] = pages[0]!.labels;
    expect(a!.leader).toBe(false);
    expect(b!.leader).toBe(true);
    expect(closest(pages[0]!)).toBeGreaterThanOrEqual(2 * DISC_MM);
  });
});

describe('bands (D47)', () => {
  /*
   * MUTATION PROOF, run: `earlier` never grows: `expected [] to deeply equal
   * [ 'q0-0', 'q0-1', 'q0-2' ]`.
   */
  it('each band gets its own pages, with the bands before it listed to draw faint', () => {
    const a = row(3, 200, 0);
    const b = row(2, 200, 2);
    const items: BuildItem[] = [
      ...a.items.slice(0, -1),
      { kind: 'band', band: 2, phase: 'raised', level: 1 },
      ...b.items.slice(1, -1).map((i) => (i.kind === 'piece' ? { ...i, step: i.step + 3 } : i)),
      { kind: 'last', pieces: 5 },
    ];
    const pages = sheetPages(items, [...a.segments, ...b.segments]);
    expect(pages.map((p) => p.band)).toEqual([0, 2]);
    expect(pages[0]!.earlier).toEqual([]);
    expect(pages[1]!.earlier).toEqual(['q0-0', 'q0-1', 'q0-2']);
    expect(pages[1]!.labels.map((l) => l.step)).toEqual([4, 5]);
  });

  it('a step with a note is marked for its asterisk', () => {
    const { items, segments } = row(2, 200);
    const noted = items.map((i) => (i.kind === 'piece' && i.step === 2 ? { ...i, note: { kind: 'unchecked' as const, reason: null } } : i));
    expect(sheetPages(noted, segments)[0]!.labels.map((l) => l.note)).toEqual([false, true]);
  });
});

describe('pages read top to bottom (the sheet is flipped like the canvas)', () => {
  /*
   * MUTATION PROOF, run: rows counted from the lowest y again
   * (`bandBox.minY + row * th`): `expected -30 to be greater than 2253.75`.
   */
  it('row A is the band\'s top: the highest y on the floor', () => {
    // A column of pieces along y, dense enough to split into rows.
    const segments: Segment[] = [];
    const items: BuildItem[] = [{ kind: 'pull' }];
    for (let i = 0; i < 120; i++) {
      const y = i * 25;
      segments.push({ kind: 'straight', from: { x: 0, y, h: Math.PI / 2 }, to: { x: 0, y: y + 10, h: Math.PI / 2 }, partId: 'A', pieceId: `c${i}` } as Segment);
      items.push({ kind: 'piece', step: i + 1, pieceId: `c${i}`, partId: 'A', band: 0, phase: 'floor', onto: [], adapter: false, note: null });
    }
    const pages = sheetPages(items, segments);
    const first = pages.find((p) => p.tile.row === 0)!;
    const last = pages.find((p) => p.tile.row === first.tile.rows - 1)!;
    expect(first.tile.rows).toBeGreaterThan(1);
    expect(first.view.minY).toBeGreaterThan(last.view.minY);
  });
});

describe('the band in the middle of the page (design review FINDING-006)', () => {
  /*
   * MUTATION PROOF, run: the centring offsets removed (`x0 = bandBox.minX`,
   * `y0 = bandBox.minY`): `expected 107.15953307392996 to be close to +0,
   * received difference is 107.15953307392996`, the band against the
   * page's first edge.
   */
  it('a band smaller than the page is centred on it', () => {
    const { items, segments } = row(3, 200);
    const [page] = sheetPages(items, segments);
    const b = page!.bandBox;
    expect(page!.view.minX + page!.view.w / 2).toBeCloseTo(b.minX + b.w / 2, 6);
    expect(page!.view.minY + page!.view.h / 2).toBeCloseTo(b.minY + b.h / 2, 6);
  });
});
