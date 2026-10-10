/**
 * The canvas. Dominant by design: it is the first thing the eye lands on, and
 * the track is the only texture on screen.
 *
 * SVG rather than a canvas library for this MVP. The layout is a single chain
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
import { bounds, walkFloat } from '../../engine/src/geom/fk.js';
import type { Layout, Part } from '../../engine/src/parts/schema.js';
import { segmentPath } from './trackPath.js';

export interface TrackCanvasProps {
  readonly layout: Layout;
  /**
   * Library resolver. Passed in rather than imported, because the library now
   * includes user-submitted parts and so cannot be a module constant.
   */
  readonly resolve: (id: string) => Part;
  /**
   * The one primary action the blank canvas offers (design D10). A slot, not a
   * preset id, because the canvas has no business knowing what a preset is or
   * how to apply one. App owns the piece list, so App owns the button.
   */
  readonly emptyAction?: ReactNode;
}

export function TrackCanvas({ layout, resolve, emptyAction }: TrackCanvasProps) {
  const { poses, segments } = useMemo(() => walkFloat(layout, resolve), [layout, resolve]);

  const box = useMemo(() => bounds(poses), [poses]);
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
  const maxLayers = Math.max(...segments.map((s) => layers(s.partId).length));

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
   */
  if (segments.length === 0) {
    return (
      <div className="canvas-empty">
        <p className="canvas-empty-lead">Nothing on the floor yet.</p>
        {emptyAction && <div className="canvas-empty-action">{emptyAction}</div>}
        <p className="canvas-empty-hint">
          Or place pieces one at a time from the palette below.
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
      </g>
    </svg>
  );
}
