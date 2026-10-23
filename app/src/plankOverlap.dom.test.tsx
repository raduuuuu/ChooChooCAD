/**
 * TRACK OVER TRACK, SAID OUT LOUD (owner bug report 2026-10-23).
 *
 * Value: protects=two planks crossing mid-span make the verdict "Can't be
 * built" with its own sentence and a marker on the canvas, and a preview
 * that would lie over track turns red and says over which piece
 * Value: fails_when=the overlaps never reach the verdict, the canvas or the
 * preview, so a crossing draws as one merged shape that reads as a switch
 * Value: why_new=the only overlap check was ends on the same exact spot
 * Value: seam=jsdom plus user-event, App mounted in StrictMode, the layout
 * seeded through storage as a reload would load it
 * Value: no_claim=the geometry; engine/test/plankOverlap.test.ts owns it
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/** Eight lattice coefficients: whole mm along x, and along y (zeta^4 is i). */
const pos = (x: number, y: number) => [x, 0, 0, 0, y, 0, 0, 0];

function seed(pieces: readonly { id: string; x: number; y: number; heading: number }[]) {
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: pieces.map((p) => ({ pieceId: p.id, partId: 'A', turn: 'left' })),
      welds: [],
      anchors: pieces.map((p) => [p.id, { pos: pos(p.x, p.y), heading: p.heading }]),
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

describe('track laid over track', () => {
  /*
   * MUTATION PROOFS, run:
   * - `impossible` in verdictView.ts without `r.overlaps.length > 0`:
   *   `expected 'Not a loop yet. 2 separate runs of tr…' to match
   *   /^Can’t be built\. 1 place has track r…/`.
   * - `clashMarks` back to `result.clashes` only: `expected +0 to be 1`.
   * - VerdictLine always taking `ACTION_FOR_VERDICT.IMPOSSIBLE`: `expected
   *   'Move one of the pieces that share a s…' to be 'Move one of the
   *   crossing pieces so th…'`.
   */
  it('two straights in a plus sign: the verdict says so and the crossing is marked', () => {
    seed([
      { id: 'a', x: 0, y: 0, heading: 0 },
      { id: 'b', x: 72, y: -72, heading: 4 },
    ]);
    const verdict = document.querySelector('.verdict-text')!.textContent!;
    expect(verdict).toMatch(/^Can’t be built\. 1 place has track running over other track\./);
    // Design decision 9A: bridges can be built now, so the copy points at ramps.
    expect(verdict).toContain('or raised on ramps over the other track.');
    expect(document.querySelector('.verdict-action')!.textContent).toBe(
      'Move one of the crossing pieces so the two no longer touch, or raise one on ramps.',
    );
    // The clash marker: a ring and a cross, drawn at the crossing.
    expect(document.querySelectorAll('circle[stroke="var(--fail)"]').length).toBe(1);
  });

  /*
   * MUTATION PROOF, run: the preview's overlap block deleted from
   * `ghostView`: `expected 'Placing: Medium straight (A) O Fits h…' to
   * contain 'It would lie over piece 1.'`.
   */
  it('a preview that would cross track is red and names the piece', async () => {
    // Piece 2 points up at piece 1's middle and stops short of it, so the
    // next straight on its far end would lie across piece 1.
    seed([
      { id: 'a', x: 0, y: 0, heading: 0 },
      { id: 'b', x: 72, y: -216, heading: 4 },
    ]);
    expect(document.querySelector('.verdict-text')!.textContent).toMatch(/^Not a loop yet/);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: /^Add Medium straight$/ })[0]!);
    const strip = screen.getByRole('group', { name: /Placing/ }).textContent!;
    expect(strip).toContain('It would lie over piece 1.');
    expect(document.querySelector('.ghost')!.getAttribute('class')).toBe('ghost is-red');
  });
});
