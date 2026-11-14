/**
 * WHAT MUST BE READ IS NEVER BEHIND "N NOTES" (plan 2026-11-14, design DD3;
 * eng ED5; DESIGN.md rule 3).
 *
 * Value: protects=the next step and every statement of what the track needs
 * or what was not checked (adapters, raised track's supports, a train that
 * may not fit, unmeasured sizes, systems that do not join) render outside the
 * fold, in the roomy verdict and in the compact one a phone will use; in the
 * compact one a train fit that passes moves into the fold and is counted
 * Value: fails_when=a must-read line is folded to save room, the compact
 * verdict folds a train that may NOT fit, or a passing fit is dropped rather
 * than folded
 * Value: why_new=the phone's verdict shows the sentence, the next step and
 * "N notes"; without the two sets named in one place that would have hidden
 * exactly what DD3 says must stay
 * Value: seam=`renderToStaticMarkup` in node; the fold stays in the markup
 * with `hidden`, so the split is read from where each sentence sits
 * Value: no_claim=where the phone puts the fold or how it opens (the shell,
 * a later step); that any screen sets `VerdictCompact` today (none does)
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLEARANCE } from '../../engine/data/rampSeeds.js';
import type { TrustIssue } from '../../engine/src/joints/trust.js';
import type { GraphResult } from '../../engine/src/graph/solve.js';
import { ACTION_FOR_FAILURE } from './verdictAction.js';
import { VerdictCompact, VerdictLine, type BridgeNote } from './VerdictLine.js';
import { viewOf, type VerdictView } from './verdictView.js';

const NOT_A_LOOP: GraphResult = {
  ok: false,
  reason: 'NO_CYCLE',
  detail: '2 pieces, open at both ends',
  rank: 0,
  clashes: [],
  overlaps: [],
  polarityViolations: [],
  adapterJoints: [],
  levelMismatches: [],
  thirdLevels: [],
  bridges: [],
  underBridges: [],
  raised: false,
  supports: null,
  runs: { count: 1, open: 1, loops: [] },
} as unknown as GraphResult;

/** A layout with every must-read fact at once: an adapter joint, raised track over floor track. */
const VIEW: VerdictView = { ...viewOf(NOT_A_LOOP), adapterCount: 1, raised: true, bridgeCount: 2 };

const TRUST: readonly TrustIssue[] = [
  { kind: 'brands-do-not-join', detail: 'Small-peg track does not join Generic track without an adapter piece.' },
  { kind: 'unverified-size', detail: 'Sizes nobody has measured: X1.', pieces: 3 },
  { kind: 'single-source', detail: 'One size rests on a single reading.' },
];

/** One opening the measured train clears, one it does not. */
const CLEARS: BridgeNote = { name: 'stone arch bridge', piece: 4, clearanceMm: CLEARANCE.plankMm + CLEARANCE.trainMm + 12 };
const TOO_LOW: BridgeNote = { name: 'low tunnel', piece: 7, clearanceMm: CLEARANCE.plankMm + CLEARANCE.trainMm - 2, through: true };

/** `compact` null renders with no provider at all, as every screen does today. */
function parts(compact: boolean | null): { shown: string; folded: string; count: number } {
  const line = createElement(VerdictLine, { view: VIEW, trust: TRUST, bridgeNotes: [CLEARS, TOO_LOW] });
  const html = renderToStaticMarkup(compact === null ? line : createElement(VerdictCompact.Provider, { value: compact }, line));
  const [before = '', folded = ''] = html.split('<div id="verdict-folded"');
  const button = /<button[^>]*class="verdict-fold"[^>]*>(.*?)<\/button>/.exec(before);
  return {
    shown: button ? before.replace(button[0], '') : before,
    folded,
    count: Number(/>(\d+)</.exec(button?.[1] ?? '')?.[1] ?? 0),
  };
}

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

const MUST_READ: readonly [string, RegExp][] = [
  ['adapters needed', /Needs 1 male-male adapter: two sockets meet at 1 joint\./],
  ['raised track not checked', /Raised track: supports are not checked\./],
  ['a train that may not fit', /Your \d+mm train may not fit through the low tunnel \(piece 7\)/],
  // With today's figures the measured train does not clear plain raised track, so this one is a refusal too.
  ['a train that may not pass under raised track', /Your \d+mm train may not pass under raised track \(2 places\)/],
  ['sizes nobody measured', /3 pieces have sizes nobody has measured\./],
  ['systems that do not join', /Small-peg track does not join Generic track/],
  ['the next step', new RegExp(ACTION_FOR_FAILURE.NO_CYCLE.replace(/\./g, '\\.'))],
];

describe('the must-read statements', () => {
  /*
   * MUTATION PROOFS, run, one per line of the list:
   * - `<AdapterNote>` moved inside `<Fold>`: `compact=false adapters needed:
   *   expected '?Not a loop yet. …' to match /Needs 1 male-male adapter…/`.
   * - `<RaisedNote>` moved inside `<Fold>`: `… raised track not checked: …`.
   * - `foldFit` without `&& fits(openingMm)` (compact folds every train fit):
   *   `compact=true a train that may not fit: expected … to match /Your
   *   \d+mm train may not fit through the low tunnel…/`.
   * - `<Unmeasured>` moved inside `<Fold>`: `… sizes nobody measured: …`.
   * - `kept` returning false: `… systems that do not join: …`.
   * - `<Action>` moved inside `<Fold>`: `… the next step: …`.
   */
  it.each([false, true])('all show outside the fold (compact=%s)', (compact) => {
    const { shown, folded } = parts(compact);
    for (const [what, sentence] of MUST_READ) {
      expect(text(shown), `compact=${compact} ${what}`).toMatch(sentence);
      expect(text(folded), `compact=${compact} ${what}, folded`).not.toMatch(sentence);
    }
  });
});

describe('a train fit that passes', () => {
  const UNDER_BRIDGE = /Under the stone arch bridge \(piece 4\): about 12mm to spare/;

  /*
   * MUTATION PROOF, run: `VerdictCompact`'s default set to `true`: `expected
   * '?Not a loop yet. 2 pieces, open at bo…' to match /Under the stone arch
   * bridge \(piece 4…/`.
   */
  it('stays in view where there is room, as before', () => {
    const { shown, folded, count } = parts(null);
    expect(text(shown)).toMatch(UNDER_BRIDGE);
    expect(text(folded)).not.toMatch(/to spare/);
    // The fold holds the two explanations: which sizes are unmeasured, and the single reading.
    expect(count).toBe(2);
  });

  /*
   * MUTATION PROOFS, run:
   * - `foldFit` always false: `expected '…Under the stone arch bridge…' not
   *   to match /Under the stone arch bridge…/`.
   * - the folded fits left out of `<Fold>` (dropped, not folded): `expected
   *   '…' to match /Under the stone arch bridge…/`.
   * - `fitsFolded.length` left out of `foldCount`: `expected 2 to be 3`.
   * The raised-track fit has the same path; with today's figures it never
   * passes, so only its refusal is exercised (the list above).
   */
  it('goes behind "N notes" where room is short, and is counted', () => {
    const { shown, folded, count } = parts(true);
    expect(text(shown)).not.toMatch(UNDER_BRIDGE);
    expect(text(folded)).toMatch(UNDER_BRIDGE);
    expect(count).toBe(3);
  });
});
