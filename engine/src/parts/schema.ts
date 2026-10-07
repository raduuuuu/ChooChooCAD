/**
 * Parametric part schema.
 *
 * Multi-brand from day one (eng review E5/D3): the schema enumerates every
 * brand and carries connector geometry per part, because retrofitting those
 * fields would migrate every part record and every saved layout. Only BRIO data
 * is populated in the MVP; the solver is validated against BRIO before other
 * brands' measurements are added, so a wrong verdict is attributable to one
 * unknown rather than six.
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

interface PartBase {
  readonly id: string;
  readonly brand: Brand;
  readonly name: string;
  /** Manufacturer part number, where one exists. */
  readonly partNumber?: string;
  /** Track gauge in millimetres. 40 is the de facto standard; Thomas is 42. */
  readonly gaugeWidthMm: number;
  readonly slop: SlopBudget;
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
