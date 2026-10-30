/**
 * HOW FAR THE JOINTS MUST BEND (docs/designs/joint-bend.md).
 *
 * The floor said what the engine did not: a loop 72mm short closes, with every
 * joint seated, because each joint turns a little and over a loop 400mm across
 * those turns add up to centimetres (CALIBRATION.md Q1, 2026-10-30). This
 * module answers one question about a run of track: what is the smallest
 * WORST-joint bend, as a share `lambda` of each joint's own limit, that closes
 * every loop in it, given that each joint may also pull apart up to its
 * stretch?
 *
 * THE MODEL. A loop is a walk: through a piece (a rigid move from the frame
 * you enter it in to the frame you leave it in), then across a joint, which
 * may stretch forward by `s` (0 to its stretch) and then turn by `t`
 * (|t| <= lambda x its limit). The walk closes when it ends where it started,
 * facing the same way. A joint shared by two loops is ONE pair of variables,
 * so no joint's bend is spent twice (cycles.ts rule 2, "give is never
 * pooled").
 *
 * THE SOLVE. Closure is linearised in the joint variables, and the smallest
 * lambda is found by bisection over a feasibility test: for a fixed lambda
 * every limit is a plain bound, so the test is a phase-1 simplex over 3 rows
 * per loop, with bounds held implicitly rather than as rows (eng review D11),
 * Bland's rule against cycling (D5) and the variables in the caller's
 * canonical order (D13), so the same layout gives the same answer however it
 * was built. Then the loop is walked exactly at the solution and the solve is
 * repeated around it, up to three times (D12); what is left over is reported,
 * never hidden.
 *
 * NO PART DATA. Everything arrives as numbers (eng review D15): the graph
 * layer and the calibration derivation build the walks, so this module needs
 * no catalogue and its tests need none.
 */

/** A rigid move in the frame of the walker: forward, left, turn (radians). */
export type Move = readonly [number, number, number];

/** One piece on a loop's walk, and the joint the walk crosses after it. */
export interface BendStep {
  /** The frame you leave the piece in, expressed in the frame you entered it in. */
  readonly move: Move;
  /** Index into `BendRun.joints`. */
  readonly joint: number;
  /** +1 when the walk crosses the joint in its own direction, -1 against it. A turn reads backwards; a stretch does not. */
  readonly sign: 1 | -1;
}

export interface BendJoint {
  /** Radians. The most this joint is credited with turning when lambda is 1. */
  readonly limitRad: number;
  /** Millimetres. How far this joint may pull apart; 0 for none. */
  readonly stretchMm: number;
}

export interface BendRun {
  /** In canonical order (welds by exact lattice position, eng review D13). */
  readonly joints: readonly BendJoint[];
  /** Each loop's walk, starting just after one of its joints and ending across it. */
  readonly loops: readonly (readonly BendStep[])[];
}

export type BendOutcome =
  | {
      readonly kind: 'solved';
      /** The worst joint's bend as a share of its own limit. 1 is exactly at the limit. */
      readonly lambda: number;
      /**
       * The first, purely linear answer, before any refinement. Reported so the
       * linear solve can be checked against an independent method, and so a
       * derived limit can say how far refinement moved it (eng review D13).
       */
      readonly firstLinearLambda: number;
      /** Each joint's turn, radians, at the solution. */
      readonly turns: readonly number[];
      /** Each joint's stretch, mm, at the solution. */
      readonly stretches: readonly number[];
      /** How far apart the worst loop's ends still sit after refinement, mm. */
      readonly leftoverMm: number;
      /** How far the worst loop's ends still point apart after refinement, radians. */
      readonly leftoverRad: number;
      /** Each loop's own min-max lambda, solved alone. A diagnostic; it never decides a verdict. */
      readonly standalone: readonly number[];
      /** Units of solver work spent, for the caller's budget. */
      readonly work: number;
      /** True when no closure was found within LAMBDA_CEILING: `lambda` is then a floor, not a value. */
      readonly atLeast: boolean;
    }
  /** Too big to set up within `maxCells`; nothing was allocated. */
  | { readonly kind: 'too-big'; readonly cells: number }
  /** The solver did not reach an answer: no closure within any bend, or it ran out of work. */
  | { readonly kind: 'unsolved'; readonly why: string; readonly work: number };

/** Leftover allowed before a closure counts as settled (design rule: 0.5mm). */
export const SETTLED_MM = 0.5;
/** A heading leftover is weighed as the sideways miss it makes this far out. */
const HEADING_ARM_MM = 100;
/** The verdict's slack on lambda (design: lambda <= 1.001 closes). */
export const LAMBDA_SLACK = 0.001;

const REFINEMENTS = 3;
/** Past this lambda the first, linear answer is reported as it stands: refinement is for the borderline. */
const SURELY_BEYOND = 2;
const BISECTIONS = 40;
/**
 * The largest lambda the solve looks for. A loop that needs more than this
 * many times its joints' limits is reported as needing AT LEAST this
 * (`atLeast`): it is beyond by any reading, and past here the linear model
 * is too far from its ground to say by how much.
 */
export const LAMBDA_CEILING = 64;
const PIVOT_TOL = 1e-10;
const FEASIBLE_TOL = 1e-7;

// ── Walking ────────────────────────────────────────────────────────────────

function compose(a: Move, b: Move): Move {
  const c = Math.cos(a[2]);
  const s = Math.sin(a[2]);
  return [a[0] + c * b[0] - s * b[1], a[1] + s * b[0] + c * b[1], a[2] + b[2]];
}

/** Turn wrapped to (-pi, pi]. */
function wrap(t: number): number {
  const w = t - 2 * Math.PI * Math.round(t / (2 * Math.PI));
  return w <= -Math.PI ? w + 2 * Math.PI : w;
}

function jointMove(turn: number, stretch: number): Move {
  return [stretch, 0, turn];
}

/** Where a loop's walk ends, given every joint's turn and stretch. Closed is [0, 0, 0]. */
export function walkEnd(loop: readonly BendStep[], turns: readonly number[], stretches: readonly number[]): Move {
  let x: Move = [0, 0, 0];
  for (const step of loop) {
    x = compose(x, step.move);
    x = compose(x, jointMove(step.sign * turns[step.joint]!, stretches[step.joint]!));
  }
  return [x[0], x[1], wrap(x[2])];
}

/**
 * How far bending moves any joint from where the unbent walk puts it, mm. The
 * drawn shape is unbent, so this is how far the built track can sit from the
 * drawing (design 11A: "bending moves pieces up to N mm").
 */
export function bendMovesMm(loop: readonly BendStep[], turns: readonly number[], stretches: readonly number[]): number {
  let a: Move = [0, 0, 0];
  let b: Move = [0, 0, 0];
  let most = 0;
  for (const step of loop) {
    a = compose(a, step.move);
    b = compose(compose(b, step.move), jointMove(step.sign * turns[step.joint]!, stretches[step.joint]!));
    most = Math.max(most, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  return most;
}

/**
 * The linearised closure of one loop: how its end moves per unit turn and per
 * unit stretch at each joint, around the current solution. Exact derivatives,
 * from prefix and suffix compositions: with the walk written as
 * A . T(s) . R(t) . B, the end's position is A.pos + rot(A.turn)(s,0) +
 * rot(A.turn + t) B.pos, so d/dt is rot(A.turn + t) perp(B.pos) and d/ds is
 * rot(A.turn)(1,0), and the end's heading moves one for one with t.
 */
function loopRows(
  loop: readonly BendStep[],
  turns: readonly number[],
  stretches: readonly number[],
  nJoints: number,
): { rows: number[][]; end: Move } {
  const n = loop.length;
  // prefix[k]: the walk up to and including piece k's move (before joint k).
  const prefix: Move[] = [];
  let x: Move = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    x = compose(x, loop[k]!.move);
    prefix.push(x);
    x = compose(x, jointMove(loop[k]!.sign * turns[loop[k]!.joint]!, stretches[loop[k]!.joint]!));
  }
  const end: Move = [x[0], x[1], wrap(x[2])];
  // suffix[k]: the walk after joint k to the end.
  const suffix: Move[] = new Array(n);
  let y: Move = [0, 0, 0];
  for (let k = n - 1; k >= 0; k--) {
    suffix[k] = y;
    const step = loop[k]!;
    y = compose(compose(step.move, jointMove(step.sign * turns[step.joint]!, stretches[step.joint]!)), y);
  }
  const rows = [new Array<number>(2 * nJoints).fill(0), new Array<number>(2 * nJoints).fill(0), new Array<number>(2 * nJoints).fill(0)];
  for (let k = 0; k < n; k++) {
    const step = loop[k]!;
    const j = step.joint;
    const a = prefix[k]!;
    const b = suffix[k]!;
    const turnHere = step.sign * turns[j]!;
    const ca = Math.cos(a[2]);
    const sa = Math.sin(a[2]);
    const cr = Math.cos(a[2] + turnHere);
    const sr = Math.sin(a[2] + turnHere);
    // d end / d t (in loop direction): rot(A + t) . perp(B.pos)
    const dtx = cr * -b[1] - sr * b[0];
    const dty = sr * -b[1] + cr * b[0];
    const [rx, ry, rh] = rows as [number[], number[], number[]];
    rx[j] = rx[j]! + step.sign * dtx;
    ry[j] = ry[j]! + step.sign * dty;
    rh[j] = rh[j]! + step.sign;
    // d end / d s: rot(A)(1, 0). A stretch reads the same either way round.
    rx[nJoints + j] = rx[nJoints + j]! + ca;
    ry[nJoints + j] = ry[nJoints + j]! + sa;
  }
  return { rows, end };
}

// ── The feasibility test: phase-1 simplex with bounded variables ──────────

interface Feasible {
  readonly ok: boolean;
  readonly x: number[];
  readonly work: number;
}

/**
 * Is there an x with A x = b and lo <= x <= hi? A phase-1 simplex: one
 * artificial per row, minimised to zero. Bounds stay implicit (a nonbasic
 * variable sits at one of its bounds), entering and leaving follow Bland's
 * rule, and artificials that leave the basis never return.
 */
function feasible(
  A: readonly (readonly number[])[],
  b: readonly number[],
  lo: readonly number[],
  hi: readonly number[],
  maxWork: number,
): Feasible {
  const m = A.length;
  const n = lo.length;
  const N = n + m;
  // Every structural variable starts AT its lower bound. Not at 0 when 0 lies
  // inside: a nonbasic variable only ever moves away from the bound it sits
  // on, so one parked mid-range could never turn the other way.
  const x = new Array<number>(N).fill(0);
  for (let j = 0; j < n; j++) x[j] = lo[j]!;
  const atUpper = new Array<boolean>(N).fill(false);
  const basis = new Array<number>(m);
  const isBasic = new Array<boolean>(N).fill(false);
  const T: number[][] = [];
  for (let i = 0; i < m; i++) {
    let r = b[i]!;
    for (let j = 0; j < n; j++) r -= A[i]![j]! * x[j]!;
    const sign = r < 0 ? -1 : 1;
    const row = new Array<number>(N).fill(0);
    for (let j = 0; j < n; j++) row[j] = sign * A[i]![j]!;
    row[n + i] = 1;
    T.push(row);
    basis[i] = n + i;
    isBasic[n + i] = true;
    x[n + i] = Math.abs(r);
  }
  const loOf = (j: number): number => (j < n ? lo[j]! : 0);
  const hiOf = (j: number): number => (j < n ? hi[j]! : Infinity);
  let work = m * N;
  const maxIter = 50 * N + 100;
  for (let iter = 0; iter < maxIter; iter++) {
    if (work > maxWork) return { ok: false, x, work };
    // Reduced costs of phase 1: artificials cost 1.
    let enter = -1;
    let dir = 0;
    for (let j = 0; j < n; j++) {
      if (isBasic[j]) continue;
      let d = 0;
      for (let i = 0; i < m; i++) if (basis[i]! >= n) d -= T[i]![j]!;
      if (!atUpper[j] && d < -PIVOT_TOL && x[j]! < hiOf(j) - PIVOT_TOL) {
        enter = j;
        dir = 1;
        break;
      }
      if (atUpper[j] && d > PIVOT_TOL && x[j]! > loOf(j) + PIVOT_TOL) {
        enter = j;
        dir = -1;
        break;
      }
    }
    work += m * N;
    if (enter < 0) break;
    // Ratio test.
    let step = hiOf(enter) - loOf(enter);
    let leaveRow = -1;
    let leaveToUpper = false;
    for (let i = 0; i < m; i++) {
      const a = T[i]![enter]!;
      if (Math.abs(a) <= PIVOT_TOL) continue;
      const v = basis[i]!;
      const rate = -dir * a; // d x_v / d theta
      let limit: number;
      let toUpper: boolean;
      if (rate < 0) {
        limit = (x[v]! - loOf(v)) / -rate;
        toUpper = false;
      } else {
        const h = hiOf(v);
        if (!Number.isFinite(h)) continue;
        limit = (h - x[v]!) / rate;
        toUpper = true;
      }
      if (limit < 0) limit = 0;
      if (limit < step - PIVOT_TOL || (limit <= step + PIVOT_TOL && leaveRow >= 0 && v < basis[leaveRow]!)) {
        step = limit;
        leaveRow = i;
        leaveToUpper = toUpper;
      }
    }
    if (!Number.isFinite(step)) return { ok: false, x, work };
    // Move.
    x[enter] = x[enter]! + dir * step;
    for (let i = 0; i < m; i++) x[basis[i]!] = x[basis[i]!]! - dir * step * T[i]![enter]!;
    if (leaveRow < 0) {
      // The entering variable crossed to its other bound: no pivot.
      atUpper[enter] = !atUpper[enter];
      continue;
    }
    const leave = basis[leaveRow]!;
    x[leave] = leaveToUpper ? hiOf(leave) : loOf(leave);
    atUpper[leave] = leaveToUpper;
    isBasic[leave] = false;
    // An artificial that leaves never comes back: pin it at zero.
    if (leave >= n) x[leave] = 0;
    isBasic[enter] = true;
    basis[leaveRow] = enter;
    atUpper[enter] = false;
    const prow = T[leaveRow]!;
    const p = prow[enter]!;
    for (let j = 0; j < N; j++) prow[j] = prow[j]! / p;
    for (let i = 0; i < m; i++) {
      if (i === leaveRow) continue;
      const f = T[i]![enter]!;
      if (f === 0) continue;
      const row = T[i]!;
      for (let j = 0; j < N; j++) row[j] = row[j]! - f * prow[j]!;
    }
  }
  let infeasibility = 0;
  for (let i = 0; i < m; i++) if (basis[i]! >= n) infeasibility += x[basis[i]!]!;
  return { ok: infeasibility <= FEASIBLE_TOL, x: x.slice(0, n), work };
}

// ── The min-max solve ──────────────────────────────────────────────────────

interface Linear {
  readonly A: number[][];
  readonly b: number[];
}

/** Rows for every loop, linearised around (turns, stretches): A z = A z0 - end(z0). */
function linearise(run: BendRun, loops: readonly number[], turns: readonly number[], stretches: readonly number[]): Linear {
  const nJ = run.joints.length;
  const A: number[][] = [];
  const b: number[] = [];
  const z0 = [...turns, ...stretches];
  for (const l of loops) {
    const { rows, end } = loopRows(run.loops[l]!, turns, stretches, nJ);
    // The heading row is weighed as a sideways miss at HEADING_ARM_MM, so all
    // three rows are in millimetres and one tolerance fits them.
    rows[2] = rows[2]!.map((v) => v * HEADING_ARM_MM);
    const target = [end[0], end[1], end[2] * HEADING_ARM_MM];
    for (let r = 0; r < 3; r++) {
      const row = rows[r]!;
      let az0 = 0;
      for (let j = 0; j < z0.length; j++) az0 += row[j]! * z0[j]!;
      A.push(row);
      b.push(az0 - target[r]!);
    }
  }
  return { A, b };
}

function boundsAt(run: BendRun, lambda: number): { lo: number[]; hi: number[] } {
  const lo: number[] = [];
  const hi: number[] = [];
  for (const j of run.joints) {
    lo.push(-lambda * j.limitRad);
    hi.push(lambda * j.limitRad);
  }
  for (const j of run.joints) {
    lo.push(0);
    hi.push(j.stretchMm);
  }
  return { lo, hi };
}

interface MinMax {
  readonly lambda: number;
  readonly z: number[];
  readonly work: number;
}

/** The smallest lambda for which the linear rows are feasible, by bisection. Null if none up to LAMBDA_CEILING. */
function minMax(run: BendRun, lin: Linear, maxWork: number): MinMax | null | 'out-of-work' {
  let work = 0;
  const test = (lambda: number): Feasible | 'out-of-work' => {
    const { lo, hi } = boundsAt(run, lambda);
    const f = feasible(lin.A, lin.b, lo, hi, maxWork - work);
    work += f.work;
    return work > maxWork ? 'out-of-work' : f;
  };
  const zero = test(0);
  if (zero === 'out-of-work') return 'out-of-work';
  if (zero.ok) return { lambda: 0, z: zero.x, work };
  let lo = 0;
  let hi = 1;
  let best: Feasible | null = null;
  for (;;) {
    const f = test(hi);
    if (f === 'out-of-work') return 'out-of-work';
    if (f.ok) {
      best = f;
      break;
    }
    lo = hi;
    hi *= 2;
    if (hi > LAMBDA_CEILING) return null;
  }
  for (let i = 0; i < BISECTIONS && hi - lo > 1e-7 * hi; i++) {
    const mid = (lo + hi) / 2;
    const f = test(mid);
    if (f === 'out-of-work') return 'out-of-work';
    if (f.ok) {
      hi = mid;
      best = f;
    } else {
      lo = mid;
    }
  }
  return { lambda: hi, z: best!.x, work };
}

function worstLeftover(run: BendRun, loops: readonly number[], turns: readonly number[], stretches: readonly number[]): { mm: number; rad: number } {
  let mm = 0;
  let rad = 0;
  for (const l of loops) {
    const end = walkEnd(run.loops[l]!, turns, stretches);
    mm = Math.max(mm, Math.hypot(end[0], end[1]));
    rad = Math.max(rad, Math.abs(end[2]));
  }
  return { mm, rad };
}

function settled(left: { mm: number; rad: number }): boolean {
  return left.mm <= SETTLED_MM && left.rad * HEADING_ARM_MM <= SETTLED_MM;
}

/** Linearise, solve, re-walk; up to REFINEMENTS more times around the solution. */
function solveLoops(
  run: BendRun,
  loops: readonly number[],
  maxWork: number,
): { lambda: number; first: number; turns: number[]; stretches: number[]; left: { mm: number; rad: number }; work: number; atLeast: boolean } | { why: string; work: number } {
  const nJ = run.joints.length;
  let turns = new Array<number>(nJ).fill(0);
  let stretches = new Array<number>(nJ).fill(0);
  let work = 0;
  let lambda = 0;
  let first = 0;
  let left = worstLeftover(run, loops, turns, stretches);
  for (let pass = 0; pass <= REFINEMENTS; pass++) {
    const lin = linearise(run, loops, turns, stretches);
    const r = minMax(run, lin, maxWork - work);
    if (pass > 0 && (r === null || r === 'out-of-work')) {
      // A refinement that finds nothing keeps the answer it started from:
      // the leftover says how far that answer is from closing (D12).
      break;
    }
    if (r === 'out-of-work') return { why: 'out of work', work: maxWork };
    if (r === null) {
      // No closure within the ceiling: beyond, by at least that much.
      return { lambda: LAMBDA_CEILING, first: LAMBDA_CEILING, turns, stretches, left, work, atLeast: true };
    }
    work += r.work;
    lambda = r.lambda;
    if (pass === 0) first = r.lambda;
    turns = r.z.slice(0, nJ);
    stretches = r.z.slice(nJ);
    left = worstLeftover(run, loops, turns, stretches);
    if (left.mm <= 1e-6 && left.rad <= 1e-9) break;
    // Far past the limits, refining cannot bring a loop back under them: a
    // linear answer twice the limit is beyond whatever the leftover (D12),
    // and around a solution that far out the linear model means nothing.
    if (pass === 0 && r.lambda > SURELY_BEYOND) break;
  }
  return { lambda, first, turns, stretches, left, work, atLeast: false };
}

/**
 * The bend a run of track needs. `maxCells` caps the solver's table before
 * anything is allocated (eng review D11); `maxWork` caps the work spent
 * (D9). Nothing here claims a layout fits or does not: `lambda` and the
 * leftover are measurements of the model, and the caller turns them into a
 * verdict.
 */
export function solveBend(run: BendRun, maxCells: number, maxWork: number): BendOutcome {
  const rows = 3 * run.loops.length;
  const cols = 2 * run.joints.length + rows;
  const cells = rows * cols;
  if (cells > maxCells) return { kind: 'too-big', cells };
  for (const j of run.joints) {
    if (!(j.limitRad >= 0) || !Number.isFinite(j.limitRad) || !(j.stretchMm >= 0) || !Number.isFinite(j.stretchMm)) {
      return { kind: 'unsolved', why: 'a joint has no usable bend or stretch figure', work: 0 };
    }
  }
  const all = run.loops.map((_, i) => i);
  const whole = solveLoops(run, all, maxWork);
  if ('why' in whole) return { kind: 'unsolved', why: whole.why, work: whole.work };
  let work = whole.work;
  const standalone: number[] = [];
  for (const l of all) {
    if (run.loops.length === 1) {
      standalone.push(whole.lambda);
      continue;
    }
    const one = solveLoops(run, [l], maxWork - work);
    if ('why' in one) return { kind: 'unsolved', why: one.why, work: one.work + work };
    work += one.work;
    standalone.push(one.lambda);
  }
  return {
    kind: 'solved',
    lambda: whole.lambda,
    firstLinearLambda: whole.first,
    turns: whole.turns,
    stretches: whole.stretches,
    leftoverMm: whole.left.mm,
    leftoverRad: whole.left.rad,
    standalone,
    work,
    atLeast: whole.atLeast,
  };
}

/** Whether a solved outcome reads as closing: lambda within its slack and the ends meeting. */
export function closesWithinBend(o: Extract<BendOutcome, { kind: 'solved' }>): boolean {
  return o.lambda <= 1 + LAMBDA_SLACK && settled({ mm: o.leftoverMm, rad: o.leftoverRad });
}

/** Whether a solved outcome settled at all (D12: lambda within slack but ends not meeting is "could not check"). */
export function bendSettled(o: Extract<BendOutcome, { kind: 'solved' }>): boolean {
  return settled({ mm: o.leftoverMm, rad: o.leftoverRad });
}
