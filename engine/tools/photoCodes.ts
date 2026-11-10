/**
 * EVERY WAY THE PHOTO TOOLS REFUSE, ONCE (measuring-tools plan 2026-11-09,
 * DX D3, D9; eng E5): each code's recovery class and its fix. The text
 * output, `--help` and the JSON all read this table, and a test fails when
 * the drawing skill's "Measure codes" table misses one.
 *
 *   recovery: retake      take the photo again (how is in the fix)
 *             edit-points change the points file and run again
 *             install     install what the fix names and run again
 *             human       stop and ask
 */

export type Recovery = 'retake' | 'edit-points' | 'install' | 'human';

export const CODES = {
  'photo-missing': { recovery: 'edit-points', fix: 'check the path: it is the photo file itself, relative to where you run the command' },
  'no-converter': { recovery: 'install', fix: 'on macOS `sips` is built in; elsewhere install ImageMagick (`magick`) or ffmpeg, or save the photo as a BMP' },
  'photo-unreadable': { recovery: 'retake', fix: 'open the photo and save it again as a JPEG; if that fails, retake it' },
  heic: { recovery: 'retake', fix: 'set the camera to "Most Compatible" (JPEG), or export the photo as JPEG' },
  orientation: { recovery: 'retake', fix: 'open the photo, save it again upright (or rotate and export it), and use that copy' },
  'grid-not-found': { recovery: 'retake', fix: 'retake with the millimetre paper filling most of the photo, flat and evenly lit' },
  'grid-rms': { recovery: 'retake', fix: 'use one sheet, lying flat, and retake' },
  'paper-warm': { recovery: 'retake', fix: 'use white, blue or pink millimetre paper, in daylight, and retake' },
  'reference-unread': { recovery: 'retake', fix: 'lay the medium straight flat, top face up, fully on the grid, about 2cm from every other piece, and retake' },
  'reference-faces-camera': { recovery: 'retake', fix: 'lay the medium straight across the middle of the photo and retake' },
  'reference-off-size': { recovery: 'retake', fix: 'use the whole photo as the camera took it (not cropped), the medium straight flat on one sheet of millimetre paper, and retake' },
  'k-implausible': { recovery: 'edit-points', fix: 'check the reference points are the medium straight\'s two end centres; if they are, it is not lying flat: retake' },
  'point-outside': { recovery: 'edit-points', fix: 'points are in the photo\'s full pixels; a point read off a smaller preview must be scaled up to them' },
  'faces-camera': { recovery: 'retake', fix: 'lay the piece across the middle of the photo and retake' },
  geometry: { recovery: 'edit-points', fix: 'pick the figure\'s points again: its ends are on top of each other or off the paper' },
  usage: { recovery: 'edit-points', fix: 'run with --help for the usage' },
  'points-not-json': { recovery: 'edit-points', fix: 'make the points file valid JSON (--help shows an example)' },
  'points-invalid': { recovery: 'edit-points', fix: 'fix the field named, as --help shows' },
  'no-figures': { recovery: 'edit-points', fix: 'add at least one figure under "figures"' },
  'needs-photo': { recovery: 'edit-points', fix: 'add --photo <photo>' },
  'overlay-path': { recovery: 'edit-points', fix: 'give --overlay a folder, or a path ending .overlay.png' },
  internal: { recovery: 'human', fix: 're-run with the same input; if it happens again, report it with the trace file named above' },
} as const satisfies Record<string, { recovery: Recovery; fix: string }>;

export type Code = keyof typeof CODES;

/** A refusal: its code, what happened with the values that caused it, and the fix. */
export interface Refusal {
  readonly code: Code;
  readonly reason: string;
  readonly fix: string;
  readonly recovery: Recovery;
}

export const refusal = (code: Code, reason: string, fix: string = CODES[code].fix): Refusal => ({ code, reason, fix, recovery: CODES[code].recovery });
