/**
 * A TRAIN'S JOURNEY: THE DICE AT A SWITCH, THE CARS, AND WHAT A RUN SAYS
 * (owner, 2026-11-15: "a probabilistic model that decides where the train
 * goes"; an even chance each time; a new journey each press).
 *
 * Value: protects=at a switch the train takes whichever road the dice say and
 * the dice are asked only there, with the number of roads; the dice are even
 * and the same seed gives the same journey; a journey is walked on as far as
 * asked and stops where the track does; each wagon rides its own distance
 * behind the engine along the track; before any dice, every way a journey
 * can stop is found, and the run's sentences say that and never one
 * journey's luck
 * Value: fails_when=the train always takes the main road, the dice are asked
 * on plain track, one seed gives two journeys, a wagon sits on the engine,
 * a run that can end at a buffer says it keeps running, or the old "keeps to
 * the main road" sentence is said of a train that does not
 * Value: why_new=the route was one fixed walk, main road at every switch
 * Value: seam=none: the pure walkers and sentences; layouts are hand-wired
 * graphs, which the walkers follow by their joints
 * Value: no_claim=how the train looks (viewer3dTrain.test.ts,
 * trainControl.dom.test.tsx); that a journey with a real random seed is
 * "random enough" beyond the evenness checked here
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { journeyEnds, startJourney, walkRoute } from '../../engine/src/graph/route.js';
import { carsOn, dice, journeyWords, MAIN_ROAD_LINE } from './playback.js';
import { TRAIN_CARS, TRAIN_HEAD_MM } from './trainShape.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const piece = (pieceId: string, partId: string): Piece => ({ pieceId, partId, turn: 'left' });
const weld = (a: string, ap: number, b: string, bp: number) => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } });
const drawn = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports));
const from = (pieceId: string, port = 0): PortRef => ({ pieceId, port });

/** A straight into a curved switch's heel; the switch's two roads each run on to a straight that ends. */
const FORK: Graph = {
  pieces: [piece('in', 'A'), piece('sw', 'L'), piece('main', 'A'), piece('side', 'A')],
  welds: [weld('in', 1, 'sw', 0), weld('sw', 1, 'main', 0), weld('sw', 2, 'side', 0)],
};
/** A switch whose main road comes back round to its own heel, and whose other road meets a buffer. */
const LOOP_AND_BUFFER: Graph = {
  pieces: [piece('sw', 'L'), piece('a', 'A'), piece('buf', 'R')],
  welds: [weld('sw', 1, 'a', 0), weld('a', 1, 'sw', 0), weld('sw', 2, 'buf', 0)],
};
/** A switch both of whose roads come back round to its heel: nothing ends. */
const TWO_LOOPS: Graph = {
  pieces: [piece('sw', 'L'), piece('a', 'A'), piece('b', 'A'), piece('join', 'G')],
  welds: [weld('sw', 1, 'a', 0), weld('sw', 2, 'b', 0), weld('a', 1, 'join', 0), weld('b', 1, 'join', 1), weld('join', 2, 'sw', 0)],
};
/** Three straights in a row: no switch anywhere. */
const PLAIN: Graph = { pieces: [piece('p1', 'A'), piece('p2', 'A'), piece('p3', 'A')], welds: [weld('p1', 1, 'p2', 0), weld('p2', 1, 'p3', 0)] };

const journey = (g: Graph, start: PortRef, pick: (n: number) => number) => startJourney(g, ports, drawn(g), start, [], pick);

describe('the dice', () => {
  /*
   * MUTATION PROOFS, run:
   * - the seed ignored (`let a = 1`): `expected [ …(12) ] not to deeply equal
   *   [ …(12) ]` (two seeds, one sequence).
   * - a lopsided roll (`Math.floor(x * choices * 0.6)`): `expected 1048 to be
   *   greater than 2700` (the second road taken one time in six).
   */
  it('give the same rolls for the same seed, other rolls for another, and are even', () => {
    const rolls = (seed: number, n: number, sides: number) => {
      const d = dice(seed);
      return Array.from({ length: n }, () => d(sides));
    };
    expect(rolls(7, 12, 3)).toEqual(rolls(7, 12, 3));
    expect(rolls(7, 12, 3)).not.toEqual(rolls(8, 12, 3));
    const two = rolls(2026, 6000, 2);
    expect(two.every((r) => r === 0 || r === 1)).toBe(true);
    const ones = two.filter((r) => r === 1).length;
    expect(ones).toBeGreaterThan(2700);
    expect(ones).toBeLessThan(3300);
    expect(new Set(rolls(5, 600, 3)).size).toBe(3);
  });
});

describe('a journey at a switch', () => {
  /*
   * MUTATION PROOFS, run:
   * - the first road always taken (`const chosen = 0`): `expected [] to deeply
   *   equal [ 2 ]` (the dice never asked), and the side road never taken.
   * - the dice asked at every piece (`outs.length === 1 ? 0 :` dropped):
   *   `expected [ 1, 2, 1 ] to deeply equal [ 2 ]`.
   */
  it('takes the road the dice say, and asks the dice only where there is a choice', () => {
    const asked: number[] = [];
    const main = journey(FORK, from('in'), (n) => (asked.push(n), 0));
    main.extendTo(10_000);
    expect(main.legs.map((l) => l.pieceId)).toEqual(['in', 'sw', 'main']);
    expect(asked).toEqual([2]);
    const side = journey(FORK, from('in'), () => 1);
    side.extendTo(10_000);
    expect(side.legs.map((l) => l.pieceId)).toEqual(['in', 'sw', 'side']);
    expect(side.stop).toEqual({ end: 'open end', pieceId: 'side' });
  });

  /*
   * MUTATION PROOF, run: the journey walked to its end at once (`lengthMm <
   * mm` dropped from `extendTo`'s test): `expected { end:
   * 'buffer', pieceId: 'sw' } to be null` (a short ask ran it to its end).
   */
  it('is walked only as far as asked, and a switch met again is rolled again', () => {
    const rolls = [0, 0, 1];
    const j = journey(LOOP_AND_BUFFER, from('a'), () => rolls.shift() ?? 1);
    j.extendTo(300);
    expect(j.stop).toBeNull();
    expect(j.legs.length).toBeLessThan(6);
    j.extendTo(100_000);
    // Round twice by the main road, then the third roll sends it to the buffer.
    expect(j.legs.map((l) => `${l.pieceId}>${l.to}`)).toEqual(['a>1', 'sw>1', 'a>1', 'sw>1', 'a>1', 'sw>2']);
    expect(j.stop).toEqual({ end: 'buffer', pieceId: 'sw' });
  });
});

describe('the cars of the train', () => {
  /*
   * MUTATION PROOFS, run:
   * - every car put where the engine is (`engine - car.behindMm` made
   *   `engine`): `expected +0 to be close to 113`.
   * - the engine started at the very beginning of the track (no
   *   `TRAIN_HEAD_MM`): `expected [] to have a length of 3 but got +0` (at
   *   the first moment no track has been run, so there is no train).
   */
  it('ride in a row along the track, each its own distance behind the engine', () => {
    const cars = carsOn(journey(PLAIN, from('p1'), () => 0));
    const first = cars(0);
    expect(first).toHaveLength(TRAIN_CARS.length);
    // The plain run lies along x from 0: a car's x is how far along it is.
    const x0 = first.map((c) => c.pose.x);
    expect(x0[0]! - first[first.length - 1]!.pose.x).toBeCloseTo(TRAIN_HEAD_MM, 6);
    TRAIN_CARS.forEach((car, i) => expect(x0[0]! - x0[i]!).toBeCloseTo(car.behindMm, 6));
    const later = cars(100).map((c) => c.pose.x);
    later.forEach((x, i) => expect(x - x0[i]!).toBeCloseTo(100, 6));
  });

  /*
   * MUTATION PROOF, run: `done` never set (`const done = false`): `expected
   * false to be true` (the frames of a stopped train would run for ever).
   */
  it('stop with the engine at the end of the track and the wagons behind it', () => {
    const cars = carsOn(journey(PLAIN, from('p1'), () => 0));
    expect(cars(100)[0]!.done).toBe(false);
    const end = cars(10_000);
    expect(end[0]!.done).toBe(true);
    expect(end[0]!.pose.x).toBeCloseTo(3 * 144, 6);
    expect(end[0]!.pose.x - end[2]!.pose.x).toBeCloseTo(TRAIN_CARS[2]!.behindMm, 6);
    expect(cars(20_000).map((c) => c.pose.x)).toEqual(end.map((c) => c.pose.x));
  });
});

describe('every way a journey can go, before any dice', () => {
  const ends = (g: Graph, start: PortRef) => journeyEnds(g, ports, drawn(g), start);

  /*
   * MUTATION PROOFS, run:
   * - only the first road explored at a switch (`for (const out of
   *   outs.slice(0, 1))`): `expected [] to deeply equal [ { end: 'buffer',
   *   pieceId: 'sw' } ]` (the buffer the main road never meets is missed).
   * - `runsOn` never set: `expected false to be true`.
   */
  it('finds the stop a side road leads to, and that the main road comes round', () => {
    const e = ends(LOOP_AND_BUFFER, from('a'));
    expect(e.choices).toBe(true);
    expect(e.stops).toEqual([{ end: 'buffer', pieceId: 'sw' }]);
    expect(e.runsOn).toBe(true);
    expect([...e.pieces].sort()).toEqual(['a', 'sw']);
  });

  it('tells a layout that can never stop from one where every road ends, and one with no choice', () => {
    const loops = ends(TWO_LOOPS, from('a'));
    expect([loops.choices, loops.stops, loops.runsOn]).toEqual([true, [], true]);
    const fork = ends(FORK, from('in'));
    expect([fork.choices, fork.runsOn]).toEqual([true, false]);
    expect(fork.stops).toEqual([{ end: 'open end', pieceId: 'main' }, { end: 'open end', pieceId: 'side' }]);
    const plain = ends(PLAIN, from('p1'));
    expect([plain.choices, plain.stops, plain.runsOn]).toEqual([false, [{ end: 'open end', pieceId: 'p3' }], false]);
  });
});

describe('what a run says, before the dice are rolled', () => {
  const words = (g: Graph, start: PortRef) => {
    const render = drawn(g);
    const number = new Map(g.pieces.map((p, i) => [p.pieceId, i + 1]));
    return journeyWords({
      route: walkRoute(g, ports, render, start),
      ends: journeyEnds(g, ports, render, start),
      openings: [],
      trainMm: 55,
      trainMeasured: true,
      numberOf: (id) => number.get(id)!,
      nameOf: (id) => id,
      endsOf: (id) => ports(g.pieces.find((p) => p.pieceId === id)!).length,
    });
  };
  const CHANCE = 'At a switch it takes any road, each with the same chance, so no two runs need be alike.';

  /*
   * NEVER ONE JOURNEY'S LUCK (DESIGN.md rule 3).
   *
   * MUTATION PROOFS, run:
   * - a layout that can stop said to keep running (the `ends.stops.length
   *   === 0` test made `ends.runsOn`): `expected 'A train keeps running,
   *   whichever road it takes at a switch.' to be 'A train runs until a
   *   switch sends it down a road that ends.'`.
   * - the main-road sentence left in for a train that takes any road (the
   *   `filter` dropped, and `MAIN_ROAD_LINE` pushed with choices): `expected
   *   'A train gets all the way round.' to be 'A train runs until a switch
   *   sends it …'` (the fixed route's sentences said of a train that takes
   *   any road).
   */
  it('says it can stop, and where, when a side road ends', () => {
    const said = words(LOOP_AND_BUFFER, from('a'));
    expect(said[0]).toBe('A train runs until a switch sends it down a road that ends.');
    expect(said[1]).toBe('It stops where there is a buffer after piece 1.');
    expect(said).toContain(CHANCE);
    expect(said).not.toContain(MAIN_ROAD_LINE);
    expect(said[said.length - 1]).toBe('This is the 55mm train the app measures with; another train may differ.');
  });

  it('says it keeps running only when no road it can take ends, and that every road ends when they all do', () => {
    expect(words(TWO_LOOPS, from('a'))[0]).toBe('A train keeps running, whichever road it takes at a switch.');
    const fork = words(FORK, from('in'));
    expect(fork[0]).toBe('Whichever road a train takes at a switch, it comes to a stop.');
    expect(fork[1]).toBe('It stops where the track ends at piece 3; the track ends at piece 4.');
  });

  /*
   * MUTATION PROOF, run: the chance sentence said whether or not a switch
   * offers a choice: `expected [ …(3) ] not to include 'At a switch it takes
   * any road, …'`.
   */
  it('with no choice to make, says what the fixed route says, and nothing about switches', () => {
    const said = words(PLAIN, from('p1'));
    expect(said[0]).toBe('A train runs to the end of the track at piece 3.');
    expect(said).not.toContain(CHANCE);
    expect(said).not.toContain(MAIN_ROAD_LINE);
  });
});
