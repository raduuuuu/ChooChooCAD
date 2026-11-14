import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { placeAll } from '../src/graph/frames.js';
import { portsOf, roadsOf, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';
import type { Segment } from '../src/geom/fk.js';
import { poseOnSegment, segmentLength } from '../src/graph/route.js';

/*
 * A TRAIN'S PLACE ON ONE DRAWN SEGMENT (plan 2026-11-14, E5). Each pin names
 * the change that fails it, and each was run. The segments are written by
 * hand so the answers can be read off the page: a quarter circle of radius
 * 200 from the origin, and a straight of 100.
 */

const straight: Segment = { kind: 'straight', from: { x: 10, y: 20, h: 0 }, to: { x: 110, y: 20, h: 0 }, partId: 'x' };
/** Starts at the origin heading along x, bends left through a quarter turn: centre (0, 200), ends at (200, 200) heading up. */
const left: Segment = {
  kind: 'curve',
  from: { x: 0, y: 0, h: 0 },
  to: { x: 200, y: 200, h: Math.PI / 2 },
  centrelineRadiusMm: 200,
  sweep: 'left',
  partId: 'x',
};
/** The same start, bending right: centre (0, -200), ends at (200, -200) heading down. */
const right: Segment = { ...left, to: { x: 200, y: -200, h: -Math.PI / 2 }, sweep: 'right' };
/**
 * Starts at the origin heading UP, bends left: centre (-200, 0), ends at (-200, 200) heading back along x.
 * Here because the three above all start heading along x, where the sine in the centre's x is zero: with
 * only those, the centre put on the wrong side in x went unnoticed (that mutation was run and stayed green).
 */
const upLeft: Segment = {
  kind: 'curve',
  from: { x: 0, y: 0, h: Math.PI / 2 },
  to: { x: -200, y: 200, h: Math.PI },
  centrelineRadiusMm: 200,
  sweep: 'left',
  partId: 'x',
};

describe('a train on one drawn segment', () => {
  /*
   * Fails when: a curve's length is taken as its chord (the `curve` branch of
   * `segmentLength` removed): the quarter circle then measures 282.8, not
   * 314.2, and a train on it would run 10% fast. Run.
   */
  it('measures a curve along its arc, and a straight end to end', () => {
    expect(segmentLength(straight)).toBe(100);
    expect(segmentLength(left)).toBeCloseTo((Math.PI / 2) * 200, 9);
    expect(segmentLength(right)).toBeCloseTo((Math.PI / 2) * 200, 9);
  });

  /*
   * Fails when: a right-hand curve is walked as a left-hand one (`side`
   * fixed at 1 in `poseOnSegment`): halfway round, the train is then on the
   * other side of the start. Run.
   */
  it('puts the train on the arc, on the side the curve bends', () => {
    const half = ((Math.PI / 2) * 200) / 2;
    const onLeft = poseOnSegment(left, half);
    expect(onLeft.x).toBeCloseTo(200 * Math.sin(Math.PI / 4), 9);
    expect(onLeft.y).toBeCloseTo(200 - 200 * Math.cos(Math.PI / 4), 9);
    expect(onLeft.h).toBeCloseTo(Math.PI / 4, 9);
    const onRight = poseOnSegment(right, half);
    expect(onRight.x).toBeCloseTo(onLeft.x, 9);
    expect(onRight.y).toBeCloseTo(-onLeft.y, 9);
    expect(onRight.h).toBeCloseTo(-Math.PI / 4, 9);
  });

  /*
   * Fails when: the walk does not end where the segment says it ends (the
   * centre put on the wrong side, or the angle advanced the wrong way): the
   * far end of each segment is compared with its own `to`. Run with the
   * centre's sign flipped in x, and again in y.
   */
  it('starts at the segment\'s start and ends at its end, and never runs off either', () => {
    for (const s of [straight, left, right, upLeft]) {
      const a = poseOnSegment(s, 0);
      const b = poseOnSegment(s, segmentLength(s));
      expect([a.x, a.y]).toEqual([s.from.x, s.from.y]);
      expect(b.x).toBeCloseTo(s.to.x, 9);
      expect(b.y).toBeCloseTo(s.to.y, 9);
      expect(b.h).toBeCloseTo(s.to.h, 9);
      expect(poseOnSegment(s, -50)).toEqual(a);
      expect(poseOnSegment(s, 1e6).x).toBeCloseTo(b.x, 9);
    }
  });
});

describe("which segments draw which road (render's `roads`)", () => {
  const resolve = makeResolver(BUILT_IN);
  const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

  /*
   * EVERY BUILT-IN PIECE, BOTH WAYS UP. A road's segments must be exactly the
   * ones drawn for it, in order from its `from` end to its `to` end: the
   * route reads nothing else to know where a train goes.
   *
   * Fails when: a road is recorded with the wrong run of segments (its
   * `start` taken after its segments were pushed, so every count is 0), or a
   * lead-in is recorded as a road of its own beside the road it belongs to.
   * Both run.
   */
  it('gives every road of every built-in piece its own segments, in order, end to end', () => {
    let roadsSeen = 0;
    let multi = 0;
    for (const part of BUILT_IN) {
      for (const turn of ['left', 'right'] as const) {
        const piece: Piece = { pieceId: 'p', partId: part.id, turn };
        const graph = { pieces: [piece], welds: [] };
        const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
        const want = roadsOf(part, turn);
        const where = `${part.id} ${turn}`;
        expect(render.roads.map((r) => [r.from, r.to]), where).toEqual(want.map((r) => [r.from, r.to]));
        // The roads' runs tile the track segments: each road segment in exactly one road, in drawing order.
        const track = render.segments.filter((s) => !s.stop);
        expect(render.roads.reduce((n, r) => n + r.count, 0), where).toBe(track.length);
        let next = render.roads[0]?.start ?? 0;
        for (const road of render.roads) {
          expect(road.count, where).toBeGreaterThan(0);
          expect(road.start, where).toBe(next);
          next = road.start + road.count;
          const own = render.segments.slice(road.start, road.start + road.count);
          const a = render.ports.find((p) => p.port === road.from)!;
          const b = render.ports.find((p) => p.port === road.to)!;
          expect(own[0]!.from.x, where).toBeCloseTo(a.x, 6);
          expect(own[0]!.from.y, where).toBeCloseTo(a.y, 6);
          expect(own[own.length - 1]!.to.x, where).toBeCloseTo(b.x, 6);
          expect(own[own.length - 1]!.to.y, where).toBeCloseTo(b.y, 6);
          for (let i = 1; i < own.length; i++) {
            expect(own[i]!.from.x, where).toBeCloseTo(own[i - 1]!.to.x, 6);
            expect(own[i]!.from.y, where).toBeCloseTo(own[i - 1]!.to.y, 6);
          }
          roadsSeen += 1;
          if (own.length > 1) multi += 1;
        }
      }
    }
    // Not vacuous: there are roads, and some are drawn as more than one segment.
    expect(roadsSeen).toBeGreaterThan(BUILT_IN.length);
    expect(multi).toBeGreaterThan(0);
  });
});
