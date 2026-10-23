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
 * A piece yields one segment per ROAD, not one per piece. A switch draws two,
 * both from the same frame, which is how its roads stay rigidly related on
 * screen for the same reason they do in the arithmetic.
 */

import { toXY } from '../geom/cyclotomic.js';
import type { FPose, Segment } from '../geom/fk.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import { levelOf, portPolarity, type Frame, type Graph } from './model.js';
import { centrelineRadiusMm, type Part, type Polarity } from '../parts/schema.js';

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
   * the history is in the DONE entry in `docs/plan/brio-TODOS.md`. Derived
   * with `portPolarity`, the same function the check calls. A switch's heel
   * is a peg or a socket like any end (see `PortKind`); this was `null` for
   * a heel until 2026-10-22, matching an exemption the check no longer makes.
   */
  readonly polarity: Polarity;
  /** Its level, absent on the floor (two-layer plan, SC1). The canvas draws raised ends last (OV4). */
  readonly level?: number;
}

export interface GraphRender {
  readonly segments: readonly Segment[];
  readonly ports: readonly RenderedPort[];
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

  for (const piece of graph.pieces) {
    const frame = placement.frames.get(piece.pieceId);
    if (!frame) continue;
    const part = resolve(piece.partId);
    const from = pose(frame);
    // Written only off the floor (SC1), so a flat layout renders as before.
    const level = levelOf(frame);
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

    // Port 0 is the entry; every other port is the far end of one road.
    for (let i = 1; i < count; i++) {
      const to = pose(portFrame(placement, ports, piece, i));
      const isCurve =
        part.kind === 'curve' || (part.kind === 'switch' && i === 2);
      if (!isCurve) {
        segments.push({ kind: 'straight', from, to, partId: piece.partId, pieceId: piece.pieceId, ...levels });
        continue;
      }
      segments.push({
        kind: 'curve',
        from,
        to,
        centrelineRadiusMm: centrelineRadiusMm(
          part as Extract<Part, { kind: 'curve' | 'switch' }>,
        ),
        sweep: piece.turn === 'right' ? 'right' : 'left',
        partId: piece.partId,
        pieceId: piece.pieceId,
        ...levels,
      });
    }
  }

  return { segments, ports: rendered };
}

/** Bounds over rendered ports, which is every extremity a layout has. */
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
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
