/**
 * THE BEND MODEL (docs/designs/joint-bend.md; eng review D2-D15).
 *
 * Value: protects=the floor's Q1 loop closes and the bend limit is the one it
 * implies; the linear solve agrees with an independent method; a joint's bend
 * is spent once across loops; the answer does not depend on build order; the
 * leftover rule and the size cap give "could not check", never a verdict; the
 * whole layout shares one work budget
 * Value: fails_when=the derivation falls back to the estimate, the simplex
 * returns a wrong optimum, loops are solved separately and their bends
 * pooled, joint order leaks into the answer, a non-settling solve reads as
 * closing or beyond, or the budget becomes per-run
 * Value: why_new=no bend model existed; the give was a sum of axial stretch
 * Value: seam=none for the engine specs; the oracle is a second, independent
 * solver kept only here (eng review D5)
 * Value: no_claim=that 2.7 degrees is what every BRIO joint does: it is a
 * lower bound inferred from one loop (CALIBRATION.md Q1), and Q1b on the
 * calibration sheet's follow-up page is the next reading
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { bendLimit, deriveBendLimit, q1BendDeg, Q1_LOOP } from '../data/bendLimit.js';
import { getPart } from '../data/brio.js';
import { MEASUREMENTS } from '../data/measurements.js';
import { solveBend, walkEnd, type BendRun, type BendStep } from '../src/graph/bend.js';
import { BEND_BUDGET, bendRuns, pieceMove, solveRun, statusOf } from '../src/graph/bendRun.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../src/graph/model.js';
import { solveGraph } from '../src/graph/solve.js';
import { computeResidual } from '../src/solver/residual.js';
import { fromInt } from '../src/geom/cyclotomic.js';
import { bendWords } from '../src/joints/bendWords.js';
import { solveLayout } from '../src/solver/result.js';

const DEG = Math.PI / 180;
const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** A closed chain of catalogue parts as a one-loop walk, a joint after each piece. */
const walkOf = (ids: readonly string[]): BendStep[] =>
  ids.map((id, i) => ({ move: pieceMove(portsOf(getPart(id)), 0, 1), joint: i, sign: 1 as const }));

const runOf = (ids: readonly string[], limitDeg: number, stretchMm: number): BendRun => ({
  joints: ids.map(() => ({ limitRad: limitDeg * DEG, stretchMm })),
  loops: [walkOf(ids)],
});

describe('the floor loop and the limit it implies', () => {
  /*
   * The probe's figure, as a test (design R1-2): the smallest worst-joint
   * bend that closes Q1 with no stretch, from the linear solve alone.
   *
   * MUTATION PROOF, run: `const BISECTIONS = 40` lowered to 2 in bend.ts
   * fails with `expected 3 to be close to 2.99, received difference is
   * 0.009999999999999787, but expected 0.005`.
   */
  it('Q1 needs 2.99 degrees at the worst joint, stretch excluded (linear)', () => {
    const o = solveBend(runOf(Q1_LOOP, 1, 0), 1e6, 1e9);
    expect(o.kind).toBe('solved');
    if (o.kind !== 'solved') return;
    expect(o.firstLinearLambda).toBeCloseTo(2.99, 2);
  });

  /*
   * THE LIMIT IS INFERRED FROM Q1, NOT THE ESTIMATE. A bug in this very
   * change derived it with a one-degree unit, which the solver's "surely
   * beyond" cutoff then refused to refine, so the derivation fell back to
   * 1.5 degrees in one test project and not the other.
   *
   * MUTATION PROOF, run: `const UNIT_DEG = 1` in bendLimit.ts fails with
   * `expected 'estimated' to be 'inferred'`.
   */
  it('the BRIO bend limit is inferred from Q1: about 2.69 degrees', () => {
    const b = bendLimit();
    expect(b.status).toBe('inferred');
    expect(b.deg).toBeCloseTo(2.687, 2);
    expect(b.marginDeg).toBeGreaterThanOrEqual(0);
  });

  it('a measured Q2 bend wins; with neither reading the estimate stands', () => {
    const measured = { ...MEASUREMENTS, q2: { ...MEASUREMENTS.q2, bendDeg: 4 } };
    expect(deriveBendLimit(measured, 2)).toMatchObject({ deg: 4, status: 'measured' });
    const blank = { ...MEASUREMENTS, q1: { ...MEASUREMENTS.q1, trainRuns: null } };
    expect(deriveBendLimit(blank, 2)).toMatchObject({ deg: 1.5, status: 'estimated' });
  });

  /*
   * Q1 sits exactly at its own limit, by construction, and a tenth of a
   * degree less reads beyond (design success criterion 1).
   *
   * MUTATION PROOF, run: `LAMBDA_SLACK = 0.001` set to -0.001 in bend.ts
   * fails with `expected 'beyond' to be 'closes'`.
   */
  it('Q1 closes at the inferred limit, and is beyond it 0.1 degree lower', () => {
    const limit = q1BendDeg(2)!.deg;
    const at = solveRun(['q'], runOf(Q1_LOOP, limit, 2), 0, BEND_BUDGET);
    expect(at.status).toBe('closes');
    const lower = solveRun(['q'], runOf(Q1_LOOP, limit - 0.1, 2), 0, BEND_BUDGET);
    expect(lower.status).toBe('beyond');
  });
});

describe('the solver against an independent method (eng review D5)', () => {
  /*
   * THE ORACLE: bisection on lambda, feasibility by alternating projection
   * (Dykstra) between the closure's affine set and the box of bounds. Nothing
   * shared with the simplex but the walk itself; the Jacobian here is taken
   * by finite differences, not the simplex's analytic rows.
   */
  function oracle(run: BendRun): number {
    const nJ = run.joints.length;
    const loop = run.loops[0]!;
    const z0 = new Array<number>(2 * nJ).fill(0);
    const endAt = (z: number[]) => {
      const e = walkEnd(loop, z.slice(0, nJ), z.slice(nJ));
      return [e[0], e[1], e[2] * 100];
    };
    const r0 = endAt(z0);
    // Each variable measured in its own bound (a turn in its limit, a stretch
    // in its travel), so alternating projection is not working across radians
    // and millimetres at once, which it converges on far too slowly.
    const scale = [...run.joints.map((j) => j.limitRad), ...run.joints.map((j) => j.stretchMm || 1)];
    const J: number[][] = [[], [], []];
    for (let j = 0; j < 2 * nJ; j++) {
      const z = [...z0];
      z[j] = 1e-7 * scale[j]!;
      const rj = endAt(z);
      for (let i = 0; i < 3; i++) J[i]!.push((rj[i]! - r0[i]!) / 1e-7);
    }
    const b = r0.map((v) => -v);
    // J J^T and its inverse, for projection onto J z = b.
    const JJt = [0, 1, 2].map((a) => [0, 1, 2].map((c) => J[a]!.reduce((s, v, k) => s + v * J[c]![k]!, 0)));
    const inv3 = (m: number[][]) => {
      const [[a, b2, c], [d, e, f], [g, h, k]] = m as [[number, number, number], [number, number, number], [number, number, number]];
      const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g;
      const det = a * A + b2 * B + c * C;
      return [
        [A / det, -(b2 * k - c * h) / det, (b2 * f - c * e) / det],
        [B / det, (a * k - c * g) / det, -(a * f - c * d) / det],
        [C / det, -(a * h - b2 * g) / det, (a * e - b2 * d) / det],
      ];
    };
    const Minv = inv3(JJt);
    const project = (v: number[]) => {
      const res = b.map((bi, i) => bi - J[i]!.reduce((s, x, k) => s + x * v[k]!, 0));
      const lam = Minv.map((row) => row.reduce((s, x, k) => s + x * res[k]!, 0));
      return v.map((x, k) => x + J.reduce((s, row, i) => s + row[k]! * lam[i]!, 0));
    };
    const feasible = (lambda: number) => {
      let v = [...z0], p = [...z0], q = [...z0];
      for (let it = 0; it < 6000; it++) {
        const y = project(v.map((x, k) => x + p[k]!));
        p = v.map((x, k) => x + p[k]! - y[k]!);
        const w = y.map((x, k) => x + q[k]!);
        const zz = w.map((x, k) =>
          k < nJ ? Math.max(-lambda, Math.min(lambda, x)) : Math.max(0, Math.min(run.joints[k - nJ]!.stretchMm > 0 ? 1 : 0, x)),
        );
        q = w.map((x, k) => x - zz[k]!);
        v = zz;
      }
      return Math.max(...b.map((bi, i) => Math.abs(J[i]!.reduce((s, x, k) => s + x * v[k]!, 0) - bi))) < 1e-3;
    };
    let lo = 0;
    let hi = 1;
    while (!feasible(hi)) {
      lo = hi;
      hi *= 2;
    }
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (feasible(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /*
   * MUTATION PROOF, run: the stretch variables' upper bound set to 0 in
   * `solveBend` (joints may bend but never pull apart) fails with `E E E E D
   * E E E E A: 1.1076927781105042 vs 1.0026246309280396: expected
   * 0.10479310396076391 to be less than 0.01`.
   */
  it('agrees with the oracle on near-miss loops, to 1 part in 100', () => {
    const corpus = [
      Q1_LOOP,
      ['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A1'],
      ['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A'],
      // 144 + 54 against 216: an 18mm miss.
      ['E', 'E', 'E', 'E', 'A', 'A2', 'E', 'E', 'E', 'E', 'D'],
      ['E', 'E', 'A2', 'E', 'E', 'E', 'E', 'A3', 'E', 'E'],
    ];
    for (const ids of corpus) {
      const run = runOf(ids, 2.7, 2);
      const o = solveBend(run, 1e6, 1e9);
      expect(o.kind, ids.join(' ')).toBe('solved');
      if (o.kind !== 'solved') continue;
      const want = oracle(run);
      expect(Math.abs(o.firstLinearLambda - want) / want, `${ids.join(' ')}: ${o.firstLinearLambda} vs ${want}`).toBeLessThan(0.01);
    }
  });
});

describe('a joint is spent once, however many loops use it (cycles.ts rule 2)', () => {
  /*
   * TWO LOOPS SHARING ONE JOINT THAT EACH WANT IT TURNED THE OTHER WAY. Alone,
   * each closes at half its limits; together the shared joint can help
   * neither, and the run needs its full limit. Solving loops one at a time and
   * pooling would report 0.5.
   *
   * MUTATION PROOF, run: `solveBend` returning the MAX of the standalone
   * lambdas instead of the joint solve (`lambda: Math.max(...standalone)`)
   * fails with `expected 0.4999999701976776 to be close to 1, received
   * difference is 0.5000000298023224, but expected 5e-7`.
   */
  it('two loops each fine alone are not fine together', () => {
    const turnOnly = (turn: number): [number, number, number] => [0, 0, turn];
    const run: BendRun = {
      joints: [0, 1, 2].map(() => ({ limitRad: 0.01, stretchMm: 0 })),
      loops: [
        [
          { move: turnOnly(-0.01), joint: 0, sign: 1 },
          { move: turnOnly(0), joint: 1, sign: 1 },
        ],
        [
          { move: turnOnly(-0.01), joint: 0, sign: -1 },
          { move: turnOnly(0), joint: 2, sign: 1 },
        ],
      ],
    };
    const o = solveBend(run, 1e6, 1e9);
    expect(o.kind).toBe('solved');
    if (o.kind !== 'solved') return;
    expect(o.standalone[0]).toBeCloseTo(0.5, 6);
    expect(o.standalone[1]).toBeCloseTo(0.5, 6);
    expect(o.lambda).toBeCloseTo(1, 6);
  });
});

describe('the answer does not depend on how the layout was built (eng review D13)', () => {
  /** The same near-miss loop, its pieces listed in a given order with given ids. */
  const loopGraph = (ids: readonly string[], order: readonly number[], prefix: string): Graph => {
    const n = ids.length;
    const pieces = order.map((i) => ({ pieceId: `${prefix}${i}`, partId: ids[i]!, turn: 'left' as const }));
    const welds = order.map((i) => ({ a: { pieceId: `${prefix}${i}`, port: 1 }, b: { pieceId: `${prefix}${(i + 1) % n}`, port: 0 } }));
    return { pieces, welds, anchors: new Map([[`${prefix}0`, { pos: fromInt(0), heading: 0 }]]) };
  };
  const solve = (g: Graph) => solveGraph(g, ports, resolve, (id) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId).slop.axialMm, placeAll(g, ports));

  /*
   * THE NUMBER IS ORDER-FREE BY CONSTRUCTION; THE WORDS HAD TO BE MADE SO.
   * lambda comes from bisection over feasibility, which no variable order
   * changes: measured, three joint orders of one loop all give
   * 1.8203397989273071, and dropping `buildRun`'s canonical sort leaves this
   * spec green. What build order CAN leak into is the verdict's list of other
   * brands (design R3-1), so the loop mixes two of them.
   *
   * MUTATION PROOF, run: the `.sort(...)` on `others` in solve.ts removed
   * (insertion order) fails with `expected '{"tier":"beyond","figure":{"unit":"pc…'
   * to be '{"tier":"beyond","figure":{"unit":"pc…'`: the same layout listing IKEA
   * then Playtive one way and Playtive then IKEA the other.
   */
  it('the same loop built forwards, backwards and renamed gives the same lambda and the same words', () => {
    const ids = ['E1', 'E1', 'E1', 'E1', 'IKEA-150', 'PLAYTIVE-60', 'E1', 'E1', 'E1', 'E1', 'A'];
    const forwards = solve(loopGraph(ids, ids.map((_, i) => i), 'a'));
    const backwards = solve(loopGraph(ids, ids.map((_, i) => ids.length - 1 - i), 'zz'));
    expect(forwards.ok && backwards.ok).toBe(true);
    if (!forwards.ok || !backwards.ok) return;
    expect(backwards.lead!.lambda).toBe(forwards.lead!.lambda);
    expect(forwards.lead!.others.map((o) => o.partId)).toEqual(['IKEA-150', 'PLAYTIVE-60']);
    const words = (r: typeof forwards) => (r.ok ? JSON.stringify(bendWords(r.lead!, bendLimit(), 1, 1)) : '');
    expect(words(backwards)).toBe(words(forwards));
  });

  it('cutting a closed chain anywhere gives the same verdict and lambda', () => {
    const base = ['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A'];
    const first = solveLayout({ placements: base.map((partId) => ({ partId, turn: 'left' as const })), closed: true });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    for (let off = 1; off < base.length; off++) {
      const rot = [...base.slice(off), ...base.slice(0, off)];
      const r = solveLayout({ placements: rot.map((partId) => ({ partId, turn: 'left' as const })), closed: true });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.bend.status).toBe(first.bend.status);
      expect(r.bend.lambda!).toBeCloseTo(first.bend.lambda!, 6);
    }
  });
});

describe('no verdict unless the solve earned one (eng review D11, D12)', () => {
  const solved = (lambda: number, leftoverMm: number) =>
    ({ kind: 'solved', lambda, firstLinearLambda: lambda, turns: [], stretches: [], leftoverMm, leftoverRad: 0, standalone: [lambda], work: 0, atLeast: false }) as const;

  /*
   * MUTATION PROOF, run: `statusOf` returning 'beyond' for an unsettled solve
   * under the limit (the design's first wording, before D12) fails with
   * `expected 'beyond' to be 'unchecked'`.
   */
  it('a solve that leaves the ends apart under the limit is "could not check", not beyond', () => {
    expect(statusOf(solved(0.9, 0.8))).toBe('unchecked');
    expect(statusOf(solved(0.9, 0.1))).toBe('closes');
    expect(statusOf(solved(1.2, 0.8))).toBe('beyond');
    expect(statusOf({ ...solved(64, 300), atLeast: true })).toBe('beyond');
  });

  /*
   * MUTATION PROOF, run: the `cells > maxCells` check at the top of
   * `solveBend` removed fails with `expected 'solved' to be 'too-big'`.
   */
  it('a run too big for the table is refused before anything is allocated', () => {
    const o = solveBend(runOf(Q1_LOOP, 2.7, 2), 10, 1e9);
    expect(o.kind).toBe('too-big');
    const r = solveRun(['q'], runOf(Q1_LOOP, 2.7, 2), 0, { maxCells: 10, maxWork: 1e9 });
    expect(r.status).toBe('unchecked');
    expect(r.why).toBe('too big to check the bend');
  });
});

describe('the bend is bounded, and quick, on the largest layouts (eng review D9)', () => {
  const resolveIds = (g: Graph) => (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId).slop.axialMm;
  /** `k` disjoint copies of a loop, each its own run, side by side. */
  const copies = (k: number, ids: readonly string[]): Graph => {
    const pieces: Piece[] = [];
    const welds: Graph['welds'][number][] = [];
    const anchors = new Map<string, { pos: ReturnType<typeof fromInt>; heading: number }>();
    for (let c = 0; c < k; c++) {
      ids.forEach((partId, i) => pieces.push({ pieceId: `c${c}p${i}`, partId, turn: 'left' }));
      ids.forEach((_, i) => welds.push({ a: { pieceId: `c${c}p${i}`, port: 1 }, b: { pieceId: `c${c}p${(i + 1) % ids.length}`, port: 0 } }));
      anchors.set(`c${c}p0`, { pos: fromInt(2000 * c), heading: 0 });
    }
    return { pieces, welds, anchors };
  };

  /*
   * ONE BUDGET FOR THE LAYOUT. 31 runs (the rank ceiling), each beyond the
   * bend, given a budget that cannot cover them all: the runs draw on it in
   * turn, and the ones it does not reach read "could not check" rather than
   * each getting a fresh allowance.
   *
   * MUTATION PROOF, run: `bendRuns` passing the full budget to every run
   * (`maxWork: budget.maxWork`, dropping `- spent`) fails with `expected
   * 5721825 to be less than or equal to 500000`.
   */
  it('31 runs share one budget, and the ones it does not reach are unchecked', () => {
    const g = copies(31, ['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A']);
    const place = placeAll(g, ports);
    const byId = new Map(g.pieces.map((p) => [p.pieceId, p]));
    const runs = bendRuns(
      g,
      place,
      residuals(g, ports, place),
      (id) => ports(byId.get(id)!),
      () => ({ limitRad: 2.7 * DEG, stretchMm: 2 }),
      { maxCells: BEND_BUDGET.maxCells, maxWork: 500_000 },
    );
    expect(runs).toHaveLength(31);
    expect(runs.reduce((s2, b) => s2 + b.work, 0)).toBeLessThanOrEqual(500_000);
    expect(runs.some((b) => b.status === 'beyond')).toBe(true);
    expect(runs.some((b) => b.status === 'unchecked')).toBe(true);
  });

  /*
   * THE WHOLE ENTRY POINT, timed (prior learning: time what the user waits
   * for, not the part that changed). Measured 33ms for 31 near-miss runs and
   * 32ms for a 2,000-piece loop on an idle machine; 1,000ms leaves ~30x for a
   * loaded parallel run, sized like graphFeasible.test.ts's scan bound, while
   * a per-run budget at 31 x 20M work would take seconds.
   */
  const BEND_BOUND_MS = 1000;
  it('solveGraph on the rank ceiling and on a 2,000-piece loop is well under a second', () => {
    const big = ['E', 'E', 'E', 'E', ...Array<string>(996).fill('D'), 'E', 'E', 'E', 'E', ...Array<string>(995).fill('D'), 'A'];
    for (const g of [copies(31, ['E1', 'E1', 'E1', 'E1', 'D', 'E1', 'E1', 'E1', 'E1', 'A']), copies(1, big)]) {
      const place = placeAll(g, ports);
      const t0 = performance.now();
      const r = solveGraph(g, ports, resolve, resolveIds(g), place);
      const ms = performance.now() - t0;
      expect(r.ok).toBe(true);
      expect(ms, `${g.pieces.length} pieces took ${ms.toFixed(0)}ms`).toBeLessThan(BEND_BOUND_MS);
    }
  });
});

describe('the bend never takes back a verdict the old give rule granted (eng review D8)', () => {
  /*
   * THE REGRESSION CONTRACT. Before the bend, a loop passed when its ends met
   * square and its gap fit inside two millimetres of stretch per joint. Every
   * stadium of four curves, a side of up to two straights, four curves and
   * another side, in both curve sizes: 882 loops. Every one the old rule
   * passed still passes; the bend only adds passes (the loops whose ends met
   * turned, which the old rule refused outright). Measured on this branch:
   * 126 old passes, all kept, and 200 more.
   *
   * MUTATION PROOF, run: `closesWithinBend` asking for lambda <= 0.05
   * instead of 1 fails with `expected [ 'E E E E A2 E E E E A3', …(59) ] to
   * deeply equal []`. The contract has room: at lambda <= 0.5, or with a
   * quarter of the stretch, every old pass still holds and only the count of
   * added passes moves (`expected 42 to be 200`, `expected 182 to be 200`).
   */
  it('every stadium the old rule passed still passes, and more now do', () => {
    const S = ['A2', 'A3', 'A1', 'A', 'D'];
    const sides: string[][] = [[]];
    for (const a of S) sides.push([a]);
    for (const a of S) for (const b of S) if (S.indexOf(b) >= S.indexOf(a)) sides.push([a, b]);
    let oldPasses = 0;
    let added = 0;
    const lost: string[] = [];
    for (const curve of ['E', 'E1']) {
      for (const s1 of sides) {
        for (const s2 of sides) {
          const ids = [curve, curve, curve, curve, ...s1, curve, curve, curve, curve, ...s2];
          const layout = { placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed: true };
          const res = computeResidual(layout, getPart);
          const old = res.headingMismatchSteps === 0 && (res.closesExactly || res.gapMm <= ids.length * 2);
          const r = solveLayout(layout);
          const now = r.ok && r.withinBound;
          if (old) {
            oldPasses++;
            if (!now) lost.push(ids.join(' '));
          } else if (now) added++;
        }
      }
    }
    expect(lost).toEqual([]);
    expect(oldPasses).toBe(126);
    expect(added).toBe(200);
  });
});
