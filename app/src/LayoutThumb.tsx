/**
 * A WHOLE LAYOUT, SMALL, IN INK (share plan, design 11A, eng D72): for the
 * question "replace the layout you put aside?", so the friend sees which
 * layouts are at stake, not only how many pieces they have.
 *
 * The canvas in miniature the way a part card is (DESIGN.md rule 11): one
 * schematic track width in the text colour, no wood, no colour (rule 1).
 * Drawn from the RAW stored bytes. Bytes that do not read as a layout this
 * engine could have written draw nothing; the caller says so in words.
 */

import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { bodyCorners, renderGraph } from '../../engine/src/graph/render.js';
import { checkStored } from './layoutStore.js';
import { segmentPath } from './trackPath.js';

const SIZE = 48;
const catalogue = makeResolver(BUILT_IN);
const ids = new Set(BUILT_IN.map((p) => p.id));
const ports = (p: Piece) => portsOf(catalogue(p.partId), p.turn);

/** The drawing's paths and box, or null when the bytes are not a readable built-in layout. */
export function thumbOf(bytes: string): { paths: string[]; bodies: string[]; box: [number, number, number, number] } | null {
  try {
    const checked = checkStored(JSON.parse(bytes), ids, ports);
    if (!checked.ok || checked.pieces.length === 0) return null;
    const graph = { pieces: checked.pieces, welds: checked.welds, anchors: checked.anchors };
    const { segments, bodies } = renderGraph(graph, ports, catalogue, placeAll(graph, ports));
    // A body (a station, a pier) as its outline: a pier has no track at all.
    const outlines = bodies.map(bodyCorners);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of segments) {
      for (const p of [s.from, s.to]) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
    }
    for (const [x, y] of outlines.flat()) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const pad = 60;
    const side = Math.max(x1 - x0, y1 - y0) + 2 * pad;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return {
      paths: segments.map(segmentPath),
      bodies: outlines.map((c) => `M ${c.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`),
      box: [cx - side / 2, cy - side / 2, side, side] };
  } catch {
    return null;
  }
}

export function LayoutThumb({ bytes }: { readonly bytes: string }) {
  const thumb = thumbOf(bytes);
  if (!thumb) return null;
  const [x, y, w, h] = thumb.box;
  return (
    <svg className="layout-thumb" width={SIZE} height={SIZE} viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" focusable="false">
      {/* Flipped like the canvas, so the drawing is the same way up. */}
      <g transform={`translate(0 ${2 * y + h}) scale(1 -1)`}>
        {thumb.paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={w / 14} strokeLinecap="butt" />
        ))}
        {thumb.bodies.map((d, i) => (
          <path key={`b${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={w / 48} />
        ))}
      </g>
    </svg>
  );
}
