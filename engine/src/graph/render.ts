/**
 * The float render walk: the third consumer of T4's forest.
 *
 * It does not walk anything. `placeAll` has already fixed every piece's exact
 * frame, so this projects those frames to millimetres and reads the drawable
 * shapes off them. That is the point of having one traversal: the renderer
 * cannot disagree with the solver about where a piece is, because it does not
 * work it out a second time.
 *
 * The old `walkFloat` re-derived the whole chain in floats from the origin,
 * which was fine for a list and impossible for a graph: there is no single
 * order to re-walk, and a layout in several pieces has several origins.
 *
 * A piece yields one segment per ROAD, not one per piece. A switch draws two
 * and a crossing two, all from the same frame, which is how its roads stay
 * rigidly related on screen for the same reason they do in the arithmetic.
 */

import { add, scale, toXY, zetaPow } from '../geom/cyclotomic.js';
import type { FPose, Segment } from '../geom/fk.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import { levelOf, norm16, portPolarity, roadsOf, type Frame, type Graph } from './model.js';
import { centrelineRadiusMm, type Hump, type Part, type Polarity } from '../parts/schema.js';

/** Zeta steps to radians: one step is 22.5 degrees. */
const RAD = Math.PI / 8;

function pose(frame: Frame): FPose {
  const [x, y] = toXY(frame.pos);
  return { x, y, h: frame.heading * RAD };
}

/** A connectable end, projected for hit-testing and drawing. */
export interface RenderedPort {
  readonly pieceId: string;
  readonly port: number;
  readonly x: number;
  readonly y: number;
  /** Outward heading in radians: the direction track would continue. */
  readonly h: number;
  /** True when no weld claims it, so a piece can be attached here. */
  readonly free: boolean;
  /**
   * Which half of a joint this end is.
   *
   * Carried so the canvas can draw what the polarity check already knows;
   * the history is in the DONE entry in `docs/plan/generic-TODOS.md`. Derived
   * with `portPolarity`, the same function the check calls. A switch's heel
   * is a peg or a socket like any end (see `PortKind`); this was `null` for
   * a heel until 2026-10-22, matching an exemption the check no longer makes.
   */
  readonly polarity: Polarity;
  /** Its level, absent on the floor (two-layer plan, SC1). The canvas draws raised ends last (OV4). */
  readonly level?: number;
}

export interface GraphRender {
  /** Track: every road of every piece, and a buffer's body. */
  readonly segments: readonly Segment[];
  readonly ports: readonly RenderedPort[];
  /**
   * Wood that is not track: footprints, walls, roofs (plan 2026-11-02, eng
   * E4). A separate list on purpose: a reader that means "track" never sees a
   * body, and a reader that means "all wood" (collisions, drawing, table fit)
   * reads both.
   */
  readonly bodies: readonly Segment[];
}

export function renderGraph(
  graph: Graph,
  ports: PortsOf,
  resolve: (id: string) => Part,
  placement: Placement,
): GraphRender {
  const claimed = new Set<string>();
  for (const w of graph.welds) {
    claimed.add(`${w.a.pieceId}#${w.a.port}`);
    claimed.add(`${w.b.pieceId}#${w.b.port}`);
  }

  const segments: Segment[] = [];
  const rendered: RenderedPort[] = [];
  const bodies: Segment[] = [];

  for (const piece of graph.pieces) {
    const frame = placement.frames.get(piece.pieceId);
    if (!frame) continue;
    const part = resolve(piece.partId);
    // Written only off the floor (SC1), so a flat layout renders as before.
    // A raised deck's roads sit `deck` levels above the frame (its footprint).
    const level = levelOf(frame) + (part.kind === 'straight' ? (part.deck ?? 0) : 0);
    const rise = part.kind === 'straight' ? (part.rise ?? 0) : 0;
    const highAtStart = rise !== 0 && levelOf(ports(piece)[0]!.at) > 0;
    const levels = {
      ...(level !== 0 ? { level } : {}),
      ...(rise !== 0 ? { rise } : {}),
      ...(highAtStart ? { highAtStart: true as const } : {}),
    };
    const portList = ports(piece);
    const count = portList.length;
    for (let i = 0; i < count; i++) {
      const world = portFrame(placement, ports, piece, i);
      const p = pose(world);
      rendered.push({
        pieceId: piece.pieceId,
        port: i,
        x: p.x,
        y: p.y,
        h: p.h,
        free: !claimed.has(`${piece.pieceId}#${i}`),
        polarity: portPolarity(part, i),
        ...(levelOf(world) !== 0 ? { level: levelOf(world) } : {}),
      });
    }

    /*
     * One segment per ROAD, drawn from the end it starts at to the end it
     * finishes at (eng review D5). This used to draw port 0 to port i and
     * bend every arc the way the piece was turned, which held while every
     * road started at a switch's heel; a crossing's second road starts at its
     * third end, and an I/J switch bends one arc each way.
     *
     * A road's start end faces OUT of the piece, so the segment starts there
     * facing the other way: on a road from port 0 that is the piece's own
     * frame, exactly as before.
     */
    /*
     * A BUFFER STOP has no road, but it is wood on the table: its body runs
     * back from its one end, drawn and overlap-checked as a straight of its
     * length. The far point is not an end, so nothing can join there.
     */
    if (part.kind === 'buffer') {
      const end = portFrame(placement, ports, piece, 0);
      const along = norm16(end.heading + 8);
      segments.push({
        kind: 'straight',
        from: pose({ pos: end.pos, heading: along }),
        to: pose({ pos: add(end.pos, scale(zetaPow(along), part.lengthMm)), heading: along }),
        partId: piece.partId,
        pieceId: piece.pieceId,
        stop: true,
        ...levels,
      });
    }
    /*
     * THE BODY (plan 2026-11-02, structures): each box drawn as a straight
     * through its middle, half its width either side, at its own levels above
     * the frame. Mirrored with the piece, like its ends.
     */
    /*
     * The decoration's boxes (eng D4) go in the same list: drawn and checked
     * like any wood, at the levels derived from their heights, mirrored with
     * the piece. Each carries its heights, so 3D draws the shape as measured.
     */
    const decorBoxes = (part.decorBody ?? []).map((box) => ({ box, decor: true as const }));
    for (const { box, decor } of [...(part.body ?? []).map((box) => ({ box, decor: false as const })), ...decorBoxes]) {
      const mirror = piece.turn === 'right' ? -1 : 1;
      const h = frame.heading * RAD;
      const c = Math.cos(h), sn = Math.sin(h);
      const [fx, fy] = toXY(frame.pos);
      const at = (lx: number, ly: number) => ({ x: fx + lx * c - ly * mirror * sn, y: fy + lx * sn + ly * mirror * c, h });
      const lo = levelOf(frame) + box.levels[0];
      const boxRise = box.levels[1] - box.levels[0];
      bodies.push({
        kind: 'straight',
        from: at(box.atMm[0] - box.lengthMm / 2, box.atMm[1]),
        to: at(box.atMm[0] + box.lengthMm / 2, box.atMm[1]),
        partId: piece.partId,
        pieceId: piece.pieceId,
        body: box.role,
        halfWidthMm: box.widthMm / 2,
        ...(box.profileMm ? { profileMm: box.profileMm } : {}),
        ...(decor && 'bottomMm' in box
          ? { decor: { floorLevel: levelOf(frame), bottomMm: box.bottomMm, topMm: box.topMm, solid: box.solid, ...(box.noun ? { noun: box.noun } : {}) } }
          : {}),
        ...(lo !== 0 ? { level: lo } : {}),
        ...(boxRise !== 0 ? { rise: boxRise } : {}),
      });
    }
    for (const road of roadsOf(part, piece.turn)) {
      const start = portFrame(placement, ports, piece, road.from);
      const from = pose({ pos: start.pos, heading: norm16(start.heading + 8) });
      const to = pose(portFrame(placement, ports, piece, road.to));
      if (road.shape.kind === 'straight' && part.kind === 'straight' && part.hump) {
        segments.push(...humpRoad(from, to, part.lengthMm, part.hump, level, piece.partId, piece.pieceId));
        continue;
      }
      if (road.shape.kind === 'straight') {
        segments.push({ kind: 'straight', from, to, partId: piece.partId, pieceId: piece.pieceId, ...levels });
        continue;
      }
      if (road.shape.kind === 's-bend') {
        segments.push(...sBend(from, to, road.shape.lengthMm, road.shape.offsetMm).map((s) => ({
          ...s,
          partId: piece.partId,
          pieceId: piece.pieceId,
          ...levels,
        })));
        continue;
      }
      // A lead-in is its own straight segment, then the arc from where it ends.
      let arcFrom = from;
      const lead = road.shape.leadMm ?? 0;
      if (lead > 0) {
        arcFrom = { x: from.x + Math.cos(from.h) * lead, y: from.y + Math.sin(from.h) * lead, h: from.h };
        segments.push({ kind: 'straight', from, to: arcFrom, partId: piece.partId, pieceId: piece.pieceId, ...levels });
      }
      segments.push({
        kind: 'curve',
        from: arcFrom,
        to,
        centrelineRadiusMm: centrelineRadiusMm({
          innerRadiusMm: road.shape.innerRadiusMm,
          plankWidthMm: part.plankWidthMm,
        }),
        sweep: road.shape.side,
        partId: piece.partId,
        pieceId: piece.pieceId,
        ...levels,
      });
    }
  }

  return { segments, ports: rendered, bodies };
}

/**
 * AN UP-AND-OVER ROAD (bridges plan, eng D1): up one level, along the top,
 * down again, as three straight segments between the road's two ends. The
 * down slope is flagged high at its start, as a ramp entered from its high
 * end is. Each carries the measured profile and its span along the road, for
 * the 3D view (eng D9).
 */
function humpRoad(from: FPose, to: FPose, lengthMm: number, hump: Hump, level: number, partId: string, pieceId: string): Segment[] {
  const at = (mm: number): FPose => {
    const t = mm / lengthMm;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, h: from.h };
  };
  const a = hump.upMm, b = hump.upMm + hump.topMm;
  const base = level !== 0 ? { level } : {};
  const shared = { kind: 'straight' as const, partId, pieceId, profileMm: hump.profileMm };
  return [
    { ...shared, from, to: at(a), ...base, rise: 1, alongMm: [0, a] },
    { ...shared, from: at(a), to: at(b), level: level + 1, alongMm: [a, b] },
    { ...shared, from: at(b), to, ...base, rise: 1, highAtStart: true, alongMm: [b, lengthMm] },
  ];
}

/**
 * An S-bend drawn as two equal arcs, out and back (schema.ts `RoadShape`).
 *
 * Two arcs of angle t and radius R cover 2R sin t along and 2R(1 - cos t)
 * across, so tan(t/2) = across / along fixes t, and R follows. The first arc
 * bends towards the offset, the second back. FLOATS, and only for drawing
 * and the overlap footprint: the road's two ends are the exact lattice
 * frames `from` and `to`, which no verdict reads from here.
 */
function sBend(
  from: FPose,
  to: FPose,
  lengthMm: number,
  offsetMm: number,
): Array<Pick<Segment, 'kind' | 'from' | 'to' | 'centrelineRadiusMm' | 'sweep'>> {
  const t = 2 * Math.atan(Math.abs(offsetMm) / lengthMm);
  const r = lengthMm / (2 * Math.sin(t));
  const out: 'left' | 'right' = offsetMm > 0 ? 'left' : 'right';
  const back: 'left' | 'right' = out === 'left' ? 'right' : 'left';
  const mid: FPose = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    h: from.h + (out === 'left' ? t : -t),
  };
  return [
    { kind: 'curve', from, to: mid, centrelineRadiusMm: r, sweep: out },
    { kind: 'curve', from: mid, to, centrelineRadiusMm: r, sweep: back },
  ];
}

/**
 * A body box's four corners, in millimetres: its centreline (a straight from
 * one end of the box to the other) widened `halfWidthMm` either side, in
 * order round the box.
 */
export function bodyCorners(s: Segment): Array<readonly [number, number]> {
  const w = s.halfWidthMm ?? 0;
  const nx = -Math.sin(s.from.h) * w;
  const ny = Math.cos(s.from.h) * w;
  return [
    [s.from.x + nx, s.from.y + ny],
    [s.to.x + nx, s.to.y + ny],
    [s.to.x - nx, s.to.y - ny],
    [s.from.x - nx, s.from.y - ny],
  ];
}

/** Bounds over rendered ports, which is every extremity a layout has, and every body's corners. */
export function renderBounds(r: GraphRender): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const consider = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const p of r.ports) consider(p.x, p.y);
  // A curve bulges past its endpoints; including both ends of every segment
  // is not enough on its own, but with ports covering all ends the error is
  // at most the sagitta, which the canvas padding already absorbs.
  for (const s of r.segments) {
    consider(s.from.x, s.from.y);
    consider(s.to.x, s.to.y);
  }
  // A pier has no ends at all: its body is its only extent.
  for (const b of r.bodies) for (const [x, y] of bodyCorners(b)) consider(x, y);
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
