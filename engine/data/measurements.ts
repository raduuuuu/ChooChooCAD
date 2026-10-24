/**
 * THE AFTERNOON ON THE FLOOR, AS NUMBERS (CALIBRATION.md, task V3).
 *
 * Fill this in from the printed sheet (`docs/calibration-sheet.html`); the
 * keys match its boxes. Leave anything you did not measure as `null`: a null
 * keeps the estimate it would have replaced, and says so.
 *
 * These are the RAW readings, committed as read (T46's provenance rule). What
 * the engine makes of them is derived in `calibration.ts`, never typed here,
 * so the derivation can be read, tested and corrected without re-measuring.
 *
 * After filling it in:
 *   bun run calibration     what each answer changes, and the Q1 cross-check
 *   bun run test            the specs that pin today's estimates will fail;
 *                           that is the point, see CALIBRATION.md step 3
 */

import type { Measurements } from './calibration.js';

export const MEASUREMENTS: Measurements = {
  /** 'YYYY-MM-DD'. Required as soon as any number below is filled in. */
  measuredOn: null,
  /** How, in a few words: "digital caliper, steel rule", "phone photo over a rule". */
  method: null,

  /** Q1: E E E E D E E E E A, the loop the engine says misses by 72mm. */
  q1: {
    closes: null, //            true / false: closes with every joint seated
    feel: null, //              'strained' / 'comfortable', if it closes
    leftoverGapMm: null, //     if it does not close
    trainRuns: null, //         true / false: a train goes round without derailing
  },

  /** Q2: two straights, one joint. */
  q2: {
    pullApartMm: null, //       face-to-face gap at the limit of comfortable pull
    pushStopMm: null, //        0 if it closes to touching; else the gap at the hard stop
    bendDeg: null, //           in-plane bend at the limit, if read as an angle
    bendSidewaysMm: null, //    OR: the far end's sideways travel ...
    bendOverMm: null, //        ... over this length (the piece's length)
  },

  /** Q3: the 216mm straight, D (#33341). */
  q3: {
    overallMm: null, //         end face to end face, peg included
    withoutPegMm: null, //      base of the peg to the opposite end face
    pegNeckDiameterMm: null,
    socketThroatWidthMm: null,
  },

  /** Q4: the ramp, N (#33332). */
  q4: {
    runMm: null, //             flat on the floor, end to end
    slopeMm: null, //           along the sloping surface
  },

  /** Q5: the bridge subtraction. */
  q5: {
    vehicleHeightMm: null, //   the tallest vehicle you own, wheels to roof
    riseMm: null, //            ramp rise, if you re-measure it (published: 64)
    plankThicknessMm: null, //  if you re-measure it (published: 12)
  },

  /** Q6: a switch, if you have one. Measure along the centreline, between the grooves. */
  q6: {
    throughMm: null, //         heel to the straight road's end
    chordMm: null, //           heel to the diverging road's end, straight line
    offsetMm: null, //          that end's distance off the through road's line
  },
};
