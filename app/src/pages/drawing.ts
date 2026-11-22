/**
 * A LAYOUT DRAWN FOR THE STATIC SITE: the track seen from overhead, as SVG.
 * One function, so a list, a picture file and a link preview all show the
 * same track (owner, 2026-11-22).
 *
 *   graph ──▶ drawing(graph, label, colours, options) ──▶ <svg>
 *                │
 *                ├─ PAGE_COLOURS (CSS variables): inline in a page that links the tokens
 *                └─ coloursOf(tokens.css as text): a file that stands alone
 *
 * Every number is written to one decimal place (a tenth of a millimetre):
 * the solver's fifteen digits made each drawing about 10 kB, and a list of
 * forty would not load well.
 *
 * No React and no file access, so its callers' tests need no DOM and no disk.
 */

import { BUILT_IN, makeResolver } from '../../../engine/data/library.js';
import { placeAll } from '../../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../../engine/src/graph/model.js';
import { renderGraph } from '../../../engine/src/graph/render.js';
import { seamLines, segmentPath } from '../trackPath.js';
import { esc } from './shell.js';

export const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** The colours a drawing is made of, as CSS values. */
export interface Colours {
  readonly edge: string;
  readonly fill: string;
  readonly groove: string;
  readonly seam: string;
  /** The ground a standalone picture sits on. */
  readonly floor: string;
}

/** For a drawing inside a page that links the app's tokens. */
export const PAGE_COLOURS: Colours = {
  edge: 'var(--track-edge)',
  fill: 'var(--track-fill)',
  groove: 'var(--track-groove)',
  seam: 'var(--seam)',
  floor: 'var(--floor)',
};

/** One token's value out of the stylesheet's text. Throws when it is not there, so a renamed token stops the build. */
export function tokenOf(css: string, name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(css);
  if (!m) throw new Error(`no --${name} in tokens.css`);
  return m[1]!;
}

/** The same colours as values, read from the stylesheet's text, for a file that must stand alone. */
export const coloursOf = (css: string): Colours => ({
  edge: tokenOf(css, 'track-edge'),
  fill: tokenOf(css, 'track-fill'),
  groove: tokenOf(css, 'track-groove'),
  seam: tokenOf(css, 'seam'),
  floor: tokenOf(css, 'floor'),
});

/** The layout placed and rendered: its roads, ends and bodies. */
export const renderOf = (graph: Graph) => renderGraph(graph, ports, resolve, placeAll(graph, ports));

/** A number to a tenth of a millimetre, with no trailing zero and no "-0". */
const tenth = (n: number): string => String(Math.round(n * 10) / 10 || 0);
/** Every number in a path or an attribute, to a tenth. */
const tenths = (text: string): string => text.replace(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi, (n) => tenth(Number(n)));

export interface DrawingOptions {
  /** Clear ground round the track, in millimetres. Default: a plank and a half plus 40. */
  readonly padMm?: number;
  /** Paint the floor behind the track, for a picture that stands alone. */
  readonly ground?: boolean;
  /** A fixed width in pixels (the height follows), for a picture placed in a layout of its own. */
  readonly widthPx?: number;
}

export interface Drawn {
  readonly svg: string;
  /** The picture's shape, in millimetres of floor: what an `<img>` needs to hold its place. */
  readonly widthMm: number;
  readonly heightMm: number;
}

/** The track seen from straight overhead. */
export function draw(graph: Graph, label: string, colours: Colours = PAGE_COLOURS, options: DrawingOptions = {}): Drawn {
  const render = renderOf(graph);
  const part = resolve(graph.pieces[0]!.partId);
  const xs = render.segments.flatMap((s) => [s.from.x, s.to.x]);
  const ys = render.segments.flatMap((s) => [s.from.y, s.to.y]);
  // A curve bulges past its ends, so the frame takes a plank and a half all round.
  const pad = options.padMm ?? part.plankWidthMm * 1.5 + 40;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const edge = 1.2;
  const layers: { w: number; c: string }[] = [
    { w: part.plankWidthMm, c: colours.edge },
    { w: part.plankWidthMm - 2 * edge, c: colours.fill },
    ...(part.grooveWidthMm !== undefined
      ? [
          { w: part.gaugeWidthMm + part.grooveWidthMm, c: colours.groove },
          { w: part.gaugeWidthMm - part.grooveWidthMm, c: colours.fill },
        ]
      : []),
  ];
  const plankOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).plankWidthMm]));
  const seams = seamLines(graph.welds, render.ports, (id) => plankOf.get(id)!, new Set());
  const paths = render.segments.map((s) => tenths(segmentPath(s)));
  // One path per layer, every road in it: the same picture as a path per road, at a fraction of the text.
  const road = paths.join(' ');
  const strokes = layers.map((l) => `<path d="${road}" fill="none" style="stroke:${l.c}" stroke-width="${tenth(l.w)}"/>`).join('');
  const lines = seams
    .map(
      (s) =>
        `<line x1="${tenth(s.from[0])}" y1="${tenth(s.from[1])}" x2="${tenth(s.to[0])}" y2="${tenth(s.to[1])}" style="stroke:${colours.seam}" stroke-width="2"/>`,
    )
    .join('');
  const [w, h] = [x1 - x0, y1 - y0];
  const size = options.widthPx !== undefined ? ` width="${options.widthPx}" height="${Math.round((options.widthPx * h) / w)}"` : '';
  const ground = options.ground ? `<rect x="${tenth(x0)}" y="${tenth(y0)}" width="${tenth(w)}" height="${tenth(h)}" style="fill:${colours.floor}"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tenth(x0)} ${tenth(y0)} ${tenth(w)} ${tenth(h)}"${size} role="img" aria-label="${esc(label)}: the track seen from straight overhead">${ground}<g transform="translate(0 ${tenth(y0 + y1)}) scale(1 -1)">${strokes}${lines}</g></svg>`;
  return { svg, widthMm: w, heightMm: h };
}

/** The track as an inline drawing, in the app's own colours (the tokens the page links). */
export const drawing = (graph: Graph, label: string): string => draw(graph, label).svg;
