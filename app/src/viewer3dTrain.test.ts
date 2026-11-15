/**
 * THE TRAIN IN THE 3D VIEW (plan 2026-11-14, E5; DESIGN.md rule 8).
 *
 * Value: protects=the train in 3D stands on the top of the road as drawn (on
 * the floor, up a ramp, over a bridge's measured hump, the same from either
 * end), is as tall as the app's measured train, is drawn frame after frame
 * only while a run lasts, counts from when the run began, and is freed when
 * the run is over
 * Value: fails_when=the train is put at floor height on raised track, cuts
 * through a hump, keeps asking for frames after the route ended or after it
 * was stopped, starts again from the beginning when the view is changed, or
 * leaves its geometry behind
 * Value: seam=none: `trainObject`, `placeTrain` and `driveTrain` are the
 * viewer's own functions, run with real three objects (no WebGL), and the
 * frame calls are handed in
 * Value: no_claim=pixels; the browser pass covers what is drawn. That the
 * panel hands the run to the viewer is view3dTrain.dom.test.tsx
 */

import { Box3, Group, type BufferGeometry, type Material, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { walkRoute } from '../../engine/src/graph/route.js';
import { buildScene } from '../../engine/src/view3d/mesh.js';
import { run } from '../test/trainSentences.js';
import { trainAt } from './playback.js';
import { TRAIN_CARS, TRAIN_WIDTH_MM } from './trainShape.js';
import { disposeChildren, driveTrain, placeTrain, trainCars, type SceneColors, type TrainSpot } from './Viewer3D.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const C: SceneColors = {
  floor: '#ece6da', trackFill: '#d9be93', trackEdge: '#8a7349', trackGroove: '#9c7f50', trackShadow: '#8f826c',
  seam: '#6e5a38', ink: '#2a2724', inkSoft: '#6b655d', paper: '#f7f3ec', paperSunk: '#efe9df', fail: '#b3261e', slabSide: '#bdb19b',
};
const RISE = 64;
const PLANK = 12;

const routeOf = (graph: Graph, index: number, port: number) => {
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  return { render, route: walkRoute(graph, ports, render, { pieceId: graph.pieces[index]!.pieceId, port }) };
};
/** The height the train is stood at, `mm` into a route. */
const heightAt = (graph: Graph, index: number, port: number, mm: number) => {
  const box = new Group();
  placeTrain(box, trainAt(routeOf(graph, index, port).route, mm)!, RISE, PLANK);
  return box.position.z;
};

describe('where the train stands in 3D', () => {
  /*
   * MUTATION PROOF, run: `placeTrain` stands the train at `plankMm` always
   * (the `roadTopAt` call dropped): `expected [ 12, 12, 12 ] to deeply equal
   * [ 12, 44, 76 ]`.
   */
  it('on the plank on the floor, and up a ramp to the raised level', () => {
    const up = run(['N', 'D']);
    expect([0, 108, 216].map((mm) => heightAt(up, 0, 0, mm))).toEqual([PLANK, RISE / 2 + PLANK, RISE + PLANK]);
    expect(heightAt(up, 0, 0, 300)).toBe(RISE + PLANK);
  });

  /*
   * A bridge's road is a measured hump, not a straight slope: half way over,
   * the train stands on the highest wood the scene draws for that piece.
   *
   * MUTATION PROOF, run: `roadTopAt` ignores the measured profile (its
   * `if (s.profileMm && s.alongMm)` branch removed): `expected 76 not to be
   * 76` (the plain raised level, not the bridge's top).
   *
   * MUTATION PROOF, run: `turnedAbout` in route.ts keeps `alongMm` as it was
   * (not swapped for the other direction): `expected 57.1 to be close to 12`
   * (coming the other way, the train stands at the far end's height).
   */
  it('over a bridge, on the hump as the scene draws it, the same from either end', () => {
    const arch = run(['SA']);
    const { render } = routeOf(arch, 0, 0);
    const scene = buildScene({ segments: render.segments, bodies: render.bodies, ports: render.ports, welds: [], partOf: () => resolve('SA'), riseMm: RISE, plankMm: PLANK });
    let top = -Infinity;
    for (let i = 2; i < scene.plankTop.positions.length; i += 3) top = Math.max(top, scene.plankTop.positions[i]!);
    // The scene's heights are 32-bit floats: a thousandth of a millimetre is as near as they agree.
    expect(heightAt(arch, 0, 0, 238)).toBeCloseTo(top, 3);
    expect(heightAt(arch, 0, 0, 238)).not.toBe(RISE + PLANK);
    for (const mm of [0, 40, 100, 238, 400]) expect(heightAt(arch, 0, 1, mm)).toBeCloseTo(heightAt(arch, 0, 0, 476 - mm), 6);
  });

  /*
   * MUTATION PROOF, run: `placeTrain` sets no rotation: `expected 0 to be
   * close to 1.5707963267948966`.
   */
  it('faces along the track', () => {
    const box = new Group();
    placeTrain(box, { pose: { x: 30, y: -40, h: Math.PI / 2 }, on: null, t: 0, done: false }, RISE, PLANK);
    expect([box.position.x, box.position.y, box.position.z]).toEqual([30, -40, PLANK]);
    expect(box.rotation.z).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('the train itself', () => {
  const boxOf = (o: Group) => new Box3().setFromObject(o);

  /*
   * AN ENGINE AND TWO WAGONS. The engine's chimney top is as high as the
   * train the verdict measures with, and every car stands on its underside.
   *
   * MUTATION PROOFS, run:
   * - the chimney stopped short (`trainMm - base` made `trainMm * 0.5 -
   *   base`): `expected 46.2… to be close to 55` (the cab is then the tallest part).
   * - a wagon as tall as the engine (`trainMm * 0.6` made `trainMm`):
   *   `expected 55 to be less than 55`.
   * - one car made for the whole train (`TRAIN_CARS.slice(0, 1)`): `expected
   *   [ Group ] to have a length of 3 but got 1`.
   */
  it('is three cars; the engine is the measured train\'s height and the wagons are lower', () => {
    const cars = trainCars(55, C);
    expect(cars).toHaveLength(TRAIN_CARS.length);
    const boxes = cars.map(boxOf);
    expect(boxes[0]!.max.z).toBeCloseTo(55, 6);
    for (const b of boxes) expect(b.min.z).toBeGreaterThanOrEqual(0);
    expect(boxes[1]!.max.z).toBeLessThan(55);
    expect(boxes[2]!.max.z).toBeLessThan(55);
  });

  /*
   * MUTATION PROOF, run: a car twice its length (`box(l, w, …)` made `box(2 *
   * l, w, …)` for the footplate): `expected 128 to be close to 64`.
   */
  it('each car is as long as the plan draws it, and inside the gauge but for its wheels', () => {
    trainCars(55, C).forEach((car, i) => {
      const b = boxOf(car);
      expect(b.max.x - b.min.x).toBeCloseTo(TRAIN_CARS[i]!.lengthMm, 6);
      expect(b.max.y - b.min.y).toBeLessThanOrEqual(TRAIN_WIDTH_MM + 3);
    });
  });

  /*
   * MUTATION PROOF, run: `disposeChildren` skips geometries
   * (`g.dispose()` removed): the count left is not 0.
   */
  it('is freed when the run is over', () => {
    const group = new Group();
    for (const car of trainCars(55, C)) group.add(car);
    const live = new Set<object>();
    group.traverse((o) => {
      const m = o as Mesh;
      const parts: (BufferGeometry | Material)[] = [];
      if (m.geometry) parts.push(m.geometry);
      if (m.material) parts.push(m.material as Material);
      for (const p of parts) {
        live.add(p);
        p.addEventListener('dispose', () => live.delete(p));
      }
    });
    expect(live.size).toBeGreaterThan(20);
    disposeChildren(group);
    expect(live.size).toBe(0);
    expect(group.children).toHaveLength(0);
  });
});

describe('the frames of a run', () => {
  /** A hand-turned frame clock: `tick` runs the one frame asked for, if any. */
  const frames = () => {
    let asked: (() => void) | null = null;
    let id = 0;
    const cancelled: number[] = [];
    return {
      request: (fn: () => void) => {
        asked = fn;
        return ++id;
      },
      cancel: (n: number) => {
        cancelled.push(n);
        asked = null;
      },
      tick: () => {
        const fn = asked;
        asked = null;
        fn?.();
      },
      waiting: () => asked !== null,
      cancelled,
    };
  };
  const spot = (x: number, done = false): TrainSpot => ({ pose: { x, y: 0, h: 0 }, on: null, t: 0, done });

  /*
   * MUTATION PROOF, run: `driveTrain` asks for the next frame whatever `done`
   * says (`if (!cars[0]?.done)` removed): `expected true to be false`.
   */
  it('places and draws each frame, and asks for no more once the route has ended', () => {
    const f = frames();
    let now = 1000;
    const placed: number[] = [];
    let drawn = 0;
    driveTrain({
      train: { trainMm: 55, carsAt: (ms) => [spot(ms, ms >= 200), spot(ms - 60)] },
      startedMs: 1000,
      place: (cars) => placed.push(cars[0]!.pose.x),
      draw: () => (drawn += 1),
      now: () => now,
      request: f.request,
      cancel: f.cancel,
    });
    now = 1100;
    f.tick();
    now = 1200;
    f.tick();
    expect(placed).toEqual([0, 100, 200]);
    expect(drawn).toBe(3);
    expect(f.waiting()).toBe(false);
  });

  /*
   * ONE RUN, WHATEVER VIEW IT IS WATCHED IN: the train is where the time
   * since the run BEGAN puts it, not the time since this view opened.
   *
   * MUTATION PROOF, run: `driveTrain` counts from its own first frame
   * (`opts.now() - opts.startedMs` made `0`): `expected [ +0 ] to deeply equal
   * [ 4000 ]`.
   */
  it('counts from when the run began', () => {
    const f = frames();
    const placed: number[] = [];
    driveTrain({ train: { trainMm: 55, carsAt: (ms) => [spot(ms)] }, startedMs: 1000, place: (cars) => placed.push(cars[0]!.pose.x), draw: () => {}, now: () => 5000, request: f.request, cancel: f.cancel });
    expect(placed).toEqual([4000]);
  });

  /*
   * MUTATION PROOF, run: the stop function does not cancel the frame it
   * asked for (`opts.cancel(frame)` removed): `expected [] to deeply equal
   * [ 1 ]`.
   */
  it('stopped, cancels the frame it asked for and draws nothing more', () => {
    const f = frames();
    let drawn = 0;
    const stop = driveTrain({ train: { trainMm: 55, carsAt: (ms) => [spot(ms)] }, startedMs: 0, place: () => {}, draw: () => (drawn += 1), now: () => 10, request: f.request, cancel: f.cancel });
    expect(f.waiting()).toBe(true);
    stop();
    expect(f.cancelled).toEqual([1]);
    f.tick();
    expect(drawn).toBe(1);
  });

  /*
   * MUTATION PROOF, run: `driveTrain` draws whether or not there is a place
   * (`opts.draw()` moved out of `if (cars.length > 0)`): `expected [ +0, 2 ] to
   * deeply equal [ +0, +0 ]`.
   */
  it('places nothing when the run has nowhere to be', () => {
    const f = frames();
    let placed = 0;
    let drawn = 0;
    const stop = driveTrain({ train: { trainMm: 55, carsAt: () => [] }, startedMs: 0, place: () => (placed += 1), draw: () => (drawn += 1), now: () => 10, request: f.request, cancel: f.cancel });
    f.tick();
    expect([placed, drawn]).toEqual([0, 0]);
    stop();
  });
});
