/**
 * THE GRAPH MODEL (task T2).
 *
 * `Layout` was `{ placements: Placement[], closed: boolean }`: an ordered list.
 * Every element has exactly one predecessor and one successor, so a branch
 * point is not merely unimplemented, it is inexpressible. That is why the
 * catalogue was once scoped to two-ended parts: a switch in the palette would
 * have built a layout the engine could not represent (eng review R22). The
 * graph made switches possible, and the multi-road kind (eng review D4,
 * 2026-10-30) made crossings and every other many-ended piece data.
 *
 * WHAT REPLACES IT, and why it is ports rather than routes.
 *
 * The obvious model is "a piece has routes between its ends". It breaks on the
 * crossing. A crossing's two routes share no end, so walking one tells you
 * nothing about where the other two ends are, and the two halves drift apart
 * depending on which way you traverse. The plan calls this the crossing's
 * rigid same-piece constraint and makes it T2's acceptance test.
 *
 * So a part instead declares, in ITS OWN LOCAL FRAME, the pose of every port.
 * Place the frame and every port follows by construction. Rigidity is then not
 * a constraint anyone has to enforce; it is a property of there being one
 * frame per piece. Two ports, three or four makes no difference to any of the
 * code below, which is the whole point.
 *
 * A port's heading points OUT of the piece, the direction you would leave by.
 * Two ports that are welded therefore sit at the same position with opposite
 * headings, which is the chain rule generalised: the old `walk` advanced a
 * single heading because a chain is the special case where every piece has
 * exactly two ports and each is welded to the next.
 *
 * Everything here is exact. Positions are Z[zeta16], headings are integers mod
 * 16, so a weld either closes or it does not and no epsilon appears anywhere.
 */

import { type Cyc, ZERO, add, conj, mulZetaPow, scale, sub, zetaPow } from '../geom/cyclotomic.js';
import { centrelineRadiusMm, type Part, type Polarity, type RoadShape, type Turn } from '../parts/schema.js';

/** A pose in a piece's local frame, or in world space. Both are exact. */
export interface Frame {
  readonly pos: Cyc;
  /** Power of zeta, always normalised to 0..15 by `norm16`. */
  readonly heading: number;
  /**
   * Which level of track: 0 is the floor, 1 the raised level (two-layer
   * plan, decisions L1 and A1). ABSENT MEANS THE FLOOR, and 0 is never
   * written (eng decision SC1): every frame built before levels existed, every
   * test literal and every saved layout without raised track stays byte-for-
   * byte what it was, and `movesAnything` (layoutModel.ts), which compares
   * frames as JSON, never sees `level: 0` against a missing field and calls
   * it a move.
   *
   * Read it ONLY through `levelOf`. A raw `f.level` is `undefined` on the
   * floor, and arithmetic on it is NaN; levelAccess.test.ts fails if any
   * source file outside this one reads it.
   */
  readonly level?: number;
}

/** A frame's level, 0 when absent (the floor). The one reader of `Frame.level`. */
export function levelOf(f: Frame): number {
  return f.level ?? 0;
}

/** A frame with `level` written only when it is not the floor (SC1). */
export function frameOf(pos: Cyc, heading: number, level: number): Frame {
  return level === 0 ? { pos, heading } : { pos, heading, level };
}

/**
 * Headings are canonical, 0..15.
 *
 * "Meaningful modulo 16" was true and not enough. Walking a closed loop one
 * way accumulated heading 8 and walking it the other way accumulated 56: the
 * same pose, a different integer, and `toEqual` on two frames quietly said
 * they differed. Deleting an interior piece re-routes half the layout the
 * long way round, so this showed up the moment T11 tried to assert that
 * untouched track had not moved.
 *
 * Normalising where frames are BUILT, rather than at each comparison, means
 * there is one representation of a pose and nothing downstream has to
 * remember to reduce it.
 */
export function norm16(heading: number): number {
  return ((heading % 16) + 16) % 16;
}

export const IDENTITY: Frame = { pos: ZERO, heading: 0 };

/**
 * One connectable end of a part.
 *
 * `kind` NAMES the end; it changes no rule. A switch's heel is the end both
 * of its roads start from, and it is a real connector: the end face of the
 * plank, with a peg or a socket on it, like every other end. The reproduction
 * switches in `switchSeeds.ts` show this directly, with an 18mm peg or a
 * socket at the heel.
 *
 * T8 once gave it three special treatments: no give, exempt from polarity,
 * still counted for position. The first two came from an earlier model in
 * which a switch was two edges meeting at an interior point inside the piece
 * (plan C6), and that point really had no plug and no socket. Port 0 is not
 * that point. It sits at the frame origin, the plank's end face, so the two
 * exemptions made a heel joint donate nothing and let a peg meet a peg there
 * unchallenged. Both were removed on 2026-10-22, when the first switches
 * entered the library and the exemption stopped being hypothetical.
 */
export type PortKind = 'end' | 'heel';

export interface Port {
  readonly kind: PortKind;
  /** Pose in the part's local frame. Heading points OUT of the piece. */
  readonly at: Frame;
  /**
   * Peg or socket, the same answer `portPolarity` gives. Carried on the port
   * so code that holds only ports, such as the editor attaching a piece,
   * can see which way round the piece has to go (the auto-flip in
   * `addPiece`).
   */
  readonly polarity: Polarity;
  /**
   * On a multi-road piece, the ends a road joins this one to, in the order
   * the roads are listed. ABSENT on a two-ended part, whose one road joins
   * its two ends.
   *
   * Two readers. The editor builds on from the first (eng review D14), so
   * laying track through a crossing carries straight on rather than round
   * the corner. The pile-up rule asks whether two ROADS lie on top of each
   * other (eng review D12), and a road is a pair of ends.
   */
  readonly along?: readonly number[];
}

/** A placed piece: an instance of a part, with its own identity. */
export interface Piece {
  readonly pieceId: string;
  readonly partId: string;
  /** Which way a curve bends, or which face of a ramp is up. Ignored by flat straights. */
  readonly turn?: Turn;
}

/** Names one port of one piece. The thing a weld attaches to. */
export interface PortRef {
  readonly pieceId: string;
  readonly port: number;
}

/**
 * A user-declared join between two ports.
 *
 * DECLARED, never inferred. Two ports that happen to land in the same place
 * are a collision, not a connection: that distinction is the one the chain
 * engine could not make, and `feasible.ts` carried two exclusion rules
 * (`b - a === 1` and the `(0, n)` seam) that existed only to paper over it.
 * T9 deletes them because a weld is now a fact in the data.
 */
export interface Weld {
  readonly a: PortRef;
  readonly b: PortRef;
}

export interface Graph {
  readonly pieces: readonly Piece[];
  readonly welds: readonly Weld[];
  /**
   * Where a component's root sits (task T3). Keyed by piece id.
   *
   * CAPTURED, NEVER RE-DERIVED. When a weld is broken and a layout falls into
   * two pieces, the half that no longer contains the original root would
   * otherwise be re-placed from the identity frame and jump to the origin.
   * So at the moment of the split its current frame is written down here and
   * kept.
   *
   * Captured rather than recomputed because the frame is an exact lattice
   * point, a Z[zeta16] position and an integer heading. Re-deriving it later
   * from a float render pose, or from a "nearest" fit, would introduce the
   * one epsilon this engine does not have. A value that was exact when it was
   * written stays exact forever if nobody recomputes it.
   */
  readonly anchors?: ReadonlyMap<string, Frame>;
}

/**
 * The ports of a placed part, in its local frame.
 *
 * Port 0 is the entry by convention, sitting at the frame origin and facing
 * backwards; the frame's +x is the direction you travel on entering. A
 * straight or a curve has two; a multi-road piece lists three or more, and
 * nothing downstream needed to change to take them.
 */
export function portsOf(part: Part, turn: Turn = 'left'): readonly Port[] {
  /*
   * A MULTI-ROAD PIECE lists its ends (eng review D9), written for the piece
   * placed 'left'. Placed 'right' it is the mirror image, end by end: the
   * same numbering, each pose reflected across the piece's own x axis. That
   * is how a curve turns the other way too (`arcEnd` below), so a switch
   * placed 'right' lands its ends exactly where the old switch kind did
   * (switchRegression.test.ts).
   */
  if (part.kind === 'multi-road') {
    return part.ports.map((e, i) => ({
      kind: e.kind ?? 'end',
      at: turn === 'right' ? mirrored(e.at) : { pos: e.at.pos, heading: norm16(e.at.heading) },
      polarity: e.polarity,
      along: part.roads.flatMap((r) => (r.from === i ? [r.to] : r.to === i ? [r.from] : [])),
    }));
  }
  /*
   * A RAMP FLIPPED OVER (turn 'right'). BRIO track is double-sided, which is
   * how one curve turns either way: `turn` already means "this face up". An
   * ascending track turned over keeps its ends where they were, socket and
   * peg, but its high end is now the entry: it comes down where it used to
   * climb (owner, 2026-10-23: "you need to see flip in 3d"). The piece's
   * frame stays its LOW end, as for every other piece (frames.ts normalises
   * on that), so the rise moves from the far port to the entry port.
   */
  const rise = part.kind === 'straight' ? (part.rise ?? 0) : 0;
  const flippedRamp = rise !== 0 && turn === 'right';
  const entry: Port = {
    kind: 'end',
    at: flippedRamp ? frameOf(ENTRY.pos, ENTRY.heading, rise) : ENTRY,
    polarity: part.ends.start,
  };
  const far = part.ends.end;
  if (part.kind === 'straight') {
    // A ramp's high end sits `rise` levels above its low end; compose adds it.
    return [entry, { kind: 'end', at: frameOf(straightEnd(part.lengthMm), 0, flippedRamp ? 0 : rise), polarity: far }];
  }
  return [
    entry,
    { kind: 'end', at: arcEnd(centrelineRadiusMm(part), part.arcSteps, turn), polarity: far },
  ];
}

/** A local pose reflected across the piece's x axis: the piece the other way up. */
function mirrored(at: { readonly pos: Cyc; readonly heading: number }): Frame {
  return { pos: conj(at.pos), heading: norm16(-at.heading) };
}

/**
 * The roads of a placed part, in its local frame, each as the two ends it
 * joins and how it runs between them. A two-ended part is one road, end 0 to
 * end 1. A multi-road piece placed 'right' has every arc bending the other
 * way, the same mirror `portsOf` applies to its ends.
 *
 * Read by the renderer (one segment per road), the pile-up rule (two roads on
 * top of each other) and the editor (which end to build on from).
 */
export interface PlacedRoad {
  readonly from: number;
  readonly to: number;
  readonly shape: RoadShape;
}

export function roadsOf(part: Part, turn: Turn = 'left'): readonly PlacedRoad[] {
  if (part.kind === 'straight') return [{ from: 0, to: 1, shape: { kind: 'straight', lengthMm: part.lengthMm } }];
  if (part.kind === 'curve') {
    return [{
      from: 0,
      to: 1,
      shape: { kind: 'arc', innerRadiusMm: part.innerRadiusMm, arcSteps: part.arcSteps, side: turn },
    }];
  }
  if (turn === 'left') return part.roads;
  return part.roads.map((r) =>
    r.shape.kind === 'arc' ? { ...r, shape: { ...r.shape, side: r.shape.side === 'left' ? 'right' : 'left' } } : r,
  );
}

/**
 * Where a road ends, walked exactly from the end it starts at. The start
 * end's heading points OUT of the piece, so travel is the opposite way.
 * `plankWidthMm` turns an arc's inner radius into its centreline.
 *
 * The check behind eng review D9: for every built-in multi-road piece this
 * must EQUAL the road's `to` end, coefficient for coefficient.
 */
export function roadEnd(start: Frame, shape: RoadShape, plankWidthMm: number): Frame {
  const h = start.heading + 8;
  if (shape.kind === 'straight') {
    return { pos: add(start.pos, scale(zetaPow(h), shape.lengthMm)), heading: norm16(h) };
  }
  const r = centrelineRadiusMm({ innerRadiusMm: shape.innerRadiusMm, plankWidthMm });
  const s = shape.arcSteps;
  const d =
    shape.side === 'left'
      ? scale(sub(zetaPow(4 + h), zetaPow(4 + h + s)), r)
      : scale(sub(zetaPow(4 + h - s), zetaPow(4 + h)), r);
  return { pos: add(start.pos, d), heading: norm16(shape.side === 'left' ? h + s : h - s) };
}

const ENTRY: Frame = { pos: ZERO, heading: 8 };

function straightEnd(lengthMm: number): Cyc {
  return scale(zetaPow(0), lengthMm);
}

/**
 * The far end of an arc entered at the local origin heading +x.
 *
 * The same displacement the chain walk used at heading 0, so the two engines
 * agree by construction rather than by a test that happens to pass.
 */
function arcEnd(r: number, s: number, turn: Turn): Frame {
  const pos =
    turn === 'left'
      ? scale(sub(zetaPow(4), zetaPow(4 + s)), r)
      : scale(sub(zetaPow(4 - s), zetaPow(4)), r);
  return { pos, heading: norm16(turn === 'left' ? s : -s) };
}

/**
 * The polarity of one port.
 *
 * A two-ended part keeps `PartEnds`: port 0 is the start, port 1 the end. A
 * multi-road piece writes each end's own peg or socket, because some pieces
 * mix them: the H1 crossing has one road socket to socket and the other peg
 * to peg, and the T switch's straight and curved roads end differently.
 */
export function portPolarity(part: Part, portIndex: number): Polarity {
  if (part.kind === 'multi-road') return part.ports[portIndex]!.polarity;
  return portIndex === 0 ? part.ends.start : part.ends.end;
}

/**
 * Give at a weld, millimetres.
 *
 * Every weld is a peg in a socket, a switch's heel included (see `PortKind`),
 * or two sockets on a male-male adapter, which is two peg-in-socket fits. Give
 * is counted ONCE for either (owner ruling R4, 2026-10-23: doubling an
 * unmeasured estimate could pass a loop that will not close), so every weld
 * donates the same give. A heel used to donate nothing, which
 * understated the give of any loop closed through one and could turn a layout
 * that builds into a definite refusal.
 */
export function weldGiveMm(slopA: number, slopB: number): number {
  // Max, not min: the bound is a NECESSARY condition, so give must be an
  // upper estimate or a layout that cannot be built could still pass.
  return Math.max(slopA, slopB);
}

/** Compose: where a local pose lands once its piece's frame is placed. */
export function compose(frame: Frame, local: Frame): Frame {
  return frameOf(
    add(frame.pos, mulZetaPow(local.pos, frame.heading)),
    norm16(frame.heading + local.heading),
    levelOf(frame) + levelOf(local),
  );
}

/**
 * The frame a piece must have for `port` to sit exactly at `target`.
 *
 * The inverse of `compose`, and the step that drives the whole walk: welding
 * port q of a new piece to port p of a placed one means q must land at p's
 * position facing the opposite way, which fixes the new piece's frame.
 */
export function frameForPortAt(local: Frame, target: Frame): Frame {
  const heading = norm16(target.heading - local.heading);
  return frameOf(sub(target.pos, mulZetaPow(local.pos, heading)), heading, levelOf(target) - levelOf(local));
}

/** Facing the other way, on the same level. A weld joins two ports whose headings are opposite. */
export function opposed(f: Frame): Frame {
  return frameOf(f.pos, norm16(f.heading + 8), levelOf(f));
}
