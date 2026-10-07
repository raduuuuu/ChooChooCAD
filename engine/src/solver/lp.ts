/**
 * Stage 2: distribute the residual across joint slop, fairly.
 *
 * Formulated as a Chebyshev (minimax) linear program:
 *
 *     minimise  t
 *     s.t.      sum_j [ axialDir_j * u_j + angularLever_j * phi_j ] = -R   (2 rows)
 *               sum_j phi_j                                        = -Rt  (1 row)
 *               |u_j|   <= axialMax_j   * t      for every joint
 *               |phi_j| <= angularMax_j * t      for every joint
 *
 * The third row is not optional. A closed loop must come back pointing the way
 * it left, so the angular slop has to sum to zero (or to cancel whatever
 * heading error a previous refinement pass left behind). Omitting it lets the
 * LP solve for a chain that ends in the right PLACE while facing the wrong
 * DIRECTION, and how much that distorts the answer depends on where the loop
 * was cut, which showed up as a gauge-dependent worst ratio.
 *
 * Three things fall out of this formulation rather than having to be bolted on:
 *
 *   t*          is the worst joint's normalised slop usage. t* <= 1 means every
 *               joint is inside its budget, which IS the Vario guarantee, as an
 *               optimum rather than a hope.
 *   the primal  is the per-joint usage report the UI needs.
 *   t* > 1      tells the user exactly how much more give would be required.
 *
 * Signed variables are split as u = up - un because this solver lineage takes
 * non-negative variables only. At the optimum at most one of each pair is
 * positive, so up + un is a tight bound on |u|.
 *
 * yalps returns NaN on "infeasible" and +-Infinity on "unbounded". That is the
 * same hazard as any threshold display fed a non-number, so the result type in
 * result.ts asserts finiteness at the boundary and never lets those values
 * reach a caller.
 */

import { solve, type Model, type Options } from 'yalps';
import type { JointSensitivity } from './residual.js';

/** Pinned so the solve is reproducible. Determinism is a tested property. */
export const LP_OPTIONS: Options = {
  precision: 1e-10,
  checkCycles: true,
  maxPivots: 8192,
  tolerance: 0,
  timeout: Infinity,
};

export interface JointUsage {
  readonly index: number;
  /** Axial slop used, millimetres, signed. */
  readonly axialMm: number;
  /** Angular slop used, degrees, signed. */
  readonly angularDeg: number;
  /** Fraction of this joint's budget consumed, 0..1+ (max of both channels). */
  readonly ratio: number;
}

export type LpOutcome =
  | { readonly kind: 'solved'; readonly worstRatio: number; readonly usage: readonly JointUsage[] }
  | { readonly kind: 'infeasible' }
  | { readonly kind: 'unbounded' }
  | { readonly kind: 'cycled' }
  | { readonly kind: 'timedout' }
  | { readonly kind: 'degenerate'; readonly reason: string };

const DEG_PER_RAD = 180 / Math.PI;

export function distribute(
  /** [x, y] position residual in mm, plus the heading residual in radians. */
  residual: readonly [number, number, number],
  joints: readonly JointSensitivity[],
): LpOutcome {
  if (joints.length === 0) {
    return { kind: 'degenerate', reason: 'no joints to absorb a residual' };
  }

  const constraints: Record<string, { equal?: number; max?: number }> = {
    closeX: { equal: -residual[0] },
    closeY: { equal: -residual[1] },
    closeTheta: { equal: -residual[2] },
  };
  const variables: Record<string, Record<string, number>> = {
    t: { cost: 1 },
  };

  joints.forEach((j, k) => {
    const axRow = `axBound${k}`;
    const angRow = `angBound${k}`;
    constraints[axRow] = { max: 0 };
    constraints[angRow] = { max: 0 };

    // t pays for every joint's budget on both channels.
    variables.t![axRow] = -j.axialMaxMm;
    variables.t![angRow] = -(j.angularMaxDeg / DEG_PER_RAD);

    variables[`ap${k}`] = { closeX: j.axialDir[0], closeY: j.axialDir[1], [axRow]: 1 };
    variables[`an${k}`] = { closeX: -j.axialDir[0], closeY: -j.axialDir[1], [axRow]: 1 };
    variables[`gp${k}`] = {
      closeX: j.angularLever[0], closeY: j.angularLever[1], closeTheta: 1, [angRow]: 1,
    };
    variables[`gn${k}`] = {
      closeX: -j.angularLever[0], closeY: -j.angularLever[1], closeTheta: -1, [angRow]: 1,
    };
  });

  const model: Model = { direction: 'minimize', objective: 'cost', constraints, variables };
  const sol = solve(model, LP_OPTIONS);

  switch (sol.status) {
    case 'infeasible':
      return { kind: 'infeasible' };
    case 'unbounded':
      return { kind: 'unbounded' };
    case 'cycled':
      return { kind: 'cycled' };
    case 'timedout':
      return { kind: 'timedout' };
    case 'optimal':
      break;
  }

  const vars = new Map<string, number>(sol.variables);
  const get = (name: string): number => vars.get(name) ?? 0;

  const usage: JointUsage[] = joints.map((j, k) => {
    const axialMm = get(`ap${k}`) - get(`an${k}`);
    const angularRad = get(`gp${k}`) - get(`gn${k}`);
    const angularDeg = angularRad * DEG_PER_RAD;
    const axRatio = j.axialMaxMm > 0 ? Math.abs(axialMm) / j.axialMaxMm : 0;
    const angRatio = j.angularMaxDeg > 0 ? Math.abs(angularDeg) / j.angularMaxDeg : 0;
    return { index: j.index, axialMm, angularDeg, ratio: Math.max(axRatio, angRatio) };
  });

  return { kind: 'solved', worstRatio: sol.result, usage };
}
