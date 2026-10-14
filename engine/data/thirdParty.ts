/**
 * Third-party track: IKEA Lillabo and Lidl Playtive.
 *
 * READ THIS BEFORE TRUSTING ANYTHING IN HERE.
 *
 * Every dimension below is `unverified`. Not a hedge: no manufacturer publishes
 * piece dimensions for either brand. IKEA's own product page gives the PACKAGE
 * size and nothing else. The figures here come from 3D-printing projects that
 * reproduce the track, which is the best that exists and is not a catalogue.
 *
 * Four separate reasons these numbers may be wrong, each from a source:
 *
 * 1. There is no standard, deliberately. "There is no established standard for
 *    wooden track gauges, and while just about everyone uses the BRIO system as
 *    their guide, to avoid patent issues each has small deviations in their
 *    measurements." (woodenrailway.info/track/third-party-track)
 *
 * 2. Advertised lengths are unreliable even from manufacturers. "The 3-inch
 *    straights advertised by Maxim, for example, are actually 82mm long."
 *    (same page)
 *
 * 3. The same brand varies by country. "in some countries, dimensions of the
 *    tracks may differ a little bit from the commonly known." (the track
 *    generator author, who measured IKEA stock from Germany and Poland)
 *
 * 4. The brands do not physically join BRIO anyway. "the most popular systems
 *    are incompatible... fitting IKEA track plug (shorter) to BRIO track nest
 *    (longer) may be impossible without braking or damaging one of the parts."
 *    (same author). IKEA's own reviews agree: "the pegs and holes are smaller
 *    and does not fit the Brio".
 *
 * WHY THERE ARE NO CURVES HERE. A curve needs a radius and nobody states one for
 * either brand. All that is reported is the ANGLE: Lillabo curves are "8 pieces
 * completing a full circle", so 45 degrees, with small curves at the same radius
 * and half the angle; Playtive is described as having 90-degree curves. Angles
 * are expressible on the 22.5-degree lattice, radii are unknown, so adding a
 * curve would mean inventing the one number that matters. Straights only.
 *
 * One thing that is NOT a problem, contrary to an earlier worry: both brands are
 * metric and every figure below is a whole number of millimetres, so all of them
 * are exactly representable in Z[zeta16]. The inch-rounding hazard applies to US
 * brands such as Maxim and Jesse's Toy Box, which are not in this file.
 *
 * HOW THESE GET FIXED. Not by more searching; there is nothing to find. A user
 * who owns the track measures it and submits the figure, which overrides the
 * seed. That is also the only route to a third-party CURVE, since a radius is
 * the one number no source states.
 */

import type { BrandFit, Brand, DimensionSource, Part, PartEnds } from '../src/parts/schema.js';

/** Same slop placeholder as BRIO. Nobody has measured these joints either. */
const UNMEASURED_SLOP = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated' as const,
};

const STANDARD_ENDS: PartEnds = { start: 'socket', end: 'peg' };

const IKEA_UNVERIFIED: DimensionSource = {
  status: 'unverified',
  source: '3D-print reproductions (MakerWorld, Printables, the torwanbukaj OpenSCAD generator)',
  note:
    'IKEA publishes no piece dimensions. Upgrade to community-measured only when ' +
    'someone states a measured figure for a specific piece, or to published if ' +
    'IKEA ever lists one.',
};

const PLAYTIVE_UNVERIFIED: DimensionSource = {
  status: 'unverified',
  source: '3D-print reproductions (Printables model titles for Lidl Playtive compatible track)',
  note:
    'Lidl publishes no piece dimensions. NOTE ON THE BRAND: Lidl wooden railway ' +
    'is PLAYTIVE, sometimes Playtive Junior. Lupilu is Lidl\'s baby and clothing ' +
    'line and makes no wooden railway, so a request for a "Lupilu catalogue" is ' +
    'a request for this one.',
};

/**
 * Lillabo plug and nest radii from the generator author's own measurements.
 *
 * Recorded because they resolve an open question in `CALIBRATION.md`, which
 * lists "6.25 vs 6.4mm" as one of two unexplained plug/nest pairs sitting 23x
 * away from the other. These are the IKEA figures, as RADII, against BRIO's
 * 11.5mm peg and 15-17mm socket as DIAMETERS. Different brand and different
 * convention, which is why they looked irreconcilable.
 */
export const IKEA_CONNECTOR = {
  plugRadiusMm: 6.25,
  nestRadiusMm: 6.4,
  source: 'torwanbukaj/ikea-brio-others-compatible-train-tracks-generator, author measurements',
} as const;

/**
 * SEEDS, not a catalogue. Straights only, brand-prefixed ids.
 *
 * These exist so that someone who owns IKEA or Playtive track finds a row to
 * CORRECT rather than a blank form. Every one is `unverified`, and a user
 * submission for the same id overrides it, because a person with the piece in
 * their hand is a better source than a 3D-print model title. See
 * `resolveLibrary` in library.ts for the override rule.
 */
export const THIRD_PARTY_SEEDS: readonly Part[] = [
  {
    id: 'IKEA-150', brand: 'IKEA', kind: 'straight', name: 'Lillabo straight',
    lengthMm: 150,
    dimensions: IKEA_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    // Profile assumed to match the de facto BRIO cross section. Also unverified:
    // IKEA's own reviews say the connectors differ, so the profile may too.
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-30', brand: 'PLAYTIVE', kind: 'straight', name: 'Playtive straight, short',
    lengthMm: 30,
    dimensions: PLAYTIVE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-60', brand: 'PLAYTIVE', kind: 'straight', name: 'Playtive straight',
    lengthMm: 60,
    dimensions: PLAYTIVE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-110', brand: 'PLAYTIVE', kind: 'straight', name: 'Playtive straight, medium',
    lengthMm: 110,
    dimensions: PLAYTIVE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-150', brand: 'PLAYTIVE', kind: 'straight', name: 'Playtive straight, long',
    lengthMm: 150,
    dimensions: PLAYTIVE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-200', brand: 'PLAYTIVE', kind: 'straight', name: 'Playtive straight, extra long',
    lengthMm: 200,
    dimensions: PLAYTIVE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
];

/**
 * Whether two brands' connectors actually join, as documented.
 *
 * The useful product fact from all of this research. Symmetric, so look up
 * either order. Anything absent is 'unknown' rather than assumed to work.
 */
const FIT: ReadonlyArray<readonly [Brand, Brand, BrandFit, string]> = [
  ['BRIO', 'BRIO', 'joins', 'Same system.'],
  ['IKEA', 'IKEA', 'joins', 'Same system.'],
  ['PLAYTIVE', 'PLAYTIVE', 'joins', 'Same system.'],
  ['BRIO', 'IKEA', 'does-not-join',
    'The IKEA plug is shorter and the BRIO nest longer; forcing them "may be impossible without braking or damaging one of the parts". IKEA reviews report the pegs and holes are smaller and do not fit BRIO.'],
  ['BRIO', 'PLAYTIVE', 'unknown',
    'Playtive is advertised as BRIO-compatible and some owners report it works, but no measurement supports it and the reference says every brand deviates deliberately.'],
  ['IKEA', 'PLAYTIVE', 'unknown', 'No source either way.'],
];

export function brandFit(a: Brand, b: Brand): { fit: BrandFit; why: string } {
  for (const [x, y, fit, why] of FIT) {
    if ((x === a && y === b) || (x === b && y === a)) return { fit, why };
  }
  return { fit: 'unknown', why: 'No source documents this combination.' };
}
