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

import { useMemo, type ReactNode } from 'react';
import { renderBounds, type GraphRender } from '../../engine/src/graph/render.js';
import type { PortRef } from '../../engine/src/graph/model.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { clashMarkers, gapAnnotations, segmentPath, type GapMark } from './trackPath.js';

/**
 * How many pieces this canvas will draw before it says there are too many.
 *
 * Exported so a spec can pin the boundary rather than restate the number, and
 * so the entry in `docs/plan/brio-TODOS.md` can cite one place. The measured
 * cost behind the value is at the guard that uses it.
 */
export const CANVAS_SEGMENT_CEILING = 10_000;

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
  /** The free end currently armed, if any. */
  readonly selected?: PortRef | null;
  /** Clicking a free end. This is the whole editing interaction (D5). */
  readonly onPortClick?: (ref: PortRef) => void;
}

export function TrackCanvas({
  render,
  resolve,
  emptyAction,
  clashes = [],
  gaps = [],
  selected = null,
  onPortClick,
}: TrackCanvasProps) {
  const { segments, ports: renderedPorts } = render;
  const box = useMemo(() => renderBounds(render), [render]);
  const pad = 90;
  const w = Math.max(box.maxX - box.minX, 1) + pad * 2;
  const h = Math.max(box.maxY - box.minY, 1) + pad * 2;
  const vb = `${box.minX - pad} ${box.minY - pad} ${w} ${h}`;


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
  const EDGE_MM = 1.2;
  const layers = (partId: string) => {
    const part = resolve(partId);
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
  };

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
  for (const s of segments) {
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

  if (segments.length === 0) {
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
    <svg className="canvas" viewBox={vb} role="img" aria-label="Track layout">
      {/* y grows downward in SVG; flip so the geometry reads as it would on a floor. */}
      <g transform={`translate(0, ${2 * box.minY - 2 * pad + h}) scale(1, -1)`}>
        {/*
          * Layer by layer across ALL segments, not all layers per segment.
          * Otherwise a piece's grooves would paint over the neighbouring
          * piece's plank edge wherever two pieces meet, and every joint would
          * show a seam that is not there.
          */}
        {Array.from({ length: maxLayers }).map((_, layerIndex) =>
          segments.map((s, i) => {
            const layer = layers(s.partId)[layerIndex];
            if (!layer || layer.w <= 0) return null;
            return (
              <path
                key={`${layerIndex}-${i}`}
                d={segmentPath(s)}
                fill="none"
                stroke={layer.stroke}
                strokeWidth={layer.w}
                strokeLinecap="butt"
              />
            );
          }),
        )}
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
            const armed =
              selected !== null &&
              selected.pieceId === p.pieceId &&
              selected.port === p.port;
            return (
              <g
                key={`${p.pieceId}#${p.port}`}
                className={armed ? 'port is-armed' : 'port'}
                onClick={() => onPortClick?.({ pieceId: p.pieceId, port: p.port })}
                role="button"
                tabIndex={0}
                aria-label={armed ? 'Selected free end' : 'Free end'}
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
                {armed && <circle cx={p.x} cy={p.y} r={16} className="port-ring" />}
                <circle cx={p.x} cy={p.y} r={8} className="port-dot" />
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
        {dedupedClashes.map(([x, y], i) => (
          <g key={`clash-${i}`}>
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
      </g>
    </svg>
  );
}
