/**
 * THE BYTES OF A LINK, ONCE (contributor-brief plan, Section 1: the shared
 * codec; T3). Moved here from `app/src/shareLink.ts` so a layout link, a
 * piece's preview link (`engine/data/previewLink.ts`) and the brief's
 * `engine/tools/briefLink.ts` pack and unpack text the same way: the engine
 * never imports from `app/`, and a second copy would drift.
 *
 *   text ─▶ deflate-raw ─▶ base64url          base64url ─▶ bytes ─▶ inflate (capped) ─▶ text
 *
 * Browser-native streams only (no dependency): every browser the app
 * supports, Node and Bun have `CompressionStream('deflate-raw')`.
 */

/** Whether this runtime has what links need (share plan D9). Checked once per call. */
export const canCompress = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Bytes as base64url: `-` and `_` for `+` and `/`, no padding, so the text is safe in a URL unescaped. */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes of base64url text, or null for any character outside its alphabet or a length no encoder makes. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** `text` as UTF-8, deflated raw (no zlib header: two bytes fewer in every link). Needs `canCompress()`. */
export async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Response(text).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type Inflated = { ok: true; text: string } | { ok: false; reason: 'corrupt' | 'too-large' };

/**
 * Inflate, reading chunk by chunk and stopping as soon as `cap` bytes are
 * passed (share plan D22): a few kilobytes of crafted deflate can expand to
 * gigabytes, so the cap is enforced while reading, never after. Not UTF-8, a
 * bad stream, or a truncated one is 'corrupt'.
 */
export async function inflate(bytes: Uint8Array<ArrayBuffer>, cap: number): Promise<Inflated> {
  // `Response`, not `Blob.stream()`: every target has it, jsdom included.
  const reader = new Response(bytes).body!.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
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
