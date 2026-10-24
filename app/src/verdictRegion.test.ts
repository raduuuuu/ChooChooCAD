/**
 * THE VERDICT REGION, RENDERED FOR EVERY KIND (task X2b).
 *
 * Value: protects=every verdict kind renders its own tone, announces through
 * one polite atomic live region that holds the sentence and nothing else,
 * states its severity in words, and never renders green unless it is EXACT;
 * and the gap the canvas annotates is the gap the solver measured
 * Value: fails_when=a kind changes tone, the region loses an ARIA attribute,
 * trust or action notes move back inside the atomic region, a headline loses
 * the words that carry its severity, or the gap filter stops skipping closed
 * or rotated welds
 * Value: why_new=W1 checked the render once by hand through
 * `renderToStaticMarkup` and discarded the check. `verdictLine.test.ts` pins
 * the EXCEEDS wording only; nothing asserted the region's structure, the
 * tone of each kind, or the wiring from a real `WeldResidual` to a drawn gap
 * (finding E10)
 * Value: seam=`renderToStaticMarkup` needs no DOM, so this reads markup. The
 * gap filter was lifted out of an `App.tsx` memo into `gapMarks` in
 * `trackPath.ts` so a real solve can reach it
 * Value: no_claim=nothing about colour, which `app.css` owns; nothing about
 * what a screen reader actually speaks, which needs a real browser
 *
 * THE FILE NAME DEPARTS FROM THE PLAN. X2b specifies `VerdictLine.test.ts`,
 * and `verdictLine.test.ts` already exists. macOS's default filesystem is
 * case-insensitive, so the two names are one file there.
 *
 * TEN KINDS, NOT NINE. The plan's verify list predates `TOO_BIG_TO_CHECK`.
 * The record below is keyed on the union, so the count is the compiler's,
 * not this comment's.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { graphFromChain } from '../../engine/src/graph/fromChain.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { layoutTrust, type TrustIssue } from '../../engine/src/joints/trust.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import type { Part } from '../../engine/src/parts/schema.js';
import { gapMarks } from './trackPath.js';
import type { VerdictKind, VerdictView } from './verdictView.js';
import { VerdictLine } from './VerdictLine.js';

type Tone = 'empty' | 'unknown' | 'fail' | 'tight' | 'pass';

/*
 * One row per kind. A `Record` over the union, so an eleventh kind is a
 * compile error here until someone decides its tone, mark and lead.
 * MUTATION PROOF, run: add `| 'ELEVENTH'` to `VerdictKind`. `tsc` fails here
 * with `Property 'ELEVENTH' is missing in type`.
 *
 * `lead` is the region's text with the aria-hidden mark removed and every
 * class ignored: the words a reader gets when colour and glyph are both gone
 * (WCAG 1.4.1, DESIGN.md rule 2). Each one says what kind of answer this is
 * before it says anything else.
 */
const EXPECTED: Record<VerdictKind, { tone: Tone; mark: string | null; lead: RegExp }> = {
  NOTHING: { tone: 'empty', mark: null, lead: /^Nothing to check yet\./ },
  NO_CYCLE: { tone: 'unknown', mark: '?', lead: /^Not a loop yet\./ },
  HEADING_MISMATCH: { tone: 'unknown', mark: '?', lead: /^The track does not come back/ },
  TOO_MANY_LOOPS: { tone: 'unknown', mark: '?', lead: /^Too many loops/ },
  TOO_BIG_TO_CHECK: { tone: 'unknown', mark: '?', lead: /^Too much track here to check/ },
  NUMERIC: { tone: 'unknown', mark: '?', lead: /^Could not check/ },
  IMPOSSIBLE: { tone: 'fail', mark: 'X', lead: /^Can’t be built\./ },
  EXACT: { tone: 'pass', mark: 'O', lead: /^This works\./ },
  NEEDS_GIVE: { tone: 'tight', mark: '/\\', lead: /^Tight\./ },
  EXCEEDS: { tone: 'fail', mark: 'X', lead: /^Exceeds the modelled give\./ },
};

const KINDS = Object.keys(EXPECTED) as VerdictKind[];

/** A view of `kind` with plausible figures, so every branch has something to print. */
const view = (kind: VerdictKind): VerdictView => ({
  kind,
  detail: kind === 'NOTHING' ? '' : 'detail text',
  gapMm: 12,
  gapKnown: kind === 'EXACT' || kind === 'NEEDS_GIVE' || kind === 'EXCEEDS',
  giveMm: 8,
  rank: 1,
  failingLoops: kind === 'EXCEEDS' ? 1 : 0,
  overlapCount: 0,
  adapterCount: 0,
  clashCount: kind === 'IMPOSSIBLE' ? 1 : 0,
  polarityCount: 0,
  levelMismatchCount: 0,
  thirdLevelCount: 0,
  bridgeCount: 0,
  raised: false,
  jointCount: 10,
  openRuns: 0,
  loopRuns: 1,
  loopAt: null,
  pieces: null,
});

/** All five trust kinds, two of them serious. */
const FIVE: readonly TrustIssue[] = [
  { kind: 'estimated-give', detail: 'give is estimated' },
  { kind: 'single-source', detail: 'one person measured this' },
  { kind: 'unverified-size', detail: 'nobody measured this' },
  { kind: 'axial-only-give', detail: 'pull-apart slack only' },
  { kind: 'brands-do-not-join', detail: 'these brands do not join' },
];

const render = (kind: VerdictKind, trust: readonly TrustIssue[] = []): string =>
  renderToStaticMarkup(createElement(VerdictLine, { view: view(kind), trust }));

/** The opening tag of the live region, and everything inside it. */
const region = (html: string) => {
  const m = html.match(/^<div ([^>]*role="status"[^>]*)>(.*?)<\/div>/);
  if (!m) throw new Error(`no live region in: ${html.slice(0, 120)}`);
  return { attrs: m[1]!, inner: m[2]! };
};

/** Text a reader gets with the aria-hidden mark removed and all markup gone. */
const words = (inner: string): string =>
  inner
    .replace(/<span[^>]*aria-hidden="true"[^>]*>.*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();

describe('every verdict kind', () => {
  /*
   * MUTATION PROOF, run: render NEEDS_GIVE with `tone="pass"` in
   * `VerdictLine.tsx`. Fails with `NEEDS_GIVE: expected 'verdict verdict-pass'
   * to be 'verdict verdict-tight'`.
   */
  it('renders its own tone, and only EXACT renders green', () => {
    for (const kind of KINDS) {
      const cls = region(render(kind)).attrs.match(/class="([^"]*)"/)![1];
      expect(cls, kind).toBe(`verdict verdict-${EXPECTED[kind].tone}`);
    }
    const green = KINDS.filter((k) => region(render(k)).attrs.includes('verdict-pass'));
    expect(green).toEqual(['EXACT']);
  });

  /*
   * MUTATION PROOF, run: delete `aria-atomic="true"` from `Verdict` in
   * `VerdictLine.tsx`. Fails with `NOTHING: expected 'class="verdict
   * verdict-empty" role="s…' to contain 'aria-atomic="true"'`. Deleting
   * `aria-hidden="true"` from `Mark` fails it with `NO_CYCLE mark: expected
   * ' ' to contain 'aria-hidden="true"'`, and fails the severity spec below
   * too, because the glyph then reads first.
   */
  it('announces through one polite atomic status region, with the mark hidden', () => {
    for (const kind of KINDS) {
      const html = render(kind);
      expect(html.match(/role="status"/g), kind).toHaveLength(1);
      const { attrs, inner } = region(html);
      expect(attrs, kind).toContain('aria-live="polite"');
      expect(attrs, kind).toContain('aria-atomic="true"');
      const mark = inner.match(/<span([^>]*)class="verdict-mark"([^>]*)>(.*?)<\/span>/);
      if (EXPECTED[kind].mark === null) {
        expect(mark, `${kind} mark`).toBeNull();
      } else {
        expect(mark, `${kind} mark`).not.toBeNull();
        expect(mark![1]! + mark![2]!, `${kind} mark`).toContain('aria-hidden="true"');
        expect(mark![3], `${kind} glyph`).toBe(EXPECTED[kind].mark);
      }
    }
  });

  /*
   * MUTATION PROOF, run: delete "Tight. " from the NEEDS_GIVE sentence.
   * Fails with `NEEDS_GIVE: expected 'Needs 12mm absorbed across 10 joints…'
   * to match /^Tight\./`.
   */
  it('states its severity in words first, with colour and glyph removed', () => {
    for (const kind of KINDS) {
      expect(words(region(render(kind, FIVE)).inner), kind).toMatch(EXPECTED[kind].lead);
    }
  });
});

describe('the live region holds the sentence and nothing else', () => {
  /*
   * MUTATION PROOF, run: in `Verdict`, render `{notes}` inside the status div
   * after `{children}`. Fails with `NO_CYCLE: expected '<span
   * class="verdict-mark" aria-hidde…' not to contain 'verdict-action'`; the
   * count spec below fails as well, because every note is then rendered
   * twice.
   */
  it('keeps trust and action outside, reachable by aria-describedby', () => {
    for (const kind of KINDS) {
      const html = render(kind, FIVE);
      const { attrs, inner } = region(html);
      for (const outside of ['verdict-trust', 'verdict-more', 'verdict-action', '<li', '<p']) {
        expect(inner, kind).not.toContain(outside);
      }
      if (kind === 'NOTHING') continue;
      expect(attrs, kind).toContain('aria-describedby="verdict-notes"');
      expect(html, kind).toContain('<div id="verdict-notes" class="verdict-notes">');
    }
  });

  /*
   * The empty state carries no mark, no instruction and no action (gate
   * d5 = b keeps D10: the canvas's preset invitation is the only one).
   *
   * MUTATION PROOF, run: give the NOTHING branch
   * `notes={notesFor([], 'Pick a preset to start.')}`. Fails with
   * `expected '<div class="verdict verdict-empty" r…' not to contain
   * 'verdict-notes'`.
   */
  it('NOTHING renders a statement of fact and no notes at all', () => {
    const html = render('NOTHING', FIVE);
    expect(html).not.toContain('verdict-notes');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('verdict-mark');
  });

  /*
   * Five trust issues, the most this register can hold. The two serious ones
   * are the two shown; the rest become a count.
   *
   * MUTATION PROOF, run: raise `TRUST_INLINE_LIMIT` to 3. Fails with
   * `expected [ [ …(3), index: 341, …(2) ], …(2) ] to have a length of 2 but
   * got 3`.
   */
  it('shows the two serious notes and counts the rest', () => {
    const html = render('EXACT', FIVE);
    const items = [...html.matchAll(/<li( class="is-serious")?>(.*?)<\/li>/g)];
    expect(items).toHaveLength(2);
    expect(items.every((m) => m[1] !== undefined)).toBe(true);
    expect(html).toMatch(/and <span class="num">3<\/span> more notes about this layout\./);
  });
});

/*
 * TASK T3b: THE SWITCH DISCLOSURE AND THE BASIS CLAUSE, RENDERED.
 *
 * The trust list here is the REAL register for a layout holding the seed
 * switch L, not a fixture: L is `unverified` and a switch, so it trips two
 * serious kinds at once, which is the case the inline limit of two meets
 * first.
 */
describe('a layout with a switch', () => {
  const trustL = layoutTrust(
    { placements: ['L', 'E', 'E'].map((partId) => ({ partId, turn: 'left' as const })), closed: false },
    makeResolver(BUILT_IN),
    brandFit,
  );
  const unescape = (html: string) => html.replace(/&#x27;/g, "'");

  /*
   * MUTATION PROOF, run: remove `modelled-switch` from `isSerious` in
   * `VerdictLine.tsx`. Fails with `expected '<div class="verdict
   * verdict-pass" rol…' to contain '<li class="is-serious">This switch\'s…'`.
   */
  it('shows the switch sentence as a serious note, outside the live region', () => {
    expect(trustL.map((t) => t.kind)).toContain('modelled-switch');
    const html = unescape(render('EXACT', trustL));
    expect(html).toContain(`<li class="is-serious">This switch's geometry is modelled, not measured.</li>`);
    expect(region(html).inner).not.toContain('modelled');
  });

  /*
   * MUTATION PROOF, run: pass `true` for `basis` on the IMPOSSIBLE branch's
   * `notesFor` call. Fails with `IMPOSSIBLE: expected '<div class="verdict
   * verdict-fail" rol…' not to contain 'verdict-basis'`.
   */
  it('states the basis on the three verdicts that compare a gap with give, and only those', () => {
    const withBasis: VerdictKind[] = ['EXACT', 'NEEDS_GIVE', 'EXCEEDS'];
    for (const kind of KINDS) {
      const html = render(kind, trustL);
      if (withBasis.includes(kind)) {
        expect(html, kind).toContain(
          '<p class="verdict-basis">Exact to the catalogue; joint give estimated.</p>',
        );
        expect(region(html).inner, kind).not.toContain('verdict-basis');
      } else {
        expect(html, kind).not.toContain('verdict-basis');
      }
    }
  });

  /*
   * MEASURED ONLY WHEN THE REGISTER SAYS SO. With no estimated-give note the
   * give was measured; with no register at all nothing was established, and
   * the clause is withheld rather than defaulting to "measured".
   *
   * MUTATION PROOF, run: delete the `trust.length === 0` guard in `Basis`.
   * Fails with `expected '<div class="verdict verdict-pass" rol…' not to
   * contain 'verdict-basis'`.
   */
  it('says measured only when the register ran and found no estimated give', () => {
    const axialOnly = trustL.filter((t) => t.kind === 'axial-only-give');
    expect(render('EXACT', axialOnly)).toContain('joint give measured.');
    expect(render('EXACT', [])).not.toContain('verdict-basis');
  });
});

/*
 * FINDING E10: A REAL RESIDUAL REACHES THE CANVAS, AND ONLY THE RIGHT ONES.
 *
 * `gapAnnotations` is tested on synthetic marks. The two decisions in front
 * of it -- skip a weld that closes, skip a weld that comes back rotated --
 * were tested by nothing, and `residuals` arriving on `solveGraph`'s result
 * was asserted nowhere.
 */
describe('the gap the canvas draws is the gap the solver measured', () => {
  const resolve = makeResolver(BUILT_IN);
  const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);
  const slop = (g: Graph) => (pieceId: string) =>
    resolve(g.pieces.find((p) => p.pieceId === pieceId)!.partId).slop.axialMm;
  const loop = (ids: string[]): Graph =>
    graphFromChain({ placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed: true });
  const marksOf = (g: Graph) => {
    const result = solveGraph(g, ports, (id: string): Part => resolve(id), slop(g), placeAll(g, ports));
    const drawn = renderGraph(g, ports, resolve, placeAll(g, ports));
    return { result, drawn, marks: gapMarks(result.residuals, g.welds, drawn.ports) };
  };

  /*
   * The Near-miss loop: four E, a D, four E, an A. 72mm short.
   *
   * MUTATION PROOF, run: in `gapMarks`, resolve end `a` from `w.b`. Fails
   * with `expected [ +0, +0 ] to deeply equal [ -72, +0 ]`.
   */
  it('a real residual becomes one mark, at the ends the canvas drew, with the engine figure', () => {
    const g = loop(['E', 'E', 'E', 'E', 'D', 'E', 'E', 'E', 'E', 'A']);
    const { result, drawn, marks } = marksOf(g);
    expect(result.residuals).toHaveLength(1);
    const r = result.residuals[0]!;
    expect(r.headingSteps).toBe(0);
    expect(r.gapMm).toBeCloseTo(72, 6);

    expect(marks).toHaveLength(1);
    expect(marks[0]!.gapMm).toBe(r.gapMm);
    const w = g.welds[r.weld]!;
    const at = (ref: { pieceId: string; port: number }) =>
      drawn.ports.find((p) => p.pieceId === ref.pieceId && p.port === ref.port)!;
    expect(marks[0]!.a).toEqual([at(w.a).x, at(w.a).y]);
    expect(marks[0]!.b).toEqual([at(w.b).x, at(w.b).y]);
  });

  /*
   * MUTATION PROOF, run: delete `!(r.gapMm > 0) ||` from `gapMarks`. Fails
   * with `expected [ { a: [ +0, +0 ], …(2) } ] to deeply equal []`.
   */
  it('a weld that closes is not annotated', () => {
    const { result, marks } = marksOf(loop(Array(8).fill('E')));
    expect(result.residuals).toHaveLength(1);
    expect(result.residuals[0]!.gapMm).toBe(0);
    expect(marks).toEqual([]);
  });

  /*
   * Seven curves come back 45 degrees short AND some distance away. The
   * precondition asserts both, so the skip is the rotation rule's doing and
   * not the zero-gap rule's.
   *
   * MUTATION PROOF, run: delete `|| r.headingSteps !== 0` from `gapMarks`.
   * Fails with `expected [ Array(1) ] to deeply equal []`.
   */
  it('a weld that comes back rotated is not annotated, even with a gap', () => {
    const { result, marks } = marksOf(loop(Array(7).fill('E')));
    expect(result.residuals).toHaveLength(1);
    expect(result.residuals[0]!.headingSteps).not.toBe(0);
    expect(result.residuals[0]!.gapMm).toBeGreaterThan(0);
    expect(marks).toEqual([]);
  });
});
