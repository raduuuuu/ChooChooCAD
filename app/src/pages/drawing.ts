/**
 * A LAYOUT DRAWN FOR A STATIC PAGE: the track seen from overhead, as inline
 * SVG in the app's own colours (the tokens the page links). One function, so
 * a page, a list and, later, a picture file all show the same track (owner,
 * 2026-11-22).
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

/** The track as an inline drawing, in the app's own colours (the tokens the page links). */
export function drawing(graph: Graph, label: string): string {
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  const part = resolve(graph.pieces[0]!.partId);
  const xs = render.segments.flatMap((s) => [s.from.x, s.to.x]);
  const ys = render.segments.flatMap((s) => [s.from.y, s.to.y]);
  // A curve bulges past its ends, so the frame takes a plank and a half all round.
  const pad = part.plankWidthMm * 1.5 + 40;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const edge = 1.2;
  const layers: { w: number; c: string }[] = [
    { w: part.plankWidthMm, c: '--track-edge' },
    { w: part.plankWidthMm - 2 * edge, c: '--track-fill' },
    ...(part.grooveWidthMm !== undefined
      ? [
          { w: part.gaugeWidthMm + part.grooveWidthMm, c: '--track-groove' },
          { w: part.gaugeWidthMm - part.grooveWidthMm, c: '--track-fill' },
        ]
      : []),
  ];
  const plankOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).plankWidthMm]));
  const seams = seamLines(graph.welds, render.ports, (id) => plankOf.get(id)!, new Set());
  const paths = render.segments.map(segmentPath);
  const strokes = layers
    .map((l) => paths.map((d) => `<path d="${d}" fill="none" style="stroke:var(${l.c})" stroke-width="${l.w}"/>`).join(''))
    .join('');
  const lines = seams
    .map((s) => `<line x1="${s.from[0]}" y1="${s.from[1]}" x2="${s.to[0]}" y2="${s.to[1]}" style="stroke:var(--seam)" stroke-width="2"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${esc(label)}: the track seen from straight overhead"><g transform="translate(0 ${y0 + y1}) scale(1 -1)">${strokes}${lines}</g></svg>`;
}
