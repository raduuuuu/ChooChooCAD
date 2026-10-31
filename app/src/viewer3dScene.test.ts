/**
 * THE 3D SCENE FREES WHAT IT REPLACES, AND STARTS WITH EVERYTHING IN VIEW
 * (3D plan, eng D12 and D16, design 21A), FROM LOWER WHEN ANY TRACK IS RAISED
 * (design review 2026-10-31, D1).
 *
 * Value: protects=every rebuild disposes the geometries and materials it
 * replaces, so memory stays flat however long you edit with 3D open, and
 * leaving 3D disposes the rest; the starting camera sees every corner of the
 * scene, 35 degrees up, or 25 when the layout has raised track
 * Value: fails_when=`syncScene` stops disposing, or `startPose` frames too
 * tight, from the wrong side, or a raised layout from as high as a flat one
 * Value: why_new=no 3D code existed
 * Value: seam=none: `syncScene`, `disposeChildren` and `startPose` are the
 * viewer's own functions, run with real three objects, which need no WebGL
 * Value: no_claim=GPU memory itself (three's dispose events stand in for the
 * driver's frees), and pixels; the browser pass covers what is drawn
 */

import { Group, PerspectiveCamera, type BufferGeometry, type Material, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { buildScene } from '../../engine/src/view3d/mesh.js';
import { disposeChildren, FOV_DEG, startPose, syncScene, type SceneColors } from './Viewer3D.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const C: SceneColors = {
  floor: '#ece6da', trackFill: '#d9be93', trackEdge: '#8a7349', trackGroove: '#9c7f50', trackShadow: '#8f826c',
  seam: '#6e5a38', ink: '#2a2724', inkSoft: '#6b655d', paper: '#f7f3ec', paperSunk: '#efe9df', fail: '#b3261e', slabSide: '#bdb19b',
};

const arraysOf = (ids: readonly string[]) => {
  const g: Graph = {
    pieces: ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
    welds: ids.slice(1).map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${i + 1}`, port: 0 } })),
    anchors: new Map([['p0', { pos: fromInt(0), heading: 0 }]]),
  };
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  const partOf = (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId);
  return buildScene({
    segments: r.segments, ports: r.ports, welds: g.welds, partOf, riseMm: 64, plankMm: 12,
    marks: [{ kind: 'gap', at: [0, 0], source: { kind: 'weld', a: { pieceId: 'p0', port: 0 } }, figure: 12 }],
    table: { outline: [[-50, -300], [900, -300], [900, 300], [-50, 300]], overhang: false },
  });
};

/** Every geometry and material under the group, each wired to report its own disposal. */
function track(group: Group, live: Set<object>) {
  group.traverse((o) => {
    const m = o as Mesh;
    const parts: (BufferGeometry | Material)[] = [];
    if (m.geometry) parts.push(m.geometry);
    if (m.material) parts.push(...(Array.isArray(m.material) ? m.material : [m.material]));
    for (const p of parts) {
      if (live.has(p)) continue;
      live.add(p);
      p.addEventListener('dispose', () => live.delete(p));
    }
  });
}

describe('rebuilding the scene frees what it replaces (eng D16)', () => {
  /*
   * MUTATION PROOF, run: `syncScene` without its `disposeChildren(group)`
   * (children dropped with `group.clear()` instead): `expected 381 to be 20`.
   */
  it('twenty rebuilds leave only the current scene alive', () => {
    const group = new Group();
    const live = new Set<object>();
    const layouts = [['A', 'N', 'A', 'E'], ['A', 'A'], ['E', 'E', 'E', 'S']];
    for (let i = 0; i < 20; i++) {
      syncScene(group, arraysOf(layouts[i % layouts.length]!), C);
      track(group, live);
    }
    const current = new Set<object>();
    track(group, current);
    expect(live.size).toBe(current.size);
  });

  /*
   * MUTATION PROOF, run: `disposeChildren` skips materials (`m.dispose()`
   * removed): `expected 10 to be +0` (and the rebuild spec, `expected 210 to
   * be 20`).
   */
  it('leaving 3D frees everything (eng D12)', () => {
    const group = new Group();
    const live = new Set<object>();
    syncScene(group, arraysOf(['A', 'N', 'A']), C);
    track(group, live);
    expect(live.size).toBeGreaterThan(0);
    disposeChildren(group);
    expect(live.size).toBe(0);
    expect(group.children).toHaveLength(0);
  });
});

describe('the starting view (design 21A; raised layouts, design review D1)', () => {
  /*
   * MUTATION PROOF, run: the fitted distance cut to a third (`d = d / 3`):
   * `expected false to be true`.
   *
   * MUTATION PROOF, run: `startElevationDeg` always returns
   * START_ELEVATION_DEG: `expected 35 to be 25` (the raised case).
   */
  it.each([
    ['flat', ['A', 'A', 'E', 'E', 'D'], 35],
    ['with a ramp to a raised level', ['A', 'N', 'A', 'E', 'E', 'D'], 25],
  ] as const)('a layout %s: sees all eight corners, from the plan’s bottom edge, looking up %i degrees', (_, ids, deg) => {
    const arrays = arraysOf(ids);
    const aspect = 16 / 9;
    const pose = startPose(arrays, aspect);
    const cam = new PerspectiveCamera(FOV_DEG, aspect, 1, 1e6);
    cam.up.set(0, 0, 1);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const [x0, y0, z0] = arrays.bounds.min;
    const [x1, y1, z1] = arrays.bounds.max;
    const inView = [x0, x1].every((x) =>
      [y0, y1].every((y) =>
        [z0, z1].every((z) => {
          const p = cam.position.clone().set(x, y, z).project(cam);
          return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
        }),
      ),
    );
    expect(inView).toBe(true);
    // From the bottom edge (smaller y) and above.
    expect(pose.position.y).toBeLessThan(pose.target.y);
    const up = pose.position.z - pose.target.z;
    const across = Math.hypot(pose.position.x - pose.target.x, pose.position.y - pose.target.y);
    expect(Math.round((Math.atan2(up, across) * 180) / Math.PI)).toBe(deg);
  });
});
