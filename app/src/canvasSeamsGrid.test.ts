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
import { gridLabel, gridPath, gridStep, pastEdges, SEAM_OVERHANG_PX, seamLines, visibleBox } from './trackPath.js';

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

  /*
   * THE SEAM RUNS PAST THE PLANK (design review 26A): on a straight run a
   * seam inside the 40mm plank vanished into the grooves.
   *
   * MUTATION PROOF, run: the canvas draws `m.from`/`m.to` instead of
   * `pastEdges(...)`: `expected [ 40, 40 ] to deeply equal [ 48, 48 ]`.
   */
  it('draws each seam past both plank edges', () => {
    const graph = build(['A', 'A', 'A']);
    const { render, seams } = seamsOf(graph);
    const html = renderToStaticMarkup(createElement(TrackCanvas, { render, resolve, seams }));
    const drawn = [...html.matchAll(/<line class="seam" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map((m) =>
      Math.round(Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2]))),
    );
    // No measurement in a static render, so one CSS px is one mm: 40 + 2 x 4.
    expect(drawn).toEqual([40 + 2 * SEAM_OVERHANG_PX, 40 + 2 * SEAM_OVERHANG_PX]);
  });

  it('lengthens a seam along its own line, and leaves a point alone', () => {
    const [a, b] = pastEdges({ from: [0, -20], to: [0, 20], pieceId: 'p' }, 4);
    expect([a[0] + 0, a[1], b[0] + 0, b[1]]).toEqual([0, -24, 0, 24]);
    expect(pastEdges({ from: [5, 5], to: [5, 5], pieceId: 'p' }, 4)).toEqual([[5, 5], [5, 5]]);
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

  /*
   * MUTATION PROOF, run: `.seam` back to `stroke-width: 1.5`:
   * `expected '1.5' to be '2.5'`.
   */
  it('the seam is 2.5px, heavy enough to count straights by (26A)', () => {
    expect(lastDecl('.seam', 'stroke-width')).toBe('2.5');
  });

  it('the grid is --grid-line, the documented faint tone', () => {
    expect(lastDecl('.grid', 'stroke')).toBe('var(--grid-line)');
    expect(token('grid-line')).toBe('#d8cfbe');
    expect(lastDecl('.grid', 'vector-effect')).toBe('non-scaling-stroke');
  });
});

/*
 * PAINT IN 3D (paint plan docs/plan/2026-11-07-3d-colour.md: CEO R4, design
 * D6). Colour math by hand, as the stylesheet is text: WCAG 2 relative
 * luminance for ratios, CIEDE2000 for colour distance.
 */
const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number];
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)) as [number, number, number];
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
};
const rad = (d: number) => (d * Math.PI) / 180;
/** CIEDE2000 (Sharma, Wu and Dalal's formulation). */
const deltaE2000 = (h1: string, h2: string): number => {
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const [a1p, a2p] = [(1 + G) * a1, (1 + G) * a2];
  const [C1p, C2p] = [Math.hypot(a1p, b1), Math.hypot(a2p, b2)];
  const hue = (b: number, a: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const [hp1, hp2] = [hue(b1, a1p), hue(b2, a2p)];
  let dh = hp2 - hp1;
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  const hb = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hb - 275) / 25) ** 2))));
  const [x, y, z] = [(L2 - L1) / SL, (C2p - C1p) / SC, dH / SH];
  return Math.sqrt(x * x + y * y + z * z + RT * y * z);
};
/** Every paint a built-in piece wears, fill and line, as token names without `--`. */
const PAINTS = [
  ...new Map(
    BUILT_IN.flatMap((p) => (p.decorBody ?? []).flatMap((b) => (b.paint ? [b.paint] : []))).map((pt) => [`${pt.fill} ${pt.line}`, pt]),
  ).values(),
].map((pt) => ({ fill: pt.fill.slice(2), line: pt.line.slice(2) }));

describe('paint in 3D keeps clear of the verdict red and keeps its lines readable', () => {
  it('the built-in pieces wear eight paints: the Elevated station five, the metro pieces their grey, white and the dark of an opening', () => {
    expect([...new Set(PAINTS.map((pt) => pt.fill))].sort()).toEqual(['ink', 'paint-base', 'paint-grey', 'paint-metro', 'paint-red', 'paint-roof', 'paper', 'track-fill']);
  });

  /*
   * MUTATION PROOF, run: --paint-red back to the photos' #a0272c: `expected
   * 4.6 to be greater than or equal to 20` (and its ink line fails the next
   * spec: `expected 1.9 to be greater than or equal to 3`).
   */
  it('every paint, beech included, exists and is at least deltaE2000 20 from --fail', () => {
    const fail = token('fail')!;
    for (const { fill } of PAINTS) {
      const value = token(fill);
      expect(value, `--${fill}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.round(deltaE2000(value!, fail) * 10) / 10, `--${fill}`).toBeGreaterThanOrEqual(20);
    }
  });

  /*
   * MUTATION PROOF, run: the base's line back to --ink: `ink on paint-base:
   * expected 1 to be greater than or equal to 3`.
   */
  it('every paint names a line that reads at 3:1 or more on it (design D6)', () => {
    for (const { fill, line } of PAINTS) {
      expect(token(line), `--${line}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(Math.floor(ratio(token(fill)!, token(line)!) * 10) / 10, `${line} on ${fill}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('the measured values are the plan’s', () => {
    expect([token('paint-roof'), token('paint-red'), token('paint-base'), token('paint-grey')]).toEqual(['#638e70', '#e46560', '#33251d', '#9fa693']);
    expect(Math.round(deltaE2000('#e46560', token('fail')!) * 10) / 10).toBe(20.1);
    expect(Math.round(ratio('#638e70', token('floor')!) * 100) / 100).toBe(3);
  });
});
