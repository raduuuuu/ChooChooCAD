/**
 * A RAISED RUN STAYS RAISED (two-layer plan, decision I1): through removing
 * its ramp, a save and a reload. And a flat layout saves exactly as before
 * (SC1).
 *
 * Value: protects=the anchor level captured on a split, written by the saver
 * and read back by the loader; flat saves unchanged; a level this engine
 * never writes dropped with its anchor
 * Value: fails_when=the saver drops `level` (it copied fields by name), the
 * loader ignores or accepts any level, or a flat save gains `level: 0`
 * Value: why_new=anchors had no level before
 * Value: seam=localStorage stubbed per test, as layoutStore.test.ts does
 * Value: no_claim=what the canvas draws for raised track
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { removePiece } from '../../engine/src/graph/edit.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { levelOf, portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';
import { loadGraph, saveGraph } from './layoutStore.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const KNOWN = new Set(BUILT_IN.map((p) => p.id));

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

/** Floor straight, a ramp up, a raised straight. */
const BRIDGE_START: Graph = {
  pieces: [
    { pieceId: 'f', partId: 'A', turn: 'left' },
    { pieceId: 'r', partId: 'N', turn: 'left' },
    { pieceId: 'u', partId: 'A', turn: 'left' },
  ],
  welds: [
    { a: { pieceId: 'f', port: 1 }, b: { pieceId: 'r', port: 0 } },
    { a: { pieceId: 'r', port: 1 }, b: { pieceId: 'u', port: 0 } },
  ],
};

describe('a raised run stays raised', () => {
  /*
   * MUTATION PROOFS, run:
   * - the saver back to copying `pos` and `heading` only: fails with
   *   `expected +0 to be 1` (the reloaded half is on the floor).
   * - `isAnchorLevel` accepting only `undefined`: fails with `expected 1 to
   *   be +0` (the raised anchor is dropped on load).
   */
  it('remove the ramp, save, reload: the cut-off half is still raised', () => {
    const before = placeAll(BRIDGE_START, ports);
    expect(levelOf(before.frames.get('u')!)).toBe(1);
    const cut = removePiece(BRIDGE_START, ports, 'r');
    expect(levelOf(placeAll(cut, ports).frames.get('u')!)).toBe(1);
    const reloaded = withStore({}, () => {
      saveGraph(cut);
      return loadGraph(KNOWN, ports);
    });
    expect(reloaded.droppedAnchors).toBe(0);
    expect(levelOf(placeAll(reloaded.value, ports).frames.get('u')!)).toBe(1);
  });

  /*
   * MUTATION PROOF, run: the saver writing `level: levelOf(f)` always: fails
   * with `expected true to be false` (and the spec above with `expected 1 to
   * be +0`, because the loader never accepts a written 0).
   */
  it('a flat layout saves without any level field', () => {
    const flat: Graph = { ...BRIDGE_START, pieces: BRIDGE_START.pieces.map((p) => ({ ...p, partId: 'A' })) };
    const cut = removePiece(flat, ports, 'r');
    const raw = withStore({}, (store) => {
      saveGraph(cut);
      return store.get(GRAPH_STORAGE_KEY)!;
    });
    expect(raw.includes('"level"')).toBe(false);
  });

  /*
   * MUTATION PROOF, run: `isAnchorLevel` returning true for any number: fails
   * with `expected +0 to be 1` (the level-7 anchor was kept).
   */
  it('a level this engine never writes is dropped with its anchor', () => {
    const blob = {
      pieces: [{ pieceId: 'u', partId: 'A', turn: 'left' }],
      welds: [],
      anchors: [['u', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0, level: 7 }]],
    };
    const r = withStore({ [GRAPH_STORAGE_KEY]: JSON.stringify(blob) }, () => loadGraph(KNOWN, ports));
    expect(r.droppedAnchors).toBe(1);
  });
});
