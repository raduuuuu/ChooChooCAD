/**
 * THE ORDER TO BUILD A LAYOUT IN, piece by piece (K3's assembly order, the
 * last thing the 3D viewer, build mode and the printable sheet wait on).
 *
 * Two rules come from the plan, and both are about wood that has to be there
 * before other wood can go on it:
 *
 * - UNDER BEFORE OVER. Floor track that a bridge passes over goes down before
 *   the bridge: reaching under a raised deck to clip a straight in is how a
 *   deck gets knocked off.
 * - NOTHING RAISED BEFORE WHAT HOLDS IT UP. A ramp goes down before the raised
 *   track that leaves its top, and raised track grows out from a ramp rather
 *   than starting in mid-air.
 *
 * HOW. Every piece falls in a BAND by the levels its wood spans: the floor,
 * then ramps leaving the floor, then the first raised level, then ramps above
 * it, and so on. Bands go down in that order, which is the first rule by
 * construction: a bridge is two planks on different levels (`findBridges`),
 * and a ramp spans both levels so it never forms one. Inside a band the order
 * WALKS THE TRACK, depth first along welds in declaration order, the way the
 * spanning forest walks it, so each piece clips onto the one before it. A new
 * walk starts first at a piece joined to something already down (a ramp at
 * the end of the floor, raised track at the top of a ramp), which is the
 * second rule, and only then at a piece joined to nothing yet.
 *
 * Supports are not modelled (TODO "Support and pier modelling"), so nothing
 * here says where a pier goes. When they are, they join the band below the
 * deck they hold.
 *
 * Linear in pieces and welds: a layout of tens of thousands of loose pieces is
 * a supported size (TODO "Nothing bounds a layout's size"), so every piece is
 * looked at a fixed number of times rather than once per run.
 */

import type { Segment } from '../geom/fk.js';
import { spanningForest } from './forest.js';
import type { Graph } from './model.js';

export type AssemblyPhase = 'floor' | 'ramp' | 'raised';

export interface AssemblyStep {
  readonly pieceId: string;
  readonly partId: string;
  readonly phase: AssemblyPhase;
  /** The lowest level the piece's wood touches: 0 on the floor. */
  readonly level: number;
  /**
   * Pieces already down that this one clips onto, in weld order. Empty when
   * it starts a run of its own.
   */
  readonly joins: readonly string[];
}

/** A band per level span: the floor 0, a ramp up from it 1, level one 2, ... */
function bandOf(lo: number, hi: number): number {
  return lo === hi ? 2 * lo : 2 * lo + 1;
}

export function assemblyOrder(graph: Graph, segments: readonly Segment[]): readonly AssemblyStep[] {
  // The levels each piece's wood spans, read the way `findBridges` reads them.
  const span = new Map<string, readonly [number, number]>();
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    const a = s.level ?? 0;
    const b = a + (s.rise ?? 0);
    span.set(s.pieceId, [Math.min(a, b), Math.max(a, b)]);
  }
  const lo = (id: string) => span.get(id)?.[0] ?? 0;
  const hi = (id: string) => span.get(id)?.[1] ?? 0;
  const band = (id: string) => bandOf(lo(id), hi(id));

  const adjacency = new Map<string, string[]>();
  for (const p of graph.pieces) adjacency.set(p.pieceId, []);
  for (const w of graph.welds) {
    // A piece welded to itself clips onto nothing else.
    if (w.a.pieceId === w.b.pieceId) continue;
    adjacency.get(w.a.pieceId)?.push(w.b.pieceId);
    adjacency.get(w.b.pieceId)?.push(w.a.pieceId);
  }

  // Forest order, so the walk and the solver agree on which way round a run goes.
  const byBand = new Map<number, string[]>();
  for (const id of spanningForest(graph).order) {
    const members = byBand.get(band(id));
    if (members) members.push(id);
    else byBand.set(band(id), [id]);
  }
  const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));

  const down = new Set<string>();
  const steps: AssemblyStep[] = [];
  const lay = (id: string) => {
    down.add(id);
    const joins = [...new Set((adjacency.get(id) ?? []).filter((o) => down.has(o) && o !== id))];
    steps.push({
      pieceId: id,
      partId: partOf.get(id)!,
      phase: lo(id) !== hi(id) ? 'ramp' : lo(id) === 0 ? 'floor' : 'raised',
      level: lo(id),
      joins,
    });
  };

  for (const b of [...byBand.keys()].sort((x, y) => x - y)) {
    const members = byBand.get(b)!;
    // Every lower band is already down, so "joined to something down" is
    // known now, before this band starts: those pieces are tried first.
    const attached = members.filter((id) => (adjacency.get(id) ?? []).some((o) => down.has(o)));
    for (const start of [...attached, ...members]) {
      if (down.has(start)) continue;
      const stack = [start];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (down.has(id)) continue;
        lay(id);
        const next = adjacency.get(id) ?? [];
        // Reversed, so the first-declared weld is the first one followed.
        for (let i = next.length - 1; i >= 0; i--) {
          const o = next[i]!;
          if (!down.has(o) && band(o) === b) stack.push(o);
        }
      }
    }
  }
  return steps;
}
