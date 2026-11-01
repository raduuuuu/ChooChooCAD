/**
 * EVERY VERDICT, BEFORE AND AFTER A SOLVER CHANGE (plan 2026-11-01, D5, eng X4).
 *
 *   bun scripts/verdictDiff.ts dump <out.json>          on each checkout
 *   bun scripts/verdictDiff.ts compare <before> <after>  lists every change
 *
 * A solver change can move verdicts the tests do not pin: more budget lets a
 * borderline refinement finish, and an accounting fix changes what later
 * loops get. This classifies a fixed corpus exactly as the screen does
 * (`viewOf`, the same placement and segments App hands `solveGraph`), and
 * `compare` exits 1 if any layout leaves "works" (EXACT or NEEDS_GIVE) for
 * anything else, including "could not check" (BEND_UNCHECKED).
 *
 * The corpus, all deterministic:
 * - the 600 seeded chains of engine/test/differential.test.ts (same seed, same parts)
 * - the 60 seeded ramp loops of engine/test/levels.test.ts
 * - the three presets
 * - the owner's interlocked layout at each of its 0 to 6 joined stages
 *
 * It uses only functions that exist before and after the change, so the same
 * file runs on main (copied into a worktree) and on the branch.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILT_IN, makeResolver } from '../engine/data/library.js';
import { brandFit } from '../engine/data/thirdParty.js';
import { placeAll } from '../engine/src/graph/frames.js';
import { graphFromChain } from '../engine/src/graph/fromChain.js';
import { portsOf, type Frame, type Graph, type Piece, type Weld } from '../engine/src/graph/model.js';
import { renderGraph } from '../engine/src/graph/render.js';
import { solveGraph } from '../engine/src/graph/solve.js';
import type { Layout, Turn } from '../engine/src/parts/schema.js';
import { PRESETS, presetLayout } from '../app/src/presets.js';
import { viewOf } from '../app/src/verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

function verdict(g: Graph): string {
  const placement = placeAll(g, ports);
  const render = renderGraph(g, ports, resolve, placement);
  const slop = new Map(g.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const r = solveGraph(g, ports, resolve, (id: string) => slop.get(id) ?? 0, placement, { parts: BUILT_IN, brandFit }, render.segments);
  return viewOf(r).kind;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function corpus(): Array<[string, Graph]> {
  const out: Array<[string, Graph]> = [];
  // differential.test.ts: flat two-ended BRIO parts, seed 20261010, 600 chains.
  const BRIO = BUILT_IN.filter(
    (p) => p.brand === 'BRIO' && (p.kind === 'straight' || p.kind === 'curve') && !(p.kind === 'straight' && p.rise),
  ).map((p) => p.id);
  const rand = lcg(20261010);
  for (let i = 0; i < 600; i++) {
    const n = 1 + Math.floor(rand() * 12);
    const placements = Array.from({ length: n }, () => ({
      partId: BRIO[Math.floor(rand() * BRIO.length)]!,
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
  const fx = JSON.parse(readFileSync(join(import.meta.dir, '..', 'engine', 'test', 'fixtures', 'owner-interlocked.json'), 'utf8'));
  const anchors = new Map<string, Frame>(
    fx.base.anchors.map(([id, f]: [string, { pos: number[]; heading: number; level?: number }]) => [id, f as unknown as Frame]),
  );
  for (let k = 0; k <= fx.joins.length; k++) {
    out.push([`owner +${k}`, { pieces: fx.base.pieces, welds: [...fx.base.welds, ...fx.joins.slice(0, k)], anchors }]);
  }
  return out;
}

const WORKS = new Set(['EXACT', 'NEEDS_GIVE']);
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'dump' && a) {
  const t0 = performance.now();
  const rows = Object.fromEntries(corpus().map(([name, g]) => [name, verdict(g)]));
  writeFileSync(a, JSON.stringify(rows, null, 1) + '\n');
  console.log(`${Object.keys(rows).length} verdicts in ${(performance.now() - t0).toFixed(0)}ms -> ${a}`);
} else if (cmd === 'compare' && a && b) {
  const before: Record<string, string> = JSON.parse(readFileSync(a, 'utf8'));
  const after: Record<string, string> = JSON.parse(readFileSync(b, 'utf8'));
  const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
  const worse = changed.filter((k) => WORKS.has(before[k]!) && !WORKS.has(after[k]!));
  console.log(`| layout | before | after |\n|---|---|---|`);
  for (const k of changed) console.log(`| ${k} | ${before[k]} | ${after[k]} |`);
  console.log(`\n${Object.keys(before).length} layouts, ${changed.length} changed, ${worse.length} left "works".`);
  if (worse.length > 0) process.exit(1);
} else {
  console.error('usage: bun scripts/verdictDiff.ts dump <out.json> | compare <before.json> <after.json>');
  process.exit(2);
}
