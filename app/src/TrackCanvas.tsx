/**
 * The canvas. Dominant by design: it is the first thing the eye lands on, and
 * the track is the only texture on screen.
 *
 * SVG rather than a canvas library for this MVP. There is no scene graph
 * and there is no drag yet, so nothing needs a scene graph; SVG gives exact
 * arcs and prints legibly in greyscale, which the build sheet will require.
 *
 * NO PER-JOINT GLYPHS. They used to render a four-channel per-joint verdict
 * (colour, shape, ratio on hover, dotted ring for an unmeasured tolerance), and
 * that was the best accessibility work in this project. Decision R21 deleted
 * the solver that produced per-joint ratios, so there is no per-joint claim
 * left to make, and drawing identical markers at every joint would assert that
 * each one was checked. They come back, four channels and all, when per-joint
 * allocation does.
 */

import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Segment } from '../../engine/src/geom/fk.js';
import { renderBounds, type GraphRender } from '../../engine/src/graph/render.js';
import { useDragSession, type RunDrag } from './useDragSession.js';
import type { CanvasProbe } from './usePaletteDrag.js';
import type { PortRef } from '../../engine/src/graph/model.js';
import type { Part, Polarity } from '../../engine/src/parts/schema.js';
import {
  clashMarkers,
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
   * Where the next piece will attach. Drawn differently from `armed`, because
   * they used to be one value and a user who clicked the end they had just
   * built onto silently sent the next piece off to start its own run.
   */
  readonly cursor?: PortRef | null;
  /** The free end currently armed for a weld, if any. */
  readonly armed?: PortRef | null;
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
}

export function TrackCanvas({
  render,
  resolve,
  emptyAction,
  clashes = [],
  gaps = [],
  badJoints = [],
  cursor = null,
  armed = null,
  onPortClick,
  welds = [],
  onWeldClick,
  seams = [],
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
    return { minX: b.minX - reach, minY: b.minY - reach, maxX: b.maxX + reach, maxY: b.maxY + reach };
  }, [render, reach, segments.length, ghost !== null]);
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

  if (segments.length > CANVAS_SEGMENT_CEILING) {
    return (
      <div className="canvas-empty">
        <p className="canvas-empty-lead">
          Too much track to draw: {segments.length.toLocaleString()} pieces.
        </p>
        <p className="canvas-empty-hint">
          The layout is still here and still checked, and the verdict below
          applies to all of it. Remove some track to see the picture again.
        </p>
      </div>
    );
  }

  if (segments.length === 0 && !ghost) {
    return (
      <div className="canvas-empty">
        <p className="canvas-empty-lead">Nothing on the floor yet.</p>
        {emptyAction && <div className="canvas-empty-action">{emptyAction}</div>}
        <p className="canvas-empty-hint">
          Or place pieces one at a time from the palette.
        </p>
      </div>
    );
  }

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
          * Layer by layer across ALL segments, not all layers per segment.
          * Otherwise a piece's grooves would paint over the neighbouring
          * piece's plank edge wherever two pieces meet, and every joint would
          * show a seam that is not there.
          */}
        <TrackLayers segments={segments} resolve={resolve} maxLayers={maxLayers} hidden={hiddenRun} />
        {/*
          * THE RUN BEING DRAGGED (decision E6): the same wood, moved by one
          * transform, nothing solved. Its pieces are hidden from the layers
          * above for the drag's duration.
          */}
        {drag && dragPivot && (
          <g
            className="drag-run"
            pointerEvents="none"
            transform={`translate(${drag.dx}, ${drag.dy}) rotate(${drag.turns * 22.5}, ${dragPivot[0]}, ${dragPivot[1]})`}
          >
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
        {seams.map((m, i) => hiddenRun?.has(m.pieceId) ? null : (
          <line
            key={`seam-${i}`}
            className="seam"
            x1={m.from[0]}
            y1={m.from[1]}
            x2={m.to[0]}
            y2={m.to[1]}
          />
        ))}
        {/*
          * SELECTION (decisions 10A and 2A): the rest of the selected piece's
          * run gets a quiet 1px line along both plank edges, the piece itself
          * a 2px one. Along the edges, not a fat stroke under the track, so
          * each keeps its device weight at every zoom (non-scaling strokes).
          */}
        {selected !== null &&
          segments.map((seg, i) => {
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
          pieceOrder.map((id) => {
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
          welds.map((w) => (
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
          .filter((p) => p.free)
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
            const portClass = `port${isArmed ? ' is-armed' : ''}`;
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
                  `${p.polarity} end`
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPortClick?.({ pieceId: p.pieceId, port: p.port });
                  }
                }}
              >
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
          <g key={`badjoint-${i}`} className="bad-joint-mark" pointerEvents="none">
            <circle cx={x} cy={y} r={18} fill="none" stroke="var(--fail)" strokeWidth={4} />
            <line x1={x - 10} y1={y} x2={x + 10} y2={y}
              stroke="var(--fail)" strokeWidth={4} />
          </g>
        ))}
        {dedupedClashes.map(([x, y], i) => (
          <g key={`clash-${i}`} className="clash-mark" pointerEvents="none">
            <circle
              cx={x}
              cy={y}
              r={28}
              fill="none"
              stroke="var(--fail)"
              strokeWidth={4}
            />
            <line x1={x - 14} y1={y - 14} x2={x + 14} y2={y + 14}
              stroke="var(--fail)" strokeWidth={4} />
            <line x1={x - 14} y1={y + 14} x2={x + 14} y2={y - 14}
              stroke="var(--fail)" strokeWidth={4} />
          </g>
        ))}
        {selectedLabel}
        {/*
          * THE PIECE BEING PLACED (decision 10A). Its wood at --ghost-opacity,
          * its edge opaque and SOLID (dashed is the cursor's), ink when it fits
          * and --fail when it would not. Ink only: never a target, so a click
          * through it reaches the free end underneath (eng S4).
          */}
        {ghost && (
          <g className={`ghost${ghost.red ? ' is-red' : ''}`} pointerEvents="none">
            <g className="ghost-wood">
              <TrackLayers segments={ghost.render.segments} resolve={resolve} maxLayers={maxLayers} keyPrefix="ghost-" />
            </g>
            {ghost.render.segments.flatMap((seg, i) =>
              plankEdges(seg, resolve(seg.partId).plankWidthMm / 2).map((d, side) => (
                <path key={`ghost-edge-${i}-${side}`} d={d} className="ghost-edge" />
              )),
            )}
          </g>
        )}
      </g>
    </svg>
    {/* HTML, not SVG text, so it is never flipped or scaled with the drawing. */}
    <p className="grid-caption num">Grid: {gridLabel(step)}</p>
    </div>
    {strip}
    </div>
  );
}
