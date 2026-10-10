/**
 * The app's bridge to the graph engine.
 *
 * The UI still builds a single ordered chain: the palette appends, and there
 * is no way to declare a branch. So every graph it can produce has rank 0 or
 * 1, and reducing a `GraphResult` to the `SolveResult` shape `VerdictLine`
 * already speaks loses NOTHING THAT THE UI CAN CURRENTLY EXPRESS. That is the
 * precise claim, and it stops being true the moment the editor can build a
 * branch, which is when `VerdictLine` has to learn to show per-cycle figures
 * and this file goes away.
 *
 * Pointing the app here rather than at `solveLayout` is safe because the two
 * engines are held to exact agreement: `differential.test.ts` runs 600
 * enumerated layouts through both and requires the same gap, the same
 * closure and the same user-visible verdict.
 *
 * The chain engine is NOT deleted. It is still the reference the harness
 * compares against, and deleting it would delete the evidence that this one
 * is right.
 */

import { graphFromChain } from '../../engine/src/graph/fromChain.js';
import { portsOf, type Piece, type Port } from '../../engine/src/graph/model.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import type { Layout, Part } from '../../engine/src/parts/schema.js';
import type { SolveResult } from '../../engine/src/solver/result.js';

export function solveViaGraph(layout: Layout, resolve: (id: string) => Part): SolveResult {
  const graph = graphFromChain(layout);
  const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
  const slop = (pieceId: string): number => {
    const index = Number(pieceId.slice(1));
    const placement = layout.placements[index];
    return placement ? resolve(placement.partId).slop.axialMm : 0;
  };

  const r = solveGraph(graph, ports, resolve, slop);

  if (!r.ok) {
    // TOO_MANY_LOOPS cannot arise from a chain, whose rank is at most 1. It
    // is mapped rather than ignored so that the day the editor can build one,
    // this reports something true instead of falling through to NUMERIC.
    const reason = r.reason === 'TOO_MANY_LOOPS' ? 'NUMERIC' : r.reason;
    return { ok: false, reason, detail: r.detail };
  }

  return {
    ok: true,
    closesExactly: r.closesExactly,
    gapMm: r.gapMm,
    totalGiveMm: r.totalGiveMm,
    withinBound: r.withinBound,
    // Joint-level reporting is not rebuilt here. The per-joint verdict was
    // deleted at R21 and nothing in the UI reads this; `jointCount` in the
    // verdict copy comes from the length alone.
    joints: graph.welds.map((w, index) => ({
      index,
      at: [0, 0] as [number, number],
      between: [
        layout.placements[Number(w.a.pieceId.slice(1))]?.partId ?? '',
        layout.placements[Number(w.b.pieceId.slice(1))]?.partId ?? '',
      ] as readonly [string, string],
      axialMaxMm: 0,
      angularMaxDeg: 0,
    })),
    clashes: r.clashes.map((c) => ({
      a: Number(c.a.pieceId.slice(1)),
      b: Number(c.b.pieceId.slice(1)),
      at: c.at,
    })),
    polarityViolations: r.polarityViolations.map((v) => ({
      jointIndex: v.weld,
      between: v.between,
      polarity: v.polarity,
    })),
  };
}
