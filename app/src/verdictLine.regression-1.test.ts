/**
 * AN UNFINISHED LAYOUT STILL SAYS WHAT ITS PARTS ARE (QA 2026-11-01, owner's
 * answer "A) Show part notes while open").
 *
 * Value: protects=a layout that is not a loop yet shows the part notes a
 * closed one would: brands that do not join BRIO, sizes nobody measured
 * Value: fails_when=the failure branch passes an empty register again, as it
 * did since X2a, so the IKEA shelf's "the verdict says what that means" was
 * false until the loop closed
 * Value: why_new=verdictLine.test.ts renders the register only on reached
 * verdicts (EXACT, EXCEEDS, IMPOSSIBLE), never on a failure
 * Value: seam=`renderToStaticMarkup`, as verdictLine.test.ts; the result is
 * the engine's own `solveGraph` output for the QA layout, not a hand-made one
 * Value: no_claim=the canvas ghost's "Fits here" for a cross-brand end, which
 * is the joint's geometry and stays as it is
 */

// Regression: ISSUE-002 — a Lillabo piece on a BRIO switch got no note while the layout was open
// Found by /qa on 2026-11-01
// Report: .gstack/qa-reports/run-20261101T084601Z/qa-report-woodentrain.world-2026-11-01.md

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { layoutTrust } from '../../engine/src/joints/trust.js';
import { viewOf } from './verdictView.js';
import { VerdictLine } from './VerdictLine.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

/** Two pieces, one joint, not a loop: `first` with `second` on its end (port 1 to port 0). */
const pair = (first: string, second: string): Graph => ({
  pieces: [
    { pieceId: 'p1', partId: first, turn: 'left' },
    { pieceId: 'p2', partId: second, turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'p1', port: 1 }, b: { pieceId: 'p2', port: 0 } }],
});

function verdictHtml(graph: Graph): string {
  const placement = placeAll(graph, ports);
  const segments = renderGraph(graph, ports, resolve, placement).segments;
  const result = solveGraph(graph, ports, resolve, () => 0, placement, undefined, segments);
  const trust = layoutTrust(
    { placements: graph.pieces.map((p) => ({ partId: p.partId, turn: p.turn })), closed: false },
    resolve,
    brandFit,
  );
  return renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(result), trust } as never));
}

describe('a layout that is not a loop yet', () => {
  /*
   * MUTATION PROOF, run (the pre-fix failure branch, `notesFor([], ...)`):
   * `expected '<div class="verdict verdict-unknown" …' to match /do not
   * physically join/`.
   */
  it('a BRIO straight with a Lillabo straight: says they do not join, and the size is unmeasured', () => {
    const html = verdictHtml(pair('A', 'IKEA-150'));
    expect(html).toMatch(/Not a loop yet/);
    expect(html).toMatch(/do not physically join/);
    expect(html).toMatch(/nobody has measured/);
  });

  /*
   * The QA layout itself: a seed switch and a Lillabo straight. The brand
   * note and the unmeasured count stay in view; which parts and why fold
   * behind "N notes" (share plan, design 4A, eng D69).
   * MUTATION PROOF, run (the pre-fix branch): `expected '<div class="verdict
   * verdict-unknown" …' to match /nobody has measured/`.
   */
  it('the QA layout (curved switch L + Lillabo straight) shows its part notes', () => {
    const html = verdictHtml(pair('L', 'IKEA-150'));
    const [before] = html.split('<div id="verdict-folded"');
    expect(before).toMatch(/do not physically join/);
    expect(before).toMatch(/<span class="num">2<\/span> pieces have sizes nobody has measured\./);
    expect(html).toMatch(/nobody has measured, so this answer is exact about an estimate/);
  });
});
