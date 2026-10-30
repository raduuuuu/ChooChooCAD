/**
 * THE GAP IN PIECES, WHEN THAT IS TRUE (task X6).
 *
 * "Needs 72mm absorbed" is a measurement. "This loop is one Middle straight
 * (72mm) short" is something a builder can act on. The second may be said
 * only when it is exactly true, so every test here is integer equality in
 * Z[zeta16], the same arithmetic the rest of the engine trusts, and anything
 * that does not pass every one of them says nothing and leaves the verdict in
 * millimetres.
 *
 * WHAT "SHORT" MEANS, DERIVED RATHER THAN ASSUMED. A failing loop has one
 * closing weld whose residual is `gap = pos(b) - pos(a)` (`frames.ts`). Walk
 * the loop from b round to a. Inserting a straight of length L at a joint
 * where that walk travels in direction t moves a by `L * zeta^t`, so the gap
 * becomes `gap - L * zeta^t`: the loop is one straight SHORT exactly when
 * `gap = L * zeta^t` at some joint. Removing a straight of length L that the
 * walk crosses in direction t moves a by `-L * zeta^t`: the loop is one
 * straight TOO LONG exactly when `gap = -L * zeta^t` for a straight already
 * in it. Magnitude alone cannot tell these apart, since every
 * `L * zeta^k` is also `-L * zeta^(k+8)`; which operation closes the loop
 * can.
 *
 * Why the joint test, and not only "the gap is a catalogue length along some
 * lattice direction" (the plan's first wording): a straight can only go in at
 * a joint that points the right way. A gap of 72mm at 22.5 degrees is a
 * catalogue length on the lattice, but on a loop with no joint at that
 * heading no Middle straight can close it, and saying it would is the
 * overclaim this task exists to avoid.
 *
 * THE GUARDS, each a reason the sentence would be false:
 *
 *   exactly one loop fails   (needs more bend than it is credited with)
 *                            two failing loops each needing a piece would
 *                            otherwise read as one piece for the layout
 *   one closing weld         a combined loop's gap is a sum of residuals and
 *                            has no single b-to-a walk
 *   not shared               a joint or piece another loop also uses would
 *                            change that loop too
 *   whole millimetres        a 72.5mm submitted part would turn the exact
 *                            test into a float comparison
 *   a peg and a socket       a two-peg straight cannot go in between a peg
 *                            and a socket, nor come out leaving two to mate
 *   brands that join         suggesting a part not documented to join the
 *                            track already there is a claim nobody checked
 */

import { LAMBDA_SLACK } from './bend.js';
import { equals, scale, zetaPow, type Cyc } from '../geom/cyclotomic.js';
import type { BrandFitLookup } from '../joints/trust.js';
import { trustRank, type Brand, type Part, type StraightPart } from '../parts/schema.js';
import type { CycleReport } from './cycles.js';
import { portFrame, type Placement, type PortsOf, type WeldResidual } from './frames.js';
import type { Graph, Piece } from './model.js';

export interface PieceRepair {
  /** One straight would close the loop if added, or if removed. */
  readonly direction: 'short' | 'long';
  /** The straight to add, or the one in the loop to take out. */
  readonly part: StraightPart;
  /**
   * The part number, only when no other part in the library shares it.
   * A2, B2 and C2 all carry 33333, so naming it there would not identify a
   * piece.
   */
  readonly partNumber: string | null;
}

/** What `pieceRepair` needs beyond the solve itself. */
export interface RepairLibrary {
  /** Every part a user could place, so a suggestion can come from any of them. */
  readonly parts: readonly Part[];
  readonly brandFit: BrandFitLookup;
}

/** One step of the walk from b round to a: a joint crossed or a piece passed through. */
interface Step {
  readonly weld: number;
  readonly piece: string;
  /** Direction of travel leaving `piece` through this joint, in zeta steps. */
  readonly heading: number;
}

/*
 * FLAT STRAIGHTS ONLY (eng decision D4 of the two-layer review). A repair is
 * offered only when it provably closes the loop, and this file proves it on
 * the floor plan alone: suggesting a ramp, or taking one out, would fix the
 * gap and break the loop's levels.
 */
const isClean = (p: Part): p is StraightPart =>
  p.kind === 'straight' &&
  p.rise === undefined &&
  Number.isInteger(p.lengthMm) &&
  p.lengthMm > 0 &&
  p.ends.start !== p.ends.end;

const along = (heading: number, lengthMm: number): Cyc => scale(zetaPow(heading), lengthMm);

/**
 * The single straight that closes the one failing loop, or null when no such
 * statement would be exactly true.
 */
export function pieceRepair(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
  residuals: readonly WeldResidual[],
  cycles: readonly CycleReport[],
  resolve: (id: string) => Part,
  library: RepairLibrary,
): PieceRepair | null {
  // A loop "fails" when, solved alone, it needs more bend than its joints are
  // credited with (eng review D3). The sentence still claims only what it
  // proves: that one straight closes the loop EXACTLY (design 10A).
  const failing = cycles.filter((c) => c.standaloneLambda !== null && c.standaloneLambda > 1 + LAMBDA_SLACK);
  if (failing.length !== 1) return null;
  const loop = failing[0]!;

  const residualByWeld = new Map(residuals.map((r) => [r.weld, r]));
  const closing = loop.welds.filter((w) => residualByWeld.has(w));
  if (closing.length !== 1) return null;
  const r = residualByWeld.get(closing[0]!)!;
  if (r.headingSteps !== 0) return null;

  const steps = walk(graph, ports, placement, loop, r.weld);
  if (!steps) return null;

  const others = cycles.filter((c) => c !== loop);
  const sharedWelds = new Set(others.flatMap((c) => c.welds));
  const sharedPieces = new Set(others.flatMap((c) => c.pieces));

  const brands = new Set<Brand>(graph.pieces.map((p) => resolve(p.partId).brand));
  const candidates = library.parts
    .filter(isClean)
    .filter((p) => [...brands].every((b) => library.brandFit(p.brand, b).fit === 'joins'))
    .sort((a, b) => trustRank(a.dimensions.status) - trustRank(b.dimensions.status));

  const numberOf = (part: Part): string | null => {
    if (!part.partNumber) return null;
    const sharing = library.parts.filter((p) => p.partNumber === part.partNumber);
    return sharing.length === 1 ? part.partNumber : null;
  };

  /*
   * TOO LONG FIRST. When both are true -- a loop with an extra 72mm straight
   * on one side can lose it, or gain a twin on the other -- taking out a
   * piece that is already on the table needs nothing bought, so it is the
   * one said.
   */
  // TOO LONG: a straight already in the loop, crossed heading `t`, taken out.
  for (const s of steps) {
    if (sharedPieces.has(s.piece)) continue;
    const part = resolve(pieceById(graph, s.piece).partId);
    if (!isClean(part)) continue;
    if (equals(r.gap, along(s.heading, -part.lengthMm))) {
      return { direction: 'long', part, partNumber: numberOf(part) };
    }
  }

  // SHORT: a straight added at a joint the walk crosses heading `t`.
  for (const s of steps) {
    if (sharedWelds.has(s.weld)) continue;
    const part = candidates.find((p) => equals(r.gap, along(s.heading, p.lengthMm)));
    if (part) return { direction: 'short', part, partNumber: numberOf(part) };
  }

  return null;
}

const byIdCache = new WeakMap<Graph, Map<string, Piece>>();

function pieceById(graph: Graph, id: string): Piece {
  let byId = byIdCache.get(graph);
  if (!byId) {
    byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
    byIdCache.set(graph, byId);
  }
  const piece = byId.get(id);
  if (!piece) throw new Error(`no piece ${id}`);
  return piece;
}

/**
 * The loop walked from the closing weld's b end round to its a end.
 *
 * Each step leaves a piece through a joint and records the direction of
 * travel there, which is the outward heading of the port it leaves by. A
 * straight passed through is crossed in the heading of the port it is left
 * by, so the same list serves both tests. The last step crosses the closing
 * weld itself, leaving through a. Null if the walk does not come round, which
 * a traced simple cycle should never allow.
 */
function walk(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
  loop: CycleReport,
  closingWeld: number,
): Step[] | null {
  // Which loop welds touch each piece, built once so the walk is linear.
  const touching = new Map<string, number[]>();
  for (const w of loop.welds) {
    const weld = graph.welds[w]!;
    for (const id of new Set([weld.a.pieceId, weld.b.pieceId])) {
      if (!touching.has(id)) touching.set(id, []);
      touching.get(id)!.push(w);
    }
  }
  const closing = graph.welds[closingWeld]!;
  const steps: Step[] = [];
  let at = closing.b.pieceId;
  let enteredBy = closingWeld;
  for (let i = 0; i < loop.welds.length; i++) {
    const next = touching.get(at)?.find((w) => w !== enteredBy);
    if (next === undefined) return null;
    const weld = graph.welds[next]!;
    // A self-weld has both ends on one piece; a loop of one piece has no
    // b-to-a walk worth naming.
    if (weld.a.pieceId === weld.b.pieceId) return null;
    const leaving = weld.a.pieceId === at ? weld.a : weld.b;
    const arriving = weld.a.pieceId === at ? weld.b : weld.a;
    const heading = portFrame(placement, ports, pieceById(graph, at), leaving.port).heading;
    steps.push({ weld: next, piece: at, heading });
    if (next === closingWeld) return steps;
    at = arriving.pieceId;
    enteredBy = next;
  }
  return null;
}
