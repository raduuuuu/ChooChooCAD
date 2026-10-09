/**
 * The SVG path a track segment renders as.
 *
 * Extracted from TrackCanvas so it has exactly ONE owner and can be tested
 * against what it actually emits.
 *
 * WHY THIS FILE EXISTS (task T1)
 *
 * The sweep flag used to live as a literal inside TrackCanvas and AGAIN as a
 * hand-copied constant in engine/test/render.test.ts, with each file's comment
 * claiming the other enforced it: the test said "Must match
 * TrackCanvas.segmentPath", the renderer said "Pinned by
 * engine/test/render.test.ts". Neither was true. The test computed the SVG
 * spec's centre from its OWN copy of the flag, so it was a circular pin:
 * inverting the renderer's literal left all 50 tests green, which was proven by
 * mutation during the fourth eng review. The one test touching the renderer
 * could not detect a renderer regression, and getting this flag wrong renders
 * the eight-curve circle as a flower while every endpoint, and therefore every
 * other test, stays perfectly correct.
 *
 * Deliberately free of React and of any DOM reference, so the test that pins it
 * runs in the plain node environment and asserts the real emitted string.
 */

import type { Segment } from '../../engine/src/geom/fk.js';

/**
 * SVG sweep flag for a left turn.
 *
 * Our y axis points down in screen space after the flip in the viewBox
 * transform, so a left turn draws as sweep 1. This is the single owner of that
 * fact; nothing else may restate it.
 */
export const SVG_SWEEP_FOR_LEFT = 1 as const;

/** The flag for either turn direction, derived from the one above. */
export function svgSweepFlag(sweep: Segment['sweep']): 0 | 1 {
  return (sweep === 'left' ? SVG_SWEEP_FOR_LEFT : 1 - SVG_SWEEP_FOR_LEFT) as 0 | 1;
}

/** The SVG `d` attribute for one placed piece. */
export function segmentPath(s: Segment): string {
  const { from, to } = s;
  if (s.kind === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const r = s.radiusMm ?? 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${svgSweepFlag(s.sweep)} ${to.x} ${to.y}`;
}
