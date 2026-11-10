/**
 * A photo's pixels, with no image library (plan 2026-11-02, E2 revisited;
 * measuring-tools plan 2026-11-09, item 1): a converter (`sips` on macOS;
 * ImageMagick or ffmpeg elsewhere, community-pieces plan eng D5) turns the
 * photo into an uncompressed BMP, and this reads it. A BMP is read directly.
 *
 *   bytes ──sniff──▶ BMP ───────────────────────────────▶ readBmp
 *                │   JPEG│PNG ──sips│magick│convert│ffmpeg──▶ photo.bmp ──readBmp──▶ { width, height, rgb }
 *                │   HEIC ──▶ PhotoError heic
 *                └── other ─▶ PhotoError photo-unreadable (no converter ever sees it)
 *
 * Which loader: `loadUpright` for anything that reads points off a photo
 * (crops, measuring), so a point means what a phone or a chat preview shows;
 * `loadPhoto` only for `photoCheck`, which looks at whole photos and must read
 * them exactly as it always has.
 *
 * Crops and overlays are written with `writePng` here (node:zlib), so no
 * converter is needed to write.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { CODES } from './photoCodes.js';
import type { Camera } from './photo.js';
import { focal35Of, jpegSize, orientationOf } from './photoExif.js';

export interface RgbImage {
  readonly width: number;
  readonly height: number;
  /** Row-major, top row first, three bytes per pixel: red, green, blue. */
  readonly rgb: Uint8Array;
}

/** Why a photo can't be read, with a stable code (photoCodes.ts) and the fix as its own line. */
export class PhotoError extends Error {
  readonly fix: string;
  constructor(
    readonly code: 'photo-missing' | 'no-converter' | 'photo-unreadable' | 'heic' | 'orientation',
    message: string,
    fix?: string,
  ) {
    super(message);
    this.fix = fix ?? CODES[code].fix;
  }
}

/** An uncompressed 24- or 32-bit BMP, either row order. Throws on anything else. */
export function readBmp(bytes: Uint8Array): RgbImage {
  if (bytes.length < 54) throw new Error('not a BMP: too short');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error('not a BMP');
  const offset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const bpp = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  if ((bpp !== 24 && bpp !== 32) || (compression !== 0 && compression !== 3)) {
    throw new Error(`unsupported BMP: ${bpp} bits, compression ${compression}`);
  }
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const step = bpp / 8;
  const stride = Math.floor((bpp * width + 31) / 32) * 4;
  if (width <= 0 || offset + stride * height > bytes.length) throw new Error('not a BMP: its pixels run past the end');
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const row = offset + (topDown ? y : height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const s = row + x * step;
      const d = (y * width + x) * 3;
      rgb[d] = bytes[s + 2]!;
      rgb[d + 1] = bytes[s + 1]!;
      rgb[d + 2] = bytes[s]!;
    }
  }
  return { width, height, rgb };
}

/** What a file is, from its first bytes, whatever its name says (eng G5). */
export type PhotoKind = 'jpeg' | 'png' | 'bmp' | 'heic' | 'other';
export function sniff(bytes: Uint8Array): PhotoKind {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  if (String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp') return 'heic';
  return 'other';
}

/**
 * The converters tried, in order, to turn a photo into a BMP: macOS's `sips`,
 * then ImageMagick and ffmpeg anywhere (community-pieces plan, eng D5: builders
 * on Linux and Windows). Each is `[command, args for (in, out, kind)]`. Paths
 * are absolute, so none starts with `-`; ImageMagick is told the input's
 * format (`jpeg:/abs/p`) and never guesses it from the bytes (eng G5).
 */
export function bmpConverters(platform: string): readonly (readonly [string, (from: string, to: string, kind: 'jpeg' | 'png') => string[]])[] {
  const others = [
    ['magick', (f: string, t: string, k: 'jpeg' | 'png') => [`${k}:${f}`, `bmp:${t}`]],
    ['convert', (f: string, t: string, k: 'jpeg' | 'png') => [`${k}:${f}`, `bmp:${t}`]],
    ['ffmpeg', (f: string, t: string) => ['-loglevel', 'error', '-y', '-i', f, t]],
  ] as const;
  return platform === 'darwin' ? [['sips', (f, t) => ['-s', 'format', 'bmp', f, '--out', t]], ...others] : others;
}

/** One converter run: done, not installed, or failed with the reason. */
export type RunResult = { readonly ok: true } | { readonly absent: true } | { readonly failed: string };

/** How photos are decoded: which converters, how long in all, and how one is run (injected in tests). */
export interface Decoder {
  readonly converters: ReturnType<typeof bmpConverters>;
  /** One deadline for the whole read, not per converter (eng G4). */
  readonly deadlineMs: number;
  readonly run: (command: string, args: string[], timeoutMs: number) => RunResult;
}

/** ImageMagick 7 warns on stderr that `convert` is deprecated: not the reason anything failed. */
const NOISE = /deprecated|WARNING: The convert command/i;

export function runConverter(command: string, args: string[], timeoutMs: number): RunResult {
  const r = spawnSync(command, args, { timeout: timeoutMs, killSignal: 'SIGKILL', stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT') return { absent: true };
  if (code === 'ETIMEDOUT' || r.signal) return { failed: `ran out of time after ${(timeoutMs / 1000).toFixed(0)}s` };
  if (r.error) return { failed: r.error.message };
  if (r.status !== 0) {
    const line = (r.stderr ?? '').split('\n').map((l) => l.trim()).find((l) => l && !NOISE.test(l));
    return { failed: line ?? `exit ${r.status}` };
  }
  return { ok: true };
}

export const DECODER: Decoder = { converters: bmpConverters(process.platform), deadlineMs: 60_000, run: runConverter };

/** A photo's bytes, its kind and its pixels as stored. */
function decode(path: string, decoder: Decoder): { bytes: Uint8Array; kind: PhotoKind; img: RgbImage } {
  const abs = resolve(path);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(abs));
  } catch (e) {
    throw new PhotoError('photo-missing', `can't read ${abs}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
  }
  const kind = sniff(bytes);
  if (kind === 'heic') throw new PhotoError('heic', `${abs} is a HEIC photo`);
  if (kind === 'other') throw new PhotoError('photo-unreadable', `${abs} is not a JPEG, PNG or BMP (its first bytes say so, whatever its name)`, 'give the photo as a JPEG, PNG or BMP');
  if (kind === 'bmp') {
    try {
      return { bytes, kind, img: readBmp(bytes) };
    } catch (e) {
      throw new PhotoError('photo-unreadable', `${abs}: ${(e as Error).message}`);
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'photo-'));
  try {
    const bmp = join(dir, 'photo.bmp');
    const end = Date.now() + decoder.deadlineMs;
    const tried: string[] = [];
    for (const [command, args] of decoder.converters) {
      const left = end - Date.now();
      if (left <= 0) {
        tried.push(`${command}: not tried, out of time`);
        continue;
      }
      const r = decoder.run(command, args(abs, bmp, kind), left);
      if ('absent' in r) continue;
      if ('failed' in r) {
        tried.push(`${command}: ${r.failed}`);
        continue;
      }
      try {
        return { bytes, kind, img: readBmp(readFileSync(bmp)) };
      } catch (e) {
        tried.push(`${command}: wrote a BMP that can't be read (${(e as Error).message})`);
      }
    }
    if (tried.length === 0) throw new PhotoError('no-converter', `no converter to read ${abs} (tried ${decoder.converters.map(([c]) => c).join(', ')} on PATH)`);
    throw new PhotoError('photo-unreadable', `${abs} could not be read: ${tried.join('; ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Any photo's pixels as stored, exactly as `photoCheck` has always read them. Throws a `PhotoError`. */
export function loadPhoto(path: string, decoder: Decoder = DECODER): RgbImage {
  return decode(path, decoder).img;
}

/**
 * Turn stored pixels the way a phone shows them. EXIF 6: the stored top row
 * is the shown right column (turn a quarter clockwise); 8: the stored top row
 * is the shown left column (a quarter anticlockwise).
 */
export function turn(img: RgbImage, orientation: 6 | 8): RgbImage {
  const { width: w, height: h } = img;
  const rgb = new Uint8Array(img.rgb.length);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < h; x++) {
      // Shown (x, y) in an h-wide, w-high picture comes from stored (sx, sy).
      const [sx, sy] = orientation === 6 ? [y, h - 1 - x] : [w - 1 - y, x];
      const s = (sy * w + sx) * 3, d = (y * h + x) * 3;
      rgb[d] = img.rgb[s]!;
      rgb[d + 1] = img.rgb[s + 1]!;
      rgb[d + 2] = img.rgb[s + 2]!;
    }
  }
  return { width: h, height: w, rgb };
}

/**
 * A decoded photo made upright, or why it can't be. `stored` is the JPEG's own
 * size: when the decoded size is that size swapped, the converter already
 * turned it (assumed the right way, by the tag), so it isn't turned twice.
 * Where the size can't tell (3, mirrored, a square 6 or 8), it is refused.
 */
export function upright(img: RgbImage, orientation: number, stored: { width: number; height: number } | null): RgbImage {
  if (orientation === 1) return img;
  const refuse = (why: string) =>
    new PhotoError('orientation', `the photo's EXIF orientation is ${orientation}: ${why}`);
  if (orientation !== 6 && orientation !== 8) throw refuse('turned half way or mirrored, which these tools do not undo');
  if (!stored) throw refuse('its stored size could not be read');
  if (stored.width === stored.height) throw refuse('a square photo, so it cannot be told whether the converter already turned it');
  if (img.width === stored.width && img.height === stored.height) return turn(img, orientation);
  if (img.width === stored.height && img.height === stored.width) return img;
  throw refuse(`it decoded at ${img.width}×${img.height}, neither its stored ${stored.width}×${stored.height} nor that turned`);
}

/** A photo's pixels the way a phone or a chat preview shows it. Throws a `PhotoError`. */
export function loadUpright(path: string, decoder: Decoder = DECODER): RgbImage {
  const { bytes, kind, img } = decode(path, decoder);
  // A PNG's eXIf orientation is ignored, by choice: phones write JPEGs, and a PNG is shown as stored.
  if (kind !== 'jpeg') return img;
  let stored: { width: number; height: number } | null = null;
  try {
    stored = jpegSize(bytes);
  } catch {
    // Size unreadable: only matters for 6 and 8, where upright() refuses it.
  }
  return upright(img, orientationOf(bytes) ?? 1, stored);
}

/** An 8-bit RGB PNG of the image: signature, IHDR, one IDAT, IEND. */
export function writePng(img: RgbImage): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, img.width);
  v.setUint32(4, img.height);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit depth, RGB, deflate, adaptive filtering, no interlace
  const row = img.width * 3;
  const raw = new Uint8Array((row + 1) * img.height);
  for (let y = 0; y < img.height; y++) raw.set(img.rgb.subarray(y * row, (y + 1) * row), y * (row + 1) + 1); // each row's filter byte 0: none
  const parts = [Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The camera a photo file names: its 35mm focal length from the Exif, when it is a JPEG that has one (photo.ts, chooseScale). */
export function cameraOf(path: string): Camera | undefined {
  try {
    const f = focal35Of(new Uint8Array(readFileSync(path)));
    return f === undefined ? undefined : { focal35mm: f };
  } catch {
    return undefined; // not a JPEG, or unreadable: the medium straight sets the scale
  }
}
