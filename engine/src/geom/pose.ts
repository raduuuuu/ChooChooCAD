/**
 * Exact forward kinematics.
 *
 * A pose is a position in Z[zeta16] plus a heading expressed as an integer
 * power of zeta (so 16 possible headings, one every 22.5 degrees). Walking a
 * chain of parts is therefore exact integer arithmetic start to finish.
 *
 * Displacement derivations, with d = zeta^h the current heading and
 * i = zeta^4:
 *
 *   straight, length L      disp = L * zeta^h                 heading unchanged
 *   curve left,  s steps    disp = i*r*d*(1 - zeta^s)          heading += s
 *                                = r*(zeta^(4+h) - zeta^(4+h+s))
 *   curve right, s steps    disp = i*r*d*(zeta^-s - 1)         heading -= s
 *                                = r*(zeta^(4+h-s) - zeta^(4+h))
 *
 * Sanity check that falls out of this, for one BRIO E curve (r=182, s=2) from
 * the origin heading +x:
 *
 *   disp = 182*(zeta^4 - zeta^6)  =  (91*sqrt2, 182 - 91*sqrt2)
 *       ~= (128.693434, 53.306566)
 */

import { type Cyc, ZERO, add, mulZetaPow, scale, sub, zetaPow } from './cyclotomic.js';
import { centrelineRadiusMm, type CurvePart, type Layout, type Part, type StraightPart, type Turn } from '../parts/schema.js';

export interface Pose {
  readonly pos: Cyc;
  /** Heading as a power of zeta. Meaningful modulo 16. */
  readonly heading: number;
}

export const ORIGIN: Pose = { pos: ZERO, heading: 0 };

/*
 * The chain engine REFUSES a multi-road piece rather than guessing.
 *
 * Widening `PartKind` opened a silent path here once: this function tests for
 * 'straight' and treated everything else as a curve, and the old switch kind
 * happened to carry `arcSteps` and an inner radius, so a switch would have
 * been walked as its diverging road with no error anywhere. A wrong answer
 * that typechecks is the exact defect class this project keeps finding, so it
 * throws, and the assertion narrows the type so the rest cannot forget.
 *
 * A chain cannot express a branch at all, so nothing legitimate reaches here
 * with a switch or a crossing; the graph engine in src/graph is where they
 * belong. This dies when the chain engine does, after T7's harness.
 */
export function refuseMultiRoad(part: Part): asserts part is StraightPart | CurvePart {
  if (part.kind === 'multi-road') {
    throw new Error(
      `${part.id} has ${part.ports.length} ends: a chain cannot express a branch. Use the graph engine.`,
    );
  }
}

/** Exact displacement contributed by one part placed at the given heading. */
export function displacement(part: Part, heading: number, turn: Turn = 'left'): Cyc {
  refuseMultiRoad(part);
  if (part.kind === 'straight') {
    return scale(zetaPow(heading), part.lengthMm);
  }
  // Centreline, not the inner edge: a connector travels the middle of the track.
  const r = centrelineRadiusMm(part);
  const s = part.arcSteps;
  if (turn === 'left') {
    return scale(sub(zetaPow(4 + heading), zetaPow(4 + heading + s)), r);
  }
  return scale(sub(zetaPow(4 + heading - s), zetaPow(4 + heading)), r);
}

/** Heading after traversing one part. */
export function headingAfter(part: Part, heading: number, turn: Turn = 'left'): number {
  refuseMultiRoad(part);
  if (part.kind === 'straight') return heading;
  return turn === 'left' ? heading + part.arcSteps : heading - part.arcSteps;
}

/**
 * Walk a layout from the origin.
 *
 * Returns n+1 poses: the start pose, then the pose after each piece. The joints
 * sit at poses[1..n-1] for an open chain; a closed layout adds one more joint
 * where poses[n] should coincide with poses[0].
 */
export function walk(layout: Layout, resolve: (id: string) => Part): Pose[] {
  const poses: Pose[] = [ORIGIN];
  let cur = ORIGIN;
  for (const placement of layout.placements) {
    const part = resolve(placement.partId);
    const turn = placement.turn ?? 'left';
    cur = {
      pos: add(cur.pos, displacement(part, cur.heading, turn)),
      heading: headingAfter(part, cur.heading, turn),
    };
    poses.push(cur);
  }
  return poses;
}

/** Unit vector of a heading, as floats. For LP sensitivities and rendering. */
export function headingUnit(heading: number): [number, number] {
  const ang = (heading * Math.PI) / 8;
  return [Math.cos(ang), Math.sin(ang)];
}

/** Rotate a heading into 0..15. */
export function normalizeHeading(h: number): number {
  return ((h % 16) + 16) % 16;
}

/** Unused-but-exported guard so mulZetaPow stays reachable from one place. */
export const _rotate = mulZetaPow;
