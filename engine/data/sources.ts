/**
 * Published figures, their citations, and the conflicts with our own data.
 *
 * WHY THIS FILE EXISTS (task K2)
 *
 * Before this, every absolute dimension in `brio.ts` was pinned to nothing. The
 * tests proved the published RELATIONS exactly (A1 = 2*A2, D = 2*A1, 2*D = 3*A)
 * and those still hold, but a relation is true for a whole family of values: if
 * every straight were 10% longer the relations would still pass. Four separate
 * tests appeared to pin the curve radius and did not; each one restated `182` as
 * its own expected value, so the number was pinned to itself in four places.
 * Changing the datum and the literal together kept the suite green. That is the
 * same circular-pin defect found in the renderer's sweep flag, which a mutation
 * test proved useless on the same day.
 *
 * So this file holds the published figures ONCE, with a citation each, and the
 * tests compare `brio.ts` against it. Correcting a figure is now one edit in one
 * place, and exactly one test tells you the data moved.
 *
 * WHAT IT ALSO RECORDS: three unresolved conflicts
 *
 * Searching for the published figures immediately contradicted our own data in
 * three places. None is resolved here, because picking a side silently is how
 * the problem started. Each conflict is recorded with both values so the
 * decision is visible and cheap to apply.
 *
 * PROVENANCE: these are published third-party figures, not measurements anyone
 * here took. The same open legal question flagged pre-launch over `brio.ts`
 * applies to this file, and nothing here is `measured`.
 */

/** Where a figure came from and how much it can be trusted. */
export interface Citation {
  /** Human-readable source. */
  readonly source: string;
  /** 'published' at best. Nothing here is 'measured'. */
  readonly status: 'published' | 'measured' | 'conflicting';
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
};

export const STRAIGHT_CITATION: Citation = {
  source: 'woodenrailway.info/track/track-math',
  status: 'published',
  convention: 'end to end along the piece',
};

/**
 * Curve radii as our data currently holds them. NOT agreed with the source.
 * See CONFLICTS below before trusting either number.
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
  { id: 'N/N1', name: 'Ascending track', lengthMm: 216, note: 'NOT addable: needs a rise field the schema does not have, and the elevation rendering was retired at CR3.' },
] as const;

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
  { ids: 'A, B, C', name: 'Medium Straight', lengthMm: 144, blocker: 'in-catalogue', note: 'A held; B and C are retired polarity variants.' },
  { ids: 'A1, B1, C1', name: 'Short Straight', lengthMm: 108, blocker: 'in-catalogue', note: 'A1 held; B1 and C1 retired.' },
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
  { ids: 'N, N1', name: 'Ascending', lengthMm: 216, blocker: 'needs-elevation', note: 'Rises 64mm. The schema models no rise, and the elevation rendering was retired.' },
  { ids: 'O, P', name: 'Short Curved Switch', innerRadiusMm: 90, blocker: 'needs-graph' },
  { ids: 'O1, P1', name: 'Short Curved Switch', lengthMm: 108, innerRadiusMm: 90, blocker: 'needs-graph' },
  { ids: 'Q', name: 'Five-Point Switch', lengthMm: 144, innerRadiusMm: 182, blocker: 'needs-graph', note: 'Outer turns 45 degrees, inner turns 22.5.' },
  { ids: 'R, S', name: 'Buffer Stops', lengthMm: 40, blocker: 'needs-one-ended', note: 'Terminates a track with a barrier. ONE end; PartEnds assumes two.' },
  { ids: 'T', name: 'T-Switch', lengthMm: 216, innerRadiusMm: 88, blocker: 'approximate-radius', note: 'Radius APPROXIMATE, within 2mm of E1. Cannot be exact.' },
  { ids: 'U, V', name: 'Ramp Tracks', lengthMm: 54, blocker: 'in-catalogue', note: 'ADDABLE but not added: end pieces ramped so cars can drive onto the track. Flat on the rail side, so arguably two-ended. Needs a decision on whether a car ramp is track at all.' },
  { ids: 'X', name: 'Star Switch', lengthMm: 216, innerRadiusMm: 88, blocker: 'approximate-radius', note: 'Four directions at 90 degrees. Radius APPROXIMATE like T.' },
];
