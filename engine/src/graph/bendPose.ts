/**
 * THE TRACK AS IT SITS ON THE FLOOR (joint bend, drawn).
 *
 * The placement is exact: every piece at its catalogue angle, so a loop that
 * closes by bending its joints is drawn with its gap still open, under a
 * verdict that says it closes. That is the picture contradicting the words,
 * and the owner caught it on the Q1 loop ("the loop you had me test still
 * doesn't seem to close", 2026-10-30).
 *
 * This reads the bend solution back as a picture. Each piece of a run that
 * closes with bend gets a rigid SHIFT, found by walking the run's spanning
 * tree out from its root (which stays where it was placed): across each
 * joint, the walker leaves one piece's end, pulls apart by the joint's
 * stretch, turns by its turn, and the next piece is set so its end meets
 * there. The closing joints are not walked; the solution is what makes them
 * meet, to within the stretch and the half-millimetre the solve settles to.
 *
 * FLOATS, FOR DRAWING ONLY. Nothing here feeds a verdict: the verdict was
 * already reached on the exact frames, and the overlap check stays on them
 * (the verdict's note says so, with how far bending moves a piece).
 */

import { toXY } from '../geom/cyclotomic.js';
import type { FPose, Segment } from '../geom/fk.js';
import type { Move } from './bend.js';
import type { RunBend } from './bendRun.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import type { Frame, Graph } from './model.js';
import type { GraphRender } from './render.js';

const STEP_RAD = Math.PI / 8;

function compose(a: Move, b: Move): Move {
  const c = Math.cos(a[2]);
  const s = Math.sin(a[2]);
  return [a[0] + c * b[0] - s * b[1], a[1] + s * b[0] + c * b[1], a[2] + b[2]];
}

function inverse(a: Move): Move {
  const c = Math.cos(a[2]);
  const s = Math.sin(a[2]);
  return [-c * a[0] - s * a[1], s * a[0] - c * a[1], -a[2]];
}

/** A port's world frame as a travel frame: facing out of the piece, or into it. */
function travel(f: Frame, into: boolean): Move {
  const [x, y] = toXY(f.pos);
  return [x, y, (f.heading + (into ? 8 : 0)) * STEP_RAD];
}

/**
 * Each piece's shift from its drawn, exact pose to its bent one, for every
 * run whose verdict is that it closes with bend. Pieces not in the map stay
 * where the placement put them.
 */
export function bentShifts(
  graph: Graph,
  placement: Placement,
  ports: PortsOf,
  runs: readonly RunBend[],
): ReadonlyMap<string, Move> {
  const shifts = new Map<string, Move>();
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const forest = placement.forest;
  for (const run of runs) {
    if (run.status !== 'closes' || !run.jointBend) continue;
    const inRun = new Set(run.pieces);
    // `order` visits a parent before its children, so each shift is built on one already known.
    for (const id of forest.order) {
      if (!inRun.has(id)) continue;
      const link = forest.parent.get(id);
      if (!link) {
        shifts.set(id, [0, 0, 0]);
        continue;
      }
      const from = shifts.get(link.from);
      if (!from) continue;
      const w = graph.welds[link.weld]!;
      const leavesA = w.a.pieceId === link.from;
      const out = leavesA ? w.a : w.b;
      const into = leavesA ? w.b : w.a;
      const j = run.jointBend.get(link.weld);
      // A turn reads backwards when the joint is crossed against its own direction; a stretch does not.
      const joint: Move = j ? [j.stretch, 0, (leavesA ? 1 : -1) * j.turn] : [0, 0, 0];
      const left = compose(from, travel(portFrame(placement, ports, byId.get(out.pieceId)!, out.port), false));
      const arrive = compose(left, joint);
      const exactIn = travel(portFrame(placement, ports, byId.get(into.pieceId)!, into.port), true);
      shifts.set(id, compose(arrive, inverse(exactIn)));
    }
  }
  return shifts;
}

function shiftPose(d: Move, p: FPose): FPose {
  const [x, y, h] = compose(d, [p.x, p.y, p.h]);
  return { x, y, h };
}

/** The render with each shifted piece's wood and ends moved rigidly by its shift. */
export function bendRender(render: GraphRender, shifts: ReadonlyMap<string, Move>): GraphRender {
  if (shifts.size === 0) return render;
  const segments = render.segments.map((s): Segment => {
    const d = s.pieceId !== undefined ? shifts.get(s.pieceId) : undefined;
    return d ? { ...s, from: shiftPose(d, s.from), to: shiftPose(d, s.to) } : s;
  });
  const ports = render.ports.map((p) => {
    const d = shifts.get(p.pieceId);
    if (!d) return p;
    const [x, y, h] = compose(d, [p.x, p.y, p.h]);
    return { ...p, x, y, h };
  });
  return { segments, ports };
}
