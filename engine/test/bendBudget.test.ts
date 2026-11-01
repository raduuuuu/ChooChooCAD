/**
 * THE BEND SOLVER'S BUDGET IS ENOUGH, AND HONEST (plan 2026-11-01,
 * docs/plan/2026-11-01-bend-solver-budget.md: R1, OV-A, OV-B, eng X1, X2).
 *
 * Value: protects=a layout of interlocking loops that closes on the floor
 * (the owner's, every loose end joined) gets a verdict, not "could not check";
 * the solver never spends more than its budget, a budget too small to start
 * spends nothing, and a solve cut short reports the work it really spent
 * Value: fails_when=the budget goes back to 20M, a per-loop diagnostic vetoes
 * the run again, or a refinement that runs out stops charging its work
 * Value: why_new=the owner's layout was refused at 20M, and the cap leaked
 * Value: seam=none (solveGraph and solveBend, as the app calls them)
 * Value: no_claim=wall time on a phone (measured by hand, in the PR)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPart } from '../data/generic.js';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { brandFit } from '../data/thirdParty.js';
import { bendLimit, Q1_LOOP } from '../data/bendLimit.js';
import { solveBend, type BendRun } from '../src/graph/bend.js';
import { BEND_BUDGET, pieceMove } from '../src/graph/bendRun.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'owner-interlocked.json'), 'utf8'));
const owner = (joins: number): Graph => ({
  pieces: fixture.base.pieces,
  welds: [...fixture.base.welds, ...fixture.joins.slice(0, joins)],
  anchors: new Map<string, Frame>(fixture.base.anchors),
});
const solve = (g: Graph) => {
  const placement = placeAll(g, ports);
  const render = renderGraph(g, ports, resolve, placement);
  const slop = new Map(g.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  return solveGraph(g, ports, resolve, (id: string) => slop.get(id) ?? 0, placement, { parts: BUILT_IN, brandFit }, render.segments);
};

describe('interlocking loops that close on the floor get a verdict (R1, OV-B)', () => {
  /*
   * MUTATION PROOF, run: `BEND_BUDGET.maxWork` back to 20_000_000: the
   * verdict was BEND_UNCHECKED, `expected false to be true`.
   */
  it("the owner's layout with every loose end joined closes, needing 2.53° at the worst joint", () => {
    const r = solve(owner(fixture.joins.length));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.withinBound).toBe(true);
    expect(r.lead?.status).toBe('closes');
    expect((r.lead?.lambda ?? 0) * bendLimit().deg).toBeCloseTo(2.53, 2);
  });

  /*
   * WHEREVER IT SITS ON THE FLOOR. The live site, in Chrome, said "the model
   * still leaves 0.8mm" for the layout above, which closes in Bun and Node:
   * a rounding difference picked another of many equally good linear answers
   * on each refinement. Moving the whole layout makes the same kind of
   * rounding difference here, so these positions stand in for other engines.
   *
   * MUTATION PROOF, run: the answer close to the last one not taken
   * (`nearAt` skipped): `expected [ …(4) ] to deeply equal []` under the
   * suite's Node, 4 of the 36 positions; under Bun it was 24.
   */
  it('closes wherever the layout sits on the floor', () => {
    const misses: string[] = [];
    for (const dx of [0, 1e-9, 1e-6, 0.001, 0.37, 10, 123.456, 1000, -77.7]) {
      for (const dy of [0, 1e-9, 0.5, 333.3]) {
        const g = owner(fixture.joins.length);
        const anchors = new Map([...g.anchors!].map(([id, f]) => {
          const pos = [...f.pos] as unknown as number[];
          pos[0]! += dx;
          pos[1]! += dy;
          return [id, { ...f, pos: pos as unknown as Frame['pos'] }];
        }));
        const r = solve({ ...g, anchors });
        if (!r.ok || r.lead?.status !== 'closes') misses.push(r.ok ? `${r.lead?.status}` : `${r.reason} ${r.detail}`);
      }
    }
    expect(misses).toEqual([]);
    // 36 full solves of a 60-piece layout: about 3s alone, 6s beside the suite.
  }, 30_000);

  it('the budget is 200M units of work', () => {
    expect(BEND_BUDGET.maxWork).toBe(200_000_000);
  });
});

describe('a solved run is never thrown away (OV-B)', () => {
  /*
   * Two loops with no joint in common, each the Q1 loop. Given exactly the
   * work the run's own solve needs, it is solved. The per-loop re-solves that
   * used to follow needed more, ran out, and turned this answer into
   * "unsolved".
   *
   * MUTATION PROOF, run: the per-loop re-solves put back after the run's
   * solve: `expected 'unsolved' to be 'solved'`.
   */
  it('two loops, given just the work their solve needs, come back solved', () => {
    const steps = (offset: number) =>
      Q1_LOOP.map((id, i) => ({ move: pieceMove(portsOf(getPart(id)), 0, 1), joint: offset + i, sign: 1 as const }));
    const two: BendRun = {
      joints: [...Q1_LOOP, ...Q1_LOOP].map(() => ({ limitRad: (2.7 * Math.PI) / 180, stretchMm: 2 })),
      loops: [steps(0), steps(Q1_LOOP.length)],
    };
    // The run's own solve costs 621,000 units (measured 2026-11-01). Fixed,
    // not read back from a solve, so work spent on anything else shows.
    const exact = solveBend(two, 1e9, 621_000);
    expect(exact.kind).toBe('solved');
    expect(exact.kind === 'solved' && exact.work).toBe(621_000);
  });
});

describe('the work cap is honest (OV-A, eng X1, X2)', () => {
  const q1: BendRun = {
    joints: Q1_LOOP.map(() => ({ limitRad: (2 * Math.PI) / 180, stretchMm: 2 })),
    loops: [Q1_LOOP.map((id, i) => ({ move: pieceMove(portsOf(getPart(id)), 0, 1), joint: i, sign: 1 as const }))],
  };
  // One sweep of the table: 3 rows, 2 variables a joint plus an artificial a row.
  const sweep = 3 * (2 * Q1_LOOP.length + 3);
  const full = solveBend(q1, 1e9, 1e12);

  it('a budget of zero, or too small to set the table up, spends nothing and says out of work', () => {
    for (const budget of [0, sweep - 1]) {
      const o = solveBend(q1, 1e9, budget);
      expect(o).toEqual({ kind: 'unsolved', why: 'out of work', work: 0 });
    }
  });

  /*
   * MUTATION PROOF, run: the old accounting put back (work charged only after
   * a pass succeeds, and an exhausted solve reporting `maxWork`): `expected
   * 22563 to be greater than or equal to 22600`, a solve cut short in a
   * refinement reporting only the work before it.
   */
  it('across every budget: never more than given, and a solve cut short reports nearly all of it', () => {
    expect(full.kind).toBe('solved');
    const total = full.kind === 'solved' ? full.work : 0;
    // The whole Q1 solve, linear pass and refinements, costs this much; fixed
    // here so a count that stops counting cannot shrink the range below.
    expect(total).toBeGreaterThan(60_000);
    expect(total).toBeLessThan(120_000);
    for (let budget = sweep; budget < total; budget += 200) {
      const o = solveBend(q1, 1e9, budget);
      const spent = o.kind === 'too-big' ? 0 : o.work;
      expect(spent).toBeLessThanOrEqual(budget);
      // Less than the whole solve was affordable, so it stopped short: every
      // sweep it could pay for was charged, and no more than one was left over.
      expect(spent).toBeGreaterThanOrEqual(budget - sweep);
    }
  });
});
