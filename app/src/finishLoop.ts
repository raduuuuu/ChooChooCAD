/**
 * FINISH THE LOOP: THE FILLS WORTH SHOWING (plan 2026-11-14, E3; eng review
 * 2026-11-14, docs/plan/2026-11-14-additions-eng.md).
 *
 * `engine/src/graph/fill.ts` lists runs of plain pieces that land exactly on
 * the far end. Landing is not working: the pieces might lie across other
 * track, or leave a loop that was fine worse off. This puts each candidate
 * down on a copy of the layout and asks the same solver the verdict asks.
 * Only what passes is ever returned.
 *
 *   gapFills (engine)            applyFill               solveGraph            keep?
 *   candidate, exact landing ─▶  the layout with it ─▶   the verdict's own ─▶  rules 1-5 ─▶ a Fill
 *        │ shortest first             │ ONE function,         check                 │ no: dropped,
 *        │ streamed                   │ also what the                               ▼ never shown
 *        ▼ stop at three kept         ▼ `fill` action applies
 *
 * ONE TRANSACTION FOR THE CHECK AND FOR APPLYING (eng review, finding 1).
 * `applyFill` builds the layout the check judges, and the reducer's `fill`
 * action calls the same function, so what was checked is what is placed.
 * It breaks the closing weld first when the fill replaces one, and puts each
 * piece on by the exact end and turn the search chose: `addPiece`'s own
 * choice of orientation is not asked.
 *
 * WHAT A KEPT FILL HAS PASSED (finding 3: said rule by rule, because the
 * screen's one verdict for the whole layout cannot say "this loop is fine"):
 *   1. every loop the fill is part of closes exactly;
 *   2. no end or plank of a fill piece lies on other track;
 *   3. a layout that worked before still works with it;
 *   4. it brings in no track system that does not join what is on the table;
 *   5. the box covers the whole layout with it, and it needs no more adapters.
 * Rule 4 and the box half of rule 5 are enforced before the search (the
 * pieces offered to it); the rest are read off the solver's result.
 *
 * BOUNDED BY SOLVES (finding 5). A full check of a large layout can take most
 * of half a second (`engine/src/graph/bendRun.ts`), so the bound that matters
 * is how many are run: `MAX_FILL_CHECKS`. Past it, or past the search's own
 * work allowance, the answer says it ran out. It never says "nothing fits"
 * for a search it did not finish.
 *
 * No React here, so the tests need no DOM.
 */

import { isZero } from '../../engine/src/geom/cyclotomic.js';
import { removeWeld } from '../../engine/src/graph/edit.js';
import { connectorSites, findVertexClashes } from '../../engine/src/graph/feasible.js';
import {
  FILL_BUDGET,
  gapFills,
  isFillPart,
  MAX_FILL_PIECES,
  type FillPiece,
  type FillWork,
} from '../../engine/src/graph/fill.js';
import { placeAll, type PortsOf } from '../../engine/src/graph/frames.js';
import type { Graph, PortRef } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph, type GraphResult } from '../../engine/src/graph/solve.js';
import type { BrandFitLookup } from '../../engine/src/joints/trust.js';
import { trustRank, type Part } from '../../engine/src/parts/schema.js';
import { usedCounts, type Inventory } from './inventoryModel.js';
import { applyFill, weldBetween, type FillPlan } from './layoutModel.js';

export { applyFill, MAX_FILL_PIECES, weldBetween, type FillPlan };

/** How many candidate fills are given the full check before the search stops (finding 5). */
export const MAX_FILL_CHECKS = 6;
/** How many fills are offered. */
export const MAX_FILLS_SHOWN = 3;

/** A fill that passed every rule, with the layout that was checked. */
export interface Fill extends FillPlan {
  /** The layout with the fill in it: the very graph the solver judged. */
  readonly graph: Graph;
  /** The ids the new pieces were given. */
  readonly pieceIds: readonly string[];
}

export type FillAnswer =
  /** `complete` false: the work ran out after these were found, so there may be others. */
  | { readonly status: 'found'; readonly fills: readonly Fill[]; readonly complete: boolean }
  /** The whole search ran and nothing passed. */
  | { readonly status: 'none' }
  /** The work ran out before anything passed. Not the same as none. */
  | { readonly status: 'out of work' }
  | { readonly status: 'refused'; readonly why: 'levels' | 'not free' | 'same end' };

const sameRef = (a: PortRef, b: PortRef) => a.pieceId === b.pieceId && a.port === b.port;

export interface FillRequest {
  readonly graph: Graph;
  readonly ports: PortsOf;
  readonly resolve: (id: string) => Part;
  /** Every part that could be suggested: the library as the user has it. */
  readonly parts: readonly Part[];
  readonly brandFit: BrandFitLookup;
  readonly inventory: Inventory;
  readonly from: PortRef;
  readonly to: PortRef;
}

function solve(req: FillRequest, graph: Graph): GraphResult {
  const placement = placeAll(graph, req.ports);
  const render = renderGraph(graph, req.ports, req.resolve, placement);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, req.resolve(p.partId).slop.axialMm]));
  return solveGraph(
    graph,
    req.ports,
    req.resolve,
    (id: string) => slop.get(id) ?? 0,
    placement,
    { parts: req.parts, brandFit: req.brandFit },
    render.segments,
    render.bodies,
  );
}

const works = (r: GraphResult): boolean => r.ok && r.withinBound;

/** Rules 1, 2, 3 and the adapter half of 5, read off the solver's answer for the layout with the fill in it. */
function keeps(before: GraphResult, after: GraphResult, pieceIds: readonly string[]): boolean {
  const mine = new Set(pieceIds);
  // 2. Nothing of the fill lies on other track.
  if (after.clashes.some((c) => mine.has(c.a.pieceId) || mine.has(c.b.pieceId))) return false;
  if (after.overlaps.some((o) => mine.has(o.a) || mine.has(o.b))) return false;
  if (after.levelMismatches.length > before.levelMismatches.length) return false;
  if (after.polarityViolations.length > before.polarityViolations.length) return false;
  // 5. It needs no more adapters than the layout already did.
  if (after.adapterJoints.length > before.adapterJoints.length) return false;
  if (!after.ok) {
    // Two runs joined into one longer run make no loop, and that is a fine thing to have done.
    return after.reason === 'NO_CYCLE';
  }
  // 1. Every loop the fill is part of closes exactly.
  for (const cycle of after.cycles) {
    if (!cycle.pieces.some((id) => mine.has(id))) continue;
    if (!isZero(cycle.gap)) return false;
  }
  // 3. What worked before still works.
  if (works(before) && !works(after)) return false;
  return true;
}

/** A fill's pieces as a multiset: two orders of the same straights are one suggestion. */
const multisetKey = (pieces: readonly FillPiece[]) => pieces.map((p) => p.partId).sort().join('+');

/**
 * The fills worth showing between two ends, fewest pieces first.
 *
 * `from` and `to` are either two free ends, or the two ends of a weld that
 * does not meet (the closing joint of a loop that misses), in which case the
 * fill takes that weld's place.
 */
export function findFills(req: FillRequest, work: FillWork = { left: FILL_BUDGET }): FillAnswer {
  const { graph, ports, from, to } = req;
  if (sameRef(from, to)) return { status: 'refused', why: 'same end' };

  const weld = weldBetween(graph, from, to);
  const replacesWeld = weld !== -1;
  // The layout the pieces go into: with the weld that does not meet taken out.
  const open = replacesWeld ? removeWeld(graph, ports, weld) : graph;
  const sites = connectorSites(open, ports, placeAll(open, ports));
  const endAt = (r: PortRef) => sites.placed.find((p) => p.pieceId === r.pieceId && p.port === r.port);
  const a = endAt(from);
  const b = endAt(to);
  if (!a || !b || !a.free || !b.free) return { status: 'refused', why: 'not free' };
  if (a.level !== b.level) return { status: 'refused', why: 'levels' };

  // 4. Only pieces of a system that joins everything on the table, the surest sizes first.
  const brands = new Set(graph.pieces.map((p) => req.resolve(p.partId).brand));
  const parts = req.parts
    .filter(isFillPart)
    .filter((p) => [...brands].every((brand) => req.brandFit(p.brand, brand).fit === 'joins'))
    .sort((x, y) => trustRank(x.dimensions.status) - trustRank(y.dimensions.status));

  // 5. The box covers the WHOLE layout with the fill: what is left after what is already down.
  const used = usedCounts(graph.pieces.map((p) => p.partId));
  const stock = (partId: string): number =>
    req.inventory === null ? Infinity : (req.inventory[partId] ?? 0) - (used[partId] ?? 0);

  const before = solve(req, graph);
  const fills: Fill[] = [];
  const shown = new Set<string>();
  let checks = 0;
  let ranOut = false;

  const search = gapFills(a, b, parts, stock, work);
  for (;;) {
    const next = search.next();
    if (next.done) {
      ranOut = next.value === 'out of work';
      break;
    }
    const pieces = next.value;
    const key = multisetKey(pieces);
    if (shown.has(key)) continue;
    const plan: FillPlan = { from, to, replacesWeld, pieces };
    const applied = applyFill(graph, ports, plan);
    if (applied === null) continue;
    // The cheap exact test first: an end of the fill sitting on another end costs no solve to see.
    const mine = new Set(applied.pieceIds);
    const placement = placeAll(applied.graph, ports);
    if (findVertexClashes(applied.graph, ports, placement).some((c) => mine.has(c.a.pieceId) || mine.has(c.b.pieceId))) {
      continue;
    }
    if (checks >= MAX_FILL_CHECKS) {
      ranOut = true;
      break;
    }
    checks += 1;
    if (!keeps(before, solve(req, applied.graph), applied.pieceIds)) continue;
    shown.add(key);
    fills.push({ ...plan, graph: applied.graph, pieceIds: applied.pieceIds });
    if (fills.length >= MAX_FILLS_SHOWN) break;
  }

  if (fills.length > 0) return { status: 'found', fills, complete: !ranOut };
  return ranOut ? { status: 'out of work' } : { status: 'none' };
}
