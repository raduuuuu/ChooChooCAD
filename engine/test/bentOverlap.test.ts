/**
 * PLANKS ARE CHECKED WHERE THE TRACK LIES (owner's layout, 2026-11-01).
 *
 * Value: protects=a layout that closes by bending its joints is not refused
 * as "track over track" for two pieces that cross only at catalogue angles
 * Value: fails_when=overlaps are found on the catalogue drawing alone again
 * when a run is bent, or on the bent drawing alone, which is not exact
 * around a crossing
 * Value: why_new=the owner's shared 79-piece layout read "Can't be built"
 * while closing with 2.6 degrees: two mini straights (pieces 71 and 79) cross
 * at catalogue angles and lie end to end, 3.4mm apart, bent
 * Value: seam=none (solveGraph as the app calls it)
 * Value: no_claim=an overlap the bending itself would cause is not found:
 * an overlap must appear at catalogue angles too, so this never refuses more
 * than the catalogue drawing alone did
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { brandFit } from '../data/thirdParty.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { bendRuns } from '../src/graph/bendRun.js';
import { bendLimit } from '../data/bendLimit.js';
import { portsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { findPlankOverlaps } from '../src/graph/overlap.js';
import { connectorSites } from '../src/graph/feasible.js';
import { renderGraph } from '../src/graph/render.js';
import { solveGraph } from '../src/graph/solve.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const fx = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'owner-crossing.json'), 'utf8'));
const graph: Graph = { pieces: fx.graph.pieces, welds: fx.graph.welds, anchors: new Map<string, Frame>(fx.graph.anchors) };
const placement = placeAll(graph, ports);
const render = renderGraph(graph, ports, resolve, placement);
const half = (id: string) => resolve(id).plankWidthMm / 2;

const solve = (g: Graph) => {
  const pl = placeAll(g, ports);
  const rd = renderGraph(g, ports, resolve, pl);
  const slop = new Map(g.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  return solveGraph(g, ports, resolve, (id) => slop.get(id) ?? 0, pl, { parts: BUILT_IN, brandFit }, rd.segments);
};

describe('a bent run is checked for overlaps where it lies', () => {
  it('the two mini straights do cross at catalogue angles (the case is real)', () => {
    const at = findPlankOverlaps(graph, render.segments, half, connectorSites(graph, ports, placement));
    expect(at.map((o) => [o.a, o.b])).toEqual([['p70', 'p78']]);
  });

  /*
   * MUTATION PROOF, run: solveGraph returning the catalogue `overlaps` in
   * place of the bent ones fails with `expected [ { a: 'p70', b: 'p78', …(2) } ]
   * to deeply equal []`.
   */
  it('bent, they do not, and the layout closes with bend', () => {
    const r = solve(graph);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.overlaps).toEqual([]);
    expect(r.lead?.status).toBe('closes');
  });
});

describe('the bent drawing alone does not refuse either', () => {
  /*
   * The interlocked fixture with four of its loose-end pairs joined closes
   * with bend. Its bent drawing, which moves each piece rigidly, puts planks
   * into each other around its two crossings (H1 into H2, an E into an A);
   * the catalogue keeps them apart. Found by scripts/verdictDiff.ts when
   * overlaps were first taken from the bent drawing alone.
   *
   * MUTATION PROOF, run: solveGraph returning the bent drawing's overlaps
   * unfiltered fails with `expected [ { a: 'p0', b: 'p1', …(2) }, …(2) ] to
   * deeply equal []`.
   */
  it('an overlap only the bent drawing has is not reported', () => {
    const ix = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'owner-interlocked.json'), 'utf8'));
    const g: Graph = { pieces: ix.base.pieces, welds: [...ix.base.welds, ...ix.joins.slice(0, 4)], anchors: new Map<string, Frame>(ix.base.anchors) };
    const r = solve(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.overlaps).toEqual([]);
    expect(r.lead?.status).toBe('closes');
  });
});

const joined: Graph = { ...graph, welds: [...graph.welds, { a: { pieceId: 'p70', port: 1 }, b: { pieceId: 'p78', port: 0 } }] };

describe('with its last two ends joined, it closes within the budget', () => {
  /*
   * Joining p70 to p78 makes an eighth loop, which needs about 350M units
   * (measured 2026-11-01). At the old 200M budget it ran out; at 650M it
   * closes.
   *
   * MUTATION PROOF, run: `maxWork` back to 200M fails with `expected false
   * to be true`.
   */
  it('closes, needing 2.6 degrees', () => {
    const r = solve(joined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead?.status).toBe('closes');
  });
});

describe('a check that runs out of work says so, not how near it got', () => {
  /*
   * The joined layout's one run, given less work than it needs. Before, a
   * refinement that ran out reported its leftover ("got within 0.6mm of
   * closing" at the old 200M), a figure from where the solve stopped. Two
   * places can run out mid-refinement: the bisection, and the step that
   * keeps an answer close to the last one. When the second runs out, the
   * last pass's answer stands, and here it had already settled (found at
   * 350M with every stretch 0.8mm).
   *
   * MUTATION PROOF, run: `cutShort` ignored in `solveRun` fails with
   * `expected 'the model still leaves 0.6mm' to be 'out of work'`; the close
   * step's running out ignored (the far answer taken) fails with the sweep
   * below listing the leftovers it reports.
   */
  const pl = placeAll(joined, ports);
  const rs = residuals(joined, ports, pl);
  const byId = new Map(joined.pieces.map((p) => [p.pieceId, p]));
  const run = (maxWork: number, stretch: (id: string) => number) =>
    bendRuns(joined, pl, rs, (id) => ports(byId.get(id)!), (id) => ({ limitRad: (bendLimit().deg * Math.PI) / 180, stretchMm: stretch(id) }), {
      maxCells: 2_000_000,
      maxWork,
    })[0]!;

  it('out of work in the bisection', () => {
    const r = run(200_000_000, (id) => resolve(byId.get(id)!.partId).slop.axialMm);
    expect(r.status).toBe('unchecked');
    expect(r.why).toBe('out of work');
  });

  /*
   * Where the close step runs out moves with the last digit of Math.hypot
   * (Bun and Node differ there), so this sweeps the budgets around it. No
   * budget may report a leftover: a run either closes or says it ran out.
   */
  it('out of work keeping the answer close: never a leftover from where it stopped', () => {
    const leftovers: string[] = [];
    // Measured windows: 0.8mm at 347-349M (Node) or 348-351M (Bun), 1.5mm
    // at 352-357M (Node) or 353-357M (Bun).
    for (const stretch of [0.8, 1.5]) {
      for (let m = 345; m <= 360; m += 1) {
        const r = run(m * 1_000_000, () => stretch);
        if (r.why?.startsWith('the model still leaves')) leftovers.push(`${stretch}mm at ${m}M: ${r.why}`);
      }
    }
    expect(leftovers).toEqual([]);
  }, 60_000);
});
