/**
 * A CLICK IN 3D FINDS ITS PIECE, AND A TURN PICKS NOTHING (P3, pick in 3D).
 *
 * Value: protects=a ray through a piece's top or side names that piece, not
 * its neighbour; grooves, beams and footprints let the ray through to their
 * wood, and a structure or the table in front picks nothing; a press that
 * moves past the slop is a turn, not a click
 * Value: fails_when=the triangle-to-piece runs are read in the wrong unit,
 * the sides stop naming their pieces, the nearest hit stops winning, or the
 * slop is dropped or widened
 * Value: why_new=the 3D view picked nothing before
 * Value: seam=none: `pickPiece`, `pieceOfHits` and `isClick` are the
 * viewer's own functions, run on the scene `syncScene` builds with real three
 * objects, whose ray casting needs no WebGL
 * Value: no_claim=the browser's pointer events or what is drawn; the wiring to
 * the editor is view3d.dom.test.tsx, the pixels the browser pass
 */

import { Group, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { buildScene, type SceneArrays } from '../../engine/src/view3d/mesh.js';
import { CLICK_SLOP_PX, isClick, pickPiece, pieceOfHits, syncScene, type SceneColors } from './Viewer3D.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const C: SceneColors = {
  floor: '#ece6da', trackFill: '#d9be93', trackEdge: '#8a7349', trackGroove: '#9c7f50', trackShadow: '#8f826c',
  seam: '#6e5a38', ink: '#2a2724', inkSoft: '#6b655d', paper: '#f7f3ec', paperSunk: '#efe9df', fail: '#b3261e', slabSide: '#bdb19b',
};

/** Straights in a row along x from the origin, on a table, drawn into a group. */
function row(ids: readonly string[]): { group: Group; arrays: SceneArrays } {
  const g: Graph = {
    pieces: ids.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
    welds: ids.slice(1).map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${i + 1}`, port: 0 } })),
    anchors: new Map([['p0', { pos: fromInt(0), heading: 0 }]]),
  };
  const r = renderGraph(g, ports, resolve, placeAll(g, ports));
  const partOf = (id: string) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId);
  const arrays = buildScene({
    segments: r.segments, ports: r.ports, welds: g.welds, partOf, riseMm: 64, plankMm: 12,
    table: { outline: [[-500, -500], [2000, -500], [2000, 500], [-500, 500]], overhang: false },
  });
  const group = new Group();
  syncScene(group, arrays, C);
  group.updateMatrixWorld(true);
  return { group, arrays };
}

const centre = (a: SceneArrays, id: string) => {
  const b = a.pieceBounds.get(id)!;
  return new Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
};

/** A camera at `from`, looking at `at`, with the view's centre on that point. */
function looking(from: Vector3, at: Vector3): PerspectiveCamera {
  const cam = new PerspectiveCamera(30, 1, 1, 100000);
  cam.up.set(0, 0, 1);
  if (Math.abs(from.x - at.x) < 1e-6 && Math.abs(from.y - at.y) < 1e-6) cam.up.set(0, 1, 0);
  cam.position.copy(from);
  cam.lookAt(at);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('a ray names the piece it reaches', () => {
  /*
   * MUTATION PROOF, run: `pieceAtFace` reads the runs in triangles
   * (`const at = faceIndex` instead of `faceIndex * 3`): `expected 'p0' to be
   * 'p1'` (the side and pass-through tests fail with it).
   */
  it('straight down on each piece of a row picks that piece', () => {
    const { group, arrays } = row(['A', 'A', 'A']);
    for (const id of ['p0', 'p1', 'p2']) {
      const c = centre(arrays, id);
      const cam = looking(c.clone().add(new Vector3(0, 0, 2000)), c);
      expect(pickPiece(group, cam, { x: 0, y: 0 })).toBe(id);
    }
  });

  /*
   * MUTATION PROOF, run: the plank sides no longer named their pieces
   * (`wood(…plankSide…, arrays.sideRanges)` replaced by a bare mesh): `expected
   * null to be 'p1'`.
   */
  it("a click on a piece's side picks it, seen level from the floor", () => {
    const { group, arrays } = row(['A', 'A', 'A']);
    const c = centre(arrays, 'p1');
    const cam = looking(new Vector3(c.x, c.y - 3000, c.z), c);
    expect(pickPiece(group, cam, { x: 0, y: 0 })).toBe('p1');
  });

  /*
   * MUTATION PROOF, run: `pieceOfHits` passed through any hit without wood
   * (`continue` instead of `return null`), so the table no longer hid the
   * piece from a ray from beneath: `expected 'p0' to be null`.
   */
  it('a click on the empty table, or on nothing, picks nothing', () => {
    const { group, arrays } = row(['A']);
    const c = centre(arrays, 'p0');
    // Down on the table well clear of the piece, then up into the sky.
    expect(pickPiece(group, looking(new Vector3(c.x, c.y + 300, 2000), new Vector3(c.x, c.y + 300, 0)), { x: 0, y: 0 })).toBe(null);
    expect(pickPiece(group, looking(new Vector3(c.x, c.y, 50), new Vector3(c.x, c.y, 5000)), { x: 0, y: 0 })).toBe(null);
    // Through the table from beneath, the piece is hidden by it.
    expect(pickPiece(group, looking(new Vector3(c.x, c.y, -2000), c), { x: 0, y: 0 })).toBe(null);
  });
});

describe('what the ray passes through, nearest first', () => {
  const wood = { userData: { pieceRanges: new Map([['a', { start: 0, count: 6 }], ['b', { start: 6, count: 6 }]]) } };
  const groove = { userData: { pickThrough: true } };
  const building = { userData: {} };

  /*
   * MUTATION PROOF, run: grooves no longer let the ray through (`if
   * (h.object.userData.pickThrough) continue;` removed): `expected null to be
   * 'b'`. The scene tests above survive that one, since a ray at a piece's
   * centre falls between its grooves; this test is what holds it. And
   * `return null` replaced by `continue`: `expected 'a' to be null`.
   */
  it('a groove lets the ray through to its wood; a building in front stops it', () => {
    expect(pieceOfHits([{ object: groove }, { object: wood, faceIndex: 2 }])).toBe('b');
    expect(pieceOfHits([{ object: building }, { object: wood, faceIndex: 0 }])).toBe(null);
    expect(pieceOfHits([{ object: wood, faceIndex: 1 }, { object: wood, faceIndex: 3 }])).toBe('a');
    expect(pieceOfHits([])).toBe(null);
  });
});

describe('a click is a press that stays put', () => {
  /*
   * MUTATION PROOF, run: the slop check reads `<= CLICK_SLOP_PX + 10`:
   * `expected true to be false`.
   */
  it(`moving up to ${CLICK_SLOP_PX}px is a click; any further is turning the view`, () => {
    const at = { x: 100, y: 100 };
    expect(isClick(at, at)).toBe(true);
    expect(isClick(at, { x: 103, y: 104 })).toBe(true);
    expect(isClick(at, { x: 106, y: 100 })).toBe(false);
    expect(isClick(at, { x: 100, y: 60 })).toBe(false);
  });
});
