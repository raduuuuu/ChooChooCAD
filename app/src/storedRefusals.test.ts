/**
 * ONE TABLE, TWO READERS (share plan, eng D33).
 *
 * Value: protects=the editor's loader and a shared link's decoder judge the
 * same stored layouts alike: what the loader refuses the decoder refuses, and
 * what the loader REPAIRS (an unreadable position, re-laned and reported) the
 * decoder refuses, because nothing on a friend's screen may be a guess
 * Value: fails_when=a check moves back into `loadGraph` only, the decoder
 * starts repairing, or either reader starts accepting a row the other refuses
 * Value: why_new=layoutStore.test.ts pins the loader alone (its 52 tests are
 * unchanged); shareLink.test.ts pins the decoder's own refusals
 * Value: seam=none; a Map-backed localStorage for the loader, and links packed
 * here with the platform's own CompressionStream
 * Value: no_claim=rows the v1 packing cannot express (a bad turn, a duplicated
 * piece id), which the decoder refuses at its shape check
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { loadGraph } from './layoutStore.js';
import { decodeLink } from './shareLink.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);
const KNOWN = new Set(BUILT_IN.map((p) => p.id));

interface Stored {
  pieces: { pieceId: string; partId: string; turn?: string }[];
  welds: { a: { pieceId: string; port: number }; b: { pieceId: string; port: number } }[];
  anchors?: [string, Record<string, unknown>][];
}

type Outcome = 'ok' | 'repair' | 'refuse';

function loaderSays(stored: Stored): Outcome {
  const data = new Map([[GRAPH_STORAGE_KEY, JSON.stringify(stored)]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  const r = loadGraph(KNOWN, ports);
  return r.discarded ? 'refuse' : r.droppedAnchors > 0 ? 'repair' : 'ok';
}

/** The same layout as a v1 link: pieces by index, as the encoder packs them. */
async function linkSays(stored: Stored): Promise<Outcome> {
  const index = new Map(stored.pieces.map((p, i) => [p.pieceId, i]));
  const at = (id: string) => index.get(id) ?? 999;
  const compact = [
    stored.pieces.map((p) => [p.partId, p.turn === 'left' ? 1 : p.turn === 'right' ? 2 : 0]),
    stored.welds.map((w) => [at(w.a.pieceId), w.a.port, at(w.b.pieceId), w.b.port]),
    (stored.anchors ?? []).map(([id, f]) => ('level' in f ? [at(id), f.pos, f.heading, f.level] : [at(id), f.pos, f.heading])),
  ];
  const stream = new Blob([JSON.stringify(compact)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const r = await decodeLink(`#v1.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`);
  return r.ok ? 'ok' : 'refuse';
}

const run = (): Stored => ({
  pieces: [
    { pieceId: 'a', partId: 'E', turn: 'left' },
    { pieceId: 'b', partId: 'E', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } }],
});
const anchored = (frame: Record<string, unknown>): Stored => ({ ...run(), anchors: [['a', frame]] });
const ORIGIN = [0, 0, 0, 0, 0, 0, 0, 0];

const TABLE: { row: string; stored: Stored; loader: Outcome; link: Outcome }[] = [
  { row: 'a clean run', stored: run(), loader: 'ok', link: 'ok' },
  { row: 'a clean run with a stored position', stored: anchored({ pos: ORIGIN, heading: 0 }), loader: 'ok', link: 'ok' },
  { row: 'a raised position (level 1)', stored: anchored({ pos: ORIGIN, heading: 0, level: 1 }), loader: 'ok', link: 'ok' },
  { row: 'a part the catalogue does not have', stored: { ...run(), pieces: [{ pieceId: 'a', partId: 'ZZZ' }, run().pieces[1]!] }, loader: 'refuse', link: 'refuse' },
  { row: 'a weld to a piece that is not there', stored: { ...run(), welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'q', port: 0 } }] }, loader: 'refuse', link: 'refuse' },
  { row: 'a port the part does not have (7)', stored: { ...run(), welds: [{ a: { pieceId: 'a', port: 7 }, b: { pieceId: 'b', port: 0 } }] }, loader: 'refuse', link: 'refuse' },
  { row: 'a negative port', stored: { ...run(), welds: [{ a: { pieceId: 'a', port: -1 }, b: { pieceId: 'b', port: 0 } }] }, loader: 'refuse', link: 'refuse' },
  {
    row: 'two welds on one end',
    stored: { ...run(), welds: [...run().welds, { a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 1 } }] },
    loader: 'refuse',
    link: 'refuse',
  },
  { row: 'an end welded to itself', stored: { ...run(), welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'a', port: 1 } }] }, loader: 'refuse', link: 'refuse' },
  { row: 'a heading out of range (16)', stored: anchored({ pos: ORIGIN, heading: 16 }), loader: 'repair', link: 'refuse' },
  { row: 'a position off the lattice (1.5)', stored: anchored({ pos: [1.5, 0, 0, 0, 0, 0, 0, 0], heading: 0 }), loader: 'repair', link: 'refuse' },
  { row: 'a position past the exactness ceiling', stored: anchored({ pos: [2 ** 32, 0, 0, 0, 0, 0, 0, 0], heading: 0 }), loader: 'repair', link: 'refuse' },
  { row: 'a level this engine never writes (2)', stored: anchored({ pos: ORIGIN, heading: 0, level: 2 }), loader: 'repair', link: 'refuse' },
];

afterEach(() => vi.unstubAllGlobals());

describe('the loader and the link decoder judge stored layouts alike', () => {
  /*
   * MUTATION PROOF, run: the decoder accepting unreadable positions (its
   * `unreadable.size > 0 || nameless > 0` refusal removed): `expected 'ok' to
   * be 'refuse' // Object.is equality` on "a heading out of range (16)".
   */
  for (const t of TABLE) {
    it(t.row, async () => {
      expect(loaderSays(t.stored)).toBe(t.loader);
      expect(await linkSays(t.stored)).toBe(t.link);
    });
  }
});
