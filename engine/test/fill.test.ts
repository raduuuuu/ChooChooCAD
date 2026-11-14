import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../data/library.js';
import { fromInt, ZERO } from '../src/geom/cyclotomic.js';
import type { PlacedPort } from '../src/graph/feasible.js';
import { gapFills, isFillPart, type FillPiece, type FillWork } from '../src/graph/fill.js';
import type { Polarity } from '../src/parts/schema.js';

/*
 * THE EXACT GAP-FILL SEARCH (plan 2026-11-14, E3). Each pin names the change
 * that fails it, and each was run. The ends here are written by hand, on the
 * x axis, so what a fill must add up to can be read off the page: the gap in
 * millimetres, and a peg or a socket at each side.
 */

const part = (id: string) => BUILT_IN.find((p) => p.id === id)!;
/** The plain straights of the main system, by length: A2 54, A3 72, A1 108, A 144, D 216; B* two pegs; C* two sockets. */
const STRAIGHTS = ['A2', 'A3', 'A1', 'A', 'D', 'B2', 'B1', 'B', 'C2', 'C1', 'C'].map(part);

/** A free end at `x` on the axis. `out` is the way it points: 0 along the axis, 8 back along it. */
const end = (x: number, out: 0 | 8, polarity: Polarity, level = 0): PlacedPort => ({
  pieceId: `end${x}`,
  port: 0,
  vertex: `v${x}`,
  free: true,
  pos: x === 0 ? ZERO : fromInt(x),
  level,
  heading: out,
  polarity,
});

function run(
  from: PlacedPort,
  to: PlacedPort,
  opts: { stock?: (id: string) => number; work?: FillWork; max?: number } = {},
): { fills: (readonly FillPiece[])[]; end: 'done' | 'out of work' } {
  const fills: (readonly FillPiece[])[] = [];
  const gen = gapFills(from, to, STRAIGHTS, opts.stock ?? (() => Infinity), opts.work ?? { left: 1_000_000 }, opts.max);
  for (;;) {
    const next = gen.next();
    if (next.done) return { fills, end: next.value };
    fills.push(next.value);
  }
}
const ids = (fill: readonly FillPiece[]) => fill.map((p) => p.partId);
const lengthOf = (fill: readonly FillPiece[]) =>
  fill.reduce((mm, p) => mm + (part(p.partId) as { lengthMm: number }).lengthMm, 0);
/** The kind of end each piece puts first and last, read from the part, not from the search. */
const endsOf = (p: FillPiece): [Polarity, Polarity] => {
  const { start, end: far } = (part(p.partId) as { ends: { start: Polarity; end: Polarity } }).ends;
  return p.port === 0 ? [start, far] : [far, start];
};

describe('gapFills', () => {
  /*
   * Fails when: the last joint's polarity is not checked (`o.exitPolarity !==
   * to.polarity` removed): the socket-and-peg mini straight then also "fits"
   * between two pegs, peg against peg. Run.
   */
  it('bridges two pegs with a two-socket piece, and with nothing else of that length', () => {
    const { fills } = run(end(0, 0, 'peg'), end(54, 8, 'peg'), { max: 1 });
    expect(fills.map(ids)).toEqual([['C2']]);
  });

  /*
   * Fails when: the first joint's polarity is not checked (`o.entryPolarity
   * === end.polarity` removed): the two-peg medium straight then goes on a
   * peg. Run.
   */
  it('puts a socket on a peg and a peg in a socket, at one piece', () => {
    const { fills } = run(end(0, 0, 'peg'), end(144, 8, 'socket'), { max: 1 });
    expect(fills.map(ids)).toEqual([['A']]);
    expect(fills[0]![0]!.port).toBe(0);
  });

  /*
   * Fails when: a joint INSIDE a fill is not checked (the polarity carried
   * down the search replaced by the starting end's): pieces then meet peg to
   * peg in the middle of a fill. Also fails if a fill does not add up to the
   * gap (the `equals` on position weakened to the heading alone). Both run.
   */
  it('every fill adds up to the gap exactly, and every joint in it is a peg in a socket', () => {
    const from = end(0, 0, 'peg');
    const to = end(216, 8, 'socket');
    const { fills, end: how } = run(from, to);
    expect(how).toBe('done');
    expect(fills.length).toBeGreaterThan(3);
    for (const fill of fills) {
      expect(lengthOf(fill), ids(fill).join(' ')).toBe(216);
      let meeting: Polarity = from.polarity;
      for (const piece of fill) {
        const [first, last] = endsOf(piece);
        expect(first, ids(fill).join(' ')).not.toBe(meeting);
        meeting = last;
      }
      expect(meeting).not.toBe(to.polarity);
    }
  });

  /*
   * Fails when: the generator yields longer fills before shorter ones (the
   * loop over lengths run from the top down). Run.
   */
  it('gives the shortest fills first', () => {
    const lengths = run(end(0, 0, 'peg'), end(216, 8, 'socket')).fills.map((f) => f.length);
    expect(lengths[0]).toBe(1);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  });

  /*
   * Fails when: the stock is not counted inside one fill (`count + 1 >
   * stock(...)` replaced by `stock(...) <= 0`): two middle straights are then
   * suggested from a box that holds one. Run.
   */
  it('never uses more of a piece than there is', () => {
    const stock = (id: string) => (id === 'A' ? 0 : id === 'A3' ? 1 : Infinity);
    const { fills } = run(end(0, 0, 'peg'), end(144, 8, 'socket'), { stock, max: 2 });
    for (const fill of fills) {
      expect(ids(fill)).not.toContain('A');
      expect(ids(fill).filter((id) => id === 'A3').length).toBeLessThanOrEqual(1);
    }
    // With stock for it, the pair of middle straights is a fill: the pin above is not vacuous.
    const free = run(end(0, 0, 'peg'), end(144, 8, 'socket'), { max: 2 }).fills.map(ids);
    expect(free).toContainEqual(['A3', 'A3']);
  });

  /*
   * Fails when: running out of work is reported as a finished search (the
   * generator returning 'done' whatever happened). A caller would then say
   * "nothing fits" of a search that never looked. Run.
   */
  it('says so when the work runs out, and counts the same work every time', () => {
    const tight = { left: 3 };
    expect(run(end(0, 0, 'peg'), end(216, 8, 'socket'), { work: tight }).end).toBe('out of work');
    const a = { left: 1_000_000 };
    const b = { left: 1_000_000 };
    run(end(0, 0, 'peg'), end(216, 8, 'socket'), { work: a });
    run(end(0, 0, 'peg'), end(216, 8, 'socket'), { work: b });
    expect(a.left).toBe(b.left);
    expect(a.left).toBeLessThan(1_000_000);
  });

  /*
   * Fails when: `isFillPart` lets through a ramp, a decorated piece or a
   * switch (any clause of it removed). A ramp in a fill would change levels
   * the search does not follow. Run, one clause at a time.
   */
  it('offers only flat, plain, two-ended pieces', () => {
    expect(isFillPart(part('A'))).toBe(true);
    expect(isFillPart(part('E'))).toBe(true);
    expect(isFillPart(part('C2'))).toBe(true);
    expect(isFillPart(part('N'))).toBe(false);
    expect(isFillPart(part('SS'))).toBe(false);
    expect(isFillPart(part('L'))).toBe(false);
  });

  it('finds nothing where nothing fits, and says the search finished', () => {
    // 50mm is no sum of these lengths.
    expect(run(end(0, 0, 'peg'), end(50, 8, 'socket'))).toEqual({ fills: [], end: 'done' });
  });
});
