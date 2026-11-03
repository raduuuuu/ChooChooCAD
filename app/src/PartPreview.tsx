/**
 * A part card's drawing (docs/plan/2026-10-30-part-previews.md). Decorative
 * (10A): `aria-hidden`, never focusable, and `pointer-events: none` in CSS, so
 * a click, double-click, drag or touch on it acts on the card. It draws in
 * `currentColor`, so it takes the card's text colour in every state (3A).
 */

import { useId } from 'react';
import { PREVIEW_H, PREVIEW_W, type Preview } from './previewGeometry.js';

export function PartPreview({ preview }: { readonly preview: Preview | null }) {
  const hatch = `hatch${useId().replace(/:/g, '')}`;
  const roofs = preview?.bodies.filter((b) => b.roof) ?? [];
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
          {roofs.length > 0 && (
            <defs>
              <pattern id={hatch} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line className="part-preview-hatch" x1={0} y1={0} x2={0} y2={3} />
              </pattern>
            </defs>
          )}
          {/* A footprint or a wall: a thin ink outline under the road (decision 2). */}
          {preview.bodies.filter((b) => !b.roof).map((b, i) => (
            <polygon key={`b${i}`} className="part-preview-body" points={b.points} />
          ))}
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
          {/* A roof: hatched over the road it covers, so the road still shows. */}
          {roofs.map((b, i) => (
            <polygon key={`r${i}`} className="part-preview-body" points={b.points} style={{ fill: `url(#${hatch})` }} />
          ))}
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

/**
 * THE MEASURED TICK (docs/plan/2026-11-03-verified-mark.md, 11A): drawn, not
 * typed, because the code's IBM Plex Mono has no U+2713 and a fallback font
 * would draw it differently on every system. In `currentColor`, so it follows
 * the card's text in every state (8A). Decorative: the card's accessible name
 * says "Measured." (6C).
 */
export function MeasuredTick() {
  return (
    <svg className="measured-tick" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M 1.5 5.5 L 4 8 L 8.5 2" />
    </svg>
  );
}

/**
 * THE PRINTABLE-MODEL GLYPH (docs/plan/2026-11-03-printable-mark.md, 11A): a
 * print nozzle over one layer line, drawn like the measured tick, in
 * `currentColor`. Decorative: its link's accessible name says who made the
 * model and where (6A).
 */
export function OriginGlyph() {
  return (
    <svg className="origin-glyph" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M 3.5 1.5 H 10.5 V 5 L 8 8.5 H 6 L 3.5 5 Z" />
      <path d="M 1 12.5 H 13" />
    </svg>
  );
}
