/**
 * THE VERDICT SPEAKS ABOUT EACH RUN OF TRACK (brio-TODOS.md P1, "Multiple
 * independent components").
 *
 * Separate runs already placed, moved and checked for overlap; the verdict
 * still spoke of "the loop". It said "Build it" beside a second run that was
 * still open, said a turned loop's reason twice without saying which loop,
 * and read two closed loops as one.
 *
 * Value: protects=the engine's run summary; "Both/All n loops close"; the
 * open-run clause and its action in place of "Build it"; the loop a gap or a
 * turn is about, named by its lowest piece number
 * Value: fails_when=open runs go unsaid, "Build it" returns beside one, a
 * figure stops naming its loop, or the turned-loop detail repeats the headline
 * Value: why_new=the verdict had no notion of runs
 * Value: seam=real graphs through `solveGraph`, `viewOf` and
 * renderToStaticMarkup, so the three layers are checked together
 * Value: no_claim=layouts with switches, where one run holds several loops;
 * those keep the "n of m loops" note
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { VerdictLine } from './VerdictLine.js';
import { viewOf } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** A run of `parts` in order, joined end to start, closed into a loop or left open. */
const run = (pre: string, parts: readonly string[], closed: boolean) => ({
  pieces: parts.map((partId, i) => ({ pieceId: `${pre}${i}`, partId, turn: 'left' as const })),
  welds: parts
    .slice(0, closed ? parts.length : parts.length - 1)
    .map((_, i) => ({ a: { pieceId: `${pre}${i}`, port: 1 }, b: { pieceId: `${pre}${(i + 1) % parts.length}`, port: 0 } })),
});
const CIRCLE = Array<string>(8).fill('E');
/** Runs side by side, 900mm apart, each anchored at its first piece. */
const layout = (...runs: ReturnType<typeof run>[]): Graph => ({
  pieces: runs.flatMap((r) => r.pieces),
  welds: runs.flatMap((r) => r.welds),
  anchors: new Map(runs.map((r, i) => [r.pieces[0]!.pieceId, { pos: fromInt(900 * i), heading: 0 }])),
});
const solve = (g: Graph) => solveGraph(g, ports, resolve, () => 1, placeAll(g, ports));
const said = (g: Graph) => renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(solve(g)) })).replace(/<[^>]+>/g, '');

describe('the engine counts the runs', () => {
  /*
   * MUTATION PROOF, run: `open` as `count` (every run counted open): fails
   * with `expected { count: 2, open: 2, …(1) } to match object { count: 2,
   * open: 1 }`.
   */
  it('a loop and an open run: two runs, one open, the loop starting at piece 1', () => {
    const { runs } = solve(layout(run('a', CIRCLE, true), run('b', ['A', 'A'], false)));
    expect(runs).toMatchObject({ count: 2, open: 1 });
    expect(runs.loops.map((l) => l.firstPiece)).toEqual([1]);
  });
});

describe('what the verdict says', () => {
  /*
   * MUTATION PROOFS, run:
   * - "Both" dropped (`loopRuns === 2` as `false`): fails with `expected
   *   'OThis works. Closes exactly, no give …' to contain 'This works. Both
   *   loops close exactly,…'`.
   * - `OpenRuns` rendering nothing: fails with `expected 'OThis works. Closes
   *   exactly, no give …' to contain '1 other run of track is not a loop
   *   ye…'`.
   * - EXACT's action back to ignoring open runs: fails with `expected 'OThis
   *   works. Closes exactly, no give …' to contain 'Join the free ends of the
   *   open run, o…'`.
   */
  it('two closed loops: both close', () => {
    expect(said(layout(run('a', CIRCLE, true), run('b', CIRCLE, true)))).toContain(
      'This works. Both loops close exactly, no give needed at any joint.',
    );
  });

  it('a loop beside an open run: never "Build it", and says what is open', () => {
    const out = said(layout(run('a', CIRCLE, true), run('b', ['A', 'A'], false)));
    expect(out).toContain('1 other run of track is not a loop yet.');
    expect(out).toContain('Join the free ends of the open run, or remove it.');
    expect(out).not.toContain('Build it.');
  });

  /*
   * MUTATION PROOFS, run:
   * - `LoopAt` rendering nothing: fails with `expected 'XExceeds the modelled
   *   give. Needs 54m…' to contain 'In the loop through piece 9.'`.
   * - the turned clause dropped from `BendLine`: fails with `expected
   *   'XBeyond the tested bend: needs up to …' to contain 'It comes back turned
   *   45°.'`.
   */
  it('a gap names its loop when there are several', () => {
    // The second circle has a mini straight halfway round, so it opens by 54mm.
    expect(said(layout(run('a', CIRCLE, true), run('b', [...CIRCLE.slice(0, 4), 'A2', ...CIRCLE.slice(4)], true)))).toContain(
      'In the loop through piece 9.',
    );
  });

  /*
   * A LOOP THAT COMES BACK TURNED is weighed by the bend now (eng review D4),
   * and the verdict says the turn once, as an angle (design 9A), with the run
   * count when there is more than one (3A) and the loop it is in.
   */
  it('a loop that comes back turned says the angle once, and which run', () => {
    const out = said(layout(run('a', CIRCLE, true), run('b', CIRCLE.slice(1), true)));
    expect(out).toContain('It comes back turned 45°.');
    expect(out).toContain('In 1 of 2 track runs.');
    expect(out).toContain('In the loop through piece 9.');
    expect(out.match(/turned/g)).toHaveLength(1);
  });
});
