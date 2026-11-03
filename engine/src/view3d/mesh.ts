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
 * - BUILD MODE'S NEXT PIECE (docs/plan/2026-10-31-build-mode.md, D23, D42):
 *   `highlight` routes one piece's top, sides, grooves and beam into `next`,
 *   with its top edges as lines, and every other piece is drawn without
 *   grooves, so the viewer can mute what is down and ink what comes next.
 *
 * Coordinates are the plan's millimetres with z up. The viewer sets its
 * camera's up vector to z rather than this file swapping axes.
 */

import type { Segment } from '../geom/fk.js';
import { bodyCorners, type RenderedPort } from '../graph/render.js';
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
  readonly kind: 'gap' | 'refused' | 'adapter' | 'clash' | 'overlap' | 'level' | 'third' | 'join';
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
  /** Build mode's next piece (D23): drawn into `next`, and every other piece without grooves (D42). */
  readonly highlight?: string;
  /** Wood that is not track (`GraphRender.bodies`, bent like the segments): footprints, walls, roofs. */
  readonly bodies?: readonly Segment[];
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
  readonly bounds: Box;
  /** Each piece's own box, for framing a build step on the next piece (D17, D34). */
  readonly pieceBounds: ReadonlyMap<string, Box>;
  /**
   * Structures (plan 2026-11-02, design decision 7): footprints and walls as
   * solid boxes, each as tall as the levels it blocks; a roof as its top's
   * outline and a thin rim, so the deck or road under it stays in view; and
   * every box's edges as lines.
   */
  readonly structures: { readonly solid: Mesh; readonly rim: Mesh; readonly edges: Lines };
  /** The highlighted piece, apart from the rest, with its top's outline (D42). Null without `highlight`. */
  readonly next: { readonly top: Mesh; readonly side: Mesh; readonly grooves: Mesh; readonly beams: Mesh; readonly edge: Lines } | null;
}

export interface Box {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
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
/** How deep a roof's rim hangs below its top, mm. Drawn, not measured: a roof is an outline. */
export const ROOF_RIM_MM = 4;
/** A suspension tower's posts in 3D: square, this half-width, this far either side of the road's centre. */
export const TOWER_POST_HALF_MM = 4;
export const TOWER_POST_SPREAD_MM = 30;
/** The lower crossbeam stands this far above the road, over the train's opening. */
export const TOWER_OPENING_MM = 70;
/** A cable's lowest point clears the road by this much. */
export const CABLE_SAG_CLEAR_MM = 4;
/** An end cable, from the road up to the first or last tower, sags this share of its rise. */
export const END_CABLE_SAG = 0.12;
/** The cables reach the road this far back from the top of each climb. */
export const CABLE_ANCHOR_BACK_MM = 100;
/** A deck plate's top sits this far under the road's, so the track reads on it and the two never share a face. */
export const PLATE_DROP_MM = 1;
/** A truss arch's chords in 3D: this deep, and twice this across. */
export const TRUSS_CHORD_MM = 4;
export const TRUSS_HALF_MM = 2;
/** A truss arch's verticals and hangers stand this far apart along the road. */
export const TRUSS_STEP_MM = 12;
/** Half the width of a bridge's arch band in 3D: the stones are 46mm across. */
export const ARCH_HALF_WIDTH_MM = 23;
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
 * The level at each end of a segment, read off the segment itself (bridges
 * plan, eng D2): the render already knows each road's level, its rise and
 * which end is high, so 3D draws what the render says. It used to guess from
 * the nearest end of the piece, which drew a bridge's raised top flat.
 */
function endLevels(s: Segment): readonly [number, number] {
  const lo = s.level ?? 0;
  const hi = lo + (s.rise ?? 0);
  return s.highAtStart ? [hi, lo] : [lo, hi];
}

/** A height profile's value at `a` along it, by straight lines between its points. */
export function profileAt(profile: readonly (readonly [number, number])[], a: number): number {
  if (a <= profile[0]![0]) return profile[0]![1];
  for (let i = 1; i < profile.length; i++) {
    const [a1, h1] = profile[i]!;
    if (a <= a1) {
      const [a0, h0] = profile[i - 1]!;
      return h0 + ((h1 - h0) * (a - a0)) / (a1 - a0);
    }
  }
  return profile[profile.length - 1]![1];
}

/** How finely a measured road is sampled along its length, mm. */
export const PROFILE_STEP_MM = 8;

/** Stations along a segment, finer along a measured road so its curve shows (eng D9). */
function stationsFor(s: Segment): readonly Station[] {
  if (!s.profileMm || !s.alongMm || s.kind !== 'straight') return stations(s);
  const n = Math.max(1, Math.ceil(Math.abs(s.alongMm[1] - s.alongMm[0]) / PROFILE_STEP_MM));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, h: s.from.h, t };
  });
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
  let best = 0;
  let bestD = Infinity;
  for (const p of stations(s)) {
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
  const mainTop = new Builder();
  const mainSide = new Builder();
  const mainGrooves = new Builder();
  const mainBeams = new Builder();
  const footprints = new Builder();
  const pieceRanges = new Map<string, { start: number; count: number }>();
  const highlight = input.highlight;
  const nTop = new Builder();
  const nSide = new Builder();
  const nGrooves = new Builder();
  const nBeams = new Builder();
  const edge: number[] = [];
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const pieceBox = new Map<string, { min: [number, number, number]; max: [number, number, number] }>();
  let boxOf: { min: [number, number, number]; max: [number, number, number] } | null = null;
  const grow = (x: number, y: number, z: number) => {
    lo[0] = Math.min(lo[0]!, x);
    lo[1] = Math.min(lo[1]!, y);
    lo[2] = Math.min(lo[2]!, z);
    hi[0] = Math.max(hi[0]!, x);
    hi[1] = Math.max(hi[1]!, y);
    hi[2] = Math.max(hi[2]!, z);
    if (boxOf) {
      boxOf.min[0] = Math.min(boxOf.min[0], x);
      boxOf.min[1] = Math.min(boxOf.min[1], y);
      boxOf.min[2] = Math.min(boxOf.min[2], z);
      boxOf.max[0] = Math.max(boxOf.max[0], x);
      boxOf.max[1] = Math.max(boxOf.max[1], y);
      boxOf.max[2] = Math.max(boxOf.max[2], z);
    }
  };
  /**
   * A road's top at a fraction `t` along a segment: its measured profile
   * where it has one (eng D9), else the plank's top over its levels. A
   * measured road's heights are above its piece's own floor: one level below
   * the top segment, the level of the slopes.
   */
  const topOf = (s: Segment, t: number): number => {
    if (s.profileMm && s.alongMm) {
      const base = (s.level ?? 0) - (s.rise ? 0 : 1);
      return base * riseMm + profileAt(s.profileMm, s.alongMm[0] + (s.alongMm[1] - s.alongMm[0]) * t);
    }
    const [l0, l1] = endLevels(s);
    return lerp(l0 * riseMm, l1 * riseMm, t) + plankMm;
  };
  const byPiece = new Map<string, RenderedPort[]>();
  for (const p of ports) {
    const list = byPiece.get(p.pieceId);
    if (list) list.push(p);
    else byPiece.set(p.pieceId, [p]);
  }

  for (const s of segments) {
    const part = s.pieceId !== undefined ? partOf(s.pieceId) : undefined;
    const isNext = highlight !== undefined && s.pieceId === highlight;
    const top = isNext ? nTop : mainTop;
    const side = isNext ? nSide : mainSide;
    const grooves = isNext ? nGrooves : mainGrooves;
    const beams = isNext ? nBeams : mainBeams;
    // Only the next piece keeps its grooves in build mode (D42).
    const painted = part?.grooveWidthMm !== undefined && (highlight === undefined || isNext);
    if (s.pieceId !== undefined) {
      boxOf = pieceBox.get(s.pieceId) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      pieceBox.set(s.pieceId, boxOf);
    } else boxOf = null;
    const width = part?.plankWidthMm ?? 40;
    const half = width / 2;
    const [l0, l1] = endLevels(s);
    const z0 = l0 * riseMm;
    const z1 = l1 * riseMm;
    const st = stationsFor(s);
    const startIdx = top.triangles;

    // Cross-sections: left and right edges, underside and top.
    const ring = st.map((p) => {
      const nx = -Math.sin(p.h);
      const ny = Math.cos(p.h);
      const zt = topOf(s, p.t);
      const zb = zt - plankMm;
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
      if (painted && part?.grooveWidthMm !== undefined) {
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
    // The next piece's top outline (D42): both long edges and both ends.
    if (isNext) {
      const at = (r: (typeof ring)[number], sgn: 1 | -1) => [r.p.x + r.nx * half * sgn, r.p.y + r.ny * half * sgn, r.zt + GROOVE_LIFT_MM] as const;
      for (let i = 0; i + 1 < ring.length; i++) {
        for (const sgn of [1, -1] as const) edge.push(...at(ring[i]!, sgn), ...at(ring[i + 1]!, sgn));
      }
      for (const r of [ring[0]!, ring[ring.length - 1]!]) edge.push(...at(r, 1), ...at(r, -1));
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
    if (s.pieceId !== undefined && !isNext) {
      const was = pieceRanges.get(s.pieceId);
      const count = top.triangles - startIdx;
      // A multi-road piece's roads are consecutive segments, so its range is one run.
      if (was) was.count += count;
      else pieceRanges.set(s.pieceId, { start: startIdx, count });
    }
  }

  /*
   * STRUCTURES. A body blocks the levels from its own up to the top of its
   * last, so it is drawn that tall: a pier from the floor to the underside
   * of the track it carries, a station's footprint up to its deck.
   */
  const solid = new Builder();
  const rim = new Builder();
  const bodyEdges: number[] = [];
  /**
   * A body whose top follows (along, height) points from its start: a solid
   * from `zb` up to that outline, with its outline and upright ends edged.
   */
  const prism = (b: Segment, zb: number, tops: readonly (readonly [number, number])[]) => {
    const len = Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y);
    const ux = (b.to.x - b.from.x) / len, uy = (b.to.y - b.from.y) / len;
    const w = b.halfWidthMm ?? 0;
    const at = (a: number, side: 1 | -1, z: number) =>
      [b.from.x + ux * a - uy * w * side, b.from.y + uy * a + ux * w * side, z] as const;
    for (let i = 0; i + 1 < tops.length; i++) {
      const [a0, z0] = tops[i]!, [a1, z1] = tops[i + 1]!;
      solid.quad(solid.vertex(...at(a0, 1, z0)), solid.vertex(...at(a0, -1, z0)), solid.vertex(...at(a1, -1, z1)), solid.vertex(...at(a1, 1, z1)));
      for (const side of [1, -1] as const) {
        solid.quad(solid.vertex(...at(a0, side, zb)), solid.vertex(...at(a1, side, zb)), solid.vertex(...at(a1, side, z1)), solid.vertex(...at(a0, side, z0)));
        bodyEdges.push(...at(a0, side, z0), ...at(a1, side, z1));
      }
    }
    for (const [a, z] of [tops[0]!, tops[tops.length - 1]!]) {
      solid.quad(solid.vertex(...at(a, 1, zb)), solid.vertex(...at(a, -1, zb)), solid.vertex(...at(a, -1, z)), solid.vertex(...at(a, 1, z)));
      for (const side of [1, -1] as const) bodyEdges.push(...at(a, side, zb), ...at(a, side, z));
    }
    for (const [a, z] of tops) for (const side of [1, -1] as const) grow(...at(a, side, z));
  };
  for (const b of input.bodies ?? []) {
    if (b.pieceId !== undefined) {
      boxOf = pieceBox.get(b.pieceId) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      pieceBox.set(b.pieceId, boxOf);
    } else boxOf = null;
    const lo = b.level ?? 0;
    const zt = (lo + (b.rise ?? 0) + 1) * riseMm;
    const c = bodyCorners(b);
    const ring = (z: number) => c.map(([x, y]) => [x, y, z] as const);
    const edgeLoop = (pts: readonly (readonly [number, number, number])[]) => {
      for (let i = 0; i < pts.length; i++) bodyEdges.push(...pts[i]!, ...pts[(i + 1) % pts.length]!);
    };
    for (const [x, y] of c) grow(x, y, zt);
    if (b.body === 'roof') {
      const top = ring(zt);
      const under = ring(zt - ROOF_RIM_MM);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        rim.quad(rim.vertex(...under[i]!), rim.vertex(...under[j]!), rim.vertex(...top[j]!), rim.vertex(...top[i]!));
      }
      edgeLoop(top);
      edgeLoop(under);
      continue;
    }
    const zb = lo * riseMm;
    for (const [x, y] of c) grow(x, y, zb);
    if (b.profileMm) {
      // An embankment or abutment: its top follows its measured outline (eng D5, design DD6).
      prism(b, zb, b.profileMm.map(([a, h]) => [a, zb + h] as const));
      continue;
    }
    const bottom = ring(zb).map((v) => solid.vertex(...v));
    const top = ring(zt).map((v) => solid.vertex(...v));
    solid.quad(top[0]!, top[1]!, top[2]!, top[3]!);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      solid.quad(bottom[i]!, bottom[j]!, top[j]!, top[i]!);
    }
    edgeLoop(ring(zt));
    for (const [x, y] of c) bodyEdges.push(x, y, zb, x, y, zt);
  }

  /*
   * A DECK'S PLATE (riser plan 2026-11-03): a riser is posts and a plate,
   * not four loose boxes. The plate runs the piece's length under its road,
   * from the posts' tops up to just under the road's top. Decoration only:
   * collisions use the bodies and the road.
   */
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    const part = partOf(s.pieceId);
    if (part.kind !== 'straight' || !part.plate) continue;
    boxOf = pieceBox.get(s.pieceId) ?? null;
    const zb = (s.level ?? 0) * riseMm;
    const zt = zb + plankMm - PLATE_DROP_MM;
    const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    const plate = { ...s, halfWidthMm: part.plate.widthMm / 2 };
    prism(plate, zb, [[0, zt], [len, zt]]);
    // Its underside, seen from low down between the posts.
    const under = bodyCorners(plate);
    const v = under.map(([x, y]) => solid.vertex(x, y, zb));
    solid.quad(v[3]!, v[2]!, v[1]!, v[0]!);
    for (let i = 0; i < 4; i++) bodyEdges.push(...under[i]!, zb, ...under[(i + 1) % 4]!, zb);
  }

  /*
   * A TRUSS ARCH OVER THE DECK (Sydney bridge plan 2026-11-03): two curved
   * chords either side of the road, outer and inner, meeting where the arch
   * springs low on the portals; verticals between them, hangers from the
   * inner chord down to the road, and braces across between the two outer
   * chords. Chords in the house matte, the rest as lines. Decoration only.
   */
  for (const s of segments) {
    if (s.pieceId === undefined) continue;
    const part = partOf(s.pieceId);
    if (part.kind !== 'straight' || !part.trussArch) continue;
    boxOf = pieceBox.get(s.pieceId) ?? null;
    const { fromMm, toMm, springMm, crownMm, innerCrownMm, sideMm } = part.trussArch;
    const floor = ((s.level ?? 0) - (part.deck ?? 0)) * riseMm;
    const roadTop = (s.level ?? 0) * riseMm + plankMm;
    const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    const ux = (s.to.x - s.from.x) / len, uy = (s.to.y - s.from.y) / len;
    const at = (a: number, across: number, z: number) =>
      [s.from.x + ux * a - uy * across, s.from.y + uy * a + ux * across, z] as const;
    /** A circular chord through both springings and its crown, as height above the floor. */
    const chord = (crown: number) => {
      const half = (toMm - fromMm) / 2, rise = crown - springMm;
      const r = (half * half + rise * rise) / (2 * rise);
      return (a: number) => floor + crown - (r - Math.sqrt(Math.max(0, r * r - (a - fromMm - half) ** 2)));
    };
    const outer = chord(crownMm), inner = chord(innerCrownMm);
    // An even count, so a step lands on the crown.
    const steps = 2 * Math.max(1, Math.ceil((toMm - fromMm) / TRUSS_STEP_MM / 2));
    const along = (i: number) => fromMm + ((toMm - fromMm) * i) / steps;
    for (const side of [1, -1] as const) {
      for (const top of [outer, inner]) {
        for (let i = 0; i < steps; i++) {
          const a0 = along(i), a1 = along(i + 1);
          const ring = (a: number) => [-1, 1].flatMap((d) => [[a, top(a)], [a, top(a) - TRUSS_CHORD_MM]].map(([aa, z]) => at(aa!, side * sideMm + d * TRUSS_HALF_MM, z!)));
          // Corners: [in-top, in-bottom, out-top, out-bottom] at each end of the step.
          const [p0, p1, p2, p3] = ring(a0).map((v) => solid.vertex(...v));
          const [q0, q1, q2, q3] = ring(a1).map((v) => solid.vertex(...v));
          solid.quad(p0!, q0!, q2!, p2!);
          solid.quad(p1!, p3!, q3!, q1!);
          solid.quad(p0!, p1!, q1!, q0!);
          solid.quad(p2!, q2!, q3!, p3!);
          for (const [x, y, z] of ring(a0)) grow(x, y, z);
          for (const d of [1, -1]) bodyEdges.push(...at(a0, side * sideMm + d * TRUSS_HALF_MM, top(a0)), ...at(a1, side * sideMm + d * TRUSS_HALF_MM, top(a1)));
        }
      }
      for (let i = 1; i < steps; i++) {
        const a = along(i), c = side * sideMm;
        bodyEdges.push(...at(a, c, outer(a) - TRUSS_CHORD_MM), ...at(a, c, inner(a)));
        if (inner(a) - TRUSS_CHORD_MM > roadTop) bodyEdges.push(...at(a, c, inner(a) - TRUSS_CHORD_MM), ...at(a, c, roadTop));
        if (side === 1 && i % 2 === 0 && outer(a) - TRUSS_CHORD_MM > roadTop + 40) bodyEdges.push(...at(a, sideMm, outer(a) - TRUSS_CHORD_MM), ...at(a, -sideMm, outer(a) - TRUSS_CHORD_MM));
      }
    }
  }

  /*
   * A BRIDGE'S ARCH (eng D5, D9; design DD6): a curved band under the span,
   * drawn from the piece's measured arch, its top meeting the road's
   * underside. Decoration only: collisions use the bodies and the road.
   */
  for (const s of segments) {
    if (!s.alongMm || s.alongMm[0] !== 0 || s.pieceId === undefined) continue;
    const part = partOf(s.pieceId);
    if (part.kind !== 'straight' || !part.hump?.arch) continue;
    boxOf = pieceBox.get(s.pieceId) ?? null;
    const { fromMm, toMm, riseMm: archRise, depthMm, baseMm } = part.hump.arch;
    const base = (s.level ?? 0) * riseMm + baseMm;
    const chord = toMm - fromMm;
    const radius = (chord * chord / 4 + archRise * archRise) / (2 * archRise);
    const under = (a: number) => {
      const d = a - (fromMm + toMm) / 2;
      return base + archRise - (radius - Math.sqrt(Math.max(0, radius * radius - d * d)));
    };
    const band = Math.max(1, depthMm - plankMm);
    const steps = 24;
    const tops: (readonly [number, number])[] = [];
    for (let i = 0; i <= steps; i++) tops.push([fromMm + (chord * i) / steps, under(fromMm + (chord * i) / steps) + band]);
    // The band: from the arch's underside up `band`, as a prism whose floor follows the curve.
    const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
    const ux = (s.to.x - s.from.x) / len, uy = (s.to.y - s.from.y) / len;
    const at = (a: number, side: 1 | -1, z: number) =>
      [s.from.x + ux * a - uy * ARCH_HALF_WIDTH_MM * side, s.from.y + uy * a + ux * ARCH_HALF_WIDTH_MM * side, z] as const;
    for (let i = 0; i < steps; i++) {
      const a0 = tops[i]![0], a1 = tops[i + 1]![0];
      const lo0 = under(a0), lo1 = under(a1), hi0 = lo0 + band, hi1 = lo1 + band;
      solid.quad(solid.vertex(...at(a0, 1, lo0)), solid.vertex(...at(a1, 1, lo1)), solid.vertex(...at(a1, -1, lo1)), solid.vertex(...at(a0, -1, lo0)));
      solid.quad(solid.vertex(...at(a0, 1, hi0)), solid.vertex(...at(a0, -1, hi0)), solid.vertex(...at(a1, -1, hi1)), solid.vertex(...at(a1, 1, hi1)));
      for (const side of [1, -1] as const) {
        solid.quad(solid.vertex(...at(a0, side, lo0)), solid.vertex(...at(a1, side, lo1)), solid.vertex(...at(a1, side, hi1)), solid.vertex(...at(a0, side, hi0)));
        bodyEdges.push(...at(a0, side, lo0), ...at(a1, side, lo1), ...at(a0, side, hi0), ...at(a1, side, hi1));
      }
      grow(...at(a0, 1, hi0));
    }
  }

  /*
   * A SUSPENSION BRIDGE'S TOWERS AND CABLES (bridges plan B-T6; design DD6):
   * each tower two square posts either side of the road, from its base up to
   * its height, joined at the top and above the train's opening; the cables
   * hang from tower top to tower top on both sides, sagging to just above the
   * road, and run down to the road where the side spans begin. Lines for the
   * cables and hangers, the house matte for the posts.
   */
  for (const s of segments) {
    if (!s.alongMm || s.alongMm[0] !== 0 || s.pieceId === undefined) continue;
    const part = partOf(s.pieceId);
    if (part.kind !== 'straight' || !part.hump?.towers?.length) continue;
    boxOf = pieceBox.get(s.pieceId) ?? null;
    const { towers, profileMm } = part.hump;
    const floor = (s.level ?? 0) * riseMm;
    const len = part.lengthMm;
    const ux = Math.cos(s.from.h), uy = Math.sin(s.from.h);
    const at = (a: number, side: number, z: number) =>
      [s.from.x + ux * a - uy * side, s.from.y + uy * a + ux * side, z] as const;
    const road = (a: number) => floor + profileAt(profileMm, a);
    const box = (a: number, side: number, half: number, z0: number, z1: number) => {
      const c = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([da, ds]) => [a + da!, side + ds!] as const);
      const lo = c.map(([ca, cs]) => solid.vertex(...at(ca, cs, z0)));
      const hi = c.map(([ca, cs]) => solid.vertex(...at(ca, cs, z1)));
      solid.quad(hi[0]!, hi[1]!, hi[2]!, hi[3]!);
      for (let i = 0; i < 4; i++) solid.quad(lo[i]!, lo[(i + 1) % 4]!, hi[(i + 1) % 4]!, hi[i]!);
      for (const [ca, cs] of c) bodyEdges.push(...at(ca, cs, z0), ...at(ca, cs, z1));
    };
    for (const t of towers) {
      const top = floor + t.heightMm;
      const base = road(t.atMm) - plankMm;
      for (const side of [TOWER_POST_SPREAD_MM, -TOWER_POST_SPREAD_MM]) box(t.atMm, side, TOWER_POST_HALF_MM, base, top);
      // Crossbeams: at the top, and over the train's opening.
      for (const zb of [top - 2 * TOWER_POST_HALF_MM, road(t.atMm) + TOWER_OPENING_MM]) {
        const z0 = zb, z1 = zb + 2 * TOWER_POST_HALF_MM;
        const c = [at(t.atMm - TOWER_POST_HALF_MM, -TOWER_POST_SPREAD_MM, 0), at(t.atMm + TOWER_POST_HALF_MM, -TOWER_POST_SPREAD_MM, 0), at(t.atMm + TOWER_POST_HALF_MM, TOWER_POST_SPREAD_MM, 0), at(t.atMm - TOWER_POST_HALF_MM, TOWER_POST_SPREAD_MM, 0)];
        const lo = c.map(([x, y]) => solid.vertex(x, y, z0));
        const hi = c.map(([x, y]) => solid.vertex(x, y, z1));
        solid.quad(hi[0]!, hi[1]!, hi[2]!, hi[3]!);
        for (let i = 0; i < 4; i++) solid.quad(lo[i]!, lo[(i + 1) % 4]!, hi[(i + 1) % 4]!, hi[i]!);
      }
      grow(...at(t.atMm, TOWER_POST_SPREAD_MM, top));
    }
    // Cables: from the road where the climb starts, over each tower top, back down at the far end.
    const anchors: (readonly [number, number])[] = [
      [part.hump.upMm - CABLE_ANCHOR_BACK_MM, road(part.hump.upMm - CABLE_ANCHOR_BACK_MM) + 2],
      ...towers.map((t) => [t.atMm, floor + t.heightMm - TOWER_POST_HALF_MM] as const),
      [len - part.hump.downMm + CABLE_ANCHOR_BACK_MM, road(len - part.hump.downMm + CABLE_ANCHOR_BACK_MM) + 2],
    ];
    for (const side of [TOWER_POST_SPREAD_MM, -TOWER_POST_SPREAD_MM]) {
      for (let k = 0; k + 1 < anchors.length; k++) {
        const [a0, z0] = anchors[k]!, [a1, z1] = anchors[k + 1]!;
        const low = (a: number) => road(a) + CABLE_SAG_CLEAR_MM;
        const n = 16;
        let prev: readonly [number, number, number] | null = null;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const a = a0 + (a1 - a0) * t;
          /*
           * A parabola through both anchors. Between two towers its lowest
           * point comes down to just above the road at mid-span; from the
           * road up to the first or last tower it only sags a little.
           */
          const straight = z0 + (z1 - z0) * t;
          const between = k > 0 && k + 2 < anchors.length;
          const dip = between ? Math.max(0, (z0 + z1) / 2 - low((a0 + a1) / 2)) : END_CABLE_SAG * Math.abs(z1 - z0);
          const z = Math.max(low(a), straight - 4 * dip * t * (1 - t));
          const p = at(a, side, z);
          if (prev) bodyEdges.push(...prev, ...p);
          // Hangers: down to the road every few centimetres.
          if (i > 0 && i < n && i % 2 === 0) bodyEdges.push(...p, ...at(a, side, road(a)));
          prev = p;
        }
      }
    }
  }

  // The table and the rest grow the scene's box, never the last piece's.
  boxOf = null;

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
  /*
   * The top of the piece's road at the stretch nearest the mark, not its
   * highest point (eng D11): the mark is projected onto each segment, and the
   * nearest projection's height is the one it sits on.
   */
  const topAtPiece = (pieceId: string, x: number, y: number): number => {
    let best = plankMm;
    let bestD = Infinity;
    for (const s of segments) {
      if (s.pieceId !== pieceId) continue;
      const t = fractionAt(s, x, y);
      const p = s.kind === 'straight'
        ? { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t }
        : stations(s).reduce((m, q) => (Math.abs(q.t - t) < Math.abs(m.t - t) ? q : m));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = topOf(s, t);
      }
    }
    return best;
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

  const finite = (b: { min: [number, number, number]; max: [number, number, number] }): Box =>
    b.min[0] === Infinity ? { min: [0, 0, 0], max: [0, 0, 0] } : b;
  return {
    plankTop: mainTop.done(),
    plankSide: mainSide.done(),
    grooves: mainGrooves.done(),
    beams: mainBeams.done(),
    footprints: footprints.done(),
    structures: { solid: solid.done(), rim: rim.done(), edges: { positions: new Float32Array(bodyEdges) } },
    seams: { positions: new Float32Array(seamPos) },
    slab,
    marks,
    pieceRanges,
    pieceBounds: new Map([...pieceBox].map(([id, b]) => [id, finite(b)])),
    next:
      highlight === undefined
        ? null
        : { top: nTop.done(), side: nSide.done(), grooves: nGrooves.done(), beams: nBeams.done(), edge: { positions: new Float32Array(edge) } },
    bounds: {
      min: lo[0] === Infinity ? [0, 0, 0] : [lo[0]!, lo[1]!, lo[2]!],
      max: hi[0] === -Infinity ? [0, 0, 0] : [hi[0]!, hi[1]!, hi[2]!],
    },
  };
}
