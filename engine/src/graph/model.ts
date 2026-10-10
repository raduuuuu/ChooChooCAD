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
import { centrelineRadiusMm, type Part, type Turn } from '../parts/schema.js';

/** A pose in a piece's local frame, or in world space. Both are exact. */
export interface Frame {
  readonly pos: Cyc;
  /** Power of zeta. Meaningful modulo 16. */
  readonly heading: number;
}

export const IDENTITY: Frame = { pos: ZERO, heading: 0 };

/**
 * One connectable end of a part.
 *
 * `kind` is not decoration. A switch's heel is the end where its two routes
 * meet, and T8 gives it three distinct treatments: it donates no give, it is
 * exempt from polarity, and it still participates in the coincident-vertex
 * check. Carrying the kind here is what lets those three stay separate
 * instead of collapsing into one "is it a switch" boolean.
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
  const entry: Port = { kind: 'end', at: { pos: ZERO, heading: 8 } };
  if (part.kind === 'straight') {
    return [entry, { kind: 'end', at: { pos: scale(zetaPow(0), part.lengthMm), heading: 0 } }];
  }
  const r = centrelineRadiusMm(part);
  const s = part.arcSteps;
  // Same displacement the chain walk used, with heading 0: the local frame IS
  // "entering at the origin heading +x", so these agree by construction.
  const pos =
    turn === 'left'
      ? scale(sub(zetaPow(4), zetaPow(4 + s)), r)
      : scale(sub(zetaPow(4 - s), zetaPow(4)), r);
  return [entry, { kind: 'end', at: { pos, heading: turn === 'left' ? s : -s } }];
}

/** Compose: where a local pose lands once its piece's frame is placed. */
export function compose(frame: Frame, local: Frame): Frame {
  return {
    pos: add(frame.pos, mulZetaPow(local.pos, frame.heading)),
    heading: frame.heading + local.heading,
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
  const heading = target.heading - local.heading;
  return { pos: sub(target.pos, mulZetaPow(local.pos, heading)), heading };
}

/** Facing the other way. A weld joins two ports whose headings are opposite. */
export function opposed(f: Frame): Frame {
  return { pos: f.pos, heading: f.heading + 8 };
}
