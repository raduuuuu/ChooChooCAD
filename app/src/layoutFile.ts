/**
 * A LAYOUT IN A FILE (share plan, design doc step 3 "Layout file";
 * generic-TODOS.md P2 "Layout file when a link is too long").
 *
 *   Save to a file ─▶ encodeLink ─▶ decodeLink, every cap ─▶ "v1.<data>" as layout.choochoo
 *   Open a layout file ─▶ its text
 *       "v1.…", "#v1.…" or a whole link ─▶ that fragment
 *       a downloaded backup (the saved shape, JSON) ─▶ graphOfStored ─▶ encodeLink
 *     ─▶ decodeLink, every cap ─▶ refused: one sentence (FILE_REFUSED)
 *                                └ ok: the fragment, which the caller puts in the address
 *
 * A file is a link written down: the same string, the same decoder, the same
 * caps, so a layout too big for a link is too big for a file too (R3-4).
 * What a file adds is that it keeps, and that it reopens the two downloads
 * the app already offers when storage is full (eng D36; the rescue copy).
 * Those hold the SAVED shape, not a link, and are judged the way a link's
 * contents are: the built-in catalogue only, and no guessed positions.
 *
 * Nothing here touches storage.
 */

import type { Graph } from '../../engine/src/graph/model.js';
import { canCompress, decodeLink, encodeLink, graphOfStored, LINK_MAX_PIECES, type LinkRefusal } from './shareLink.js';

export const FILE_NAME = 'layout.choochoo';
/** What the picker offers; anything else is still read, and refused if it is not a layout. */
export const FILE_ACCEPT = '.choochoo,.json,.txt';
/** Read no further than this. A backup's JSON is larger than its link, so this is looser than the link cap. */
export const FILE_MAX_BYTES = 256 * 1024;

export type FileResult =
  | { readonly ok: true; readonly fragment: string }
  | { readonly ok: false; readonly reason: LinkRefusal };

/** The file's text for `graph`, or why there is none. Checked by the decoder that will open it. */
export async function fileOf(graph: Graph): Promise<{ readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: LinkRefusal }> {
  if (!canCompress()) return { ok: false, reason: 'old-browser' };
  const fragment = await encodeLink(graph);
  const check = await decodeLink(fragment);
  if (!check.ok) return { ok: false, reason: check.reason };
  return { ok: true, text: `${fragment.slice(1)}\n` };
}

/** The link fragment a file's text opens as, or why it does not. */
export async function fragmentOfFile(text: string): Promise<FileResult> {
  const t = text.trim();
  const at = t.indexOf('#v');
  const fragment = /^v\d+\./.test(t) ? `#${t}` : at >= 0 && /^#v\d+\./.test(t.slice(at)) ? t.slice(at) : await fromBackup(t);
  if (typeof fragment !== 'string') return fragment;
  const check = await decodeLink(fragment);
  return check.ok ? { ok: true, fragment } : { ok: false, reason: check.reason };
}

/** A downloaded backup: the layout exactly as storage kept it. */
async function fromBackup(t: string): Promise<string | FileResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const pieces = (parsed as { pieces?: unknown } | null)?.pieces;
  if (Array.isArray(pieces) && pieces.length > LINK_MAX_PIECES) return { ok: false, reason: 'too-many-pieces' };
  const read = graphOfStored(parsed);
  if (!read.ok) return { ok: false, reason: read.reason };
  if (!canCompress()) return { ok: false, reason: 'old-browser' };
  return encodeLink(read.graph);
}
