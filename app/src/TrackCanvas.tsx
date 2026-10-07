/**
 * The canvas. Dominant by design: it is the first thing the eye lands on, and
 * the track is the only texture on screen.
 *
 * SVG rather than a canvas library for this MVP. The engine is single-cycle and
 * there is no drag yet, so nothing needs a scene graph; SVG gives exact arcs,
 * native dotted strokes for the estimated-tolerance channel, and it prints
 * legibly in greyscale, which the build sheet will require. A real canvas layer
 * (konva or pixi) becomes the right call when drag-and-drop and large layouts
 * arrive.
 *
 * Joint verdicts are drawn on FOUR channels, not one: colour, glyph shape, the
 * numeric ratio on hover, and a dotted outline whenever the tolerance behind
 * the verdict is estimated rather than measured. Colour alone fails roughly one
 * man in twelve and disappears entirely in greyscale print.
 */

import { useMemo } from 'react';
import { bounds, walkFloat, type FPose, type Segment } from '../../engine/src/geom/fk.js';
import { getPart } from '../../engine/data/brio.js';
import type { JointEvaluation, JointVerdict } from '../../engine/src/joints/evaluate.js';
import type { Layout } from '../../engine/src/parts/schema.js';

const VERDICT_COLOUR: Record<JointVerdict, string> = {
  PASS: 'var(--pass)',
  TIGHT: 'var(--tight)',
  FAIL: 'var(--fail)',
  UNKNOWN: 'var(--unknown)',
};

function segmentPath(s: Segment): string {
  const { from, to } = s;
  if (s.kind === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const r = s.radiusMm ?? 0;
  // SVG sweep flag: our y axis points down in screen space after the flip in
  // the viewBox transform, so a left turn draws as sweep 1.
  const sweepFlag = s.sweep === 'left' ? 1 : 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${sweepFlag} ${to.x} ${to.y}`;
}

/** Glyph per verdict. Shape carries the verdict independently of colour. */
function Glyph({ verdict, size }: { verdict: JointVerdict; size: number }) {
  const c = VERDICT_COLOUR[verdict];
  const r = size;
  switch (verdict) {
    case 'PASS':
      return <circle r={r} fill="none" stroke={c} strokeWidth={size * 0.45} />;
    case 'TIGHT':
      return (
        <polygon
          points={`0,${-r * 1.15} ${r},${r * 0.75} ${-r},${r * 0.75}`}
          fill="none"
          stroke={c}
          strokeWidth={size * 0.45}
          strokeLinejoin="round"
        />
      );
    case 'FAIL':
      return (
        <g stroke={c} strokeWidth={size * 0.5} strokeLinecap="round">
          <line x1={-r} y1={-r} x2={r} y2={r} />
          <line x1={-r} y1={r} x2={r} y2={-r} />
        </g>
      );
    case 'UNKNOWN':
      return (
        <>
          <circle r={r} fill="none" stroke={c} strokeWidth={size * 0.3} strokeDasharray="2 2" />
          <text
            y={r * 0.62}
            textAnchor="middle"
            fontSize={r * 1.7}
            fill={c}
            fontFamily="var(--font-data)"
          >
            ?
          </text>
        </>
      );
  }
}

export interface TrackCanvasProps {
  readonly layout: Layout;
  readonly evals: readonly JointEvaluation[];
  /** Index of the most recent change; the settle propagates outward from here. */
  readonly changedAt: number | null;
}

export function TrackCanvas({ layout, evals, changedAt }: TrackCanvasProps) {
  const { poses, segments } = useMemo(
    () => walkFloat(layout, getPart),
    [layout],
  );

  const box = useMemo(() => bounds(poses), [poses]);
  const pad = 90;
  const w = Math.max(box.maxX - box.minX, 1) + pad * 2;
  const h = Math.max(box.maxY - box.minY, 1) + pad * 2;
  const vb = `${box.minX - pad} ${box.minY - pad} ${w} ${h}`;

  const glyphSize = Math.max(7, Math.min(w, h) * 0.016);
  const trackWidth = Math.max(10, Math.min(w, h) * 0.022);

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
            strokeWidth={trackWidth}
            strokeLinecap="butt"
          />
        ))}
        {segments.map((s, i) => (
          <path
            key={`i${i}`}
            d={segmentPath(s)}
            fill="none"
            stroke="var(--track-fill)"
            strokeWidth={trackWidth * 0.62}
            strokeLinecap="butt"
          />
        ))}

        {evals.map((e) => {
          const p: FPose | undefined = poses[e.index + 1];
          if (!p) return null;
          // Propagating settle: joints nearer the change move first.
          const dist = changedAt === null ? 0 : Math.abs(e.index - changedAt);
          const delay = Math.min(dist * 18, 160);
          return (
            <g
              key={e.index}
              className="joint"
              style={{ transitionDelay: `${delay}ms` }}
              transform={`translate(${p.x}, ${p.y}) scale(1, -1)`}
            >
              {/* Dotted ring = the tolerance behind this verdict is not measured. */}
              {e.calibrationStatus !== 'measured' && (
                <circle
                  r={glyphSize * 2}
                  fill="none"
                  stroke={VERDICT_COLOUR[e.verdict]}
                  strokeWidth={glyphSize * 0.22}
                  strokeDasharray={`${glyphSize * 0.5} ${glyphSize * 0.5}`}
                  opacity={0.55}
                />
              )}
              <circle r={glyphSize * 1.5} fill="var(--paper)" />
              <Glyph verdict={e.verdict} size={glyphSize} />
              <title>
                {`joint ${e.index}: ${e.verdict} at ${(e.ratio * 100).toFixed(0)}% of budget — ${e.reasons.join('; ')}`}
              </title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
