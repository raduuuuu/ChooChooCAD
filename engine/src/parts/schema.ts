/**
 * Parametric part schema.
 *
 * Multi-brand from day one (eng review E5/D3): the schema enumerates every
 * brand. Only BRIO data is populated in the MVP; the solver is validated
 * against BRIO before other brands' measurements are added, so a wrong verdict
 * is attributable to one unknown rather than six.
 *
 * This header used to claim the schema "carries connector geometry per part,
 * because retrofitting those fields would migrate every part record and every
 * saved layout". It did not. No connector, polarity, peg or socket field existed
 * anywhere, and a grep for them found nothing: the comment described an
 * intention as though it were the state, which is worse than silence because it
 * stops anyone checking. Task C2 makes it true for POLARITY (below). Connector
 * POSITIONS are still derived by walking the chain rather than stored per part,
 * and that remains an open question for the graph work.
 */

export type Brand = 'BRIO' | 'IKEA' | 'PLAYTIVE' | 'HAPE' | 'THOMAS' | 'MELISSA_DOUG';

/**
 * How much the DIMENSIONS of a part can be trusted. Separate from `SlopBudget`'s
 * `calibrationStatus`, which is about tolerances, not sizes.
 *
 * This exists because the catalogue now holds parts from sources of very
 * different quality, and the engine's exactness claim is only as good as the
 * numbers under it.
 *
 * Ordered best to worst, and the order is the point: a dimension someone
 * measured off a real piece outranks a figure copied from the web, because the
 * web figures for third-party track demonstrably do not exist.
 *
 * 'user-measured'  THIS user measured their own piece. Highest trust: it is a
 *                  measurement of the object the layout will actually be built
 *                  from, and it carries no provenance question because it is
 *                  their own property.
 * 'published'      a manufacturer or established reference states it. Strong,
 *                  but not infallible: the reference this project uses gave a
 *                  curve radius to the INNER edge where the engine needed the
 *                  centreline, which was a 20mm error that survived six review
 *                  passes.
 * 'community'      one other user's submission. Deliberately BELOW published:
 *                  a single stranger's word must not silently overwrite a
 *                  referenced figure. `corroborations` is how it climbs, and
 *                  several independent submitters agreeing SHOULD outrank one
 *                  published figure. That comparison is not implemented yet and
 *                  must not be assumed.
 * 'unverified'     a circulating figure with no measurement behind it. Seeds.
 *
 * An 'unverified' part makes every verdict involving it unverified too, however
 * exact the arithmetic. Nothing may present a layout containing one as reliable.
 */
export type DimensionStatus =
  | 'user-measured'
  | 'published'
  | 'community'
  | 'unverified';

/** Best first. Used to decide which source wins when two describe one part. */
export const DIMENSION_TRUST: readonly DimensionStatus[] = [
  'user-measured',
  'published',
  'community',
  'unverified',
];

/** Lower is better. A part with a better source overrides a worse one. */
export function trustRank(status: DimensionStatus): number {
  /*
   * FAIL CLOSED. `indexOf` returns -1 for an unknown status, and -1 is LOWER
   * than every legitimate rank, so an unrecognised status outranked every
   * figure in the catalogue including a published one. Reproduced before the
   * fix: a stored submission with `dimensions: {}` replaced published curve E,
   * radius 182 -> 1, and `isUnverified` could not see it because the status was
   * absent rather than wrong. An unknown provenance must be the LEAST trusted
   * thing there is, never the most.
   */
  const i = DIMENSION_TRUST.indexOf(status);
  return i < 0 ? Number.POSITIVE_INFINITY : i;
}

export interface DimensionSource {
  readonly status: DimensionStatus;
  /** Where the figures came from. Specific enough to re-check. */
  readonly source: string;
  /** Why this status and not a better one; what would upgrade it. */
  readonly note?: string;
  /**
   * ISO date a submission was recorded. Present for user and community sources.
   * Carried so a shared library can order and age submissions later; it is not
   * used for anything today.
   */
  readonly submittedAt?: string;
  /**
   * How many independent submitters reported the same figures.
   *
   * The answer to the problem a shared library creates: inside a correctness
   * engine a wrong submitted dimension looks exactly like a right one, so the
   * only honest signal is whether anyone else measured the same thing. 1 means
   * one person said so. It is recorded now so submissions made before the server
   * exists are not retroactively unanswerable.
   */
  readonly corroborations?: number;
}

/**
 * Whether two brands' connectors physically join.
 *
 * Recorded as data because the answer is "mostly no" and that is the single most
 * useful thing we learned about multi-brand track. From woodenrailway's
 * third-party page: "There is no established standard for wooden track gauges,
 * and while just about everyone uses the BRIO system as their guide, to avoid
 * patent issues each has small deviations in their measurements."
 */
export type BrandFit = 'joins' | 'tight' | 'does-not-join' | 'unknown';

/**
 * How much a measured physical constant can be trusted.
 *
 * 'measured'  — someone put calipers on real track.
 * 'published' — taken from a manufacturer or reference figure.
 * 'estimated' — a reasoned guess. The UI must visibly downgrade confidence.
 *
 * Nothing in the MVP is 'measured'. Every tolerance below is 'estimated' and
 * must be fitted against a physical corpus before any verdict is presented as
 * confident advice.
 */
export type CalibrationStatus = 'measured' | 'published' | 'estimated';

/**
 * Per-joint give. BRIO's Vario System is deliberate slop, not manufacturing error.
 *
 * ONLY `axialMm` REACHES A VERDICT, and this is the first place that says so.
 * `totalGiveMm` (`solver/residual.ts`) sums the axial figure and nothing else.
 * The graph path agrees: `weldGiveMm` (`graph/model.ts`) returns the larger of
 * the two parts' axial slop with no angular term. `angularDeg` is carried here,
 * copied onto every `Joint` as `angularMaxDeg`, and consumed by no give
 * calculation anywhere in the engine.
 *
 * That is not a tidy omission. `CALIBRATION.md` argues the lever arms are around
 * 300mm against axial budgets "around 1mm", so a joint's small rotation moves a
 * layout's far end much further than its pull-apart does; if that holds, the
 * ignored term is the LARGER of the two. Nobody has measured it, so the engine
 * states the omission and claims nothing about its size.
 *
 * THE CONSEQUENCE, which is what to know before trusting a figure typed as this.
 * `totalGiveMm`'s docblock makes the engine's one definite verdict depend on the
 * give figure being "an upper bound on the give really available". A figure that
 * drops a real term is not established as one, and `calibrationStatus:
 * 'measured'` would not establish it either: measuring one specimen bounds
 * nothing across brands, specimens or wear. So the verdict says a gap exceeds
 * what was MODELLED, never that track will not fit. Filed as P1 in
 * `docs/plan/brio-TODOS.md`.
 */
export interface SlopBudget {
  /** Axial pull-apart or push-together, millimetres, one-sided. */
  readonly axialMm: number;
  /**
   * Angular deflection at the joint, degrees, one-sided.
   *
   * POPULATED AND READ BY NOTHING THAT COMPUTES GIVE. See the docblock above.
   */
  readonly angularDeg: number;
  readonly calibrationStatus: CalibrationStatus;
}

/*
 * 'switch' is the first kind with more than two ends, and adding it is what
 * the graph rewrite was for. A chain `Layout` could not express a branch at
 * all, so a switch in the palette would have built a layout the engine could
 * not represent: eng review R22, which is why the catalogue was held to
 * two-ended parts until now.
 *
 * 'crossing' is deliberately NOT here yet. The model handles four ports (see
 * the crossing test in graphModel.test.ts) but a crossing also needs the
 * same-layer overlap rule it is allowed to violate at its own footprint,
 * which is K8's scope.
 */
export type PartKind = 'straight' | 'curve' | 'switch';

/**
 * Which half of a joint an end is. A joint mates a peg with a socket; peg to peg
 * and socket to socket are physically unjoinable.
 *
 * This is a MODELLING CONVENTION, not a measurement. Real BRIO track has one
 * male and one female end per piece, and every part below is recorded the same
 * way round: `start` is the socket, `end` is the peg, where start and end are
 * the two ends in traversal order. Which way round a given physical piece
 * actually faces does not matter to any verdict, because only the ALTERNATION
 * does, and that is what the check tests.
 *
 * Why this is here before anything can violate it: append-only placement cannot
 * produce a bad joint, because every piece is laid down facing the same way, so
 * peg always meets socket all the way round including at the seam. Decision D8
 * of the CEO re-review replaces that with welds the user declares between any
 * two free ends, and the moment that lands, peg-to-peg is one click away and
 * would have returned EXACT on a layout nobody can assemble. The field goes in
 * first so the graph work cannot introduce that silently.
 *
 * Socket-to-socket IS buildable, with a male-male adapter that adds no length
 * (owner, 2026-10-23), so the verdict reports it as an adapter joint, not a
 * violation. Peg-to-peg stays impossible.
 */
export type Polarity = 'peg' | 'socket';

/** The two ends of a piece, in traversal order. */
export interface PartEnds {
  readonly start: Polarity;
  readonly end: Polarity;
}

interface PartBase {
  readonly id: string;
  readonly brand: Brand;
  /** Provenance of this part's DIMENSIONS. See `DimensionSource`. */
  readonly dimensions: DimensionSource;
  readonly name: string;
  /** Manufacturer part number, where one exists. */
  readonly partNumber?: string;
  /**
   * Track gauge: the spacing of the two rail grooves, centre to centre,
   * millimetres. PUBLISHED.
   *
   * 26mm on BRIO. Source, verbatim: "A typical piece of BRIO track is 40mm wide
   * and 12mm high, with two 6mm wide grooves that are 3mm deep, spaced 20mm
   * apart, measuring 26mm from center to center."
   * (woodenrailway.info/track/brio-track-guide). 20 + 6 = 26 checks out.
   *
   * This field held 40 until 2026-10-09, which was the PLANK WIDTH under the
   * wrong name. Everything downstream that reasoned about "the 40mm gauge",
   * including a design review and a calibration question, inherited that error.
   */
  readonly gaugeWidthMm: number;
  /**
   * Width of the wooden plank, millimetres. PUBLISHED, no longer estimated.
   *
   * 40mm, from the same sentence as the gauge above. This replaces the 44mm
   * ESTIMATE added on 2026-10-08, which was a guess at a number already present
   * in the file under the name `gaugeWidthMm`.
   *
   * Load-bearing for geometry, not just drawing: the centreline radius of a
   * curve is derived from it. See `centrelineRadiusMm`.
   */
  readonly plankWidthMm: number;
  /**
   * Thickness of the plank, millimetres. PUBLISHED.
   *
   * 12mm, from the same sentence. Recorded because `CALIBRATION.md` lists plank
   * thickness as one of the unknowns gating elevation work, and it turned out to
   * be published rather than needing a measurement.
   */
  readonly plankThicknessMm: number;
  /**
   * Width of each rail groove, millimetres. PUBLISHED for BRIO, absent
   * elsewhere.
   *
   * 6mm, from the same sentence as the gauge and the plank: "two 6mm wide
   * grooves that are 3mm deep, spaced 20mm apart, measuring 26mm from center
   * to center". With `gaugeWidthMm` at 26 the grooves therefore span 10mm to
   * 16mm either side of the centreline.
   *
   * OPTIONAL, and that is the point. Nobody publishes a groove width for IKEA
   * Lillabo or Lidl Playtive, so those parts leave it undefined and the canvas
   * draws them as a bare plank with no grooves. Drawing BRIO's grooves on a
   * piece whose grooves nobody has measured would be the renderer inventing
   * data, which is the one thing this product must not do. Absent means
   * unknown and looks unknown.
   */
  readonly grooveWidthMm?: number;
  readonly slop: SlopBudget;
  /** Connector polarity at each end. See `Polarity` for why this is a convention. */
  readonly ends: PartEnds;
  /**
   * Height above the ground plane, millimetres, CONTINUOUS.
   * Deliberately not an integer level index: BRIO's ascending track happens to
   * rise 64mm, but books, bridge supports, other brands and printed risers do
   * not, and a level index would be a reversibility-1 mistake.
   */
  readonly heightMm: number;
}

export interface StraightPart extends PartBase {
  readonly kind: 'straight';
  /** Length in millimetres. Always an integer on real track. */
  readonly lengthMm: number;
}

export interface CurvePart extends PartBase {
  readonly kind: 'curve';
  /**
   * Radius to the INNER edge of the wood, millimetres. PUBLISHED.
   *
   * THE NAME IS THE POINT. This field was called `radiusMm` and held 182 for the
   * E curve, and the engine used it as if it were the centreline radius. It is
   * not. Source, verbatim: "The inner radius of E track is just over 182mm, and
   * the outer radius just over 222mm." 222 - 182 = 40, the plank width, so the
   * centreline sits 20mm outside the inner edge and the real centreline radius
   * is 202mm. The same page warns that "The small curve diameter corresponds to
   * the inside curve diameter, not the centerline diameter" and that the large
   * curve diameter printed in catalogs "does not appear to correspond to any
   * actual measurements on the track".
   *
   * So every curve the engine walked was 20mm tighter than real track. It was
   * invisible because closure of an 8-curve circle and of the stadium is
   * radius-independent, and the four tests that looked like they pinned the
   * radius were each restating 182 as their own expected value.
   *
   * NOTHING should use this field for geometry. Use `centrelineRadiusMm`. The
   * rename exists so that misuse is a compile error rather than a silent 20mm.
   */
  readonly innerRadiusMm: number;
  /**
   * Arc angle as a count of 22.5-degree steps, so it stays exact in Z[zeta16].
   * A BRIO E curve is 45 degrees, i.e. 2 steps.
   */
  readonly arcSteps: number;
}

/**
 * A switch: one piece, three ends, two roads.
 *
 * Entry is the HEEL, where the roads meet; from there the track either runs
 * straight for `throughLengthMm` or curves away by `arcSteps`. Both are
 * measured in the part's own frame, so the piece is rigid by construction
 * and its two roads cannot drift apart depending on which one you walk.
 *
 * `turn` at placement decides which side it diverges to, so a left-hand and
 * a right-hand switch are one part placed two ways rather than two records
 * that could disagree with each other.
 *
 * NO PUBLISHED SWITCH IS IN THE CATALOGUE. Nobody has published BRIO's
 * switch geometry in a form this file could cite. Four switches are in the
 * library as UNVERIFIED seeds read off 3D-print reproductions
 * (`engine/data/switchSeeds.ts`), carrying the same unverified status as the
 * IKEA and Playtive seeds and overridden by any user measurement. The
 * published row still waits on a real switch being measured (task T2).
 */
export interface SwitchPart extends PartBase {
  readonly kind: 'switch';
  /** Heel to the straight road's end, millimetres. */
  readonly throughLengthMm: number;
  /** Arc of the diverging road, in 22.5-degree steps. */
  readonly arcSteps: number;
  /** Radius of the diverging road, to the INNER edge. See CurvePart. */
  readonly innerRadiusMm: number;
}

export type Part = StraightPart | CurvePart | SwitchPart;

/**
 * The radius the ENGINE needs: from the arc centre to the centre of the track.
 *
 * The walker advances connector poses, and a connector sits at the centre of the
 * plank's end face, so the path a connector travels is the centreline. That is
 * the inner edge plus half the plank width.
 *
 * This is the ONLY place the convention is applied. If you are reaching for a
 * radius anywhere else, you want this function.
 */
/** True when a part's dimensions are not backed by a measurement or a publisher. */
export function isUnverified(part: Part): boolean {
  return part.dimensions.status === 'unverified';
}

/**
 * True when a part's dimensions rest on exactly one person's word.
 *
 * Distinct from unverified: a single user measurement is the BEST source
 * available for third-party track and still deserves saying out loud, because
 * one measurement of one piece is not the same as a published standard.
 */
export function isUncorroborated(part: Part): boolean {
  const { status, corroborations } = part.dimensions;
  if (status === 'published') return false;
  return (corroborations ?? 0) <= 1;
}

/**
 * The code shown on a palette card: the id with its own brand prefix removed.
 *
 * Ids are brand-prefixed so that two brands can both ship a part called "150"
 * without colliding, and user submissions follow the same rule. In the palette
 * that prefix is dead weight: the cards are grouped under a brand heading, so
 * every card in the IKEA group spelling out IKEA says nothing, and at
 * PLAYTIVE-200 it is long enough to break the card's two-column grid.
 *
 * BRIO parts carry bare ids (A2, E1) and come back unchanged.
 */
export function shortCode(part: Part): string {
  const prefix = `${part.brand}-`;
  return part.id.startsWith(prefix) ? part.id.slice(prefix.length) : part.id;
}

export function centrelineRadiusMm(part: CurvePart | SwitchPart): number {
  return part.innerRadiusMm + part.plankWidthMm / 2;
}

export type Turn = 'left' | 'right';

/** One piece placed in a layout. */
export interface Placement {
  readonly partId: string;
  /** Which way a curve bends. Ignored for straights. */
  readonly turn?: Turn;
}

/**
 * A layout under construction.
 *
 * MVP scope: an ordered chain, optionally closed back to its own start. That
 * covers every analytic fixture and the single-cycle case. Switches produce
 * multiple cycles sharing joints, which needs the full coupled solve over a
 * cycle basis (eng review 1A) and is NOT in the MVP.
 */
export interface Layout {
  readonly placements: readonly Placement[];
  /** True when the last piece's free end joins the first piece's start. */
  readonly closed: boolean;
}
