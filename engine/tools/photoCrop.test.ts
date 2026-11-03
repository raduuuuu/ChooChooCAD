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
import { fromCrop, parseArgs, windowAround, ZOOM } from './photoCrop.js';

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

  it('a window at the photo edge stays inside it', () => {
    expect(windowAround(4000, 3000, 10, 2995, 60)).toEqual({ x0: 0, y0: 2880, side: 120 });
  });
});

describe('the command line', () => {
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

  it('refuses a half size that is not a positive number', () => {
    expect(parseArgs(['p.jpg', '63', '17', '0'])).toHaveProperty('error');
    expect(parseArgs(['p.jpg', '63', '17', 'big'])).toHaveProperty('error');
  });
});
