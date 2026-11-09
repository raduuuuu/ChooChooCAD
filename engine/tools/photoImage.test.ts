/**
 * READING A PHOTO ANYWHERE, UPRIGHT, AND WRITING A PNG (measuring-tools plan
 * 2026-11-09, item 1; DX D4, D5; eng E2, G4, G5, G7).
 *
 * Value: protects=a photo read off macOS says why it failed (missing, no
 * converter, unreadable) instead of "install a converter"; a portrait phone
 * photo comes back the way the phone shows it, never turned twice; a crop is a
 * valid PNG without any converter
 * Value: fails_when=the catch-all returns, ENOENT is read as a failure, the
 * deadline is per converter, a turn goes the wrong way, or a CRC is wrong
 * Value: why_new=loadPhoto swallowed every error and crops needed sips
 * Value: seam=the decoder (converters, deadline, run) is injected; the real
 * runConverter is run against `sleep`, `sh` and a missing command
 * Value: no_claim=what sips, ImageMagick and ffmpeg do with a rotated JPEG
 * (the Linux sandbox acceptance runs them)
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync, crc32 } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { jpegSize } from './photoExif.js';
import { type Decoder, loadPhoto, loadUpright, PhotoError, type RgbImage, readBmp, runConverter, sniff, turn, upright, writePng } from './photoImage.js';

/** A 24-bit bottom-up BMP of the image, as a converter writes one. */
function bmpBytes(img: RgbImage): Uint8Array {
  const stride = Math.ceil((img.width * 3) / 4) * 4;
  const out = new Uint8Array(54 + stride * img.height);
  const v = new DataView(out.buffer);
  out[0] = 0x42;
  out[1] = 0x4d;
  v.setUint32(2, out.length, true);
  v.setUint32(10, 54, true);
  v.setUint32(14, 40, true);
  v.setInt32(18, img.width, true);
  v.setInt32(22, img.height, true);
  v.setUint16(26, 1, true);
  v.setUint16(28, 24, true);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 3, d = 54 + (img.height - 1 - y) * stride + x * 3;
      out[d] = img.rgb[s + 2]!;
      out[d + 1] = img.rgb[s + 1]!;
      out[d + 2] = img.rgb[s]!;
    }
  }
  return out;
}

/** A w x h image whose pixel (x, y) is (x, y, 7): every pixel says where it came from. */
const marked = (w: number, h: number): RgbImage => {
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgb.set([x, y, 7], (y * w + x) * 3);
  return { width: w, height: h, rgb };
};
const at = (img: RgbImage, x: number, y: number) => [...img.rgb.subarray((y * img.width + x) * 3, (y * img.width + x) * 3 + 2)];

/** A JPEG's header bytes: SOI, an Exif orientation, then the given segments, SOS, EOI. */
function jpeg(orientation: number | undefined, ...segments: number[][]): Uint8Array {
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation ?? 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const body = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff);
  const app1 = orientation === undefined ? [] : [0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  return Uint8Array.from([0xff, 0xd8, ...app1, ...segments.flat(), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
}
const sof = (marker: number, w: number, h: number) => [0xff, marker, 0, 11, 8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0];

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});
const file = (name: string, bytes: Uint8Array) => {
  dir ||= mkdtempSync(join(tmpdir(), 'photoImage-'));
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
};
/** A decoder whose one converter writes `img` as the BMP. */
const writes = (img: RgbImage): Decoder => ({
  converters: [['fake', (_f, t) => [t]]],
  deadlineMs: 1000,
  run: (_c, [to]) => {
    writeFileSync(to!, bmpBytes(img));
    return { ok: true };
  },
});

describe('writePng', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the CRC taken over the data only, not
   * type + data: `expected 4121984034 to be 3562295983`.
   */
  it('writes chunks whose CRCs check and whose image data inflates back to the pixels', () => {
    const img = marked(5, 3);
    const png = writePng(img);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const v = new DataView(png.buffer, png.byteOffset);
    let i = 8;
    const types: string[] = [];
    let idat: Uint8Array = new Uint8Array(0);
    while (i < png.length) {
      const len = v.getUint32(i), type = String.fromCharCode(...png.subarray(i + 4, i + 8));
      expect(v.getUint32(i + 8 + len)).toBe(crc32(png.subarray(i + 4, i + 8 + len)));
      if (type === 'IHDR') expect([v.getUint32(i + 8), v.getUint32(i + 12), png[i + 16], png[i + 17]]).toEqual([5, 3, 8, 2]);
      if (type === 'IDAT') idat = png.subarray(i + 8, i + 8 + len);
      types.push(type);
      i += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
    const raw = inflateSync(idat);
    for (let y = 0; y < 3; y++) {
      expect(raw[y * 16]).toBe(0);
      expect([...raw.subarray(y * 16 + 1, y * 16 + 16)]).toEqual([...img.rgb.subarray(y * 15, y * 15 + 15)]);
    }
  });
});

describe('what a file is', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the ftyp check removed: a HEIC named
   * .jpg becomes `other`: `expected 'other' to be 'heic'`.
   */
  it('is read from its first bytes, whatever its name', () => {
    expect(sniff(jpeg(1, sof(0xc0, 4, 3)))).toBe('jpeg');
    expect(sniff(writePng(marked(2, 2)))).toBe('png');
    expect(sniff(bmpBytes(marked(2, 2)))).toBe('bmp');
    expect(sniff(Uint8Array.from([0, 0, 0, 24, ...'ftypheic'].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c))))).toBe('heic');
    expect(sniff(new TextEncoder().encode('just text'))).toBe('other');
  });

  it('a HEIC or a text file named .jpg is refused before any converter runs', () => {
    const ran: string[] = [];
    const d: Decoder = { converters: [['fake', () => []]], deadlineMs: 1000, run: (c) => (ran.push(c), { ok: true }) };
    const heic = file('a.jpg', Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]));
    expect(() => loadPhoto(heic, d)).toThrow(expect.objectContaining({ code: 'heic' }));
    const text = file('b.jpg', new TextEncoder().encode('not a photo'));
    expect(() => loadPhoto(text, d)).toThrow(expect.objectContaining({ code: 'photo-unreadable' }));
    expect(ran).toEqual([]);
  });
});

describe('reading a photo says why it failed', () => {
  it('a missing path is photo-missing, naming it', () => {
    expect(() => loadPhoto('/no/such/photo.jpg')).toThrow(expect.objectContaining({ code: 'photo-missing', message: expect.stringContaining('/no/such/photo.jpg') }));
  });

  /*
   * MUTATION PROOF, run (2026-11-09): an absent converter counted as tried:
   * `expected 'photo-unreadable' to be 'no-converter'`.
   */
  it('every converter absent is no-converter; one that ran and failed is photo-unreadable, naming it', () => {
    const p = file('a.jpg', jpeg(1, sof(0xc0, 4, 3)));
    const absent: Decoder = { converters: [['magick', () => []], ['ffmpeg', () => []]], deadlineMs: 1000, run: () => ({ absent: true }) };
    let e = (() => { try { loadPhoto(p, absent); } catch (x) { return x as PhotoError; } })()!;
    expect(e.code).toBe('no-converter');
    const failing: Decoder = { ...absent, run: (c) => (c === 'magick' ? { absent: true } : { failed: 'Invalid data found' }) };
    e = (() => { try { loadPhoto(p, failing); } catch (x) { return x as PhotoError; } })()!;
    expect(e.code).toBe('photo-unreadable');
    expect(e.message).toContain('ffmpeg: Invalid data found');
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the deadline reset per converter
   * (`left = decoder.deadlineMs`): the second converter runs, and the error
   * no longer says it was out of time: `expected [Function] to throw error
   * matching /next: not tried, out of time/`.
   */
  it('one deadline covers the whole read: after a slow converter, the rest are not tried', () => {
    const p = file('a.jpg', jpeg(1, sof(0xc0, 4, 3)));
    const ran: string[] = [];
    const d: Decoder = {
      converters: [['slow', () => []], ['next', () => []]],
      deadlineMs: 200,
      run: (c) => {
        ran.push(c);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
        return { failed: 'ran out of time after 0s' };
      },
    };
    expect(() => loadPhoto(p, d)).toThrow(/next: not tried, out of time/);
    expect(ran).toEqual(['slow']);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): ENOENT not singled out: a missing
   * command reads as failed: `expected { Object (failed) } to deeply equal
   * { absent: true }` (before the ETIMEDOUT check it even read as "ran out of
   * time", which this run caught); the NOISE filter removed: `expected
   * { Object (failed) } to deeply equal { failed: 'the real reason' }`.
   */
  it('runs a converter: absent, out of time, or failed with its first real stderr line', () => {
    expect(runConverter('no-such-converter-xyz', [], 1000)).toEqual({ absent: true });
    expect(runConverter('sleep', ['5'], 200)).toEqual({ failed: 'ran out of time after 0s' });
    expect(runConverter('sh', ['-c', 'echo "convert: WARNING deprecated" >&2; echo "the real reason" >&2; exit 1'], 5000)).toEqual({ failed: 'the real reason' });
    expect(runConverter('true', [], 5000)).toEqual({ ok: true });
  });

  it('a malformed BMP is photo-unreadable', () => {
    const p = file('a.bmp', Uint8Array.from([0x42, 0x4d, 1, 2, 3]));
    expect(() => loadPhoto(p)).toThrow(expect.objectContaining({ code: 'photo-unreadable' }));
  });
});

describe('the JPEG stored size', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): only SOF0 accepted: a progressive
   * photo has no size: `not a JPEG: no frame header`.
   */
  it('reads a progressive frame header, after a DHT, and skips a thumbnail inside APP1', () => {
    const dht = [0xff, 0xc4, 0, 4, 0, 0];
    expect(jpegSize(jpeg(6, dht, sof(0xc2, 4032, 3024)))).toEqual({ width: 4032, height: 3024 });
    // An APP1 holding a thumbnail's own SOF0 (160 x 120) is stepped over whole.
    const thumb = [0xff, 0xe1, 0, 2 + 13, ...sof(0xc0, 160, 120)];
    expect(jpegSize(jpeg(undefined, thumb, sof(0xc0, 4000, 3000)))).toEqual({ width: 4000, height: 3000 });
  });
});

describe('a photo made upright', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): 6 and 8 swapped in turn(): `expected
   * [ 2, 1 ] to deeply equal [ +0, +0 ]`.
   */
  it('6 turns a quarter clockwise: the stored top-left is shown top-right', () => {
    const shown = turn(marked(3, 2), 6);
    expect([shown.width, shown.height]).toEqual([2, 3]);
    expect(at(shown, 1, 0)).toEqual([0, 0]);
    expect(at(shown, 0, 0)).toEqual([0, 1]);
    expect(at(shown, 0, 2)).toEqual([2, 1]);
  });

  it('8 turns a quarter anticlockwise: the stored top-left is shown bottom-left', () => {
    const shown = turn(marked(3, 2), 8);
    expect(at(shown, 0, 2)).toEqual([0, 0]);
    expect(at(shown, 1, 0)).toEqual([2, 1]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the already-turned check removed: a
   * photo the converter turned is refused: `the photo's EXIF orientation is
   * 6: it decoded at 2×3, neither its stored 3×2 nor that turned`.
   */
  it('is not turned twice when the converter already turned it, and refuses what the size cannot tell', () => {
    const stored = { width: 3, height: 2 };
    expect([upright(marked(3, 2), 6, stored).width, upright(marked(3, 2), 6, stored).height]).toEqual([2, 3]);
    const already = marked(2, 3);
    expect(upright(already, 6, stored)).toBe(already);
    expect(() => upright(marked(3, 3), 6, { width: 3, height: 3 })).toThrow(/square/);
    expect(() => upright(marked(3, 2), 3, stored)).toThrow(expect.objectContaining({ code: 'orientation', message: expect.stringContaining('orientation is 3') }));
    expect(() => upright(marked(3, 2), 2, stored)).toThrow(/mirrored/);
    expect(() => upright(marked(3, 2), 6, null)).toThrow(/stored size/);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): loadUpright returning the stored
   * pixels (no upright()): `expected [ 3, 2 ] to deeply equal [ 2, 3 ]`.
   */
  it('loadUpright turns a portrait JPEG; on orientation 1 it gives loadPhoto\'s pixels exactly', () => {
    const portrait = file('p.jpg', jpeg(6, sof(0xc0, 3, 2)));
    const shown = loadUpright(portrait, writes(marked(3, 2)));
    expect([shown.width, shown.height]).toEqual([2, 3]);
    expect(at(shown, 1, 0)).toEqual([0, 0]);
    const plain = file('q.jpg', jpeg(1, sof(0xc0, 3, 2)));
    expect(loadUpright(plain, writes(marked(3, 2)))).toEqual(loadPhoto(plain, writes(marked(3, 2))));
    expect(loadPhoto(portrait, writes(marked(3, 2))).width).toBe(3);
  });

  it('a PNG is read as stored', () => {
    const p = file('p.png', writePng(marked(3, 2)));
    expect(loadUpright(p, writes(marked(3, 2))).width).toBe(3);
  });
});

describe('the BMP reader', () => {
  it('reads what the test writer writes', () => {
    expect(readBmp(bmpBytes(marked(5, 3)))).toEqual(marked(5, 3));
  });
});
