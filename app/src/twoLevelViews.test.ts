/**
 * TWO LEVELS IN WORDS (two-layer plan: L3, design 3A, 4A, 8A, 11A, eng
 * re-run D4, R2).
 *
 * Value: protects=the level-fault sentences and actions, the count of level
 * faults a clash hides, the raised note surviving a long notes list, the
 * raised action replacing "Build it", a joint across levels naming both, and
 * a placement announcing that it raised its run
 * Value: fails_when=a string or its branch is lost, the note is folded into
 * the truncated list, or the announcement stays silent about a re-level
 * Value: why_new=all new with levels
 * Value: seam=renderToStaticMarkup for the verdict and the list (no DOM),
 * the reducer for the announcement
 * Value: no_claim=how any of it looks
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import type { TrustIssue } from '../../engine/src/joints/trust.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { describeAction } from './announce.js';
import { reduce, type EditorState } from './editorReducer.js';
import { GraphListing } from './GraphListing.js';
import { VerdictLine } from './VerdictLine.js';
import type { VerdictView } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ');

const view = (over: Partial<VerdictView>): VerdictView => ({
  kind: 'IMPOSSIBLE',
  detail: '',
  gapMm: 0,
  gapKnown: false,
  bend: null,
  rank: 1,
  failingLoops: 0,
  clashCount: 0,
  overlapCount: 0,
  polarityCount: 0,
  levelMismatchCount: 0,
  thirdLevelCount: 0,
  bridgeCount: 0,
  raised: false,
  adapterCount: 0,
  jointCount: 8,
  openRuns: 0,
  loopRuns: 1,
  loopAt: null,
  pieces: null,
  ...over,
});
const verdict = (v: VerdictView, props: { trust?: readonly TrustIssue[]; levelUnmarked?: number } = {}) =>
  text(renderToStaticMarkup(createElement(VerdictLine, { view: v, ...props })));

describe('the level faults in the verdict (8A, D4)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the mismatch branch removed: `expected 'XCan’t be built. 0 spots have
   *   two or …' to contain 'Can’t be built. 1 joint joins track a…'`.
   * - `impossibleAction` without the mismatch line: `expected 'XCan’t be
   *   built. 1 joint joins track …' to contain 'Add a ramp so the loop comes
   *   back dow…'`.
   * - `Unmarked` rendering nothing: the same, to contain `'1 is not marked,
   *   because a clash is d…'`.
   */
  it('a loop that never comes back down: sentence, action, and what a clash hides', () => {
    const out = verdict(view({ levelMismatchCount: 1, raised: true }), { levelUnmarked: 1 });
    expect(out).toContain('Can’t be built. 1 joint joins track at two different levels: the loop climbs and never comes back down.');
    expect(out).toContain('Add a ramp so the loop comes back down to the level it left, or turn one ramp round.');
    expect(out).toContain('1 is not marked, because a clash is drawn there.');
  });
});

describe('raised track on a verdict that works (3A, 4A)', () => {
  // Every trust kind there is (four since the give notes retired, design 8A).
  const FIVE: readonly TrustIssue[] = [
    { kind: 'single-source', detail: 'one person measured this' },
    { kind: 'unverified-size', detail: 'nobody measured this' },
    { kind: 'modelled-switch', detail: 'this switch is modelled' },
    { kind: 'brands-do-not-join', detail: 'these brands do not join' },
  ];

  /*
   * MUTATION PROOFS, run:
   * - EXACT always taking `ACTION_FOR_VERDICT.EXACT`: `expected 'OThis
   *   works. Closes exactly, no give …' to contain 'The track fits. Check the
   *   supports an…'`.
   * - `raisedOf` returning null: the same, to contain `'Raised track:
   *   supports are not checke…'`.
   * - the train back to unmeasured (`vehicleHeightMm: null` in
   *   measurements.ts): `expected 'OThis works. Closes exactly,
   *   no give …' to contain 'X Your 55mm train may not pass under …'` (44mm
   *   leaves 5mm to spare).
   *
   * THE TRAIN MAY NOT PASS (app-focus review 2026-11-04, CEO D2, eng D1):
   * 61mm rise (the owner's 73mm ramp top, 2026-11-03) - 12 plank - 55 train
   * (2026-10-30) is -6mm, said in the bridges' fail sentence, with the
   * verdict unchanged (DD5).
   * - `RaisedNote` without the crossing sentence: `expected 'OThis works.
   *   Closes exactly, no give …' to contain 'X Your 55mm train may not pass
   *   under …'`.
   */
  it('says what was not checked, past a long notes list, and never "Build it"', () => {
    const out = verdict(view({ kind: 'EXACT', gapKnown: true, raised: true, bridgeCount: 2 }), { trust: FIVE });
    expect(out).toMatch(/^OThis works\./);
    expect(out).toContain('Raised track: supports are not checked.');
    expect(out).toContain('X Your 55mm train may not pass under raised track (2 places): 61mm opening.');
    // The train is measured now (Q5), so nothing in the figure is called a guess.
    expect(out).not.toContain('height is an estimate');
    expect(out).toContain('The track fits. Check the supports and the clearance under each bridge before you build.');
    expect(out).not.toContain('Build it.');
  });

  it('with no crossing, raised track says only that supports are not checked', () => {
    const out = verdict(view({ kind: 'EXACT', gapKnown: true, raised: true, bridgeCount: 0 }));
    expect(out).toContain('Raised track: supports are not checked.');
    expect(out).not.toMatch(/may not pass|to spare/);
  });

  /*
   * MUTATION PROOFS, run:
   * - the X no longer aria-hidden: `expected '<div class="verdict verdict-pass"
   *   rol…' to match /<span aria-hidden="true">X <…/span>Your`.
   * - a bridge piece also counted as a plain crossing is the engine's job
   *   (structures are left out of `bridges`, solve.ts); here, each sentence
   *   is said once: the bridges listed twice in `notesFor`
   *   fails with `expected [ …(2) ] to have a length of 1 but got 2`.
   */
  it('a bridge piece and a plain crossing each keep their own sentence, the X silent', () => {
    const html = renderToStaticMarkup(createElement(VerdictLine, {
      view: view({ kind: 'EXACT', gapKnown: true, raised: true, bridgeCount: 1 }),
      bridgeNotes: [{ name: 'stone arch bridge', piece: 3, clearanceMm: 69.2 }],
    }));
    const out = text(html);
    expect(out.match(/may not pass under raised track \(1 place\): 61mm opening\./g)).toHaveLength(1);
    expect(out.match(/Under the stone arch bridge \(piece 3\): about 2mm to spare/g)).toHaveLength(1);
    expect(html).toMatch(/<span aria-hidden="true">X <\/span>Your/);
  });

  it('a flat layout keeps its action and gets no note', () => {
    const out = verdict(view({ kind: 'EXACT', gapKnown: true }));
    expect(out).toContain('Nothing to fix. Build it.');
    expect(out).not.toContain('Raised track');
  });
});

describe('a joint across levels names both in the list (11A, D3)', () => {
  /*
   * A loop up one ramp and never down, so its closing joint joins the raised
   * level to the floor.
   *
   * MUTATION PROOF, run: `across` always empty: `expected 'This layout, as a
   * list: 10 pieces, 10…' to contain 'joins the raised level to the floor'`.
   */
  it('the closing joint says which levels it joins', () => {
    const parts = ['E', 'E', 'E', 'E', 'N', 'E', 'E', 'E', 'E', 'D'];
    const g: Graph = {
      pieces: parts.map((partId, i) => ({ pieceId: `p${i}`, partId, turn: 'left' })),
      welds: parts.map((_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${(i + 1) % parts.length}`, port: 0 } })),
    };
    const out = text(renderToStaticMarkup(createElement(GraphListing, { graph: g, resolve, ports })));
    expect(out).toContain('joins the raised level to the floor');
  });
});

describe('a placement that raises its run says so (R2)', () => {
  /*
   * MUTATION PROOF, run: the re-level clause dropped: `expected 'Added piece
   * 2, Ramp (N), joined to th…' to contain 'The run it joined is now
   * raised.'`.
   */
  it('a ramp laid descending from a floor end', () => {
    const start: EditorState = {
      graph: { pieces: [{ pieceId: 's', partId: 'C', turn: 'left' }], welds: [] },
      cursor: { pieceId: 's', port: 1 },
      armed: null,
    };
    // At C's socket end the ramp goes on by its peg. Picked, it climbs
    // (flipped over, so that peg end is low); F turns it over to come down.
    const picked = reduce(start, { kind: 'pick', partId: 'N' }, ports, { resolve });
    expect(picked.ghost!.port).toBe(1);
    const climbs = describeAction(picked, { kind: 'placeGhost' }, reduce(picked, { kind: 'placeGhost' }, ports, { resolve }), resolve)!;
    expect(climbs).toContain('It climbs to the raised level.');
    const flipped = reduce(picked, { kind: 'flipGhost' }, ports, { resolve });
    const placed = reduce(flipped, { kind: 'placeGhost' }, ports, { resolve });
    const said = describeAction(flipped, { kind: 'placeGhost' }, placed, resolve)!;
    expect(said).toContain('It comes down to the floor.');
    expect(said).toContain('The run it joined is now raised.');
  });
});
