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
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { buildScene, type Mesh as MeshArrays, type PlacedMark, type SceneArrays, type SceneInput } from '../../engine/src/view3d/mesh.js';

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
}

export function tokenColors(root: Element = document.documentElement): SceneColors {
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(name).trim() || '#000';
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
  };
}

/** Field of view, degrees: narrow, so the drawing distorts little (design 21A). */
export const FOV_DEG = 30;
/** The starting elevation, degrees, looking across the plan from its bottom edge (21A). */
export const START_ELEVATION_DEG = 35;
/** Tilt limits as elevation, degrees: never under the table, never straight down (21A). */
export const MIN_ELEVATION_DEG = 10;
export const MAX_ELEVATION_DEG = 85;
/** A mark's on-screen size, CSS px: the 2D canvas's r=28 clash ring at its 0.75px/mm floor is 42px. */
export const MARK_PX = 44;
/** Line widths, CSS px: seams 2.5 (design 26A), level line 2 (16A), slab outline 1.5. */
const SEAM_PX = 2.5;
const LEVEL_LINE_PX = 2;
const OUTLINE_PX = 1.5;

function geometryOf(m: MeshArrays): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(m.positions, 3));
  g.setIndex(new BufferAttribute(m.indices, 1));
  return g;
}

function flat(color: string, opts: { side?: boolean; depthTest?: boolean } = {}): MeshBasicMaterial {
  // Both sides: the builder's winding is not consistent, and unlit faces have no back to hide.
  return new MeshBasicMaterial({ color: new Color(color), side: 2, depthTest: opts.depthTest ?? true });
}

function lines(positions: Float32Array, color: string, px: number, depthTest = true): LineSegments2 {
  const g = new LineSegmentsGeometry();
  g.setPositions(positions);
  const m = new LineMaterial({ color: new Color(color).getHex(), linewidth: px, depthTest });
  return new LineSegments2(g, m);
}

/** The 2D canvas's mark shapes (TrackCanvas `RedMark` and the adapter diamond), as SVG path data. */
const SHAPES: Record<PlacedMark['kind'], { r: number; d: string; ink: 'fail' | 'ink' } | null> = {
  clash: { r: 28, d: 'M -14 -14 L 14 14 M -14 14 L 14 -14', ink: 'fail' },
  overlap: { r: 28, d: 'M -14 -14 L 14 14 M -14 14 L 14 -14', ink: 'fail' },
  refused: { r: 18, d: 'M -10 0 L 10 0', ink: 'fail' },
  level: { r: 18, d: 'M -10 -4 H 0 V 4 H 10', ink: 'fail' },
  third: { r: 18, d: 'M -7 -2 L 0 5 L 7 -2 M -7 -9 L 0 -2 L 7 -9', ink: 'fail' },
  adapter: { r: 16, d: 'M 0 -16 L 16 0 L 0 16 L -16 0 Z', ink: 'ink' },
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
  if (arrays.slab) {
    add(new Mesh(geometryOf(arrays.slab.top), flat(c.paperSunk)));
    add(new Mesh(geometryOf(arrays.slab.side), flat(c.slabSide)));
    add(lines(arrays.slab.outline.positions, arrays.slab.overhang ? c.fail : c.inkSoft, OUTLINE_PX), 1);
  }
  add(new Mesh(geometryOf(arrays.footprints), flat(c.trackShadow)), 1);
  add(new Mesh(geometryOf(arrays.plankSide), flat(c.trackEdge)), 2);
  add(new Mesh(geometryOf(arrays.plankTop), flat(c.trackFill)), 2);
  add(new Mesh(geometryOf(arrays.grooves), flat(c.trackGroove)), 3);
  add(new Mesh(geometryOf(arrays.beams), flat(c.ink)), 3);
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
  if (levelLines.length > 0) add(lines(new Float32Array(levelLines), c.fail, LEVEL_LINE_PX, false), 9);
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
 * degrees up, at the nearest distance that keeps all eight corners of the
 * scene's box in view with a small margin (design 21A). A bounding sphere
 * framed flat layouts at a third of the view.
 */
export function startPose(arrays: SceneArrays, aspect: number): { position: Vector3; target: Vector3; radius: number } {
  const [x0, y0, z0] = arrays.bounds.min;
  const [x1, y1, z1] = arrays.bounds.max;
  const target = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const radius = Math.max(1, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2);
  const el = (START_ELEVATION_DEG * Math.PI) / 180;
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
}

export default function Viewer3D({ input, label, resetSignal, onContextLost, describedBy }: Viewer3DProps) {
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
    const colors = tokenColors();
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
    controls.enableDamping = false; // design 20A
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
      renderer.render(scene, camera);
    };
    let current: SceneArrays | null = null;
    const reset = () => {
      if (!current) return;
      const pose = startPose(current, camera.aspect);
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
      if (first) reset();
      else render();
    };
    controls.addEventListener('change', render);
    const size = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
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
    return () => {
      canvas.removeEventListener('keydown', keys);
      canvas.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('change', render);
      ro?.disconnect();
      disposeChildren(group);
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
