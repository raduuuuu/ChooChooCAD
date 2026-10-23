/**
 * SOCKET TO SOCKET, SAID AND COUNTED (socket adapter plan, items 2, 5-8;
 * X2, X3; eng review E2).
 *
 * Value: protects=a socket-to-socket joint keeps the verdict it would have,
 * adds the exact adapter note on every verdict with a layout, is named in the
 * layout list and in every announcement that makes one, is counted against
 * Your box under a key no part can take, and a saved layout holding one loads
 * buildable
 * Value: fails_when=the note is missing from a branch, a joint row or a
 * sentence leaves the adapter out, the box drops or confuses its key, or a
 * submitted part can claim the key
 * Value: why_new=all new with the socket adapter
 * Value: seam=`renderToStaticMarkup` for the verdict and the list; a stubbed
 * localStorage for the stores (the `withStore` pattern)
 * Value: no_claim=what is drawn or clicked; socketAdapter.dom.test.tsx covers
 * the app
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, loadSubmissionsResult, makeResolver, SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { classifyWelds } from '../../engine/src/graph/feasible.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { describeAction } from './announce.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { GraphListing } from './GraphListing.js';
import { ADAPTER_INVENTORY_KEY, adapterShortfall, loadInventory, saveInventory } from './inventoryModel.js';
import { addPiece, EMPTY_GRAPH } from './layoutModel.js';
import { loadGraph, saveGraph } from './layoutStore.js';
import { PRESETS } from './presets.js';
import { INVENTORY_STORAGE_KEY } from './storageKeys.js';
import { adapterNote, VerdictLine } from './VerdictLine.js';
import { viewOf } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const solve = (g: Graph) => solveGraph(g, ports, resolve, (id) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId).slop.axialMm);
const at = (x: number, y: number, heading: number): Frame => ({
  pos: add(fromInt(x), scale(zetaPow(4), y)) as Cyc,
  heading,
});

/** Two straights start to start: their sockets meet at the origin, facing. */
const startToStart = (): Graph => ({
  pieces: [
    { pieceId: 'a', partId: 'A', turn: 'left' },
    { pieceId: 'r', partId: 'A', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'a', port: 0 }, b: { pieceId: 'r', port: 0 } }],
  anchors: new Map([
    ['a', at(0, 0, 0)],
    ['r', at(0, 0, 8)],
  ]),
});

function withStore<T>(seed: Record<string, string>, body: (store: Map<string, string>) => T): T {
  const store = new Map<string, string>(Object.entries(seed));
  const g = globalThis as { localStorage?: unknown };
  const had = 'localStorage' in g;
  const prev = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try {
    return body(store);
  } finally {
    if (had) g.localStorage = prev;
    else delete g.localStorage;
  }
}

describe('the verdict keeps its kind and adds the note', () => {
  /*
   * MUTATION PROOFS, run:
   * - `viewOf`'s refusal branch without `adapterCount`: "a run with one"
   *   fails with `expected +0 to be 1`.
   * - the refusal call site's `notesFor` not given `e.adapterCount`: the
   *   markup spec fails with `expected '<div class="verdict verdict-unknown"
   *   …' to contain 'Needs 1 male-male adapter: two socket…'`.
   */
  it('a run with one socket-to-socket joint: not IMPOSSIBLE, one adapter', () => {
    const r = solve(startToStart());
    expect(r.adapterJoints).toEqual([{ weld: 0, between: ['A', 'A'] }]);
    expect(r.polarityViolations).toEqual([]);
    const view = viewOf(r);
    expect(view.kind).toBe('NO_CYCLE');
    expect(view.adapterCount).toBe(1);
  });

  it('the note is in the verdict, word for word', () => {
    const markup = renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(solve(startToStart())) }));
    expect(markup).toContain('Needs 1 male-male adapter: two sockets meet at 1 joint.');
  });

  it('the note reads in the singular and the plural, and nothing is said on an empty floor', () => {
    expect(adapterNote(1)).toBe('Needs 1 male-male adapter: two sockets meet at 1 joint.');
    expect(adapterNote(3)).toBe('Needs 3 male-male adapters: two sockets meet at 3 joints.');
    expect(renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(null) }))).not.toContain('male-male');
  });
});

describe('every route that makes an adapter joint says so', () => {
  /*
   * MUTATION PROOFS, run:
   * - `withAdapter` returning '' always: the hand-join spec fails with
   *   `expected 'Joined the start of piece 1 to the st…' to be 'Joined the
   *   start of piece 1 to the st…'`, and the placing spec with `expected
   *   'Added piece 2, Medium straight, two s…' to match /^Added piece 2, …/`.
   * - the run move's own adapter count forced to 0: the run-move spec fails
   *   with `expected 'Moved the run. It joined the track it…' to be 'Moved
   *   the run. It joined the track it…'`.
   */
  const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports, { resolve });

  it('joining two starts by hand', () => {
    const g = { ...startToStart(), welds: [] };
    let s: EditorState = { graph: g, cursor: null, armed: null };
    s = act(s, { kind: 'clickPort', ref: { pieceId: 'a', port: 0 } });
    const joined = act(s, { kind: 'clickPort', ref: { pieceId: 'r', port: 0 } });
    expect(describeAction(s, { kind: 'clickPort', ref: { pieceId: 'r', port: 0 } }, joined, resolve)).toBe(
      'Joined the start of piece 1 to the start of piece 2 with a male-male adapter.',
    );
  });

  it('moving a run so a start lands on a start', () => {
    const g: Graph = { ...startToStart(), welds: [], anchors: new Map([['a', at(0, 0, 0)], ['r', at(0, 500, 8)]]) };
    const s: EditorState = { graph: g, cursor: null, armed: null };
    const action: EditorAction = { kind: 'moveRun', pieceId: 'r', turns: 0, by: add(fromInt(0), scale(zetaPow(4), -500)) as Cyc };
    const moved = act(s, action);
    expect(describeAction(s, action, moved, resolve)).toBe(
      'Moved the run. It joined the track it landed on with a male-male adapter.',
    );
  });

  it('placing a two-socket piece on a start', () => {
    const one = addPiece(EMPTY_GRAPH, 'A', 'left', 2, null, ports).graph;
    const s: EditorState = { graph: one, cursor: { pieceId: one.pieces[0]!.pieceId, port: 0 }, armed: null };
    const picked = act(s, { kind: 'pick', partId: 'C' });
    const placed = act(picked, { kind: 'placeGhost' });
    expect(describeAction(picked, { kind: 'placeGhost' }, placed, resolve)).toMatch(
      /^Added piece 2, .*, joined to the start of piece 1 with a male-male adapter\.$/,
    );
  });
});

describe('the layout list names the joint', () => {
  /*
   * MUTATION PROOF, run: the list's `adapter` always false: fails with
   * `expected [ Array(1) ] to deeply equal [ Array(1) ]` (the row without
   * ", two sockets, needs an adapter").
   */
  it('two sockets, needs an adapter', () => {
    const markup = renderToStaticMarkup(createElement(GraphListing, { graph: startToStart(), resolve, ports }));
    const joints = [...markup.matchAll(/<li aria-label="(Joint [^"]*)"/g)].map((m) => m[1]!);
    expect(joints).toEqual(['Joint 1: start of piece 1 to start of piece 2, two sockets, needs an adapter']);
  });
});

describe('Your box counts adapters under a key no part can take', () => {
  /*
   * MUTATION PROOFS, run:
   * - `loadInventory` without the adapter-key exception: the round trip fails
   *   with `expected { A: 2 } to deeply equal { A: 2, __adapter_male_male: 3 }`.
   * - the reserved-prefix check dropped from `looksLikePart`: the submission
   *   spec fails with `expected [ { part: { …(14) }, …(2) } ] to deeply equal
   *   []`.
   */
  it('the count survives a save and a load', () => {
    withStore({}, () => {
      saveInventory({ A: 2, [ADAPTER_INVENTORY_KEY]: 3 });
      expect(loadInventory(new Set(['A'])).value).toEqual({ A: 2, [ADAPTER_INVENTORY_KEY]: 3 });
    });
  });

  it('a malformed adapter count discards the blob, as a bad part count does', () => {
    withStore({ [INVENTORY_STORAGE_KEY]: JSON.stringify({ A: 2, [ADAPTER_INVENTORY_KEY]: -1 }) }, () => {
      const r = loadInventory(new Set(['A']));
      expect(r.value).toBeNull();
      expect(r.discarded).toMatch(/unusable count for __adapter_male_male/);
    });
  });

  it('undeclared checks nothing; declared without a count owns none', () => {
    expect(adapterShortfall(null, 2)).toBe(0);
    expect(adapterShortfall({ A: 1 }, 2)).toBe(2);
    expect(adapterShortfall({ [ADAPTER_INVENTORY_KEY]: 1 }, 2)).toBe(1);
    expect(adapterShortfall({ [ADAPTER_INVENTORY_KEY]: 0 }, 0)).toBe(0);
  });

  it('no catalogue part starts with the reserved prefix', () => {
    expect(BUILT_IN.filter((p) => p.id.startsWith('__'))).toEqual([]);
  });

  it('a stored submission named with the reserved prefix is dropped on load', () => {
    const part = { ...BUILT_IN.find((p) => p.id === 'A')!, id: ADAPTER_INVENTORY_KEY };
    const row = { submissionId: 's1', at: '2026-10-23T00:00:00Z', part };
    withStore({ [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([row]) }, () => {
      const r = loadSubmissionsResult();
      expect(r.value).toEqual([]);
      expect(r.dropped).toBe(1);
    });
  });
});

describe('saved layouts and presets', () => {
  /*
   * MUTATION PROOF, run: `classifyWelds` filing sockets as violations again:
   * the reload spec fails with `expected 'IMPOSSIBLE' not to be 'IMPOSSIBLE'`.
   */
  it('a saved layout with a socket-to-socket joint loads buildable, with the adapter', () => {
    withStore({}, () => {
      saveGraph(startToStart());
      const loaded = loadGraph(new Set(BUILT_IN.map((p) => p.id)), ports);
      expect(loaded.value.welds).toHaveLength(1);
      const view = viewOf(solve(loaded.value));
      expect(view.kind).not.toBe('IMPOSSIBLE');
      expect(view.adapterCount).toBe(1);
    });
  });

  it('every shipped preset alternates: no adapter joints', () => {
    for (const preset of PRESETS) {
      let s: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
      s = reduce(s, { kind: 'preset', ids: preset.pieces }, ports);
      expect(classifyWelds(s.graph, resolve, ports).adapters, preset.label).toEqual([]);
    }
  });
});
