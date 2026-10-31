/**
 * THE BUILD AS ONE LIST (build mode plan: scope items 2, 3 and 9; CEO D7,
 * D9, D14-D16; eng D20).
 *
 * Value: protects=build mode and the sheet get every piece once in assembly
 * order, a card at each band change, the end each piece clips onto, the
 * adapter step, and the run's note at the step that closes its last loop
 * Value: fails_when=loop closing falls back to counting joins, the note
 * lands on the first loop or the wrong run, an unchecked result stays
 * silent, or a band change gets no card
 * Value: why_new=assemblyOrder had no reader
 * Value: seam=`lastClosers` is exported and run on a hand-written order,
 * because assemblyOrder never lays a piece that bridges two separate groups
 * on a small fixture; the verdict is built by hand, holding only the fields
 * a build reads
 * Value: no_claim=that solveGraph's statuses are right (its own suites), or
 * how the screen words a note
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import type { RunBend } from '../src/graph/bendRun.js';
import { buildSteps, lastClosers, type BuildItem, type BuildVerdict } from '../src/graph/buildSteps.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port, type Weld } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const segmentsOf = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports)).segments;

/** A chain of parts, port 1 to port 0, closed back to the first when `loop`. */
function chain(partIds: readonly string[], loop: boolean): Graph {
  const pieces: Piece[] = partIds.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' }));
  const welds: Weld[] = [];
  for (let i = 0; i < partIds.length - (loop ? 0 : 1); i++) {
    welds.push({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${(i + 1) % partIds.length}`, port: 0 } });
  }
  return { pieces, welds };
}

/** Up a ramp, a raised half circle, down a ramp entered at its high end (assembly.test.ts). */
function stadium(): Graph {
  const parts: [string, 0 | 1][] = [
    ['E', 0], ['E', 0], ['E', 0], ['E', 0], ['N', 0],
    ['E', 0], ['E', 0], ['E', 0], ['E', 0], ['N', 1],
  ];
  const pieces: Piece[] = parts.map(([partId], i) => ({ pieceId: `p${i}`, partId, turn: 'left' }));
  const welds: Weld[] = parts.map((_, i) => {
    const j = (i + 1) % parts.length;
    return { a: { pieceId: `p${i}`, port: 1 - parts[i]![1] }, b: { pieceId: `p${j}`, port: parts[j]![1] } };
  });
  return { pieces, welds };
}

const run = (pieces: readonly string[], status: RunBend['status'], lambda: number | null = 0.4) =>
  ({ pieces, status, lambda, why: status === 'unchecked' ? 'a loop could not be followed round' : null }) as unknown as RunBend;
const okVerdict = (bend: RunBend[], adapterWelds: number[] = []): BuildVerdict => ({
  ok: true,
  bend,
  adapterJoints: adapterWelds.map((weld) => ({ weld, between: ['', ''] as const })),
});

const pieceSteps = (items: readonly BuildItem[]) => items.filter((i): i is Extract<BuildItem, { kind: 'piece' }> => i.kind === 'piece');
const noted = (items: readonly BuildItem[]) => pieceSteps(items).filter((s) => s.note !== null);

describe('the list', () => {
  it('a one-piece layout is pull list, step 1, last', () => {
    const g = chain(['A'], false);
    const items = buildSteps(g, segmentsOf(g), okVerdict([]));
    expect(items.map((i) => i.kind)).toEqual(['pull', 'piece', 'last']);
    expect(items[2]).toEqual({ kind: 'last', pieces: 1 });
  });

  /*
   * MUTATION PROOF, run: the card condition never true (`band !== null &&
   * b !== band && false`): `expected [ 'pull', 'piece', 'piece', …(9) ] to
   * deeply equal [ 'pull', 'piece', 'piece', …(11) ]`.
   */
  it('a two-level layout gets a card before each new band, never before the first, and every piece once', () => {
    const g = stadium();
    const items = buildSteps(g, segmentsOf(g), okVerdict([run(g.pieces.map((p) => p.pieceId), 'exact', 0)]));
    const kinds = items.map((i) => (i.kind === 'piece' ? 'piece' : i.kind));
    // Floor (4), card, ramps (2), card, raised (4).
    expect(kinds).toEqual(['pull', 'piece', 'piece', 'piece', 'piece', 'band', 'piece', 'piece', 'band', 'piece', 'piece', 'piece', 'piece', 'last']);
    const cards = items.filter((i) => i.kind === 'band');
    expect(cards).toEqual([
      { kind: 'band', band: 1, phase: 'ramp', level: 0 },
      { kind: 'band', band: 2, phase: 'raised', level: 1 },
    ]);
    const steps = pieceSteps(items);
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(steps.map((s) => s.pieceId)).size).toBe(10);
  });

  it('each piece names the ends already down that it clips onto, and the first piece none', () => {
    const g = chain(['A', 'A', 'A'], false);
    const steps = pieceSteps(buildSteps(g, segmentsOf(g), okVerdict([])));
    expect(steps[0]!.onto).toEqual([]);
    for (const s of steps.slice(1)) expect(s.onto).toHaveLength(1);
    // The end on the piece already down, not the new piece's own.
    const second = steps[1]!;
    expect(second.onto[0]!.pieceId).not.toBe(second.pieceId);
  });

  /*
   * MUTATION PROOF, run: `if (adapterWelds.has(wi)) adapter = true` removed:
   * `expected [] to deeply equal [ 2 ]`.
   */
  it('the step that seats a socket-to-socket joint says an adapter goes in first (D16)', () => {
    const g = chain(['A', 'A', 'A'], false);
    const steps = pieceSteps(buildSteps(g, segmentsOf(g), okVerdict([], [0])));
    expect(steps.filter((s) => s.adapter).map((s) => s.step)).toEqual([2]);
  });
});

describe('where a run speaks (D7, D9, D14, D15)', () => {
  const circle = () => chain(Array(8).fill('E'), true);

  /*
   * MUTATION PROOF, run: `noteFor` returns null for 'closes' (the `bends`
   * line removed): `expected [] to have a length of 1 but got +0`.
   */
  it('a loop that closes by bending: one note, at the last piece of the loop', () => {
    const g = circle();
    const items = buildSteps(g, segmentsOf(g), okVerdict([run(g.pieces.map((p) => p.pieceId), 'closes', 0.6)]));
    const n = noted(items);
    expect(n).toHaveLength(1);
    expect(n[0]!.step).toBe(8);
    expect(n[0]!.note!.kind).toBe('bends');
  });

  it('an exact loop says nothing', () => {
    const g = circle();
    expect(noted(buildSteps(g, segmentsOf(g), okVerdict([run(g.pieces.map((p) => p.pieceId), 'exact', 0)])))).toEqual([]);
  });

  it('a run beyond its joints carries the run itself, for the verdict to word (D14)', () => {
    const g = circle();
    const r = run(g.pieces.map((p) => p.pieceId), 'beyond', 1.7);
    const n = noted(buildSteps(g, segmentsOf(g), okVerdict([r])));
    expect(n.map((s) => s.note)).toEqual([{ kind: 'beyond', run: r }]);
  });

  /*
   * MUTATION PROOF, run: the `!verdict.ok` line removed from `noteFor` (it
   * then reads `verdict.bend` of a failed result): `TypeError: Cannot read
   * properties of undefined (reading 'find')`.
   */
  it('when the verdict failed there are no run statuses: every loop is unchecked, with the detail (D9)', () => {
    const g = circle();
    const verdict: BuildVerdict = { ok: false, detail: 'Too many loops to check.', adapterJoints: [] };
    const n = noted(buildSteps(g, segmentsOf(g), verdict));
    expect(n.map((s) => s.note)).toEqual([{ kind: 'unchecked', reason: 'Too many loops to check.' }]);
  });

  it('an open run, with no loop, says nothing even when the verdict failed', () => {
    const g = chain(['A', 'A', 'A'], false);
    expect(noted(buildSteps(g, segmentsOf(g), { ok: false, detail: 'No loop yet.', adapterJoints: [] }))).toEqual([]);
  });
});

describe('which step closes a run\'s last loop (union-find, not joins)', () => {
  /*
   * MUTATION PROOF, run: closing decided by joins instead (the union-find
   * test replaced by "two or more distinct neighbours already down"):
   * `expected Set{} to deeply equal Set{ 1 }` here, and on the square below
   * `expected Set{ 2 } to deeply equal Set{ 3 }`.
   */
  it('a piece welded twice to the same piece closes a loop on a single join', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'a', partId: 'A', turn: 'left' }, { pieceId: 'b', partId: 'A', turn: 'left' }],
      welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } }, { a: { pieceId: 'b', port: 1 }, b: { pieceId: 'a', port: 0 } }],
    };
    expect(lastClosers(g, [{ pieceId: 'a' }, { pieceId: 'b' }])).toEqual(new Set([1]));
  });

  it('a piece bridging two separate groups has two joins and closes nothing: the loop closes later', () => {
    // A square a-c-b-d-a laid a, b, c, d: c joins the separate a and b; d closes it.
    const g: Graph = {
      pieces: ['a', 'b', 'c', 'd'].map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' as const })),
      welds: [
        { a: { pieceId: 'a', port: 1 }, b: { pieceId: 'c', port: 0 } },
        { a: { pieceId: 'c', port: 1 }, b: { pieceId: 'b', port: 0 } },
        { a: { pieceId: 'b', port: 1 }, b: { pieceId: 'd', port: 0 } },
        { a: { pieceId: 'd', port: 1 }, b: { pieceId: 'a', port: 0 } },
      ],
    };
    expect(lastClosers(g, [{ pieceId: 'a' }, { pieceId: 'b' }, { pieceId: 'c' }, { pieceId: 'd' }])).toEqual(new Set([3]));
  });

  /*
   * MUTATION PROOF, run: `if (left === 0)` changed to `if (left >= 0)` (a
   * note at every closing step): `expected Set{ 2, 3 } to deeply equal
   * Set{ 3 }`.
   */
  it('a run with two loops is noted once, at the step that closes the second', () => {
    // A theta: a-b-c-a plus a second path a-d-c.
    const g: Graph = {
      pieces: ['a', 'b', 'c', 'd'].map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' as const })),
      welds: [
        { a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } },
        { a: { pieceId: 'b', port: 1 }, b: { pieceId: 'c', port: 0 } },
        { a: { pieceId: 'c', port: 1 }, b: { pieceId: 'a', port: 0 } },
        { a: { pieceId: 'a', port: 2 }, b: { pieceId: 'd', port: 0 } },
        { a: { pieceId: 'd', port: 1 }, b: { pieceId: 'c', port: 2 } },
      ],
    };
    expect(lastClosers(g, [{ pieceId: 'a' }, { pieceId: 'b' }, { pieceId: 'c' }, { pieceId: 'd' }])).toEqual(new Set([3]));
  });
});
