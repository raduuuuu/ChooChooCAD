/**
 * WHAT THE VERDICT SAYS ABOUT BEND, BUILT ONCE (eng review D7).
 *
 * The verdict line (app/src/VerdictLine.tsx) and the engine's own text
 * (`evaluate.ts`, used by the repro and the calibration tool) both render
 * these parts, so they cannot disagree about which tier a layout is in, which
 * figure it shows, or which parts are listed. Only the styling differs.
 *
 * The wording is the design review's (docs/designs/joint-bend.md, "Verdict
 * copy, decided"): 1A tiers and lead words, 4A stretch-only, 5A provenance,
 * 6A percent for mixed brands, 9A the turned clause, 11A the overlap note.
 * DESIGN.md rule 4 (as amended, 7A): degrees to 0.1, percent whole, and a
 * figure is rounded UP where rounding down would understate it.
 */

import type { RunBend } from '../graph/bendRun.js';
import type { BendLimit } from '../../data/bendLimit.js';

export type BendTier = 'exact' | 'closes' | 'beyond';

export type BendFigure =
  /** All-BRIO run: the worst joint's bend, degrees. */
  | { readonly unit: 'deg'; readonly value: number }
  /** Mixed brands: the worst joint's bend as a share of its own limit, percent. */
  | { readonly unit: 'pct'; readonly value: number }
  /** No bend to speak of: the most any joint pulls apart, mm (design 4A). */
  | { readonly unit: 'stretch'; readonly value: number };

/** A run of text, or a number with its unit, set in the number face. */
export type LineSegment = string | { readonly num: string };

export interface LimitNote {
  /** 'BRIO' or a part id. */
  readonly who: string;
  readonly text: string;
}

export interface BendWords {
  readonly tier: BendTier;
  /** Null when exact. */
  readonly figure: BendFigure | null;
  /** The headline, without the glyph: severity word, figure, hedge. */
  readonly line: string;
  /**
   * The same headline in parts, so the app can set each number in the number
   * face (DESIGN.md rule 4) without writing the sentence a second time:
   * joined, the parts are exactly `line`.
   */
  readonly segments: readonly LineSegment[];
  /** "It comes back turned 45°." or null (design 9A). */
  readonly turned: string | null;
  /** "In 1 of 3 track runs." or null (design 3A). */
  readonly runs: string | null;
  /** Where the limits come from, BRIO first then other brands by part id (design 5A). */
  readonly limits: readonly LimitNote[];
  /** For a run that needs bend: overlaps were checked on the catalogue shape, not the bent one the canvas draws (design 11A). */
  readonly overlapNote: string | null;
}

/** One decimal, rounded up: a figure on this line is never shown smaller than it is. */
export function upTo1(x: number): number {
  return Math.ceil(x * 10 - 1e-9) / 10;
}

function degText(d: number): string {
  return `${upTo1(d).toFixed(1)}°`;
}

const HEDGE = 'It may still go together; only building it will tell.';

function brioNote(limit: BendLimit): string {
  const d = `${(Math.round(limit.deg * 10) / 10).toFixed(1)}°`;
  switch (limit.status) {
    case 'measured':
      return `BRIO joints were measured to bend ${d}.`;
    case 'inferred':
      return `A built loop needed BRIO joints to bend ${d}.`;
    case 'estimated':
      return `BRIO joint bend is estimated at ${d}; nobody has measured it.`;
  }
}

/**
 * The words for the run that leads the verdict.
 *
 * `runsBeyond` and `loopRuns` count the layout's looped runs, for "in N of M
 * track runs" when there is more than one (design 3A).
 */
export function bendWords(lead: RunBend, limit: BendLimit, runsBeyond: number, loopRuns: number): BendWords {
  const tier: BendTier = lead.status === 'beyond' ? 'beyond' : lead.status === 'closes' ? 'closes' : 'exact';
  const mixed = lead.others.length > 0;
  const lambda = lead.lambda ?? 0;
  let figure: BendFigure | null = null;
  if (tier !== 'exact') {
    if (mixed) {
      figure = { unit: 'pct', value: Math.ceil(lambda * 100 - 1e-9) };
    } else {
      const deg = lambda * limit.deg;
      figure = upTo1(deg) === 0 && tier === 'closes' ? { unit: 'stretch', value: upTo1(lead.stretchMm) } : { unit: 'deg', value: upTo1(deg) };
    }
  }
  const tested = limit.status === 'estimated' && !mixed ? 'estimated' : 'tested';
  let segments: LineSegment[];
  if (tier === 'exact') {
    segments = ['This works. Closes exactly, no give needed at any joint.'];
  } else if (figure!.unit === 'stretch') {
    segments = ['Tight. Closes by stretch: the joints pull apart up to ', { num: `${figure!.value.toFixed(1)}mm` }, '.'];
  } else if (tier === 'closes') {
    segments =
      figure!.unit === 'deg'
        ? ['Tight. Closes with bend: needs up to ', { num: degText(figure!.value) }, ' at a joint.']
        : ['Tight. Closes with bend: no joint past ', { num: `${figure!.value}%` }, ' of its limit.'];
  } else {
    segments =
      figure!.unit === 'deg'
        ? [`Beyond the ${tested} bend: needs ${lead.atLeast ? 'more than' : 'up to'} `, { num: degText(figure!.value) }, ` at a joint. ${HEDGE}`]
        : [`Beyond the ${tested} bend: some joint needs ${lead.atLeast ? 'more than' : ''}`.trimEnd() + ' ', { num: `${figure!.value}%` }, ` of its limit. ${HEDGE}`];
  }
  const line = segments.map((x) => (typeof x === 'string' ? x : x.num)).join('');
  const turned = tier !== 'exact' && lead.turnedSteps > 0 ? `It comes back turned ${lead.turnedSteps * 22.5}°.` : null;
  const runs = loopRuns > 1 && tier === 'beyond' ? `In ${runsBeyond} of ${loopRuns} track runs.` : null;
  const limits: LimitNote[] = [];
  if (tier !== 'exact') {
    if (lead.pieces.length > 0 && lead.brio) limits.push({ who: 'BRIO', text: brioNote(limit) });
    for (const o of lead.others) {
      limits.push({
        who: o.partId,
        text: Number.isFinite(o.limitDeg)
          ? `${o.name} joints are estimated to bend ${(Math.round(o.limitDeg * 10) / 10).toFixed(1)}°; nobody has measured them.`
          : `${o.name} has no bend figure.`,
      });
    }
  }
  const overlapNote =
    tier !== 'exact'
      ? `Overlaps were checked on the catalogue shape, before bending; bending moves pieces up to ${Math.max(1, Math.ceil(lead.movesMm - 1e-9))}mm.`
      : null;
  return { tier, figure, line, segments, turned, runs, limits, overlapNote };
}
