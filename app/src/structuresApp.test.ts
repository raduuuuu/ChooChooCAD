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
import { bridgeNotesOf, tunnelNotesOf, viewOf } from './verdictView.js';
import { buildScene, PLATE_DROP_MM } from '../../engine/src/view3d/mesh.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH, ghostFit, shiftMm, swapsOf } from './layoutModel.js';
import { previewOf } from './previewGeometry.js';
import { afterKey, ghostKeys } from './ghostKeys.js';
import { describeAction } from './announce.js';
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

describe('the harbour arch bridge in 3D (Sydney bridge plan 2026-11-03)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the truss arch dropped from the seed: `expected 127 to be close to 142.5`.
   * - the pylons' height dropped: `expected 0 to be greater than or equal to 16`.
   */
  it('stands its pylons 127 tall and its arch over the deck to 142.5', () => {
    const r = drawnAlone('HB');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('HB'), riseMm: 61, plankMm: 12 });
    expect(s.bounds.max[2]).toBeCloseTo(142.5, 6);
    const p = s.structures.solid.positions;
    let pylonTops = 0;
    for (let i = 2; i < p.length; i += 3) if (Math.abs(p[i]! - 127) < 1e-6) pylonTops++;
    expect(pylonTops).toBeGreaterThanOrEqual(16);
  });
});

describe('the level crossing drawn flat and in 3D (decorated-pieces plan T3, design 6A)', () => {
  /*
   * MUTATION PROOF, run: non-solid decoration drawn flat fails with `expected
   * [ …(4) ] to have a length of 2 but got 4`.
   */
  it('its card draws the two posts as slabs, never the arms', () => {
    expect(previewOf(resolve('LC')).bodies).toHaveLength(2);
    expect(previewOf(resolve('HP')).bodies).toHaveLength(0);
  });

  /*
   * MUTATION PROOF, run: the arms dropped fails with `expected 31 to be close to 132`.
   */
  it('in 3D its posts stand 31mm and its arms rise to 132mm', () => {
    const r = drawnAlone('LC');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('LC'), riseMm: 61, plankMm: 12 });
    expect(s.bounds.max[2]).toBeCloseTo(132, 6);
  });
});

describe('the station straight, placed and flipped (plan T4, eng D5, design 4A/5A)', () => {
  const act = (st: EditorState, a: EditorAction) => reduce(st, a, ports, { resolve });
  const empty: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };

  /*
   * MUTATION PROOF, run: the placing keys ignoring a straight's flip fails with
   * `expected null to deeply equal { label: 'Other side', …(2) }`.
   */
  it('while placing, F reads "Other side" and says the platform moved', () => {
    const picked = act(empty, { kind: 'pick', partId: 'SS' });
    const keys = ghostKeys(picked.graph, ports, picked.ghost!, resolve('SS'));
    expect(keys.flip).toEqual({ label: 'Other side', verb: 'put the platform on the other side', enabled: true });
    const flipped = act(picked, { kind: 'flipGhost' });
    expect([flipped.ghost!.turn, afterKey('flipGhost', resolve('SS'), flipped.ghost!)]).toEqual(['right', 'Platform on the other side.']);
  });

  /*
   * MUTATION PROOF, run: the flip left out of undo history fails with
   * `expected { pieces: [ { …(3) } ], …(2) } to deeply equal { … }`.
   */
  it('a placed station moves its platform across, keeps its joint, and undoes', () => {
    const two = act(act(empty, { kind: 'add', partId: 'A', turn: 'left' }), { kind: 'add', partId: 'SS', turn: 'left' });
    const station = two.graph.pieces[1]!.pieceId;
    const flipped = act(two, { kind: 'flipPiece', pieceId: station });
    expect(flipped.graph.pieces[1]!.turn).toBe('right');
    expect(flipped.graph.welds).toEqual(two.graph.welds);
    expect(describeAction(two, { kind: 'flipPiece', pieceId: station }, flipped, resolve)).toBe('Piece 2: Platform on the other side.');
    expect(act(flipped, { kind: 'undo' }).graph).toEqual(two.graph);
  });

  /*
   * MUTATION PROOF, run: the refusal check off, or the wrapper wiping a flip's
   * refusal, fails with `expected [ { …(3) }, null, null ] to deeply equal [ … ]`.
   */
  it("a flip that would put the platform on other track is refused, naming the piece", () => {
    // The station free at the origin; a straight 70 across on its right, clear of it until it flips.
    const placed = act(empty, { kind: 'add', partId: 'SS', turn: 'left' });
    const station = placed.graph.pieces[0]!.pieceId;
    const withNeighbour = act(act(placed, { kind: 'pick', partId: 'A' }), { kind: 'floatGhost', pos: shiftMm(0, 70) });
    const both = act(withNeighbour, { kind: 'placeGhost' });
    expect(both.graph.pieces).toHaveLength(2);
    const refused = act(both, { kind: 'flipPiece', pieceId: station });
    expect([refused.graph, refused.refusalOf, refused.refusal]).toEqual([both.graph, 'put the platform on the other side', 'its platform would sit on piece 2']);
    expect(describeAction(both, { kind: 'flipPiece', pieceId: station }, refused, resolve)).toBe("Can't put the platform on the other side: its platform would sit on piece 2.");
    const next = act(refused, { kind: 'selectPiece', pieceId: station });
    expect([next.refusal, next.refusalOf]).toEqual([null, null]);
  });

  it('in 3D its clock tower reaches 136mm', () => {
    const r = drawnAlone('SS');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('SS'), riseMm: 61, plankMm: 12 });
    expect(s.bounds.max[2]).toBeCloseTo(136, 6);
  });
});

describe('swapping a placed piece, plain and decorated (plan T6, CEO E8, design 3A/4A, O1)', () => {
  const act = (st: EditorState, a: EditorAction) => reduce(st, a, ports, { resolve });
  const empty: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
  const offers = (id: string, lib = BUILT_IN, res = resolve) => swapsOf(res(id), lib, res).map((p) => p.id);

  /*
   * MUTATION PROOF, run: the base left out of a decorated piece's options
   * fails with `expected [ [ 'SS' ], [], [ 'TT' ], [], …(4) ] to deeply
   * equal [ [ 'SS' ], [ 'A' ], [ 'TT' ], …(5) ]`.
   */
  it('a plain piece offers its decorated versions, a decorated one its plain base, others nothing', () => {
    expect(['A', 'SS', 'D', 'TT', 'HP', 'LC', 'E', 'HB'].map((id) => offers(id))).toEqual([['SS'], ['A'], ['TT'], ['D'], ['LC'], ['HP'], [], []]);
  });

  /*
   * MUTATION PROOF, run: `swapsOf` offering every version unchecked fails with
   * `expected [ [ 'SS' ], [ 'A' ] ] to deeply equal [ [], [] ]`.
   */
  it('a stored correction of the base whose length differs hides the swap both ways (O1)', () => {
    const a = resolve('A');
    if (a.kind !== 'straight') throw new Error('A is a straight');
    const lib = resolveLibrary([
      {
        submissionId: 'sub-a',
        at: '2026-11-04T10:00:00Z',
        part: { ...a, lengthMm: 145, dimensions: { status: 'user-measured', source: 'test', submittedAt: '2026-11-04T10:00:00Z', corroborations: 1 } },
      },
    ]);
    const res = makeResolver(lib);
    expect([offers('A', lib, res), offers('SS', lib, res)]).toEqual([[], []]);
  });

  /*
   * MUTATION PROOF, run: the swap left out of undo history fails with
   * `expected { pieces: [ { …(3) } ], …(2) } to deeply equal { Object
   * (pieces, welds, ...) }`: undo took back the last piece instead.
   */
  it('makes a placed straight a station and back, keeping its joint, said aloud and undoable', () => {
    const two = act(act(empty, { kind: 'add', partId: 'A', turn: 'left' }), { kind: 'add', partId: 'A', turn: 'left' });
    const second = two.graph.pieces[1]!.pieceId;
    const dress = { kind: 'swapPiece', pieceId: second, partId: 'SS' } as const;
    const dressed = act(two, dress);
    expect([dressed.graph.pieces[1]!.partId, dressed.graph.welds]).toEqual(['SS', two.graph.welds]);
    expect(describeAction(two, dress, dressed, resolve)).toBe('Piece 2 is now a Station straight.');
    const undone = act(dressed, { kind: 'undo' });
    expect(undone.graph).toEqual(two.graph);
    expect(describeAction(dressed, { kind: 'undo' }, undone, resolve)).toBe('Undid the swap. The piece is back as it was.');
    const plain = { kind: 'swapPiece', pieceId: second, partId: 'A' } as const;
    const back = act(dressed, plain);
    expect(back.graph.pieces).toEqual(two.graph.pieces);
    expect(describeAction(dressed, plain, back, resolve)).toBe('Piece 2 is now a Medium straight.');
  });

  /*
   * MUTATION PROOF, run: the clash check left out of `swapPiece` fails with
   * `expected [ { …(3) }, null, null ] to deeply equal [ { …(3) }, …(2) ]`;
   * a swap between unrelated parts (A to E) allowed fails with `expected
   * { …(10) } to be { …(8) } // Object.is equality`.
   */
  it('a swap whose platform would sit on other track is refused, naming the piece; unrelated parts never swap', () => {
    // A straight at the origin and another 70 across, where the station's platform would go.
    const placed = act(empty, { kind: 'add', partId: 'A', turn: 'left' });
    const first = placed.graph.pieces[0]!.pieceId;
    const both = act(act(act(placed, { kind: 'pick', partId: 'A' }), { kind: 'floatGhost', pos: shiftMm(0, -70) }), { kind: 'placeGhost' });
    expect(both.graph.pieces).toHaveLength(2);
    const dress = { kind: 'swapPiece', pieceId: first, partId: 'SS' } as const;
    const refused = act(both, dress);
    expect([refused.graph, refused.refusalOf, refused.refusal]).toEqual([both.graph, 'make it a Station straight', 'its platform would sit on piece 2']);
    expect(describeAction(both, dress, refused, resolve)).toBe("Can't make it a Station straight: its platform would sit on piece 2.");
    expect(act(both, { kind: 'swapPiece', pieceId: first, partId: 'E' })).toBe(both);
  });
});

describe('the tunnel straight in words, flat and in 3D (plan T5, eng D7, D10)', () => {
  /*
   * MUTATION PROOF, run: the opening taken to the vault's outside top fails with
   * `expected [ { name: 'tunnel straight', …(2) } ] to deeply equal [ … ]`.
   */
  it('states the room over the train like a bridge, from the vault\'s opening', () => {
    const g: Graph = { pieces: [{ pieceId: 'a', partId: 'A', turn: 'left' }, { pieceId: 't', partId: 'TT', turn: 'left' }], welds: [] };
    const notes = tunnelNotesOf(g.pieces, resolve, (id) => (id === 'a' ? 1 : 2));
    expect(notes).toEqual([{ name: 'tunnel straight', piece: 2, clearanceMm: 79.5 }]);
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const html = renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies)), bridgeNotes: notes }))
      .replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;|’/g, "'");
    expect(html).toContain('Under the tunnel straight (piece 2): about 13mm to spare (80mm opening, 12mm track, 55mm train).');
  });

  it('its card draws the two walls as slabs and the roof as a roof', () => {
    expect(previewOf(resolve('TT')).bodies.map((b) => b.roof)).toEqual([false, false, true]);
  });

  /*
   * MUTATION PROOF, run: the vault not drawn fails with `expected 12 to be
   * close to 85.5`; the collision boxes drawn too fails with `expected [ 396,
   * 24 ] to deeply equal [ 336, +0 ]`.
   */
  it('in 3D the vault is drawn round, to 85.5mm, and its collision boxes are not drawn', () => {
    const r = drawnAlone('TT');
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: () => resolve('TT'), riseMm: 61, plankMm: 12 });
    expect(s.bounds.max[2]).toBeCloseTo(85.5, 6);
    // A box-drawn roof would put solid corners at its full 25.5 half-width at 85.5; the round vault's top is a single ridge.
    const pos = s.structures.solid.positions;
    const atTop = new Set<number>();
    for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i + 2]! - 85.5) < 1e-6) atTop.add(Math.round(pos[i + 1]! * 10) / 10);
    expect(atTop.size).toBe(1);
    // Drawn from the vault alone: the walls' and roof's collision boxes add nothing, solid or rim.
    const vaultOnly = buildScene({ segments: r.segments, bodies: r.bodies.filter((b) => b.decor?.draw), ports: r.ports, welds: [], partOf: () => resolve('TT'), riseMm: 61, plankMm: 12 });
    expect([s.structures.solid.indices.length, s.structures.rim.indices.length]).toEqual([vaultOnly.structures.solid.indices.length, 0]);
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

describe('the harbour arch bridge in words, and every bridge in its own bounds (next-parts R1, R2)', () => {
  /*
   * MUTATION PROOF, run: HB's deckClearanceMm removed from the seed fails with
   * `expected [] to deeply equal [ { …(3) } ]`: no sentence for it.
   */
  it('says the room under its deck, like the other bridges', () => {
    const g: Graph = { pieces: [{ pieceId: 'hb', partId: 'HB', turn: 'left' }], welds: [] };
    const notes = bridgeNotesOf([{ bridge: 'hb', under: 'x' }], () => 'HB', resolve, () => 1);
    expect(notes).toEqual([{ name: 'harbour arch bridge', piece: 1, clearanceMm: 60.8 }]);
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const html = renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies)), bridgeNotes: notes }))
      .replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;|’/g, "'");
    expect(html).toContain("Your 55mm train won't fit under the harbour arch bridge (piece 1): 61mm opening.");
  });

  /*
   * MUTATION PROOFS, run:
   * - the arch pass not setting its piece's bounds fails with `hb: expected
   *   { min: [ -24, -51.5, +0 ], …(1) } to deeply equal { … }`: the stone arch
   *   grew the harbour bridge's box.
   * - the tower pass not setting them fails with `sa: expected { min: [ +0,
   *   -27, +0 ], …(1) } to deeply equal { … }`: the towers grew the arch's.
   */
  it("a bridge's arch and towers grow its own piece's bounds, never another's", () => {
    const g: Graph = {
      pieces: [{ pieceId: 'hb', partId: 'HB', turn: 'left' }, { pieceId: 'sa', partId: 'SA', turn: 'left' }, { pieceId: 'sb', partId: 'SB', turn: 'left' }],
      welds: [],
    };
    const placement = placeAll(g, ports);
    const r = renderGraph(g, ports, resolve, placement);
    const byPiece = new Map(g.pieces.map((p) => [p.pieceId, p.partId]));
    const s = buildScene({ segments: r.segments, bodies: r.bodies, ports: r.ports, welds: [], partOf: (id) => resolve(byPiece.get(id)!), riseMm: 61, plankMm: 12 });
    const alone = (id: string) => {
      const one: Graph = { pieces: [{ pieceId: id, partId: byPiece.get(id)!, turn: 'left' }], welds: [] };
      const p1 = placeAll(one, ports);
      const r1 = renderGraph(one, ports, resolve, p1);
      return buildScene({ segments: r1.segments, bodies: r1.bodies, ports: r1.ports, welds: [], partOf: () => resolve(byPiece.get(id)!), riseMm: 61, plankMm: 12 }).pieceBounds.get(id)!;
    };
    for (const id of ['hb', 'sa', 'sb']) expect(s.pieceBounds.get(id), id).toEqual(alone(id));
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
