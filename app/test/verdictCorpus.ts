/**
 * THE VERDICT CORPUS (plan 2026-11-01, D5, eng X4): 670 fixed layouts, all
 * deterministic, read by scripts/verdictDiff.ts (every verdict before and
 * after a solver change) and by the swap differential (decorated-pieces T6).
 *
 * - the 600 seeded chains of engine/test/differential.test.ts (same seed, same parts)
 * - the 60 seeded ramp loops of engine/test/levels.test.ts
 * - the three presets
 * - the owner's interlocked layout at each of its 0 to 6 joined stages
 *
 * It uses only functions that exist before and after a change, so copying it
 * beside the script into a worktree of main dumps main's verdicts.
 */

import { readFileSync } from 'node:fs';
import { BUILT_IN, isStructure } from '../../engine/data/library.js';
import { graphFromChain } from '../../engine/src/graph/fromChain.js';
import type { Frame, Graph, Piece, Weld } from '../../engine/src/graph/model.js';
import type { Layout, Turn } from '../../engine/src/parts/schema.js';
import { PRESETS, presetLayout } from '../src/presets.js';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

export function corpus(): Array<[string, Graph]> {
  const out: Array<[string, Graph]> = [];
  // differential.test.ts: flat two-ended Generic parts, seed 20261010, 600 chains.
  const Generic = BUILT_IN.filter(
    (p) => p.brand === 'GENERIC' && (p.kind === 'straight' || p.kind === 'curve') && !(p.kind === 'straight' && p.rise) && !isStructure(p) && p.decoratedFrom === undefined,
  ).map((p) => p.id);
  const rand = lcg(20261010);
  for (let i = 0; i < 600; i++) {
    const n = 1 + Math.floor(rand() * 12);
    const placements = Array.from({ length: n }, () => ({
      partId: Generic[Math.floor(rand() * Generic.length)]!,
      turn: (rand() < 0.5 ? 'left' : 'right') as Turn,
    }));
    const layout: Layout = { placements, closed: rand() < 0.7 };
    out.push([`chain ${i}`, graphFromChain(layout)]);
  }
  // levels.test.ts: seeded ramp loops, seed 20261023, 60 runs.
  const r2 = lcg(20261023);
  for (let n = 0; n < 60; n++) {
    const len = 4 + Math.floor(r2() * 10);
    const parts = Array.from({ length: len }, () => {
      const r = r2();
      if (r < 0.2) return ['N', 'left', 0] as const;
      if (r < 0.4) return ['N', 'left', 1] as const;
      if (r < 0.6) return ['D', 'left', 0] as const;
      return ['E', r2() < 0.5 ? 'left' : 'right', 0] as const;
    });
    const pieces: Piece[] = parts.map(([partId, turn], i) => ({ pieceId: `p${i}`, partId, turn }));
    const welds: Weld[] = parts.map((_, i) => {
      const j = (i + 1) % parts.length;
      return { a: { pieceId: `p${i}`, port: 1 - parts[i]![2] }, b: { pieceId: `p${j}`, port: parts[j]![2] } };
    });
    out.push([`ramp loop ${n}`, { pieces, welds }]);
  }
  for (const p of PRESETS) out.push([`preset ${p.label}`, graphFromChain(presetLayout(p))]);
  // The owner's layout, joined a pair at a time.
  const fx = JSON.parse(readFileSync(new URL('../../engine/test/fixtures/owner-interlocked.json', import.meta.url), 'utf8'));
  const anchors = new Map<string, Frame>(
    fx.base.anchors.map(([id, f]: [string, { pos: number[]; heading: number; level?: number }]) => [id, f as unknown as Frame]),
  );
  for (let k = 0; k <= fx.joins.length; k++) {
    out.push([`owner +${k}`, { pieces: fx.base.pieces, welds: [...fx.base.welds, ...fx.joins.slice(0, k)], anchors }]);
  }
  return out;
}
