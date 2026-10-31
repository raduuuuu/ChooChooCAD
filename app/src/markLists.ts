/**
 * WHICH VERDICT MARKS ARE DRAWN, IN 2D AND IN 3D, DECIDED IN ONE PLACE
 * (3D plan, eng E6/D24 and O2/D26, 2026-10-31).
 *
 * These rules lived in five `App.tsx` memos that ended in bare `[x, y]`
 * points, so nothing downstream knew which joint or piece a mark was about,
 * and the hiding rule ("a red mark holds the spot") compared floor positions
 * only. Both are fine on a flat canvas. The 3D view needs each mark's record
 * to place it on its level (eng D21), and must not let a clash on the floor
 * hide a fault on the deck above it (eng D26).
 *
 * So the memos' logic moved here unchanged and returns two lists:
 *
 * - `canvas`: exactly what the 2D canvas drew before, the same points in the
 *   same order, hidden by floor position as before; the existing mark specs
 *   are its regression check.
 * - `scene`: every mark with its source, hidden only where a red mark holds
 *   the same spot ON THE SAME LEVEL.
 */

import type { WeldResidual, LevelMismatch, ThirdLevel } from '../../engine/src/graph/frames.js';
import type { AdapterJoint, VertexClash, WeldPolarityViolation } from '../../engine/src/graph/feasible.js';
import type { Weld } from '../../engine/src/graph/model.js';
import type { PlankOverlap } from '../../engine/src/graph/overlap.js';
import type { RenderedPort } from '../../engine/src/graph/render.js';
import type { MarkInput } from '../../engine/src/view3d/mesh.js';
import { badJointMarks, gapMarks, type GapMark } from './trackPath.js';

/** The parts of a solve the marks come from. */
export interface MarkFacts {
  /** Closing joints' residuals, with any run drawn bent already left out (App's `shifts`). */
  readonly residuals: readonly WeldResidual[];
  readonly clashes: readonly VertexClash[];
  readonly overlaps: readonly PlankOverlap[];
  readonly polarityViolations: readonly WeldPolarityViolation[];
  readonly adapterJoints: readonly AdapterJoint[];
  readonly levelMismatches: readonly LevelMismatch[];
  readonly thirdLevels: readonly ThirdLevel[];
}

type Pt = readonly [number, number];

export interface CanvasMarks {
  readonly gaps: readonly GapMark[];
  /** Clash and overlap positions, the red rings. */
  readonly clashes: readonly (VertexClash | PlankOverlap)[];
  readonly badJoints: readonly Pt[];
  readonly badJointsHidden: number;
  readonly adapters: readonly Pt[];
  readonly levelMismatches: readonly Pt[];
  readonly thirdLevels: readonly Pt[];
  readonly levelHidden: number;
}

export interface MarkLists {
  readonly canvas: CanvasMarks;
  readonly scene: readonly MarkInput[];
}

const same = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;

/**
 * Both lists. `drawable` is false above the canvas's drawing ceiling: then, as
 * before, only gaps and clash rings are listed, since the lookups below run
 * over every end in the layout.
 */
export function markLists(facts: MarkFacts, welds: readonly Weld[], ports: readonly RenderedPort[], drawable = true): MarkLists {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  const portOf = (r: { pieceId: string; port: number }) => byPort.get(`${r.pieceId}#${r.port}`);
  const levelOfPort = (r: { pieceId: string; port: number }) => portOf(r)?.level ?? 0;
  /** The levels a piece's ends touch, for an overlap: a ramp touches two. */
  const levelsOfPiece = (pieceId: string): readonly number[] => [
    ...new Set(ports.filter((p) => p.pieceId === pieceId).map((p) => p.level ?? 0)),
  ];

  // ---- 2D, as the memos had it ----
  const gaps = gapMarks(facts.residuals, welds, ports);
  const clashes = [...facts.clashes, ...facts.overlaps];
  const clashAt = clashes.map((c) => c.at);
  const refused = drawable
    ? badJointMarks(facts.polarityViolations.map((v) => v.weld), welds, ports, clashAt)
    : { marks: [], hidden: 0 };
  const red = [...refused.marks, ...clashAt];
  const adapters: Pt[] = !drawable
    ? []
    : facts.adapterJoints.flatMap((j) => {
        const w = welds[j.weld];
        const a = w && portOf(w.a);
        if (!a) return [];
        if (red.some((r) => same(r, [a.x, a.y]))) return [];
        return [[a.x, a.y] as const];
      });
  const free = (at: Pt) => !clashAt.some((c) => same(c, at));
  const levelMismatches = drawable ? facts.levelMismatches.map((m) => m.at).filter(free) : [];
  const thirdLevels = drawable ? facts.thirdLevels.map((t) => t.at).filter(free) : [];
  const levelHidden = drawable
    ? facts.levelMismatches.length + facts.thirdLevels.length - levelMismatches.length - thirdLevels.length
    : 0;

  // ---- 3D: the same marks with their sources, hidden only by red on their own level ----
  const scene: MarkInput[] = [];
  if (drawable) {
    /** Red marks with the levels they sit on. */
    const redSpots: { at: Pt; levels: readonly number[] }[] = [
      ...facts.clashes.map((c) => ({ at: c.at, levels: [levelOfPort(c.a), levelOfPort(c.b)] })),
      ...facts.overlaps.map((o) => ({ at: o.at, levels: [...levelsOfPiece(o.a), ...levelsOfPiece(o.b)] })),
    ];
    const heldBy = (spots: readonly { at: Pt; levels: readonly number[] }[], at: Pt, level: number) =>
      spots.some((s) => same(s.at, at) && s.levels.includes(level));

    for (const g of gaps) {
      const w = welds[g.weld]!;
      scene.push({ kind: 'gap', at: g.a, source: { kind: 'weld', a: w.a } });
    }
    for (const c of facts.clashes) scene.push({ kind: 'clash', at: c.at, source: { kind: 'clash', a: c.a, b: c.b } });
    for (const o of facts.overlaps) scene.push({ kind: 'overlap', at: o.at, source: { kind: 'overlap', a: o.a, b: o.b } });

    // Refused joints, at both ends where they part, as in 2D.
    const refusedSpots: { at: Pt; levels: readonly number[] }[] = [];
    for (const v of facts.polarityViolations) {
      const w = welds[v.weld];
      if (!w) continue;
      const ends = [w.a, w.b].flatMap((r) => {
        const p = portOf(r);
        return p ? [{ at: [p.x, p.y] as Pt, ref: r, level: p.level ?? 0 }] : [];
      });
      const spots = ends.filter((e, k) => k === 0 || !same(e.at, ends[0]!.at));
      for (const e of spots) {
        if (heldBy(redSpots, e.at, e.level)) continue;
        refusedSpots.push({ at: e.at, levels: [e.level] });
        scene.push({ kind: 'refused', at: e.at, source: { kind: 'weld', a: e.ref } });
      }
    }
    const allRed = [...redSpots, ...refusedSpots];
    for (const j of facts.adapterJoints) {
      const w = welds[j.weld];
      const a = w && portOf(w.a);
      if (!w || !a) continue;
      if (heldBy(allRed, [a.x, a.y], a.level ?? 0)) continue;
      scene.push({ kind: 'adapter', at: [a.x, a.y], source: { kind: 'weld', a: w.a } });
    }
    for (const m of facts.levelMismatches) {
      const w = welds[m.weld];
      if (!w) continue;
      const top = Math.max(levelOfPort(w.a), levelOfPort(w.b));
      if (heldBy(redSpots, m.at, top)) continue;
      scene.push({ kind: 'level', at: m.at, source: { kind: 'levels', a: w.a, b: w.b } });
    }
    for (const t of facts.thirdLevels) {
      const top = Math.max(...levelsOfPiece(t.pieceId), 0);
      if (heldBy(redSpots, t.at, top)) continue;
      scene.push({ kind: 'third', at: t.at, source: { kind: 'ramp', pieceId: t.pieceId } });
    }
  }

  return {
    canvas: {
      gaps,
      clashes,
      badJoints: refused.marks,
      badJointsHidden: refused.hidden,
      adapters,
      levelMismatches,
      thirdLevels,
      levelHidden,
    },
    scene,
  };
}
