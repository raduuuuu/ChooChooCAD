/**
 * A LAYOUT IN A LINK (share plan; eng D11, D14, D17, D22, D30, D9).
 *
 * Value: protects=a link carries exactly what a saved layout keeps (round
 * trip over every preset and a seeded corpus with switches, ramps, other
 * brands and stored positions); every refusal class is refused with its own
 * reason; the caps hold, and inflation stops mid-stream; part ids resolve
 * against the built-in catalogue only; the ids saved layouts store are pinned;
 * decoding never writes storage
 * Value: fails_when=compactOf or storedOf drops or mangles a stored field, a
 * cap or a check goes, the version namespace narrows to v1, the decoder
 * resolves a user's own parts, or a built-in id is renamed
 * Value: why_new=links are new; layoutStore.test.ts covers the saved layout
 * Value: seam=none; node has CompressionStream and DecompressionStream, and
 * tests stub them away for the old-browser case. Refusal bytes are made here
 * with the same platform calls, not through a production export
 * Value: no_claim=old links opening forever, which shareLink.frozen.test.ts
 * owns; how a refusal looks on screen (share PR b)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorAction, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { storedGraphOf } from './layoutStore.js';
import { LINK_REFUSED } from './linkWords.js';
import { PRESETS } from './presets.js';
import { decodeLink, encodeLink, LINK_MAX_CHARS, LINK_MAX_PIECES } from './shareLink.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const act = (s: EditorState, a: EditorAction) => reduce(s, a, ports);

/** The stored form with piece ids renamed p0, p1... in order: what a link promises to give back. */
function canonical(graph: Graph) {
  const stored = storedGraphOf(graph);
  const name = new Map(stored.pieces.map((p, i) => [p.pieceId, `p${i}`]));
  return {
    pieces: stored.pieces.map((p) => ({ ...p, pieceId: name.get(p.pieceId)! })),
    welds: stored.welds.map((w) => ({
      a: { pieceId: name.get(w.a.pieceId)!, port: w.a.port },
      b: { pieceId: name.get(w.b.pieceId)!, port: w.b.port },
    })),
    anchors: (stored.anchors ?? []).map(([id, f]) => [name.get(id)!, f] as const),
  };
}

/** A small deterministic generator (mulberry32), so the corpus is the same every run. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded layouts built through the editor: placed pieces from the whole catalogue, and some joints broken (which stores positions). */
function corpus(): Graph[] {
  const ids = BUILT_IN.map((p) => p.id);
  const out: Graph[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed);
    let s = START;
    const n = 3 + Math.floor(r() * 18);
    for (let i = 0; i < n; i++) {
      s = act(s, { kind: 'add', partId: ids[Math.floor(r() * ids.length)]!, turn: r() < 0.5 ? 'left' : 'right' });
      if (r() < 0.2 && s.graph.welds.length > 0) {
        const w = s.graph.welds[Math.floor(r() * s.graph.welds.length)]!;
        s = act(s, { kind: 'breakWeld', a: w.a, b: w.b });
      }
    }
    out.push(s.graph);
  }
  return out;
}

/** Bytes for a hand-made link body, made the way the encoder makes them. */
async function linkOf(json: string): Promise<string> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `#v1.${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a link carries exactly what a saved layout keeps (D30)', () => {
  /*
   * MUTATION PROOF, run: `compactOf` writing every turn as 0: `expected {
   * pieces: [ { …(3) }, …(7) ], …(2) } to deeply equal { pieces: [ { …(3) },
   * …(7) ], …(2) }`.
   */
  it('every preset comes back the same', async () => {
    for (const preset of PRESETS) {
      const graph = act(START, { kind: 'preset', ids: preset.pieces }).graph;
      const back = await decodeLink(await encodeLink(graph));
      if (!back.ok) throw new Error(`${preset.label}: ${back.reason}`);
      expect(storedGraphOf(back.graph)).toEqual(canonical(graph));
    }
  });

  /*
   * MUTATION PROOF, run: `compactOf` dropping each anchor's `level`: `expected
   * { pieces: [ { …(3) }, …(13) ], …(2) } to deeply equal { pieces: [ { …(3)
   * }, …(13) ], …(2) }` (the corpus has raised roots). MUTATION PROOF, run:
   * `storedOf` swapping a weld's two ports: `Error: invalid`, the swapped
   * layout refused outright.
   */
  it('so does a seeded corpus of 40 layouts, with switches, ramps, other brands and stored positions', async () => {
    const layouts = corpus();
    expect(layouts.some((g) => (g.anchors?.size ?? 0) > 0)).toBe(true);
    for (const graph of layouts) {
      const back = await decodeLink(await encodeLink(graph));
      if (!back.ok) throw new Error(back.reason);
      expect(storedGraphOf(back.graph)).toEqual(canonical(graph));
    }
  });

  /*
   * MUTATION PROOF, run: `compactOf` dropping each anchor's `level`: `expected
   * { pieces: [ { …(3) } ], …(2) } to deeply equal { pieces: [ { …(3) } ],
   * …(2) }`.
   */
  it('a raised component keeps its level', async () => {
    const graph: Graph = {
      pieces: [{ pieceId: 'x', partId: 'A', turn: 'left' }],
      welds: [],
      anchors: new Map([['x', { pos: [216, 0, 0, 0, 0, 0, 0, 0], heading: 4, level: 1 }]]),
    };
    const back = await decodeLink(await encodeLink(graph));
    if (!back.ok) throw new Error(back.reason);
    expect(storedGraphOf(back.graph)).toEqual(canonical(graph));
  });

  it('the Stadium link is short enough to paste anywhere', async () => {
    const stadium = PRESETS.find((p) => p.label === 'Stadium')!;
    const link = await encodeLink(act(START, { kind: 'preset', ids: stadium.pieces }).graph);
    expect(link.length).toBeLessThan(200);
  });
});

describe('every refusal says which', () => {
  const good = (): Promise<string> => linkOf(JSON.stringify([[['E', 1]], [], []]));

  it('the good link itself opens, so the refusals below are about what changed', async () => {
    expect((await decodeLink(await good())).ok).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the `m[1] !== '1'` check removed: `expected { ok:
   * false, reason: 'corrupt' } to deeply equal { ok: false, reason: 'version'
   * }`. Which fragments reach the decoder at all is the route's job (share PR
   * b, D17).
   */
  it('a newer version (D17)', async () => {
    expect(await decodeLink('#v2.abc')).toEqual({ ok: false, reason: 'version' });
    expect(await decodeLink('#v12.abc')).toEqual({ ok: false, reason: 'version' });
  });

  it('too long, checked before anything else is read (D22)', async () => {
    expect(await decodeLink(`#v1.${'A'.repeat(LINK_MAX_CHARS)}`)).toEqual({ ok: false, reason: 'too-long' });
  });

  /*
   * MUTATION PROOF, run: the `canCompress` check removed: `TypeError:
   * DecompressionStream is not a constructor`, a crash instead of a sentence.
   */
  it('a browser without Compression Streams (D9)', async () => {
    const link = await good();
    vi.stubGlobal('DecompressionStream', undefined);
    expect(await decodeLink(link)).toEqual({ ok: false, reason: 'old-browser' });
  });

  it('not base64url', async () => {
    expect(await decodeLink('#v1.not*base64')).toEqual({ ok: false, reason: 'bad-encoding' });
    expect(await decodeLink('#v1.')).toEqual({ ok: false, reason: 'bad-encoding' });
  });

  it('bytes that do not inflate', async () => {
    expect(await decodeLink('#v1.AAAAAAAAAAAA')).toEqual({ ok: false, reason: 'corrupt' });
  });

  /*
   * MUTATION PROOF, run: the cap check inside the read loop removed: `expected
   * { ok: false, reason: 'malformed' } to deeply equal { ok: false, reason:
   * 'too-large' }`, the whole megabyte inflated first.
   */
  it('a high-ratio payload is stopped while inflating (D22)', async () => {
    const bomb = await linkOf('0'.repeat(1 << 20));
    expect(bomb.length).toBeLessThan(LINK_MAX_CHARS);
    expect(await decodeLink(bomb)).toEqual({ ok: false, reason: 'too-large' });
  });

  it('not the v1 shape', async () => {
    expect(await decodeLink(await linkOf('not json'))).toEqual({ ok: false, reason: 'malformed' });
    expect(await decodeLink(await linkOf('{"pieces":[]}'))).toEqual({ ok: false, reason: 'malformed' });
    expect(await decodeLink(await linkOf('[[["E",7]],[],[]]'))).toEqual({ ok: false, reason: 'malformed' });
    expect(await decodeLink(await linkOf('[[["E",1]],[[0,1,"x",0]],[]]'))).toEqual({ ok: false, reason: 'malformed' });
  });

  /*
   * MUTATION PROOF, run: the piece cap removed: `expected { ok: true, graph: {
   * …(3) } } to deeply equal { Object (ok, reason) }`.
   */
  it(`more than ${LINK_MAX_PIECES} pieces (D22)`, async () => {
    const many = JSON.stringify([Array.from({ length: LINK_MAX_PIECES + 1 }, () => ['A', 0]), [], []]);
    expect(await decodeLink(await linkOf(many))).toEqual({ ok: false, reason: 'too-many-pieces' });
    const most = JSON.stringify([Array.from({ length: LINK_MAX_PIECES }, () => ['A', 0]), [], []]);
    expect((await decodeLink(await linkOf(most))).ok).toBe(true);
  });

  it('an unknown part, named (D25)', async () => {
    expect(await decodeLink(await linkOf('[[["ZZZ",0]],[],[]]'))).toEqual({ ok: false, reason: 'unknown-part', partId: 'ZZZ' });
  });

  it('a weld to a piece that is not there, or a position this engine could not have written', async () => {
    expect(await decodeLink(await linkOf('[[["E",1]],[[0,1,5,0]],[]]'))).toEqual({ ok: false, reason: 'invalid' });
    expect(await decodeLink(await linkOf('[[["E",1]],[],[[0,[0,0,0,0,0,0,0,0],16]]]'))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('every reason has a sentence, and three of them name a fix', () => {
    expect(LINK_REFUSED.version).toMatch(/newer ChooChooCAD/);
    expect(LINK_REFUSED['unknown-part']).toMatch(/piece this version/);
    expect(LINK_REFUSED['old-browser']).toMatch(/Updating it/);
    expect(LINK_REFUSED.invalid).toBe("This link couldn't be opened.");
  });
});

describe('the catalogue a link is read against', () => {
  /*
   * MUTATION PROOF, run: `catalogueIds` also accepting a user's own part id
   * ('user-made-42'), as resolving against the recipient's library would:
   * `expected { ok: true, graph: { …(3) } } to deeply equal { ok: false, …(2)
   * }`.
   */
  it('is the built-in one (D14): a custom part id is unknown', async () => {
    expect(await decodeLink(await linkOf('[[["user-made-42",0]],[],[]]'))).toEqual({
      ok: false,
      reason: 'unknown-part',
      partId: 'user-made-42',
    });
  });

  /*
   * THE IDS SAVED LAYOUTS AND LINKS DEPEND ON (D11). A rename breaks every
   * saved layout and every link that names the part. Adding a part is fine;
   * removing or renaming one fails here, on purpose.
   * MUTATION PROOF, run: 'E' renamed to 'E0' in brio.ts: `expected [ 'E' ] to
   * deeply equal []`.
   */
  it('still has every id it had on 2026-11-01', () => {
    const PINNED = [
      'A', 'A1', 'A2', 'A3', 'B', 'B1', 'B2', 'C', 'C1', 'C2', 'D', 'E', 'E1', 'EE', 'F', 'G', 'H', 'H1', 'H2',
      'N', 'N1', 'R', 'S', 'T', 'X', 'L', 'M', 'O1', 'P1', 'I', 'J', 'O', 'P', 'F1', 'G1',
      'IKEA-150', 'IKEA-X145', 'PLAYTIVE-110', 'PLAYTIVE-150', 'PLAYTIVE-200', 'PLAYTIVE-30', 'PLAYTIVE-60',
    ];
    const have = new Set(BUILT_IN.map((p) => p.id));
    expect(PINNED.filter((id) => !have.has(id))).toEqual([]);
  });
});

describe('decoding writes nothing', () => {
  /*
   * MUTATION PROOF, run: `decodeLink` calling `saveGraph(graph)` before
   * returning: `expected "spy" to not be called at all, but actually been
   * called 1 times`.
   */
  it('a good link and a refused one leave storage untouched', async () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem, clear: vi.fn() });
    await decodeLink(await linkOf('[[["E",1]],[],[]]'));
    await decodeLink(await linkOf('[[["ZZZ",0]],[],[]]'));
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
