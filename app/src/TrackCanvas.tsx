/**
 * The canvas. Dominant by design: it is the first thing the eye lands on, and
 * the track leads it. Everything else drawn here is a guide kept quieter than
 * the wood: the floor grid, the seams at joints, the table outline.
 *
 * SVG rather than a canvas library. Dragging a run moves one transformed group
 * and nothing is solved mid-drag (decision E6), so there is still nothing a
 * scene graph would buy; SVG gives exact arcs and prints legibly in
 * greyscale, which the build sheet will require.
 *
 * NO PER-JOINT GLYPHS. They used to render a four-channel per-joint verdict
 * (colour, shape, ratio on hover, dotted ring for an unmeasured tolerance), and
 * that was the best accessibility work in this project. Decision R21 deleted
 * the solver that produced per-joint ratios, so there is no per-joint claim
 * left to make, and drawing identical markers at every joint would assert that
 * each one was checked. They come back, four channels and all, when per-joint
 * allocation does.
 */

import { JOIN_REFUSED_SHORT } from './joinWords.js';
import type { JoinRefusal } from './layoutModel.js';
import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Segment } from '../../engine/src/geom/fk.js';
import { onPlank } from '../../engine/src/graph/overlap.js';
import { renderBounds, type GraphRender } from '../../engine/src/graph/render.js';
import { useDragSession, type RunDrag } from './useDragSession.js';
import type { CanvasProbe } from './usePaletteDrag.js';
import type { Extent } from './tableModel.js';
import type { PortRef } from '../../engine/src/graph/model.js';
import type { Part, Polarity } from '../../engine/src/parts/schema.js';
import {
  clashMarkers,
  pastEdges,
  SEAM_OVERHANG_PX,
  type JoinSuggestion,
  gapAnnotations,
  gridLabel,
  gridPath,
  gridStep,
  labelSpot,
  plankEdges,
  segmentPath,
  visibleBox,
  type GapMark,
  type SeamLine,
  type WeldTarget,
} from './trackPath.js';

/**
 * How many pieces this canvas will draw before it says there are too many.
 *
 * Exported so a spec can pin the boundary rather than restate the number, and
 * so the entry in `docs/plan/brio-TODOS.md` can cite one place. The measured
 * cost behind the value is at the guard that uses it.
 */
export const CANVAS_SEGMENT_CEILING = 10_000;

/**
 * The class for each polarity, as a closed map rather than a template string.
 *
 * `is-${p.polarity}` compiled fine and silently dropped the fill if anyone
 * renamed a `Polarity` member, because the class name was built from the
 * value's spelling at runtime and `app.css` matches a literal. A `Record`
 * over the union makes that rename a compile error instead.
 */
/*
 * The hover brackets, in the joint's own frame: track direction along +x, so
 * one bracket sits behind the joint and one ahead of it, each an 80-degree
 * arc of the r=14 hit circle.
 */
const bracketArc = (from: number, to: number): string => {
  const pt = (deg: number) =>
    `${(14 * Math.cos((deg * Math.PI) / 180)).toFixed(3)} ${(14 * Math.sin((deg * Math.PI) / 180)).toFixed(3)}`;
  return `M ${pt(from)} A 14 14 0 0 1 ${pt(to)}`;
};
export const WELD_BRACKETS = `${bracketArc(-40, 40)} ${bracketArc(140, 220)}`;

const POLARITY_CLASS: Record<Polarity, string> = {
  peg: 'port-dot is-peg',
  socket: 'port-dot is-socket',
};

/**
 * THE TRACK'S WOOD, LAYER BY LAYER ACROSS ALL GIVEN SEGMENTS (see the layer
 * comments in TrackCanvas).
 *
 * MEMOISED, which is what keeps placing and dragging cheap (eng review S7,
 * the required proof of the rigid-preview principle): it re-renders only when
 * the committed segments or the set of hidden pieces change, so rotating a
 * preview, moving a drag or changing the selection does not redraw thousands
 * of paths. `hidden` changes only when a drag starts and ends.
 */
export const TrackLayers = memo(function TrackLayers({
  segments,
  resolve,
  maxLayers,
  hidden,
  keyPrefix = '',
}: {
  readonly segments: readonly Segment[];
  readonly resolve: (id: string) => Part;
  readonly maxLayers: number;
  readonly hidden?: ReadonlySet<string>;
  readonly keyPrefix?: string;
}) {
  // Counted for the committed track only: the preview and drag copies are meant to re-render.
  if (keyPrefix === '') layerRenders.count++;
  return (
    <>
      {Array.from({ length: maxLayers }).map((_, layerIndex) =>
        segments.map((s, i) => {
          if (hidden && s.pieceId !== undefined && hidden.has(s.pieceId)) return null;
          const layer = trackLayers(resolve(s.partId))[layerIndex];
          if (!layer || layer.w <= 0) return null;
          return (
            <path
              key={`${keyPrefix}${layerIndex}-${i}`}
              d={segmentPath(s)}
              fill="none"
              stroke={layer.stroke}
              strokeWidth={layer.w}
              strokeLinecap="butt"
            />
          );
        }),
      )}
    </>
  );
});

/** How many times TrackLayers has rendered: read by the memo spec, nothing else. */
export const layerRenders = { count: 0 };

const EDGE_MM = 1.2;

/**
 * How much wider than its plank a raised piece's bridge casing is, in total:
 * 4mm each side (eng re-run D2). Floor track running closer than that
 * alongside raised track would be nicked; BRIO's own spacing is wider.
 */
const BRIDGE_CASING_MM = 8;

/**
 * Where a raised piece's shadow falls, in millimetres: this far right and
 * this far down the screen (the drawing is flipped, so down is -y). 14, not
 * the 8 first tried: at fit-to-screen 8 read as a thin edge, not as lifted
 * (browser check, 2026-10-23). One
 * offset for the whole layout, so every raised piece reads as standing at the
 * same height, which is what one raised level means.
 */
const SHADOW_OFFSET_MM = 14;

/**
 * A piece's cast shadow (owner's choice, 2026-10-23: "a clear graphical
 * distinction between pieces placed on every layer"). Raised wood throws its
 * plank-wide shadow the full offset away; a ramp's shadow runs from its low
 * end, where it touches the floor, to the full offset at its high end, so the
 * slope shows too. Depth, not hue: colour is spent only on verdicts (rule 1).
 */
function rampShadow(seg: Segment, half: number): string {
  /*
   * A FILLED QUAD, not a stroke along a slanted line: the stroke's square end
   * sat skewed against the raised piece's shadow and stuck out as a tab at the
   * joint (seen in the browser, 2026-10-23). The plank's four corners, the
   * high end's two moved the full offset, meet that shadow edge to edge.
   */
  const o = SHADOW_OFFSET_MM;
  const nx = -Math.sin(seg.from.h) * half;
  const ny = Math.cos(seg.from.h) * half;
  // Full offset at the high end, none at the low end; a flipped ramp is high at `from`.
  const [oFrom, oTo] = seg.highAtStart ? [o, 0] : [0, o];
  const pts = [
    [seg.from.x + nx + oFrom, seg.from.y + ny - oFrom],
    [seg.to.x + nx + oTo, seg.to.y + ny - oTo],
    [seg.to.x - nx + oTo, seg.to.y - ny - oTo],
    [seg.from.x - nx + oFrom, seg.from.y - ny - oFrom],
  ];
  return `M ${pts.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}

/**
 * THE SMALLEST A MARK IS DRAWN, as pixels per drawing unit (brio-TODOS.md P2,
 * "Canvas marks keep their screen size"). The fault marks and the adapter
 * diamond are sized in millimetres, and the canvas shrinks a big board to
 * fit, so on a 3m board at 0.3px/mm a clash ring was 17px across: a dot,
 * exactly where a fault is hardest to find. Below this zoom they stop
 * shrinking; above it they keep their size on the wood.
 */
export const MARK_MIN_PX_PER_MM = 0.75;

/** How much to enlarge a mark so it is never drawn below `MARK_MIN_PX_PER_MM`. 1 before layout. */
export function markScale(pxPerMm: number | null | undefined): number {
  return pxPerMm ? Math.max(1, MARK_MIN_PX_PER_MM / pxPerMm) : 1;
}

/**
 * A red fault mark: a ring and an inner glyph, drawn twice, first in a wider
 * `--paper` halo, then in `--fail` (design 10B, eng re-run D5). `--fail` is
 * 1.78:1 on `--track-groove`, under the 3:1 a mark you must see is owed, and
 * 6.09:1 on `--paper`, so the halo carries it across a groove. The strokes
 * keep their device size (app.css, `.red-mark`; rule 11) and the shape is
 * enlarged by `k` on a zoomed-out board. Ink, not a target.
 */
function RedMark({ className, x, y, r, d, k }: { className: string; x: number; y: number; r: number; d: string; k: number }) {
  return (
    <g className={`red-mark ${className}`} pointerEvents="none" transform={`translate(${x}, ${y}) scale(${k})`}>
      <circle r={r} fill="none" stroke="var(--paper)" className="mark-halo" />
      <path d={d} fill="none" stroke="var(--paper)" className="mark-halo" />
      <circle r={r} fill="none" stroke="var(--fail)" className="mark-ink" />
      <path d={d} fill="none" stroke="var(--fail)" className="mark-ink" />
    </g>
  );
}
/** The concentric strokes a part's plank is drawn with; see TrackCanvas. */
function trackLayers(part: Part): Array<{ w: number; stroke: string }> {
  const out: Array<{ w: number; stroke: string }> = [
    { w: part.plankWidthMm, stroke: 'var(--track-edge)' },
    { w: part.plankWidthMm - EDGE_MM * 2, stroke: 'var(--track-fill)' },
  ];
  if (part.grooveWidthMm !== undefined) {
    out.push(
      { w: part.gaugeWidthMm + part.grooveWidthMm, stroke: 'var(--track-groove)' },
      { w: part.gaugeWidthMm - part.grooveWidthMm, stroke: 'var(--track-fill)' },
    );
  }
  return out;
}

export interface TrackCanvasProps {
  /** Everything drawable, already placed exactly by the graph engine. */
  readonly render: GraphRender;
  readonly resolve: (id: string) => Part;
  readonly emptyAction?: ReactNode;
  /**
   * Where two separate pieces were asked to occupy one spot (task T12).
   *
   * Decision A4 approved reporting these and owed a DRAW half that was never
   * written, so for three reviews the verdict said "8 pairs of track ends
   * land in exactly the same spot" and the canvas gave no clue which two. A
   * count you cannot locate is not actionable.
   */
  readonly clashes?: readonly { readonly at: readonly [number, number] }[];
  /**
   * Where a loop fails to close, and by how much (task W2, decision D4).
   *
   * Positions already resolved, like `clashes`, so this stays a drawing
   * component. The caller owns which welds qualify, because that is a verdict
   * question and not a drawing one.
   */
  readonly gaps?: readonly GapMark[];
  /**
   * Where a joint was refused because two ends of the same kind meet.
   *
   * One entry per violation, already resolved to canvas coordinates by
   * `App.tsx`. Separate from `clashes` on purpose: the verdict counts the two
   * separately and says so in different sentences, so they must not share a
   * marker or the number on screen stops matching the number in the words.
   */
  readonly badJoints?: readonly (readonly [number, number])[];
  /**
   * Where a male-male adapter goes: a socket-to-socket joint (socket adapter
   * plan, R3). Resolved by `App.tsx`, which leaves out any spot a red mark
   * already holds. Ink, a diamond: a shape nothing else on the canvas uses,
   * and no colour, because colour is spent only on verdicts (DESIGN.md rule
   * 1; design review DR5).
   */
  readonly adapterJoints?: readonly (readonly [number, number])[];
  /**
   * Joints whose ends sit on different levels, and ramps that would climb to
   * a third level (two-layer plan, design 6A). Resolved by `App.tsx`, which
   * leaves out any spot a clash already holds (eng re-run D4); the verdict
   * still counts them and says how many are not marked.
   */
  readonly levelMismatches?: readonly (readonly [number, number])[];
  readonly thirdLevels?: readonly (readonly [number, number])[];
  /**
   * Where the next piece will attach. Drawn differently from `armed`, because
   * they used to be one value and a user who clicked the end they had just
   * built onto silently sent the next piece off to start its own run.
   */
  readonly cursor?: PortRef | null;
  /** The free end currently armed for a weld, if any. */
  readonly armed?: PortRef | null;
  /** Free ends the armed one can't join, keyed `pieceId#port`, with why. */
  readonly unjoinable?: ReadonlyMap<string, JoinRefusal>;
  /**
   * Joining is under way (design 27A): every free end that can take the join
   * gets a target ring. True while an end is armed, and after "Join two ends"
   * before the first end is chosen (28A).
   */
  readonly joining?: boolean;
  /** Free ends that nearly meet, each offered as a Join button (28B). */
  readonly suggestions?: readonly JoinSuggestion[];
  /** Pressing a suggestion's Join button. */
  readonly onSuggest?: (s: JoinSuggestion) => void;
  /** The suggestion's accessible name: which two ends it joins. */
  readonly suggestionName?: (s: JoinSuggestion) => string;
  /** Clicking a free end. This is the whole editing interaction (D5). */
  readonly onPortClick?: (ref: PortRef) => void;
  /** Every joint, resolved to the canvas by `weldTargets` (task U5). */
  readonly welds?: readonly WeldTarget[];
  /** Clicking a joint breaks it. Undo is the path back; there is no confirm. */
  readonly onWeldClick?: (a: PortRef, b: PortRef) => void;
  /**
   * Where one piece ends and the next begins, already resolved by
   * `seamLines` (request 2 of the 2026-10-22 editing plan).
   */
  readonly seams?: readonly SeamLine[];
  /** Drawn in the canvas's top-end corner: the 2D/3D switch (3D plan, design 1A). */
  readonly corner?: ReactNode;
  /** The selected piece (decision R1/D2), drawn with the strong outline. */
  readonly selected?: string | null;
  /** Every piece connected to the selected one, drawn with the quiet outline (2A). */
  readonly selectedRun?: ReadonlySet<string>;
  /** Clicking a piece's body, or Enter/Space on it. */
  readonly onPieceSelect?: (pieceId: string) => void;
  /** Delete or Backspace on the focused, selected piece. */
  readonly onPieceRemove?: (pieceId: string) => void;
  /** Clicking bare floor: clears a selection. */
  readonly onFloorClick?: () => void;
  /** A piece's accessible name, and the canvas label beside a selected one. */
  readonly pieceName?: (pieceId: string) => string;
  /** The canvas-edge strip for the current mode (1A/2A), under the drawing. */
  readonly strip?: ReactNode;
  /**
   * The piece being placed (decision R3): drawn as translucent wood with an
   * opaque edge, red when it would conflict. `reach` is the farthest any
   * placement of it could extend, in mm, which the frozen view keeps room for.
   */
  readonly ghost?: { readonly render: GraphRender; readonly red: boolean; readonly reach: number } | null;
  /**
   * Move a whole run (decisions E6, D10): from a drag, or from the arrow keys
   * and R on the selected piece. Offsets are whole millimetres, model axes.
   */
  readonly onRunMove?: (move: RunDrag, snapRadiusMm: number) => void;
  /** The pieces of the run a piece belongs to: what a drag carries. */
  readonly runOf?: (pieceId: string) => ReadonlySet<string>;
  /**
   * Filled every render with how a screen point maps onto this canvas, for a
   * palette drag that starts outside it (see usePaletteDrag).
   */
  readonly probe?: RefObject<CanvasProbe | null>;
  /**
   * The table or room outline (backlog E4), centred on the track, in model
   * millimetres, and the fit sentence to show with it. Red when the track
   * does not fit.
   */
  readonly table?: { readonly outline: Extent; readonly fits: boolean; readonly note: string } | null;
}

export function TrackCanvas({
  render,
  resolve,
  emptyAction,
  clashes = [],
  gaps = [],
  badJoints = [],
  adapterJoints = [],
  levelMismatches = [],
  thirdLevels = [],
  cursor = null,
  armed = null,
  unjoinable,
  joining = false,
  suggestions = [],
  onSuggest,
  suggestionName,
  onPortClick,
  welds = [],
  onWeldClick,
  seams = [],
  corner,
  selected = null,
  selectedRun,
  onPieceSelect,
  onPieceRemove,
  onFloorClick,
  pieceName,
  strip,
  ghost = null,
  onRunMove,
  runOf,
  probe,
  table = null,
}: TrackCanvasProps) {
  const { segments, ports: renderedPorts } = render;
  /*
   * THE VIEW HOLDS STILL WHILE PLACING (decisions 5A and 4A). The fit covers
   * the placed track plus the preview's whole reach on every side, and none
   * of that depends on how the preview is turned, so rotating, flipping or
   * moving it never zooms the picture or changes the grid step. On an empty
   * floor the view is a fixed 1 m by 0.6 m around the origin.
   */
  const reach = ghost?.reach ?? 0;
  const box = useMemo(() => {
    if (segments.length === 0 && ghost) return { minX: -500, minY: -300, maxX: 500, maxY: 300 };
    const b = renderBounds(render);
    const fit = { minX: b.minX - reach, minY: b.minY - reach, maxX: b.maxX + reach, maxY: b.maxY + reach };
    // A table bigger than the track widens the view so its whole outline shows.
    if (!table || segments.length === 0) return fit;
    const t = table.outline;
    return {
      minX: Math.min(fit.minX, t.minX),
      minY: Math.min(fit.minY, t.minY),
      maxX: Math.max(fit.maxX, t.maxX),
      maxY: Math.max(fit.maxY, t.maxY),
    };
  }, [render, reach, segments.length, ghost !== null, table?.outline]);
  const pad = 90;
  const w = Math.max(box.maxX - box.minX, 1) + pad * 2;
  const h = Math.max(box.maxY - box.minY, 1) + pad * 2;
  const vb = `${box.minX - pad} ${box.minY - pad} ${w} ${h}`;

  /*
   * THE FLOOR GRID (request 4, decisions R4/D3 and 12A).
   *
   * Its step comes from how big a cell is ON SCREEN, so it needs the drawn
   * size, which only exists after layout: CSS pixels per millimetre is the
   * smaller of the two ratios, because the default `preserveAspectRatio`
   * fits the whole viewBox. Until a measurement arrives (and always in a
   * static render or jsdom, which has no ResizeObserver) `gridStep` falls
   * back to counting lines, so the grid is never missing, only sometimes
   * coarser than ideal on the first paint.
   */
  // A callback ref held in state, not `useRef`: the svg is absent while the
  // empty state shows, and the observer must attach when it first appears.
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [drawn, setDrawn] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = svgEl;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setDrawn({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [svgEl]);
  /*
   * The grid covers the whole drawn floor, not just the viewBox; see
   * `visibleBox` for why the two differ.
   */
  const shown = visibleBox({ minX: box.minX - pad, minY: box.minY - pad, width: w, height: h }, drawn);
  // The scale, readable by the drag session's commit, which runs outside render.
  const shownRef = useRef<number | null>(null);
  shownRef.current = shown.pxPerMm;
  const step = gridStep(Math.max(w, h), shown.pxPerMm);


  /*
   * HOW THE TRACK IS DRAWN, and why it is four strokes rather than two.
   *
   * It used to be a dark stroke at the full plank width with a lighter one at
   * 62% on top: a band with a thick border. It did not look like track, and
   * the 62% was a number chosen to look right rather than to mean anything.
   *
   * Now every width comes from the part's published cross section, and the
   * grooves land where BRIO says they land. A stroke of width W covers W/2
   * either side of the path, so concentric strokes paint annuli:
   *
   *   plankWidth          40mm   the dark plank edge
   *   plankWidth - 2.4    37.6   wood, leaving a 1.2mm edge line
   *   gauge + groove      32mm   groove colour out to 16mm either side
   *   gauge - groove      20mm   wood again inside 10mm, leaving two 6mm grooves
   *
   * With gauge 26 and groove 6 the grooves run 10mm to 16mm either side of the
   * centreline, which is the published figure, and on a curve they come out as
   * concentric arcs because the stroke follows the path.
   *
   * A part with no published groove width gets the first two strokes only. An
   * IKEA or Playtive piece is drawn as a bare plank, because nobody has
   * measured its grooves and inventing them would be the renderer making up
   * data. Absent looks absent.
   */
  const layers = (partId: string) => trackLayers(resolve(partId));

  /*
   * The layer count is the MAX across the layout, not the first piece's.
   *
   * Taking it from segment 0 meant a chain that happened to start with an
   * IKEA straight (two layers, no published grooves) drew only two layers for
   * everything, silently erasing the grooves from every BRIO piece behind it.
   * Per-segment `layers()` still decides what each piece gets; this only sets
   * how many passes to make.
   */
  /*
   * `reduce`, NOT `Math.max(...segments.map(...))`, and the runtime this
   * suite uses cannot catch the difference.
   *
   * A spread passes one argument per segment. MEASURED: node/V8 -- the engine
   * Chrome runs -- throws `RangeError: Maximum call stack size exceeded` at
   * 125,000 arguments, while bun/JSC, which is what `vitest` runs under here,
   * returns fine at 161,000. So every spec in this repo would pass while the
   * browser threw.
   *
   * 161,000 loose pieces is a 4.99M-char blob, inside a ~5MB quota, and
   * `loadGraph` accepts it with nothing discarded. The throw lands INSIDE
   * render, so `ErrorBoundary` catches it and paints the crash screen -- and
   * its only exit, `clearAndReload`, also deletes the inventory and the
   * submitted parts, which `library.ts` says cannot be recreated. A reload
   * repeats it forever. One line to avoid, so it is avoided rather than
   * filed.
   */
  let maxLayers = 0;
  // The preview's layers too: on an empty floor it is the only thing drawn.
  for (const s of [...segments, ...(ghost?.render.segments ?? [])]) {
    const n = layers(s.partId).length;
    if (n > maxLayers) maxLayers = n;
  }

  const dedupedClashes = useMemo(() => clashMarkers(clashes), [clashes]);
  /*
   * Leader 46mm, figure 22mm past it, so the furthest ink sits 68mm plus half
   * the figure's height from the weld. `pad` below is 90mm, which is what
   * keeps an annotation inside the viewBox instead of clipped at its edge.
   */
  const gapMarks = useMemo(() => gapAnnotations(gaps, 46, 22), [gaps]);

  /*
   * THE PIECES AS ONE TAB STOP (eng plan, "Hit-testing and keyboard"). Each
   * piece is a focusable button, but only one is in the tab order at a time:
   * the selected piece, else the one last focused, else the first. Alt+arrow
   * keys step between pieces in placement order, the order the layout list
   * uses. One tab stop, because a big layout would otherwise be thousands.
   */
  const pieceOrder = useMemo(() => {
    const seen: string[] = [];
    for (const seg of segments) {
      if (seg.pieceId !== undefined && seen[seen.length - 1] !== seg.pieceId) seen.push(seg.pieceId);
    }
    return seen;
  }, [segments]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const pieceEls = useRef(new Map<string, SVGGElement>());
  const tabStop =
    (focusId !== null && pieceOrder.includes(focusId) && focusId) ||
    (selected !== null && pieceOrder.includes(selected) && selected) ||
    pieceOrder[0] ||
    null;
  /*
   * A REMOVAL MUST NOT LOSE THE KEYBOARD USER'S PLACE. Removing the focused
   * piece (Delete), or the selection with it (the strip's Remove piece),
   * unmounts the element that had focus and the browser drops it on the page
   * body. When that happens, focus goes to the piece after the removed one,
   * else the one before. Only when focus was lost: an Undo or Remove last
   * button that keeps focus is left alone.
   */
  const lastOrder = useRef(pieceOrder);
  useLayoutEffect(() => {
    const was = lastOrder.current;
    lastOrder.current = pieceOrder;
    if (pieceOrder.length === 0 || (document.activeElement && document.activeElement !== document.body)) return;
    const gone = was.findIndex((id) => !pieceOrder.includes(id));
    if (gone === -1) return;
    const next = was.slice(gone + 1).find((id) => pieceOrder.includes(id)) ?? was.slice(0, gone).reverse().find((id) => pieceOrder.includes(id));
    if (next === undefined) return;
    setFocusId(next);
    pieceEls.current.get(next)?.focus();
  }, [pieceOrder]);
  const stepFocus = (from: string, by: 1 | -1) => {
    const i = pieceOrder.indexOf(from);
    const to = pieceOrder[(i + by + pieceOrder.length) % pieceOrder.length];
    if (to === undefined) return;
    setFocusId(to);
    pieceEls.current.get(to)?.focus();
  };

  /*
   * DRAGGING A RUN (decision E6). The drawing group's screen matrix maps the
   * pointer to model millimetres; see useDragSession. On touch only the
   * selected piece drags (decision 16A), so a first tap selects and the page
   * still scrolls.
   */
  const [drawGroup, setDrawGroup] = useState<SVGGElement | null>(null);
  /*
   * A COARSE POINTER GETS A 44PX TARGET (decision 16A, DESIGN.md rule 10). A
   * plank drawn at a big layout's fitted scale can be a few pixels wide; on a
   * finger the invisible hit stroke is widened to 44 CSS px at the current
   * scale. Free ends and joints are drawn later, so they still win where they
   * overlap.
   */
  const [coarse, setCoarse] = useState(false);
  useLayoutEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const q = matchMedia('(pointer: coarse)');
    setCoarse(q.matches);
    const on = () => setCoarse(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  // The fault marks' and adapter diamond's enlargement on a zoomed-out board.
  const k = markScale(shown.pxPerMm);
  const hitWidth = (plank: number) =>
    coarse ? Math.max(plank, 44 / (shown.pxPerMm ?? 1)) : plank;
  if (probe) {
    const scale = shown.pxPerMm ?? 1;
    probe.current = {
      toModel: (cx, cy) => {
        const r = svgEl?.getBoundingClientRect();
        const m = drawGroup?.getScreenCTM?.();
        if (!r || !m || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
        const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
        return [p.x, p.y];
      },
      freeEndNear: (x, y, radiusPx) => {
        let best: PortRef | null = null;
        let bestD = radiusPx / scale;
        for (const p of renderedPorts) {
          const d = Math.hypot(p.x - x, p.y - y);
          if (p.free && d <= bestD) {
            best = { pieceId: p.pieceId, port: p.port };
            bestD = d;
          }
        }
        return best;
      },
    };
  }
  const { drag, handlers: dragHandlers } = useDragSession({
    group: drawGroup,
    canDrag: (id, pointerType) =>
      onRunMove !== undefined && ghost === null && (pointerType !== 'touch' || id === selected),
    // 24 CSS px at the current scale: the end-to-end snap radius on release.
    onCommit: (d) => onRunMove?.(d, 24 / (shownRef.current ?? 1)),
  });
  const hiddenRun = useMemo(
    () => (drag && runOf ? runOf(drag.pieceId) : undefined),
    // Only the dragged piece decides the set, so the layers re-render at the
    // start and end of a drag, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag?.pieceId],
  );
  /*
   * The track split by level, memoised so a preview that changes nothing
   * committed leaves the layers alone (the memo spec in moveRunApp.dom.test):
   * a fresh `filter` on every render would hand `TrackLayers` a new array.
   */
  // Unique per canvas: two canvases on a page must not share a mask.
  const casingMaskId = `casing-mask-${useId().replace(/:/g, '')}`;
  const [floorSegments, raisedSegments] = useMemo(
    () => [segments.filter((sg) => (sg.level ?? 0) < 1), segments.filter((sg) => (sg.level ?? 0) >= 1)] as const,
    [segments],
  );
  /*
   * FREE FLOOR ENDS UNDER RAISED WOOD (TODO P3). Raised track is drawn after
   * the floor's ends, so where it covers one the wood takes the click and the
   * end can be reached only from the layout list. Keyboard users already use
   * the list; this line tells a mouse user it exists.
   */
  const hiddenEnds = useMemo(
    () =>
      raisedSegments.length === 0
        ? 0
        : renderedPorts.filter(
            (p) => p.free && (p.level ?? 0) === 0 && onPlank(p.x, p.y, raisedSegments, (id) => resolve(id).plankWidthMm / 2),
          ).length,
    [renderedPorts, raisedSegments, resolve],
  );
  const dragPivot = useMemo(() => {
    if (!drag) return null;
    const p = renderedPorts.find((rp) => rp.pieceId === drag.pieceId && rp.port === 0);
    return p ? ([p.x, p.y] as const) : null;
  }, [drag?.pieceId, renderedPorts]);

  /*
   * The empty state leads with ONE action (design D10).
   *
   * It used to read "No track yet." over "Add pieces from the palette. Eight
   * large curves make an exact circle." Two sentences, neither of them a
   * thing you could click, and the useful one was a recipe you had to carry
   * to the palette and reassemble by hand. Meanwhile three other invitations
   * competed to be first: the preset row, the palette itself, and the
   * inventory prompt. A first-time user had no obvious first move.
   *
   * Now: a lead line, the circle preset as the primary action, and the rest
   * demoted to one quiet line underneath. The inventory invitation is gone
   * from here entirely and appears only after a layout exists.
   *
   * The hint names NO DIRECTION (task W4). It used to say "from the palette
   * below", which was written for a bottom strip and went silently wrong when
   * the 1000px layout (the `@media (min-width: 1000px)` block in app.css) moved the palette to a right-hand rail:
   * the one sentence whose whole job is orientation pointed the wrong way, on
   * the layout most people see. Copy that names a position depends on a
   * breakpoint and nothing asserts that dependency, so the position is left
   * out instead of branched on.
   */
  /*
   * TOO MUCH TRACK TO DRAW IS A STATE, NOT A FREEZE.
   *
   * This canvas emits about 20 SVG tags per piece -- `maxLayers x segments`
   * paths plus three circles per FREE port -- with no virtualisation, so its
   * cost is linear in pieces with a large constant. MEASURED here through
   * `renderToStaticMarkup`, which is a FLOOR for what a browser then does
   * (reconciliation, SVG layout and paint, plus a click and key handler on
   * every free port):
   *
   *     2,000 pieces     76ms    40,000 tags    1.6MB
   *     5,000 pieces    169ms   100,000 tags    4.0MB
   *    10,000 pieces    453ms   200,000 tags    8.0MB
   *    20,000 pieces    793ms   400,000 tags   16.1MB
   *    40,000 pieces   1474ms   800,000 tags   32.2MB
   *
   * and at 120,000 pieces -- a 3.72M-char stored layout, inside a ~5MB quota,
   * which `loadGraph` accepts with nothing discarded -- it is 3,153ms for 1.2M
   * elements. That happens INSIDE render, so there is no throw for
   * `ErrorBoundary` to catch: the tab simply stops, the "Clear saved data"
   * escape is never painted, and every reload does it again. It is the same
   * uncatchable hang the solver used to cause, one layer downstream of every
   * bound that was added to stop it.
   *
   * 10,000 is a product line, not a performance target, and it is set where
   * the drawing stays under about half a second. Real layouts are hundreds of
   * pieces; the filed cap entry puts a big floor at a few hundred, so this
   * leaves more than an order of magnitude of room. Above it the canvas says
   * so in words and keeps the app usable -- the palette, the verdict and
   * Clear all still work, so this is recoverable where a freeze is not.
   *
   * This is the CHEAP HALF of the P0 in `docs/plan/brio-TODOS.md`. The real
   * half is virtualisation: draw what the viewport covers and no layout is
   * ever too big to open. Until then, refusing to draw is the honest answer,
   * and it is the one that never lies about what was checked -- the verdict is
   * still computed and still shown, because `solveGraph` does not depend on
   * this.
   */
  /*
   * THE SELECTED PIECE'S LABEL (decisions E5 and 21A), counter-flipped like the
   * gap figure. `.num` at 13px; its box is estimated from the text at the
   * current scale (7px a character, 16px tall), which is all the fallback
   * needs to keep it off a gap figure and inside the view.
   */
  const labelSeg = selected !== null ? segments.find((seg) => seg.pieceId === selected) : undefined;
  const labelText = labelSeg && pieceName ? pieceName(selected!) : null;
  const mmPerPx = 1 / (shown.pxPerMm ?? 1);
  const labelAt =
    labelSeg && labelText
      ? labelSpot(
          labelSeg,
          22 * mmPerPx,
          resolve(labelSeg.partId).plankWidthMm / 2 + 14 * mmPerPx,
          [(labelText.length * 7 * mmPerPx) / 2, 8 * mmPerPx],
          shown,
          gapMarks.map((g) => g.label),
        )
      : null;
  const selectedLabel =
    labelAt && labelText ? (
      <g transform={`translate(${labelAt[0]}, ${labelAt[1]}) scale(${mmPerPx}, ${-mmPerPx})`}>
        <text className="piece-label num" x={0} y={0} textAnchor="middle" dominantBaseline="middle">
          {labelText}
        </text>
      </g>
    ) : null;

  /*
   * The empty and too-big states sit in the same frame as the drawing, so the
   * view's corner (the 2D/3D switch, design 1A) is there in every state.
   */
  const framed = (node: ReactNode) => (
    <div className="canvas-frame">
      <div className="canvas-area">
        {node}
        {corner}
      </div>
    </div>
  );
  if (segments.length > CANVAS_SEGMENT_CEILING) {
    return framed(
      <div className="canvas-empty">
        <p className="canvas-empty-lead">
          Too much track to draw: {segments.length.toLocaleString()} pieces.
        </p>
        <p className="canvas-empty-hint">
          The layout is still here and still checked, and the verdict below
          applies to all of it. Remove some track to see the picture again.
        </p>
      </div>,
    );
  }

  if (segments.length === 0 && !ghost) {
    return framed(
      <div className="canvas-empty">
        <p className="canvas-empty-lead">Nothing on the floor yet.</p>
        {emptyAction && <div className="canvas-empty-action">{emptyAction}</div>}
        <p className="canvas-empty-hint">
          Or place pieces one at a time from the palette.
        </p>
      </div>,
    );
  }

  /*
   * TWO PASSES, FLOOR THEN RAISED (two-layer plan, core 6 and OV4). Track,
   * seams, selection, piece targets, joints and free ends are drawn once per
   * level, so raised track and its targets sit on top: where a bridge crosses
   * floor track, a click lands on the bridge, never on the floor joint under
   * it. A floor end hidden that way is still reachable from the piece list
   * (keyboard route, U7b). Ramps sit in the floor pass: their entry frame is
   * the floor, and nothing may overlap one anyway.
   */
  const raisedIds = new Set(segments.flatMap((sg) => ((sg.level ?? 0) >= 1 && sg.pieceId !== undefined ? [sg.pieceId] : [])));
  const raisedPiece = (id: string) => raisedIds.has(id);
  const onLevel = (raised: boolean) => (sg: Segment) => ((sg.level ?? 0) >= 1) === raised;
  const portLevel = new Map(renderedPorts.map((p) => [`${p.pieceId}#${p.port}`, p.level ?? 0]));
  const raisedPort = (ref: { pieceId: string; port: number }) => (portLevel.get(`${ref.pieceId}#${ref.port}`) ?? 0) >= 1;
  /*
   * SHADOWS, UNDER ALL THE WOOD. Every shadow is drawn before the floor pass,
   * so wood always covers shadow: it shows on bare floor, where it reads as
   * lifted, and never paints over a ramp's top or a floor plank. Drawn after
   * the floor pass instead, a raised curve's shadow fell across the ramp it
   * starts from and showed as a dark tab at the joint (browser check,
   * 2026-10-23). Where raised track crosses floor track the bridge casing
   * says so. Ink only, never a target.
   */
  /** One segment's shadow, or null when it casts none (floor track). */
  const shadowOf = (seg: Segment, key: string) =>
    (seg.level ?? 0) < 1 && !seg.rise ? null : seg.rise ? (
      <path key={key} d={rampShadow(seg, resolve(seg.partId).plankWidthMm / 2)} className="raised-shadow is-ramp" />
    ) : (
      <path
        key={key}
        d={segmentPath(seg)}
        className="raised-shadow"
        strokeWidth={resolve(seg.partId).plankWidthMm}
        transform={`translate(${SHADOW_OFFSET_MM}, ${-SHADOW_OFFSET_MM})`}
      />
    );
  const shadows = () =>
    segments.map((seg, i) =>
      seg.pieceId === undefined || hiddenRun?.has(seg.pieceId) ? null : shadowOf(seg, `shadow-${i}`),
    );
  /*
   * THE PIECE BEING PLACED (decision 10A). Its wood at --ghost-opacity,
   * its edge opaque and SOLID (dashed is the cursor's), ink when it fits
   * and --fail when it would not. Ink only: never a target, so a click
   * through it reaches the free end underneath (eng S4).
   *
   * A FLOOR PREVIEW GOES UNDER RAISED TRACK (owner, 2026-10-24): drawn between
   * the floor and raised passes, so a straight laid under a bridge reads as
   * passing under it, as it will once placed. Raised or ramp: on top.
   */
  const ghostOnFloor = ghost !== null && ghost.render.segments.every((seg) => (seg.level ?? 0) === 0 && !seg.rise);
  const ghostLayer = ghost && (
    <g className={`ghost${ghost.red ? ' is-red' : ''}`} pointerEvents="none">
      {/*
        * Its shadow if it would be raised, or a ramp's taper (design
        * review 3A): the preview looks like what Place makes. Solid,
        * outside the translucent wood, so no contrast rests on the
        * opacity.
        */}
      {ghost.render.segments.map((seg, i) => shadowOf(seg, `ghost-shadow-${i}`))}
      <g className="ghost-wood">
        <TrackLayers segments={ghost.render.segments} resolve={resolve} maxLayers={maxLayers} keyPrefix="ghost-" />
      </g>
      {ghost.render.segments.flatMap((seg, i) =>
        plankEdges(seg, resolve(seg.partId).plankWidthMm / 2).map((d, side) => (
          <path key={`ghost-edge-${i}-${side}`} d={d} className="ghost-edge" />
        )),
      )}
    </g>
  );
  const raisedHere = segments.some((seg) => (seg.level ?? 0) >= 1 || Boolean(seg.rise));
  const levelLayer = (raised: boolean) => (
    <>
        {!raised && shadows()}
        {/*
          * THE BRIDGE GAP (design 1A, eng re-run D2): before the raised wood,
          * each raised piece is drawn as a stroke a little wider than its
          * plank in the canvas ground's colour. Where it crosses floor track
          * that cuts a clean gap, so a bridge reads as over and under; over
          * bare floor it is invisible. Millimetres, like the wood (geometry,
          * not a mark), and ink only. Ramps never get one: nothing may lie
          * over a ramp, and the casing would nick its high end.
          */}
        {raised && raisedSegments.length > 0 && (
          <>
            {/*
              * MASKED TO FLOOR WOOD. Unmasked, the casing also painted the
              * floor colour over the raised piece's own shadow and left a
              * light stripe between wood and shadow (browser check,
              * 2026-10-23). The gap is only ever meant to cut floor track.
              */}
            <mask id={casingMaskId}>
              {floorSegments.map((seg, i) => (
                <path
                  key={`casing-mask-${i}`}
                  d={segmentPath(seg)}
                  fill="none"
                  stroke="white"
                  strokeWidth={resolve(seg.partId).plankWidthMm}
                />
              ))}
            </mask>
            <g mask={`url(#${casingMaskId})`}>
              {raisedSegments.map((seg, i) =>
                seg.pieceId === undefined || hiddenRun?.has(seg.pieceId) ? null : (
                  <path
                    key={`casing-${i}`}
                    d={segmentPath(seg)}
                    className="bridge-casing"
                    strokeWidth={resolve(seg.partId).plankWidthMm + BRIDGE_CASING_MM}
                  />
                ),
              )}
            </g>
          </>
        )}
        {/*
          * Layer by layer across ALL segments, not all layers per segment.
          * Otherwise a piece's grooves would paint over the neighbouring
          * piece's plank edge wherever two pieces meet, and the wood would
          * break up at every joint. Where one piece ends is shown on purpose,
          * by the seam layer's one thin line (decision 11A), not by this
          * accident of paint order.
          */}
        <TrackLayers segments={raised ? raisedSegments : floorSegments} resolve={resolve} maxLayers={maxLayers} hidden={hiddenRun} />
        {/*
          * THE RUN BEING DRAGGED (decision E6): the same wood, moved by one
          * transform, nothing solved. Its pieces are hidden from the layers
          * above for the drag's duration.
          */}
        {!raised && drag && dragPivot && (
          <g
            className="drag-run"
            pointerEvents="none"
            transform={`translate(${drag.dx}, ${drag.dy}) rotate(${drag.turns * 22.5}, ${dragPivot[0]}, ${dragPivot[1]})`}
          >
            {/* Its shadows travel with it, under its wood (design review 2A, PR #46). */}
            {segments.map((sg, i) =>
              sg.pieceId !== undefined && hiddenRun!.has(sg.pieceId) ? shadowOf(sg, `drag-shadow-${i}`) : null,
            )}
            <TrackLayers
              segments={segments.filter((sg) => sg.pieceId !== undefined && hiddenRun!.has(sg.pieceId))}
              resolve={resolve}
              maxLayers={maxLayers}
              keyPrefix="drag-"
            />
            {seams
              .filter((m) => hiddenRun!.has(m.pieceId))
              .map((m, i) => (
                <line key={`drag-seam-${i}`} className="seam" x1={m.from[0]} y1={m.from[1]} x2={m.to[0]} y2={m.to[1]} />
              ))}
          </g>
        )}
        {/*
          * SEAMS, after every track layer so no plank paints over one, and
          * before the joint targets so a seam never takes a click. Ink, not a
          * target: `pointer-events: none` comes from the stylesheet.
          */}
        {/* The dragged run's seams travel with it, in the overlay above. */}
        {seams.filter((m) => raisedPiece(m.pieceId) === raised).map((m, i) => {
          if (hiddenRun?.has(m.pieceId)) return null;
          const [from, to] = pastEdges(m, SEAM_OVERHANG_PX * mmPerPx);
          return <line key={`seam-${i}`} className="seam" x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />;
        })}
        {/*
          * SELECTION (decisions 10A and 2A): the rest of the selected piece's
          * run gets a quiet 1px line along both plank edges, the piece itself
          * a 2px one. Along the edges, not a fat stroke under the track, so
          * each keeps its device weight at every zoom (non-scaling strokes).
          */}
        {selected !== null &&
          segments.filter(onLevel(raised)).map((seg, i) => {
            if (seg.pieceId === undefined) return null;
            const isSelected = seg.pieceId === selected;
            if (!isSelected && !selectedRun?.has(seg.pieceId)) return null;
            const half = resolve(seg.partId).plankWidthMm / 2;
            return plankEdges(seg, half).map((d, side) => (
              <path
                key={`sel-${i}-${side}`}
                d={d}
                className={isSelected ? 'piece-selected' : 'piece-run'}
              />
            ));
          })}
        {/*
          * THE PIECES AS TARGETS (decision R1/D2). An invisible stroke the
          * width of the plank. Drawn AFTER the track and BEFORE joints and free
          * ends, so those keep winning the hit-test where they overlap: ends and
          * joints are the smaller, more precise targets.
          *
          * The dotted edges inside each group are its keyboard focus mark
          * (decision 17A), shown only under `:focus-visible`.
          */}
        {onPieceSelect &&
          pieceOrder.filter((id) => raisedPiece(id) === raised).map((id) => {
            const segs = segments.filter((seg) => seg.pieceId === id);
            const width = resolve(segs[0]!.partId).plankWidthMm;
            return (
              <g
                key={`piece-${id}`}
                ref={(el) => {
                  if (el) pieceEls.current.set(id, el);
                  else pieceEls.current.delete(id);
                }}
                className="piece"
                role="button"
                tabIndex={id === tabStop ? 0 : -1}
                aria-label={pieceName ? pieceName(id) : id}
                aria-pressed={id === selected}
                onFocus={() => setFocusId(id)}
                {...(() => {
                  const h = dragHandlers(id);
                  return {
                    onPointerDown: h.onPointerDown,
                    onPointerMove: h.onPointerMove,
                    onPointerUp: h.onPointerUp,
                    onPointerCancel: h.onPointerCancel,
                    onClick: (e: React.MouseEvent) => {
                      e.stopPropagation();
                      // The click a browser fires at the end of a drag is not a selection.
                      if (h.swallowsClick()) return;
                      onPieceSelect(id);
                    },
                  };
                })()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPieceSelect(id);
                  } else if ((e.key === 'Delete' || e.key === 'Backspace') && id === selected) {
                    e.preventDefault();
                    onPieceRemove?.(id);
                  } else if (id === selected && !e.altKey && onRunMove && e.key.startsWith('Arrow')) {
                    /*
                     * KEYBOARD PARITY (decisions E6, D14): the arrows move the
                     * selected piece's run a centimetre, Shift ten. Up is +y,
                     * because the drawing is flipped to read as a floor.
                     */
                    e.preventDefault();
                    const stepMm = e.shiftKey ? 100 : 10;
                    const dx = e.key === 'ArrowRight' ? stepMm : e.key === 'ArrowLeft' ? -stepMm : 0;
                    const dy = e.key === 'ArrowUp' ? stepMm : e.key === 'ArrowDown' ? -stepMm : 0;
                    onRunMove({ pieceId: id, dx, dy, turns: 0 }, 0);
                  } else if (id === selected && onRunMove && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    onRunMove({ pieceId: id, dx: 0, dy: 0, turns: 1 }, 0);
                  } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    stepFocus(id, 1);
                  } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
                    e.preventDefault();
                    stepFocus(id, -1);
                  }
                }}
              >
                {segs.map((seg, i) => (
                  <path key={`hit-${i}`} d={segmentPath(seg)} className="piece-hit" strokeWidth={hitWidth(width)} />
                ))}
                {segs.flatMap((seg, i) =>
                  plankEdges(seg, width / 2).map((d, side) => (
                    <path key={`focus-${i}-${side}`} d={d} className="piece-focus" />
                  )),
                )}
              </g>
            );
          })}
        {/*
          * THE CLASH MARKERS.
          *
          * Deduplicated by position, which is now belt-and-braces:
          * `findVertexClashes` emits one record per PLACE, so one marker per
          * place falls out of that contract rather than out of this dedupe.
          * It used to report one per PAIR of vertices, and a point where
          * three ends met was drawn three times at full opacity, reading as
          * something worse than it is. Kept because the agreement between
          * the verdict's count and this picture should not depend on a
          * caller's guarantee staying true.
          *
          * Drawn inside the flipped group so the coordinates are the model's
          * own millimetres, the same ones the verdict counted. Radius is in
          * millimetres too, so the marker stays the size of the track rather
          * than growing with the layout.
          */}
        {/*
          * JOINTS: the second editing target, and the destructive one (task
          * U5, Y1 decision 5).
          *
          * DRAWN BEFORE THE FREE ENDS, and that is the precedence rule. SVG
          * hit-testing takes the topmost element, so a free end's r=26 circle
          * painted later covers any part of a joint's r=14 circle it overlaps:
          * free ends win, creation stays the easy verb and destruction the
          * harder one to hit.
          *
          * Idle, a joint draws nothing; a join is not a mark. Hovered or
          * focused, it shows an open bracket pair at r=14 along the track,
          * the "about to come apart" shape. Brackets rather than a ring
          * because r=16 (armed) and r=28 (clash) are already rings. The click
          * is the commit; Undo is the way back.
          */}
        {onWeldClick &&
          welds.filter((w) => raisedPort(w.a) === raised).map((w) => (
            <g
              key={`weld-${w.a.pieceId}#${w.a.port}-${w.b.pieceId}#${w.b.port}`}
              className="weld"
              transform={`translate(${w.at[0]}, ${w.at[1]}) rotate(${(w.h * 180) / Math.PI})`}
              onClick={() => onWeldClick(w.a, w.b)}
              role="button"
              tabIndex={0}
              aria-label="Break this joint"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onWeldClick(w.a, w.b);
                }
              }}
            >
              <circle r={14} className="weld-hit" />
              <path d={WELD_BRACKETS} className="weld-bracket" />
            </g>
          ))}
        {/*
          * FREE ENDS: the editing surface (decision D5).
          *
          * Drawn only where a weld does not already claim a port, because a
          * join is not somewhere you can attach anything. Clicking one arms
          * it; clicking a second welds the two together, which is how a loop
          * closes now that `closed: boolean` is gone.
          *
          * The visible dot is small, in millimetres so it stays the size of
          * the track, but the hit target around it is much larger. A 6mm
          * circle is an unfair thing to ask anyone to click, and the SVG is
          * scaled to fit so its on-screen size changes with the layout.
          */}
        {renderedPorts
          .filter((p) => p.free && (p.level ?? 0) >= 1 === raised)
          .map((p) => {
            const isArmed =
              armed !== null &&
              armed.pieceId === p.pieceId &&
              armed.port === p.port;
            const isCursor =
              cursor !== null &&
              cursor.pieceId === p.pieceId &&
              cursor.port === p.port;
            /*
             * ONLY `is-armed`, because only `is-armed` has a rule behind it.
             * This carried an `is-cursor` class too, and nothing in app.css or
             * tokens.css ever styled it and no spec ever read it: inert
             * markup, which is the very thing the stylesheet specs in
             * trackCanvasPolarity.test.ts were written to catch. The cursor is
             * drawn by the `.port-cursor-ring` circle below and announced in
             * the accessible name; it needs no class.
             */
            // Can't join the armed end: dimmed, and the reason is in the name and on hover.
            const refused = unjoinable?.get(`${p.pieceId}#${p.port}`);
            const portClass = `port${isArmed ? ' is-armed' : ''}${refused ? ' is-unjoinable' : ''}`;
            return (
              <g
                key={`${p.pieceId}#${p.port}`}
                className={portClass}
                onClick={() => onPortClick?.({ pieceId: p.pieceId, port: p.port })}
                role="button"
                tabIndex={0}
                /*
                 * The polarity is IN THE NAME, because the drawing that
                 * carries it is sight-only. A filled dot and a hollow dot are
                 * the whole distinction on screen, and a screen reader saw
                 * neither: every end announced as just "Free end", which is
                 * the same thing a two-peg and a two-socket piece used to
                 * look like.
                 *
                 * "peg end" and "socket end" rather than a direction or a
                 * colour: the words name the part of the track, so they stay
                 * true whatever the dot looks like.
                 */
                aria-label={
                  /*
                   * THE CURSOR IS IN THE NAME TOO, for the reason the comment
                   * above gives: the ring and the fill are sight-only, so a
                   * state a screen reader cannot hear is a state it does not
                   * have. When the cursor and the armed end were one value
                   * there was one word to say; now there are two states and
                   * both are announced.
                   *
                   * ARMED WINS AND SAYS ONLY "Selected", which drops no
                   * information because ARMED IMPLIES THE CURSOR IS ON THE
                   * SAME PORT. `clickPort` is the only action that ARMS A NEW
                   * END, and it sets both fields to the same ref. The other
                   * actions write `armed` too -- `add` narrows it through
                   * `stillFree`, and `undo`, `clear` and `preset` null it --
                   * but none of them points it anywhere new. So "selected"
                   * and "attaches here" are the same end whenever both hold,
                   * and a second clause would repeat the first.
                   *
                   * The walk in editorReducer.test.ts checks this over every
                   * state reachable in four actions. It cannot check an action
                   * that does not exist yet: its action list is written out by
                   * hand, so a NEW `EditorAction` variant that armed an end
                   * without targeting it would pass unnoticed and this label
                   * would be wrong. Anyone adding one has to add it there too.
                   */
                  (isArmed
                    ? 'Selected free '
                    : isCursor
                      ? 'Next piece attaches here, free '
                      : 'Free ') +
                  `${p.polarity} end` +
                  (refused ? `, can't join the selected end: ${JOIN_REFUSED_SHORT[refused]}` : '')
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPortClick?.({ pieceId: p.pieceId, port: p.port });
                  }
                }}
              >
                {refused && <title>{`Can't join the selected end: ${JOIN_REFUSED_SHORT[refused]}`}</title>}
                <circle cx={p.x} cy={p.y} r={26} className="port-hit" />
                {/*
                  * ARMED IS A RING, NOT A BIGGER BLOB (task W3, decision D5).
                  *
                  * The dot keeps ONE radius in every state. It used to swell
                  * from 8 to 13 and fill with --ink, which made a pending
                  * choice the heaviest mark on the canvas, heavier than most
                  * of the track it sat on, and it read as a defect. The ring
                  * carries the signal instead; at r=16 it is also visibly
                  * smaller than the r=28 clash ring below, so the two marks
                  * cannot be mistaken for each other.
                  */}
                {isArmed && <circle cx={p.x} cy={p.y} r={16} className="port-ring" />}
                {/*
                  * THE CURSOR RING: where the next piece will attach.
                  *
                  * Needed because splitting the cursor from the armed end made
                  * the r=16 ring mean ARMED only. Without this, disarming an
                  * end left no mark at all while the cursor was still live, so
                  * the user had less information than before the split, not
                  * more.
                  *
                  * A DASHED ring, in `--ink-soft`, at r=21. Every part of that
                  * is picked to avoid a channel something else owns: dashes are
                  * used by nothing else here, `--ink` is the armed ring's stroke
                  * among the port marks and must stay the heaviest of them
                  * (the focus ring uses `--ink` too, but focus is transient and
                  * keyboard-driven, so the two never compete for meaning),
                  * `fill` carries polarity, and 21 sits between the armed 16
                  * and the clash 28 so three rings cannot be confused.
                  * Suppressed when the end is armed, because the armed ring
                  * already marks it and two rings on one dot is noise.
                  */}
                {isCursor && !isArmed && (
                  <circle cx={p.x} cy={p.y} r={21} className="port-cursor-ring" />
                )}
                {/*
                  * A JOIN TARGET (design 27A): an end the join can go to, while
                  * joining. Weight, not colour: 2px against the armed end's 3px,
                  * and inside it at r=12 so the two rings never sit on one line.
                  */}
                {joining && !isArmed && !refused && <circle cx={p.x} cy={p.y} r={12} className="port-target-ring" />}
                {/*
                  * Filled is a peg, hollow is a socket; same radius, so this
                  * adds no ink to a dense layout. A switch's heel is drawn the
                  * same way, because it is a peg or a socket too. Why the
                  * drawing exists at all: the DONE entry in
                  * docs/plan/brio-TODOS.md.
                  */}
                <circle cx={p.x} cy={p.y} r={8} className={POLARITY_CLASS[p.polarity]} />
              </g>
            );
          })}
      {/*
        * JOIN SUGGESTIONS (design review 28B): two free ends that nearly meet
        * get a "Join" button between them, so the commonest join (a loop that
        * stops just short) is one press. Sized in screen pixels like the
        * marks, 44px tall on a finger (DESIGN.md rule 10); last in the layer
        * so nothing on its level covers it. Ink and paper only (rule 1).
        */}
      {!ghost &&
        suggestions
          .filter((g) => (g.level >= 1) === raised)
          .map((g) => {
            const w = 56 * mmPerPx;
            const hgt = (coarse ? 44 : 28) * mmPerPx;
            const name = suggestionName?.(g) ?? 'Join these two ends';
            return (
              <g
                key={`suggest-${g.a.pieceId}#${g.a.port}-${g.b.pieceId}#${g.b.port}`}
                className="join-suggest"
                role="button"
                tabIndex={0}
                aria-label={name}
                onClick={() => onSuggest?.(g)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSuggest?.(g);
                  }
                }}
              >
                <title>{name}</title>
                <rect x={g.at[0] - w / 2} y={g.at[1] - hgt / 2} width={w} height={hgt} rx={4 * mmPerPx} className="join-suggest-box" />
                <g transform={`translate(${g.at[0]}, ${g.at[1]}) scale(1, -1)`}>
                  <text className="join-suggest-text" x={0} y={0} style={{ fontSize: 14 * mmPerPx }}>
                    Join
                  </text>
                </g>
              </g>
            );
          })}
    </>
  );

  return (
    <div className="canvas-frame">
    <div className="canvas-area">
    <svg
      ref={setSvgEl}
      className="canvas"
      viewBox={vb}
      role="img"
      aria-label="Track layout"
      onClick={(e) => {
        // Bare floor only: the svg itself or the grid, never a piece, end or joint.
        const t = e.target as Element;
        if (t === e.currentTarget || t.classList.contains('grid')) onFloorClick?.();
      }}
    >
      {/* y grows downward in SVG; flip so the geometry reads as it would on a floor. */}
      <g ref={setDrawGroup} transform={`translate(0, ${2 * box.minY - 2 * pad + h}) scale(1, -1)`}>
        {/*
          * Under everything, so no track mark is ever drawn behind a grid
          * line. One path for the whole grid; see `gridPath`.
          */}
        <path className="grid" d={gridPath(shown.minX, shown.minY, shown.width, shown.height, step)} />
        {/*
          * THE TABLE (backlog E4): over the grid and under the track, so the
          * wood that hangs past an edge is drawn on top of the line it
          * crosses. Ink only, like the grid, so a click reaches the floor.
          */}
        {table && (
          <rect
            className={`table-outline${table.fits ? '' : ' is-over'}`}
            x={table.outline.minX}
            y={table.outline.minY}
            width={table.outline.maxX - table.outline.minX}
            height={table.outline.maxY - table.outline.minY}
          />
        )}
        {levelLayer(false)}
        {ghostOnFloor && ghostLayer}
        {levelLayer(true)}
        {/*
          * THE GAP, DRAWN (task W2, decision D4).
          *
          * Monochrome on purpose. The only colour on this canvas belongs to a
          * verdict, and the only red belongs to a clash; a gap is a
          * measurement, and NEEDS_GIVE is a gap that is perfectly fine. An
          * amber or red leader here would tell the user something is broken on
          * a layout that builds.
          *
          * The figure is counter-flipped. The whole group above is drawn under
          * `scale(1, -1)` so the geometry reads as it would on a floor, and
          * text inside that group renders mirrored. Flipping it back at the
          * label's own origin is what makes "12mm" legible rather than
          * reversed.
          *
          * No extra mark sits AT the spot: the two port dots are already there
          * at r=8 and the armed ring at r=16, and a third ring in the same
          * place would read as another state rather than as a dimension.
          */}
        {gapMarks.map((g, i) => (
          <g key={`gap-${i}`} className="gap">
            <line
              x1={g.at[0]}
              y1={g.at[1]}
              x2={g.leaderEnd[0]}
              y2={g.leaderEnd[1]}
              className="gap-leader"
            />
            <g transform={`translate(${g.label[0]}, ${g.label[1]}) scale(1, -1)`}>
              <text className="gap-figure num" x={0} y={0}>
                {g.gapMm.toFixed(0)}mm
              </text>
            </g>
          </g>
        ))}
        {/*
          * A REFUSED JOINT, DRAWN, and deliberately NOT the clash marker.
          *
          * Both mean "can't be built", so both are `--fail` red. But the
          * verdict counts them in two different sentences -- "N spots have two
          * or more track ends on top of each other" and "N joints put two ends
          * of the same kind together" -- so one shared marker would put a
          * total on screen that matches neither number. A clash is a ring with
          * an X at r=28; a refused joint is a smaller ring with a single bar,
          * which reads as blocked rather than crossed out.
          *
          * It is drawn at the joint itself, where no port dot appears: once a
          * weld claims both ends, the dots that would have shown the polarity
          * are gone, which is exactly why this mark has to exist.
          */}
        {badJoints.map(([x, y], i) => (
          /*
           * `pointer-events: none` because a marker is ink, not a target. The
           * bar is 4 units thick and sits above the r=26 hit circles, so
           * without this it can swallow a click on a free end underneath it.
           * The class is what the specs count: a radius is a number someone
           * will retune, and a spec pinned to `r="18"` would then fail for a
           * reason that has nothing to do with the marker existing.
           */
          <RedMark key={`badjoint-${i}`} className="bad-joint-mark" x={x} y={y} r={18} d="M -10 0 L 10 0" k={k} />
        ))}
        {adapterJoints.map(([x, y], i) => (
          // Ink, not a target, like the other marks; the class is what specs count.
          <g key={`adapter-${i}`} className="adapter-joint-mark" pointerEvents="none" transform={`translate(${x}, ${y}) scale(${k})`}>
            {/* Stroke, weight and fill live in app.css (.adapter-joint-mark): non-scaling, rule 11. */}
            <path className="adapter-outline" d="M 0 -16 L 16 0 L 0 16 L -16 0 Z" />
            <path className="adapter-core" d="M 0 -5 L 5 0 L 0 5 L -5 0 Z" />
          </g>
        ))}
        {/*
          * THE LEVEL FAULTS (design 6A): a ring with a step where a joint
          * joins two levels, a ring with a double chevron on a ramp that
          * would climb to a third level. Shapes no other mark uses, red like
          * every fault, with the paper halo (10B).
          */}
        {levelMismatches.map(([x, y], i) => (
          <RedMark key={`levelmismatch-${i}`} className="level-mismatch-mark" x={x} y={y} r={18} d="M -10 -4 H 0 V 4 H 10" k={k} />
        ))}
        {thirdLevels.map(([x, y], i) => (
          <RedMark key={`thirdlevel-${i}`} className="third-level-mark" x={x} y={y} r={18} d="M -7 -2 L 0 5 L 7 -2 M -7 -9 L 0 -2 L 7 -9" k={k} />
        ))}
        {/*
          * THE RISE CHEVRON (design 1A): an ink chevron at the middle of each
          * ramp, pointing up the slope, from its low end to its high end.
          * Ink, no colour (rule 1); device-sized stroke like the adapter mark
          * (app.css); never a target.
          */}
        {segments.map((seg, i) => {
          if (!seg.rise || (seg.pieceId !== undefined && hiddenRun?.has(seg.pieceId))) return null;
          const mx = (seg.from.x + seg.to.x) / 2;
          const my = (seg.from.y + seg.to.y) / 2;
          // Up the slope: towards `to`, or towards `from` on a ramp flipped over.
          const deg =
            (Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x) * 180) / Math.PI + (seg.highAtStart ? 180 : 0);
          return (
            <path
              key={`rise-${i}`}
              className="rise-chevron"
              pointerEvents="none"
              transform={`translate(${mx}, ${my}) rotate(${deg})`}
              d="M -6 -9 L 6 0 L -6 9"
            />
          );
        })}
        {/*
          * THE BUFFER BEAM: a solid ink block, 6mm deep, across the whole
          * plank at a buffer stop's far end, so a stop does not read as a short
          * plank. A shape no other mark uses (rule 11): ends are circles and
          * seams hairlines. Round buffers were tried first and read as two
          * port dots in the browser, so they went. Ink, not colour (rule 1);
          * drawn in millimetres like the wood it caps; never a target.
          */}
        {segments.map((seg, i) => {
          if (!seg.stop || (seg.pieceId !== undefined && hiddenRun?.has(seg.pieceId))) return null;
          const deg = (Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x) * 180) / Math.PI;
          return (
            <g
              key={`stop-${i}`}
              className="buffer-beam"
              pointerEvents="none"
              transform={`translate(${seg.to.x}, ${seg.to.y}) rotate(${deg})`}
            >
              <rect x={-6} y={-20} width={6} height={40} />
            </g>
          );
        })}
        {dedupedClashes.map(([x, y], i) => (
          <RedMark key={`clash-${i}`} className="clash-mark" x={x} y={y} r={28} d="M -14 -14 L 14 14 M -14 14 L 14 -14" k={k} />
        ))}
        {selectedLabel}
        {ghost && !ghostOnFloor && ghostLayer}
      </g>
    </svg>
    {/* HTML, not SVG text, so it is never flipped or scaled with the drawing. */}
    {/* The shadow's key, only when there is raised track to read it on (design review 1A). */}
    <p className="grid-caption num">
      Grid: {gridLabel(step)}
      {raisedHere && ' · Shadow: raised'}
    </p>
    {table && <p className={`table-caption${table.fits ? '' : ' is-over'}`}>{table.note}</p>}
    {hiddenEnds > 0 && (
      <p className="hidden-end-hint">
        {hiddenEnds === 1 ? '1 free end is' : `${hiddenEnds} free ends are`} under raised track. Reach{' '}
        {hiddenEnds === 1 ? 'it' : 'them'} from &ldquo;This layout, as a list&rdquo;.
      </p>
    )}
    {corner}
    </div>
    {strip}
    </div>
  );
}
