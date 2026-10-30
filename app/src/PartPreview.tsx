/**
 * A part card's drawing (docs/plan/2026-10-30-part-previews.md). Decorative
 * (10A): `aria-hidden`, never focusable, and `pointer-events: none` in CSS, so
 * a click, double-click, drag or touch on it acts on the card. It draws in
 * `currentColor`, so it takes the card's text colour in every state (3A).
 */

import { PREVIEW_H, PREVIEW_W, type Preview } from './previewGeometry.js';

export function PartPreview({ preview }: { readonly preview: Preview | null }) {
  return (
    <svg
      className="part-preview"
      width={PREVIEW_W}
      height={PREVIEW_H}
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      aria-hidden="true"
      focusable="false"
    >
      {preview && (
        <>
          {/*
            * The plank as two strokes, a wide ink one under a narrower paper
            * one: an outline without end-cap geometry, and roads that cross
            * (a crossing, a switch's heel) merge cleanly (eng review, OV3).
            */}
          <g transform={preview.transform}>
            {preview.roads.map((d, i) => (
              <path key={`o${i}`} className="part-preview-edge" d={d} />
            ))}
            {preview.roads.map((d, i) => (
              <path key={`f${i}`} className="part-preview-plank" d={d} />
            ))}
          </g>
          {preview.beam && (
            <rect
              className="part-preview-beam"
              x={-2.5}
              y={-4.5}
              width={2.5}
              height={9}
              transform={`translate(${preview.beam.x}, ${preview.beam.y}) rotate(${preview.beam.deg})`}
            />
          )}
          {preview.chevron && (
            <path
              className="part-preview-chevron"
              d="M -2 -3 L 2 0 L -2 3"
              transform={`translate(${preview.chevron.x}, ${preview.chevron.y}) rotate(${preview.chevron.deg})`}
            />
          )}
          {preview.ends.map((e, i) => (
            <circle
              key={`e${i}`}
              className={`part-preview-end is-${e.polarity}`}
              cx={e.x}
              cy={e.y}
              // 8A's 5px minimum: a 5px disc; a ring 5px across with a 3px clear centre.
              r={e.polarity === 'peg' ? 2.5 : 2}
            />
          ))}
        </>
      )}
    </svg>
  );
}
