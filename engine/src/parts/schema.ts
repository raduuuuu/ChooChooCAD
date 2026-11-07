/**
 * Parametric part schema.
 *
 * Multi-brand from day one (eng review E5/D3): the schema enumerates every
 * brand. Only Generic data is populated in the MVP; the solver is validated
 * against Generic before other brands' measurements are added, so a wrong verdict
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

import type { Cyc } from '../geom/cyclotomic.js';

export type Brand = 'GENERIC' | 'IKEA' | 'PLAYTIVE' | 'HAPE' | 'THOMAS' | 'MELISSA_DOUG';

/**
 * WHAT THE APP CALLS EACH TRACK SYSTEM (design review 2026-11-04, D1, D2):
 * a physical trait, never a maker's name. The `Brand` values stay as they
 * are because saved layouts, share links and stored parts carry them.
 * Small-peg pieces do not plug into Generic; look-alike pieces are sold as
 * Generic-compatible, unconfirmed. The three with no pieces share one name.
 */
export const SYSTEM_NAME: Readonly<Record<Brand, string>> = {
  GENERIC: 'Generic',
  IKEA: 'Small-peg',
  PLAYTIVE: 'Look-alike',
  HAPE: 'Another system',
  THOMAS: 'Another system',
  MELISSA_DOUG: 'Another system',
};

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
 * useful thing we learned about multi-brand track. From the published guide's
 * third-party page: "There is no established standard for wooden track gauges,
 * and while just about everyone uses the Generic system as their guide, to avoid
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
 * Per-joint give. Generic's Vario System is deliberate slop, not manufacturing error.
 *
 * BOTH NOW REACH A VERDICT (docs/designs/joint-bend.md). `axialMm` is the
 * stretch a joint may pull apart; `angularDeg` is how far it may turn, for
 * parts that are not Generic. Generic joints take their bend limit from
 * `engine/data/bendLimit.ts` instead (measured, inferred from a loop that
 * closed on the floor, or estimated), and a joint takes the weaker of its two
 * sides. The bend model credits these as LOWER bounds on what joints do, so
 * a verdict past them says "beyond the tested bend", never "will not fit".
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
 * 'multi-road' is every piece with more than two ends: switches, crossings,
 * Ys, three-ways, double curves. It replaced a 'switch' kind that could only
 * say "one straight road and one arc from a heel" (eng review D4,
 * 2026-10-30), because each new shape would otherwise have been another kind
 * and another branch in every file that asks what a piece is.
 *
 * A crossing's roads cross each other inside one piece. The overlap check
 * already skips pairs within one piece (overlap.ts), so that is not a clash.
 */
export type PartKind = 'straight' | 'curve' | 'multi-road' | 'buffer';

/**
 * Which half of a joint an end is. A joint mates a peg with a socket; peg to peg
 * and socket to socket are physically unjoinable.
 *
 * This is a MODELLING CONVENTION, not a measurement. Real Generic track has one
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
   * 26mm on Generic. Source, verbatim: "A typical piece of Generic track is 40mm wide
   * and 12mm high, with two 6mm wide grooves that are 3mm deep, spaced 20mm
   * apart, measuring 26mm from center to center."
   * (the published track guide). 20 + 6 = 26 checks out.
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
   * Width of each rail groove, millimetres. PUBLISHED for Generic, absent
   * elsewhere.
   *
   * 6mm, from the same sentence as the gauge and the plank: "two 6mm wide
   * grooves that are 3mm deep, spaced 20mm apart, measuring 26mm from center
   * to center". With `gaugeWidthMm` at 26 the grooves therefore span 10mm to
   * 16mm either side of the centreline.
   *
   * OPTIONAL, and that is the point. Nobody publishes a groove width for IKEA
   * Lillabo or Lidl Playtive, so those parts leave it undefined and the canvas
   * draws them as a bare plank with no grooves. Drawing Generic's grooves on a
   * piece whose grooves nobody has measured would be the renderer inventing
   * data, which is the one thing this product must not do. Absent means
   * unknown and looks unknown.
   */
  readonly grooveWidthMm?: number;
  readonly slop: SlopBudget;
  /**
   * Height above the ground plane, millimetres, CONTINUOUS.
   * Deliberately not an integer level index: Generic's ascending track happens to
   * rise 64mm, but books, bridge supports, other brands and printed risers do
   * not, and a level index would be a reversibility-1 mistake.
   */
  readonly heightMm: number;
  /**
   * WOOD THAT IS NOT TRACK (plan 2026-11-02, structures): a station's
   * footprint and roof, a pier, a tunnel's walls and roof. Each box is drawn
   * and collision-checked at its own levels (eng EO1); none carries a train.
   * Built-in only: a submission cannot add or correct one (OV2).
   */
  readonly body?: readonly BodyBox[];
  /**
   * A DECORATED PIECE (decorated-pieces plan 2026-11-03, CEO D2, eng D2): the
   * built-in part whose track this piece has, unchanged. Its ends, roads and
   * joint give are that part's; only its decoration is its own. Built-in only.
   */
  readonly decoratedFrom?: string;
  /**
   * The decoration, as measured shapes in the piece's own frame (eng D4). A
   * structure's drawn detail (a riser's plate, a bridge's arch or towers) is
   * shapes too (eng D3, D6). Built-in only.
   */
  readonly decor?: readonly DecorShape[];
  /**
   * The decoration's boxes, DERIVED from `decor` by the library (eng D4, D9),
   * never written by hand: what is drawn and what collides come from one
   * list. Not a `body`, so a decorated piece is never a structure (eng D2).
   */
  readonly decorBody?: readonly DecorBox[];
  /**
   * What F does, in words: the key's label, its verb for the key list, and
   * what is said after it. ABSENT when the mirror image is the same piece,
   * as on a symmetric crossing, so F is not offered. A multi-road piece's
   * mirror; a decorated straight's decoration moved to the other side, its
   * ends unchanged (decorated-pieces eng D5, design 5A).
   */
  readonly flip?: { readonly label: string; readonly verb: string; readonly after: string };
}

/**
 * A PIECE'S PAINT IN 3D (paint plan 2026-11-07, CEO C1/R1, design D6): the
 * colour token its faces are filled with and the token its edge and detail
 * lines are drawn in, each a tokens.css name with its leading `--`. Only a
 * piece measured from a real one carries paint (DESIGN.md rule 1); a shape
 * without it draws in the house fill and lines.
 */
export interface Paint {
  readonly fill: string;
  readonly line: string;
}

/**
 * ONE DECORATION SHAPE: a slab, a box of wood beside, across or over the
 * track, centred at `atMm` in the piece's frame, `lengthMm` along it and
 * `widthMm` across, from `bottomMm` to `topMm` above the piece's floor.
 * Solid unless `solid: false` (a thin barrier arm): a solid shape blocks
 * other track at every level its height reaches (eng D9). `noun` is what a
 * sentence calls it ("platform"). Each further shape arrives with the piece
 * that needs it (eng D10 gives each its own solid parts).
 */
export interface DecorSlab {
  readonly kind: 'slab';
  readonly atMm: readonly [number, number];
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly bottomMm: number;
  readonly topMm: number;
  readonly solid?: false;
  readonly noun?: string;
  readonly paint?: Paint;
}

/**
 * A VAULT (decorated-pieces plan T5): a tunnel shell standing on the floor
 * over the track, `lengthMm` along and `widthMm` across outside, its walls
 * `wallMm` thick, straight up to `springMm`, then a round arch to `topMm`.
 * An opening shape (eng D10): it blocks track only with its two walls and
 * its roof, never with the passage it makes; it is drawn round in 3D.
 */
export interface DecorVault {
  readonly kind: 'vault';
  readonly atMm: readonly [number, number];
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly wallMm: number;
  readonly springMm: number;
  readonly topMm: number;
  readonly noun?: string;
  /**
   * The stone joints on its outside, drawn as detail lines only (detail
   * plan 2026-11-05, owner: every joint): rings around the shell at
   * `ringsMm` from its start, courses along it at `wallMm` up each wall,
   * and at `archDeg` around the arch (0 is the wall's side, 90 the crown).
   */
  readonly joints?: {
    readonly ringsMm: readonly number[];
    readonly wallMm: readonly number[];
    readonly archDeg: readonly number[];
  };
}

/**
 * A TRUSS ARCH over a deck (Sydney bridge plan 2026-11-03; eng D3): a rib
 * either side of the road, `sideMm` from its middle, springing at `springMm`
 * above the floor at `fromMm` and `toMm` along the piece; its outer chord's
 * crown at `crownMm`, its inner chord's at `innerCrownMm`. Drawn only.
 */
export interface DecorTruss {
  readonly kind: 'truss';
  readonly fromMm: number;
  readonly toMm: number;
  readonly springMm: number;
  readonly crownMm: number;
  readonly innerCrownMm: number;
  readonly sideMm: number;
  readonly noun?: string;
}

/**
 * AN ARCH BAND under a span (bridges eng D5, design DD6; eng D6): the stones,
 * `widthMm` across, springing at `fromMm` and `toMm` along the piece from
 * `baseMm` above the floor, rising `riseMm` to the crown, `depthMm` deep
 * with the road on top. Drawn only.
 *
 * A PANEL OVER AN OPENING (elevated station, 2026-11-07) is the same arch
 * standing `acrossMm` from the road's centre line, filled solid from the
 * arch up to a flat top at `fillToMm` instead of a band `depthMm` deep.
 */
export interface DecorArch {
  readonly kind: 'arch';
  readonly fromMm: number;
  readonly toMm: number;
  readonly baseMm: number;
  readonly riseMm: number;
  readonly depthMm: number;
  readonly widthMm: number;
  readonly acrossMm?: number;
  readonly fillToMm?: number;
  readonly noun?: string;
  readonly paint?: Paint;
}

/**
 * A SUSPENSION BRIDGE'S TOWERS AND CABLES (bridges plan B-T6; eng D6): each
 * tower two square posts `postMm` across, `spreadMm` either side of the
 * road's middle, standing at `atMm` along the piece to `heightMm` above the
 * floor, with a crossbeam `openingMm` over the road; the cables reach the
 * road at `cableFromMm` and `cableToMm`. Drawn only.
 */
export interface DecorTowers {
  readonly kind: 'towers';
  readonly towers: readonly { readonly atMm: number; readonly heightMm: number }[];
  readonly postMm: number;
  readonly spreadMm: number;
  readonly openingMm: number;
  readonly cableFromMm: number;
  readonly cableToMm: number;
  readonly noun?: string;
}

/**
 * A STATION BUILDING (station detail pilot, docs/plan/2026-11-05-rich-graphics.md;
 * eng E-A1, owner B1): every measured number once, as the vault holds its own.
 * The library derives its collision boxes from it (the hall's walls, the roof,
 * the tower and its cap, solid and not drawn) and one box that draws it.
 *
 * Positions are local to the hall's centre `atMm` on the piece: `along` runs
 * with the piece, `across` points from the hall to the track. Heights are
 * above the floor.
 *
 *         tower + stepped cap
 *        ┌──┐
 *   ╭────┤  ├────╮   roof: a `baseMm` slab and a half-round barrel along the hall
 *   │    └──┘    │
 *   ┃ ┃▔▔▔▔▔▔▔▔┃ ┃   hall: four walls `wallMm` thick, openings through the long walls
 *   ┃ ┃ opening┃ ┃
 */
export interface DecorStation {
  readonly kind: 'station';
  readonly atMm: readonly [number, number];
  readonly hall: { readonly lengthMm: number; readonly widthMm: number; readonly wallMm: number; readonly bottomMm: number; readonly topMm: number };
  /** Openings through a long wall, `side` 1 the track side and -1 the street side; `fromMm`..`toMm` along, from the hall's bottom to `topMm`. */
  readonly openings: readonly { readonly side: 1 | -1; readonly fromMm: number; readonly toMm: number; readonly topMm: number }[];
  /** The roof: a slab `baseMm` thick over `lengthMm` by `widthMm`, under a half-round barrel of `radiusMm` along the hall. `topMm` is the roof part's top, vents included. */
  readonly roof: { readonly lengthMm: number; readonly widthMm: number; readonly baseMm: number; readonly radiusMm: number; readonly topMm: number };
  /** Square vents on the roof, `sizeMm` across, rising to `topMm`. */
  readonly vents: readonly { readonly atMm: readonly [number, number]; readonly sizeMm: number; readonly topMm: number }[];
  readonly tower: { readonly atMm: readonly [number, number]; readonly sizeMm: number; readonly bottomMm: number; readonly topMm: number };
  /** The tower's stepped cap, widest first, each step a square. */
  readonly cap: readonly { readonly sizeMm: number; readonly bottomMm: number; readonly topMm: number }[];
  /** A square clock face on the tower's track side (design DR7), `sizeMm` across, centred at `centreMm` high, set `recessMm` in. */
  readonly clock: { readonly sizeMm: number; readonly centreMm: number; readonly recessMm: number };
  /** A board on the track-side wall: `fromMm`..`toMm` along, `bottomMm`..`topMm` high. */
  readonly sign: { readonly fromMm: number; readonly toMm: number; readonly bottomMm: number; readonly topMm: number };
  /** Painted lines on the platform: centred `acrossMm` from the hall's centre, `lengthMm` long and `widthMm` wide, at `heightMm`. */
  readonly lines: readonly { readonly acrossMm: number; readonly lengthMm: number; readonly widthMm: number; readonly heightMm: number }[];
  readonly noun?: string;
}

/**
 * A LEVEL CROSSING'S BARRIER (detail plan 2026-11-05, owner: correct the
 * boxes): a round base standing beside the road, a square post on it with a
 * fork at its top, and the arm hinged in the fork, drawn raised. Base and
 * post collide; the arm never does (a toy's moving part, not wood a layout
 * is planned around). `atMm` is the base's centre; the post stands
 * `post.offsetMm` from it along the piece. The arm's stripes are paint, so
 * detail lines: their edges at `stripesMm` up the bar from the hinge, each
 * slanting across the bar's width.
 */
export interface DecorBarrier {
  readonly kind: 'barrier';
  readonly atMm: readonly [number, number];
  readonly base: { readonly diameterMm: number; readonly topMm: number };
  readonly post: { readonly sizeMm: number; readonly topMm: number; readonly offsetMm: number };
  readonly arm: {
    readonly hingeMm: number;
    readonly lengthMm: number;
    readonly widthMm: number;
    readonly thickMm: number;
    readonly discMm: number;
    readonly stripesMm: readonly number[];
  };
  readonly noun?: string;
}

/**
 * A CURVED ROOF (elevated station, measured 2026-11-06): a shell `lengthMm`
 * along, centred `alongMm` along the piece, whose top surface seen along the
 * piece is `sectionMm`, (across, height) points in the piece's own across
 * (left of the road positive), in order from one eave to the other. The
 * shell is `thickMm` thick under that surface, and its first eave hangs a
 * lip `lipMm` deep. It collides only where it is, stretch by stretch of its
 * section, so a roof high over a neighbour's road does not stop it.
 */
export interface DecorCanopy {
  readonly kind: 'canopy';
  readonly alongMm: number;
  readonly lengthMm: number;
  readonly sectionMm: readonly (readonly [number, number])[];
  readonly thickMm: number;
  readonly lipMm: number;
  /** Seams between its panels, along from its centre: detail lines over its top. */
  readonly seamsMm?: readonly number[];
  readonly noun?: string;
  readonly paint?: Paint;
}

export type DecorShape = DecorSlab | DecorVault | DecorTruss | DecorArch | DecorTowers | DecorStation | DecorBarrier | DecorCanopy;
/** A shape with its own drawing, which one decoration box carries (eng D10). */
export type DrawnShape = DecorVault | DecorTruss | DecorArch | DecorTowers | DecorStation | DecorBarrier | DecorCanopy;

/** A derived decoration box: a body box at whole levels, carrying the shape's real heights for drawing. */
export interface DecorBox extends BodyBox {
  readonly bottomMm: number;
  readonly topMm: number;
  readonly solid: boolean;
  readonly noun?: string;
  /** The shape's paint in 3D, when it has one. */
  readonly paint?: Paint;
  /** False for a box that only collides (a vault's walls and roof); the shape is drawn by its own box. */
  readonly draw: boolean;
  /** The shape this box draws, when it is more than a box (eng D10). */
  readonly shape?: DrawnShape;
}

export interface StraightPart extends PartBase {
  readonly kind: 'straight';
  /** Connector polarity at each end. See `Polarity` for why this is a convention. */
  readonly ends: PartEnds;
  /** Length in millimetres. Always an integer on real track. */
  readonly lengthMm: number;
  /**
   * A RAMP: how many levels the far end (port 1) sits above the entry (port
   * 0). Absent on flat track, which is every part but the ascending track.
   *
   * An integer level, not millimetres, by decision L1 of the two-layer plan
   * (docs/plan/2026-10-23-two-layers.md): a run's level is worked out from
   * its ramps the way its position is worked out from its welds, so the
   * check "a loop comes back down to the level it left" stays exact. This is
   * NOT `heightMm`, the continuous height decision 12A added, which nothing
   * reads; the two will meet if risers of arbitrary height ever arrive.
   *
   * Comes from the built-in catalogue only (decision S1): `resolveLibrary`
   * ignores a stored submission's rise and keeps a built-in's rise through a
   * correction, so nothing in storage can create, flatten or reshape a ramp.
   */
  readonly rise?: 1;
  /**
   * A RAISED DECK: both ends sit this many levels above the piece's own
   * frame, which stays at its footprint (plan 2026-11-02, C4 B). A station's
   * deck is one level up, so the floor rule that puts each run's lowest piece
   * on the floor puts the station's footprint there and its deck at level 1,
   * with no change to how levels are worked out. Built-in only, like `rise`.
   */
  readonly deck?: 1;
  /**
   * The opening under a raised deck that floor track passes beneath, floor to
   * the road's underside (next-parts plan R2): a deck bridge's clearance,
   * stated like a hump's (bridges design DD5). Built-in only, like `deck`.
   */
  readonly deckClearanceMm?: number;
  /**
   * AN UP-AND-OVER ROAD (bridges plan 2026-11-03, eng D1): both ends on the
   * piece's own level, the middle one level up. Built-in only, like `rise`.
   */
  readonly hump?: Hump;
}

/**
 * The road of an up-and-over bridge, along the piece from its start end:
 * `upMm` climbing (one level), `topMm` raised, `downMm` coming back down.
 * The three add up to `lengthMm` (eng D10). Checks read only these levels;
 * the millimetre figures below are for drawing and the clearance note.
 */
export interface Hump {
  readonly upMm: number;
  readonly topMm: number;
  readonly downMm: number;
  /**
   * The road's real top-surface height above the floor, as (along, height)
   * points from the start end, for the 3D view only (eng D9): a measured
   * bridge climbs past the one raised level at its crown.
   */
  readonly profileMm: readonly (readonly [number, number])[];
  /** The opening under the span, floor to the arch's underside at its crown (eng D7). */
  readonly clearanceMm: number;
  /** True when the opening is an estimate, not read off the piece; the clearance sentence says so. */
  readonly clearanceEstimated?: true;
}

/**
 * One box of a part's `body`, in the part's own frame (placed `turn: 'left'`):
 * centred at `atMm`, `lengthMm` along the piece's x axis, `widthMm` across,
 * filling `levels` (low, high) above the piece's frame.
 */
export interface BodyBox {
  readonly role: 'footprint' | 'wall' | 'roof';
  readonly atMm: readonly [number, number];
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly levels: readonly [number, number];
  /**
   * Its top outline in the 3D view, as (along the box from its start, height
   * above the floor) points: an embankment rising under a ramp, an
   * abutment's falling face (bridges plan, eng D5). Absent: a flat box as tall
   * as its levels. Collisions always use the whole box.
   */
  readonly profileMm?: readonly (readonly [number, number])[];
}

/**
 * A STRUCTURE (plan 2026-11-02; bridges plan): a part that carries its own
 * road or stands on its own wood: a block, any part with a body, a raised
 * deck or an up-and-over road. Built-in only (OV2), and its raised road needs
 * no supports from the user (bridges eng D3).
 */
export const isStructure = (p: Part): boolean =>
  p.kind === 'block' || p.body !== undefined || (p.kind === 'straight' && (p.deck !== undefined || p.hump !== undefined));

/**
 * A BLOCK: wood with no ends, only a body (plan 2026-11-02, X1: the bridge
 * pier). It joins nothing, so it is always its own run, placed and moved like
 * one (eng EO2), and never counted as unfinished track (EO4).
 */
export interface BlockPart extends PartBase {
  readonly kind: 'block';
  readonly body: readonly BodyBox[];
  /** The palette card's size, e.g. "40×40". */
  readonly sizeLabel: string;
}

export interface CurvePart extends PartBase {
  readonly kind: 'curve';
  /** Connector polarity at each end. See `Polarity` for why this is a convention. */
  readonly ends: PartEnds;
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
   * A Generic E curve is 45 degrees, i.e. 2 steps.
   */
  readonly arcSteps: number;
}

/** A pose in a piece's own frame: an exact position and a heading in sixteenths. */
export interface LocalPose {
  readonly pos: Cyc;
  /** Power of zeta, 0..15, pointing OUT of the piece. */
  readonly heading: number;
}

/**
 * One end of a multi-road piece, written for the piece placed `turn: 'left'`.
 * Placed the other way up, every end is mirrored (`conj`).
 */
export interface EndSpec {
  readonly at: LocalPose;
  readonly polarity: Polarity;
  /**
   * What the end is called in the layout list and by the screen reader:
   * "heel", "straight road", "first road's far end". Data, not code (eng
   * review D8), so a new shape needs no app change.
   */
  readonly name: string;
  /** 'heel' only where roads meet at the end, as on a switch. Naming only. */
  readonly kind?: 'heel';
}

/** How a road runs between its two ends, as walked from `from`. */
export type RoadShape =
  | { readonly kind: 'straight'; readonly lengthMm: number }
  | {
      readonly kind: 'arc';
      /** To the INNER edge of the wood, as on `CurvePart`. */
      readonly innerRadiusMm: number;
      /** 22.5-degree steps. */
      readonly arcSteps: number;
      /** Which way it bends walked from `from`, with the piece `turn: 'left'`. */
      readonly side: Turn;
      /**
       * A STRAIGHT LEAD-IN before the arc, whole millimetres, walked from
       * `from` (absent means 0). The owner's T switch, photographed
       * 2026-11-03, runs 2mm straight before each 106mm curve; one arc from
       * the heel could not end where its curved road does. A whole-millimetre
       * lead keeps the far end a lattice point, so verdicts stay exact.
       */
      readonly leadMm?: number;
    }
  /**
   * An S-BEND: the road ends facing the way it started, moved `offsetMm`
   * across (positive to the left, walked from `from`, piece `turn: 'left'`)
   * after `lengthMm` along. Parallel switches (F1, G1) and the F/G fork have
   * these, and no pair of 22.5-degree arcs makes one.
   *
   * THE ENDS ARE EXACT: both lengths are whole millimetres, so the far end is
   * a lattice point and every verdict stays exact. THE SHAPE BETWEEN IS NOT:
   * it is drawn, and overlap-checked, as two equal arcs bending out and back,
   * worked out in floats (owner, 2026-10-30: "Smooth S, approximate"). Each
   * part with one says so.
   */
  | { readonly kind: 's-bend'; readonly lengthMm: number; readonly offsetMm: number };

/** A road: track a train can run along, between two ends of the piece. */
export interface Road {
  readonly from: number;
  readonly to: number;
  readonly shape: RoadShape;
}

/**
 * A MULTI-ROAD PIECE: three or more ends, joined by two or more roads.
 *
 * The ENDS are listed, each at an exact pose with its own peg or socket, and
 * the ROADS name which ends they join and how (eng review D9). Both are data,
 * and they repeat each other on purpose: `multiRoad.test.ts` walks every road
 * from its `from` end and requires it to land EXACTLY on its `to` end, so a
 * typo in either list fails, and each measured end is recorded twice.
 *
 * End numbers are what saved layouts store, which is why they are written
 * down rather than worked out from the roads: reordering the roads cannot
 * renumber an end. End 0 sits at the frame origin facing back (heading 8),
 * like every other part's entry.
 *
 * `turn` at placement mirrors the piece, so a left-hand and a right-hand
 * switch are one record placed two ways.
 *
 * EVERY MULTI-ROAD PIECE IS MODELLED. Nobody has published Generic's switch or
 * crossing geometry in a form this file could cite; the seeds are read off
 * 3D-print reproductions (`engine/data/switchSeeds.ts`), and whatever a
 * future source says about the numbers, the straight-and-arc shape is the
 * engine's model (trust.ts says so for any layout holding one).
 */
export interface MultiRoadPart extends PartBase {
  readonly kind: 'multi-road';
  readonly ports: readonly EndSpec[];
  readonly roads: readonly Road[];
  /**
   * The palette card's size, e.g. "r202" for a switch whose arc is an E, or
   * "108 x 108" for a crossing.
   */
  readonly sizeLabel: string;
}

/**
 * A BUFFER STOP: one end, and a short body behind it that ends a track.
 *
 * The first part with ONE end (Generic R and S). It has no road, because a
 * train cannot run through it, but its body is real wood on the table, so it
 * is drawn and checked for overlap like a straight of `lengthMm` running back
 * from its end. R has a peg, S a socket.
 */
export interface BufferPart extends PartBase {
  readonly kind: 'buffer';
  /** The body behind the end, millimetres. Drawing and overlap only. */
  readonly lengthMm: number;
  /** Peg or socket, at the one end. */
  readonly end: Polarity;
}

export type Part = StraightPart | CurvePart | MultiRoadPart | BufferPart | BlockPart;

/** True for every piece with more than two ends. The one place that asks. */
export function isMultiRoad(part: Part): part is MultiRoadPart {
  return part.kind === 'multi-road';
}

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
 * Generic parts carry bare ids (A2, E1) and come back unchanged.
 */
export function shortCode(part: Part): string {
  const prefix = `${part.brand}-`;
  return part.id.startsWith(prefix) ? part.id.slice(prefix.length) : part.id;
}

/**
 * The code a person sees for a bare part id, where only the id is at hand:
 * any system prefix is dropped, because the prefix spells a maker's name
 * (design review 2026-11-04, D1). The same as `shortCode` for every part
 * whose id carries its own brand.
 */
export function codeOf(id: string): string {
  const prefix = (Object.keys(SYSTEM_NAME) as Brand[]).find((b) => id.startsWith(`${b}-`));
  return prefix ? id.slice(prefix.length + 1) : id;
}

export function centrelineRadiusMm(part: { readonly innerRadiusMm: number; readonly plankWidthMm: number }): number {
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
