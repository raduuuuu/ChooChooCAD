/**
 * FROM A RUN OF TRACK TO THE BEND IT NEEDS (docs/designs/joint-bend.md).
 *
 * `bend.ts` solves walks; this file builds them. For each connected run that
 * holds a loop it takes the run's fundamental loops (one per closing weld,
 * which between them pin every loop in the run), turns each into a walk of
 * piece moves read straight from the parts' exact port geometry, and asks
 * `solveBend` for the smallest worst-joint bend that closes them all at once.
 *
 * THE WALKS DO NOT USE THE PLACEMENT. A loop's misfit is a property of its
 * pieces, not of where the spanning tree happened to put them, so every walk
 * comes from each piece's own ports, and a loop that comes back turned is
 * simply a walk whose end points the wrong way (eng review D4): there is no
 * separate heading gate. The placement is read once, for the canonical order
 * of the joints (D13): by their exact lattice position, which no build order
 * changes.
 */

import { type Cyc, toXY } from '../geom/cyclotomic.js';
import { LAMBDA_SLACK, bendMovesMm, bendSettled, closesWithinBend, solveBend, type BendJoint, type BendOutcome, type BendRun, type BendStep, type Move } from './bend.js';
import { fundamentalCycle } from './cycles.js';
import type { Placement, WeldResidual } from './frames.js';
import { compose, type Frame, type Graph, type Port } from './model.js';

/** One end of a joint, as the bend model sees it. */
export interface JointSide {
  /** Radians; NaN when the part has no bend figure (DESIGN.md rule 3: a missing number is never fine). */
  readonly limitRad: number;
  readonly stretchMm: number;
}

export type RunBendStatus =
  /** Every loop in the run closes exactly; no give needed. */
  | 'exact'
  /** Closes within the joints' bend and stretch. */
  | 'closes'
  /** Needs more bend than the joints were credited with (lambda > 1.001). */
  | 'beyond'
  /** The solve did not settle, or could not run: no verdict either way (D12). */
  | 'unchecked';

export interface RunBend {
  /** Pieces of the run, in graph order. */
  readonly pieces: readonly string[];
  readonly status: RunBendStatus;
  /** The worst joint's bend as a share of its own limit. Null when not solved. */
  readonly lambda: number | null;
  /** Largest stretch any joint uses at the solution, mm. */
  readonly stretchMm: number;
  /** How far the ends still sit apart after refinement, mm. Null when not solved. */
  readonly leftoverMm: number | null;
  /** The most any of the run's loops comes back turned, in 22.5-degree steps. */
  readonly turnedSteps: number;
  /** Each fundamental loop's own lambda, solved alone (diagnostic). */
  readonly standalone: readonly number[];
  /** Why there is no verdict, when `status` is 'unchecked'. */
  readonly why: string | null;
  /** Solver work spent on this run. */
  readonly work: number;
  /** `lambda` is a floor: no closure was found within the solver's ceiling (bend.ts LAMBDA_CEILING). */
  readonly atLeast: boolean;
  /** How far bending moves any joint from the drawn, unbent shape, mm (design 11A). */
  readonly movesMm: number;
  /**
   * The run's parts that are not BRIO, one entry per part id, sorted by id,
   * with each one's own bend figure: the limits note lists them (design 5A).
   * Filled by `solveGraph`, which knows the parts.
   */
  readonly others: readonly OtherPart[];
  /** Whether the run holds any BRIO piece, for the BRIO limit note. Filled by `solveGraph`. */
  readonly brio: boolean;
  /**
   * Each loop joint's turn and stretch at the solution, keyed by weld index,
   * so the canvas can draw the run the way it sits on the floor
   * (`bendPose.ts`). Absent on the chain path, which has no welds, and on a
   * run with no solution.
   */
  readonly jointBend?: ReadonlyMap<number, JointBend>;
}

/** One joint at the solution: radians, in the weld's own direction (a to b), and millimetres. */
export interface JointBend {
  readonly turn: number;
  readonly stretch: number;
}

/** A run's walks, and which weld each joint is, in the walks' joint order. */
export interface BuiltRun extends BendRun {
  readonly welds: readonly number[];
}

export interface OtherPart {
  readonly partId: string;
  readonly name: string;
  /** Degrees; NaN when the part has no bend figure. */
  readonly limitDeg: number;
}

const STEP_RAD = Math.PI / 8;

function travel(f: Frame, into: boolean): Move {
  const [x, y] = toXY(f.pos);
  return [x, y, (f.heading + (into ? 8 : 0)) * STEP_RAD];
}

/** The move through a piece, entered at port `inP` and left at port `outP`, in travel frames. */
export function pieceMove(ports: readonly Port[], inP: number, outP: number): Move {
  const e = travel(ports[inP]!.at, true);
  const x = travel(ports[outP]!.at, false);
  const dx = x[0] - e[0];
  const dy = x[1] - e[1];
  const c = Math.cos(e[2]);
  const s = Math.sin(e[2]);
  // The turn wrapped to (-pi, pi]: a 45-degree curve reads +45, never -315.
  const turn = x[2] - e[2] - 2 * Math.PI * Math.round((x[2] - e[2]) / (2 * Math.PI));
  return [c * dx + s * dy, -s * dx + c * dy, turn <= -Math.PI ? turn + 2 * Math.PI : turn];
}

/**
 * A cycle's welds as a walk: each piece entered by one weld and left by the
 * next. Null when the welds do not form one simple loop.
 */
function walkOf(
  graph: Graph,
  edges: readonly number[],
  portsOf: (pieceId: string) => readonly Port[],
  jointIndex: ReadonlyMap<number, number>,
): BendStep[] | null {
  const incident = new Map<string, number[]>();
  for (const e of edges) {
    const w = graph.welds[e]!;
    for (const id of [w.a.pieceId, w.b.pieceId]) {
      if (!incident.has(id)) incident.set(id, []);
      incident.get(id)!.push(e);
    }
  }
  for (const list of incident.values()) if (list.length !== 2) return null;
  // Start on the far side of the first weld, so the walk ends across it.
  const first = graph.welds[edges[0]!]!;
  let at = first.b.pieceId;
  let inPort = first.b.port;
  let prev = edges[0]!;
  const steps: BendStep[] = [];
  for (let k = 0; k < edges.length; k++) {
    const next = k === edges.length - 1 ? edges[0]! : incident.get(at)!.find((e) => e !== prev);
    if (next === undefined) return null;
    const w = graph.welds[next]!;
    // Crossed in its own direction when the walk leaves through its `a` end.
    const forward = w.a.pieceId === at;
    const outPort = forward ? w.a.port : w.b.port;
    steps.push({ move: pieceMove(portsOf(at), inPort, outPort), joint: jointIndex.get(next)!, sign: forward ? 1 : -1 });
    at = forward ? w.b.pieceId : w.a.pieceId;
    inPort = forward ? w.b.port : w.a.port;
    prev = next;
  }
  if (at !== first.b.pieceId) return null;
  return steps;
}

function compareCyc(a: Cyc, b: Cyc): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/**
 * The walks for a set of cycles (each a list of weld indices), with every weld
 * on any of them as one joint, all in canonical order (eng review D13): joints
 * by their exact lattice position, which no build order changes, and loops by
 * their first joint in that order. Null when a cycle is not one simple loop.
 */
export function buildRun(
  graph: Graph,
  placement: Placement,
  cycles: readonly (readonly number[])[],
  portsOf: (pieceId: string) => readonly Port[],
  side: (pieceId: string) => JointSide,
): BuiltRun | null {
  const onLoop = [...new Set(cycles.flat())];
  const where = new Map<number, Frame>();
  for (const w of onLoop) {
    const weld = graph.welds[w]!;
    const frame = placement.frames.get(weld.a.pieceId)!;
    where.set(w, compose(frame, portsOf(weld.a.pieceId)[weld.a.port]!.at));
  }
  onLoop.sort((a, b) => {
    const fa = where.get(a)!;
    const fb = where.get(b)!;
    return compareCyc(fa.pos, fb.pos) || fa.heading - fb.heading || a - b;
  });
  const jointIndex = new Map(onLoop.map((w, i) => [w, i]));
  const joints: BendJoint[] = onLoop.map((w) => {
    const weld = graph.welds[w]!;
    const sa = side(weld.a.pieceId);
    const sb = side(weld.b.pieceId);
    return { limitRad: Math.min(sa.limitRad, sb.limitRad), stretchMm: Math.min(sa.stretchMm, sb.stretchMm) };
  });
  const walks: BendStep[][] = [];
  for (const edges of cycles) {
    const ordered = [...edges].sort((a, b) => jointIndex.get(a)! - jointIndex.get(b)!);
    const walk = walkOf(graph, ordered, portsOf, jointIndex);
    if (!walk) return null;
    walks.push(walk);
  }
  walks.sort((a, b) => Math.min(...a.map((s) => s.joint)) - Math.min(...b.map((s) => s.joint)));
  return { joints, loops: walks, welds: onLoop };
}

/** One cycle's own bend, solved alone: the diagnostic that ranks loops and triggers the repair (D3). */
export function cycleLambda(
  graph: Graph,
  placement: Placement,
  edges: readonly number[],
  portsOf: (pieceId: string) => readonly Port[],
  side: (pieceId: string) => JointSide,
  budget: BendBudget,
): { lambda: number | null; work: number } {
  const run = buildRun(graph, placement, [edges], portsOf, side);
  if (!run) return { lambda: null, work: 0 };
  const o = solveBend(run, budget.maxCells, budget.maxWork);
  if (o.kind === 'too-big') return { lambda: null, work: 0 };
  const lambda = o.kind === 'solved' && (bendSettled(o) || o.lambda > 1 + LAMBDA_SLACK) ? o.lambda : null;
  return { lambda, work: o.work };
}

/**
 * The verdict rule on one solved outcome (design, "The verdict rule", and eng
 * review D12): closes when lambda is within its slack AND the ends meet;
 * beyond when lambda is past its slack, whatever the leftover; otherwise no
 * verdict, because a solve that did not settle below the limit has shown
 * nothing about the track.
 */
export function statusOf(o: Extract<BendOutcome, { kind: 'solved' }>): Exclude<RunBendStatus, 'exact'> {
  if (o.atLeast) return 'beyond';
  if (closesWithinBend(o)) return 'closes';
  return o.lambda > 1 + LAMBDA_SLACK ? 'beyond' : 'unchecked';
}

/**
 * One run's verdict from its walks: the shared last step of the graph path
 * and the chain path (eng review D2), so both read the same rule.
 */
export function solveRun(pieces: readonly string[], built: BendRun | BuiltRun | null, turnedSteps: number, budget: BendBudget): RunBend {
  const none = { lambda: null, stretchMm: 0, leftoverMm: null, turnedSteps, standalone: [], movesMm: 0, others: [], brio: true, atLeast: false } as const;
  if (!built) return { ...none, pieces, status: 'unchecked', why: 'a loop could not be followed round', work: 0 };
  const o: BendOutcome = solveBend(built, budget.maxCells, budget.maxWork);
  if (o.kind !== 'solved') {
    return {
      ...none,
      pieces,
      status: 'unchecked',
      why: o.kind === 'too-big' ? 'too big to check the bend' : o.why,
      work: o.kind === 'too-big' ? 0 : o.work,
    };
  }
  const status = statusOf(o);
  return {
    pieces,
    status,
    lambda: o.lambda,
    stretchMm: Math.max(0, ...o.stretches),
    leftoverMm: o.leftoverMm,
    turnedSteps,
    standalone: o.standalone,
    // Rounded up: a leftover above 0.5mm never reads as 0.5 (DESIGN.md rule 4).
    why: status === 'unchecked' ? `the model still leaves ${(Math.ceil(o.leftoverMm * 10 - 1e-9) / 10).toFixed(1)}mm` : null,
    work: o.work,
    movesMm: Math.max(0, ...built.loops.map((loop) => bendMovesMm(loop, o.turns, o.stretches))),
    others: [],
    brio: true,
    atLeast: o.atLeast,
    ...('welds' in built ? { jointBend: new Map(built.welds.map((w, i) => [w, { turn: o.turns[i]!, stretch: o.stretches[i]! }])) } : {}),
  };
}

/** The solver's table and work caps (eng review D9, D11). */
export const BEND_BUDGET = { maxCells: 2_000_000, maxWork: 20_000_000 } as const;

export interface BendBudget {
  readonly maxCells: number;
  readonly maxWork: number;
}

/**
 * The bend each looped run needs. `side(pieceId)` gives a piece's bend limit
 * and stretch; a joint gets the WEAKER of its two sides (eng review D10),
 * because the verdict now claims closure and a joint is only as loose as its
 * tighter half.
 */
export function bendRuns(
  graph: Graph,
  placement: Placement,
  residualsOf: readonly WeldResidual[],
  portsOf: (pieceId: string) => readonly Port[],
  side: (pieceId: string) => JointSide,
  budget: BendBudget,
): RunBend[] {
  const forest = placement.forest;
  const byComponent = new Map<number, number[]>();
  for (const w of forest.closing) {
    const comp = forest.component.get(graph.welds[w]!.a.pieceId)!;
    if (!byComponent.has(comp)) byComponent.set(comp, []);
    byComponent.get(comp)!.push(w);
  }
  const residualBy = new Map(residualsOf.map((r) => [r.weld, r]));
  const out: RunBend[] = [];
  let spent = 0;
  for (const comp of [...byComponent.keys()].sort((a, b) => a - b)) {
    const closing = byComponent.get(comp)!;
    const pieces = graph.pieces.filter((p) => forest.component.get(p.pieceId) === comp).map((p) => p.pieceId);
    const turnedSteps = Math.max(
      0,
      ...closing.map((w) => {
        const h = residualBy.get(w)?.headingSteps ?? 0;
        return Math.min(h, 16 - h);
      }),
    );
    const exact = closing.every((w) => residualBy.get(w)?.closes === true);
    if (exact) {
      out.push({ pieces, status: 'exact', lambda: 0, stretchMm: 0, leftoverMm: 0, turnedSteps: 0, standalone: closing.map(() => 0), why: null, work: 0, movesMm: 0, others: [], brio: true, atLeast: false });
      continue;
    }
    const built = buildRun(graph, placement, closing.map((w) => fundamentalCycle(graph, forest, w)), portsOf, side);
    // ONE BUDGET FOR THE WHOLE LAYOUT (eng review D9): each run spends from
    // what the runs before it left, so many runs cannot each spend the lot.
    const run = solveRun(pieces, built, turnedSteps, { maxCells: budget.maxCells, maxWork: Math.max(0, budget.maxWork - spent) });
    spent += run.work;
    out.push(run);
  }
  return out;
}
