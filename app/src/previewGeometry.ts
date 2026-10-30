/**
 * THE SMALL DRAWING ON A PART'S CARD (docs/plan/2026-10-30-part-previews.md).
 *
 * A schematic, not a footprint (eng D3): the part's shape fitted to the card's
 * box, every plank drawn at one track width, and each end marked peg or
 * socket the way the canvas marks a free end (8A, DESIGN.md rule 11). The
 * size label on the card carries the length (6A, rule 4).
 *
 * THE POSE IS THE FIRST PLACEMENT (5A): the part at the identity frame, turned
 * left, which is exactly where a double-click on an empty floor puts it, with
 * the canvas's own up and down (it draws `scale(1, -1)`).
 *
 * Laid out here in PIXELS of the box, so the end marks, the beam and the
 * chevron keep their sizes whatever the part's scale. The roads themselves
 * are drawn in millimetres under one transform, with non-scaling strokes, so
 * they reuse the canvas's own path builder (`segmentPath`) unchanged.
 */

import { BUILT_IN } from '../../engine/data/library.js';
import type { Segment } from '../../engine/src/geom/fk.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import type { Part, Polarity } from '../../engine/src/parts/schema.js';
import { segmentPath } from './trackPath.js';

/** The drawing box, in CSS pixels (2A). Coarse pointers scale it up in CSS. */
export const PREVIEW_W = 32;
export const PREVIEW_H = 20;

/**
 * Room kept clear inside the box's edge: half the 9px outline stroke, or the
 * 7px socket ring's radius plus its stroke, whichever is larger. Bounds that
 * leave this out clip the drawing (eng review, Codex OV1).
 */
const PAD = 4.5;

export interface Preview {
  /** Maps millimetres (y up) into the box (y down). */
  readonly transform: string;
  /** Each road, in millimetres: `segmentPath` of every segment. */
  readonly roads: readonly string[];
  /** Each end, in box pixels. */
  readonly ends: ReadonlyArray<{ readonly x: number; readonly y: number; readonly polarity: Polarity }>;
  /** A buffer stop's beam: the far end of its body, and the body's angle in degrees, in box pixels. */
  readonly beam?: { readonly x: number; readonly y: number; readonly deg: number };
  /** A ramp's chevron: the middle of the ramp, pointing up the slope, in box pixels. */
  readonly chevron?: { readonly x: number; readonly y: number; readonly deg: number };
}

/** Points along a segment's centreline, enough to bound its arcs. */
function sample(s: Segment): Array<readonly [number, number]> {
  if (s.kind === 'straight') return [[s.from.x, s.from.y], [s.to.x, s.to.y]];
  const r = s.centrelineRadiusMm ?? 0;
  const sign = s.sweep === 'right' ? -1 : 1;
  // The centre sits on the side the arc bends towards.
  const cx = s.from.x - Math.sin(s.from.h) * r * sign;
  const cy = s.from.y + Math.cos(s.from.h) * r * sign;
  let turn = s.to.h - s.from.h;
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn <= -Math.PI) turn += 2 * Math.PI;
  const a0 = Math.atan2(s.from.y - cy, s.from.x - cx);
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i <= 16; i++) {
    const a = a0 + (turn * i) / 16;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/**
 * The preview of one part. Throws if the part cannot be placed or drawn; the
 * caller (`previews`) turns that into an empty box (4A).
 */
export function previewOf(part: Part): Preview {
  const resolve = (id: string): Part => {
    if (id !== part.id) throw new Error(`preview of ${part.id} asked for ${id}`);
    return part;
  };
  const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
  const graph: Graph = { pieces: [{ pieceId: 'p', partId: part.id, turn: 'left' }], welds: [] };
  const drawn = renderGraph(graph, ports, resolve, placeAll(graph, ports));

  const pts = [...drawn.segments.flatMap(sample), ...drawn.ports.map((p) => [p.x, p.y] as const)];
  if (pts.length === 0) throw new Error(`${part.id} draws nothing`);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const k = Math.min(
    spanX > 0 ? (PREVIEW_W - 2 * PAD) / spanX : Infinity,
    spanY > 0 ? (PREVIEW_H - 2 * PAD) / spanY : Infinity,
  );
  if (!Number.isFinite(k)) throw new Error(`${part.id} has no extent`);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // y flips: the canvas reads as a floor seen from above, y up.
  const px = (x: number, y: number) => ({ x: PREVIEW_W / 2 + (x - cx) * k, y: PREVIEW_H / 2 - (y - cy) * k });
  const deg = (s: Segment, reverse = false) =>
    (Math.atan2(-(s.to.y - s.from.y), s.to.x - s.from.x) * 180) / Math.PI + (reverse ? 180 : 0);

  const stop = drawn.segments.find((s) => s.stop);
  const ramp = drawn.segments.find((s) => s.rise);
  return {
    transform: `translate(${PREVIEW_W / 2 - cx * k}, ${PREVIEW_H / 2 + cy * k}) scale(${k}, ${-k})`,
    roads: drawn.segments.map(segmentPath),
    ends: drawn.ports.map((p) => ({ ...px(p.x, p.y), polarity: p.polarity })),
    ...(stop ? { beam: { ...px(stop.to.x, stop.to.y), deg: deg(stop) } } : {}),
    ...(ramp
      ? {
          chevron: {
            ...px((ramp.from.x + ramp.to.x) / 2, (ramp.from.y + ramp.to.y) / 2),
            deg: deg(ramp, ramp.highAtStart === true),
          },
        }
      : {}),
  };
}

/**
 * Every part's preview, worked out once per resolved LIBRARY, never cached by
 * id (eng D1): a correction keeps a part's id and changes its shape, and the
 * library object changes exactly when that happens. A part that cannot be
 * drawn maps to null, an empty box, and never takes the list down (4A).
 */
export function previews(library: readonly Part[] = BUILT_IN): ReadonlyMap<string, Preview | null> {
  const out = new Map<string, Preview | null>();
  for (const part of library) {
    try {
      out.set(part.id, previewOf(part));
    } catch {
      out.set(part.id, null);
    }
  }
  return out;
}
