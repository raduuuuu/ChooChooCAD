/**
 * DECORATION IN 3D (decorated-pieces plan 2026-11-03, eng D1/D3/D4/D6): where
 * a decoration box stands, from its measured heights, and how each shape with
 * its own drawing is drawn. A structure's body is drawn as tall as the levels
 * it fills; a decoration is drawn as measured, a 6mm road surface as 6mm,
 * never as a level-tall block (eng O4).
 *
 * One way to draw each shape, for every piece that has it: a tunnel's vault,
 * a harbour bridge's truss arch, a stone bridge's arch band, a suspension
 * bridge's towers and cables. mesh.ts hands each a frame and a pen; the
 * shape lands in the structures' solid mesh and edges like any body.
 */

import type { Segment } from '../geom/fk.js';
import { domeHalfWidth, domeTop } from '../parts/dome.js';
import type { DecorArch, DecorBarrier, DecorCanopy, DecorDome, DecorPrism, DecorStation, DecorTowers, DecorTruss, DecorVault, DecorWheel, DrawnShape, Part } from '../parts/schema.js';

/** A truss arch's chords in 3D: this deep, and twice this across. */
export const TRUSS_CHORD_MM = 4;
export const TRUSS_HALF_MM = 2;
/** A truss arch's verticals and hangers stand this far apart along the road. */
export const TRUSS_STEP_MM = 12;
/** A cable's lowest point clears the road by this much. */
export const CABLE_SAG_CLEAR_MM = 4;
/** An end cable, from the road up to the first or last tower, sags this share of its rise. */
export const END_CABLE_SAG = 0.12;

export type P3 = readonly [number, number, number];

/** Where a shape's triangles, edges and extent go: the structures' solid mesh, its edges and the bounds. */
export interface Pen {
  quad(a: P3, b: P3, c: P3, d: P3): void;
  /** A crease of the shape's silhouette, drawn at the outline's weight. */
  edge(a: P3, b: P3): void;
  /** A detail line: lighter than an edge, and dropped when its piece is small on screen or down in build mode (design DR1-DR3). */
  detail(a: P3, b: P3): void;
  grow(p: P3): void;
}

/** Where a shape stands: its box laid down in the scene, and the piece's floor and road. */
export interface ShapeFrame {
  /** The point `along` from the box's start, `across` to the left of its middle line, at height `z`. */
  readonly at: (along: number, across: number, z: number) => P3;
  /** The box's length along the piece. */
  readonly lengthMm: number;
  /** The piece's floor, above the table. */
  readonly floorMm: number;
  /** The top of the piece's road `a` along the piece from its start, above the table. */
  readonly roadTop: (a: number) => number;
  readonly plankMm: number;
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

/** A piece's road top `a` along it, above its floor: a bridge's measured profile, else its deck's plank. */
export function roadTopAbove(part: Part, a: number, riseMm: number, plankMm: number): number {
  if (part.kind === 'straight' && part.hump) return profileAt(part.hump.profileMm, a);
  return (part.kind === 'straight' ? (part.deck ?? 0) : 0) * riseMm + plankMm;
}

/**
 * A vault's cross-section (eng D10): its outer and inner outlines, each from
 * one foot over the arch to the other, as (across, height) points; the
 * arch is a half circle on the straight walls. `steps` cuts each half circle.
 */
export function vaultSection(
  widthMm: number, wallMm: number, springMm: number, steps = 12, bore?: DecorVault['bore'], round?: boolean,
): { readonly outer: readonly (readonly [number, number])[]; readonly inner: readonly (readonly [number, number])[] } {
  const ring = (r: number) => {
    const pts: (readonly [number, number])[] = [[-r, 0]];
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI - (Math.PI * i) / steps;
      pts.push([r * Math.cos(a), springMm + r * Math.sin(a)]);
    }
    pts.push([r, 0]);
    return pts;
  };
  if (!bore) return { outer: ring(widthMm / 2), inner: ring(widthMm / 2 - wallMm) };
  // A circle round the bore's centre, as many points as the outside so the end faces pair them: from where it meets the floor, over the top, back to the floor.
  const circle = (r: number) => {
    const low = Math.asin(Math.max(-1, (bore.floorMm - bore.centreMm) / r));
    const pts: (readonly [number, number])[] = [];
    for (let i = 0; i <= steps + 2; i++) {
      // From below the left side (pi - low, low < 0) round through the top to below the right (low).
      const a = Math.PI - low - ((Math.PI - 2 * low) * i) / (steps + 2);
      pts.push([r * Math.cos(a), bore.centreMm + r * Math.sin(a)]);
    }
    return pts;
  };
  return { outer: round ? circle(widthMm / 2) : ring(widthMm / 2), inner: circle(bore.radiusMm) };
}

/** The box's bottom and top, millimetres above the table, or null for wood that is not decoration. */
export function decorSpan(b: Segment, riseMm: number): { readonly zb: number; readonly zt: number } | null {
  if (!b.decor) return null;
  const floor = b.decor.floorLevel * riseMm;
  return { zb: floor + b.decor.bottomMm, zt: floor + b.decor.topMm };
}

/** Draw one shape that has its own drawing, in the frame of the box that carries it. */
export function drawShape(shape: DrawnShape, f: ShapeFrame, pen: Pen): void {
  switch (shape.kind) {
    case 'vault':
      return drawVault(shape, f, pen);
    case 'truss':
      return drawTruss(shape, f, pen);
    case 'arch':
      return drawArch(shape, f, pen);
    case 'towers':
      return drawTowers(shape, f, pen);
    case 'station':
      return drawStation(shape, f, pen);
    case 'barrier':
      return drawBarrier(shape, f, pen);
    case 'canopy':
      return drawCanopy(shape, f, pen);
    case 'wheel':
      return drawWheel(shape, f, pen);
    case 'dome':
      return drawDome(shape, f, pen);
    case 'prism':
      return drawPrism(shape, f, pen);
  }
}

/**
 * A VAULT, drawn round (decorated-pieces plan T5, eng D10): its section
 * swept from one end of its box to the other, outer and inner faces, the
 * arch rings at each end and the feet closed; edged at its two end rings.
 */
function drawVault(v: DecorVault, f: ShapeFrame, pen: Pen): void {
  const len = f.lengthMm;
  const at = (t: number, [across, h]: readonly [number, number]) => f.at(t, across, f.floorMm + h);
  const { outer, inner } = vaultSection(v.widthMm, v.wallMm, v.springMm, 12, v.bore, v.round);
  const sweep = (ring: readonly (readonly [number, number])[], facing: 1 | -1) => {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [a0, a1, b0, b1] = [at(0, ring[i]!), at(len, ring[i]!), at(0, ring[i + 1]!), at(len, ring[i + 1]!)];
      if (facing === 1) pen.quad(a0, a1, b1, b0);
      else pen.quad(b0, b1, a1, a0);
    }
  };
  sweep(outer, 1);
  sweep(inner, -1);
  for (const t of [0, len]) {
    for (let i = 0; i + 1 < outer.length; i++) pen.quad(at(t, outer[i]!), at(t, outer[i + 1]!), at(t, inner[i + 1]!), at(t, inner[i]!));
    for (const ring of [outer, inner]) for (let i = 0; i + 1 < ring.length; i++) pen.edge(at(t, ring[i]!), at(t, ring[i + 1]!));
  }
  for (const p of outer) for (const t of [0, len]) pen.grow(at(t, p));
  if (v.joints) drawStones(v, f, pen);
}

/** Stone joints stand this far off a vault's outside, clear of its faceted arch. */
export const JOINT_LIFT_MM = 0.3;

/**
 * A VAULT'S STONEWORK (detail plan 2026-11-05): detail lines only, a ring
 * around the outside at each joint along it, and a course along its whole
 * length at each joint up the walls and around the arch.
 */
function drawStones(v: DecorVault, f: ShapeFrame, pen: Pen): void {
  const { ringsMm, wallMm, archDeg } = v.joints!;
  const len = f.lengthMm;
  const r = v.widthMm / 2 + JOINT_LIFT_MM;
  const at = (t: number, across: number, h: number) => f.at(t, across, f.floorMm + h);
  const { outer } = vaultSection(2 * r, v.wallMm, v.springMm, 12, v.bore, v.round);
  for (const t of ringsMm) for (let i = 0; i + 1 < outer.length; i++) pen.detail(at(t, ...outer[i]!), at(t, ...outer[i + 1]!));
  for (const h of wallMm) for (const side of [r, -r]) pen.detail(at(0, side, h), at(len, side, h));
  for (const deg of archDeg) {
    const th = (deg * Math.PI) / 180;
    pen.detail(at(0, r * Math.cos(th), v.springMm + r * Math.sin(th)), at(len, r * Math.cos(th), v.springMm + r * Math.sin(th)));
  }
}

/**
 * A TRUSS ARCH OVER THE DECK (Sydney bridge plan 2026-11-03): two curved
 * chords either side of the road, outer and inner, meeting where the arch
 * springs low on the portals; verticals between them, hangers from the
 * inner chord down to the road, and braces across between the two outer
 * chords. Chords in the house matte, the rest as lines. A cut arch is drawn
 * only from `drawnFromMm` to `drawnToMm`, closed by a line across its chords
 * at each cut.
 */
function drawTruss(t: DecorTruss, f: ShapeFrame, pen: Pen): void {
  const { fromMm, toMm, springMm, crownMm, innerCrownMm, sideMm } = t;
  const floor = f.floorMm;
  const lo = t.drawnFromMm ?? fromMm, hi = t.drawnToMm ?? toMm;
  // Along the piece, from its start: the box starts where the drawn stretch does.
  const at = (a: number, across: number, z: number) => f.at(a - lo, across, z);
  const shown = (a: number) => a > lo && a < hi;
  /** A circular chord through both springings and its crown, as height above the table. */
  const chord = (crown: number) => {
    const half = (toMm - fromMm) / 2, rise = crown - springMm;
    if (t.parabolic) return (a: number) => floor + springMm + rise * (1 - ((a - fromMm - half) / half) ** 2);
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
        const a0 = Math.max(lo, along(i)), a1 = Math.min(hi, along(i + 1));
        if (a0 >= a1) continue;
        // Corners: [in-top, in-bottom, out-top, out-bottom] at each end of the step.
        const ring = (a: number) => [-1, 1].flatMap((d) => [[a, top(a)], [a, top(a) - TRUSS_CHORD_MM]].map(([aa, z]) => at(aa!, side * sideMm + d * TRUSS_HALF_MM, z!)));
        const [p0, p1, p2, p3] = ring(a0) as [P3, P3, P3, P3];
        const [q0, q1, q2, q3] = ring(a1) as [P3, P3, P3, P3];
        pen.quad(p0, q0, q2, p2);
        pen.quad(p1, p3, q3, q1);
        pen.quad(p0, p1, q1, q0);
        pen.quad(p2, q2, q3, p3);
        for (const p of ring(a0)) pen.grow(p);
        for (const d of [1, -1]) pen.edge(at(a0, side * sideMm + d * TRUSS_HALF_MM, top(a0)), at(a1, side * sideMm + d * TRUSS_HALF_MM, top(a1)));
      }
    }
    // A cut end closed by a line across the chords.
    for (const a of [lo, hi]) if (a > fromMm && a < toMm) pen.edge(at(a, side * sideMm, outer(a) - TRUSS_CHORD_MM), at(a, side * sideMm, inner(a)));
    for (let i = 1; i < steps; i++) {
      const a = along(i), c = side * sideMm;
      if (!shown(a)) continue;
      const roadTop = f.roadTop(a);
      pen.edge(at(a, c, outer(a) - TRUSS_CHORD_MM), at(a, c, inner(a)));
      if (t.hangers === undefined && inner(a) - TRUSS_CHORD_MM > roadTop) pen.edge(at(a, c, inner(a) - TRUSS_CHORD_MM), at(a, c, roadTop));
      if (t.braced !== false && side === 1 && i % 2 === 0 && outer(a) - TRUSS_CHORD_MM > roadTop + 40) pen.edge(at(a, sideMm, outer(a) - TRUSS_CHORD_MM), at(a, -sideMm, outer(a) - TRUSS_CHORD_MM));
    }
    // A set count of hangers, evenly spaced between the springings.
    for (let i = 1; i <= (t.hangers ?? 0); i++) {
      const a = fromMm + ((toMm - fromMm) * i) / (t.hangers! + 1), c = side * sideMm;
      const top = inner(a) - TRUSS_CHORD_MM, bottom = f.roadTop(a);
      if (top <= bottom || !shown(a)) continue;
      if (t.hangerMm === undefined) {
        pen.edge(at(a, c, top), at(a, c, bottom));
        continue;
      }
      // A flat bar: its two faces in the rib's plane, edged round.
      const w = t.hangerMm / 2;
      for (const d of [1, -1]) {
        const y = c + d * TRUSS_HALF_MM;
        const [p, q, r, s] = [at(a - w, y, bottom), at(a + w, y, bottom), at(a + w, y, top), at(a - w, y, top)];
        if (d === 1) pen.quad(p, q, r, s);
        else pen.quad(s, r, q, p);
        pen.edge(p, s);
        pen.edge(q, r);
      }
    }
  }
}

/**
 * A BRIDGE'S ARCH (bridges eng D5, D9; design DD6): a curved band under the
 * span, its top meeting the road's underside, as wide as the stones.
 */
function drawArch(arch: DecorArch, f: ShapeFrame, pen: Pen): void {
  const { fromMm, toMm, riseMm: archRise, depthMm, baseMm } = arch;
  const half = arch.widthMm / 2;
  const base = f.floorMm + baseMm;
  const chord = toMm - fromMm;
  const radius = (chord * chord / 4 + archRise * archRise) / (2 * archRise);
  const under = (a: number) => {
    const d = a - (fromMm + toMm) / 2;
    return base + archRise - (radius - Math.sqrt(Math.max(0, radius * radius - d * d)));
  };
  const band = Math.max(1, depthMm - f.plankMm);
  // A panel is filled to a flat top; a bridge's arch is a band under its road.
  const fill = arch.fillToMm === undefined ? null : f.floorMm + arch.fillToMm;
  const steps = 24;
  const at = (a: number, side: 1 | -1, z: number) => f.at(a - fromMm, half * side, z);
  if (fill !== null) {
    for (const a of [fromMm, toMm]) {
      pen.quad(at(a, 1, base), at(a, -1, base), at(a, -1, fill), at(a, 1, fill));
      for (const side of [1, -1] as const) pen.edge(at(a, side, base), at(a, side, fill));
    }
  }
  for (let i = 0; i < steps; i++) {
    const a0 = fromMm + (chord * i) / steps, a1 = fromMm + (chord * (i + 1)) / steps;
    const lo0 = under(a0), lo1 = under(a1);
    const hi0 = fill ?? lo0 + band, hi1 = fill ?? lo1 + band;
    pen.quad(at(a0, 1, lo0), at(a1, 1, lo1), at(a1, -1, lo1), at(a0, -1, lo0));
    pen.quad(at(a0, 1, hi0), at(a0, -1, hi0), at(a1, -1, hi1), at(a1, 1, hi1));
    for (const side of [1, -1] as const) {
      pen.quad(at(a0, side, lo0), at(a1, side, lo1), at(a1, side, hi1), at(a0, side, hi0));
      pen.edge(at(a0, side, lo0), at(a1, side, lo1));
      pen.edge(at(a0, side, hi0), at(a1, side, hi1));
    }
    pen.grow(at(a0, 1, hi0));
  }
}

/**
 * A SUSPENSION BRIDGE'S TOWERS AND CABLES (bridges plan B-T6; design DD6):
 * each tower two square posts either side of the road, from its base up to
 * its height, joined at the top and above the train's opening; the cables
 * hang from tower top to tower top on both sides, sagging to just above the
 * road, and run down to the road where the side spans begin. Lines for the
 * cables and hangers, the house matte for the posts.
 */
function drawTowers(sh: DecorTowers, f: ShapeFrame, pen: Pen): void {
  const { towers, cableFromMm, cableToMm } = sh;
  const postHalf = sh.postMm / 2, spread = sh.spreadMm;
  const floor = f.floorMm;
  const at = (a: number, side: number, z: number) => f.at(a - cableFromMm, side, z);
  const road = f.roadTop;
  const box = (a: number, side: number, halfMm: number, z0: number, z1: number) => {
    const c = [[-halfMm, -halfMm], [halfMm, -halfMm], [halfMm, halfMm], [-halfMm, halfMm]].map(([da, ds]) => [a + da!, side + ds!] as const);
    const lo = c.map(([ca, cs]) => at(ca, cs, z0));
    const hi = c.map(([ca, cs]) => at(ca, cs, z1));
    pen.quad(hi[0]!, hi[1]!, hi[2]!, hi[3]!);
    for (let i = 0; i < 4; i++) pen.quad(lo[i]!, lo[(i + 1) % 4]!, hi[(i + 1) % 4]!, hi[i]!);
    for (const [ca, cs] of c) pen.edge(at(ca, cs, z0), at(ca, cs, z1));
  };
  for (const t of towers) {
    const top = floor + t.heightMm;
    const base = road(t.atMm) - f.plankMm;
    for (const side of [spread, -spread]) box(t.atMm, side, postHalf, base, top);
    // Crossbeams: at the top, and over the train's opening.
    for (const z0 of [top - 2 * postHalf, road(t.atMm) + sh.openingMm]) {
      const z1 = z0 + 2 * postHalf;
      const c = [[t.atMm - postHalf, -spread], [t.atMm + postHalf, -spread], [t.atMm + postHalf, spread], [t.atMm - postHalf, spread]] as const;
      const lo = c.map(([a, s]) => at(a, s, z0));
      const hi = c.map(([a, s]) => at(a, s, z1));
      pen.quad(hi[0]!, hi[1]!, hi[2]!, hi[3]!);
      for (let i = 0; i < 4; i++) pen.quad(lo[i]!, lo[(i + 1) % 4]!, hi[(i + 1) % 4]!, hi[i]!);
    }
    pen.grow(at(t.atMm, spread, top));
  }
  // Cables: from the road where the climb starts, over each tower top, back down at the far end.
  const anchors: (readonly [number, number])[] = [
    [cableFromMm, road(cableFromMm) + 2],
    ...towers.map((t) => [t.atMm, floor + t.heightMm - postHalf] as const),
    [cableToMm, road(cableToMm) + 2],
  ];
  for (const side of [spread, -spread]) {
    for (let k = 0; k + 1 < anchors.length; k++) {
      const [a0, z0] = anchors[k]!, [a1, z1] = anchors[k + 1]!;
      const low = (a: number) => road(a) + CABLE_SAG_CLEAR_MM;
      const n = 16;
      let prev: P3 | null = null;
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
        if (prev) pen.edge(prev, p);
        // Hangers: down to the road every few centimetres.
        if (i > 0 && i < n && i % 2 === 0) pen.edge(p, at(a, side, road(a)));
        prev = p;
      }
    }
  }
}

/** A shape's own point: along, across and up, in whatever frame the shape keeps. */
type Place = (along: number, across: number, z: number) => P3;

/** A solid box between two corners of a shape's own frame, its twelve creases edged unless told not to. */
function boxDrawer(P: Place, pen: Pen) {
  return (al: number, ah: number, cl: number, ch: number, zl: number, zh: number, edges = true): void => {
    const c = [P(al, cl, zl), P(ah, cl, zl), P(ah, ch, zl), P(al, ch, zl), P(al, cl, zh), P(ah, cl, zh), P(ah, ch, zh), P(al, ch, zh)] as const;
    const q = (i: number, j: number, k: number, l: number) => pen.quad(c[i]!, c[j]!, c[k]!, c[l]!);
    q(4, 5, 6, 7); q(0, 1, 5, 4); q(1, 2, 6, 5); q(2, 3, 7, 6); q(3, 0, 4, 7); q(3, 2, 1, 0);
    if (edges) for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const) pen.edge(c[i]!, c[j]!);
    for (const p of c) pen.grow(p);
  };
}

/** Steps cutting a station roof's half-round barrel: enough to read round, few enough for the budget. */
export const BARREL_STEPS = 12;

/**
 * A STATION BUILDING (station detail pilot; design DR1, DR6, DR7): solids in
 * the house's one fill, its silhouette as edges, its detail as lighter lines.
 *
 *   walls ── four boxes' worth, the long walls cut around their openings,
 *            a lintel over each opening (DR6: an opening is a real hole)
 *   roof  ── a slab, then a half-round barrel along the hall, its ends closed
 *   vents ── square, from the barrel's surface up to their tops
 *   tower ── a box with a square clock recessed in its track face (DR7),
 *            hands as detail lines, under its stepped cap
 *   sign, platform lines ── detail lines only: flat paint, no geometry
 *
 * Positions are the shape's own (along from the hall's centre, across toward
 * the track); the frame's `at` takes along from the box's start.
 */
function drawStation(st: DecorStation, f: ShapeFrame, pen: Pen): void {
  const a0 = f.lengthMm / 2;
  const P = (along: number, across: number, z: number): P3 => f.at(a0 + along, across, f.floorMm + z);
  const box = boxDrawer(P, pen);
  const rect = (corners: readonly P3[]) => corners.forEach((p, i) => pen.detail(p, corners[(i + 1) % corners.length]!));

  // Walls: the long walls cut around their openings, a lintel over each; the end walls whole.
  const { hall } = st;
  const L = hall.lengthMm / 2, W = hall.widthMm / 2, t = hall.wallMm;
  for (const side of [1, -1] as const) {
    const [cl, ch] = side === 1 ? [W - t, W] : [-W, -W + t];
    const holes = st.openings.filter((o) => o.side === side).sort((x, y) => x.fromMm - y.fromMm);
    let from = -L;
    for (const o of holes) {
      box(from, o.fromMm, cl, ch, hall.bottomMm, hall.topMm);
      box(o.fromMm, o.toMm, cl, ch, o.topMm, hall.topMm);
      from = o.toMm;
    }
    box(from, L, cl, ch, hall.bottomMm, hall.topMm);
  }
  for (const end of [1, -1] as const) box(end === 1 ? L - t : -L, end === 1 ? L : -L + t, -W + t, W - t, hall.bottomMm, hall.topMm);

  // Roof: the slab, then the barrel on it, its ends closed.
  const { roof } = st;
  const RL = roof.lengthMm / 2, RW = roof.widthMm / 2, r = roof.radiusMm;
  const z0 = hall.topMm + roof.baseMm;
  box(-RL, RL, -RW, RW, hall.topMm, z0);
  const arc = Array.from({ length: BARREL_STEPS + 1 }, (_, k) => {
    const th = (Math.PI * k) / BARREL_STEPS;
    return [r * Math.cos(th), z0 + r * Math.sin(th)] as const;
  });
  for (let k = 0; k < BARREL_STEPS; k++) {
    const [c1, h1] = arc[k]!, [c2, h2] = arc[k + 1]!;
    pen.quad(P(-RL, c1, h1), P(RL, c1, h1), P(RL, c2, h2), P(-RL, c2, h2));
    for (const e of [-RL, RL]) {
      pen.quad(P(e, c1, h1), P(e, c2, h2), P(e, 0, z0), P(e, 0, z0));
      pen.edge(P(e, c1, h1), P(e, c2, h2));
    }
  }
  for (const c of [r, -r]) pen.edge(P(-RL, c, z0), P(RL, c, z0));
  for (const [c, h] of arc) for (const e of [-RL, RL]) pen.grow(P(e, c, h));

  // Vents: from the barrel's surface where they stand, sunk 1 into it.
  for (const v of st.vents) {
    const [va, vc] = v.atMm;
    const h = v.sizeMm / 2;
    const base = z0 + Math.sqrt(Math.max(0, r * r - Math.max(vc - h, -vc - h, 0) ** 2)) - 1;
    box(va - h, va + h, vc - h, vc + h, Math.min(base, v.topMm - 1), v.topMm);
  }

  // Tower: four faces and a top, its track face framing a square clock set in (DR7), the hands as detail.
  const { tower, clock } = st;
  const [ta, tc] = tower.atMm;
  const s2 = tower.sizeMm / 2, k2 = clock.sizeMm / 2, front = tc + s2, back = tc - s2;
  const zb = tower.bottomMm, zt = tower.topMm, cz = clock.centreMm;
  const T = (al: number, ac: number, z: number) => P(ta + al, ac, z);
  pen.quad(T(-s2, back, zt), T(s2, back, zt), T(s2, front, zt), T(-s2, front, zt));
  pen.quad(T(-s2, back, zb), T(s2, back, zb), T(s2, back, zt), T(-s2, back, zt));
  for (const e of [-s2, s2]) pen.quad(T(e, back, zb), T(e, front, zb), T(e, front, zt), T(e, back, zt));
  // The track face around the clock's square: four panels.
  pen.quad(T(-s2, front, zb), T(s2, front, zb), T(s2, front, cz - k2), T(-s2, front, cz - k2));
  pen.quad(T(-s2, front, cz + k2), T(s2, front, cz + k2), T(s2, front, zt), T(-s2, front, zt));
  pen.quad(T(-s2, front, cz - k2), T(-k2, front, cz - k2), T(-k2, front, cz + k2), T(-s2, front, cz + k2));
  pen.quad(T(k2, front, cz - k2), T(s2, front, cz - k2), T(s2, front, cz + k2), T(k2, front, cz + k2));
  // The recess: its four sides and its face.
  const d = front - clock.recessMm;
  const sq = [[-k2, cz - k2], [k2, cz - k2], [k2, cz + k2], [-k2, cz + k2]] as const;
  for (let i = 0; i < 4; i++) {
    const [p1, q1] = sq[i]!, [p2, q2] = sq[(i + 1) % 4]!;
    pen.quad(T(p1, front, q1), T(p2, front, q2), T(p2, d, q2), T(p1, d, q1));
  }
  pen.quad(T(-k2, d, cz - k2), T(k2, d, cz - k2), T(k2, d, cz + k2), T(-k2, d, cz + k2));
  for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const) {
    const c = [T(-s2, back, zb), T(s2, back, zb), T(s2, front, zb), T(-s2, front, zb), T(-s2, back, zt), T(s2, back, zt), T(s2, front, zt), T(-s2, front, zt)];
    pen.edge(c[i]!, c[j]!);
  }
  rect(sq.map(([p, q]) => T(p, front, q)));
  // Hands, from the face's centre: the hour hand up, the minute hand toward two.
  pen.detail(T(0, d, cz), T(0, d, cz + k2 * 0.55));
  pen.detail(T(0, d, cz), T(k2 * 0.7 * Math.sin(Math.PI / 3), d, cz + k2 * 0.7 * Math.cos(Math.PI / 3)));
  for (const c of st.cap) box(ta - c.sizeMm / 2, ta + c.sizeMm / 2, tc - c.sizeMm / 2, tc + c.sizeMm / 2, c.bottomMm, c.topMm);

  // The sign on the track-side wall, and the platform's painted lines: paint, so lines only.
  const sg = st.sign;
  rect([P(sg.fromMm, W + 0.2, sg.bottomMm), P(sg.toMm, W + 0.2, sg.bottomMm), P(sg.toMm, W + 0.2, sg.topMm), P(sg.fromMm, W + 0.2, sg.topMm)]);
  for (const ln of st.lines) {
    const hl = ln.lengthMm / 2, hw = ln.widthMm / 2, z = ln.heightMm + 0.05;
    rect([P(-hl, ln.acrossMm - hw, z), P(hl, ln.acrossMm - hw, z), P(hl, ln.acrossMm + hw, z), P(-hl, ln.acrossMm + hw, z)]);
  }
}

/** Sides cutting a barrier's round base and its arm's hinge disc. */
export const ROUND_STEPS = 16;

/**
 * A LEVEL CROSSING'S BARRIER (detail plan 2026-11-05): a round base, a
 * square post on it, and the arm raised from its hinge in the post's fork,
 * all in the house's one fill; the arm's painted stripes as detail lines on
 * both its wide faces.
 *
 *   arm   ── a bar `widthMm` along the piece, `thickMm` across, from the
 *            hinge up `lengthMm`, over a round hinge disc
 *   post  ── a box, `offsetMm` along from the base's centre, base top to its top
 *   base  ── a round prism from the floor to track height
 *
 * Positions are the shape's own (along from the base's centre, across from
 * it); the frame's `at` takes along from the box's start.
 */
function drawBarrier(br: DecorBarrier, f: ShapeFrame, pen: Pen): void {
  const a0 = f.lengthMm / 2;
  const P: Place = (along, across, z) => f.at(a0 + along, across, f.floorMm + z);
  const box = boxDrawer(P, pen);
  const turn = (k: number) => (2 * Math.PI * k) / ROUND_STEPS;

  // Base: a round prism, its rims edged, its top closed.
  const { base, post, arm } = br;
  const rb = base.diameterMm / 2;
  for (let k = 0; k < ROUND_STEPS; k++) {
    const [c1, s1, c2, s2] = [rb * Math.cos(turn(k)), rb * Math.sin(turn(k)), rb * Math.cos(turn(k + 1)), rb * Math.sin(turn(k + 1))];
    pen.quad(P(c1, s1, 0), P(c2, s2, 0), P(c2, s2, base.topMm), P(c1, s1, base.topMm));
    pen.quad(P(c1, s1, base.topMm), P(c2, s2, base.topMm), P(0, 0, base.topMm), P(0, 0, base.topMm));
    for (const z of [0, base.topMm]) pen.edge(P(c1, s1, z), P(c2, s2, z));
    pen.grow(P(c1, s1, 0));
  }

  // Post: a box on the base.
  const pa = post.offsetMm, ps = post.sizeMm / 2;
  box(pa - ps, pa + ps, -ps, ps, base.topMm, post.topMm);

  // Arm: the hinge disc (a round prism across the piece), then the bar up from it.
  const rd = arm.discMm / 2, t2 = arm.thickMm / 2, w2 = arm.widthMm / 2, h = arm.hingeMm;
  for (let k = 0; k < ROUND_STEPS; k++) {
    const [a1, z1, a2, z2] = [pa + rd * Math.cos(turn(k)), h + rd * Math.sin(turn(k)), pa + rd * Math.cos(turn(k + 1)), h + rd * Math.sin(turn(k + 1))];
    pen.quad(P(a1, -t2, z1), P(a2, -t2, z2), P(a2, t2, z2), P(a1, t2, z1));
    for (const c of [-t2, t2]) {
      pen.quad(P(a1, c, z1), P(a2, c, z2), P(pa, c, h), P(pa, c, h));
      pen.edge(P(a1, c, z1), P(a2, c, z2));
    }
  }
  const top = h + arm.lengthMm;
  box(pa - w2, pa + w2, -t2, t2, h, top);

  // Stripes: paint on both wide faces, each edge slanting up across the bar.
  for (const c of [t2 + 0.05, -t2 - 0.05]) for (const sm of arm.stripesMm) pen.detail(P(pa - w2, c, h + sm), P(pa + w2, c, h + sm + arm.widthMm));
}

/**
 * A CURVED ROOF (elevated station, measured 2026-11-06): its section swept
 * the length of its box, top and underside, closed at both ends and both
 * eaves (faces draw from both sides), with the lip under its first eave. Its outline is edged;
 * the seams between its panels are detail lines over the top.
 */
function drawCanopy(c: DecorCanopy, f: ShapeFrame, pen: Pen): void {
  const len = f.lengthMm;
  const ys = c.sectionMm.map(([y]) => y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const P = (along: number, y: number, z: number): P3 => f.at(along, y - mid, f.floorMm + z);
  const top = c.sectionMm;
  const under = top.map(([y, h]) => [y, h - c.thickMm] as const);
  const n = top.length;
  for (let i = 0; i + 1 < n; i++) {
    const [t0, t1, u0, u1] = [top[i]!, top[i + 1]!, under[i]!, under[i + 1]!];
    pen.quad(P(0, ...t0), P(0, ...t1), P(len, ...t1), P(len, ...t0));
    pen.quad(P(0, ...u0), P(len, ...u0), P(len, ...u1), P(0, ...u1));
    for (const a of [0, len]) {
      pen.quad(P(a, ...t0), P(a, ...u0), P(a, ...u1), P(a, ...t1));
      pen.edge(P(a, ...t0), P(a, ...t1));
      pen.edge(P(a, ...u0), P(a, ...u1));
    }
  }
  // The two eaves, the first carrying its lip down.
  const [y0, h0] = top[0]!;
  const [y1, h1] = top[n - 1]!;
  const lipBottom = h0 - c.thickMm - c.lipMm;
  for (const [y, hi, lo] of [[y0, h0, lipBottom], [y1, h1, h1 - c.thickMm]] as const) {
    pen.quad(P(0, y, hi), P(len, y, hi), P(len, y, lo), P(0, y, lo));
    pen.edge(P(0, y, hi), P(len, y, hi));
    pen.edge(P(0, y, lo), P(len, y, lo));
    for (const a of [0, len]) pen.edge(P(a, y, hi), P(a, y, lo));
  }
  for (const s of c.seamsMm ?? []) {
    const a = len / 2 + s;
    for (let i = 0; i + 1 < n; i++) pen.detail(P(a, ...top[i]!), P(a, ...top[i + 1]!));
  }
  for (const p of [...top, ...under]) for (const a of [0, len]) pen.grow(P(a, ...p));
  for (const a of [0, len]) pen.grow(P(a, y0, lipBottom));
}

/** A wheel's rim, in straight sides; its hub's and knob's rings. */
export const WHEEL_SIDES = 32;
const RING_SIDES = 12;

/**
 * A WHEEL ON A FACE (the elevated station's crank): a disc in its box's
 * middle, its two faces and its rim, each quad turned to face away from the
 * disc's centre; the rim's two rings are its silhouette, the hub and the
 * knob a ring of detail each on both faces.
 *
 *        _---_        along ->, height ^; the disc stands across the piece
 *      /   o   \      o  the hub, at the centre
 *     |    .    |     .  the knob, `knobMm` under the hub
 *      \       /
 *        ---
 */
function drawWheel(w: DecorWheel, f: ShapeFrame, pen: Pen): void {
  const r = w.diameterMm / 2, half = w.thickMm / 2, zc = f.floorMm + w.centreMm, ac = f.lengthMm / 2;
  /*
   * A point (u, v) on its face from its centre, `side` off its middle plane.
   * Standing, v is up: the face across the piece, or along it. Lying flat
   * (`up`), v is across and `side` is up.
   */
  const at: (u: number, side: number, v: number) => P3 =
    w.axis === 'along' ? (u, side, v) => f.at(ac + side, u, zc + v) : w.axis === 'up' ? (u, side, v) => f.at(ac + u, v, zc + side) : (u, side, v) => f.at(ac + u, side, zc + v);
  const ring = (radius: number, below: number, sides: number) =>
    Array.from({ length: sides }, (_, i) => {
      const th = (2 * Math.PI * i) / sides;
      return [radius * Math.cos(th), -below + radius * Math.sin(th)] as const;
    });
  const centre = at(0, 0, 0);
  const out = (a: P3, b: P3, c: P3, d: P3) => {
    // The quad's normal against the way from the centre to its middle: turned round when they disagree.
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const m = [0, 1, 2].map((k) => (a[k]! + c[k]!) / 2 - centre[k]!);
    if (n[0]! * m[0]! + n[1]! * m[1]! + n[2]! * m[2]! >= 0) pen.quad(a, b, c, d);
    else pen.quad(d, c, b, a);
  };
  // The rim, cut flat at `chordMm` from the centre on the +u side when it has a chord.
  const c = w.chordMm;
  const rim: (readonly [number, number])[] = [];
  const whole = ring(r, 0, WHEEL_SIDES);
  for (let i = 0; i < whole.length; i++) {
    const p = whole[i]!, q = whole[(i + 1) % whole.length]!;
    if (c === undefined || p[0] <= c) rim.push(p);
    if (c !== undefined && (p[0] - c) * (q[0] - c) < 0) rim.push([c, p[1] + ((q[1] - p[1]) * (c - p[0])) / (q[0] - p[0])]);
  }
  for (let i = 0; i < rim.length; i++) {
    const [a0, z0] = rim[i]!, [a1, z1] = rim[(i + 1) % rim.length]!;
    out(at(a0, half, z0), at(a1, half, z1), at(a1, -half, z1), at(a0, -half, z0));
    for (const side of [half, -half]) {
      const hub = at(0, side, 0);
      out(hub, at(a0, side, z0), at(a1, side, z1), at(a1, side, z1));
      pen.edge(at(a0, side, z0), at(a1, side, z1));
      pen.grow(at(a0, side, z0));
    }
  }
  const hubs = w.ringsMm ? w.ringsMm.map((d) => ring(d / 2, 0, WHEEL_SIDES)) : [ring(r / 8, 0, RING_SIDES)];
  const details = [...hubs, ...(w.knobMm === undefined ? [] : [ring(r / 8, w.knobMm, RING_SIDES)])];
  for (const d of details) {
    for (const side of [half, -half]) {
      for (let i = 0; i < d.length; i++) pen.detail(at(d[i]![0], side, d[i]![1]), at(d[(i + 1) % d.length]![0], side, d[(i + 1) % d.length]![1]));
    }
  }
}

/**
 * A DOMED ROOF (dome.ts): its top and its underside as grids of quads, a
 * rim round its edge between them, the rim's two edges as its outline.
 */
function drawDome(d: DecorDome, f: ShapeFrame, pen: Pen): void {
  const NU = 20, NV = 20;
  const half = d.lengthMm / 2, mid = f.lengthMm / 2;
  if (d.patches) {
    // Each patch a quad lying on the surface, 0.6 over it, edged round.
    const on = (a: number, c: number): P3 => f.at(mid + a, c, f.floorMm + domeTop(d, a, c) + 0.6);
    for (const [a, c, l, w] of d.patches) {
      const q = [on(a - l / 2, c - w / 2), on(a + l / 2, c - w / 2), on(a + l / 2, c + w / 2), on(a - l / 2, c + w / 2)] as const;
      pen.quad(q[0], q[1], q[2], q[3]);
      for (let k = 0; k < 4; k++) pen.edge(q[k]!, q[(k + 1) % 4]!);
      pen.grow(q[0]);
    }
    return;
  }
  const point = (i: number, j: number, under: boolean): P3 => {
    const u = -1 + (2 * i) / NU, v = -1 + (2 * j) / NV;
    const along = u * half, across = v * domeHalfWidth(d, u);
    return f.at(mid + along, across, f.floorMm + domeTop(d, along, across) - (under ? d.thickMm : 0));
  };
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      pen.quad(point(i, j, false), point(i + 1, j, false), point(i + 1, j + 1, false), point(i, j + 1, false));
      pen.quad(point(i, j + 1, true), point(i + 1, j + 1, true), point(i + 1, j, true), point(i, j, true));
    }
  }
  // The rim: walk the edge round, each step a quad from top to underside, edged on both.
  const rim: [number, number][] = [
    ...Array.from({ length: NU }, (_, i): [number, number] => [i, 0]),
    ...Array.from({ length: NV }, (_, j): [number, number] => [NU, j]),
    ...Array.from({ length: NU }, (_, i): [number, number] => [NU - i, NV]),
    ...Array.from({ length: NV }, (_, j): [number, number] => [0, NV - j]),
  ];
  for (let k = 0; k < rim.length; k++) {
    const [i0, j0] = rim[k]!, [i1, j1] = rim[(k + 1) % rim.length]!;
    pen.quad(point(i0, j0, false), point(i0, j0, true), point(i1, j1, true), point(i1, j1, false));
    pen.edge(point(i0, j0, false), point(i1, j1, false));
    pen.edge(point(i0, j0, true), point(i1, j1, true));
    pen.grow(point(i0, j0, false));
  }
}

/**
 * A PRISM: its convex outline at both ends, its sides between them, each
 * face turned away from the outline's middle; the outline at both ends and
 * the run of each corner as edges.
 */
function drawPrism(p: DecorPrism, f: ShapeFrame, pen: Pen): void {
  const ys = p.sectionMm.map(([y]) => y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const len = f.lengthMm;
  const at = (x: number, [y, z]: readonly [number, number]): P3 => f.at(x, y - mid, f.floorMm + z);
  const n = p.sectionMm.length;
  const cy = p.sectionMm.reduce((s, [y]) => s + y, 0) / n, cz = p.sectionMm.reduce((s, [, z]) => s + z, 0) / n;
  const centre = at(len / 2, [cy, cz]);
  const out = (a: P3, b: P3, c: P3, d: P3) => {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const m = [(a[0] + b[0] + c[0]) / 3 - centre[0], (a[1] + b[1] + c[1]) / 3 - centre[1], (a[2] + b[2] + c[2]) / 3 - centre[2]];
    if (nx * m[0]! + ny * m[1]! + nz * m[2]! >= 0) pen.quad(a, b, c, d);
    else pen.quad(d, c, b, a);
  };
  for (let i = 0; i < n; i++) {
    const a = p.sectionMm[i]!, b = p.sectionMm[(i + 1) % n]!;
    out(at(0, a), at(0, b), at(len, b), at(len, a));
    for (const x of [0, len]) {
      pen.edge(at(x, a), at(x, b));
      if (i > 0 && i + 1 < n) out(at(x, p.sectionMm[0]!), at(x, a), at(x, b), at(x, b));
    }
    pen.edge(at(0, a), at(len, a));
    pen.grow(at(0, a));
    pen.grow(at(len, a));
  }
}
