/**
 * THE 3D VIEW (docs/plan/2026-10-31-3d-viewer.md). Loaded lazily: this file
 * and Three.js are the lazy chunk, and nothing else in the app may import
 * either (eng D11; `view3dImports.test.ts` enforces it with the TypeScript
 * parser).
 *
 * Plain three in one component (eng D19): the effect owns the renderer,
 * camera and controls; `syncScene` swaps the scene's contents when the layout
 * changes and disposes what it replaces (eng D16); unmounting disposes all
 * (eng D12). It draws only on change: no animation loop, no damping, no
 * fly-in (design 20A, DESIGN.md rule 8).
 *
 * THE LOOK (design 13A-19A, 25A): unlit, flat colour read from the CSS tokens
 * at runtime, so no colour is written here; marks are the 2D canvas's own
 * glyphs on camera-facing sprites, always on top, at a fixed screen size.
 *
 * PICKING (P3, pick in 3D): a press that lets go where it started is a click,
 * and a click on wood selects that piece in the editor; one that moved is the
 * view being turned, and picks nothing.
 *
 *   pointerdown ──> pointermove (moved past CLICK_SLOP_PX? then a turn) ──> pointerup
 *                                                                              │ a click
 *   ray from the camera ──> meshes hit, nearest first ──> pieceOfHits ──> onPick(pieceId)
 *
 * The wood is merged into one buffer per material (eng D20), so a mesh says
 * which piece a triangle is by `userData.pieceRanges`; so does every
 * building, which picks its own piece (design DR4, eng E-B2). Grooves, beams
 * and footprints let the ray through to the wood they belong to, and anything
 * else hit first (the table) means nothing is picked. Lines, a bridge's
 * cables among them, are never picked (eng Y3).
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  GreaterDepth,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { buildScene, type Box, type Mesh as MeshArrays, type PlacedMark, type SceneArrays, type SceneInput } from '../../engine/src/view3d/mesh.js';

/** Thrown when the browser cannot make a WebGL context; the panel says so (eng D9). */
export class WebGLUnavailable extends Error {
  override name = 'WebGLUnavailable';
}

/** The token colours the scene uses, read once per mount (design 13A). */
export interface SceneColors {
  readonly floor: string;
  readonly trackFill: string;
  readonly trackEdge: string;
  readonly trackGroove: string;
  readonly trackShadow: string;
  readonly seam: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly paper: string;
  readonly paperSunk: string;
  readonly fail: string;
  readonly slabSide: string;
  /** `--ghost-opacity`: the preview's translucency, for the next piece seen through track (D28, D42). */
  readonly ghostOpacity?: number;
  /**
   * Every paint a built-in piece names, by token (`paintTokens`, the
   * library's `PAINT_TOKENS`), read once at mount so a piece painted after
   * mount is already resolved (paint plan O2). Absent in tests that pass
   * their own colours: a paint then draws in `ink`.
   */
  readonly paints?: Readonly<Record<string, string>>;
}

export function tokenColors(root: Element = document.documentElement, paintTokens: readonly string[] = []): SceneColors {
  const css = getComputedStyle(root);
  const read = (name: string) => css.getPropertyValue(name).trim();
  // A missing token says so and draws in ink, inside the palette, rather than
  // in a black nobody chose (DESIGN.md rule 1; design review D2).
  const v = (name: string) => {
    const got = read(name);
    if (got) return got;
    console.error(`3D view: the colour token ${name} is missing; drawing it in --ink.`);
    return read('--ink') || '#000';
  };
  return {
    floor: v('--floor'),
    trackFill: v('--track-fill'),
    trackEdge: v('--track-edge'),
    trackGroove: v('--track-groove'),
    trackShadow: v('--track-shadow'),
    seam: v('--seam'),
    ink: v('--ink'),
    inkSoft: v('--ink-soft'),
    paper: v('--paper'),
    paperSunk: v('--paper-sunk'),
    fail: v('--fail'),
    slabSide: v('--slab-side'),
    ghostOpacity: Number.parseFloat(read('--ghost-opacity')) || 0.5,
    paints: Object.fromEntries(paintTokens.map((t) => [t, v(t)])),
  };
}

/** Field of view, degrees: narrow, so the drawing distorts little (design 21A). */
export const FOV_DEG = 30;
/** The starting elevation, degrees, looking across the plan from its bottom edge (21A). */
export const START_ELEVATION_DEG = 35;
/**
 * A layout with raised track starts lower, so its height shows before anyone
 * turns the view: at 35 degrees a 64mm level over a metre of plan read as a
 * thin strip (design review 2026-10-31, D1; the owner's call on 21A).
 */
export const START_ELEVATION_RAISED_DEG = 25;

/** The starting elevation for a scene: lower when any track is raised, which is when it draws footprints (18A). */
export function startElevationDeg(arrays: SceneArrays): number {
  return arrays.footprints.indices.length > 0 ? START_ELEVATION_RAISED_DEG : START_ELEVATION_DEG;
}
/** Tilt limits as elevation, degrees: never under the table, never straight down (21A). */
export const MIN_ELEVATION_DEG = 10;
export const MAX_ELEVATION_DEG = 85;
/** A mark's on-screen size, CSS px: the 2D canvas's r=28 clash ring at its 0.75px/mm floor is 42px. */
export const MARK_PX = 44;
/** Line widths, CSS px: seams 2.5 (design 26A), level line 2 (16A), slab outline 1.5, the next piece's edge 3 (D42). */
const SEAM_PX = 2.5;
const NEXT_EDGE_PX = 3;
/** The selected piece's outline: the 2D selection's 3px ink (DESIGN.md), in 3D. */
export const SELECTED_PX = 3;
const LEVEL_LINE_PX = 2;
const OUTLINE_PX = 1.5;
/** A building's detail lines, under its 1.5px outline so track reads first (design DR1). */
export const DETAIL_PX = 1;
/** Detail shows only while a millimetre at its piece is at least this many pixels: lines ~4px apart (design DR3). */
export const DETAIL_MIN_PX_PER_MM = 1.5;

/** Pixels per millimetre at `centre`, for a perspective camera drawing into a viewport `heightPx` tall. */
export function pxPerMmAt(camera: PerspectiveCamera, centre: Vector3, heightPx: number): number {
  const distance = camera.position.distanceTo(centre);
  return heightPx / (2 * Math.max(distance, 1e-6) * Math.tan((camera.fov * Math.PI) / 360));
}

/** Whether detail shows at this scale: at the threshold and over it (design DR3). */
export const detailShown = (pxPerMm: number): boolean => pxPerMm >= DETAIL_MIN_PX_PER_MM;

/**
 * Show each piece's detail lines only while that piece is big enough in THIS
 * pass's camera and viewport (eng E-B1, Y2): the main view and build mode's
 * inset decide separately, just before each renders.
 */
export function showDetailFor(group: Group, camera: PerspectiveCamera, heightPx: number): void {
  const at = new Vector3();
  for (const o of group.children) {
    const c = o.userData.detailCentre as readonly [number, number, number] | undefined;
    if (c) o.visible = detailShown(pxPerMmAt(camera, at.set(c[0], c[1], c[2]), heightPx));
  }
}

function geometryOf(m: MeshArrays): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(m.positions, 3));
  g.setIndex(new BufferAttribute(m.indices, 1));
  return g;
}

function flat(color: string, opts: { side?: boolean; depthTest?: boolean; hiddenOnly?: number; vertexColors?: boolean } = {}): MeshBasicMaterial {
  // Both sides: the builder's winding is not consistent, and unlit faces have no back to hide.
  const see = opts.hiddenOnly !== undefined;
  return new MeshBasicMaterial({
    // With vertex colours the base is white, so each vertex shows its own paint (paint plan R2).
    color: new Color(opts.vertexColors ? '#ffffff' : color),
    vertexColors: opts.vertexColors === true,
    side: 2,
    depthTest: opts.depthTest ?? true,
    // Drawn only behind what is already there, at this opacity: a piece shows through what hides it, and nowhere else.
    ...(see ? { transparent: true, opacity: opts.hiddenOnly, depthWrite: false, depthFunc: GreaterDepth } : {}),
  });
}

function lines(positions: Float32Array, color: string, px: number, depthTest = true, colors?: Float32Array): LineSegments2 {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions);
  // Per-vertex colours (painted outlines, design D6) multiply a white base, in linear values as `Color` holds them.
  if (colors) g.setColors(colors);
  const m = new LineMaterial({ color: colors ? 0xffffff : new Color(color).getHex(), linewidth: px, depthTest, vertexColors: colors !== undefined });
  return new LineSegments2(g, m);
}

/** A paper line this much wider than the line it backs: 2px each side (paint plan R5, O1, O3). */
export const HALO_PX = 4;

/**
 * One linear RGB triple a vertex, from paint indices into `paints`: 0 is
 * `base`, any other a token resolved through `c.paints`, or ink when a test
 * passed no paints (paint plan R2, design D6).
 */
export function paintColors(index: Uint8Array, paints: readonly string[], base: string, c: SceneColors): Float32Array {
  const resolved = paints.map((t, i) => new Color(i === 0 ? base : (c.paints?.[t] ?? c.ink)));
  const out = new Float32Array(index.length * 3);
  index.forEach((k, v) => {
    const col = resolved[k] ?? resolved[0]!;
    out[v * 3] = col.r;
    out[v * 3 + 1] = col.g;
    out[v * 3 + 2] = col.b;
  });
  return out;
}

/** The 2D canvas's mark shapes (TrackCanvas `RedMark` and the adapter diamond), as SVG path data. */
const SHAPES: Record<PlacedMark['kind'], { r: number; d: string; ink: 'fail' | 'ink' } | null> = {
  clash: { r: 28, d: 'M -14 -14 L 14 14 M -14 14 L 14 -14', ink: 'fail' },
  overlap: { r: 28, d: 'M -14 -14 L 14 14 M -14 14 L 14 -14', ink: 'fail' },
  refused: { r: 18, d: 'M -10 0 L 10 0', ink: 'fail' },
  level: { r: 18, d: 'M -10 -4 H 0 V 4 H 10', ink: 'fail' },
  third: { r: 18, d: 'M -7 -2 L 0 5 L 7 -2 M -7 -9 L 0 -2 L 7 -9', ink: 'fail' },
  adapter: { r: 16, d: 'M 0 -16 L 16 0 L 0 16 L -16 0 Z', ink: 'ink' },
  // The armed end's ring (D43): the end the next piece clips onto. No glyph.
  join: { r: 16, d: '', ink: 'ink' },
  gap: null,
};

/** A gap figure's text size and its label's side padding, CSS px. */
const FIGURE_PX = 15;
const LABEL_PAD_PX = 8;

/** A gap's figure as the 2D canvas writes it: rounded so it never understates (DESIGN.md rule 4). */
export const figureText = (mm: number) => `${Math.ceil(mm)}mm`;

/** Monospace width when no canvas can measure: 0.6em a character. */
export const estimateTextPx = (text: string) => text.length * FIGURE_PX * 0.6;

/**
 * A label's width over its height. A mark is MARK_PX square; a gap's figure is
 * as wide as its text plus padding, so "1000mm" is never cut (design review
 * FINDING-007: every mark was a 44px square, which clipped long figures).
 */
export const labelAspect = (textPx: number) => Math.max(1, (textPx + 2 * LABEL_PAD_PX) / MARK_PX);

/** A mark's texture and its width over height: the canvas glyph on a --paper disc (design 14A), or a gap's figure on a --paper pill. */
function markTexture(mark: PlacedMark, c: SceneColors, dpr: number): { map: CanvasTexture; aspect: number } | null {
  if (typeof document === 'undefined') return null;
  const shape = SHAPES[mark.kind];
  const font = `600 ${Math.round(FIGURE_PX * dpr)}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-data').trim() || 'monospace'}`;
  const text = mark.figure !== undefined ? figureText(mark.figure) : '';
  const probe = document.createElement('canvas').getContext('2d');
  if (probe) probe.font = font;
  const aspect = shape || !text ? 1 : labelAspect((probe ? probe.measureText(text).width : estimateTextPx(text) * dpr) / dpr);
  const h = Math.round(MARK_PX * dpr);
  const w = Math.round(MARK_PX * aspect * dpr);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.translate(w / 2, h / 2);
  const unit = h / 64; // the 2D shapes are drawn in a 64-unit box
  g.fillStyle = c.paper;
  g.beginPath();
  if (shape) g.arc(0, 0, 31 * unit, 0, Math.PI * 2);
  else g.roundRect(-w / 2, -h / 2 + 6 * unit, w, h - 12 * unit, (h - 12 * unit) / 2);
  g.fill();
  if (shape) {
    g.scale(unit, unit);
    g.lineWidth = 3 / unit * dpr;
    g.strokeStyle = shape.ink === 'fail' ? c.fail : c.ink;
    g.beginPath();
    g.arc(0, 0, shape.r, 0, Math.PI * 2);
    g.stroke();
    const p = typeof Path2D === 'undefined' ? null : new Path2D(shape.d);
    if (p) {
      if (mark.kind === 'adapter') {
        g.fillStyle = c.ink;
        g.fill(new Path2D('M 0 -5 L 5 0 L 0 5 L -5 0 Z'));
      }
      g.stroke(p);
    }
  } else if (text) {
    g.fillStyle = c.ink;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, 0);
  }
  return { map: new CanvasTexture(canvas), aspect };
}

/**
 * Replace the group's contents with the scene for `arrays`, disposing every
 * geometry, material and texture it replaces (eng D16). Exported for the node
 * test, which counts disposals with real three objects and no WebGL.
 */
export function syncScene(group: Group, arrays: SceneArrays, c: SceneColors, dpr = 1): void {
  disposeChildren(group);
  const add = (o: Object3D, order = 0) => {
    o.renderOrder = order;
    group.add(o);
  };
  // What a pick reads (see PICKING): the wood names its pieces, the rest lets the ray through.
  const wood = (o: Mesh, ranges: SceneArrays['pieceRanges']) => {
    o.userData.pieceRanges = ranges;
    return o;
  };
  const through = (o: Mesh) => {
    o.userData.pickThrough = true;
    return o;
  };
  // A line that must read on any paint: a wider paper line under it, one order below (paint plan R5, O1, O3).
  const haloed = (positions: Float32Array, color: string, px: number, depthTest: boolean, order: number) => {
    add(lines(positions, c.paper, px + HALO_PX, depthTest), order - 1);
    add(lines(positions, color, px, depthTest), order);
  };
  if (arrays.slab) {
    add(new Mesh(geometryOf(arrays.slab.top), flat(c.paperSunk)));
    add(new Mesh(geometryOf(arrays.slab.side), flat(c.slabSide)));
    if (arrays.slab.overhang) haloed(arrays.slab.outline.positions, c.fail, OUTLINE_PX, true, 1);
    else add(lines(arrays.slab.outline.positions, c.inkSoft, OUTLINE_PX), 1);
  }
  add(through(new Mesh(geometryOf(arrays.footprints), flat(c.trackShadow))), 1);
  // Structures (design decision 7): matte boxes in the slab's side colour, roofs as an outline and a rim.
  // A painted piece's vertices carry their paint; every other vertex the slab's side colour (paint plan R2).
  // A building is wood for a pick: a tap on it selects its piece (design DR4, eng E-B2).
  const st = arrays.structures;
  const solidGeometry = geometryOf(st.solid);
  solidGeometry.setAttribute('color', new BufferAttribute(paintColors(st.solidPaint, st.paints, c.slabSide, c), 3));
  add(wood(new Mesh(solidGeometry, flat(c.slabSide, { vertexColors: true })), st.solidRanges), 1);
  add(wood(new Mesh(geometryOf(st.rim), flat(c.slabSide)), st.rimRanges), 1);
  // Outlines and detail in each paint's own line colour, --ink-soft elsewhere (design D6).
  const lineColors = (index: Uint8Array) => paintColors(index, st.paints, c.inkSoft, c);
  if (st.edges.positions.length > 0) add(lines(st.edges.positions, c.inkSoft, OUTLINE_PX, true, lineColors(st.edgePaint)), 2);
  // Detail, one object per piece, so each is shown by its own size on screen (DR1, DR3; eng E-B1).
  for (const d of st.detail) {
    const l = lines(d.positions, c.inkSoft, DETAIL_PX, true, lineColors(d.paint));
    l.userData.detailCentre = d.centre;
    add(l, 2);
  }
  // Build mode's next building: its own outline, hidden where something is in front (eng E-B3).
  if (arrays.nextBuilding) haloed(arrays.nextBuilding.positions, c.ink, NEXT_EDGE_PX, true, 4);
  // In build mode what is down is muted, so the next piece carries the weight (D42).
  const next = arrays.next;
  add(wood(new Mesh(geometryOf(arrays.plankSide), flat(next ? c.trackShadow : c.trackEdge)), arrays.sideRanges), 2);
  add(wood(new Mesh(geometryOf(arrays.plankTop), flat(next ? c.slabSide : c.trackFill)), arrays.pieceRanges), 2);
  add(through(new Mesh(geometryOf(arrays.grooves), flat(c.trackGroove))), 3);
  add(through(new Mesh(geometryOf(arrays.beams), flat(c.ink))), 3);
  if (next) {
    add(new Mesh(geometryOf(next.side), flat(c.trackEdge)), 2);
    add(new Mesh(geometryOf(next.top), flat(c.trackFill)), 2);
    add(new Mesh(geometryOf(next.grooves), flat(c.trackGroove)), 3);
    add(new Mesh(geometryOf(next.beams), flat(c.ink)), 3);
    if (next.edge.positions.length > 0) add(lines(next.edge.positions, c.ink, NEXT_EDGE_PX), 4);
    // Seen through whatever is in front (D28): the preview's look, translucent
    // wood with a solid edge. Its top only, drawn only where something is in
    // front of it, so the piece itself looks the same when nothing hides it.
    add(new Mesh(geometryOf(next.top), flat(c.trackFill, { hiddenOnly: c.ghostOpacity ?? 0.5 })), 8);
    if (next.edge.positions.length > 0) add(lines(next.edge.positions, c.ink, NEXT_EDGE_PX, false), 8);
  }
  // The editor's selection (P3, owner: ink outline only): the 2D mark's weight, seen through what is in front so a piece under a roof can still be found.
  if (arrays.selection) haloed(arrays.selection.positions, c.ink, SELECTED_PX, false, 8);
  if (arrays.seams.positions.length > 0) add(lines(arrays.seams.positions, c.seam, SEAM_PX), 4);
  // Marks last, over everything (design 15A).
  const levelLines: number[] = [];
  for (const m of arrays.marks) {
    if (m.lineTo !== undefined) levelLines.push(m.at[0], m.at[1], m.at[2], m.at[0], m.at[1], m.lineTo);
    const tex = markTexture(m, c, dpr);
    const sprite = new Sprite(new SpriteMaterial({ map: tex?.map ?? null, depthTest: false, sizeAttenuation: false }));
    sprite.position.set(m.at[0], m.at[1], m.at[2]);
    // Wider than tall for a long gap figure (FINDING-007); the renderer scales by it.
    sprite.userData.aspect = tex?.aspect ?? (m.figure !== undefined ? labelAspect(estimateTextPx(figureText(m.figure))) : 1);
    add(sprite, 10);
  }
  if (levelLines.length > 0) haloed(new Float32Array(levelLines), c.fail, LEVEL_LINE_PX, false, 9);
}

/** How far a press may move, CSS px, and still be a click rather than a turn or a pan (P3 pick in 3D). */
export const CLICK_SLOP_PX = 5;

/** Whether a pointer that went down at `from` and is now at `to` is still a click. */
export function isClick(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= CLICK_SLOP_PX;
}

/** The piece whose run holds triangle `faceIndex`; the runs count index entries, three a triangle. */
export function pieceAtFace(ranges: SceneArrays['pieceRanges'], faceIndex: number): string | null {
  const at = faceIndex * 3;
  for (const [id, r] of ranges) if (at >= r.start && at < r.start + r.count) return id;
  return null;
}

/** One ray hit, as three reports it: the object and, for a mesh, which triangle. */
export interface PickHit {
  readonly object: { readonly userData: Record<string, unknown> };
  readonly faceIndex?: number | null;
}

/**
 * The piece a ray picks, from its hits nearest first: the first piece of wood
 * it reaches, passing through grooves, beams and footprints; nothing when
 * something else is in front, or nothing is hit.
 */
export function pieceOfHits(hits: readonly PickHit[]): string | null {
  for (const h of hits) {
    const ranges = h.object.userData.pieceRanges as SceneArrays['pieceRanges'] | undefined;
    if (ranges) return h.faceIndex == null ? null : pieceAtFace(ranges, h.faceIndex);
    if (h.object.userData.pickThrough) continue;
    return null;
  }
  return null;
}

/**
 * The piece under a point of the view, in normalised device coordinates
 * (-1..1, y up). Meshes only: lines and marks are drawn over the wood and
 * never hide it from a pick. Needs no WebGL, so the node test runs it.
 */
export function pickPiece(group: Group, camera: Camera, ndc: { readonly x: number; readonly y: number }): string | null {
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  const meshes: Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof Mesh && !(o instanceof LineSegments2)) meshes.push(o);
  });
  return pieceOfHits(ray.intersectObjects(meshes, false));
}

/** Dispose and remove everything under `group`. */
export function disposeChildren(group: Group): void {
  for (const child of [...group.children]) {
    child.traverse((o) => {
      const any = o as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      any.geometry?.dispose();
      const mats = any.material ? (Array.isArray(any.material) ? any.material : [any.material]) : [];
      for (const m of mats) {
        (m as Material & { map?: { dispose(): void } | null }).map?.dispose();
        m.dispose();
      }
    });
    group.remove(child);
  }
}

/**
 * The camera's starting place for a scene: from the plan's bottom edge, 35
 * degrees up (25 when any track is raised), at the nearest distance that keeps all eight corners of the
 * scene's box in view with a small margin (design 21A). A bounding sphere
 * framed flat layouts at a third of the view.
 */
export function startPose(arrays: SceneArrays, aspect: number): { position: Vector3; target: Vector3; radius: number } {
  return framePose(arrays.bounds, aspect, startElevationDeg(arrays));
}

/**
 * The camera that frames one box from the plan's bottom edge at an elevation:
 * the 3D view's start pose for the whole scene, and build mode's per step for
 * the next piece and what it clips onto (D17).
 */
export function framePose(box: Box, aspect: number, elevationDeg: number): { position: Vector3; target: Vector3; radius: number } {
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  const target = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const radius = Math.max(1, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
  const el = (elevationDeg * Math.PI) / 180;
  // Looking along +y, tilted down by the elevation; z is up.
  const forward = new Vector3(0, Math.cos(el), -Math.sin(el));
  const right = new Vector3(1, 0, 0);
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan((FOV_DEG * Math.PI) / 360);
  const tanH = tanV * Math.max(aspect, 0.1);
  let d = 1;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        const o = new Vector3(x, y, z).sub(target);
        const zc = o.dot(forward);
        d = Math.max(d, zc + Math.abs(o.dot(right)) / tanH, zc + Math.abs(o.dot(up)) / tanV);
      }
    }
  }
  d *= 1.06;
  return { position: target.clone().sub(forward.clone().multiplyScalar(d)), target, radius };
}

export interface Viewer3DProps {
  readonly input: SceneInput;
  /** What the picture shows, for screen readers (design 22A). */
  readonly label: string;
  /** Bumped by the Reset view button (design 2A). */
  readonly resetSignal: number;
  /** The graphics context was lost (eng D9, design 7A). */
  readonly onContextLost: () => void;
  /** The id of the text that says how to turn the view, keys included (design review FINDING-006). */
  readonly describedBy?: string;
  /**
   * Build mode (docs/plan/2026-10-31-build-mode.md): no turning by drag or
   * keys (D8), and every new scene framed on `focus`, the next piece and
   * what it clips onto (D17), instead of keeping the camera. `inset` draws a
   * close-up of that piece in a corner, joined to its spot by a line (D34).
   */
  readonly build?: BuildView | null;
  /** A new scene is on screen (build mode swaps its label in the same frame, D37). */
  readonly onDrawn?: () => void;
  /** A click on a piece (see PICKING); never in build mode. */
  readonly onPick?: (pieceId: string) => void;
  /**
   * Every paint token a built-in piece names (the library's `PAINT_TOKENS`),
   * handed in by the panel: importing the library here would pull its
   * modules into the editor's chunk (5.5 kB, `scripts/chunkBudget.ts`).
   */
  readonly paintTokens?: readonly string[];
}

export interface BuildView {
  readonly focus: readonly string[];
  readonly inset?: string | null;
}

/** The close-up's side as a share of the view's shorter side, and its margin, CSS px (D34). */
export const INSET_SHARE = 0.3;
const INSET_MARGIN_PX = 12;

/** The box around some pieces, or the whole scene when none of them is drawn. */
export function boxOf(arrays: SceneArrays, ids: readonly string[]): Box {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const id of ids) {
    const b = arrays.pieceBounds.get(id);
    if (!b) continue;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, b.min[i]!);
      max[i] = Math.max(max[i]!, b.max[i]!);
    }
  }
  return min[0] === Infinity ? arrays.bounds : { min: [min[0]!, min[1]!, min[2]!], max: [max[0]!, max[1]!, max[2]!] };
}

export default function Viewer3D({ input, label, resetSignal, onContextLost, describedBy, build = null, onDrawn, onPick, paintTokens = [] }: Viewer3DProps) {
  const drawnRef = useRef(onDrawn);
  drawnRef.current = onDrawn;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const buildRef = useRef(build);
  buildRef.current = build;
  const host = useRef<HTMLDivElement | null>(null);
  const arrays = useMemo(() => buildScene(input), [input]);
  const world = useRef<{
    renderer: WebGLRenderer;
    scene: Scene;
    group: Group;
    camera: PerspectiveCamera;
    controls: OrbitControls;
    colors: SceneColors;
    render: () => void;
    reset: () => void;
  } | null>(null);
  const lostRef = useRef(onContextLost);
  lostRef.current = onContextLost;

  // Mount: renderer, camera, controls. Unmount: dispose all (eng D12).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true });
    } catch {
      throw new WebGLUnavailable('This browser cannot make a WebGL context.');
    }
    const colors = tokenColors(document.documentElement, paintTokens);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(new Color(colors.floor));
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.tabIndex = 0;
    canvas.className = 'viewer3d-canvas';
    el.appendChild(canvas);
    const scene = new Scene();
    const group = new Group();
    scene.add(group);
    const camera = new PerspectiveCamera(FOV_DEG, 1, 1, 100000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, canvas);
    controls.enabled = !buildRef.current; // build mode does not turn (D8)
    controls.enableDamping = false; // design 20A
    const insetCamera = new PerspectiveCamera(FOV_DEG, 1, 1, 100000);
    insetCamera.up.set(0, 0, 1);
    // The close-up's frame and its line to the piece's spot (D34): drawn over the canvas, never hit-tested.
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'viewer3d-inset');
    overlay.setAttribute('aria-hidden', 'true');
    el.appendChild(overlay);
    controls.minPolarAngle = ((90 - MAX_ELEVATION_DEG) * Math.PI) / 180;
    controls.maxPolarAngle = ((90 - MIN_ELEVATION_DEG) * Math.PI) / 180;
    const render = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      group.traverse((o) => {
        const m = (o as { material?: unknown }).material;
        if (m instanceof LineMaterial) m.resolution.set(w, h);
        if (o instanceof Sprite) {
          // sizeAttenuation off: scale is a fraction of the view's height times 2 tan(fov/2).
          const k = (MARK_PX / h) * 2 * Math.tan((FOV_DEG * Math.PI) / 360);
          o.scale.set(k * ((o.userData.aspect as number | undefined) ?? 1), k, 1);
        }
      });
      showDetailFor(group, camera, h);
      renderer.render(scene, camera);
      drawInset(w, h);
    };
    const drawInset = (w: number, h: number) => {
      const id = buildRef.current?.inset ?? null;
      overlay.replaceChildren();
      if (!id || !current || !current.pieceBounds.has(id)) return;
      const box = current.pieceBounds.get(id)!;
      const side = Math.round(Math.min(w, h) * INSET_SHARE);
      const pose = framePose(box, 1, startElevationDeg(current));
      insetCamera.position.copy(pose.position);
      insetCamera.lookAt(pose.target);
      insetCamera.near = Math.max(1, pose.radius / 200);
      insetCamera.far = pose.radius * 40;
      insetCamera.updateProjectionMatrix();
      // WebGL counts from the bottom: this is the view's bottom-start corner.
      renderer.setScissorTest(true);
      renderer.setScissor(INSET_MARGIN_PX, INSET_MARGIN_PX, side, side);
      renderer.setViewport(INSET_MARGIN_PX, INSET_MARGIN_PX, side, side);
      renderer.setClearColor(new Color(colors.paper));
      showDetailFor(group, insetCamera, side);
      renderer.render(scene, insetCamera);
      renderer.setClearColor(new Color(colors.floor));
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.setScissorTest(false);
      // The frame, and a line from its nearest corner to where the piece is in the main view.
      const top = h - INSET_MARGIN_PX - side;
      const centre = pose.target.clone().project(camera);
      const px = ((centre.x + 1) / 2) * w;
      const py = ((1 - centre.y) / 2) * h;
      const cx = px > INSET_MARGIN_PX + side / 2 ? INSET_MARGIN_PX + side : INSET_MARGIN_PX;
      const cy = py < top + side / 2 ? top : top + side;
      const ns = 'http://www.w3.org/2000/svg';
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(INSET_MARGIN_PX));
      rect.setAttribute('y', String(top));
      rect.setAttribute('width', String(side));
      rect.setAttribute('height', String(side));
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', String(cx));
      line.setAttribute('y1', String(cy));
      line.setAttribute('x2', String(px));
      line.setAttribute('y2', String(py));
      overlay.append(line, rect);
    };
    let current: SceneArrays | null = null;
    const reset = () => {
      if (!current) return;
      const b = buildRef.current;
      const pose = b ? framePose(boxOf(current, b.focus), camera.aspect, startElevationDeg(current)) : startPose(current, camera.aspect);
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      controls.minDistance = pose.radius * 0.15;
      controls.maxDistance = pose.radius * 6;
      camera.near = Math.max(1, pose.radius / 200);
      camera.far = pose.radius * 40;
      camera.updateProjectionMatrix();
      controls.update();
      render();
    };
    world.current = { renderer, scene, group, camera, controls, colors, render, reset };
    (world.current as unknown as { setArrays: (a: SceneArrays) => void }).setArrays = (a) => {
      const first = current === null;
      current = a;
      syncScene(group, a, colors, window.devicePixelRatio || 1);
      // Build mode frames every step afresh (D17); the 3D view keeps its camera (eng D10).
      if (first || buildRef.current) reset();
      else render();
      drawnRef.current?.();
    };
    controls.addEventListener('change', render);
    const size = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // A turned tablet re-frames the step (build mode); the 3D view keeps the user's own camera.
      if (buildRef.current) reset();
      else render();
    };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    ro?.observe(el);
    size();
    const lost = (e: Event) => {
      e.preventDefault();
      lostRef.current();
    };
    canvas.addEventListener('webglcontextlost', lost);
    // Keys only while the view has focus (design 22A): arrows orbit, + and - zoom, 0 resets (D10).
    const keys = (e: KeyboardEvent) => {
      if (buildRef.current) return; // build mode's keys step through the build (D8)
      const step = (7.5 * Math.PI) / 180;
      const off = camera.position.clone().sub(controls.target);
      const r = off.length();
      let az = Math.atan2(off.y, off.x);
      let el2 = Math.asin(Math.max(-1, Math.min(1, off.z / r)));
      let dist = r;
      if (e.key === 'ArrowLeft') az -= step;
      else if (e.key === 'ArrowRight') az += step;
      else if (e.key === 'ArrowUp') el2 += step;
      else if (e.key === 'ArrowDown') el2 -= step;
      else if (e.key === '+' || e.key === '=') dist /= 1.15;
      else if (e.key === '-' || e.key === '_') dist *= 1.15;
      else if (e.key === '0') {
        e.preventDefault();
        reset();
        return;
      } else return;
      e.preventDefault();
      const lo = (MIN_ELEVATION_DEG * Math.PI) / 180;
      const hi = (MAX_ELEVATION_DEG * Math.PI) / 180;
      el2 = Math.max(lo, Math.min(hi, el2));
      dist = Math.max(controls.minDistance, Math.min(controls.maxDistance, dist));
      camera.position.set(
        controls.target.x + dist * Math.cos(el2) * Math.cos(az),
        controls.target.y + dist * Math.cos(el2) * Math.sin(az),
        controls.target.z + dist * Math.sin(el2),
      );
      controls.update();
      render();
    };
    canvas.addEventListener('keydown', keys);
    // A click picks a piece (see PICKING). A second finger, another button, or moving past the slop makes it a turn.
    const pressed = new Set<number>();
    let press: { id: number; x: number; y: number; click: boolean } | null = null;
    const down = (e: PointerEvent) => {
      pressed.add(e.pointerId);
      press = pressed.size === 1 && e.isPrimary && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, click: true } : null;
    };
    const move = (e: PointerEvent) => {
      if (press && press.id === e.pointerId && !isClick(press, { x: e.clientX, y: e.clientY })) press.click = false;
    };
    const up = (e: PointerEvent) => {
      pressed.delete(e.pointerId);
      const p = press;
      if (!p || p.id !== e.pointerId) return;
      press = null;
      const pick = pickRef.current;
      if (!pick || buildRef.current || !p.click || !isClick(p, { x: e.clientX, y: e.clientY })) return;
      const r = canvas.getBoundingClientRect();
      const id = pickPiece(group, camera, {
        x: ((e.clientX - r.left) / (r.width || 1)) * 2 - 1,
        y: -((e.clientY - r.top) / (r.height || 1)) * 2 + 1,
      });
      if (id !== null) pick(id);
    };
    const cancel = (e: PointerEvent) => {
      pressed.delete(e.pointerId);
      press = null;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('keydown', keys);
      canvas.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('change', render);
      ro?.disconnect();
      disposeChildren(group);
      overlay.remove();
      controls.dispose();
      renderer.dispose();
      canvas.remove();
      world.current = null;
    };
  }, []);

  // A new layout: new contents, same camera (eng D10, D16).
  useEffect(() => {
    (world.current as unknown as { setArrays?: (a: SceneArrays) => void } | null)?.setArrays?.(arrays);
  }, [arrays]);

  useEffect(() => {
    world.current?.renderer.domElement.setAttribute('aria-label', label);
  }, [label]);
  useEffect(() => {
    const canvas = world.current?.renderer.domElement;
    if (!canvas) return;
    if (describedBy) canvas.setAttribute('aria-describedby', describedBy);
    else canvas.removeAttribute('aria-describedby');
  }, [describedBy]);

  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    world.current?.reset();
  }, [resetSignal]);

  return <div ref={host} className="viewer3d" />;
}
