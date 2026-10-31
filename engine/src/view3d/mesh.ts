/**
 * THE LAYOUT AS SOLID WOOD, FOR THE 3D VIEW (docs/plan/2026-10-31-3d-viewer.md).
 *
 * One call, `buildScene`, turns what the 2D canvas already draws (the `drawn`
 * render: segments and ports, bent loops already closed by `bendRender`) into
 * plain arrays a renderer can upload. No Three.js here (eng D11, D19): this
 * file is tested in the node project, and only `Viewer3D.tsx` may import it.
 *
 * WHAT IT DECIDES, so nothing downstream does:
 *
 * - HEIGHT. A segment's two ends sit at their ports' levels x the measured
 *   rise; the plank's underside rises linearly between them, so a ramp is a
 *   straight slope (eng D23) and a flipped ramp needs no special case: its
 *   ports already say which end is high. The top is the underside plus the
 *   plank's thickness.
 * - ONE BUFFER PER MATERIAL (eng D20): plank tops, plank sides, groove strips,
 *   buffer beams, raised footprints, slab top, slab sides. A few draw calls at
 *   any size; `pieceRanges` keeps where each piece's top lies, for build mode.
 * - GROOVES ARE PAINTED (eng D22): two strips at +-gauge/2, the part's own
 *   groove width, 0.2mm proud of the top. A part with no published groove
 *   width gets a bare plank, as in 2D.
 * - MARKS SIT ON THEIR WOOD (eng D21, D25; design 16A): each from its record.
 *
 * Coordinates are the plan's millimetres with z up. The viewer sets its
 * camera's up vector to z rather than this file swapping axes.
 */

import type { FPose, Segment } from '../geom/fk.js';
import type { RenderedPort } from '../graph/render.js';
import type { Part } from '../parts/schema.js';

/** Triangles: xyz per vertex, three indices per triangle. */
export interface Mesh {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}

/** Line pieces: xyz for each end, two vertices per line. */
export interface Lines {
  readonly positions: Float32Array;
}

/** A verdict mark, with the record its height comes from (eng D21, D24). */
export type MarkSource =
  /** Gap, refused joint, adapter: a joint, placed at its first end's height. */
  | { readonly kind: 'weld'; readonly a: PortKey }
  /** Two ends on top of each other: on the higher of the two pieces' wood there (eng D25). */
  | { readonly kind: 'clash'; readonly a: PortKey; readonly b: PortKey }
  /** Two planks overlapping: on the higher of the two pieces' wood there (eng D25). */
  | { readonly kind: 'overlap'; readonly a: string; readonly b: string }
  /** A joint between two levels: an upright line from one end's height to the other's (design 16A). */
  | { readonly kind: 'levels'; readonly a: PortKey; readonly b: PortKey }
  /** A ramp that would climb to a third level: at its high end. */
  | { readonly kind: 'ramp'; readonly pieceId: string };

export interface PortKey {
  readonly pieceId: string;
  readonly port: number;
}

export interface MarkInput {
  /** Which mark: the viewer draws the canvas's own glyph and colour for it (design 14A). */
  readonly kind: 'gap' | 'refused' | 'adapter' | 'clash' | 'overlap' | 'level' | 'third';
  readonly at: readonly [number, number];
  readonly source: MarkSource;
  /** A gap's figure in mm, drawn as the 2D canvas's dimension text. */
  readonly figure?: number;
}

export interface PlacedMark {
  readonly kind: MarkInput['kind'];
  /** Where the glyph sits: on top of the wood the mark is about. */
  readonly at: readonly [number, number, number];
  /** A level mismatch's line runs from `at` down or up to this height (design 16A). */
  readonly lineTo?: number;
  readonly figure?: number;
}

export interface SceneInput {
  /** The canvas's own drawing: `bendRender(renderGraph(...))`. */
  readonly segments: readonly Segment[];
  readonly ports: readonly RenderedPort[];
  /** Joints, as pairs of ends, for the seams. */
  readonly welds: readonly { readonly a: PortKey; readonly b: PortKey }[];
  readonly partOf: (pieceId: string) => Part;
  /** From `clearance(MEASUREMENTS)`: never restated here (eng E5). */
  readonly riseMm: number;
  readonly plankMm: number;
  readonly marks?: readonly MarkInput[];
  /** The table's outline in plan millimetres (`tableFit(...).outline`), and whether track hangs off it. */
  readonly table?: { readonly outline: readonly (readonly [number, number])[]; readonly overhang: boolean } | null;
}

export interface SceneArrays {
  readonly plankTop: Mesh;
  readonly plankSide: Mesh;
  readonly grooves: Mesh;
  readonly beams: Mesh;
  readonly footprints: Mesh;
  /** Joins, across the plank top, past both edges (design 17A after 26A). */
  readonly seams: Lines;
  readonly slab: { readonly top: Mesh; readonly side: Mesh; readonly outline: Lines; readonly overhang: boolean } | null;
  readonly marks: readonly PlacedMark[];
  /** Each piece's run of triangle indices in `plankTop`, for build mode's highlight (eng D20). */
  readonly pieceRanges: ReadonlyMap<string, { readonly start: number; readonly count: number }>;
  readonly bounds: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] };
}

/** How far painted grooves stand proud of the plank top, mm (eng D22). */
export const GROOVE_LIFT_MM = 0.2;
/** A buffer stop's beam: 6mm deep along the track, as in 2D (DESIGN.md rule 11, design 25A). */
export const BEAM_DEPTH_MM = 6;
/** The slab's thickness: NOMINAL, NOT A MEASUREMENT. Nobody measured a table (design 19A). */
export const SLAB_NOMINAL_MM = 20;
/** How far a seam runs past each plank edge. A fixed length in 3D, since pixels vary with depth. */
export const SEAM_OVERHANG_MM = 4;
/** A footprint sits this far above the floor, so it never fights the slab top for depth. */
export const FOOTPRINT_LIFT_MM = 0.1;
/** The largest turn between two cross-sections of a curve: 3.75 degrees. */
export const ARC_STEP_RAD = Math.PI / 48;

class Builder {
  private readonly pos: number[] = [];
  private readonly idx: number[] = [];
  vertex(x: number, y: number, z: number): number {
    this.pos.push(x, y, z);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }
  get triangles(): number {
    return this.idx.length;
  }
  done(): Mesh {
    return { positions: new Float32Array(this.pos), indices: new Uint32Array(this.idx) };
  }
}

/** A point along a segment's centreline, its heading, and how far along it is (0..1). */
interface Station {
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly t: number;
}

/** The signed turn from a curve's start heading to its end heading, the way it sweeps. */
function turnOf(s: Segment): number {
  let d = s.to.h - s.from.h;
  if (s.sweep === 'left') {
    while (d <= 0) d += 2 * Math.PI;
    while (d > 2 * Math.PI) d -= 2 * Math.PI;
  } else {
    while (d >= 0) d -= 2 * Math.PI;
    while (d < -2 * Math.PI) d += 2 * Math.PI;
  }
  return d;
}

/** Stations along a segment: two for a straight, one per ARC_STEP_RAD or less for a curve. */
export function stations(s: Segment): readonly Station[] {
  if (s.kind === 'straight') {
    return [
      { x: s.from.x, y: s.from.y, h: s.from.h, t: 0 },
      { x: s.to.x, y: s.to.y, h: s.from.h, t: 1 },
    ];
  }
  const r = s.centrelineRadiusMm ?? 0;
  const turn = turnOf(s);
  const side = turn > 0 ? 1 : -1;
  // The centre is on the left of a left turn: from + r * left normal.
  const cx = s.from.x - Math.sin(s.from.h) * r * side;
  const cy = s.from.y + Math.cos(s.from.h) * r * side;
  const n = Math.max(1, Math.ceil(Math.abs(turn) / ARC_STEP_RAD));
  const out: Station[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const h = s.from.h + turn * t;
    out.push({ x: cx + Math.sin(h) * r * side, y: cy - Math.cos(h) * r * side, h, t });
  }
  return out;
}

/**
 * The level at each end of a segment, read from its own piece's ports at those
 * spots. `byPiece` is built once per scene: filtering every port for every
 * segment was quadratic, 1.4s at the 10,000-segment ceiling (measured).
 */
function endLevels(s: Segment, byPiece: ReadonlyMap<string, readonly RenderedPort[]>): readonly [number, number] {
  const own = s.pieceId !== undefined ? (byPiece.get(s.pieceId) ?? []) : [];
  const at = (q: FPose): number => {
    let best: RenderedPort | undefined;
    let bestD = Infinity;
    for (const p of own) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best?.level ?? 0;
  };
  // The chain walk has no piece ids or ports; it is flat by construction.
  if (own.length === 0) return [s.level ?? 0, (s.level ?? 0) + (s.rise ?? 0)];
  return [at(s.from), at(s.to)];
}

/** The plank's top at a fraction `t` along a segment whose ends sit at `z0` and `z1` (underside). */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where along a segment a plan point falls, 0..1, clamped. */
function fractionAt(s: Segment, x: number, y: number): number {
  if (s.kind === 'straight') {
    const dx = s.to.x - s.from.x;
    const dy = s.to.y - s.from.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return 0;
    return Math.min(1, Math.max(0, ((x - s.from.x) * dx + (y - s.from.y) * dy) / len2));
  }
  const st = stations(s);
  let best = 0;
  let bestD = Infinity;
  for (const p of st) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p.t;
    }
  }
  return best;
}

export function buildScene(input: SceneInput): SceneArrays {
  const { segments, ports, partOf, riseMm, plankMm } = input;
  const top = new Builder();
  const side = new Builder();
  const grooves = new Builder();
  const beams = new Builder();
  const footprints = new Builder();
  const pieceRanges = new Map<string, { start: number; count: number }>();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number, z: number) => {
    lo[0] = Math.min(lo[0]!, x);
    lo[1] = Math.min(lo[1]!, y);
    lo[2] = Math.min(lo[2]!, z);
    hi[0] = Math.max(hi[0]!, x);
    hi[1] = Math.max(hi[1]!, y);
    hi[2] = Math.max(hi[2]!, z);
  };
  /** The underside's height at each end of every segment, keyed by the segment. */
  const undersides = new Map<Segment, readonly [number, number]>();
  const byPiece = new Map<string, RenderedPort[]>();
  for (const p of ports) {
    const list = byPiece.get(p.pieceId);
    if (list) list.push(p);
    else byPiece.set(p.pieceId, [p]);
  }

  for (const s of segments) {
    const part = s.pieceId !== undefined ? partOf(s.pieceId) : undefined;
    const width = part?.plankWidthMm ?? 40;
    const half = width / 2;
    const [l0, l1] = endLevels(s, byPiece);
    const z0 = l0 * riseMm;
    const z1 = l1 * riseMm;
    undersides.set(s, [z0, z1]);
    const st = stations(s);
    const startIdx = top.triangles;

    // Cross-sections: left and right edges, underside and top.
    const ring = st.map((p) => {
      const nx = -Math.sin(p.h);
      const ny = Math.cos(p.h);
      const zb = lerp(z0, z1, p.t);
      const zt = zb + plankMm;
      grow(p.x + nx * half, p.y + ny * half, zt);
      grow(p.x - nx * half, p.y - ny * half, zb);
      return { p, nx, ny, zb, zt };
    });
    for (let i = 0; i + 1 < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[i + 1]!;
      const L = (r: typeof a, z: number) => [r.p.x + r.nx * half, r.p.y + r.ny * half, z] as const;
      const R = (r: typeof a, z: number) => [r.p.x - r.nx * half, r.p.y - r.ny * half, z] as const;
      // Top.
      top.quad(top.vertex(...L(a, a.zt)), top.vertex(...R(a, a.zt)), top.vertex(...R(b, b.zt)), top.vertex(...L(b, b.zt)));
      // Left and right walls.
      side.quad(side.vertex(...L(a, a.zb)), side.vertex(...L(a, a.zt)), side.vertex(...L(b, b.zt)), side.vertex(...L(b, b.zb)));
      side.quad(side.vertex(...R(a, a.zt)), side.vertex(...R(a, a.zb)), side.vertex(...R(b, b.zb)), side.vertex(...R(b, b.zt)));
      // Painted grooves (eng D22): none when nobody published a groove width.
      if (part?.grooveWidthMm !== undefined) {
        const gw = part.grooveWidthMm / 2;
        for (const off of [part.gaugeWidthMm / 2, -part.gaugeWidthMm / 2]) {
          const g = (r: typeof a, o: number) =>
            [r.p.x + r.nx * o, r.p.y + r.ny * o, r.zt + GROOVE_LIFT_MM] as const;
          grooves.quad(grooves.vertex(...g(a, off + gw)), grooves.vertex(...g(a, off - gw)), grooves.vertex(...g(b, off - gw)), grooves.vertex(...g(b, off + gw)));
        }
      }
      // Raised footprint (design 18A): flat on the floor under raised wood, a
      // ramp's tapering from nothing at its floor end to full at its top.
      const raisedA = a.zb > 0;
      const raisedB = b.zb > 0;
      if (raisedA || raisedB) {
        const top0 = Math.max(z0, z1);
        const wa = top0 > 0 ? half * (a.zb / top0) : 0;
        const wb = top0 > 0 ? half * (b.zb / top0) : 0;
        const f = (r: typeof a, w: number, sgn: 1 | -1) =>
          [r.p.x + r.nx * w * sgn, r.p.y + r.ny * w * sgn, FOOTPRINT_LIFT_MM] as const;
        footprints.quad(footprints.vertex(...f(a, wa, 1)), footprints.vertex(...f(a, wa, -1)), footprints.vertex(...f(b, wb, -1)), footprints.vertex(...f(b, wb, 1)));
      }
    }
    // End caps.
    for (const r of [ring[0]!, ring[ring.length - 1]!]) {
      const L = (z: number) => [r.p.x + r.nx * half, r.p.y + r.ny * half, z] as const;
      const R = (z: number) => [r.p.x - r.nx * half, r.p.y - r.ny * half, z] as const;
      side.quad(side.vertex(...L(r.zb)), side.vertex(...R(r.zb)), side.vertex(...R(r.zt)), side.vertex(...L(r.zt)));
    }
    // A buffer stop's beam (design 25A): solid, 6mm deep, ending at the barrier, plank-high above the top.
    if (s.stop) {
      const e = ring[ring.length - 1]!;
      const dx = Math.cos(e.p.h);
      const dy = Math.sin(e.p.h);
      const box = (along: number, across: number, z: number) =>
        beams.vertex(e.p.x + dx * along + e.nx * across, e.p.y + dy * along + e.ny * across, z);
      const zt = e.zt;
      const zu = e.zt + plankMm;
      const c = [
        box(-BEAM_DEPTH_MM, half, zt), box(-BEAM_DEPTH_MM, -half, zt), box(0, -half, zt), box(0, half, zt),
        box(-BEAM_DEPTH_MM, half, zu), box(-BEAM_DEPTH_MM, -half, zu), box(0, -half, zu), box(0, half, zu),
      ];
      const [a0, a1, a2, a3, b0, b1, b2, b3] = c as [number, number, number, number, number, number, number, number];
      beams.quad(b0, b1, b2, b3);
      beams.quad(a0, a1, b1, b0);
      beams.quad(a1, a2, b2, b1);
      beams.quad(a2, a3, b3, b2);
      beams.quad(a3, a0, b0, b3);
      grow(e.p.x, e.p.y, zu);
    }
    if (s.pieceId !== undefined) {
      const was = pieceRanges.get(s.pieceId);
      const count = top.triangles - startIdx;
      // A multi-road piece's roads are consecutive segments, so its range is one run.
      if (was) was.count += count;
      else pieceRanges.set(s.pieceId, { start: startIdx, count });
    }
  }

  // Seams: across the plank top at each joint whose two ends meet (as 2D's `seamLines`).
  const portAt = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  const seamPos: number[] = [];
  for (const w of input.welds) {
    const a = portAt.get(`${w.a.pieceId}#${w.a.port}`);
    const b = portAt.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) continue;
    const half = Math.min(partOf(w.a.pieceId).plankWidthMm, partOf(w.b.pieceId).plankWidthMm) / 2 + SEAM_OVERHANG_MM;
    const nx = -Math.sin(a.h) * half;
    const ny = Math.cos(a.h) * half;
    const z = (a.level ?? 0) * riseMm + plankMm + GROOVE_LIFT_MM;
    seamPos.push(a.x - nx, a.y - ny, z, a.x + nx, a.y + ny, z);
  }

  // The table (design 19A): its top at the floor, so floor track sits on it.
  let slab: SceneArrays['slab'] = null;
  if (input.table && input.table.outline.length >= 3) {
    const t = new Builder();
    const sd = new Builder();
    const o = input.table.outline;
    const topIdx = o.map(([x, y]) => t.vertex(x, y, 0));
    for (let i = 1; i + 1 < topIdx.length; i++) t.tri(topIdx[0]!, topIdx[i]!, topIdx[i + 1]!);
    const line: number[] = [];
    for (let i = 0; i < o.length; i++) {
      const [x0, y0] = o[i]!;
      const [x1, y1] = o[(i + 1) % o.length]!;
      sd.quad(sd.vertex(x0, y0, -SLAB_NOMINAL_MM), sd.vertex(x1, y1, -SLAB_NOMINAL_MM), sd.vertex(x1, y1, 0), sd.vertex(x0, y0, 0));
      line.push(x0, y0, FOOTPRINT_LIFT_MM, x1, y1, FOOTPRINT_LIFT_MM);
      grow(x0, y0, -SLAB_NOMINAL_MM);
    }
    slab = { top: t.done(), side: sd.done(), outline: { positions: new Float32Array(line) }, overhang: input.table.overhang };
  }

  // Marks on their wood (eng D21, D25; design 16A).
  const topAtPiece = (pieceId: string, x: number, y: number): number => {
    let best = -Infinity;
    for (const s of segments) {
      if (s.pieceId !== pieceId) continue;
      const [z0, z1] = undersides.get(s)!;
      best = Math.max(best, lerp(z0, z1, fractionAt(s, x, y)) + plankMm);
    }
    return best === -Infinity ? plankMm : best;
  };
  const portTop = (k: PortKey): number => (portAt.get(`${k.pieceId}#${k.port}`)?.level ?? 0) * riseMm + plankMm;
  const marks: PlacedMark[] = (input.marks ?? []).map((m) => ({ ...place(m), ...(m.figure !== undefined ? { figure: m.figure } : {}) }));
  function place(m: MarkInput): PlacedMark {
    const [x, y] = m.at;
    const src = m.source;
    switch (src.kind) {
      case 'weld':
        return { kind: m.kind, at: [x, y, portTop(src.a)] };
      case 'clash':
        return { kind: m.kind, at: [x, y, Math.max(topAtPiece(src.a.pieceId, x, y), topAtPiece(src.b.pieceId, x, y))] };
      case 'overlap':
        return { kind: m.kind, at: [x, y, Math.max(topAtPiece(src.a, x, y), topAtPiece(src.b, x, y))] };
      case 'levels': {
        const za = portTop(src.a);
        const zb = portTop(src.b);
        return { kind: m.kind, at: [x, y, Math.max(za, zb)], lineTo: Math.min(za, zb) };
      }
      case 'ramp': {
        const own = byPiece.get(src.pieceId) ?? [];
        const highest = own.reduce((z, p) => Math.max(z, (p.level ?? 0) * riseMm + plankMm), plankMm);
        return { kind: m.kind, at: [x, y, highest] };
      }
    }
  }

  return {
    plankTop: top.done(),
    plankSide: side.done(),
    grooves: grooves.done(),
    beams: beams.done(),
    footprints: footprints.done(),
    seams: { positions: new Float32Array(seamPos) },
    slab,
    marks,
    pieceRanges,
    bounds: {
      min: lo[0] === Infinity ? [0, 0, 0] : [lo[0]!, lo[1]!, lo[2]!],
      max: hi[0] === -Infinity ? [0, 0, 0] : [hi[0]!, hi[1]!, hi[2]!],
    },
  };
}
