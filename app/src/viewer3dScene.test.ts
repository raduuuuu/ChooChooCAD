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

import { Color, GreaterDepth, Group, Mesh as ThreeMesh, MeshBasicMaterial, PerspectiveCamera, type BufferGeometry, type Material, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { buildScene } from '../../engine/src/view3d/mesh.js';
import { boxOf, disposeChildren, FOV_DEG, framePose, startPose, syncScene, type SceneColors } from './Viewer3D.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const C: SceneColors = {
  floor: '#ece6da', trackFill: '#d9be93', trackEdge: '#8a7349', trackGroove: '#9c7f50', trackShadow: '#8f826c',
  seam: '#6e5a38', ink: '#2a2724', inkSoft: '#6b655d', paper: '#f7f3ec', paperSunk: '#efe9df', fail: '#b3261e', slabSide: '#bdb19b',
};

const arraysOf = (ids: readonly string[], highlight?: string, selected?: string) => {
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
    ...(highlight !== undefined ? { highlight } : {}),
    ...(selected !== undefined ? { selected } : {}),
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

describe("build mode's picture (build mode plan D28, D42, D17)", () => {
  // Wood only: LineSegments2 is a Mesh too, with its own line material.
  const meshes = (group: Group) => group.children.filter((o): o is ThreeMesh => o instanceof ThreeMesh && (o as ThreeMesh).material instanceof MeshBasicMaterial);
  const hex = (css: string) => new Color(css).getHex();

  /*
   * MUTATION PROOF, run: the see-through copy drawn with the ordinary depth
   * test (`depthFunc: GreaterDepth` dropped): `expected 3 to be 6 //
   * Object.is equality` (LessEqualDepth, not GreaterDepth): it would draw
   * over the visible piece too.
   */
  it('what is down is muted, the next piece is wood, and a copy of its top shows only where something hides it', () => {
    const group = new Group();
    syncScene(group, arraysOf(['A', 'A', 'A'], 'p1'), C);
    const mats = meshes(group).map((m) => m.material as MeshBasicMaterial);
    const ghosts = mats.filter((m) => m.transparent);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]!.depthFunc).toBe(GreaterDepth);
    expect(ghosts[0]!.opacity).toBe(0.5);
    // The shared top (the pieces down) in --slab-side; the next piece's top in --track-fill.
    expect(mats.some((m) => m.color.getHex() === hex(C.slabSide) && m.depthTest)).toBe(true);
    expect(mats.filter((m) => m.color.getHex() === hex(C.trackFill) && !m.transparent)).toHaveLength(1);
  });

  it('without a next piece nothing is muted and nothing is see-through', () => {
    const group = new Group();
    syncScene(group, arraysOf(['A', 'A', 'A']), C);
    const mats = meshes(group).map((m) => m.material as MeshBasicMaterial);
    expect(mats.some((m) => m.transparent)).toBe(false);
    expect(mats.filter((m) => m.color.getHex() === hex(C.trackFill))).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: `boxOf` ignores the ids (always the whole scene):
   * `expected 0.6751526192482558 to be greater than 1`, the run's first
   * piece back in view.
   */
  it('a step frames the pieces it names: their box fills the view, the rest may not', () => {
    const arrays = arraysOf(['A', 'A', 'A', 'A', 'A', 'A'], 'p5');
    const box = boxOf(arrays, ['p4', 'p5']);
    const pose = framePose(box, 16 / 9, 35);
    const cam = new PerspectiveCamera(FOV_DEG, 16 / 9, 1, 1e6);
    cam.up.set(0, 0, 1);
    cam.position.copy(pose.position);
    cam.lookAt(pose.target);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const ndcX = (x: number) => cam.position.clone().set(x, 0, 6).project(cam).x;
    // The framed pieces sit inside the view; the first piece of the run, 576mm away, does not.
    expect(Math.abs(ndcX(box.min[0]))).toBeLessThanOrEqual(1);
    expect(Math.abs(ndcX(box.max[0]))).toBeLessThanOrEqual(1);
    expect(Math.abs(ndcX(0))).toBeGreaterThan(1);
    // Unknown ids frame the whole scene.
    expect(boxOf(arrays, ['nope'])).toBe(arrays.bounds);
    expect((box.max[0] - box.min[0]) / 144).toBeLessThan(3);
  });
});

describe("the editor's selection in 3D (P3, owner 2026-11-05: ink outline only)", () => {
  const meshes = (group: Group) => group.children.filter((o): o is ThreeMesh => o instanceof ThreeMesh && (o as ThreeMesh).material instanceof MeshBasicMaterial);
  const hex = (css: string) => new Color(css).getHex();
  type Lined = { material: { color: Color; linewidth: number; depthTest: boolean }; renderOrder: number };
  const inkLines = (group: Group) =>
    group.children.filter((o) => (o as unknown as Lined).material?.linewidth === 3).map((o) => o as unknown as Lined);

  /*
   * Drawn at the 2D selection's weight, 3px ink, through whatever is in front
   * so a piece under a roof can still be found; the wood keeps its own look.
   * MUTATION PROOF, run: the outline depth-tested: `expected [ [ 2762532, true,
   * 8 ] ] to deeply equal [ [ 2762532, false, 8 ] ]`.
   */
  it('draws the selection as one 3px ink outline seen through what is in front, and mutes nothing', () => {
    const group = new Group();
    syncScene(group, arraysOf(['A', 'A', 'A'], undefined, 'p1'), C);
    expect(inkLines(group).map((l) => [l.material.color.getHex(), l.material.depthTest, l.renderOrder])).toEqual([[hex(C.ink), false, 8]]);
    // The wood is drawn exactly as with nothing selected: same fills, same order, nothing see-through.
    const look = (gr: Group) => meshes(gr).map((m) => [(m.material as MeshBasicMaterial).color.getHex(), (m.material as MeshBasicMaterial).transparent, m.renderOrder]);
    const plain = new Group();
    syncScene(plain, arraysOf(['A', 'A', 'A']), C);
    expect(look(group)).toEqual(look(plain));
  });
});

describe('the Elevated station painted in 3D (paint plan 2026-11-07: CEO R2/R5/O1/O3, design D6)', () => {
  const PAINTED: SceneColors = {
    ...C,
    paints: { '--paint-roof': '#638e70', '--paint-red': '#e46560', '--paint-base': '#33251d', '--paint-grey': '#9fa693', '--track-fill': '#d9be93', '--ink': '#2a2724', '--ink-soft': '#6b655d', '--paper': '#f7f3ec' },
  };
  const stationArrays = (extra: { buildMode?: boolean; highlight?: string; selected?: string; overhang?: boolean } = {}) => {
    const g: Graph = { pieces: [{ pieceId: 'st', partId: 'ST', turn: 'left' }, { pieceId: 'rs', partId: 'RS', turn: 'left' }], welds: [], anchors: new Map([['st', { pos: fromInt(0), heading: 0 }], ['rs', { pos: fromInt(400), heading: 0 }]]) };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    const partOf = (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId);
    const arrays = buildScene({
      segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf, riseMm: 61, plankMm: 12,
      table: { outline: [[-50, -300], [900, -300], [900, 300], [-50, 300]], overhang: extra.overhang ?? false },
      ...(extra.buildMode ? { buildMode: true } : {}),
      ...(extra.highlight ? { highlight: extra.highlight } : {}),
      ...(extra.selected ? { selected: extra.selected } : {}),
    });
    // A level fault across the station: its red line rises through the roof (as `marks` places it).
    return { ...arrays, marks: [{ kind: 'level' as const, at: [10, -50, 12] as const, lineTo: 120 }] };
  };
  const structuresMesh = (group: Group) =>
    group.children.find((o): o is ThreeMesh => o instanceof ThreeMesh && (o as ThreeMesh).geometry.getAttribute('color') !== undefined)!;

  /*
   * MUTATION PROOF, run: the colour attribute written from the hex's sRGB
   * channels (`convertLinearToSRGB`), not Color's linear ones: `expected [ 3882,
   * 5569, 4392 ] to deeply equal [ 1248, 2705, 1620 ]`, every paint washed out.
   */
  it('each vertex carries its paint in linear values, unpainted ones the slab side, on a white base', () => {
    const group = new Group();
    const arrays = stationArrays();
    syncScene(group, arrays, PAINTED);
    const mesh = structuresMesh(group);
    const color = mesh.geometry.getAttribute('color');
    const { solidPaint, paints } = arrays.structures;
    const roofAt = solidPaint.findIndex((k) => paints[k] === '--paint-roof');
    const plainAt = solidPaint.findIndex((k) => k === 0);
    const roof = new Color('#638e70');
    const plain = new Color(C.slabSide);
    expect([color.getX(roofAt), color.getY(roofAt), color.getZ(roofAt)].map((n) => Math.round(n * 1e4))).toEqual([roof.r, roof.g, roof.b].map((n) => Math.round(n * 1e4)));
    expect([color.getX(plainAt), color.getY(plainAt), color.getZ(plainAt)].map((n) => Math.round(n * 1e4))).toEqual([plain.r, plain.g, plain.b].map((n) => Math.round(n * 1e4)));
    const material = mesh.material as MeshBasicMaterial;
    expect([material.vertexColors, material.color.getHex()]).toEqual([true, 0xffffff]);
  });

  /*
   * MUTATION PROOF, run: `flat()` turning vertex colours on for every mesh:
   * `expected [ true, true, true, true, true, …(4) ] to deeply equal [ true ]`.
   */
  it('only the buildings mesh reads vertex colours', () => {
    const group = new Group();
    syncScene(group, stationArrays(), PAINTED);
    const flags = group.children.filter((o): o is ThreeMesh => o instanceof ThreeMesh && (o as ThreeMesh).material instanceof MeshBasicMaterial).map((m) => (m.material as MeshBasicMaterial).vertexColors).filter(Boolean);
    expect(flags).toEqual([true]);
  });

  type Lined = { material: { color: Color; linewidth: number; depthTest: boolean }; renderOrder: number };
  const linesOf = (group: Group) => group.children.filter((o) => typeof (o as unknown as Lined).material?.linewidth === 'number').map((o) => o as unknown as Lined);
  const paperHex = new Color(C.paper).getHex();
  /** Each line of this colour and width, and whether a paper line 4px wider sits one order below it, with the same depth test. */
  const haloOf = (group: Group, color: string, px: number) =>
    linesOf(group)
      .filter((l) => l.material.color.getHex() === new Color(color).getHex() && l.material.linewidth === px)
      .map((l) => linesOf(group).some((h) => h.material.color.getHex() === paperHex && h.material.linewidth === px + 4 && h.renderOrder === l.renderOrder - 1 && h.material.depthTest === l.material.depthTest));

  /*
   * MUTATION PROOFS, run:
   * - the selection drawn plain again: `expected [ false ] to deeply equal [ true ]`.
   * - the level line drawn plain again: the same, for the --fail 2px line.
   */
  it('a paper halo backs the selection, the clash-red lines and the next piece’s outline', () => {
    const selected = new Group();
    syncScene(selected, stationArrays({ selected: 'st' }), PAINTED);
    expect(haloOf(selected, C.ink, 3)).toEqual([true]);
    expect(haloOf(selected, C.fail, 2)).toEqual([true]);
    const overhang = new Group();
    syncScene(overhang, stationArrays({ overhang: true }), PAINTED);
    expect(haloOf(overhang, C.fail, 1.5)).toEqual([true]);
    const build = new Group();
    syncScene(build, stationArrays({ buildMode: true, highlight: 'st' }), PAINTED);
    // The next building's outline (order 4); the next track's own outline sits on beech and keeps plain ink.
    expect(linesOf(build).filter((h) => h.material.color.getHex() === paperHex && h.material.linewidth === 7 && h.renderOrder === 3)).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: outlines drawn in --ink-soft whatever the paint
   * (no `colors` passed): `expected false to be true`.
   */
  it('outlines carry each paint’s line colour per vertex', () => {
    const group = new Group();
    syncScene(group, stationArrays(), PAINTED);
    const outline = group.children.find((o) => (o as unknown as Lined).material?.linewidth === 1.5 && (o as unknown as { material: { vertexColors: boolean } }).material.vertexColors) as unknown as { geometry: { attributes: Record<string, { array: ArrayLike<number> }> } } | undefined;
    expect(outline !== undefined).toBe(true);
    // The base's paper lines are among them: some vertex is the paper's linear colour.
    const paper = new Color(C.paper);
    const cols = outline!.geometry.attributes.instanceColorStart!.array;
    let found = false;
    for (let i = 0; i < cols.length; i += 3) if (Math.abs(cols[i]! - paper.r) < 1e-4 && Math.abs(cols[i + 2]! - paper.b) < 1e-4) found = true;
    expect(found).toBe(true);
  });
});
