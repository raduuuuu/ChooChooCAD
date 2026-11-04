/**
 * A LAYOUT IN A FILE (layoutFile.ts; share plan, design doc step 3).
 *
 * Value: protects=a saved file is the link's own string and opens as that
 * link; a pasted fragment or whole link in a file opens too; a downloaded
 * backup (the saved shape) opens as the link of the same layout; every file
 * goes through the link's decoder and caps; a file the decoder refuses is
 * refused with the decoder's reason; opening never writes storage
 * Value: fails_when=the file stops being the link string, a backup skips the
 * catalogue or position checks, a cap is bypassed, or opening saves
 * Value: why_new=layout files are new
 * Value: seam=none; node has CompressionStream, as the link tests rely on
 * Value: no_claim=the picker, the download and the address change
 * (layoutFile.dom.test.tsx)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { reduce, type EditorState } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { fileOf, fragmentOfFile } from './layoutFile.js';
import { storedGraphOf } from './layoutStore.js';
import { PRESETS } from './presets.js';
import { encodeLink, LINK_MAX_PIECES } from './shareLink.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const START: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
const stadium = reduce(START, { kind: 'preset', ids: PRESETS[0]!.pieces }, ports).graph;

afterEach(() => vi.unstubAllGlobals());

describe('a saved file', () => {
  /*
   * MUTATION PROOF, run: `fileOf` writing the fragment with its `#`
   * (`fragment.slice(1)` → `fragment`): `expected '#v1.ncw7EQAgDARRL9Qp-AUUoCIT_zZYTgJzx…'
   * to match /^v1\./`.
   */
  it("is the link's string, and opens as that link", async () => {
    const link = await encodeLink(stadium);
    const file = await fileOf(stadium);
    if (!file.ok) throw new Error(file.reason);
    expect(file.text).toMatch(/^v1\./);
    expect(file.text).toBe(`${link.slice(1)}\n`);
    expect(await fragmentOfFile(file.text)).toEqual({ ok: true, fragment: link });
  });

  it('is refused, with the reason, when the layout could not be a link', async () => {
    const custom = { ...stadium, pieces: stadium.pieces.map((p, i) => (i === 0 ? { ...p, partId: 'my-own-part' } : p)) };
    expect(await fileOf(custom)).toEqual({ ok: false, reason: 'unknown-part' });
    vi.stubGlobal('CompressionStream', undefined);
    expect(await fileOf(stadium)).toEqual({ ok: false, reason: 'old-browser' });
  });
});

describe('opening a file', () => {
  it('takes a fragment with or without its #, or a whole link, with space around it', async () => {
    const link = await encodeLink(stadium);
    const want = { ok: true, fragment: link };
    expect(await fragmentOfFile(link)).toEqual(want);
    expect(await fragmentOfFile(`  ${link.slice(1)}\r\n`)).toEqual(want);
    expect(await fragmentOfFile(`https://example.test/${link}\n`)).toEqual(want);
  });

  /*
   * TWO JUDGES, ON PURPOSE. MUTATION RUN, and it SURVIVES: `fromBackup`
   * skipping `graphOfStored` (the parsed JSON encoded as it is) still passes,
   * because every fragment is decoded again with the link's checks before it
   * is returned. `graphOfStored` is what turns the saved shape into a graph;
   * the decoder is what judges it. This test pins the outcome, whichever
   * of the two refuses.
   */
  it('a downloaded backup opens as the link of the same layout, judged as a link is', async () => {
    const backup = JSON.stringify(storedGraphOf(stadium));
    expect(await fragmentOfFile(backup)).toEqual({ ok: true, fragment: await encodeLink(stadium) });

    const unknown = JSON.stringify({ ...storedGraphOf(stadium), pieces: [{ pieceId: 'x', partId: 'ZZZ' }], welds: [], anchors: [] });
    expect(await fragmentOfFile(unknown)).toEqual({ ok: false, reason: 'unknown-part' });

    const stored = storedGraphOf(stadium);
    const guessed = JSON.stringify({ ...stored, anchors: [[stored.pieces[0]!.pieceId, { pos: [0.5, 0, 0, 0, 0, 0, 0, 0], heading: 0 }]] });
    expect(await fragmentOfFile(guessed)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('is refused, with the reason, for anything else', async () => {
    expect(await fragmentOfFile('not a layout')).toEqual({ ok: false, reason: 'malformed' });
    expect(await fragmentOfFile('')).toEqual({ ok: false, reason: 'malformed' });
    expect(await fragmentOfFile('v2.abc')).toEqual({ ok: false, reason: 'version' });
    expect(await fragmentOfFile(`v1.${'A'.repeat(9000)}`)).toEqual({ ok: false, reason: 'too-long' });
    const many = { pieces: Array.from({ length: LINK_MAX_PIECES + 1 }, (_, i) => ({ pieceId: `p${i}`, partId: 'E' })), welds: [], anchors: [] };
    expect(await fragmentOfFile(JSON.stringify(many))).toEqual({ ok: false, reason: 'too-many-pieces' });
  });

  /*
   * MUTATION PROOF, run: `fragmentOfFile` calling `localStorage.setItem`
   * first: `expected "spy" to not be called at all, but actually been called
   * 2 times`.
   */
  it('never writes storage', async () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem, clear: vi.fn() });
    await fragmentOfFile(JSON.stringify(storedGraphOf(stadium)));
    await fragmentOfFile('v1.garbage');
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
