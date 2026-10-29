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
 * IKEA CURVES, AND WHY THERE ARE STILL NONE FOR PLAYTIVE. A curve needs a
 * radius and nobody PUBLISHES one for either brand. Until 2026-10-29 this file
 * held straights only for that reason. One reproduction now gives a radius
 * for Lillabo: MakerWorld 2181560 by Vamuss, whose description says the
 * pieces were modelled "zu 100% den IKEA Lillabo Schienen (gekauft 2025)
 * nachempfunden", copied from Lillabo track bought in 2025, rather than
 * drawn as a compromise between IKEA and BRIO. Read off its 3MF meshes the
 * way `switchSeeds.ts` reads switches, its curves come out at a centreline
 * radius of 202.1 to 202.6mm in three angles, 22.5, 45 and 90 degrees. That
 * is BRIO E's 202 to within the scatter, and the lattice holds integers
 * only, so the seeds use 202 (inner 182). The rounding moves the far end of a
 * 45-degree curve by about 0.4mm, half the estimated joint slop. Playtive
 * still has no curve: the Lidl reproductions found (MakerWorld 1045052) come
 * in 10-degree steps, which the 22.5-degree lattice cannot hold, and their
 * two arc fits disagree by 15mm, so they are not a radius anyone could cite.
 *
 * One thing that is NOT a problem, contrary to an earlier worry: both brands are
 * metric and every figure below is a whole number of millimetres, so all of them
 * are exactly representable in Z[zeta16]. The inch-rounding hazard applies to US
 * brands such as Maxim and Jesse's Toy Box, which are not in this file.
 *
 * HOW THESE GET FIXED. Not by more searching; there is nothing to find. A user
 * who owns the track measures it and submits the figure, which overrides the
 * seed. That is also the only route to a Playtive curve, and the only way the
 * Lillabo radius stops resting on one reproduction.
 */

import type { BrandFit, Brand, CurvePart, DimensionSource, Part, PartEnds, StraightPart } from '../src/parts/schema.js';

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
    'IKEA publishes no piece dimensions. The 150 is a customizer default, not a copy of ' +
    'a real piece: the Lillabo reproduction in IKEA_REPRODUCTION has a 145 and no 150. ' +
    'Upgrade to community-measured only when ' +
    'someone states a measured figure for a specific piece, or to published if ' +
    'IKEA ever lists one.',
};

/**
 * The Lillabo reproduction, measured off its 3MF on 2026-10-29.
 *
 * Better than `IKEA_UNVERIFIED` because its author says it copies bought
 * track rather than splitting the difference with BRIO, and still
 * `unverified`, because a copy of a part is not a measurement of it.
 */
const IKEA_REPRODUCTION: DimensionSource = {
  status: 'unverified',
  source:
    'MakerWorld 2181560 "IKEA Lillabo 100% kompatible Schienen" by Vamuss, modelled on ' +
    'Lillabo track bought in 2025, measured off the 3MF meshes on 2026-10-29',
  note:
    'A 3D-print reproduction, not a measurement of real track. Straights read 50.0, ' +
    '100.0, 145.0, 205.0 and 240.0mm end face to end face. Curves read a centreline ' +
    'radius of 202.1 to 202.6mm and are modelled at 202, the nearest integer. ' +
    'Upgrade when someone measures real Lillabo track.',
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

/** Profile read off the same meshes: 40 wide, 12 thick, as on BRIO. Grooves unmeasured. */
const LILLABO_PROFILE = { heightMm: 0, gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12 } as const;

const lillaboStraight = (lengthMm: number): StraightPart => ({
  id: `IKEA-${lengthMm}`, brand: 'IKEA', kind: 'straight', name: 'Lillabo straight',
  lengthMm,
  dimensions: IKEA_REPRODUCTION, slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, ...LILLABO_PROFILE,
});

const lillaboCurve = (code: string, arcSteps: number, name: string): CurvePart => ({
  id: `IKEA-${code}`, brand: 'IKEA', kind: 'curve', name,
  innerRadiusMm: 182, arcSteps,
  dimensions: IKEA_REPRODUCTION, slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, ...LILLABO_PROFILE,
});

const LILLABO_STRAIGHTS: readonly StraightPart[] = [50, 100, 145, 205, 240].map(lillaboStraight);

const LILLABO_CURVES: readonly CurvePart[] = [
  lillaboCurve('C22', 1, 'Lillabo curve, 22.5°'),
  lillaboCurve('C45', 2, 'Lillabo curve, 45°'),
  lillaboCurve('C90', 4, 'Lillabo curve, 90°'),
];

/**
 * SEEDS, not a catalogue. Brand-prefixed ids. Playtive is straights only.
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
  ...LILLABO_STRAIGHTS,
  ...LILLABO_CURVES,
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
