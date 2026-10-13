/**
 * Physical feasibility: the checks that are about SPACE, not about closure.
 *
 * Closure asks "do the ends meet". It is answered exactly in `residual.ts` and
 * it has never been wrong. But a layout whose ends meet can still be impossible,
 * because two pieces can be asked to occupy the same place. Sixteen large curves
 * close exactly, with a zero residual and a correct heading, and the engine
 * reported EXACT for them: the track runs round the same circle twice. That is
 * the false pass this file exists to refuse.
 *
 * WHY THIS IS AN EXACT TEST AND NOT A TOLERANCE
 *
 * The plan originally called for two overlap tiers: a same-circle angular
 * interval test, and a footprint tier comparing drawn widths. The footprint tier
 * needed the plank width, which is not the 40mm gauge and is recorded nowhere,
 * so it could not be built without a measurement nobody has taken.
 *
 * It turns out neither tier is needed for the known cases. Both of them are
 * detectable by asking a question that needs no measurement at all: do two
 * connectors that are not supposed to be in the same place sit at the SAME EXACT
 * POSITION? Positions live in Z[zeta16] as integer coordinate vectors, so that
 * is `equals()`, an integer comparison with no epsilon and no threshold. It
 * catches the double circle (nine pairs) and it catches the eight-left /
 * eight-right tangency (two pairs), which the same-circle tier could not see
 * because those arcs do not share a centre.
 *
 * WHAT THIS DELIBERATELY DOES NOT CATCH
 *
 * Two pieces that overlap WITHOUT any connector landing exactly on another
 * connector. A plank crossing a plank mid-span is real and invisible here. That
 * needs measured plank width and is explicitly out of scope until calibration
 * runs; the verdict must not imply this check is complete. What it does give is
 * a definite refusal with zero false positives: an exact coincidence of two
 * connectors that are not joined is never physically assemblable.
 *
 * Once the catalogue has a crossing part (task C11), a crossing's own two routes
 * meet by design and its interior point must be exempted here. There is no
 * crossing part yet, so there is no exemption yet, and inventing the parameter
 * before the part exists would be guessing at its shape.
 */

import { equals, toXY } from './geom/cyclotomic.js';
import type { Pose } from './geom/pose.js';
import type { Layout, Part, Polarity } from './parts/schema.js';

/** Two connectors at the same exact position that are not joined to each other. */
export interface ConnectorClash {
  /** Connector indices, a < b. Connector i sits at poses[i]. */
  readonly a: number;
  readonly b: number;
  /** Where they coincide, as floats. Reporting and drawing only. */
  readonly at: [number, number];
}

/**
 * Every pair of non-adjacent connectors sitting at the same exact position.
 *
 * `poses` has n+1 entries for n pieces: piece k runs from poses[k] to
 * poses[k+1]. Three kinds of pair are excluded, because each is two connectors
 * that are MEANT to be in the same place or on the same piece:
 *
 *   |a - b| === 1   the two ends of a single piece
 *   (0, n)          the closing seam, where the chain meets its own start
 *   (0, n - 1)      the last piece's far end, which for a closed loop is the
 *                   same connector as 0, so this pair is that piece's own ends
 *
 * Everything else is fair game. Per decision D8 of the CEO re-review, EVERY
 * pair is reported rather than deduplicated to one per location, so the caller
 * can draw each one.
 */
/*
 * gstack-shortcut(dec-f333f98f): all-pairs comparison, O(n^2) in connectors.
 * Ceiling: 25,359 pairs at the measured worst case, which is milliseconds.
 * Upgrade when a layout exceeds roughly 500 connectors, or when profiling
 * puts this above 16ms in a frame; the replacement is a spatial grid keyed
 * on the exact lattice position, not a tolerance.
 *
 * Decision f333f98f SUPERSEDES cae368ab, whose "204,480 conflicting pairs"
 * was C(640,2), the number of pairs COMPARED, not conflicts found.
 */
export function findCoincidentConnectors(
  poses: readonly Pose[],
  closed: boolean,
): readonly ConnectorClash[] {
  const n = poses.length - 1;
  if (n < 2) return [];

  const clashes: ConnectorClash[] = [];
  for (let a = 0; a <= n; a++) {
    for (let b = a + 1; b <= n; b++) {
      if (b - a === 1) continue;
      if (closed && a === 0 && (b === n || b === n - 1)) continue;
      if (!equals(poses[a]!.pos, poses[b]!.pos)) continue;
      const [x, y] = toXY(poses[a]!.pos);
      clashes.push({ a, b, at: [x, y] });
    }
  }
  return clashes;
}

/** A joint whose two ends cannot physically mate: peg to peg, or socket to socket. */
export interface PolarityViolation {
  /** Joint index, matching `Joint.index` in the residual report. */
  readonly jointIndex: number;
  /** The two part ids that meet here, in placement order. */
  readonly between: readonly [string, string];
  /** What each side actually offers. Equal, which is the problem. */
  readonly polarity: Polarity;
}

/**
 * Every joint in a chain whose two ends have the same polarity (task C2).
 *
 * Always empty for anything built by appending, because every piece is laid down
 * facing the same way: the end of piece k is a peg and the start of piece k+1 is
 * a socket, all the way round including the seam. That is not a reason to skip
 * the check. It is a BACKSTOP against two things that are already reachable:
 *
 *   - a layout restored from storage, or imported later, whose pieces were not
 *     placed by this session's append path;
 *   - decision D8's user-declared welds, which join any two free ends and make
 *     peg-to-peg one click away.
 *
 * Without it, such a layout closes exactly and reports EXACT. Plan line 3189
 * recorded exactly that gap ("two male ends can be joined | unjoinable layout
 * PASSes | none") and it stayed open across three reviews.
 */
export function findPolarityViolations(
  layout: Layout,
  resolve: (id: string) => Part,
): readonly PolarityViolation[] {
  const n = layout.placements.length;
  if (n === 0) return [];

  const out: PolarityViolation[] = [];
  // Interior joints are 0..n-2; the seam (piece n-1 to piece 0) only exists on
  // a closed loop, so an open chain simply has one fewer joint to check.
  const last = layout.closed ? n - 1 : n - 2;
  for (let j = 0; j <= last; j++) {
    const incomingId = layout.placements[j]!.partId;
    const outgoingId = layout.placements[(j + 1) % n]!.partId;
    const incoming = resolve(incomingId).ends.end;
    const outgoing = resolve(outgoingId).ends.start;
    if (incoming !== outgoing) continue;
    out.push({ jointIndex: j, between: [incomingId, outgoingId], polarity: incoming });
  }
  return out;
}
