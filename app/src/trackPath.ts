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
import type { WeldResidual } from '../../engine/src/graph/frames.js';
import type { PortRef, Weld } from '../../engine/src/graph/model.js';
import type { RenderedPort } from '../../engine/src/graph/render.js';

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
  const r = s.centrelineRadiusMm ?? 0;
  return `M ${from.x} ${from.y} A ${r} ${r} 0 0 ${svgSweepFlag(s.sweep)} ${to.x} ${to.y}`;
}

/**
 * Where to draw clash markers (task T12).
 *
 * Decision A4 approved REPORTING coincident ends and owed a drawing half
 * that was never written, so for three reviews the verdict said "8 pairs of
 * track ends land in exactly the same spot" and the canvas gave no clue
 * which. A count you cannot locate is not actionable.
 *
 * One marker per PLACE, not per pair. A spot where four separate joins
 * coincide is six reported pairs and one problem; drawing it six times over
 * would stack six rings at full opacity and read as something worse than it
 * is. The invariant that matters, and the one `trackPath.test.ts` pins, is
 * that every reported clash's position appears exactly once.
 *
 * Keyed on the exact millimetres the engine reported. Nothing is rounded
 * into or out of a match here; the engine already decided what coincides,
 * exactly, in Z[zeta16].
 */
export function clashMarkers(
  clashes: readonly { readonly at: readonly [number, number] }[],
): ReadonlyArray<readonly [number, number]> {
  const seen = new Map<string, readonly [number, number]>();
  for (const c of clashes) seen.set(`${c.at[0]},${c.at[1]}`, c.at);
  return [...seen.values()];
}

/**
 * THE GAP ANNOTATION (task W2, decision D4).
 *
 * A layout that fails on a gap used to draw identically to one that closes:
 * six references to clash markers in the canvas and zero to gaps. The only
 * difference a user saw was a sentence underneath, so the one failure they can
 * fix by swapping a piece was also the one the drawing said nothing about.
 *
 * Geometry only, and pure, so the suite can check it with no DOM. The shape is
 * a drafting leader: a line out from the spot where two ends fail to meet, and
 * the figure at the far end of it, clear of the track.
 *
 * `gapMm` is CARRIED, never derived from `a` and `b`. The engine measures the
 * mismatch exactly in Z[zeta16] and converts once (`WeldResidual.gapMm`);
 * re-deriving it here from two rounded screen positions is how a drawing ends
 * up labelled with a different number than the sentence under it.
 */
export interface GapMark {
  /** The two ends that should have met, in millimetres. */
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  /** The engine's figure for this weld. Not recomputed from a and b. */
  readonly gapMm: number;
}

export interface GapAnnotation {
  /** The spot being annotated: midway between the two ends. */
  readonly at: readonly [number, number];
  /** Where the leader line stops. */
  readonly leaderEnd: readonly [number, number];
  /** Where the figure sits, past the leader so it never lies on it. */
  readonly label: readonly [number, number];
  readonly gapMm: number;
}

/**
 * WHICH WELDS THE CANVAS ANNOTATES (task W2, decision D4).
 *
 * One per closing weld whose two ends are apart, resolved to the positions
 * the canvas already drew them at. The engine's `gapMm` is passed through
 * untouched: the drawing must not be able to disagree with the sentence
 * under it.
 *
 * A rotated weld is SKIPPED. `headingSteps !== 0` means the loop comes back
 * pointing the wrong way, and a distance there would promise a fix that does
 * not exist: closing those millimetres still leaves the track turned. The
 * verdict says that in words and the canvas stays quiet rather than
 * contradicting it with a number.
 *
 * Lifted out of an `App.tsx` memo (task X2b, finding E10) so the two
 * decisions in the filter can be tested against a real solve.
 */
export function gapMarks(
  residuals: readonly WeldResidual[],
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
): readonly GapMark[] {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  return residuals.flatMap((r) => {
    if (!(r.gapMm > 0) || r.headingSteps !== 0) return [];
    const w = welds[r.weld];
    if (!w) return [];
    const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
    const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b) return [];
    return [{ a: [a.x, a.y] as const, b: [b.x, b.y] as const, gapMm: r.gapMm }];
  });
}

/** One breakable joint on the canvas (task U5). */
export interface WeldTarget {
  /** The two ends the weld joins, which is what a break action carries (E4). */
  readonly a: PortRef;
  readonly b: PortRef;
  /** Where the hit circle and the hover brackets sit, in millimetres. */
  readonly at: readonly [number, number];
  /** Track direction through the joint, radians, so the brackets open along it. */
  readonly h: number;
}

/**
 * Every weld, resolved to the place the canvas draws it.
 *
 * At the MIDPOINT of the two ends. For an ordinary joint they coincide, so it
 * is the joint itself; for a closing weld with a gap it is the middle of the
 * gap, which is where the gap annotation already points. Welds whose ends are
 * not on the canvas are skipped rather than drawn at a guess.
 */
export function weldTargets(
  welds: readonly Weld[],
  ports: readonly RenderedPort[],
): readonly WeldTarget[] {
  const byPort = new Map(ports.map((p) => [`${p.pieceId}#${p.port}`, p]));
  return welds.flatMap((w) => {
    const a = byPort.get(`${w.a.pieceId}#${w.a.port}`);
    const b = byPort.get(`${w.b.pieceId}#${w.b.port}`);
    if (!a || !b) return [];
    return [{ a: w.a, b: w.b, at: [(a.x + b.x) / 2, (a.y + b.y) / 2] as const, h: a.h }];
  });
}

/**
 * Leader direction is PERPENDICULAR to the gap, which is the drafting
 * convention and also the practical one: a label along the gap would sit on
 * the two track ends it is measuring. A degenerate gap cannot reach here
 * because the caller filters on `gapMm > 0`, but a near-degenerate one still
 * yields a usable direction, and an exactly-zero vector falls back to up.
 */
export function gapAnnotations(
  marks: readonly GapMark[],
  leaderMm: number,
  labelGapMm: number,
): readonly GapAnnotation[] {
  return marks.map((m) => {
    const mx = (m.a[0] + m.b[0]) / 2;
    const my = (m.a[1] + m.b[1]) / 2;
    const dx = m.b[0] - m.a[0];
    const dy = m.b[1] - m.a[1];
    const len = Math.hypot(dx, dy);
    const [px, py] = len === 0 ? [0, 1] : [-dy / len, dx / len];
    return {
      at: [mx, my] as const,
      leaderEnd: [mx + px * leaderMm, my + py * leaderMm] as const,
      label: [
        mx + px * (leaderMm + labelGapMm),
        my + py * (leaderMm + labelGapMm),
      ] as const,
      gapMm: m.gapMm,
    };
  });
}
