/**
 * A LAYOUT IN A LINK (share plan; design doc step 3; eng D11, D14, D17, D22,
 * D30, D9).
 *
 *   graph ─▶ storedGraphOf ─▶ compact ─▶ JSON ─▶ deflate-raw ─▶ base64url ─▶ #v1.<data>
 *
 * The link packs exactly what a SAVED layout keeps (D30): `compact` is a
 * lossless packing of `storedGraphOf(graph)`, so a field the saver learns is a
 * field the link carries, and the round-trip test over the presets and a
 * seeded corpus fails the day they disagree. Piece ids do not travel (S3-2:
 * no free text in a link); the decoder names pieces `p0`, `p1`... in order.
 *
 * Decoding is PURE and refuses rather than repairs. Every check runs before
 * anything is solved, and in this order, cheapest first:
 *
 *   #v<n>. ─▶ v1? ─▶ ≤ 8,192 chars ─▶ browser can inflate? ─▶ base64url
 *     ─▶ inflate, stopped the moment it passes 64 KB ─▶ JSON ─▶ shape
 *     ─▶ ≤ 500 pieces ─▶ checkStored against the BUILT-IN catalogue ─▶ graph
 *
 * Part ids are the contract (D11): the ids saved layouts already store, pinned
 * by `shareLink.test.ts`. They resolve against `BUILT_IN` only (D14), never
 * against the recipient's own corrections, so one link is one railway for
 * everybody. Any `#v<digits>.` is a link (D17), so a newer link opened by an
 * older cached app is refused with a sentence instead of opening the editor.
 */

import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { checkStored, storedGraphOf } from './layoutStore.js';

/** The caps (eng D22), enforced before anything is solved. */
export const LINK_MAX_CHARS = 8192;
export const LINK_MAX_INFLATED = 64 * 1024;
export const LINK_MAX_PIECES = 500;

/** Any version of a shared-layout fragment (D17). */
export const LINK_FRAGMENT = /^#v(\d+)\./;

export type LinkRefusal =
  | 'version'
  | 'too-long'
  | 'old-browser'
  | 'bad-encoding'
  | 'corrupt'
  | 'too-large'
  | 'malformed'
  | 'too-many-pieces'
  | 'unknown-part'
  | 'invalid';

export type LinkResult =
  | { readonly ok: true; readonly graph: Graph }
  | { readonly ok: false; readonly reason: LinkRefusal; readonly partId?: string };

/** v1's packing: [pieces, welds, anchors]. Turns are 0 (absent), 1 left, 2 right. */
type CompactPiece = [partId: string, turn: 0 | 1 | 2];
type CompactWeld = [a: number, aPort: number, b: number, bPort: number];
type CompactAnchor = [piece: number, pos: number[], heading: number] | [piece: number, pos: number[], heading: number, level: number];
type Compact = [CompactPiece[], CompactWeld[], CompactAnchor[]];

const TURN_CODE = { left: 1, right: 2 } as const;
const TURN_OF = [undefined, 'left', 'right'] as const;

const catalogue = makeResolver(BUILT_IN);
const catalogueIds: ReadonlySet<string> = new Set(BUILT_IN.map((p) => p.id));
const cataloguePorts = (piece: Piece) => portsOf(catalogue(piece.partId), piece.turn);

/** Whether this browser has what links need (D9). Checked once per call. */
export const canCompress = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

function compactOf(graph: Graph): Compact {
  const stored = storedGraphOf(graph);
  const index = new Map(stored.pieces.map((p, i) => [p.pieceId, i]));
  return [
    stored.pieces.map((p) => [p.partId, p.turn === undefined ? 0 : TURN_CODE[p.turn as keyof typeof TURN_CODE]]),
    stored.welds.map((w) => [index.get(w.a.pieceId)!, w.a.port, index.get(w.b.pieceId)!, w.b.port]),
    (stored.anchors ?? []).map(([id, f]) =>
      f.level === undefined ? [index.get(id)!, f.pos, f.heading] : [index.get(id)!, f.pos, f.heading, f.level],
    ),
  ];
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflate, reading chunk by chunk and stopping as soon as `cap` is passed (D22). */
async function inflate(bytes: Uint8Array<ArrayBuffer>, cap: number): Promise<{ ok: true; text: string } | { ok: false; reason: 'corrupt' | 'too-large' }> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too-large' };
      }
      parts.push(value);
    }
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(all) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

/** The fragment for `graph`, `#v1.<data>`. Needs `canCompress()`. */
export async function encodeLink(graph: Graph): Promise<string> {
  return `#v1.${toBase64Url(await deflate(JSON.stringify(compactOf(graph))))}`;
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Undo `compactOf`, checking only the SHAPE; `checkStored` judges the content. */
function storedOf(c: unknown): unknown | null {
  if (!Array.isArray(c) || c.length !== 3) return null;
  const [pieces, welds, anchors] = c as unknown[];
  if (!Array.isArray(pieces) || !Array.isArray(welds) || !Array.isArray(anchors)) return null;
  const id = (i: unknown) => `p${String(i)}`;
  const out = {
    pieces: [] as { pieceId: string; partId: unknown; turn?: string }[],
    welds: [] as unknown[],
    anchors: [] as unknown[],
  };
  for (const [i, p] of pieces.entries()) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || !(p[1] === 0 || p[1] === 1 || p[1] === 2)) return null;
    const turn = TURN_OF[p[1] as 0 | 1 | 2];
    out.pieces.push(turn === undefined ? { pieceId: id(i), partId: p[0] } : { pieceId: id(i), partId: p[0], turn });
  }
  for (const w of welds) {
    if (!Array.isArray(w) || w.length !== 4 || !w.every(isInt)) return null;
    out.welds.push({ a: { pieceId: id(w[0]), port: w[1] }, b: { pieceId: id(w[2]), port: w[3] } });
  }
  for (const a of anchors) {
    if (!Array.isArray(a) || (a.length !== 3 && a.length !== 4) || !isInt(a[0])) return null;
    const [piece, pos, heading, level] = a as [number, unknown, unknown, unknown?];
    out.anchors.push([id(piece), a.length === 4 ? { pos, heading, level } : { pos, heading }]);
  }
  return out;
}

/** Read a `#v<n>.` fragment into a graph, or say why not. Never touches storage. */
export async function decodeLink(fragment: string): Promise<LinkResult> {
  const m = LINK_FRAGMENT.exec(fragment);
  if (!m || m[1] !== '1') return { ok: false, reason: 'version' };
  if (fragment.length > LINK_MAX_CHARS) return { ok: false, reason: 'too-long' };
  if (!canCompress()) return { ok: false, reason: 'old-browser' };
  const bytes = fromBase64Url(fragment.slice(m[0].length));
  if (bytes === null || bytes.byteLength === 0) return { ok: false, reason: 'bad-encoding' };
  const inflated = await inflate(bytes, LINK_MAX_INFLATED);
  if (!inflated.ok) return { ok: false, reason: inflated.reason };
  let parsed: unknown;
  try {
    parsed = JSON.parse(inflated.text);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const stored = storedOf(parsed);
  if (stored === null) return { ok: false, reason: 'malformed' };
  if ((stored as { pieces: unknown[] }).pieces.length > LINK_MAX_PIECES) return { ok: false, reason: 'too-many-pieces' };
  const checked = checkStored(stored, catalogueIds, cataloguePorts);
  if (!checked.ok) {
    return checked.reason === 'unknown-part'
      ? { ok: false, reason: 'unknown-part', partId: checked.partId }
      : { ok: false, reason: 'invalid' };
  }
  // Nothing on a friend's screen may be a guess: an unreadable position refuses the link.
  if (checked.unreadable.size > 0 || checked.nameless > 0) return { ok: false, reason: 'invalid' };
  return { ok: true, graph: { pieces: checked.pieces, welds: checked.welds, anchors: checked.anchors } };
}
