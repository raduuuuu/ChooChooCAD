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

import { useMemo } from 'react';
import { bounds, walkFloat, type Segment } from '../../engine/src/geom/fk.js';
import { getPart } from '../../engine/data/brio.js';
import type { Layout } from '../../engine/src/parts/schema.js';

function segmentPath(s: Segment): string {
  const { from, to } = s;
  if (s.kind === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const r = s.radiusMm ?? 0;
  // SVG sweep flag: our y axis points down in screen space after the flip in
  // the viewBox transform, so a left turn draws as sweep 1. Pinned by
  // engine/test/render.test.ts, which proves all arcs of a circle share a centre.
  const sweepFlag = s.sweep === 'left' ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweepFlag} ${to.x} ${to.y}`;
}

export interface TrackCanvasProps {
  readonly layout: Layout;
}

export function TrackCanvas({ layout }: TrackCanvasProps) {
  const { poses, segments } = useMemo(() => walkFloat(layout, getPart), [layout]);

  const box = useMemo(() => bounds(poses), [poses]);
  const pad = 90;
  const w = Math.max(box.maxX - box.minX, 1) + pad * 2;
  const h = Math.max(box.maxY - box.minY, 1) + pad * 2;
  const vb = `${box.minX - pad} ${box.minY - pad} ${w} ${h}`;

  /*
   * Plank width comes from the PART, in millimetres (task U2).
   *
   * The viewBox is in model millimetres, so a stroke width in millimetres is
   * the physical width and nothing has to be converted. This used to read
   * `Math.max(10, Math.min(w, h) * 0.022)`, a fraction of the viewBox extent,
   * which meant the same piece drew thicker in a big layout than in a small one:
   * the one thing on screen that is supposed to be a measurement was the one
   * thing that changed with how much else you had placed.
   *
   * Per segment rather than once for the whole canvas, because `plankWidthMm` is
   * a per-part field and switches and crossings have wider planks than a plain
   * straight. Today every part carries the same estimate, so this draws
   * identically; it stops drawing identically the moment task C11 lands, without
   * needing to be touched again.
   *
   * The value is ESTIMATED and labelled as such in `brio.ts`. The UI discloses
   * that in the palette's provisional note; nothing derives a verdict from it.
   */
  const plankWidth = (partId: string) => getPart(partId).plankWidthMm;

  if (segments.length === 0) {
    return (
      <div className="canvas-empty">
        <p>No track yet.</p>
        <p className="canvas-empty-hint">
          Add pieces from the palette. Eight large curves make an exact circle.
        </p>
      </div>
    );
  }

  return (
    <svg className="canvas" viewBox={vb} role="img" aria-label="Track layout">
      {/* y grows downward in SVG; flip so the geometry reads as it would on a floor. */}
      <g transform={`translate(0, ${2 * box.minY - 2 * pad + h}) scale(1, -1)`}>
        {segments.map((s, i) => (
          <path
            key={i}
            d={segmentPath(s)}
            fill="none"
            stroke="var(--track-edge)"
            strokeWidth={plankWidth(s.partId)}
            strokeLinecap="butt"
          />
        ))}
        {segments.map((s, i) => (
          <path
            key={`i${i}`}
            d={segmentPath(s)}
            fill="none"
            stroke="var(--track-fill)"
            strokeWidth={plankWidth(s.partId) * 0.62}
            strokeLinecap="butt"
          />
        ))}
      </g>
    </svg>
  );
}
