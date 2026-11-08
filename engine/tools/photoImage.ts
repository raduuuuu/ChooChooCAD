/**
 * A photo's pixels, with no image library (plan 2026-11-02, E2 revisited):
 * a converter (`sips` on macOS; ImageMagick or ffmpeg elsewhere, community-
 * pieces plan eng D5) turns the photo into an uncompressed BMP, and this
 * reads it. A BMP is read directly.
 *
 *   photo.jpg ──sips | magick | ffmpeg──▶ photo.bmp ──readBmp──▶ { width, height, rgb }
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RgbImage {
  readonly width: number;
  readonly height: number;
  /** Row-major, top row first, three bytes per pixel: red, green, blue. */
  readonly rgb: Uint8Array;
}

/** An uncompressed 24- or 32-bit BMP, either row order. Throws on anything else. */
export function readBmp(bytes: Uint8Array): RgbImage {
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

/**
 * The converters tried, in order, to turn a photo into a BMP: macOS's `sips`,
 * then ImageMagick and ffmpeg anywhere (community-pieces plan, eng D5: builders
 * on Linux and Windows). Each is `[command, args for (in, out)]`.
 */
export function bmpConverters(platform: string): readonly (readonly [string, (from: string, to: string) => string[]])[] {
  const others = [
    ['magick', (f: string, t: string) => [f, t]],
    ['convert', (f: string, t: string) => [f, t]],
    ['ffmpeg', (f: string, t: string) => ['-loglevel', 'error', '-y', '-i', f, t]],
  ] as const;
  return platform === 'darwin' ? [['sips', (f, t) => ['-s', 'format', 'bmp', f, '--out', t]], ...others] : others;
}

/** What to say when no converter can open the photo. */
export const NO_CONVERTER =
  'No image converter found: on macOS `sips` is built in; elsewhere install ImageMagick (`magick`) or ffmpeg, or save the photo as a BMP.';

/** Any photo as pixels: a BMP read directly, anything else through the first converter that works. */
export function loadPhoto(path: string): RgbImage {
  if (/\.bmp$/i.test(path)) return readBmp(readFileSync(path));
  const dir = mkdtempSync(join(tmpdir(), 'photo-'));
  try {
    const bmp = join(dir, 'photo.bmp');
    for (const [command, args] of bmpConverters(process.platform)) {
      try {
        execFileSync(command, args(path, bmp), { stdio: 'ignore' });
        return readBmp(readFileSync(bmp));
      } catch {
        // Not installed, or it can't read this photo: try the next one.
      }
    }
    throw new Error(NO_CONVERTER);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
