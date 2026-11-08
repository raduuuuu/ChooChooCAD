/**
 * Third-party track: the small-peg and look-alike systems.
 *
 * READ THIS BEFORE TRUSTING ANYTHING IN HERE.
 *
 * Every dimension below is `unverified`. Not a hedge: no manufacturer publishes
 * piece dimensions for either brand. The small-peg maker's own product page gives the PACKAGE
 * size and nothing else. The figures here come from 3D-printing projects that
 * reproduce the track, which is the best that exists and is not a catalogue.
 *
 * Four separate reasons these numbers may be wrong, each from a source:
 *
 * 1. There is no standard, deliberately. "There is no established standard for
 *    wooden track gauges, and while just about everyone uses the Generic system as
 *    their guide, to avoid patent issues each has small deviations in their
 *    measurements." (the published track guide)
 *
 * 2. Advertised lengths are unreliable even from manufacturers: one maker's
 *    advertised 3-inch straights are actually 82mm long (same page).
 *
 * 3. The same brand varies by country. "in some countries, dimensions of the
 *    tracks may differ a little bit from the commonly known." (the track
 *    generator author, who measured small-peg stock from Germany and Poland)
 *
 * 4. The brands do not physically join Generic anyway. "the most popular systems
 *    are incompatible... fitting small-peg track plug (shorter) to Generic track nest
 *    (longer) may be impossible without braking or damaging one of the parts."
 *    (same author). Owners' reviews on the small-peg maker's site agree: "the pegs and holes are smaller
 *    and does not fit the Generic".
 *
 * SMALL-PEG CURVES, AND WHY THERE ARE STILL NONE FOR THE LOOK-ALIKE SYSTEM. A curve needs a
 * radius and nobody PUBLISHES one for either brand. Until 2026-10-29 this file
 * held straights only for that reason. One reproduction now gives a radius
 * for small-peg track: a printed reproduction whose description says its
 * pieces were copied from small-peg track bought in 2025, rather than
 * drawn as a compromise between small-peg and Generic. Read off its 3MF meshes the
 * way `switchSeeds.ts` reads switches, its curves come out at a centreline
 * radius of 202.1 to 202.6mm in three angles, 22.5, 45 and 90 degrees. That
 * is Generic E's 202 to within the scatter, and the lattice holds integers
 * only, so the seeds use 202 (inner 182). The rounding moves the far end of a
 * 45-degree curve by about 0.4mm, half the estimated joint slop. The look-alike
 * system still has no curve: the look-alike reproductions found (a printed reproduction) come
 * in 10-degree steps, which the 22.5-degree lattice cannot hold, and their
 * two arc fits disagree by 15mm, so they are not a radius anyone could cite.
 *
 * One thing that is NOT a problem, contrary to an earlier worry: both brands are
 * metric and every figure below is a whole number of millimetres, so all of them
 * are exactly representable in Z[zeta16]. The inch-rounding hazard applies to
 * inch-based makers, none of which are in this file.
 *
 * HOW THESE GET FIXED. Not by more searching; there is nothing to find. A user
 * who owns the track measures it and submits the figure, which overrides the
 * seed. That is also the only route to a look-alike curve, and the only way the
 * small-peg radius stops resting on one reproduction.
 */

import type { Cyc } from '../src/geom/cyclotomic.js';
import type {
  BrandFit, Brand, CurvePart, DimensionSource, MultiRoadPart, Part, PartEnds, Polarity, StraightPart,
} from '../src/parts/schema.js';

/** Same slop placeholder as Generic. Nobody has measured these joints either. */
const UNMEASURED_SLOP = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated' as const,
};

const STANDARD_ENDS: PartEnds = { start: 'socket', end: 'peg' };

const SMALL_PEG_UNVERIFIED: DimensionSource = {
  status: 'unverified',
  source: '3D-print reproductions and an OpenSCAD generator',
  note:
    'The maker publishes no piece dimensions. The 150 is a customizer default, not a copy of ' +
    'a real piece: the printed reproduction of this track has a 145 and no 150. ' +
    'Upgrade to community-measured only when ' +
    'someone states a measured figure for a specific piece, or to published if ' +
    'the maker ever lists one.',
};

/**
 * The small-peg reproduction, measured off its 3MF on 2026-10-29.
 *
 * Better than `SMALL_PEG_UNVERIFIED` because its author says it copies bought
 * track rather than splitting the difference with Generic, and still
 * `unverified`, because a copy of a part is not a measurement of it.
 */
const SMALL_PEG_REPRODUCTION: DimensionSource = {
  status: 'unverified',
  source:
    'a printed reproduction, modelled on ' +
    'small-peg track bought in 2025, measured off the 3MF meshes on 2026-10-29',
  note:
    'A 3D-print reproduction, not a measurement of real track. Straights read 50.0, ' +
    '100.0, 145.0, 205.0 and 240.0mm end face to end face. Curves read a centreline ' +
    'radius of 202.1 to 202.6mm and are modelled at 202, the nearest integer. ' +
    'Upgrade when someone measures real small-peg track.',
};

const LOOK_ALIKE_UNVERIFIED: DimensionSource = {
  status: 'unverified',
  source: '3D-print reproductions (printed reproduction titles for look-alike track)',
  note:
    'The maker publishes no piece dimensions.',
};

/**
 * small-peg plug and nest radii from the generator author's own measurements.
 *
 * Recorded because they resolve an open calibration question, which
 * listed "6.25 vs 6.4mm" as one of two unexplained plug/nest pairs sitting 23x
 * away from the other. These are the small-peg figures, as RADII, against Generic's
 * 11.5mm peg and 15-17mm socket as DIAMETERS. Different brand and different
 * convention, which is why they looked irreconcilable.
 */
export const SMALL_PEG_CONNECTOR = {
  plugRadiusMm: 6.25,
  nestRadiusMm: 6.4,
  source: 'an OpenSCAD track generator, author measurements',
} as const;

/** Profile read off the same meshes: 40 wide, 12 thick, as on Generic. Grooves unmeasured. */
const SMALL_PEG_PROFILE = { heightMm: 0, gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12 } as const;

const smallPegStraight = (lengthMm: number): StraightPart => ({
  id: `IKEA-${lengthMm}`, brand: 'IKEA', kind: 'straight', name: 'Small-peg straight',
  lengthMm,
  dimensions: SMALL_PEG_REPRODUCTION, slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, ...SMALL_PEG_PROFILE,
});

const smallPegCurve = (code: string, arcSteps: number, name: string): CurvePart => ({
  id: `IKEA-${code}`, brand: 'IKEA', kind: 'curve', name,
  innerRadiusMm: 182, arcSteps,
  dimensions: SMALL_PEG_REPRODUCTION, slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, ...SMALL_PEG_PROFILE,
});

const SMALL_PEG_STRAIGHTS: readonly StraightPart[] = [50, 100, 145, 205, 240].map(smallPegStraight);

const SMALL_PEG_CURVES: readonly CurvePart[] = [
  smallPegCurve('C22', 1, 'Small-peg curve, 22.5°'),
  smallPegCurve('C45', 2, 'Small-peg curve, 45°'),
  smallPegCurve('C90', 4, 'Small-peg curve, 90°'),
];

/**
 * THE SMALL-PEG SWITCH AND CROSSING, from the same reproduction set.
 *
 * The two "y" files (`y-fmm`, `y-mff`) are an ordinary switch read from the
 * other end: with their shared end taken as the heel, one road is a 145
 * straight and the other a 45-degree curve at the 202 centreline, both
 * exact, which is why the end reader first took them for Ys. `fmm` has a
 * socket heel and pegs, `mff` the reverse. The `-tt` files add a quarter
 * circle of about 84mm that matches no small-peg piece, and are left out.
 *
 * The crossing's roads are two 145 straights, so the second one crosses at
 * 72.5, half a millimetre off the grid. ROUNDED (owner, 2026-10-30): its
 * ends sit at (72, -72) and (72, 73), still 145 apart, the road 0.5mm off
 * the middle of the first, and 0.5mm along it.
 */
const SMALL_PEG_SWITCH_SOURCE: DimensionSource = {
  ...SMALL_PEG_REPRODUCTION,
  note:
    'The y-fmm and y-mff files, reframed from their shared end: straight end at 145.1, ' +
    'curved end on the 202 centreline, both to 0.2mm. Exact on the grid.',
};
const SMALL_PEG_CROSSING_SOURCE: DimensionSource = {
  ...SMALL_PEG_REPRODUCTION,
  note:
    'Cross-145: two 145 roads, the second crossing at (72.4 to 72.5, +/-72.5). ROUNDED to ' +
    'the grid: its ends at (72, -72) and (72, 73), 0.5mm off the true middle each way.',
};
const other = (p: Polarity): Polarity => (p === 'peg' ? 'socket' : 'peg');
const xy = (x: number, y: number): Cyc => [x, 0, 0, 0, y, 0, 0, 0];

const smallPegSwitch = (heel: Polarity): MultiRoadPart => ({
  id: heel === 'socket' ? 'IKEA-SW' : 'IKEA-SW-P',
  brand: 'IKEA', kind: 'multi-road',
  name: heel === 'socket' ? 'Small-peg switch' : 'Small-peg switch, peg heel',
  ports: [
    { at: { pos: xy(0, 0), heading: 8 }, polarity: heel, name: 'heel', kind: 'heel' },
    { at: { pos: xy(145, 0), heading: 0 }, polarity: other(heel), name: 'straight road' },
    { at: { pos: [0, 0, 0, 0, 202, 0, -202, 0], heading: 2 }, polarity: other(heel), name: 'curved road' },
  ],
  roads: [
    { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 145 } },
    { from: 0, to: 2, shape: { kind: 'arc', innerRadiusMm: 182, arcSteps: 2, side: 'left' } },
  ],
  sizeLabel: 'r202',
  flip: { label: 'Branch to the other side', verb: 'branch it to the other side', after: 'Now branches to the other side.' },
  dimensions: SMALL_PEG_SWITCH_SOURCE, slop: UNMEASURED_SLOP, ...SMALL_PEG_PROFILE,
});

const SMALL_PEG_MULTI_ROAD: readonly MultiRoadPart[] = [
  smallPegSwitch('socket'),
  smallPegSwitch('peg'),
  {
    id: 'IKEA-X145', brand: 'IKEA', kind: 'multi-road', name: 'Small-peg crossing',
    ports: [
      { at: { pos: xy(0, 0), heading: 8 }, polarity: 'socket', name: "first road's near end" },
      { at: { pos: xy(145, 0), heading: 0 }, polarity: 'peg', name: "first road's far end" },
      { at: { pos: xy(72, -72), heading: 12 }, polarity: 'peg', name: "second road's near end" },
      { at: { pos: xy(72, 73), heading: 4 }, polarity: 'socket', name: "second road's far end" },
    ],
    roads: [
      { from: 0, to: 1, shape: { kind: 'straight', lengthMm: 145 } },
      { from: 2, to: 3, shape: { kind: 'straight', lengthMm: 145 } },
    ],
    sizeLabel: '145×145',
    dimensions: SMALL_PEG_CROSSING_SOURCE, slop: UNMEASURED_SLOP, ...SMALL_PEG_PROFILE,
  },
];

/**
 * SEEDS, not a catalogue. Brand-prefixed ids. The look-alike system is straights only.
 *
 * These exist so that someone who owns small-peg or look-alike track finds a row to
 * CORRECT rather than a blank form. Every one is `unverified`, and a user
 * submission for the same id overrides it, because a person with the piece in
 * their hand is a better source than a 3D-print model title. See
 * `resolveLibrary` in library.ts for the override rule.
 */
export const THIRD_PARTY_SEEDS: readonly Part[] = [
  {
    id: 'IKEA-150', brand: 'IKEA', kind: 'straight', name: 'Small-peg straight',
    lengthMm: 150,
    dimensions: SMALL_PEG_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    // Profile assumed to match the de facto Generic cross section. Also unverified:
    // Owners' reviews on the small-peg maker's site say the connectors differ, so the profile may too.
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  ...SMALL_PEG_STRAIGHTS,
  ...SMALL_PEG_CURVES,
  ...SMALL_PEG_MULTI_ROAD,
  {
    id: 'PLAYTIVE-30', brand: 'PLAYTIVE', kind: 'straight', name: 'Look-alike straight, short',
    lengthMm: 30,
    dimensions: LOOK_ALIKE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-60', brand: 'PLAYTIVE', kind: 'straight', name: 'Look-alike straight',
    lengthMm: 60,
    dimensions: LOOK_ALIKE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-110', brand: 'PLAYTIVE', kind: 'straight', name: 'Look-alike straight, medium',
    lengthMm: 110,
    dimensions: LOOK_ALIKE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-150', brand: 'PLAYTIVE', kind: 'straight', name: 'Look-alike straight, long',
    lengthMm: 150,
    dimensions: LOOK_ALIKE_UNVERIFIED,
    slop: UNMEASURED_SLOP, ends: STANDARD_ENDS, heightMm: 0,
    gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12,
  },
  {
    id: 'PLAYTIVE-200', brand: 'PLAYTIVE', kind: 'straight', name: 'Look-alike straight, extra long',
    lengthMm: 200,
    dimensions: LOOK_ALIKE_UNVERIFIED,
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
  ['GENERIC', 'GENERIC', 'joins', 'Same system.'],
  ['IKEA', 'IKEA', 'joins', 'Same system.'],
  ['PLAYTIVE', 'PLAYTIVE', 'joins', 'Same system.'],
  ['GENERIC', 'IKEA', 'does-not-join',
    'The small-peg plug is shorter and the Generic nest longer; forcing them "may be impossible without braking or damaging one of the parts". Owners report the pegs and holes are smaller and do not fit Generic.'],
  ['GENERIC', 'PLAYTIVE', 'unknown',
    'Look-alike track is advertised as Generic-compatible and some owners report it works, but no measurement supports it and the reference says every maker deviates deliberately.'],
  ['IKEA', 'PLAYTIVE', 'unknown', 'No source either way.'],
];

export function brandFit(a: Brand, b: Brand): { fit: BrandFit; why: string } {
  for (const [x, y, fit, why] of FIT) {
    if ((x === a && y === b) || (x === b && y === a)) return { fit, why };
  }
  return { fit: 'unknown', why: 'No source documents this combination.' };
}
