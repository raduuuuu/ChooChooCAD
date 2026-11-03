/**
 * STATIONS, PIERS AND TUNNELS IN THE APP (plan 2026-11-02; design decisions
 * 1, 2, 7; eng E4, EO6, OV2).
 *
 * Value: protects=a structure is never corrected from storage (OV2); every
 * reader that means "all wood" reads the bodies: the part card's drawing, the
 * canvas's bounds and table fit, the 3D scene, and the editor's own wood
 * check, so a pier dropped on track is refused like track on track
 * Value: fails_when=a submission replaces a structure, or one of those
 * readers goes back to reading segments alone
 * Value: why_new=no wood that is not track was drawn or placed before
 * Value: seam=none: the real catalogue, renderer, reducer and mesh builder
 * Value: no_claim=how bodies look (checked in the browser) and the real
 * pieces' sizes, which are estimates
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver, resolveLibrary } from '../../engine/data/library.js';
import { PIER, TUNNEL } from '../../engine/data/structureSeeds.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderBounds, renderGraph } from '../../engine/src/graph/render.js';
import { buildScene } from '../../engine/src/view3d/mesh.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, ghostFit, shiftMm } from './layoutModel.js';
import { previewOf } from './previewGeometry.js';
import { trackExtent } from './tableModel.js';

// The retired pier and roofed tunnel stay as fixtures: the only block and the only roof over a floor road.
const resolve = makeResolver([...BUILT_IN, PIER, TUNNEL]);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;
const drawnAlone = (partId: string) => {
  const g: Graph = { pieces: [{ pieceId: 'p', partId, turn: 'left' }], welds: [] };
  return renderGraph(g, ports, resolve, placeAll(g, ports));
};

describe('a structure is built-in only (OV2)', () => {
  /*
   * MUTATION PROOF, run: the structure guard in resolveLibrary dropped fails
   * with `expected undefined to be 1`: a measured two-ended "correction"
   * replaced the station and its deck went with it.
   */
  it('a measured correction of the station leaves the built-in station', () => {
    const a = resolve('A');
    const lib = resolveLibrary([
      {
        submissionId: 'sub-st',
        at: '2026-11-03T10:00:00Z',
        part: { ...a, id: 'ST', dimensions: { status: 'user-measured', source: 'test', submittedAt: '2026-11-03T10:00:00Z', corroborations: 1 } },
      },
    ]);
    const st = lib.find((p) => p.id === 'ST')!;
    expect(st.kind === 'straight' ? st.deck : null).toBe(1);
    expect(st.body).toHaveLength(2);
  });
});

describe('every reader of "all wood" reads the bodies', () => {
  /*
   * MUTATION PROOF, run: the bodies left out of the card's drawing fails with
   * `expected [] to deeply equal [ false, true ]`.
   */
  it("a structure's card draws its footprint, and its roof hatched", () => {
    expect(previewOf(resolve('ST')).bodies.map((b) => b.roof)).toEqual([false, true]);
    expect(previewOf(resolve('TU')).bodies.map((b) => b.roof)).toEqual([false, false, true]);
    expect(previewOf(resolve('RS')).bodies.map((b) => b.roof)).toEqual([false, false, false, false]);
    expect(previewOf(resolve('TO')).bodies.map((b) => b.roof)).toEqual([false, false]);
    const pier = previewOf(resolve('PR'));
    expect(pier.bodies).toHaveLength(1);
    expect(pier.ends).toEqual([]);
  });

  /*
   * MUTATION PROOF, run: renderBounds ignoring bodies fails with `expected +0
   * to be 40`: a lone pier framed as a point.
   */
  it('a lone pier has an extent, on the canvas and against the table', () => {
    const r = drawnAlone('PR');
    const b = renderBounds(r);
    expect(b.maxX - b.minX).toBe(40);
    const e = trackExtent([...r.segments, ...r.bodies], half)!;
    expect(e.maxY - e.minY).toBeCloseTo(40, 9);
  });

  /*
   * MUTATION PROOF, run: the box top taken as `lo * riseMm` (no height)
   * fails with `expected +0 to be 64`.
   */
  it('in 3D, a pier stands from the floor to the underside of raised track; a roof is a rim only', () => {
    const pier = drawnAlone('PR');
    const scene = buildScene({ segments: pier.segments, bodies: pier.bodies, ports: pier.ports, welds: [], partOf: () => resolve('PR'), riseMm: 64, plankMm: 12 });
    expect(scene.structures.solid.indices.length).toBeGreaterThan(0);
    expect(scene.bounds.max[2] - scene.bounds.min[2]).toBe(64);
    const tun = drawnAlone('TU');
    const t = buildScene({ segments: tun.segments, bodies: tun.bodies, ports: tun.ports, welds: [], partOf: () => resolve('TU'), riseMm: 64, plankMm: 12 });
    // Two walls of five faces each, two triangles a face; the roof adds only its four rim faces.
    expect(t.structures.solid.indices.length / 3).toBe(2 * 5 * 2);
    expect(t.structures.rim.indices.length / 3).toBe(4 * 2);
  });

  /*
   * MUTATION PROOF, run: ghostFit reading `.segments` again instead of all
   * the wood fails with `expected [] to deeply equal [ { kind: 'over',
   * pieceId: 'p0' } ]`: the pier went down on top of the straight.
   */
  it('a pier dropped on floor track is refused like track on track', () => {
    const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports, { resolve });
    const placed = act({ graph: EMPTY_GRAPH, cursor: null, armed: null }, { kind: 'add', partId: 'A', turn: 'left' });
    const floated = act(act(placed, { kind: 'pick', partId: 'PR' }), { kind: 'floatGhost', pos: shiftMm(72, 0) });
    expect(ghostFit(floated.graph, ports, floated.ghost!, undefined, undefined, { resolve }).conflicts).toEqual([
      { kind: 'over', pieceId: 'p0' },
    ]);
    const clear = act(act(placed, { kind: 'pick', partId: 'PR' }), { kind: 'floatGhost', pos: shiftMm(72, 200) });
    expect(ghostFit(clear.graph, ports, clear.ghost!, undefined, undefined, { resolve }).conflicts).toEqual([]);
  });
});

describe('a piece with no ends lands selected (design decision 3)', () => {
  /*
   * MUTATION PROOFS, run:
   * - `add` not selecting a piece with no ends: fails with `expected
   *   undefined to be 'p0'`.
   * - `placeGhost` not selecting one: fails with `expected null to be 'p0'`.
   */
  it('added straight away or picked and placed, the pier is the selected piece', () => {
    const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports, { resolve });
    const empty: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
    expect(act(empty, { kind: 'add', partId: 'PR', turn: 'left' }).selected).toBe('p0');
    expect(act(act(empty, { kind: 'pick', partId: 'PR' }), { kind: 'placeGhost' }).selected).toBe('p0');
  });
});
