/**
 * A photo's pixels, with no image library (plan 2026-11-02, E2 revisited):
 * macOS `sips` converts the photo to an uncompressed BMP, and this reads it.
 *
 *   photo.jpg ──sips -s format bmp──▶ photo.bmp ──readBmp──▶ { width, height, rgb }
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

/** Any photo `sips` can open, as pixels. */
export function loadPhoto(path: string): RgbImage {
  const dir = mkdtempSync(join(tmpdir(), 'photo-'));
  try {
    const bmp = join(dir, 'photo.bmp');
    execFileSync('sips', ['-s', 'format', 'bmp', path, '--out', bmp], { stdio: 'ignore' });
    return readBmp(readFileSync(bmp));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
