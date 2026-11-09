/**
 * THE CROP WINDOW AND ITS WAY BACK (plan 2026-11-02, eng E2).
 *
 * Value: protects=a point read in a 4x crop maps back to its pixel in the
 * photo, and a window near an edge stays inside the photo
 * Value: fails_when=the zoom is not divided out, or the clamp is dropped
 * Value: why_new=no crop tool existed
 * Value: seam=none; sips itself is checked by hand (a crop of og.png's panel
 * edges landed at the predicted crop pixels, x and y)
 * Value: no_claim=sips argument order; that hand check owns it
 */

import { describe, expect, it } from 'vitest';
import { CROP, cropPath, enlarge, fromCrop, HELP, parseArgs, windowAround, ZOOM } from './photoCrop.js';

describe('crop windows', () => {
  it('centres on the point, and a point read in the crop comes back to it', () => {
    const w = windowAround(4000, 3000, 1000, 800, 60);
    expect(w).toEqual({ x0: 940, y0: 740, side: 120 });
    expect(fromCrop(w, 60 * ZOOM, 60 * ZOOM)).toEqual([1000, 800]);
  });

  /*
   * MUTATION PROOF, run: `cx / ZOOM` written as `cx` fails with
   * `expected [ 1180, 980 ] to deeply equal [ 1000, 800 ]`.
   */
  it('a quarter pixel in the crop is a sixteenth in the photo', () => {
    const w = windowAround(4000, 3000, 1000, 800, 60);
    expect(fromCrop(w, 241, 240)).toEqual([1000.25, 800]);
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the zoom not divided out of the source
   * pixel (`w.x0 + x`): `expected [ 13, 10 ] to deeply equal [ 10, 10 ]`.
   */
  it('enlarges each photo pixel into a 4x4 square, nearest neighbour', () => {
    const img = { width: 20, height: 20, rgb: new Uint8Array(20 * 20 * 3) };
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) img.rgb.set([x, y, 0], (y * 20 + x) * 3);
    const crop = enlarge(img, { x0: 10, y0: 10, side: 4 });
    expect([crop.width, crop.height]).toEqual([16, 16]);
    const px = (x: number, y: number) => [crop.rgb[(y * 16 + x) * 3], crop.rgb[(y * 16 + x) * 3 + 1]];
    expect(px(3, 3)).toEqual([10, 10]);
    expect(px(4, 0)).toEqual([11, 10]);
    expect(px(15, 15)).toEqual([13, 13]);
  });

  it('a window at the photo edge stays inside it', () => {
    expect(windowAround(4000, 3000, 10, 2995, 60)).toEqual({ x0: 0, y0: 2880, side: 120 });
  });
});

describe('the crop file', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): CROP written without the window numbers
   * (`/\.crop\.png$/`): `expected false to be true`. The photo check skips
   * files matching it, so a crop left in top/ is not checked as a photo.
   */
  it('is named beside its photo, by a pattern the photo check skips', () => {
    const out = cropPath('photos/issue-1/top/3.jpg', { x0: 940, y0: 740, side: 120 });
    expect(out).toBe('photos/issue-1/top/3.crop-940-740-120.png');
    expect(CROP.test(out)).toBe(true);
    expect(CROP.test('photos/issue-1/top/3.jpg')).toBe(false);
  });
});

describe('the command line', () => {
  /*
   * MUTATION PROOF, run (2026-11-09): --help not looked for: `expected
   * { Object (error) } to deeply equal { help: true }` (the Linux sandbox run
   * found --help missing).
   */
  it('--help is asked for, and says how to use the crop', () => {
    expect(parseArgs(['--help'])).toEqual({ help: true });
    expect(parseArgs(['p.jpg', '-h'])).toEqual({ help: true });
    for (const s of ['usage:', '{ "crop":', 'half', 'photo-missing', 'orientation']) expect(HELP).toContain(s);
  });

  it('takes a photo, two numbers and an optional half size', () => {
    expect(parseArgs(['p.jpg', '63', '17.5'])).toEqual({ photo: 'p.jpg', x: 63, y: 17.5, half: 60 });
    expect(parseArgs(['p.jpg', '63', '17', '40'])).toEqual({ photo: 'p.jpg', x: 63, y: 17, half: 40 });
  });

  /*
   * MUTATION PROOF, run: the finite check on x and y removed fails with
   * `expected { photo: 'p.jpg', x: NaN, y: 50, …(1) } to have property "error"`.
   * That NaN is the crop once written as p1.crop-NaN-0-120.png (2026-11-03).
   */
  it('refuses "63 17" passed as one argument instead of cropping at NaN', () => {
    expect(parseArgs(['p.jpg', '63 17', '50'])).toHaveProperty('error');
  });

  /*
   * MUTATION PROOF, run (2026-11-09): the whole-number check dropped (back to
   * `half <= 0`): `expected { photo: 'p.jpg', x: 63, …(2) } to have property
   * "error"`; a half of 60.25 made a 120.5 px window no crop name matches.
   */
  it('refuses a half size that is not a whole positive number', () => {
    expect(parseArgs(['p.jpg', '63', '17', '0'])).toHaveProperty('error');
    expect(parseArgs(['p.jpg', '63', '17', 'big'])).toHaveProperty('error');
    expect(parseArgs(['p.jpg', '63', '17', '60.25'])).toHaveProperty('error');
  });
});
