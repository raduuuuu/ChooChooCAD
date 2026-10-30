/**
 * THE GAP IS NAMED IN PIECES ONLY WHEN ONE PIECE EXACTLY CLOSES IT (task X6).
 *
 * Value: protects=a verdict saying "one Middle straight short" is said only
 * when adding (or removing) that one straight closes the one failing loop
 * exactly, and the word short or too long is the one that is true
 * Value: fails_when=the exact lattice test is loosened to a magnitude or a
 * tolerance, the length or direction half of it is dropped, the walk only
 * looks at the closing joint, the sign is flipped, two failing loops get one
 * suggestion, or a part not documented to join is suggested
 * Value: why_new=the feature is new; nothing named a piece before
 * Value: seam=`solveGraph` takes an optional library and returns `repair`
 * on its ok branch; these specs drive it with the real catalogue
 * Value: no_claim=the one-closing-weld and not-shared guards are not
 * exercised: both need loops that share pieces, which only a switch can
 * build, and no fixture here does. The peg-and-socket filter is not
 * exercised either: on today's catalogue the two-peg and two-socket
 * straights sort after A2, so dropping the filter changes no answer
 *
 * THE PLAN'S THREE SPECS ARE 1-3 BELOW, with one change. Spec 3 asked for a
 * non-collinear gap "of any magnitude" and its fixture `A2 E:left E:right`
 * is not a loop on the graph path. A non-collinear gap of irrational length
 * cannot fail under the mutation the plan names, because no float shortcut
 * would match a catalogue length either. So this uses a loop found by
 * search whose gap is non-collinear AND within 0.03mm of 54: a tolerant
 * comparison would name an A2 there, and only the exact test refuses.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { brandFit } from '../data/thirdParty.js';
import { placeAll, residuals } from '../src/graph/frames.js';
import { analyseCycles } from '../src/graph/cycles.js';
import { pieceRepair } from '../src/graph/repair.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece } from '../src/graph/model.js';
import { solveGraph } from '../src/graph/solve.js';
import type { Part, Turn } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const slop = (g: Graph) => (id: string) =>
  resolve(g.pieces.find((p) => p.pieceId === id)!.partId).slop.axialMm;

const loop = (ids: readonly string[], turn: Turn = 'left'): Graph =>
  graphFromChain({ placements: ids.map((partId) => ({ partId, turn })), closed: true });

const solve = (g: Graph) => solveGraph(g, ports, resolve, slop(g), placeAll(g, ports), { parts: BUILT_IN, brandFit });

/*
 * THE REPAIR'S GEOMETRY, apart from the bend that triggers it.
 *
 * `pieceRepair` speaks only for loops that read "beyond" (eng review D3), and
 * whether a loop does depends on the bend limit, which is inferred from the
 * floor and will move. These specs are about the other half, which never
 * moves: whether one straight closes a loop EXACTLY. So each loop with a gap
 * is marked beyond here, and the repair's geometry is tested on its own; the
 * wiring through solveGraph is pinned once, below, on a loop that really is
 * beyond.
 */
const exceeds = (g: Graph) => {
  const place = placeAll(g, ports);
  const rs = residuals(g, ports, place);
  const space = analyseCycles(g, place, rs);
  const cycles = space.cycles.map((c) => ({ ...c, standaloneLambda: c.gapMm === 0 ? 0 : 2 }));
  return { residuals: rs, cycles, repair: pieceRepair(g, ports, place, rs, cycles, resolve, { parts: BUILT_IN, brandFit }) };
};

const E4 = ['E', 'E', 'E', 'E'];

describe('the gap in pieces', () => {
  /*
   * SPEC 1. Q1, the Near-miss loop: 216 on one side, 144 on the other.
   *
   * MUTATION PROOF, run: delete the short loop from `pieceRepair`. Fails
   * with `expected null not to be null`. (Flipping the short test's SIGN does
   * NOT fail this spec, and why is recorded at the ground-truth spec below,
   * which is the one that catches it.)
   */
  it('names one Middle straight short for the Q1 loop', () => {
    const r = exceeds(loop([...E4, 'D', ...E4, 'A']));
    expect(r.residuals[0]!.gapMm).toBeCloseTo(72, 9);
    expect(r.repair).not.toBeNull();
    expect(r.repair!.direction).toBe('short');
    expect(r.repair!.part.id).toBe('A3');
    // A3 is the one BRIO straight with no part number.
    expect(r.repair!.partNumber).toBeNull();
  });

  /*
   * The same loop, closed between two curves. The closing joint now points
   * at 90 degrees, so no straight can go in THERE; the walk has to find the
   * joints on the straights.
   *
   * MUTATION PROOF, run: in `pieceRepair`, test only the closing joint
   * (`steps.slice(-1)` in the short loop). Fails with `expected null not to
   * be null`.
   */
  it('finds the joint that points the right way, not just the closing one', () => {
    const r = exceeds(loop(['E', 'E', 'D', ...E4, 'A', 'E', 'E']));
    expect(r.repair?.direction).toBe('short');
    expect(r.repair?.part.id).toBe('A3');
  });

  /*
   * SPEC 2. A collinear gap of 162mm, which is no catalogue straight.
   *
   * MUTATION PROOF, run: drop the length half of the test, comparing against
   * the gap's own magnitude (`along(s.heading, r.gapMm)`). Fails with
   * `expected { direction: 'short', …(2) } to be null`.
   */
  it('says nothing for a collinear gap no single straight matches', () => {
    const r = exceeds(loop([...E4, 'D', ...E4, 'A2']));
    expect(r.residuals[0]!.gap).toEqual([162, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.repair).toBeNull();
  });

  /*
   * SPEC 3. A non-collinear gap within 0.03mm of an A2.
   *
   * MUTATION PROOF, run: replace the exact test with
   * `Math.abs(r.gapMm - p.lengthMm) < 0.5`. Fails with `expected {
   * direction: 'short', …(2) } to be null`.
   */
  it('says nothing for a non-collinear gap, however close to a catalogue length', () => {
    const r = exceeds(loop(['E1', 'A2', 'E1', 'A3', 'E1', 'E', 'E', 'E', 'E', 'E']));
    const gap = r.residuals[0]!;
    expect(gap.gap.filter((c) => c !== 0).length).toBeGreaterThan(1);
    expect(Math.abs(gap.gapMm - 54)).toBeLessThan(0.03);
    expect(r.repair).toBeNull();
  });

  /*
   * TOO LONG. An extra Middle straight on one side. Adding a twin on the
   * other side would also close it; taking out the one already there needs
   * nothing bought, so that is what is said.
   *
   * MUTATION PROOF, run: delete the too-long loop from `pieceRepair`. Fails
   * with `expected 'short' to be 'long'`.
   */
  it('names a straight in the loop as one too long when removing it closes the loop', () => {
    const r = exceeds(loop([...E4, 'D', 'A3', ...E4, 'D']));
    expect(r.repair?.direction).toBe('long');
    expect(r.repair?.part.id).toBe('A3');
  });

  /* The part number appears when it identifies one part. */
  it('carries a part number only when no other part shares it', () => {
    expect(exceeds(loop([...E4, 'D', ...E4, 'A1'])).repair?.partNumber).toBe('33334');
    // A2, B2 and C2 all carry 33333, so a 54mm suggestion names no number.
    const r = exceeds(loop([...E4, 'D', ...E4, 'A1', 'A2']));
    expect(r.repair?.part.id).toBe('A2');
    expect(r.repair?.partNumber).toBeNull();
  });

  /*
   * Two separate Near-miss loops on the table. Each needs a Middle straight,
   * so "one Middle straight short" would be false about the layout.
   *
   * MUTATION PROOF, run: replace the `failing.length !== 1` guard with
   * `failing.length === 0`. Fails with `expected { direction: 'short', …(2) }
   * to be null`.
   */
  it('says nothing when more than one loop fails', () => {
    const one = loop([...E4, 'D', ...E4, 'A']);
    const two: Graph = {
      pieces: [...one.pieces, ...one.pieces.map((p) => ({ ...p, pieceId: `q${p.pieceId}` }))],
      welds: [
        ...one.welds,
        ...one.welds.map((w) => ({
          a: { ...w.a, pieceId: `q${w.a.pieceId}` },
          b: { ...w.b, pieceId: `q${w.b.pieceId}` },
        })),
      ],
      anchors: new Map([['qp0', { pos: [2000, 0, 0, 0, 0, 0, 0, 0] as never, heading: 0 }]]),
    };
    const r = exceeds(two);
    expect(r.cycles.filter((c) => (c.standaloneLambda ?? 0) > 1)).toHaveLength(2);
    expect(r.repair).toBeNull();
  });

  /*
   * A BRIO-and-Playtive loop 60mm short, where PLAYTIVE-60 is exactly 60mm.
   * BRIO-to-Playtive is 'unknown', not 'joins', so nothing is suggested.
   *
   * MUTATION PROOF, run: delete the `brandFit` filter in `pieceRepair`.
   * Fails with `expected { direction: 'short', …(2) } to be null`.
   */
  it('suggests no part that is not documented to join the track already there', () => {
    const r = exceeds(loop([...E4, 'PLAYTIVE-200', ...E4, 'PLAYTIVE-110', 'PLAYTIVE-30']));
    expect(r.residuals[0]!.gap).toEqual([60, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.repair).toBeNull();
  });

  /*
   * EVERY CLAIM IS CHECKED BY BUILDING IT. For each loop that gets a
   * suggestion, actually insert the named straight at every position (or take
   * it out wherever it appears) and solve again: some version must close
   * exactly. This is the only spec that can see the SIGN of the short test.
   * On loops built from 45-degree pieces, every even heading is visited by
   * some joint, so a joint at t+8 always exists beside one at t, and a
   * flipped sign still names the right piece by accident. A 22.5-degree
   * curve breaks that symmetry, so the sample includes one, declared here as
   * a test part that claims nothing about real track.
   *
   * MUTATION PROOF, run: flip the sign of the short test (`along(s.heading,
   * -p.lengthMm)`). Fails with `expected [ …(2) ] to deeply equal []`: the
   * two pinned loops, each told it is one straight short when no insertion
   * of that straight closes it.
   */
  it('every piece named really does close the loop when added or removed', () => {
    const E = BUILT_IN.find((p) => p.id === 'E')!;
    const C1 = { ...E, id: 'TEST-C1', name: 'Test 22.5 curve', arcSteps: 1 } as Part;
    const parts = [...BUILT_IN, C1];
    const res = makeResolver(parts);
    const portsC = (p: Piece) => portsOf(res(p.partId), p.turn);
    const solveIds = (ids: readonly string[]) => {
      const g = loop(ids);
      return solveGraph(g, portsC, res, () => 0.8, placeAll(g, portsC), { parts, brandFit });
    };
    const closes = (ids: readonly string[]) => {
      const r = solveIds(ids);
      return r.ok && r.closesExactly;
    };

    let seed = 11;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const pool = ['E', 'E', 'E', 'TEST-C1', 'TEST-C1', 'A2', 'A3', 'A1', 'A', 'D'];
    const sample = Array.from({ length: 6000 }, () =>
      Array.from({ length: 6 + Math.floor(rand() * 10) }, () => pool[Math.floor(rand() * pool.length)]!),
    );
    // The two loops a flipped sign gets wrong, pinned so the sample cannot drift past them.
    sample.push(
      'E TEST-C1 E E A2 A2 E E TEST-C1 E E'.split(' '),
      'A3 A E TEST-C1 E E E E E TEST-C1 E'.split(' '),
    );

    let named = 0;
    const wrong: string[] = [];
    for (const ids of sample) {
      const r = solveIds(ids);
      if (!r.ok || !r.repair) continue;
      named++;
      const id = r.repair.part.id;
      const holds =
        r.repair.direction === 'short'
          ? ids.some((_, k) => closes([...ids.slice(0, k), id, ...ids.slice(k)])) ||
            closes([...ids, id])
          : ids.some((x, k) => x === id && closes([...ids.slice(0, k), ...ids.slice(k + 1)]));
      if (!holds) wrong.push(`${r.repair.direction} ${id}: ${ids.join(' ')}`);
    }
    // The sample must actually exercise the claim, or this proves nothing.
    expect(named).toBeGreaterThan(2);
    expect(wrong).toEqual([]);
  });

  /*
   * THE WIRING. A Q1-shaped loop on SHORT curves (E1) has the same 72mm gap
   * but a much shorter lever, so its joints would have to turn about 4.6
   * degrees: beyond the tested bend, and the one loop that is, so solveGraph
   * names the straight.
   *
   * MUTATION PROOF, run: `failing.length !== 1` guard in pieceRepair changed
   * to `failing.length !== 2` fails with `expected null not to be null`.
   */
  it('solveGraph names the straight for a loop beyond the bend', () => {
    const E1x4 = ['E1', 'E1', 'E1', 'E1'];
    const g = loop([...E1x4, 'D', ...E1x4, 'A']);
    const r = solve(g);
    if (!r.ok) throw new Error(`expected a solved layout, got ${r.reason}`);
    expect(r.withinBound).toBe(false);
    expect(r.lead?.status).toBe('beyond');
    expect(r.repair).not.toBeNull();
    expect(r.repair!.part.id).toBe('A3');
  });

  it('says nothing when the caller gives no library', () => {
    const g = loop([...E4, 'D', ...E4, 'A']);
    const r = solveGraph(g, ports, resolve, slop(g), placeAll(g, ports));
    expect(r.ok && r.repair).toBeNull();
  });
});
