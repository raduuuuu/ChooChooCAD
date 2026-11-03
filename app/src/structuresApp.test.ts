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

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver, resolveLibrary } from '../../engine/data/library.js';
import { PIER, TUNNEL } from '../../engine/data/structureSeeds.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderBounds, renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { VerdictLine } from './VerdictLine.js';
import { viewOf } from './verdictView.js';
import { buildScene, PLATE_DROP_MM } from '../../engine/src/view3d/mesh.js';
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

describe('the track support (more parts plan 2026-11-03)', () => {
  /*
   * MUTATION PROOFS, run:
   * - its width 40, not 52: fails with `expected [ 25, 40 ] to deeply equal [ 25, 52 ]`.
   * - its body filling levels [0, 1]: fails with `expected 122 to be 61` here
   *   and `expected [ { kind: 'over', pieceId: 'p1' } ] to deeply equal []`
   *   below: it would block the raised track it holds.
   */
  it('stands 25 by 52, from the floor to the underside of raised track', () => {
    const r = drawnAlone('TS');
    const b = renderBounds(r);
    expect([b.maxX - b.minX, b.maxY - b.minY]).toEqual([25, 52]);
    const scene = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('TS'), riseMm: 61, plankMm: 12 });
    expect(scene.bounds.max[2] - scene.bounds.min[2]).toBe(61);
  });

  it('goes under raised track, and is refused on floor track', () => {
    const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports, { resolve });
    const ramp = act({ graph: EMPTY_GRAPH, cursor: null, armed: null }, { kind: 'add', partId: 'N', turn: 'left' });
    const raised = act(ramp, { kind: 'add', partId: 'A', turn: 'left' });
    const under = act(act(raised, { kind: 'pick', partId: 'TS' }), { kind: 'floatGhost', pos: shiftMm(216 + 72, 0) });
    expect(ghostFit(under.graph, ports, under.ghost!, undefined, undefined, { resolve }).conflicts).toEqual([]);
    const onFloor = act(act(raised, { kind: 'pick', partId: 'TS' }), { kind: 'floatGhost', pos: shiftMm(20, 0) });
    expect(ghostFit(onFloor.graph, ports, onFloor.ghost!, undefined, undefined, { resolve }).conflicts).toEqual([
      { kind: 'over', pieceId: 'p0' },
    ]);
  });
});

describe('the double crossing (more parts plan 2026-11-03)', () => {
  /*
   * MUTATION PROOF, run: the second road 44 from the first, not 46: fails
   * with `expected [ 1, true, 2, +0, +0 ] to deeply equal [ 1, true, +0, +0, +0 ]`.
   */
  it('its pair of tracks, 46 apart, takes the large double curve exactly', () => {
    const g: Graph = {
      pieces: [{ pieceId: 'x', partId: 'HH', turn: 'left' }, { pieceId: 'e', partId: 'EE', turn: 'left' }],
      welds: [
        { a: { pieceId: 'x', port: 3 }, b: { pieceId: 'e', port: 0 } },
        { a: { pieceId: 'x', port: 1 }, b: { pieceId: 'e', port: 2 } },
      ],
    };
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const view = viewOf(solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies));
    expect([view.rank, view.gapKnown, view.gapMm, view.clashCount, view.overlapCount]).toEqual([1, true, 0, 0, 0]);
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

describe('the riser in 3D: posts and a plate (riser plan 2026-11-03)', () => {
  /*
   * MUTATION PROOF, run: the plate dropped from the seed fails with
   * `expected 0 to be greater than or equal to 4`: nothing at the plate's top.
   */
  it('lays a 58 by 58 plate on its posts, its top just under the road', () => {
    const r = drawnAlone('RS');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('RS'), riseMm: 61, plankMm: 12 });
    const p = s.structures.solid.positions;
    const top: [number, number][] = [];
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 2]! - (61 + 12 - PLATE_DROP_MM)) < 1e-6) top.push([p[i]!, p[i + 1]!]);
    const span = (k: 0 | 1) => Math.max(...top.map((v) => v[k])) - Math.min(...top.map((v) => v[k]));
    expect(top.length).toBeGreaterThanOrEqual(4);
    expect(span(0)).toBeCloseTo(58, 6);
    expect(span(1)).toBeCloseTo(58, 6);
  });
});

describe('the stone arch bridge in 3D (bridges eng D2, D5, D9, D11)', () => {
  const scene3d = (marks: Parameters<typeof buildScene>[0]['marks'] = []) => {
    const r = drawnAlone('SA');
    return buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('SA'), riseMm: 61, plankMm: 12, marks });
  };

  /*
   * MUTATION PROOF, run: the measured profile ignored (topOf back to levels
   * only) fails with `expected 88 to be close to 100`: the road drawn flat at
   * the raised level, with only the arch band above it.
   */
  it('the road follows its measured profile up to the crown, over the arch band', () => {
    const s = scene3d();
    expect(s.bounds.max[2]).toBeCloseTo(100, 0);
    expect(s.structures.solid.indices.length).toBeGreaterThan(0);
  });

  /*
   * MUTATION PROOF, run: a marker taking the piece's highest stretch again
   * fails with `expected 57.1 to be close to 14.9`: it floated at the top.
   */
  it('a clash mark at the foot of the slope sits on the slope, not at the crown', () => {
    const s = scene3d([{ kind: 'overlap', at: [30, 0], source: { kind: 'overlap', a: 'p', b: 'p' } }]);
    expect(s.marks[0]!.at[2]).toBeCloseTo(14.9, 0);
  });
});

describe('the clearance under a bridge (bridges design DD5)', () => {
  const text = (clearanceMm: number) =>
    renderToStaticMarkup(
      createElement(VerdictLine, {
        view: viewOf(solveAlone()),
        bridgeNotes: [{ name: 'stone arch bridge', piece: 1, clearanceMm }],
      }),
    ).replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;|’/g, "'");
  const solveAlone = () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'SA', turn: 'left' }], welds: [] };
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    return solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies);
  };

  /*
   * MUTATION PROOF, run: the sentence left out of the notes fails with
   * `expected '?Not a loop yet. 1 piece, open at bot…' to contain 'Under the
   * stone arch bridge (piece 1)…'`.
   */
  it('says the room to spare, and says plainly when the train will not fit', () => {
    expect(text(69.2)).toContain('Under the stone arch bridge (piece 1): about 2mm to spare (69mm opening, 12mm track, 55mm train).');
    expect(text(60)).toContain("Your 55mm train won't fit under the stone arch bridge (piece 1): 60mm opening.");
  });
});

describe('the suspension bridge in 3D and in words (bridges plan B-T6)', () => {
  /*
   * MUTATION PROOF, run: the towers dropped from the seed fails with
   * `expected 73 to be close to 240`: no tower rises above the deck.
   */
  it('stands its towers to their heights, with cables between them', () => {
    const r = drawnAlone('SB');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('SB'), riseMm: 61, plankMm: 12 });
    expect(s.bounds.max[2]).toBeCloseTo(240, 0);
    expect(s.structures.edges.positions.length).toBeGreaterThan(1000);
  });

  /*
   * MUTATION PROOF, run: `estimated` ignored by the sentence fails with
   * `expected '?Not a loop yet. 1 piece, open at bot…' to contain 'Your 55mm
   * train won\'t fit under the …'`.
   */
  it('says when the opening under a bridge is an estimate', () => {
    const g: Graph = { pieces: [{ pieceId: 'p', partId: 'SB', turn: 'left' }], welds: [] };
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const view = viewOf(solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies));
    const html = renderToStaticMarkup(createElement(VerdictLine, { view, bridgeNotes: [{ name: 'suspension bridge', piece: 1, clearanceMm: 61, estimated: true }] }))
      .replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;|’/g, "'");
    expect(html).toContain("Your 55mm train won't fit under the suspension bridge (piece 1): 61mm opening. The opening is an estimate.");
  });
});
