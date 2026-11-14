import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { add, fromInt, scale, zetaPow } from '../../engine/src/geom/cyclotomic.js';
import { removePiece } from '../../engine/src/graph/edit.js';
import { FILL_BUDGET } from '../../engine/src/graph/fill.js';
import { portsOf, type Frame, type Graph, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { applyFill, findFills, MAX_FILL_CHECKS, weldBetween, type Fill, type FillRequest } from './finishLoop.js';
import type { Inventory } from './inventoryModel.js';
import { addPiece, EMPTY_GRAPH } from './layoutModel.js';
import { presetByLabel, PRESETS } from './presets.js';
import { presetGraph, verdictKind } from './presetVerdict.js';

/*
 * THE FILLS WORTH SHOWING (plan 2026-11-14, E3). Each pin names the change
 * that fails it, and each was run.
 *
 * The property test uses the ready layouts that close, not the 670-layout
 * corpus the plan named: that corpus is random chains, of which two close
 * exactly, and both are ready layouts.
 */

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const request = (graph: Graph, from: PortRef, to: PortRef, inventory: Inventory = null): FillRequest => ({
  graph,
  ports,
  resolve,
  parts: BUILT_IN,
  brandFit,
  inventory,
  from,
  to,
});
const idsOf = (fill: Fill) => fill.pieces.map((p) => p.partId);

/** A ready layout with `count` pieces in a row taken out, and the two ends that leaves. */
function gapIn(label: string, start: number, count: number): { graph: Graph; from: PortRef; to: PortRef; taken: string[] } {
  const whole = presetGraph(presetByLabel(label));
  const n = whole.pieces.length;
  const out = Array.from({ length: count }, (_, i) => whole.pieces[(start + i) % n]!);
  let graph = whole;
  for (const piece of out) graph = removePiece(graph, ports, piece.pieceId);
  // A preset is one run, each piece joined by its end 0 to the last piece's end 1.
  const from = { pieceId: whole.pieces[(start - 1 + n) % n]!.pieceId, port: 1 };
  const to = { pieceId: whole.pieces[(start + count) % n]!.pieceId, port: 0 };
  return { graph, from, to, taken: out.map((p) => p.partId) };
}

/** A loose piece put down at an exact place: `x` along the axis, `y` across it, pointing `heading` sixteenths round. */
function loose(graph: Graph, partId: string, x: number, y: number, heading: number): Graph {
  const anchor: Frame = { pos: add(fromInt(x), scale(zetaPow(4), y)), heading };
  return addPiece(graph, partId, 'left', 2, null, ports, undefined, anchor).graph;
}

/** Two medium straights on the axis, `gapMm` apart, far from the origin. The first ends at x = 2144. */
function twoRuns(base: Graph = EMPTY_GRAPH, gapMm = 144): { graph: Graph; from: PortRef; to: PortRef } {
  const one = loose(base, 'A', 2000, 0, 0);
  const two = loose(one, 'A', 2144 + gapMm, 0, 0);
  const [a, b] = two.pieces.slice(-2);
  return { graph: two, from: { pieceId: a!.pieceId, port: 1 }, to: { pieceId: b!.pieceId, port: 0 } };
}

describe('findFills', () => {
  /*
   * THE PROPERTY. Take one to four pieces in a row out of a layout that
   * closes: what was taken out is a fill, so one of at most that many pieces
   * must come back, and the layout with it in must close exactly again.
   *
   * Fails when: the search misses a fill (its reach bound made too tight,
   * `(left - 1) * maxReach` to `(left - 2) * maxReach`: curved gaps are then
   * cut off and report none), or `applyFill` lets `addPiece` choose which
   * way a piece goes on (its `choice` argument dropped: a curve the search
   * placed right-handed then goes on left-handed and the layout no longer
   * closes). Both run.
   */
  it('puts back what was taken out of a layout that closes, in no more pieces', () => {
    for (const preset of PRESETS.filter((p) => p.expect === 'exact')) {
      const n = preset.pieces.length;
      for (let count = 1; count <= 4; count++) {
        for (const start of [0, 1, Math.floor(n / 2), n - 1]) {
          const gap = gapIn(preset.label, start, count);
          const answer = findFills(request(gap.graph, gap.from, gap.to));
          const where = `${preset.label}, ${count} out from ${start} (${gap.taken.join(' ')})`;
          expect(answer.status, where).toBe('found');
          if (answer.status !== 'found') continue;
          expect(answer.fills[0]!.pieces.length, where).toBeLessThanOrEqual(count);
          for (const fill of answer.fills) expect(verdictKind(fill.graph), where).toBe('EXACT');
        }
      }
    }
  });

  /*
   * A WELDED LOOP THAT MISSES. Near miss is joined end to end by a weld
   * across a 72mm gap. The fill goes where that weld was.
   *
   * Fails when: `applyFill` leaves the old weld in (the `removeWeld` step
   * skipped): the end the first piece goes on is then still taken, so no
   * fill can be put down. Run.
   */
  it('closes a welded loop that misses by replacing its closing weld', () => {
    const graph = presetGraph(presetByLabel('Near miss'));
    const closing = graph.welds[graph.welds.length - 1]!;
    const answer = findFills(request(graph, closing.a, closing.b));
    expect(answer.status).toBe('found');
    if (answer.status !== 'found') return;
    const fill = answer.fills[0]!;
    expect(fill.replacesWeld).toBe(true);
    expect(idsOf(fill)).toEqual(['A3']);
    expect(resolve('A3').kind === 'straight' && (resolve('A3') as { lengthMm: number }).lengthMm).toBe(72);
    expect(weldBetween(fill.graph, closing.a, closing.b)).toBe(-1);
    expect(verdictKind(fill.graph)).toBe('EXACT');
  });

  /*
   * ONE TRANSACTION. What the `fill` action will place is what was checked.
   *
   * Fails when: the layout a Fill records is not `applyFill`'s result for its
   * own plan (`graph: applied.graph` replaced by the layout before the fill).
   * Run. It cannot catch `applyFill` itself placing a piece wrongly, since
   * both sides would agree; the property test above catches that.
   */
  it('applying a fill again gives exactly the layout that was checked', () => {
    for (const [label, start, count] of [['Bean', 4, 3], ['Stadium', 3, 3], ['Near miss', -1, 0]] as const) {
      const graph = start === -1 ? presetGraph(presetByLabel(label)) : gapIn(label, start, count).graph;
      const ends = start === -1 ? graph.welds[graph.welds.length - 1]! : null;
      const gap = start === -1 ? { from: ends!.a, to: ends!.b } : gapIn(label, start, count);
      const answer = findFills(request(graph, gap.from, gap.to));
      expect(answer.status, label).toBe('found');
      if (answer.status !== 'found') continue;
      for (const fill of answer.fills) {
        const again = applyFill(graph, ports, fill);
        expect(again?.graph, label).toEqual(fill.graph);
        expect(again?.pieceIds).toEqual(fill.pieceIds);
      }
    }
  });

  /*
   * Fails when: a stale plan is applied anyway (`applyFill` returning the
   * graph it has when a step does not attach, in place of null): the pieces
   * would land as a loose run beside the layout. Run.
   */
  it('applies nothing when the layout is no longer the one the fill was found for', () => {
    const gap = gapIn('Stadium', 4, 1);
    const answer = findFills(request(gap.graph, gap.from, gap.to));
    expect(answer.status).toBe('found');
    if (answer.status !== 'found') return;
    // Someone else's piece takes the end first.
    const taken = addPiece(gap.graph, 'A', 'left', 2, gap.from, ports).graph;
    expect(applyFill(taken, ports, answer.fills[0]!)).toBe(null);
    // And a weld that was to be replaced is already gone.
    const near = presetGraph(presetByLabel('Near miss'));
    const closing = near.welds[near.welds.length - 1]!;
    const forWeld = findFills(request(near, closing.a, closing.b));
    expect(forWeld.status).toBe('found');
    if (forWeld.status !== 'found') return;
    const broken = { ...near, welds: near.welds.slice(0, -1) };
    expect(applyFill(broken, ports, forWeld.fills[0]!)).toBe(null);
  });

  /*
   * Fails when: two runs joined into one longer run are refused for making
   * no loop (`after.reason === 'NO_CYCLE'` in `keeps` replaced by `false`). Run.
   */
  it('joins two separate runs, which makes no loop and is still a fill', () => {
    const { graph, from, to } = twoRuns();
    const answer = findFills(request(graph, from, to));
    expect(answer.status).toBe('found');
    if (answer.status !== 'found') return;
    expect(idsOf(answer.fills[0]!)).toEqual(['A']);
  });

  /*
   * BESIDE A LOOP THAT NEEDS GIVE (eng review, finding 3). The whole layout's
   * verdict is "closes with the joints' give" before and after; a rule that
   * asked for the whole layout to read "closes exactly" would drop this fill.
   *
   * Fails when: `keeps` asks `after.closesExactly` of the whole layout in
   * place of rule 1's own loops. Run.
   */
  it('offers a fill beside another loop that closes only with give', () => {
    const near = presetGraph(presetByLabel('Near miss'));
    expect(verdictKind(near)).toBe('NEEDS_GIVE');
    const { graph, from, to } = twoRuns(near);
    const answer = findFills(request(graph, from, to));
    expect(answer.status).toBe('found');
    if (answer.status !== 'found') return;
    expect(verdictKind(answer.fills[0]!.graph)).toBe('NEEDS_GIVE');
  });

  /*
   * THE BOX COVERS THE WHOLE LAYOUT WITH THE FILL (finding 4). The stadium
   * with one long straight out still holds the other; a box with one long
   * straight has none left for the gap.
   *
   * Fails when: the stock ignores what the layout already uses (`- (used[partId]
   * ?? 0)` removed): the long straight the box no longer has is suggested. Run.
   */
  it('counts what the layout already uses against the box', () => {
    const gap = gapIn('Stadium', 4, 1);
    const box = { E: 8, D: 1, A1: 2, A: 5, A3: 5 };
    const answer = findFills(request(gap.graph, gap.from, gap.to, box));
    expect(answer.status).toBe('found');
    if (answer.status !== 'found') return;
    for (const fill of answer.fills) expect(idsOf(fill)).not.toContain('D');
    expect(answer.fills.map(idsOf)).toContainEqual(['A1', 'A1']);
    // With a second long straight in the box, it is the first suggestion again.
    const more = findFills(request(gap.graph, gap.from, gap.to, { ...box, D: 2 }));
    expect(more.status === 'found' && idsOf(more.fills[0]!)).toEqual(['D']);
    // And a box with nothing spare has nothing to offer: a finished search, not a failed one.
    expect(findFills(request(gap.graph, gap.from, gap.to, { E: 8, D: 1 }))).toEqual({ status: 'none' });
  });

  /*
   * Fails when: pieces of a system that does not join the table's are
   * offered (the `brandFit` filter removed): with a lookup that says nothing
   * joins, there must be nothing to suggest. Run.
   */
  it('suggests no piece of a system that does not join what is on the table', () => {
    const gap = gapIn('Stadium', 4, 1);
    const apart = { ...request(gap.graph, gap.from, gap.to), brandFit: () => ({ fit: 'does-not-join' as const, why: '' }) };
    expect(findFills(apart as unknown as FillRequest)).toEqual({ status: 'none' });
  });

  /*
   * Fails when: ends on two levels are searched as if on one (the level
   * check removed): a ramp's two ends are 216mm apart on the plan and a long
   * straight "fits", through the air. Run.
   */
  it('refuses ends on two levels, and an end against itself', () => {
    const ramp = addPiece(EMPTY_GRAPH, 'N', 'left', 2, null, ports).graph;
    const id = ramp.pieces[0]!.pieceId;
    expect(findFills(request(ramp, { pieceId: id, port: 0 }, { pieceId: id, port: 1 }))).toEqual({
      status: 'refused',
      why: 'levels',
    });
    expect(findFills(request(ramp, { pieceId: id, port: 0 }, { pieceId: id, port: 0 }))).toEqual({
      status: 'refused',
      why: 'same end',
    });
  });

  /*
   * NOTHING OF A FILL LIES ON OTHER TRACK, AND THE CHECKS ARE COUNTED (rule 2,
   * finding 5). A long straight lies across the gap between the two runs, so
   * every fill that lands also crosses it, and each costs a full check to
   * find that out. After `MAX_FILL_CHECKS` the search stops and says it ran
   * out; it does not say nothing fits.
   *
   * Fails when: rule 2 is removed from `keeps` (a fill across the long
   * straight is then offered), or the count of checks is not enforced (the
   * answer becomes 'none' after every candidate was solved). Both run.
   */
  it('offers nothing that crosses other track, and stops after a fixed number of checks', () => {
    // A 216mm gap has more ways across than there are checks: one long straight, two short, and so on.
    const { graph, from, to } = twoRuns(EMPTY_GRAPH, 216);
    const open = findFills(request(graph, from, to));
    expect(open.status === 'found' && open.fills.length).toBe(3);
    // The same gap with a long straight lying across its middle.
    const blocked = loose(graph, 'D', 2252, -108, 4);
    expect(findFills(request(blocked, from, to))).toEqual({ status: 'out of work' });
    // A 144mm gap has two ways across, fewer than the checks allowed: both cross, and the search FINISHES.
    const small = twoRuns();
    expect(findFills(request(loose(small.graph, 'D', 2216, -108, 4), small.from, small.to))).toEqual({ status: 'none' });
    expect(MAX_FILL_CHECKS).toBe(6);
  });

  /*
   * THE SEARCH'S OWN WORK IS SMALL AND THE SAME EVERY RUN. Counted in units,
   * not milliseconds, so the pin is the same on every machine.
   *
   * Fails when: the reach bound is removed (every option is then tried at
   * every depth and this gap spends more than a tenth of the allowance). Run.
   */
  it('spends a small, fixed share of the work allowance on an ordinary gap', () => {
    const gap = gapIn('Dog bone', 5, 4);
    const work = { left: FILL_BUDGET };
    expect(findFills(request(gap.graph, gap.from, gap.to), work).status).toBe('found');
    const spent = FILL_BUDGET - work.left;
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThan(FILL_BUDGET / 10);
    const again = { left: FILL_BUDGET };
    findFills(request(gap.graph, gap.from, gap.to), again);
    expect(again.left).toBe(work.left);
  });

  it('says it ran out when the work allowance is too small to look', () => {
    const gap = gapIn('Stadium', 3, 3);
    expect(findFills(request(gap.graph, gap.from, gap.to), { left: 2 })).toEqual({ status: 'out of work' });
  });
});
