/**
 * THE PHOTO CHECK (community-pieces plan, CEO X1, eng D5; the V3 check found
 * GitHub keeps a photo's location): location found and removed, the grid and
 * the straights found with no hand-read points, the 216mm trial judged.
 *
 * Value: protects=a JPEG's GPS (in Exif or XMP) is reported and removed while
 * its Orientation and image data survive; the grid is found at any rotation,
 * on paper whose 5mm lines print as dark as its 10mm ones, and on paper with
 * no 1mm lines, without halving or doubling every length; the medium and long
 * straights are found and the long one reads 216mm against the medium; the
 * trial passes, fails off-target and fails on disagreeing photos; a folder
 * exits 0 only when every photo is usable, and leaves out crops; a large piece
 * over the middle is neither warm paper nor a missing grid
 * Value: fails_when=a segment walk, the angle search, the 1mm pitch, the scale
 * retry, the plank body test or the trial rule is wrong
 * Value: why_new=no automatic check existed; photoMeasure.ts needs hand seeds
 * Value: seam=synthetic photos drawn here through a known perspective and lens
 * bowing (the colours measured on the trial photo, as photoGrid.test.ts), and
 * JPEG segments built byte by byte
 * Value: no_claim=real phone JPEGs; the owner's own 216mm trial photos were
 * run by hand and read 216.29 and 216.56mm (PR description), not in CI
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Pt } from './photo.js';
import { checkFolder, checkImage, trialVerdict } from './photoCheck.js';
import { cropPath } from './photoCrop.js';
import { focal35Of, hasLocation, orientationOf, stripMetadata } from './photoExif.js';
import { findGridAuto } from './photoGridSeed.js';
import { bmpConverters, type RgbImage } from './photoImage.js';
import { paperTooWarm } from './photoStraights.js';
import { drawPhoto } from './photoSynthetic.js';

// ── JPEG segments, built byte by byte ────────────────────────────────────────

const seg = (marker: number, body: number[]) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
/** An Exif APP1, big-endian: IFD0 with an Orientation and, when asked, a GPS IFD holding a latitude ref. */
function exifApp1(orientation: number, gps: boolean): number[] {
  const entries = gps ? 2 : 1;
  const ifd0 = 8, gpsAt = ifd0 + 2 + 12 * entries + 4;
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, ifd0, 0, entries, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0];
  if (gps) tiff.push(0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, gpsAt);
  tiff.push(0, 0, 0, 0);
  if (gps) tiff.push(0, 1, 0, 1, 0, 2, 0, 0, 0, 2, 0x4e, 0, 0, 0, 0, 0, 0, 0); // GPSLatitudeRef 'N'
  return seg(0xe1, [...text('Exif\0\0'), ...tiff]);
}
/** An Exif APP1, little-endian as phones write it: IFD0 with an Orientation, a GPS IFD and an Exif IFD holding the 35mm focal length. */
function phoneExif(orientation: number, focal35: number): number[] {
  const le = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >> (8 * i)) & 0xff);
  const entry = (tag: number, type: number, value: number) => [...le(tag, 2), ...le(type, 2), ...le(1, 4), ...le(value, 4)];
  const ifd0 = 8, gpsAt = ifd0 + 2 + 12 * 3 + 4, exifAt = gpsAt + 2 + 12 + 4;
  const tiff = [0x49, 0x49, 0x2a, 0, ...le(ifd0, 4), ...le(3, 2), ...entry(0x0112, 3, orientation), ...entry(0x8825, 4, gpsAt), ...entry(0x8769, 4, exifAt), 0, 0, 0, 0,
    ...le(1, 2), ...entry(0x0001, 2, 0x4e), 0, 0, 0, 0, // GPSLatitudeRef 'N'
    ...le(1, 2), ...entry(0xa405, 3, focal35), 0, 0, 0, 0];
  return seg(0xe1, [...text('Exif\0\0'), ...tiff]);
}
const APP0 = seg(0xe0, [...text('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const XMP_GPS = seg(0xe1, [...text('http://ns.adobe.com/xap/1.0/\0'), ...text('<x:xmpmeta><rdf:Description exif:GPSLatitude="51,30N"/></x:xmpmeta>')]);
const DATA = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0x56, 0xff, 0xd9];
const jpeg = (...parts: number[][]) => Uint8Array.from([0xff, 0xd8, ...parts.flat(), ...DATA]);

describe('location in a JPEG', () => {
  /*
   * MUTATION PROOF, run (2026-11-08): the GPS pointer tag read as 0x8826: `expected false to be true`.
   */
  it('is found in the Exif GPS block and in XMP, and not in a photo without it', () => {
    expect(hasLocation(jpeg(APP0, exifApp1(6, true)))).toBe(true);
    expect(hasLocation(jpeg(APP0, exifApp1(1, false), XMP_GPS))).toBe(true);
    expect(hasLocation(jpeg(APP0, exifApp1(6, false)))).toBe(false);
  });

  /*
   * MUTATION PROOFS, run (2026-11-08):
   * - the Orientation not written back: `expected undefined to be 6`.
   * - XMP kept (only Exif dropped): `expected true to be false`.
   */
  it('is removed with Exif and XMP, keeping the Orientation, JFIF and the image data byte for byte', () => {
    const before = jpeg(APP0, exifApp1(6, true), XMP_GPS);
    const after = stripMetadata(before);
    expect(hasLocation(after)).toBe(false);
    expect(orientationOf(after)).toBe(6);
    expect(Array.from(after.slice(2, 2 + APP0.length))).toEqual(APP0);
    expect(Array.from(after.slice(after.length - DATA.length))).toEqual(DATA);
    expect(() => stripMetadata(Uint8Array.of(0x42, 0x4d, 0, 0))).toThrow(/not a JPEG/);
  });

  /*
   * MUTATION PROOFS, run (2026-11-10):
   * - the focal length not written back: `expected [ false, 6, undefined ] to deeply equal [ false, 6, 48 ]`.
   * - the Exif IFD pointer read as 0x8768: `expected [ true, 6, undefined ] to deeply equal [ true, 6, 48 ]`.
   */
  it('keeps the 35mm focal length, which sets the scale (photo.ts, chooseScale)', () => {
    const before = jpeg(APP0, phoneExif(6, 48));
    expect([hasLocation(before), orientationOf(before), focal35Of(before)]).toEqual([true, 6, 48]);
    const after = stripMetadata(before);
    expect([hasLocation(after), orientationOf(after), focal35Of(after)]).toEqual([false, 6, 48]);
    expect(focal35Of(jpeg(APP0, exifApp1(1, false)))).toBe(undefined);
  });
});

describe('the grid and the straights, found with no hand-read points', () => {
  /*
   * MUTATION PROOF, run (2026-11-08): the coarse ends kept, not refined: at 25°
   * `expected 0.49655172413795867 to be less than 0.3`, at 90° `expected 217.5104895104896
   * to be close to 216`. These clean photos don't catch the fixes made for real
   * photos (the phase comb, the rings, the walled ends, the centreline); the
   * real-photo scoreboard (photoScoreboard.ts) does.
   */
  it.each([0, 25, 90])('at %i degrees, the long straight reads 216mm against the medium one', (deg) => {
    const c = checkImage(drawPhoto(deg));
    expect(c.problems).toEqual([]);
    expect(c.longMm).toBeCloseTo(216, 0);
    expect(Math.abs(c.longMm! - 216)).toBeLessThan(0.3);
  }, 30_000);

  /*
   * MUTATION PROOFS, run (2026-11-08):
   * - the 1mm pitch ignored and the scale retry removed: on both papers
   *   `expected [ Array(1) ] to deeply equal []` (no medium straight).
   * - the scale retry removed alone: on 'flat' paper `expected [ Array(1) ] to deeply equal []`;
   *   'mm' paper still passes, its 1mm lines giving the pitch.
   */
  it.each(['mm', 'flat'] as const)('on %s paper (5mm lines as dark as 10mm), lengths are not halved', (paper) => {
    const c = checkImage(drawPhoto(0, paper));
    expect(c.problems).toEqual([]);
    expect(Math.abs(c.longMm! - 216)).toBeLessThan(0.3);
  }, 30_000);
});

describe('two sheets in view', () => {
  /*
   * Both lie on one table, so either sheet's grid maps the whole plane: the
   * grid fit keeps one sheet and drops the other's crossings as misfits. (A fit
   * that mixes both reads past AUTO_GRID_RMS_MAX_MM and is refused: a real
   * photo showed that, 0.41mm; no synthetic one does.)
   * MUTATION PROOF, run (2026-11-08): misfit crossings kept (findGrid's outlier
   * drop removed): `expected 229 to be less than 195.5`.
   */
  it('are read from one sheet, never across both', () => {
    const one = checkImage(drawPhoto(0)), two = checkImage(drawPhoto(0, 'two'));
    expect(two.problems).toEqual([]);
    expect(two.gridPoints!).toBeLessThan(0.85 * one.gridPoints!);
    expect(Math.abs(two.longMm! - 216)).toBeLessThan(0.3);
  }, 60_000);
});

describe('paper as warm as the wood', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): the warm branch in checkImage removed:
   * `expected [ Array(1) ] to deeply equal [ StringMatching{…} ]` (another
   * reshoot reason, not what paper to use).
   */
  it('is refused with what paper to use, not read', () => {
    const c = checkImage(drawPhoto(0, 'cream'));
    expect(c.problems).toEqual([expect.stringMatching(/use white, blue or pink millimetre paper/)]);
    expect(c.longMm).toBeUndefined();
  }, 30_000);

  /*
   * MUTATION PROOF, run (2026-11-09): read without balancing (the photo as
   * loaded): `expected [ Array(1) ] to deeply equal []`, the problem "the paper
   * is as warm a colour as the wood…", as the owner's evening photos were.
   */
  it('is not what a warm lamp gives white paper: balanced on the paper, it reads as in daylight', () => {
    const lamp = drawPhoto(0, 'lamp');
    expect(paperTooWarm(lamp)).toBe(true);
    const c = checkImage(lamp);
    expect(c.problems).toEqual([]);
    expect(Math.abs(c.longMm! - 216)).toBeLessThan(0.3);
  }, 30_000);
});

describe('a large piece over the middle of the photo', () => {
  const roof = drawPhoto(0, 'roof');

  /*
   * MUTATION PROOF, run (2026-11-09): the paper read from the central half
   * again (the #204 dry run refused pink paper as too warm):
   * `expected true to be false`.
   */
  it('is not taken for warm paper', () => {
    expect(paperTooWarm(roof)).toBe(false);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): no wider search when the central half
   * shows no lines (the #204 dry run's "no regular grid lines"): every scale
   * answers `no regular grid lines found…`, `expected undefined to be defined`.
   */
  it('still has its grid found, from the paper around it', () => {
    // At the scales photoCheck.ts tries: around the roof this plain paper's 5mm lines read as the pitch.
    const found = [1, 2, 0.5].map((scale) => findGridAuto(roof, scale));
    const g = found.find((r) => 'grid' in r);
    expect(g, JSON.stringify(found)).toBeDefined();
    expect(g && 'grid' in g && g.grid.rmsMm).toBeLessThan(0.1);
  }, 60_000);

  /*
   * The roof is a wide warm piece, so with the straights under it the check
   * reads "something lies against the medium straight".
   * MUTATION PROOF, run (2026-11-09): the first scale's answer kept whatever
   * it was: `expected 'no usable grid: too little of the gri…' to match /medium straight/`.
   */
  it('is told about the medium straight, not that the grid is missing', () => {
    const [problem] = checkImage(roof).problems;
    expect(problem).toMatch(/medium straight/);
    expect(problem).not.toMatch(/no usable grid/);
  }, 60_000);
});

describe('the 216mm trial', () => {
  /*
   * MUTATION PROOF, run (2026-11-08): the tolerance compared without Math.abs: `expected true to be false`
   * (214.80mm passed).
   */
  it('passes on two agreeing readings within 1mm of 216, fails off-target or on disagreeing photos', () => {
    expect(trialVerdict([{ photo: 'a', valueMm: 216.3 }, { photo: 'b', valueMm: 216.6 }])?.pass).toBe(true);
    expect(trialVerdict([{ photo: 'a', valueMm: 214.8 }, { photo: 'b', valueMm: 214.9 }])?.pass).toBe(false);
    expect(trialVerdict([{ photo: 'a', valueMm: 216.0 }, { photo: 'b', valueMm: 217.0 }])?.pass).toBe(false);
    expect(trialVerdict([{ photo: 'a', valueMm: 216.0 }])?.pass).toBe(false);
    expect(trialVerdict([])).toBe(null);
  });
});

/** A 24-bit BMP, bottom-up rows. */
function bmp(img: RgbImage): Uint8Array {
  const stride = Math.ceil((img.width * 3) / 4) * 4, size = 54 + stride * img.height;
  const b = new Uint8Array(size);
  const v = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d; v.setUint32(2, size, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true);
  v.setInt32(18, img.width, true); v.setInt32(22, img.height, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 3, d = 54 + (img.height - 1 - y) * stride + x * 3;
      b[d] = img.rgb[s + 2]!; b[d + 1] = img.rgb[s + 1]!; b[d + 2] = img.rgb[s]!;
    }
  }
  return b;
}

describe('checking a folder', () => {
  /*
   * MUTATION PROOF, run (2026-11-08): the exit ignoring a failed trial: `expected +0 to be 1` (the second folder).
   */
  it('exits 0 when every photo is usable and the trial passes, 1 when the trial fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'photos-'));
    try {
      writeFileSync(join(dir, 'a.bmp'), bmp(drawPhoto(0)));
      writeFileSync(join(dir, 'b.bmp'), bmp(drawPhoto(25)));
      const lines: string[] = [];
      expect(checkFolder(dir, (l) => lines.push(l))).toBe(0);
      expect(lines.at(-1)).toMatch(/^TRIAL: the long straight reads 216\.\d\dmm/);
      // One photo only: the trial needs two agreeing ones.
      rmSync(join(dir, 'b.bmp'));
      expect(checkFolder(dir, () => {})).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  /*
   * A side, end or underside photo has no grid to read (photo guide, step 3):
   * the drawing skill runs --location-only on everything it downloads.
   * MUTATION PROOFS, run (2026-11-08):
   * - the location-only branch removed (every photo fully checked):
   *   `expected 1 to be +0`.
   * - its location step skipped: `expected +0 to be 2`.
   */
  it('with --location-only, strips and reports location but asks no grid of a side or underside photo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'photos-'));
    try {
      // A plain image with no grid: the full check would ask for a reshoot.
      const blank: RgbImage = { width: 200, height: 150, rgb: new Uint8Array(200 * 150 * 3).fill(200) };
      writeFileSync(join(dir, 'side.bmp'), bmp(blank));
      expect(checkFolder(dir, () => {})).toBe(1);
      const lines: string[] = [];
      expect(checkFolder(dir, (l) => lines.push(l), { locationOnly: true })).toBe(0);
      expect(lines).toEqual(['side.bmp: OK']);
      // A located photo is still found, reported and stripped.
      writeFileSync(join(dir, 'end.jpg'), jpeg(APP0, exifApp1(6, true)));
      expect(checkFolder(dir, () => {}, { locationOnly: true })).toBe(2);
      expect(hasLocation(new Uint8Array(readFileSync(join(dir, 'end.jpg'))))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /*
   * The drawing skill crops top views to read ends by hand (the #204 dry run).
   * MUTATION PROOF, run (2026-11-09): the crop filter removed:
   * `expected [ 'side.bmp: OK', …(1) ] to deeply equal [ 'side.bmp: OK' ]`
   * (the crop read as `side.crop-0-0-120.png: OK`). The overlay filter removed
   * (2026-11-09): `expected [ 'side.bmp: OK', …(1) ] to deeply equal
   * [ 'side.bmp: OK' ]` (the overlay read as `side.overlay.png: OK`).
   */
  it('leaves out a crop or an overlay left beside a photo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'photos-'));
    try {
      const blank: RgbImage = { width: 200, height: 150, rgb: new Uint8Array(200 * 150 * 3).fill(200) };
      writeFileSync(join(dir, 'side.bmp'), bmp(blank));
      writeFileSync(join(dir, cropPath('side.bmp', { x0: 0, y0: 0, side: 120 })), bmp(blank));
      writeFileSync(join(dir, 'side.overlay.png'), bmp(blank));
      const lines: string[] = [];
      checkFolder(dir, (l) => lines.push(l), { locationOnly: true });
      expect(lines).toEqual(['side.bmp: OK']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  /*
   * MUTATION PROOF, run (2026-11-08): sips offered off macOS: `expected [ 'sips', 'magick',
   * 'convert', …(1) ] to deeply equal [ 'magick', 'convert', 'ffmpeg' ]`.
   */
  it('reads photos through sips on macOS and ImageMagick or ffmpeg elsewhere', () => {
    expect(bmpConverters('darwin')[0]![0]).toBe('sips');
    expect(bmpConverters('linux').map(([c]) => c)).toEqual(['magick', 'convert', 'ffmpeg']);
    expect(bmpConverters('win32')[0]![0]).not.toBe('sips');
  });
});

export type { Pt };
