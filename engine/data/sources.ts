/**
 * Published figures, their citations, and the conflicts with our own data.
 *
 * WHY THIS FILE EXISTS
 *
 * The suite proves the published RELATIONS exactly (A1 = 2*A2, D = 2*A1,
 * 2*D = 3*A), and a relation is true for a whole family of values: scale every
 * straight by 10% and all of them still pass. Absolute figures therefore need a
 * citation to be pinned to, which is what this file is. The original defect was
 * four separate tests that appeared to pin the curve radius and did not, because
 * each restated `182` as its own expected value, so changing the datum and the
 * literals together kept the suite green.
 *
 * CORRECTED 2026-10-20 (task K2). The paragraph here used to claim that every
 * absolute dimension in `brio.ts` was pinned to nothing and that exactly one
 * test tells you the data moved. Both were out of date: `STRAIGHT_LENGTHS`,
 * `CURVE_RADII_OURS` and `CURVE_ARC_STEPS` already existed and the suite already
 * compared the catalogue against them. What was genuinely unpinned was the track
 * profile, whose figures lived here only as PROSE inside
 * `RESOLVED[2].conflict.note`. They are now exported as `TRACK_PROFILE`.
 *
 * A CORRECTION TAKES TWO EDITS, AND THAT IS DELIBERATE. `brio.ts` keeps its own
 * private copies of these figures and does NOT import them from here. If it did,
 * both sides of every comparison in `engine/test/sources.test.ts` would be the
 * same object and no assertion there could ever fail. So fix the figure here,
 * fix it in `brio.ts`, and that test stays red until the two agree. The header
 * used to say "one edit in one place", which was the opposite of the mechanism.
 *
 * WHAT IT ALSO RECORDS: three conflicts, ALL RESOLVED
 *
 * Searching for the published figures contradicted our own data in three places.
 * All three were settled on 2026-10-09 from the primary source and are kept in
 * `RESOLVED` as the audit trail, with both values and the decisive sentence
 * quoted. `CONFLICTS` is a declared empty array so "nothing unresolved" is
 * explicit rather than absent. This section used to say none was resolved, which
 * left a reader believing 182 and 40 were still disputed.
 *
 * PROVENANCE: these are published third-party figures, not measurements anyone
 * here took. The same open legal question flagged pre-launch over `brio.ts`
 * applies to this file, and nothing here is `measured`.
 */

/** Where a figure came from and how much it can be trusted. */
export interface Citation {
  /** Human-readable source. */
  readonly source: string;
  /**
   * 'published' at best, and the type says so rather than trusting the comment.
   * `'measured'` was removable with no blast radius: `Citation` is used only
   * inside this file (three constants plus `RESOLVED`/`CONFLICTS`) and the value
   * was never assigned. Leaving it in meant the one label this file must never
   * claim was the one the compiler would have accepted silently.
   */
  readonly status: 'published' | 'conflicting';
  /** What the figure is measured to, where that is ambiguous. */
  readonly convention?: string;
  /** Set when our data and the source disagree. */
  readonly conflict?: {
    readonly ours: number;
    readonly theirs: number;
    readonly note: string;
  };
}

/**
 * Straight lengths, millimetres. These agree with our data and with each other,
 * and the published relations hold exactly, so they are the solid part.
 */
export const STRAIGHT_LENGTHS: Readonly<Record<string, number>> = {
  A2: 54,
  A3: 72,
  A1: 108,
  A: 144,
  D: 216,
  // B2 and C2 are A2's length, differing only in end polarity.
  B2: 54,
  C2: 54,
  // B and C are A's length, B1 and C1 are A1's: the same polarity pair (K1).
  B: 144,
  C: 144,
  B1: 108,
  C1: 108,
};

export const STRAIGHT_CITATION: Citation = {
  source: 'woodenrailway.info/track/track-math',
  status: 'published',
  convention: 'end to end along the piece',
};

/**
 * Curve INNER radii, millimetres, as published.
 *
 * STALE POINTER FIXED (task K2). This docblock used to read "NOT agreed with
 * the source. See CONFLICTS below", and both halves were wrong by then:
 * `CONFLICTS` is a declared empty array, and `RESOLVED[0]` and `RESOLVED[1]`
 * settled these two figures from the primary source on 2026-10-09. 182 and 90
 * were right all along AS PUBLISHED INNER RADII. What was wrong was the engine
 * treating an inner radius as a centreline radius, fixed by deriving the
 * centreline in one place: `centrelineRadiusMm` in `engine/src/parts/schema.ts`,
 * as `innerRadiusMm + plankWidthMm / 2`. `CURVE_OUTER_RADII` below is NOT that
 * derivation; it is the independent published figure the test checks it against.
 * This sentence named the wrong site until 2026-10-20.
 *
 * The `_OURS` suffix survives because renaming an export is not this task's
 * job. Read it as "the radii our catalogue holds", which now agree.
 */
export const CURVE_RADII_OURS: Readonly<Record<string, number>> = {
  E: 182,
  E1: 90,
};

/** Arc angle in 22.5-degree steps. 2 steps = 45 degrees. Agreed by all sources. */
export const CURVE_ARC_STEPS: Readonly<Record<string, number>> = {
  E: 2,
  E1: 2,
};

export const CURVE_ARC_CITATION: Citation = {
  source: 'woodenrailway.info/track/brio-track-guide',
  status: 'published',
  convention: 'curved track divides the circle into eight 45-degree arcs',
};

/**
 * Curve OUTER radii, millimetres. Only E's is published.
 *
 * Here because the centreline derivation needs two numbers, and the test that
 * checks it used to declare both as local literals (`const INNER = 182; const
 * OUTER = 222;`), which pinned them to themselves. The source gives E's pair in
 * one sentence; E1's outer radius is never stated, so it is absent rather than
 * computed, and nothing may infer it from the plank width without saying so.
 */
export const CURVE_OUTER_RADII: Readonly<Record<string, number>> = {
  E: 222,
};

/**
 * The track profile: the three figures every part shares, plus the groove
 * figures published in the same breath.
 *
 * WHY THESE ARE HERE (task K2). They existed only as PROSE, inside
 * `RESOLVED[2].conflict.note`, while `brio.ts` held them as its own private
 * consts and `analytic.test.ts` restated 40, 12 and 26 as literal expectations.
 * So the figures lived in three places and the test compared the catalogue
 * against a copy of itself: mutating `brio.ts` failed that test whether or not
 * any pin worked. Exported here, they have one home and one comparison.
 *
 * Source sentence, verbatim:
 *
 *   "A typical piece of BRIO track is 40mm wide and 12mm high, with two 6mm
 *    wide grooves that are 3mm deep, spaced 20mm apart, measuring 26mm from
 *    center to center."   -- woodenrailway.info/track/brio-track-guide
 *
 * The sentence is self-consistent, which is most of why it is trustworthy:
 * 20mm apart + 6mm wide = 26mm centre to centre. `sources.test.ts` checks that
 * arithmetic against these fields rather than against restated numbers, so a
 * bad transcription here cannot pass by agreeing with itself.
 */
export const TRACK_PROFILE = {
  plankWidthMm: 40,
  plankThicknessMm: 12,
  gaugeWidthMm: 26,
  grooveWidthMm: 6,
  grooveSpacingMm: 20,
  grooveDepthMm: 3,
} as const;

export const PROFILE_CITATION: Citation = {
  source: 'woodenrailway.info/track/brio-track-guide',
  status: 'published',
  convention:
    'plank width and thickness across the piece; gauge is groove spacing, ' +
    'centre to centre',
};

/**
 * THE THREE CONFLICTS, ALL RESOLVED 2026-10-09 from the primary source.
 *
 * Read directly from woodenrailway.info/track/brio-track-guide rather than from
 * search summaries, because each one changed shipped geometry. The decisive
 * sentences are quoted verbatim below. All three resolved AGAINST our data.
 */
export const RESOLVED: readonly Citation[] = [
  {
    source: 'woodenrailway.info/track/brio-track-guide',
    status: 'published',
    convention: 'inner radius; centreline = inner + plankWidth / 2',
    conflict: {
      ours: 182,
      theirs: 202,
      note:
        'RESOLVED. Verbatim: "The inner radius of E track is just over 182mm, ' +
        'and the outer radius just over 222mm." 222 - 182 = 40 = the plank ' +
        'width, so the centreline radius is 202. Our 182 was correct AS A ' +
        'PUBLISHED FIGURE and wrong as the thing the engine used it for. Fixed ' +
        'by renaming the field to innerRadiusMm and deriving the centreline in ' +
        'one place, so the stored number stays a verbatim transcription.',
    },
  },
  {
    source: 'woodenrailway.info/track/brio-track-guide',
    status: 'published',
    convention: 'inner radius; centreline = inner + plankWidth / 2',
    conflict: {
      ours: 90,
      theirs: 110,
      note:
        'RESOLVED the same way. Verbatim: "The small curve diameter corresponds ' +
        'to the inside curve diameter, not the centerline diameter." So 90 is ' +
        'the inner radius and the centreline is 110. The page also warns that ' +
        'the LARGE curve diameter printed in catalogs "does not appear to ' +
        'correspond to any actual measurements on the track", so catalog ' +
        'figures are not a usable source for radii at all.',
    },
  },
  {
    source: 'woodenrailway.info/track/brio-track-guide',
    status: 'published',
    convention: 'groove spacing, centre to centre',
    conflict: {
      ours: 40,
      theirs: 26,
      note:
        'RESOLVED. Verbatim: "A typical piece of BRIO track is 40mm wide and ' +
        '12mm high, with two 6mm wide grooves that are 3mm deep, spaced 20mm ' +
        'apart, measuring 26mm from center to center." So gaugeWidthMm 40 WAS ' +
        'the plank width mislabelled, the real gauge is 26, and the 44mm ' +
        'plankWidthMm estimated on 2026-10-08 was a guess at a number already ' +
        'in the file. Plank thickness 12mm came free and answers one of ' +
        "CALIBRATION.md's listed unknowns.",
    },
  },
];

/** Nothing is unresolved. Kept as a named empty set so its absence is explicit. */
export const CONFLICTS: readonly Citation[] = [];

/**
 * Two-ended pieces present in the source and NOT yet in the catalogue, with the
 * reason each is or is not addable as data.
 */
export const KNOWN_ABSENT = [
  { id: 'B/C', name: 'Medium Straight polarity variants', lengthMm: 144, note: 'Addable but RETIRED; 1980s sets only.' },
  { id: 'B1/C1', name: 'Short Straight polarity variants', lengthMm: 108, note: 'Addable but RETIRED.' },
  { id: 'EE/EE1', name: 'Double curves', lengthMm: 0, note: 'NOT addable as a two-ended part: two parallel curves in one piece means four ends.' },
] as const;

/**
 * THE SWITCH: searched for, not found. Task T1, 2026-10-13.
 *
 * Decision D9 approved shipping approximate switches with a stated per-switch
 * modelled error, and E1 of the fifth eng review set that error's ceiling. Both
 * need a number to start from, and there isn't one.
 *
 * Four source classes were searched and enumerated in `CALIBRATION.md` Q6:
 * the manufacturer's own pages for 33344 and 33346, retailer specifications,
 * patent and dimensioned drawings, and woodenrailway.info's track guide, which
 * is the citation behind every other figure in this file. None publishes the
 * diverging-leg arc, its radius, or the heel offset. Retail listings give
 * packaging size (about 19 x 3 x 9 cm), which is a box, not a track.
 *
 * Community 3D-print reproductions exist and several describe a 45-degree
 * diverging leg. They are reproductions of the part, not figures from its
 * maker, so they rank `unverified` exactly like the IKEA and Playtive seeds and
 * cannot carry a switch into the catalogue by themselves. Four of them are now
 * in the library as unverified SEEDS (`switchSeeds.ts`), which is the tier for
 * exactly that; the published row below is still blocked.
 *
 * CONSEQUENCE: the switch catalogue row is BLOCKED, not scheduled. `SwitchPart`
 * exists in the schema and `portsOf` returns its three ports, both proven by
 * `switches.test.ts` against a locally declared part. That part documents the
 * MODEL and claims nothing about real track. Measuring a real switch is the
 * only way forward, and `CALIBRATION.md` Q6 says exactly what to measure.
 */
export const SWITCH_GEOMETRY_ABSENT = {
  searchedOn: '2026-10-13',
  sourceClasses: [
    'manufacturer product pages (BRIO 33344, 33346)',
    'retailer specifications',
    'patent and dimensioned drawings',
    'woodenrailway.info track guide',
  ],
  outcome: 'no citable figure; measurement required',
  blocks: 'the switch catalogue row',
  seeAlso: 'CALIBRATION.md Q6',
} as const;

/**
 * THE COMPLETE BRIO PIECE TABLE, and what blocks each one.
 *
 * All 28 pieces from woodenrailway.info/track/brio-track-guide, read 2026-10-09.
 * The catalogue holds 9. This records the other 19 with the reason each cannot
 * be modelled yet, so the catalogue task in release three is a list to work
 * through rather than a guess at what exists.
 *
 * Three facts in here are worth more than the list:
 *
 * 1. T and X radii are APPROXIMATE. The table footnote reads "Approximate. These
 *    radii are within 2mm of E1", and lists 88 against E1's 90. So those pieces
 *    genuinely cannot be represented exactly, which independently confirms the
 *    decision to accept approximate switches with a stated error was necessary
 *    rather than merely cautious.
 * 2. F and G Switch has a linear length of 150, not the 144 of the A track it is
 *    otherwise based on, and H1 Cross is 116. Neither is a multiple of 18, so
 *    both break BRIO's own 18mm increment rule while staying exactly
 *    representable as integers.
 * 3. R and S Buffer Stops have ONE end. The schema's PartEnds assumes two, so a
 *    terminator needs a representation that does not exist yet.
 */
export type PieceBlocker =
  | 'in-catalogue'
  | 'needs-graph'        // three or more ends
  | 'needs-elevation'    // has a rise
  | 'needs-one-ended'    // a terminator
  | 'approximate-radius';

export const BRIO_PIECE_TABLE: ReadonlyArray<{
  readonly ids: string;
  readonly name: string;
  readonly lengthMm?: number;
  readonly innerRadiusMm?: number;
  readonly blocker: PieceBlocker;
  readonly note?: string;
}> = [
  { ids: 'A, B, C', name: 'Medium Straight', lengthMm: 144, blocker: 'in-catalogue', note: 'All three held. B and C are retired polarity variants, added by K1.' },
  { ids: 'A1, B1, C1', name: 'Short Straight', lengthMm: 108, blocker: 'in-catalogue', note: 'All three held. B1 and C1 are retired, added by K1.' },
  { ids: 'A2, B2, C2', name: 'Mini Straight', lengthMm: 54, blocker: 'in-catalogue', note: 'All three held. #33333 ships one of each polarity variant.' },
  { ids: 'A3', name: 'Middle Straight', lengthMm: 72, blocker: 'in-catalogue' },
  { ids: 'D', name: 'Long Straight', lengthMm: 216, blocker: 'in-catalogue' },
  { ids: 'E', name: 'Large Curve', innerRadiusMm: 182, blocker: 'in-catalogue' },
  { ids: 'E1', name: 'Short Curve', innerRadiusMm: 90, blocker: 'in-catalogue' },
  { ids: 'EE', name: 'Large Double Curve', innerRadiusMm: 182, blocker: 'needs-graph', note: 'Two parallel curves in one piece: four ends.' },
  { ids: 'EE1', name: 'Short Double Curve', innerRadiusMm: 90, blocker: 'needs-graph', note: 'Four ends.' },
  { ids: 'F, G', name: 'Switch', lengthMm: 150, blocker: 'needs-graph', note: 'Linear length 150, NOT the 144 of its base A track, and not a multiple of 18.' },
  { ids: 'F1, G1', name: 'Parallel Switch', lengthMm: 144, blocker: 'needs-graph' },
  { ids: 'F2, G2', name: 'Triple Parallel Switch', lengthMm: 144, blocker: 'needs-graph' },
  { ids: 'H', name: 'Cross', lengthMm: 108, blocker: 'needs-graph' },
  { ids: 'H1', name: 'Cross', lengthMm: 116, blocker: 'needs-graph', note: 'Actually 116 though the catalog chart implies 108. Not a multiple of 18.' },
  { ids: 'H2', name: 'Criss Cross', lengthMm: 144, blocker: 'needs-graph' },
  { ids: 'H3', name: 'Curved Crossing', innerRadiusMm: 182, blocker: 'needs-graph', note: 'Two E curves meeting in the middle.' },
  { ids: 'I, J', name: 'Curved Switch', lengthMm: 144, innerRadiusMm: 182, blocker: 'needs-graph', note: 'Three directions.' },
  { ids: 'K', name: 'Switching and Crossing', lengthMm: 216, blocker: 'needs-graph' },
  { ids: 'K1', name: 'Double Straight', lengthMm: 216, blocker: 'needs-graph', note: 'Two parallel straights in one piece: four ends.' },
  { ids: 'L, L1, M, M1', name: 'Curved Switch', lengthMm: 144, innerRadiusMm: 182, blocker: 'needs-graph', note: 'The quintessential BRIO switch.' },
  { ids: 'N, N1', name: 'Ascending', lengthMm: 216, blocker: 'in-catalogue', note: 'Raises or lowers the track by 64mm. Both held as unverified seeds (rampSeeds.ts, two-layer plan): N with one peg and one socket, N1 with two pegs. 216 taken as the run, CALIBRATION.md Q4.' },
  { ids: 'O, P', name: 'Short Curved Switch', innerRadiusMm: 90, blocker: 'needs-graph' },
  { ids: 'O1, P1', name: 'Short Curved Switch', lengthMm: 108, innerRadiusMm: 90, blocker: 'needs-graph' },
  { ids: 'Q', name: 'Five-Point Switch', lengthMm: 144, innerRadiusMm: 182, blocker: 'needs-graph', note: 'Outer turns 45 degrees, inner turns 22.5.' },
  { ids: 'R, S', name: 'Buffer Stops', lengthMm: 40, blocker: 'needs-one-ended', note: 'Terminates a track with a barrier. ONE end; PartEnds assumes two.' },
  { ids: 'T', name: 'T-Switch', lengthMm: 216, innerRadiusMm: 88, blocker: 'approximate-radius', note: 'Radius APPROXIMATE, within 2mm of E1. Cannot be exact.' },
  { ids: 'U, V', name: 'Ramp Tracks', lengthMm: 54, blocker: 'in-catalogue', note: 'ADDABLE but not added: end pieces ramped so cars can drive onto the track. Flat on the rail side, so arguably two-ended. Needs a decision on whether a car ramp is track at all.' },
  { ids: 'X', name: 'Star Switch', lengthMm: 216, innerRadiusMm: 88, blocker: 'approximate-radius', note: 'Four directions at 90 degrees. Radius APPROXIMATE like T.' },
];
