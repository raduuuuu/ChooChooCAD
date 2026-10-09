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

export type Brand = 'BRIO' | 'IKEA' | 'HAPE' | 'THOMAS' | 'MELISSA_DOUG';

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

/** Per-joint give. BRIO's Vario System is deliberate slop, not manufacturing error. */
export interface SlopBudget {
  /** Axial pull-apart or push-together, millimetres, one-sided. */
  readonly axialMm: number;
  /** Angular deflection at the joint, degrees, one-sided. */
  readonly angularDeg: number;
  readonly calibrationStatus: CalibrationStatus;
}

export type PartKind = 'straight' | 'curve';

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
  readonly name: string;
  /** Manufacturer part number, where one exists. */
  readonly partNumber?: string;
  /** Track gauge in millimetres. 40 is the de facto standard; Thomas is 42. */
  readonly gaugeWidthMm: number;
  /**
   * Width of the wooden plank, millimetres. ESTIMATED, and NOT the gauge.
   *
   * gstack-shortcut(dec-286b942e): drawn footprints are approximate until
   * calibration runs, upgrade when the calibration afternoon happens.
   *
   * These are two different measurements and conflating them is a mistake this
   * project has already made once: `gaugeWidthMm` is the spacing of the two rail
   * grooves, and the grooves sit inboard of the plank's edges, so the plank is
   * strictly wider than the gauge. `CALIBRATION.md:76` records plank width as an
   * open question and `CALIBRATION.md:83-84` says it "is not the gauge and is
   * currently not recorded anywhere". It is recorded here now, as a guess.
   *
   * Why ship a guess rather than wait for the measurement: the canvas has to
   * pick SOME width, and it was picking `min(viewportW, viewportH) * 0.022`,
   * which made the same piece render at different widths depending on how big
   * the rest of the layout was. A labelled estimate that stays constant per part
   * is honest and stable; a viewport fraction was neither.
   *
   * Nothing may derive a VERDICT from this number while it is estimated. It is
   * for drawing. The footprint-overlap check it would enable is explicitly out
   * of scope (decision D10 of the CEO re-review replaced it with an exact
   * connector-coincidence test that needs no measurement at all).
   */
  readonly plankWidthMm: number;
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
  /** Arc radius in millimetres. Always an integer on real track. */
  readonly radiusMm: number;
  /**
   * Arc angle as a count of 22.5-degree steps, so it stays exact in Z[zeta16].
   * A BRIO E curve is 45 degrees, i.e. 2 steps.
   */
  readonly arcSteps: number;
}

export type Part = StraightPart | CurvePart;

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
