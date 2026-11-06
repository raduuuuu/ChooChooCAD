/**
 * WHAT THE VERDICT SAYS ABOUT SUPPORTS (supports.ts; owner decisions
 * 2026-11-06: a warning naming the piece, dead ends not checked).
 *
 * Value: protects=the not-checked line while F4 is unmeasured, the sag
 * warning with its piece and figures (length rounded up, rule 4), the
 * all-held line, the dead-end line, piece numbering, and the verdict staying
 * a pass
 * Value: fails_when=a line is lost, says more than was checked, rounds a
 * stretch down, or turns the verdict red
 * Value: why_new=supports were never checked
 * Value: seam=renderToStaticMarkup for the verdict (no DOM); `supportNoteOf`
 * directly
 * Value: no_claim=how it looks, and the engine's geometry (engine/test/supports.test.ts)
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerdictLine, type SupportNote } from './VerdictLine.js';
import { supportNoteOf, type VerdictView } from './verdictView.js';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ');

const WORKS: VerdictView = {
  kind: 'EXACT', detail: '', gapMm: 0, gapKnown: true, bend: null, rank: 1, failingLoops: 0,
  clashCount: 0, overlapCount: 0, polarityCount: 0, levelMismatchCount: 0, thirdLevelCount: 0,
  bridgeCount: 0, raised: true, adapterCount: 0, jointCount: 8, openRuns: 0, loopRuns: 1, loopAt: null, pieces: null,
};
const html = (supportNote: SupportNote | null, view = WORKS) => renderToStaticMarkup(createElement(VerdictLine, { view, supportNote }));
const verdict = (supportNote: SupportNote | null, view = WORKS) => text(html(supportNote, view));

describe('the supports note', () => {
  it('while F4 is unmeasured, says supports are not checked, as before', () => {
    expect(verdict(null)).toContain('Raised track: supports are not checked.');
  });

  /*
   * MUTATION PROOFS, run:
   * - `Math.ceil` back to `Math.round` on the stretch (it reads 288mm):
   *   `expected 'OThis works. Closes exactly, no give …' to contain 'X
   *   Raised track may sag at piece 7: 28…'`.
   * - `SupportLines` never rendered (the not-checked line always): the same
   *   message, and the two specs after it fail the same way.
   */
  it('names the piece where raised track may sag, its length rounded up, and keeps the pass', () => {
    const note: SupportNote = { spanMm: 260, unheld: [{ piece: 7, lengthMm: 288.2 }], openEnds: [] };
    const out = verdict(note);
    expect(out).toMatch(/^OThis works\./);
    expect(out).toContain('X Raised track may sag at piece 7: 289mm with no support, past the 260mm tested.');
    expect(out).not.toContain('supports are not checked');
    expect(out).not.toContain('supports checked');
    expect(html(note)).toContain('<span aria-hidden="true">X </span>Raised track may sag');
  });

  /*
   * MUTATION PROOF, run: the all-held line dropped: `expected 'OThis works.
   * Closes exactly, no give …' to contain 'Raised track: supports checked,
   * every…'`.
   */
  it('says when every gap is within F4', () => {
    expect(verdict({ spanMm: 260, unheld: [], openEnds: [] })).toContain('Raised track: supports checked, every gap within the 260mm tested.');
  });

  /*
   * MUTATION PROOF, run: the dead-end line dropped: `expected 'OThis works.
   * Closes exactly, no give …' to contain 'Raised track ends in mid-air at
   * piece…'`.
   */
  it('says a dead end was not checked, every piece named once', () => {
    const out = verdict({ spanMm: 260, unheld: [], openEnds: [3, 9, 12] });
    expect(out).toContain('Raised track ends in mid-air at pieces 3, 9 and 12: how far it can reach past a support is not checked.');
    expect(verdict({ spanMm: 260, unheld: [], openEnds: [9] })).toContain('ends in mid-air at piece 9:');
  });

  it('says nothing about supports when no track is raised', () => {
    expect(verdict({ spanMm: 260, unheld: [], openEnds: [] }, { ...WORKS, raised: false })).not.toMatch(/Raised track/);
  });
});

describe('supportNoteOf', () => {
  /*
   * MUTATION PROOF, run: the `new Set` dropped: `expected { spanMm: 260,
   * …(2) } to deeply equal { spanMm: 260, …(2) }` (dead ends 3, 9, 9).
   */
  it('numbers the pieces, each dead end once and in order, and is null with no report', () => {
    const number = new Map([['a', 3], ['b', 9], ['c', 7]]);
    const note = supportNoteOf(
      {
        spanMm: 260,
        unheld: [{ lengthMm: 300, pieceId: 'c', at: [0, 0], pieceIds: ['c'] }],
        openEnds: [{ pieceId: 'b', at: [0, 0] }, { pieceId: 'a', at: [0, 0] }, { pieceId: 'b', at: [1, 0] }],
      },
      (id) => number.get(id)!,
    );
    expect(note).toEqual({ spanMm: 260, unheld: [{ piece: 7, lengthMm: 300 }], openEnds: [3, 9] });
    expect(supportNoteOf(null, () => 0)).toBeNull();
  });
});
