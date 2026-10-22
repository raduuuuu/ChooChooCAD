/**
 * THE GRAPH MODEL (task T2).
 *
 * `Layout` was `{ placements: Placement[], closed: boolean }`: an ordered list.
 * Every element has exactly one predecessor and one successor, so a branch
 * point is not merely unimplemented, it is inexpressible. That is why
 * `PartKind` is still `'straight' | 'curve'` and why the catalogue was scoped
 * to two-ended parts: a switch in the palette would build a layout the engine
 * cannot represent. Eng review R22.
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

import { type Cyc, ZERO, add, mulZetaPow, scale, sub, zetaPow } from '../geom/cyclotomic.js';
import { centrelineRadiusMm, type Part, type Polarity, type Turn } from '../parts/schema.js';

/** A pose in a piece's local frame, or in world space. Both are exact. */
export interface Frame {
  readonly pos: Cyc;
  /** Power of zeta, always normalised to 0..15 by `norm16`. */
  readonly heading: number;
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
}

/** A placed piece: an instance of a part, with its own identity. */
export interface Piece {
  readonly pieceId: string;
  readonly partId: string;
  /** Which way a curve bends. Ignored by parts that do not turn. */
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
 * backwards; the frame's +x is the direction you travel on entering. Today
 * every part has exactly two ports because the catalogue is two-ended, and
 * this function is where a switch or a crossing will declare three or four
 * without anything downstream changing.
 */
export function portsOf(part: Part, turn: Turn = 'left'): readonly Port[] {
  // Port 0 is the HEEL on a switch and an ordinary end everywhere else. On a
  // two-ported part the distinction is invisible, which is why it can be set
  // here once rather than threaded through the walk.
  const entry: Port = { kind: part.kind === 'switch' ? 'heel' : 'end', at: ENTRY };
  if (part.kind === 'straight') {
    return [entry, { kind: 'end', at: { pos: straightEnd(part.lengthMm), heading: 0 } }];
  }
  if (part.kind === 'curve') {
    return [entry, { kind: 'end', at: arcEnd(centrelineRadiusMm(part), part.arcSteps, turn) }];
  }
  /*
   * A SWITCH. Three ports, and nothing else in this file had to change.
   *
   * Port 0 is the heel, where the two routes meet. Port 1 is the straight
   * road, port 2 the diverging one. Both are measured from the same local
   * frame, so the switch is rigid for exactly the reason the crossing is:
   * there is one frame, not two routes that have to be kept in step.
   *
   * `turn` picks which side the switch diverges to, the same way it mirrors
   * a curve, so a left-hand and a right-hand switch are one part placed two
   * ways rather than two catalogue entries.
   */
  return [
    entry,
    { kind: 'end', at: { pos: straightEnd(part.throughLengthMm), heading: 0 } },
    { kind: 'end', at: arcEnd(centrelineRadiusMm(part), part.arcSteps, turn) },
  ];
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
 * `PartEnds` has two fields because a part used to have two ends. Port 0 is
 * the start; every other port takes the part's `end` polarity.
 *
 * For a switch, port 0 is the heel and both roads take `end`: the two roads
 * leaving the heel terminate the same way. Every switch reproduction measured
 * for `switchSeeds.ts` has that shape (pegs on both roads with a socket heel,
 * or the reverse), but nobody has published it for real BRIO track, so it is
 * an observation from reproductions rather than a cited fact. A switch whose
 * roads differ would need per-port polarity.
 */
export function portPolarity(part: Part, portIndex: number): Polarity {
  return portIndex === 0 ? part.ends.start : part.ends.end;
}

/**
 * Give at a weld, millimetres.
 *
 * Every weld is a peg in a socket, a switch's heel included (see `PortKind`),
 * so every weld donates the same give. A heel used to donate nothing, which
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
  return {
    pos: add(frame.pos, mulZetaPow(local.pos, frame.heading)),
    heading: norm16(frame.heading + local.heading),
  };
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
  return { pos: sub(target.pos, mulZetaPow(local.pos, heading)), heading };
}

/** Facing the other way. A weld joins two ports whose headings are opposite. */
export function opposed(f: Frame): Frame {
  return { pos: f.pos, heading: norm16(f.heading + 8) };
}
