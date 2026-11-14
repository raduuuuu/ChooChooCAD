import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { CLEARANCE } from '../../engine/data/rampSeeds.js';
import { bendRender } from '../../engine/src/graph/bendPose.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { openings, tunnelOpenings, type Opening } from '../../engine/src/graph/openings.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { levelAlong, poseAlong, walkRoute, type Route } from '../../engine/src/graph/route.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { loose, run } from '../test/trainSentences.js';
import { presetByLabel } from './presets.js';
import { presetGraph } from './presetVerdict.js';

/*
 * WHERE A TRAIN GOES (plan 2026-11-14, E5, step 5). Each pin names the change
 * that fails it, and each was run.
 */

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const drawn = (graph: Graph) => renderGraph(graph, ports, resolve, placeAll(graph, ports));
const end = (graph: Graph, index: number, port: number): PortRef => ({ pieceId: graph.pieces[index]!.pieceId, port });
const walk = (graph: Graph, start: PortRef, open: readonly Opening[] = []) => walkRoute(graph, ports, drawn(graph), start, open);
const legs = (r: Route) => [...r.lead, ...r.loop];
const lengthOf = (r: Route) => legs(r).reduce((mm, l) => mm + l.lengthMm, 0);
const partsOf = (graph: Graph, r: Route, which: 'lead' | 'loop') =>
  r[which].map((l) => graph.pieces.find((p) => p.pieceId === l.pieceId)!.partId);

/** The layout's real openings, as the verdict finds them. */
function realOpenings(graph: Graph): Opening[] {
  const render = drawn(graph);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const result = solveGraph(graph, ports, resolve, (id: string) => slop.get(id) ?? 0, placeAll(graph, ports), { parts: BUILT_IN, brandFit }, render.segments, render.bodies);
  return openings(result, graph.pieces, resolve, render.segments, CLEARANCE);
}

describe('walkRoute', () => {
  /*
   * Fails when: a route does not follow the drawn arcs (a leg's length taken
   * end to end): eight large curves are a full circle of the centreline
   * radius, 182 inner plus half the 40mm plank. Also fails when the walk
   * does not notice it has come round (the `entered` check removed): it then
   * runs to the cap and reports no loop. Both run.
   */
  it('goes round a circle: a loop of eight, the length of the circle, either way', () => {
    const circle = presetGraph(presetByLabel('Circle'));
    for (const port of [0, 1]) {
      const r = walk(circle, end(circle, 0, port));
      expect(r.end).toBe('loop');
      expect(r.lead).toHaveLength(0);
      expect(r.loop).toHaveLength(8);
      expect(lengthOf(r)).toBeCloseTo(2 * Math.PI * (182 + 20), 6);
    }
  });

  /*
   * Fails when: a road met from its far end is not turned about (the
   * `turnedAbout` map dropped): the train would then be drawn at the wrong
   * end of each piece, running backwards. Walked from each end of an open
   * run, the two routes must be mirror images. Run.
   */
  it('runs an open run to its free end, and the same run back', () => {
    const open = run(['A', 'D', 'A']);
    const out = walk(open, end(open, 0, 0));
    const back = walk(open, end(open, 2, 1));
    expect([out.end, back.end]).toEqual(['open end', 'open end']);
    expect(partsOf(open, out, 'lead')).toEqual(['A', 'D', 'A']);
    expect(lengthOf(out)).toBe(144 + 216 + 144);
    expect(lengthOf(back)).toBe(lengthOf(out));
    // Where one starts, the other ends, facing the other way.
    const a = poseAlong(out.lead[0]!, 0);
    const z = poseAlong(back.lead[2]!, back.lead[2]!.lengthMm);
    expect(z.x).toBeCloseTo(a.x, 9);
    expect(z.y).toBeCloseTo(a.y, 9);
    expect(Math.cos(z.h)).toBeCloseTo(-Math.cos(a.h), 9);
    // And a third of the way along the middle piece going out is two thirds along it coming back.
    const mid = poseAlong(out.lead[1]!, 72);
    const same = poseAlong(back.lead[1]!, 144);
    expect(same.x).toBeCloseTo(mid.x, 9);
    expect(same.y).toBeCloseTo(mid.y, 9);
  });

  /*
   * Fails when: a buffer is walked as if it had a road (its one end treated
   * as two): the walk would look for a road that is not there and report
   * 'no road', or run on. Run with the one-end check removed.
   */
  it('stops at a buffer', () => {
    const stopped = run(['A', 'S']);
    const r = walk(stopped, end(stopped, 0, 0));
    expect(r.end).toBe('buffer');
    expect(partsOf(stopped, r, 'lead')).toEqual(['A']);
  });

  /*
   * THE MAIN ROAD AT A SWITCH (owner, choice C4): in by the heel, out by the
   * straight road, never the curve. In by either other end, out by the heel.
   *
   * Fails when: the last road listed is taken, not the first (`along?.[0]`
   * read from the other end of the list): the train then takes the curve. Run.
   */
  it('keeps to the main road at a switch', () => {
    const sw = run(['L']);
    const id = sw.pieces[0]!.pieceId;
    expect(walk(sw, { pieceId: id, port: 0 }).lead.map((l) => [l.from, l.to])).toEqual([[0, 1]]);
    expect(walk(sw, { pieceId: id, port: 0 }).lead[0]!.path.every((s) => s.kind === 'straight')).toBe(true);
    expect(walk(sw, { pieceId: id, port: 1 }).lead.map((l) => [l.from, l.to])).toEqual([[1, 0]]);
    expect(walk(sw, { pieceId: id, port: 2 }).lead.map((l) => [l.from, l.to])).toEqual([[2, 0]]);
    expect(walk(sw, { pieceId: id, port: 2 }).lead[0]!.path.some((s) => s.kind === 'curve')).toBe(true);
  });

  /*
   * IT ALWAYS STOPS (eng review, finding 6). A tail joined to a switch's
   * curved end leads into a loop through the switch's straight road. The
   * train never comes back to the tail, so "back where it started" would
   * never be true.
   *
   * Fails when: coming round is tested against the START only (`entered`
   * holding just the first end): the walk runs to its cap and reports
   * 'no road', with no loop. Run.
   */
  it('entering a loop through a switch: the way in is run once, the loop for ever', () => {
    const piece = (pieceId: string, partId: string): Piece => ({ pieceId, partId, turn: 'left' });
    const join = (a: string, ap: number, b: string, bp: number) => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } });
    const graph: Graph = {
      pieces: [piece('tail', 'A'), piece('sw', 'L'), piece('a', 'A'), piece('b', 'A'), piece('c', 'A')],
      // The tail on the switch's curved end; the loop out of its heel and back in by its straight end.
      welds: [join('tail', 1, 'sw', 2), join('sw', 0, 'a', 0), join('a', 1, 'b', 0), join('b', 1, 'c', 0), join('c', 1, 'sw', 1)],
    };
    const r = walk(graph, { pieceId: 'tail', port: 0 });
    expect(r.end).toBe('loop');
    // The way in is the tail and the switch's curve; the loop starts at the first piece met a second time.
    expect(r.lead.map((l) => l.pieceId)).toEqual(['tail', 'sw']);
    expect(r.loop.map((l) => l.pieceId)).toEqual(['a', 'b', 'c', 'sw']);
    // The first time through the switch is by its curve, every time after by its straight road.
    expect([r.lead[1]!.from, r.lead[1]!.to]).toEqual([2, 0]);
    expect([r.loop[3]!.from, r.loop[3]!.to]).toEqual([1, 0]);
  });

  /*
   * Fails when: a slope met from its high end is still read as climbing
   * (`highAtStart` not flipped in `turnedAbout`): coming down the ramp, the
   * train would rise from the raised level to one above it. Run.
   */
  it('climbs a ramp going up it and comes down going back', () => {
    const up = run(['N', 'D']);
    const out = walk(up, end(up, 0, 0));
    expect(out.end).toBe('open end');
    const [ramp, top] = out.lead;
    expect([levelAlong(ramp!, 0), levelAlong(ramp!, 108), levelAlong(ramp!, 216)]).toEqual([0, 0.5, 1]);
    expect([levelAlong(top!, 0), levelAlong(top!, 216)]).toEqual([1, 1]);
    const back = walk(up, end(up, 1, 1));
    const [topBack, down] = back.lead;
    expect(levelAlong(topBack!, 100)).toBe(1);
    expect([levelAlong(down!, 0), levelAlong(down!, 108), levelAlong(down!, 216)]).toEqual([1, 0.5, 0]);
  });

  /*
   * Fails when: coming round to a joint whose sides are on different levels
   * is called a loop (the `sameLevel` check on coming round removed). A ramp
   * and a long straight joined into a ring of two: the straight leaves the
   * ramp's high end on the raised level and is joined back to its low end on
   * the floor. No train crosses that. Run.
   */
  it('does not call it a loop when the joint that closes it is a step between levels', () => {
    const ring: Graph = {
      pieces: [{ pieceId: 'ramp', partId: 'N', turn: 'left' }, { pieceId: 'top', partId: 'D', turn: 'left' }],
      welds: [
        { a: { pieceId: 'ramp', port: 1 }, b: { pieceId: 'top', port: 0 } },
        { a: { pieceId: 'top', port: 1 }, b: { pieceId: 'ramp', port: 0 } },
      ],
    };
    const r = walk(ring, { pieceId: 'ramp', port: 0 });
    expect(r.end).toBe('step');
    expect(r.lead.map((l) => l.pieceId)).toEqual(['ramp', 'top']);
    expect(r.loop).toEqual([]);
  });

  /*
   * Fails when: a road of several segments met from its far end keeps its
   * segments in drawing order (the `reverse()` dropped): the stone arch
   * bridge is 120mm up, 236mm along the top, 120mm down, and backwards the
   * train would start on the way down. It is the same shape both ways, so
   * the heights must match, and the pose must not jump. Run.
   */
  it('goes up and over a bridge the same from either end', () => {
    const arch = run(['SA']);
    for (const port of [0, 1]) {
      const leg = walk(arch, end(arch, 0, port)).lead[0]!;
      expect(leg.lengthMm).toBe(476);
      expect(leg.path).toHaveLength(3);
      expect([0, 60, 120, 238, 356, 416, 476].map((mm) => levelAlong(leg, mm))).toEqual([0, 0.5, 1, 1, 1, 0.5, 0]);
      // Each segment starts where the one before it ended.
      for (let i = 1; i < leg.path.length; i++) {
        expect(leg.path[i]!.from.x).toBeCloseTo(leg.path[i - 1]!.to.x, 9);
        expect(leg.path[i]!.from.y).toBeCloseTo(leg.path[i - 1]!.to.y, 9);
      }
    }
  });

  /*
   * THE PATH IS THE DRAWN TRACK (finding 9). The same layout, drawn with one
   * piece moved 10mm across, as the bent drawing moves pieces: the route on
   * that drawing goes where the piece was drawn.
   *
   * Fails when: `bendRender` does not carry the roads through (its `roads`
   * dropped): the walk on the bent drawing finds no road at all. Run.
   */
  it('follows the track as it was drawn, bent or not', () => {
    const open = run(['A', 'D', 'A']);
    const moved = open.pieces[1]!.pieceId;
    const bent = bendRender(drawn(open), new Map([[moved, [0, 10, 0] as [number, number, number]]]));
    const plain = walk(open, end(open, 0, 0));
    const onBent = walkRoute(open, ports, bent, end(open, 0, 0));
    expect(onBent.end).toBe('open end');
    expect(poseAlong(onBent.lead[0]!, 50)).toEqual(poseAlong(plain.lead[0]!, 50));
    expect(poseAlong(onBent.lead[1]!, 50).y).toBeCloseTo(poseAlong(plain.lead[1]!, 50).y + 10, 9);
  });
});

describe('where the train does not fit', () => {
  /*
   * Fails when: the train is stopped on the piece OVERHEAD (`o.under` read
   * as `o.over` in `firstBlock`): the raised run would be blocked by itself
   * and the floor straight under it would run free. Also fails when it is
   * stopped at the start of the piece and not where the two cross (the
   * place ignored): the crossing is over the middle of the 216mm straight.
   * Both run.
   */
  it('stops under raised track where the two cross, and only on the track underneath', () => {
    const graph = loose(run(['N', 'D']), 'D', 324, -108, 4);
    const open = realOpenings(graph);
    expect(open.map((o) => [o.kind, o.fits])).toEqual([['raised', false]]);

    const under = walk(graph, end(graph, 2, 0), open);
    expect(under.end).toBe('blocked');
    expect(under.blockedBy).toBe(open[0]);
    expect(under.stopAtMm).toBeGreaterThan(98);
    expect(under.stopAtMm).toBeLessThan(118);

    const over = walk(graph, end(graph, 0, 0), open);
    expect(over.end).toBe('open end');
    expect(over.lead).toHaveLength(2);
  });

  /*
   * THE ROUTE AND THE VERDICT AGREE, because they read one list. Under the
   * stone arch bridge the verdict says about 2mm to spare; under the harbour
   * arch bridge, may not pass.
   *
   * Fails when: an opening that fits still stops the train (`o.fits`
   * ignored in `firstBlock`). Run.
   */
  it('passes under a bridge the verdict says it fits under, and not under one it does not', () => {
    const arch = loose(run(['SA']), 'D', 238, -108, 4);
    expect(walk(arch, end(arch, 1, 0), realOpenings(arch)).end).toBe('open end');
    const harbour = loose(run(['HB']), 'D', 108, -108, 4);
    const r = walk(harbour, end(harbour, 1, 0), realOpenings(harbour));
    expect(r.end).toBe('blocked');
    expect(r.blockedBy?.kind).toBe('bridge');
    // And the train ON the bridge's own road is not stopped by the bridge.
    expect(walk(harbour, end(harbour, 0, 0), realOpenings(harbour)).end).toBe('open end');
  });

  /*
   * A tunnel is the whole piece: a train too tall for it stops before going
   * in. No shipped tunnel is too low for the 55mm train, so this one is
   * judged for a 75mm train.
   *
   * Fails when: a tunnel is skipped for having no crossing place (`o.at ===
   * null` treated as "not on this road"). Run.
   */
  it('stops before a tunnel a taller train does not fit', () => {
    const graph = run(['A', 'TT', 'A']);
    const tall = tunnelOpenings(graph.pieces, resolve, { ...CLEARANCE, trainMm: 75 });
    expect(tall.map((o) => o.fits)).toEqual([false]);
    const r = walk(graph, end(graph, 0, 0), tall);
    expect(r.end).toBe('blocked');
    expect(partsOf(graph, r, 'lead')).toEqual(['A', 'TT']);
    expect(r.stopAtMm).toBe(0);
    // The real 55mm train fits, and runs through.
    expect(walk(graph, end(graph, 0, 0), realOpenings(graph)).end).toBe('open end');
  });

  /*
   * ONLY THE ROAD UNDER THE CROSSING (finding 8). A crossing over the far
   * end of a switch's curved road is not over its straight road, which ends
   * well clear of it.
   *
   * Fails when: any opening on the piece stops any road of it (the nearness
   * test in `firstBlock` removed). Run.
   */
  it('stops only the road the crossing is over, not the other road of the same switch', () => {
    const sw = run(['L']);
    const id = sw.pieces[0]!.pieceId;
    const curve = walk(sw, { pieceId: id, port: 2 }).lead[0]!;
    const straight = walk(sw, { pieceId: id, port: 1 }).lead[0]!;
    // The curved road's own far end, where the train comes in by end 2.
    const far = poseAlong(curve, 0);
    const nearestOnStraight = Math.min(
      ...Array.from({ length: 50 }, (_, i) => {
        const p = poseAlong(straight, (straight.lengthMm * i) / 49);
        return Math.hypot(p.x - far.x, p.y - far.y);
      }),
    );
    expect(nearestOnStraight).toBeGreaterThan(30);
    const low: Opening = { kind: 'raised', over: 'above', under: id, at: [far.x, far.y], openingMm: 61, estimated: false, marginMm: -6, fits: false };
    expect(walk(sw, { pieceId: id, port: 2 }, [low]).end).toBe('blocked');
    expect(walk(sw, { pieceId: id, port: 1 }, [low]).end).toBe('open end');
  });
});
