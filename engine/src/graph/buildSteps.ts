/**
 * THE BUILD, AS ONE LIST (build mode plan, docs/plan/2026-10-31-build-mode.md).
 *
 * Build mode and the printable sheet both render this list and nothing else,
 * so the order, the band changes, which step closes a loop and what each step
 * has to say are decided once, here, where node tests reach them (eng review
 * design-twice, Shape A).
 *
 *   pull ─▶ piece 1 … ─▶ band card ─▶ piece … ─▶ … ─▶ last
 *
 * - ORDER is `assemblyOrder`: floor, then ramps, then raised track, every
 *   piece clipping onto one already down where it can.
 * - A BAND CARD comes before the first piece of every band after the first
 *   (E4). Bands are `bandOf`'s, not phases: two raised levels are two bands.
 * - A STEP CLOSES A LOOP when one of its welds links two ends already in the
 *   same group of pieces down. A union-find over welds decides it, not
 *   `joins`: joins counts pieces once, so a piece welded twice to one
 *   neighbour closes a loop on one join, and a piece bridging two separate
 *   groups has two joins and closes nothing.
 * - THE RUN NOTE sits at the step that closes the run's LAST loop, when the
 *   whole run is down to judge (D15): bend results are per run of track,
 *   solved together, never per loop. The note is data; the screen and the
 *   sheet put it in the verdict's own words (D14).
 * - AN ADAPTER STEP is one that seats a socket-to-socket joint (D16).
 */

import { assemblyOrder, bandOf, type AssemblyPhase, type AssemblyStep } from './assembly.js';
import type { RunBend } from './bendRun.js';
import type { Segment } from '../geom/fk.js';
import type { Graph, PortRef } from './model.js';
import type { GraphResult } from './solve.js';

type Ok = Extract<GraphResult, { ok: true }>;
type Failed = Extract<GraphResult, { ok: false }>;

/** The parts of the verdict a build reads. Either branch of `solveGraph`'s result fits. */
export type BuildVerdict =
  | Pick<Ok, 'ok' | 'bend' | 'adapterJoints'>
  | Pick<Failed, 'ok' | 'detail' | 'adapterJoints'>;

/** What the run a step completes needs said about it. */
export type RunNote =
  /** Closes, with its joints bending a little (D7). */
  | { readonly kind: 'bends'; readonly run: RunBend }
  /** Needs more bend than the joints give: the verdict's own sentence (D14). */
  | { readonly kind: 'beyond'; readonly run: RunBend }
  /** No verdict: the solver could not settle it (D52). `reason` is the result's detail or the run's own, when there is one. */
  | { readonly kind: 'unchecked'; readonly reason: string | null };

export type BuildItem =
  | { readonly kind: 'pull' }
  | {
      readonly kind: 'band';
      /** The band starting now, as `bandOf` numbers it. */
      readonly band: number;
      readonly phase: AssemblyPhase;
      /** The lowest level the band's wood touches. */
      readonly level: number;
    }
  | {
      readonly kind: 'piece';
      /** 1-based, counting pieces only: "Step n of N". */
      readonly step: number;
      readonly pieceId: string;
      readonly partId: string;
      readonly band: number;
      readonly phase: AssemblyPhase;
      /** The ends already down that this piece clips onto, one per weld (E2's rings). */
      readonly onto: readonly PortRef[];
      /** It seats a socket-to-socket joint: a male-male adapter goes in first (D16). */
      readonly adapter: boolean;
      /** Set on the step that closes its run's last loop, when the run has something to say. */
      readonly note: RunNote | null;
    }
  | { readonly kind: 'last'; readonly pieces: number };

/** `assemblyOrder`'s band for a step, read back from its phase and level. */
export function bandOfStep(s: Pick<AssemblyStep, 'phase' | 'level'>): number {
  return s.phase === 'ramp' ? bandOf(s.level, s.level + 1) : bandOf(s.level, s.level);
}

/** Union-find over piece ids, with path halving. */
function groups() {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    for (;;) {
      const p = parent.get(r) ?? r;
      if (p === r) return r;
      const gp = parent.get(p) ?? p;
      parent.set(r, gp);
      r = gp;
    }
  };
  return { find, union: (a: string, b: string) => parent.set(find(a), find(b)) };
}

/** Each piece's welds, by index into `graph.welds`; a self-weld is listed once. */
function weldsByPiece(graph: Graph): Map<string, number[]> {
  const byPiece = new Map<string, number[]>();
  const add = (id: string, i: number) => {
    const list = byPiece.get(id);
    if (list) list.push(i);
    else byPiece.set(id, [i]);
  };
  graph.welds.forEach((w, i) => {
    add(w.a.pieceId, i);
    if (w.b.pieceId !== w.a.pieceId) add(w.b.pieceId, i);
  });
  return byPiece;
}

/**
 * The steps (indices into `order`) that close their run's last loop. A run's
 * loops number its welds minus its pieces plus one; the step that brings the
 * closing count to that number is the one.
 */
export function lastClosers(graph: Graph, order: readonly Pick<AssemblyStep, 'pieceId'>[], byPiece = weldsByPiece(graph)): Set<number> {
  const run = groups();
  for (const w of graph.welds) run.union(w.a.pieceId, w.b.pieceId);
  const loopsLeft = new Map<string, number>();
  for (const p of graph.pieces) loopsLeft.set(run.find(p.pieceId), (loopsLeft.get(run.find(p.pieceId)) ?? 1) - 1);
  for (const w of graph.welds) {
    const r = run.find(w.a.pieceId);
    loopsLeft.set(r, (loopsLeft.get(r) ?? 0) + 1);
  }

  const down = new Set<string>();
  const built = groups();
  const closers = new Set<number>();
  order.forEach((s, i) => {
    down.add(s.pieceId);
    for (const wi of byPiece.get(s.pieceId) ?? []) {
      const w = graph.welds[wi]!;
      const other = w.a.pieceId === s.pieceId ? w.b.pieceId : w.a.pieceId;
      if (!down.has(other)) continue;
      // A self-weld meets itself here once, which is right: it closes a loop.
      if (built.find(s.pieceId) === built.find(other)) {
        const r = run.find(s.pieceId);
        const left = (loopsLeft.get(r) ?? 0) - 1;
        loopsLeft.set(r, left);
        if (left === 0) closers.add(i);
      } else built.union(s.pieceId, other);
    }
  });
  return closers;
}

/** What to say about the run holding `pieceId`, once its last loop is closed. */
function noteFor(pieceId: string, verdict: BuildVerdict): RunNote | null {
  if (!verdict.ok) return { kind: 'unchecked', reason: verdict.detail || null };
  const run = verdict.bend.find((b) => b.pieces.includes(pieceId));
  if (!run || run.status === 'unchecked') return { kind: 'unchecked', reason: run?.why ?? null };
  if (run.status === 'beyond') return { kind: 'beyond', run };
  if (run.status === 'closes' && (run.lambda ?? 0) > 0) return { kind: 'bends', run };
  return null;
}

export function buildSteps(graph: Graph, segments: readonly Segment[], verdict: BuildVerdict): readonly BuildItem[] {
  const order = assemblyOrder(graph, segments);
  const byPiece = weldsByPiece(graph);
  const closers = lastClosers(graph, order, byPiece);
  const adapterWelds = new Set(verdict.adapterJoints.map((j) => j.weld));

  const items: BuildItem[] = [{ kind: 'pull' }];
  const down = new Set<string>();
  let band: number | null = null;
  order.forEach((s, i) => {
    const b = bandOfStep(s);
    if (band !== null && b !== band) items.push({ kind: 'band', band: b, phase: s.phase, level: s.level });
    band = b;

    down.add(s.pieceId);
    const onto: PortRef[] = [];
    let adapter = false;
    for (const wi of byPiece.get(s.pieceId) ?? []) {
      const w = graph.welds[wi]!;
      // A piece welded to itself clips onto nothing else (as in assembly.ts).
      if (w.a.pieceId === w.b.pieceId) continue;
      const other = w.a.pieceId === s.pieceId ? w.b : w.a;
      if (!down.has(other.pieceId)) continue;
      onto.push(other);
      if (adapterWelds.has(wi)) adapter = true;
    }

    items.push({
      kind: 'piece',
      step: i + 1,
      pieceId: s.pieceId,
      partId: s.partId,
      band: b,
      phase: s.phase,
      onto,
      adapter,
      note: closers.has(i) ? noteFor(s.pieceId, verdict) : null,
    });
  });
  items.push({ kind: 'last', pieces: order.length });
  return items;
}
