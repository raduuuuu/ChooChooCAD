/**
 * WHERE EACH PIECE ENDS, AND THE GRID UNDER IT (requests 2 and 4 of the
 * 2026-10-22 editing plan; decisions 11A, 12A, R4/D3).
 *
 * Value: protects=three straights in a row show two seams across the plank;
 * the grid step keeps a cell at least 20px and its caption names it; both
 * marks use their measured tokens and keep their weight at every zoom
 * Value: fails_when=a seam is drawn on a gapped or refused joint, at the wrong
 * width, or not at all; the grid step ignores the drawn size; the stylesheet
 * names another token or drops `non-scaling-stroke`
 * Value: why_new=no spec covered a seam or a grid; both are new
 * Value: seam=none (pure helpers, `renderToStaticMarkup`, stylesheet as text)
 * Value: no_claim=how the marks look in a browser; jsdom has no layout, so
 * the measured-size branch of `gridStep` is pinned as a pure function only
 */

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { PRESETS } from './presets.js';
import { TrackCanvas } from './TrackCanvas.js';
import { gridLabel, gridPath, gridStep, seamLines, visibleBox } from './trackPath.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

const build = (ids: readonly string[]): Graph =>
  ids.reduce((s, partId) => reduce(s, { kind: 'add', partId, turn: 'left' }, ports), START).graph;

const seamsOf = (graph: Graph, refused: ReadonlySet<number> = new Set()) => {
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
  return {
    render,
    seams: seamLines(
      graph.welds,
      render.ports,
      (id) => resolve(partOf.get(id)!).plankWidthMm,
      refused,
    ),
  };
};

const length = (s: { from: readonly [number, number]; to: readonly [number, number] }) =>
  Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);

describe('a seam marks every joint where two pieces meet', () => {
  /*
   * MUTATION PROOFS, run:
   * - `seamLines` drops the coincidence check: the Near miss spec fails with
   *   `expected [ …(10) ] to have a length of 9 but got 10`.
   * - it drops the refused check: `expected [ { from: [ 144, -20 ], …(1) },
   *   …(1) ] to have a length of 1 but got 2`.
   * - the normal is swapped for the tangent, so the seam lies along the
   *   track: `the seam runs along the track: expected 124 to be close to
   *   164`.
   * - TrackCanvas maps over an empty list instead of `seams`: the canvas spec
   *   below fails with `expected +0 to be 2`.
   * - the seam names a piece it does not join (`pieceId: 'x'`), so a dragged
   *   run would leave its seams behind on the floor: `expected [ 'p0', 'p1' ]
   *   to include 'x'`.
   */
  it('three straights show two seams, each across the full plank at the joint', () => {
    const graph = build(['A', 'A', 'A']);
    const { seams } = seamsOf(graph);

    expect(seams).toHaveLength(2);
    // A is 40mm wide; the line spans it, centred on the joint at x = 144, 288.
    for (const [i, s] of seams.entries()) {
      expect(length(s)).toBeCloseTo(resolve('A').plankWidthMm, 9);
      expect((s.from[0] + s.to[0]) / 2).toBeCloseTo(144 * (i + 1), 9);
      expect((s.from[1] + s.to[1]) / 2).toBeCloseTo(0, 9);
      // Across the track, not along it: the run heads along x, so the seam
      // stands on one x.
      expect(s.from[0], 'the seam runs along the track').toBeCloseTo(s.to[0], 9);
      // It names a piece it joins, so a dragged run takes its seams along.
      const w = graph.welds[i]!;
      expect([w.a.pieceId, w.b.pieceId]).toContain(s.pieceId);
    }
  });

  it('skips a joint the verdict refused, which carries its own marker', () => {
    const graph = build(['A', 'A', 'A']);
    expect(seamsOf(graph, new Set([0])).seams).toHaveLength(1);
  });

  /*
   * The Near miss preset's closing weld does not meet (that is the preset's
   * point), so its two ends are apart and there is no joint to draw across.
   * The gap annotation marks that spot instead.
   */
  it('skips a closing joint whose ends do not meet', () => {
    const near = PRESETS.find((p) => p.label === 'Near miss')!;
    const graph = reduce(START, { kind: 'preset', ids: near.pieces }, ports).graph;
    expect(graph.welds).toHaveLength(near.pieces.length);
    expect(seamsOf(graph).seams).toHaveLength(near.pieces.length - 1);
  });
});

describe('the grid step follows the drawn size', () => {
  /*
   * MUTATION PROOFS, run:
   * - `step * pxPerMm > GRID_MIN_CELL_PX` (strict): `expected 200 to be 100`.
   * - `spanMm / step < 40` (strict): `expected 200 to be 100`.
   * - the measurement is ignored (always 100 when one exists): `expected 100
   *   to be 200`.
   * - `gridPath` starts at `Math.floor`: `expected [ -200, -100, +0, 100, 200 ]
   *   to deeply equal [ -100, +0, 100, 200 ]`.
   */
  it('picks the smallest step whose cell is at least 20px', () => {
    expect(gridStep(5000, 0.2)).toBe(100); // 100mm x 0.2 = 20px exactly
    expect(gridStep(5000, 0.19)).toBe(200); // 19px is too small; 38px
    expect(gridStep(5000, 0.0039)).toBe(10000); // nothing reaches 20px: the largest
  });

  it('without a measurement, draws at most 40 lines across the larger side', () => {
    expect(gridStep(4000, null)).toBe(100);
    expect(gridStep(4001, null)).toBe(200);
  });

  it('puts lines on multiples of the step from the model origin', () => {
    const d = gridPath(-150, -50, 400, 200, 100);
    const verticals = [...d.matchAll(/M (-?[\d.]+) -50 V/g)].map((m) => Number(m[1]));
    const horizontals = [...d.matchAll(/M -150 (-?[\d.]+) H/g)].map((m) => Number(m[1]));
    expect(verticals).toEqual([-100, 0, 100, 200]);
    expect(horizontals).toEqual([0, 100]);
  });

  /*
   * Seen in a browser: a long thin layout is letterboxed, and a grid bounded
   * by the viewBox stopped short above and below the track.
   *
   * MUTATION PROOF, run: `visibleBox` keeps the viewBox size (the shipped
   * first version): `expected { minX: +0, minY: +0, …(3) } to deeply equal {
   * minX: +0, minY: -400, …(3) }`.
   */
  it('covers the whole drawn floor, centred on the viewBox', () => {
    // A 1000 x 200 mm view drawn into 500 x 500 px: 0.5 px/mm, so 1000 x 1000 mm shown.
    const shown = visibleBox({ minX: 0, minY: 0, width: 1000, height: 200 }, { width: 500, height: 500 });
    expect(shown).toEqual({ minX: 0, minY: -400, width: 1000, height: 1000, pxPerMm: 0.5 });
    // No measurement: only the viewBox is known.
    expect(visibleBox({ minX: 3, minY: 4, width: 5, height: 6 }, null)).toEqual({
      minX: 3, minY: 4, width: 5, height: 6, pxPerMm: null,
    });
  });

  it('names the step in centimetres, then metres', () => {
    expect([100, 200, 500, 1000, 2000, 5000, 10000].map(gridLabel)).toEqual([
      '10 cm', '20 cm', '50 cm', '1 m', '2 m', '5 m', '10 m',
    ]);
  });
});

describe('the canvas draws them', () => {
  it('one grid path, one seam line per seam, and the caption', () => {
    const graph = build(['A', 'A', 'A']);
    const { render, seams } = seamsOf(graph);
    const html = renderToStaticMarkup(createElement(TrackCanvas, { render, resolve, seams }));

    expect(html.split('class="grid"').length - 1).toBe(1);
    expect(html.split('class="seam"').length - 1).toBe(2);
    // No measurement in a static render, so the fallback picks the step.
    expect(html).toContain('Grid: 10 cm');
  });
});

/*
 * Stylesheet and tokens as TEXT (CLAUDE.md: there is no CSS engine here), with
 * comments stripped so a comment quoting a rule cannot stand in for it, and
 * the LAST matching declaration read, since a later rule wins.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const appCss = strip(readFileSync(new URL('./app.css', import.meta.url), 'utf8'));
const tokens = strip(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'));
const lastDecl = (selector: string, prop: string): string | undefined => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bodies = [...appCss.matchAll(new RegExp(`(?:^|[}\\s,])${esc}\\s*\\{([^}]*)\\}`, 'g'))];
  const values = bodies.flatMap((b) =>
    [...(b[1] ?? '').matchAll(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'g'))].map((d) =>
      (d[1] ?? '').trim(),
    ),
  );
  return values[values.length - 1];
};
const token = (name: string) => new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(tokens)?.[1]?.trim();

describe('the seam and grid use their measured tokens at a fixed device weight', () => {
  /*
   * MUTATION PROOFS, run:
   * - `.seam` stroked with `var(--track-edge)`, the 2.54:1 tone 11A replaced:
   *   `expected 'var(--track-edge)' to be 'var(--seam)'`.
   * - `vector-effect` dropped from `.grid`: `expected undefined to be
   *   'non-scaling-stroke'`.
   */
  it('the seam is --seam, the measured wood tone, not the plank edge', () => {
    expect(lastDecl('.seam', 'stroke')).toBe('var(--seam)');
    expect(token('seam')).toBe('#6e5a38');
    expect(lastDecl('.seam', 'vector-effect')).toBe('non-scaling-stroke');
  });

  it('the grid is --grid-line, the documented faint tone', () => {
    expect(lastDecl('.grid', 'stroke')).toBe('var(--grid-line)');
    expect(token('grid-line')).toBe('#d8cfbe');
    expect(lastDecl('.grid', 'vector-effect')).toBe('non-scaling-stroke');
  });
});
