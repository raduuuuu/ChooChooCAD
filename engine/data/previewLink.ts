/**
 * ONE DRAWN PIECE IN A LINK (contributor-brief plan, steps 2 and 3, E1; T3).
 *
 *   piece JSON ─▶ checkUntrustedPart ─▶ JSON ─▶ deflate-raw ─▶ base64url ─▶ #p1.<data>
 *
 * The same bytes as a layout link (`engine/src/io/linkCodec.ts`), under its
 * own prefix: `#p<n>.` for a piece, `#v<n>.` for a layout, so the app tells
 * them apart from the first characters and a layout link is never read as a
 * piece. `p` for piece; `1` its packing's version, so a later packing is
 * refused with a sentence by an older app, as a layout link is (share plan
 * D17). The data is the piece's own JSON, unpacked: one piece is small, and
 * the maintainer decodes exactly what the sender's Claude wrote.
 *
 * Decoding refuses rather than repairs, cheapest check first, and runs the
 * same validator as encoding, so a hand-edited link is checked as hard as
 * one the script made. Pure: nothing is stored.
 */

import { canCompress, deflate, fromBase64Url, inflate, toBase64Url } from '../src/io/linkCodec.js';
import type { Part } from '../src/parts/schema.js';
import { checkUntrustedPart } from './untrustedPart.js';

/** Any version of a piece's fragment; the digits are the version. */
export const PREVIEW_FRAGMENT = /^#p(\d+)\./;
/** This packing's prefix. */
export const PREVIEW_PREFIX = '#p1.';
/**
 * The fragment's cap, characters, prefix included: half a layout link's
 * 8,192 (`app/src/shareLink.ts`, LINK_MAX_CHARS), so the preview link fits
 * URL-encoded inside a prefilled issue link with the figures and the text
 * (plan step 2, "Size budget").
 */
export const PREVIEW_MAX_CHARS = 4096;
/** Inflated, at most: a layout link's cap (share plan D22); a real piece is a few kilobytes. */
export const PREVIEW_MAX_INFLATED = 64 * 1024;

export type PreviewResult =
  | { readonly ok: true; readonly part: Part; readonly data: unknown }
  | { readonly ok: false; readonly code: PreviewRefusal; readonly reasons: readonly string[] };

export type PreviewRefusal = 'version' | 'too-long' | 'old-runtime' | 'bad-encoding' | 'corrupt' | 'too-large' | 'not-json' | 'invalid';

const no = (code: PreviewRefusal, reason: string): PreviewResult => ({ ok: false, code, reasons: [reason] });

/**
 * The fragment for a piece, checked first: `{ ok: true, fragment }` or the
 * validator's reasons, or 'too-long' past PREVIEW_MAX_CHARS. Needs `canCompress()`.
 */
export async function encodePreview(data: unknown): Promise<{ ok: true; fragment: string } | { ok: false; code: PreviewRefusal; reasons: readonly string[] }> {
  const checked = checkUntrustedPart(data);
  if (!checked.ok) return { ok: false, code: 'invalid', reasons: checked.reasons };
  const fragment = `${PREVIEW_PREFIX}${toBase64Url(await deflate(JSON.stringify(data)))}`;
  if (fragment.length > PREVIEW_MAX_CHARS) {
    return { ok: false, code: 'too-long', reasons: [`the preview fragment is ${fragment.length} characters, over the ${PREVIEW_MAX_CHARS} cap`] };
  }
  return { ok: true, fragment };
}

/** Read a `#p<n>.` fragment into a checked piece, or say why not. */
export async function decodePreview(fragment: string): Promise<PreviewResult> {
  const m = PREVIEW_FRAGMENT.exec(fragment);
  if (!m || m[1] !== '1') return no('version', m ? `a version ${m[1]} preview link; this reads version 1` : 'not a preview link: it starts with #p1.');
  if (fragment.length > PREVIEW_MAX_CHARS) return no('too-long', `${fragment.length} characters, over the ${PREVIEW_MAX_CHARS} cap`);
  if (!canCompress()) return no('old-runtime', 'this browser or runtime has no deflate-raw streams');
  const bytes = fromBase64Url(fragment.slice(m[0].length));
  if (bytes === null || bytes.byteLength === 0) return no('bad-encoding', 'the data after #p1. is not base64url');
  const inflated = await inflate(bytes, PREVIEW_MAX_INFLATED);
  if (!inflated.ok) {
    return inflated.reason === 'too-large'
      ? no('too-large', `it unpacks to over ${PREVIEW_MAX_INFLATED} bytes`)
      : no('corrupt', 'the data does not unpack: the link was cut short or changed');
  }
  let data: unknown;
  try {
    data = JSON.parse(inflated.text);
  } catch {
    return no('not-json', 'the data unpacks, but not to JSON');
  }
  const checked = checkUntrustedPart(data);
  return checked.ok ? { ok: true, part: checked.part, data } : { ok: false, code: 'invalid', reasons: checked.reasons };
}
