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
 * IT DRAWS WHAT THE PLANNER'S CANVAS DRAWS, IN ITS ORDER (owner, 2026-11-22;
 * TrackCanvas.tsx `levelLayer`; DESIGN.md rule 11), so a bridge never looks
 * like a flat crossing and a station is not a bare straight:
 *
 *   shadows of raised wood ─▶ floor bodies ─▶ floor track ─▶ the bridge gap
 *     ─▶ roofs ─▶ raised bodies ─▶ raised track ─▶ seams ─▶ buffer beams
 *
 * Each piece is drawn in its own plank's width, and track is grouped by
 * profile so a layout of mixed widths is still a few paths.
 *
 * No React and no file access, so its callers' tests need no DOM and no disk.
 */

import { BUILT_IN, makeResolver } from '../../../engine/data/library.js';
import { placeAll } from '../../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../../engine/src/graph/model.js';
import type { Segment } from '../../../engine/src/geom/fk.js';
import { bodyCorners, drawnFlat, renderGraph } from '../../../engine/src/graph/render.js';
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
  /** The ground a standalone picture sits on, and the gap raised track cuts in floor track. */
  readonly floor: string;
  /** A buffer's beam. */
  readonly ink: string;
  /** The edge of wood that is not track, and a roof's hatch. */
  readonly inkSoft: string;
  /** Wood that is not track: a station's footprint, a pier. */
  readonly slab: string;
  /** What raised wood casts on the floor. */
  readonly shadow: string;
}

/** For a drawing inside a page that links the app's tokens. */
export const PAGE_COLOURS: Colours = {
  edge: 'var(--track-edge)',
  fill: 'var(--track-fill)',
  groove: 'var(--track-groove)',
  seam: 'var(--seam)',
  floor: 'var(--floor)',
  ink: 'var(--ink)',
  inkSoft: 'var(--ink-soft)',
  slab: 'var(--slab-side)',
  shadow: 'var(--track-shadow)',
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
  ink: tokenOf(css, 'ink'),
  inkSoft: tokenOf(css, 'ink-soft'),
  slab: tokenOf(css, 'slab-side'),
  shadow: tokenOf(css, 'track-shadow'),
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

/** The canvas's own figures (TrackCanvas.tsx), in millimetres of floor. */
const EDGE_MM = 1.2;
const BRIDGE_CASING_MM = 8;
const SHADOW_OFFSET_MM = 14;
const BUFFER_BEAM_MM = 6;

const levelOfSegment = (s: Segment) => s.level ?? 0;
const isRaised = (s: Segment) => levelOfSegment(s) >= 1;

/** A short, stable name for a drawing's mask and hatch, so several drawings can share one page. */
function idOf(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** The wood of some track, layer by layer across every piece (a groove never paints over a neighbour's edge), a few paths per plank profile. */
function wood(segments: readonly Segment[], colours: Colours): string {
  const profiles = new Map<string, { part: ReturnType<typeof resolve>; paths: string[] }>();
  for (const s of segments) {
    const part = resolve(s.partId);
    const key = `${part.plankWidthMm}/${part.gaugeWidthMm}/${part.grooveWidthMm ?? '-'}`;
    const held = profiles.get(key) ?? { part, paths: [] };
    held.paths.push(tenths(segmentPath(s)));
    profiles.set(key, held);
  }
  const stroke = (d: string, w: number, c: string) => `<path d="${d}" fill="none" style="stroke:${c}" stroke-width="${tenth(w)}"/>`;
  const all = [...profiles.values()].map(({ part, paths }) => ({ part, d: paths.join(' ') }));
  return [
    ...all.map(({ part, d }) => stroke(d, part.plankWidthMm, colours.edge)),
    ...all.map(({ part, d }) => stroke(d, part.plankWidthMm - 2 * EDGE_MM, colours.fill)),
    ...all.flatMap(({ part, d }) => (part.grooveWidthMm === undefined ? [] : [stroke(d, part.gaugeWidthMm + part.grooveWidthMm, colours.groove)])),
    ...all.flatMap(({ part, d }) => (part.grooveWidthMm === undefined ? [] : [stroke(d, part.gaugeWidthMm - part.grooveWidthMm, colours.fill)])),
  ].join('');
}

const boxPath = (b: Segment) => tenths(`M ${bodyCorners(b).map(([x, y]) => `${x} ${y}`).join(' L ')} Z`);

/** A raised piece's shadow: its plank moved the offset away; a ramp's runs from nothing at its low end. */
function shadowOf(s: Segment, colours: Colours): string {
  if (!isRaised(s) && !s.rise) return '';
  const half = resolve(s.partId).plankWidthMm / 2;
  if (s.rise) {
    const [nx, ny] = [-Math.sin(s.from.h) * half, Math.cos(s.from.h) * half];
    const [oFrom, oTo] = s.highAtStart ? [SHADOW_OFFSET_MM, 0] : [0, SHADOW_OFFSET_MM];
    const pts = [
      [s.from.x + nx + oFrom, s.from.y + ny - oFrom],
      [s.to.x + nx + oTo, s.to.y + ny - oTo],
      [s.to.x - nx + oTo, s.to.y - ny - oTo],
      [s.from.x - nx + oFrom, s.from.y - ny - oFrom],
    ];
    return `<path d="${tenths(`M ${pts.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`)}" style="fill:${colours.shadow}"/>`;
  }
  return `<path d="${tenths(segmentPath(s))}" fill="none" style="stroke:${colours.shadow}" stroke-width="${tenth(half * 2)}" transform="translate(${SHADOW_OFFSET_MM} ${-SHADOW_OFFSET_MM})"/>`;
}

/** The track seen from straight overhead. */
export function draw(graph: Graph, label: string, colours: Colours = PAGE_COLOURS, options: DrawingOptions = {}): Drawn {
  const render = renderOf(graph);
  const bodies = render.bodies.filter(drawnFlat);
  const corners = bodies.flatMap(bodyCorners);
  const xs = [...render.segments.flatMap((s) => [s.from.x, s.to.x]), ...corners.map((c) => c[0])];
  const ys = [...render.segments.flatMap((s) => [s.from.y, s.to.y]), ...corners.map((c) => c[1])];
  // A curve bulges past its ends, so the frame takes a plank and a half all round, of the widest plank.
  const widest = Math.max(...graph.pieces.map((p) => resolve(p.partId).plankWidthMm));
  const pad = options.padMm ?? widest * 1.5 + 40;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const floorTrack = render.segments.filter((s) => !isRaised(s));
  const raisedTrack = render.segments.filter(isRaised);
  const id = idOf(`${label}/${render.segments.length}/${tenth(x0)}/${tenth(y0)}`);
  const plankOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).plankWidthMm]));
  const seams = seamLines(graph.welds, render.ports, (pid) => plankOf.get(pid)!, new Set());
  const slab = (b: Segment) => `<path d="${boxPath(b)}" style="fill:${colours.slab};stroke:${colours.inkSoft}" stroke-width="1"/>`;
  const roofs = bodies.filter((b) => b.body === 'roof');
  const isUnder = (b: Segment) => b.body !== 'roof' && levelOfSegment(b) < 1;
  // The gap raised track cuts in the floor track it crosses, and only there: the mask is the floor track itself.
  const gap =
    raisedTrack.length === 0
      ? ''
      : `<mask id="g${id}">${floorTrack.map((s) => `<path d="${tenths(segmentPath(s))}" fill="none" stroke="white" stroke-width="${tenth(resolve(s.partId).plankWidthMm)}"/>`).join('')}</mask><g mask="url(#g${id})">${raisedTrack
          .map((s) => `<path d="${tenths(segmentPath(s))}" fill="none" style="stroke:${colours.floor}" stroke-width="${tenth(resolve(s.partId).plankWidthMm + BRIDGE_CASING_MM)}"/>`)
          .join('')}</g>`;
  // A roof is an ink hatch over the track it covers, so the road under it still reads.
  const hatch =
    roofs.length === 0
      ? ''
      : `<pattern id="h${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" style="stroke:${colours.inkSoft}" stroke-width="1"/></pattern>${roofs
          .map((b) => `<path d="${boxPath(b)}" fill="url(#h${id})" style="stroke:${colours.inkSoft}" stroke-width="1"/>`)
          .join('')}`;
  const lines = seams
    .map(
      (s) =>
        `<line x1="${tenth(s.from[0])}" y1="${tenth(s.from[1])}" x2="${tenth(s.to[0])}" y2="${tenth(s.to[1])}" style="stroke:${colours.seam}" stroke-width="2"/>`,
    )
    .join('');
  // A buffer's beam: a solid ink block across the plank at its far end, so a stop is not a short straight.
  const beams = render.segments
    .filter((s) => s.stop)
    .map((s) => {
      const half = resolve(s.partId).plankWidthMm / 2;
      const [cx, cy] = [s.to.x - (Math.cos(s.from.h) * BUFFER_BEAM_MM) / 2, s.to.y - (Math.sin(s.from.h) * BUFFER_BEAM_MM) / 2];
      const [nx, ny] = [-Math.sin(s.from.h) * half, Math.cos(s.from.h) * half];
      return `<line x1="${tenth(cx + nx)}" y1="${tenth(cy + ny)}" x2="${tenth(cx - nx)}" y2="${tenth(cy - ny)}" style="stroke:${colours.ink}" stroke-width="${BUFFER_BEAM_MM}"/>`;
    })
    .join('');
  const [w, h] = [x1 - x0, y1 - y0];
  const size = options.widthPx !== undefined ? ` width="${options.widthPx}" height="${Math.round((options.widthPx * h) / w)}"` : '';
  const ground = options.ground ? `<rect x="${tenth(x0)}" y="${tenth(y0)}" width="${tenth(w)}" height="${tenth(h)}" style="fill:${colours.floor}"/>` : '';
  const layers = [
    render.segments.map((s) => shadowOf(s, colours)).join(''),
    bodies.filter(isUnder).map(slab).join(''),
    wood(floorTrack, colours),
    gap,
    hatch,
    bodies.filter((b) => b.body !== 'roof' && !isUnder(b)).map(slab).join(''),
    wood(raisedTrack, colours),
    lines,
    beams,
  ].join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tenth(x0)} ${tenth(y0)} ${tenth(w)} ${tenth(h)}"${size} role="img" aria-label="${esc(label)}: the track seen from straight overhead">${ground}<g transform="translate(0 ${tenth(y0 + y1)}) scale(1 -1)">${layers}</g></svg>`;
  return { svg, widthMm: w, heightMm: h };
}

/** The track as an inline drawing, in the app's own colours (the tokens the page links). */
export const drawing = (graph: Graph, label: string): string => draw(graph, label).svg;
