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
import { renderBounds, type GraphRender, type RenderedPort } from '../../engine/src/graph/render.js';
import type { PortRef } from '../../engine/src/graph/model.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { clashMarkers, segmentPath } from './trackPath.js';

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
  const maxLayers =
    segments.length === 0 ? 0 : Math.max(...segments.map((s) => layers(s.partId).length));

  const dedupedClashes = useMemo(() => clashMarkers(clashes), [clashes]);

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
   * the 1000px layout (app.css:924) moved the palette to a right-hand rail:
   * the one sentence whose whole job is orientation pointed the wrong way, on
   * the layout most people see. Copy that names a position depends on a
   * breakpoint and nothing asserts that dependency, so the position is left
   * out instead of branched on.
   */
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
          * Deduplicated by position, because a clash is reported per PAIR and
          * a point where three ends meet would otherwise be drawn three times
          * at full opacity, reading as something worse than it is.
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
