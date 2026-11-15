import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import type { Opening } from '../../engine/src/graph/openings.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { walkRoute, type Route } from '../../engine/src/graph/route.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { loose, run } from '../test/trainSentences.js';
import { distanceAfter, leadLength, runWords, startOf, STEP_MS, TRAIN_SPEED_MM_S, trainAt } from './playback.js';
import { presetByLabel } from './presets.js';
import { presetGraph } from './presetVerdict.js';
import { planRun } from './trainRun.js';

/*
 * A TRAIN RUN: PLACE AND WORDS (plan 2026-11-14, E5, step 6). Each pin names
 * the change that fails it, and each was run.
 */

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const drawn = (graph: Graph) => renderGraph(graph, ports, resolve, placeAll(graph, ports));
const route = (graph: Graph, index: number, port = 0, open: readonly Opening[] = []) =>
  walkRoute(graph, ports, drawn(graph), { pieceId: graph.pieces[index]!.pieceId, port }, open);
const plan = (graph: Graph, selected: string | null = null, seed?: number) => {
  const render = drawn(graph);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const result = solveGraph(graph, ports, resolve, (id: string) => slop.get(id) ?? 0, placeAll(graph, ports), { parts: BUILT_IN, brandFit }, render.segments, render.bodies);
  return planRun({ graph, ports, resolve, drawn: render, result, selected, ...(seed === undefined ? {} : { seed }) });
};
const CIRCLE_MM = 2 * Math.PI * (182 + 20);

describe('one run, one journey', () => {
  /** A straight into a switch, then a long straight on its main road: the two roads end in different places. */
  const forked = () => run(['A', 'L', 'D']);
  /** Where the engine has stopped, long after the run began. */
  const endOf = (seed?: number) => {
    const at = plan(forked(), null, seed)!.at(60_000)!;
    return `${at.pieceId}@${Math.round(at.pose.x)},${Math.round(at.pose.y)}`;
  };

  /*
   * A NEW JOURNEY EACH PRESS; ONE JOURNEY A RUN (owner, 2026-11-15).
   *
   * MUTATION PROOFS, run:
   * - the seed not handed to the dice (`dice(1)` whatever `input.seed`):
   *   `expected 1 to be 2` (twenty seeds, one journey).
   * - the run asked twice gives two journeys (a fresh journey per `carsAt`
   *   call): `expected 'p2@…' to be 'p3@…'`-like, the plan and the 3D view
   *   shown different trains.
   */
  it('a seed fixes where the train goes, and other seeds send it the other way', () => {
    expect(endOf(11)).toBe(endOf(11));
    expect(new Set(Array.from({ length: 20 }, (_, seed) => endOf(seed))).size).toBe(2);
    const one = plan(forked(), null, 3)!;
    const early = one.carsAt(60_000).map((c) => c.pieceId);
    expect(one.carsAt(60_000).map((c) => c.pieceId)).toEqual(early);
    expect(one.at(60_000)!.done).toBe(true);
  });

  it('with no seed given, rolls its own: twenty presses do not all go one way', () => {
    expect(new Set(Array.from({ length: 20 }, () => endOf())).size).toBe(2);
  });
});

describe('the clock of a run', () => {
  /*
   * Fails when: the distance follows the raw time, not whole steps (the
   * `Math.floor` dropped): two moments inside one step then give two
   * distances, and a run looks different at another frame rate. Run.
   */
  it('moves in fixed steps, so a moment inside a step is the step', () => {
    expect(distanceAfter(0)).toBe(0);
    expect(distanceAfter(-50)).toBe(0);
    expect(distanceAfter(STEP_MS * 0.9)).toBe(0);
    expect(distanceAfter(STEP_MS * 3 + 1)).toBe(distanceAfter(STEP_MS * 3 + 9));
    expect(distanceAfter(STEP_MS * 60 + 0.01)).toBeCloseTo(TRAIN_SPEED_MM_S, 9);
    expect(distanceAfter(STEP_MS * 6 + 0.01)).toBeCloseTo(TRAIN_SPEED_MM_S / 10, 9);
  });
});

describe('where the train is', () => {
  /*
   * Fails when: a loop is not gone round again (the `%` on the loop's
   * length dropped): after one lap the train sits at the loop's end for
   * ever. One lap and a quarter must be where a quarter lap is. Run.
   */
  it('goes round a loop for as long as it is asked, and is never done', () => {
    const r = route(presetGraph(presetByLabel('Circle')), 0);
    const quarter = trainAt(r, CIRCLE_MM / 4)!;
    const later = trainAt(r, CIRCLE_MM * 3 + CIRCLE_MM / 4)!;
    expect(later.pose.x).toBeCloseTo(quarter.pose.x, 6);
    expect(later.pose.y).toBeCloseTo(quarter.pose.y, 6);
    expect(later.pieceId).toBe(quarter.pieceId);
    expect(later.done).toBe(false);
    // A quarter of the way round eight curves is the start of the third.
    expect(r.loop.findIndex((l) => l.pieceId === trainAt(r, CIRCLE_MM / 4 + 1)!.pieceId)).toBe(2);
  });

  /*
   * Fails when: a route that ends is run past its end (the `Math.min(run,
   * lead)` dropped, so the place is asked for beyond the last leg), or is
   * never reported done. Run for the second: `done` fixed false.
   */
  it('runs an open run to its end, stays there, and says it is done', () => {
    const open = run(['A', 'D', 'A']);
    const r = route(open, 0);
    expect(trainAt(r, 100)!.done).toBe(false);
    expect(trainAt(r, 100)!.pose.x).toBeCloseTo(100, 9);
    const end = trainAt(r, 504)!;
    expect(end.done).toBe(true);
    expect(end.pose.x).toBeCloseTo(504, 9);
    expect(trainAt(r, 99999)!.pose.x).toBeCloseTo(504, 9);
    expect(trainAt(r, 99999)!.pieceId).toBe(open.pieces[2]!.pieceId);
  });

  /*
   * Fails when: a blocked train is run to the end of the piece it is stopped
   * on (`stopAtMm` ignored in `leadLength`): under raised track it would be
   * drawn 108mm past the crossing it does not fit under. Run.
   */
  it('stops where it is blocked, not at the end of that piece', () => {
    const graph = loose(run(['N', 'D']), 'D', 324, -108, 4);
    const low: Opening = { kind: 'raised', over: graph.pieces[1]!.pieceId, under: graph.pieces[2]!.pieceId, at: [324, 0], openingMm: 61, estimated: false, marginMm: -6, fits: false };
    const r = route(graph, 2, 0, [low]);
    expect(r.end).toBe('blocked');
    expect(leadLength(r)).toBe(r.stopAtMm);
    expect(leadLength(r)).toBeLessThan(216);
    const stopped = trainAt(r, 5000)!;
    expect(stopped.done).toBe(true);
    // The loose straight runs up the page from y = -108; the crossing is at y = 0.
    expect(stopped.pose.y).toBeGreaterThan(-12);
    expect(stopped.pose.y).toBeLessThan(12);
  });

  /*
   * Fails when: the way in is run again on every lap (the loop's distance
   * measured from the start of the route, not from the end of the lead).
   * A tail into a loop through a switch: after the way in, only loop pieces. Run.
   */
  it('runs the way in once, then only the loop', () => {
    const piece = (pieceId: string, partId: string): Piece => ({ pieceId, partId, turn: 'left' });
    const join = (a: string, ap: number, b: string, bp: number) => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } });
    const graph: Graph = {
      pieces: [piece('tail', 'A'), piece('sw', 'L'), piece('a', 'A'), piece('b', 'A'), piece('c', 'A')],
      welds: [join('tail', 1, 'sw', 2), join('sw', 0, 'a', 0), join('a', 1, 'b', 0), join('b', 1, 'c', 0), join('c', 1, 'sw', 1)],
    };
    const r = walkRoute(graph, ports, drawn(graph), { pieceId: 'tail', port: 0 });
    const lead = leadLength(r);
    expect(trainAt(r, 10)!.pieceId).toBe('tail');
    const seen = new Set<string>();
    for (let mm = lead + 1; mm < lead + 3000; mm += 20) seen.add(trainAt(r, mm)!.pieceId);
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'sw']);
    expect(trainAt(r, lead + 3000)!.done).toBe(false);
  });

  it('has nowhere to be on a route with no legs', () => {
    const none: Route = { lead: [], loop: [], end: 'no road' };
    expect(trainAt(none, 100)).toBe(null);
  });
});

describe('where a run starts', () => {
  /*
   * Fails when: the selected piece is ignored (`startOf` always taking the
   * first piece): the user picks where the train starts by selecting a
   * piece. Also fails when a buffer is started on (the road check removed).
   * Both run.
   */
  it('starts on the selected piece when it has a road, or else on the first that has', () => {
    const graph = run(['A', 'D', 'S']);
    const [a, d, buffer] = graph.pieces.map((p) => p.pieceId);
    expect(startOf(graph, ports, null)).toEqual({ pieceId: a, port: 0 });
    expect(startOf(graph, ports, d!)).toEqual({ pieceId: d, port: 0 });
    expect(startOf(graph, ports, buffer!)).toEqual({ pieceId: a, port: 0 });
    expect(startOf(graph, ports, 'gone')).toEqual({ pieceId: a, port: 0 });
    expect(startOf({ pieces: [], welds: [] }, ports, null)).toBe(null);
    expect(startOf(run(['S']), ports, null)).toBe(null);
  });
});

describe('what a run says', () => {
  const words = (graph: Graph, selected: string | null = null) => plan(graph, selected)!.words;

  it('says it gets round, and names the train', () => {
    expect(words(presetGraph(presetByLabel('Stadium')))).toEqual([
      'A train gets all the way round.',
      'This is the 55mm train the app measures with; another train may differ.',
    ]);
  });

  /*
   * THE VERDICT'S OWN PHRASES. Fails when: the run words a blocked opening
   * its own way: each is compared with the phrase the verdict line prints
   * for the same opening (app/test/trainSentences.fixture.json: "may not pass
   * under raised track", "may not pass under the harbour arch bridge"). Run
   * with the raised phrase reworded.
   */
  it('says where it stops and why, in the verdict line\'s phrases', () => {
    const raised = loose(run(['N', 'D']), 'D', 324, -108, 4);
    expect(words(raised, raised.pieces[2]!.pieceId)[0]).toBe('The train stops at piece 3: it may not pass under raised track.');
    const harbour = loose(run(['HB']), 'D', 108, -108, 4);
    expect(words(harbour, harbour.pieces[1]!.pieceId)[0]).toBe(
      'The train stops at piece 2: it may not pass under the harbour arch bridge.',
    );
    // The same layouts, started on the track overhead: nothing stops it.
    expect(words(raised)[0]).toBe('A train runs to the end of the track at piece 2.');
  });

  /*
   * Fails when: an estimated opening on the way is not said (the `estimated`
   * line dropped): the tunnel straight's opening was read off a model, not a
   * ruler, and the verdict says so. Also fails when it is said of an opening
   * the train never meets. Run for the first.
   */
  it('says when an opening on its way is an estimate, and only then', () => {
    const tunnel = run(['A', 'TT', 'A']);
    expect(words(tunnel)).toContain('An opening on its way is an estimate.');
    const beside = loose(run(['A', 'D']), 'TT', 2000, 0, 0);
    expect(words(beside)).not.toContain('An opening on its way is an estimate.');
  });

  /*
   * A RUN TAKES ANY ROAD AT A SWITCH (owner, 2026-11-15), so it never says it
   * keeps to the main one; `runWords`, the fixed route's sentences, still does.
   *
   * Fails when: the chance sentence is shown on a layout with no switch, or
   * the main-road sentence is said of a run (`journeyWords` handing on
   * `runWords` unfiltered). Run: `expected [ …(3) ] to include 'At a switch
   * it takes any road, …'`.
   */
  it('says a run takes any road at a switch, only when it meets one with a choice', () => {
    const chance = 'At a switch it takes any road, each with the same chance, so no two runs need be alike.';
    expect(words(run(['A', 'L']))).toContain(chance);
    expect(words(run(['A', 'L']))).not.toContain('It keeps to the main road at switches.');
    expect(words(run(['A', 'D']))).not.toContain(chance);
    const fixed = runWords({ route: route(run(['A', 'L']), 0), openings: [], trainMm: 55, trainMeasured: true, numberOf: () => 1, nameOf: () => 'x', endsOf: () => 3 });
    expect(fixed).toContain('It keeps to the main road at switches.');
  });

  it('says the other ways a run ends, and when the train is an estimate', () => {
    expect(words(run(['A', 'S']))[0]).toBe('A train runs to the buffer after piece 1.');
    const said = (r: Route, trainMeasured = true) =>
      runWords({ route: r, openings: [], trainMm: 44, trainMeasured, numberOf: () => 7, nameOf: () => 'thing', endsOf: () => 2 });
    const leg = route(run(['A']), 0).lead[0]!;
    expect(said({ lead: [leg], loop: [], end: 'step' })[0]).toBe('A train stops after piece 7: the next joint is a step between levels.');
    expect(said({ lead: [leg], loop: [leg], end: 'loop' })[0]).toBe('A train runs in, then gets all the way round, again and again.');
    expect(said({ lead: [leg], loop: [], end: 'open end' }, false)[1]).toBe(
      'This is the 44mm train the app measures with, whose height is an estimate; another train may differ.',
    );
  });
});
