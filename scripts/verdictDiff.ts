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
 * The corpus is app/test/verdictCorpus.ts, 670 deterministic layouts. It
 * uses only functions that exist before and after the change, so this file
 * and that one run on main (copied into a worktree) and on the branch.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { BUILT_IN, makeResolver } from '../engine/data/library.js';
import { brandFit } from '../engine/data/thirdParty.js';
import { placeAll } from '../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../engine/src/graph/model.js';
import { renderGraph } from '../engine/src/graph/render.js';
import { solveGraph } from '../engine/src/graph/solve.js';
import { viewOf } from '../app/src/verdictView.js';
import { corpus } from '../app/test/verdictCorpus.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

function verdict(g: Graph): string {
  const placement = placeAll(g, ports);
  const render = renderGraph(g, ports, resolve, placement);
  const slop = new Map(g.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const r = solveGraph(g, ports, resolve, (id: string) => slop.get(id) ?? 0, placement, { parts: BUILT_IN, brandFit }, render.segments, render.bodies);
  return viewOf(r).kind;
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
