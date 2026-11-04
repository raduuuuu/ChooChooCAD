/**
 * NO MAKER IS NAMED ON SCREEN (design review 2026-11-04, D1, D2).
 *
 * Value: protects=the palette's shelves, their notes and cards, the verdict's
 * join note and the add-a-part form name track systems by trait
 * Value: fails_when=any visible text, tooltip, accessible name or picker
 * option spells a maker's name
 * Value: why_new=the shelves and the picker were named after makers
 * Value: seam=jsdom, App mounted in StrictMode with a stored layout
 * Value: no_claim=build mode and the friend screen, which print the same
 * `codeOf` and part names checked in traitNames.test.ts
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';
import { MAKER } from '../test/makers.js';

/** Everything a person can read or hear: text, tooltips, accessible names. */
function everythingShown(): string[] {
  const attrs = [...document.querySelectorAll('[title], [aria-label]')].flatMap((el) => [
    el.getAttribute('title') ?? '',
    el.getAttribute('aria-label') ?? '',
  ]);
  return [document.body.textContent ?? '', ...attrs];
}

describe('the screen names no maker', () => {
  /*
   * MUTATION PROOF, run:
   * - the small-peg shelf labelled 'IKEA Lillabo track': `Unable to find an
   *   element with the text: Small-peg track`.
   * - the shelf note saying "Nobody (not even IKEA) publishes dimensions":
   *   `expected [ 'IKEA' ] to deeply equal []`.
   */
  it('with a small-peg piece placed, every shelf open and the part form open', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify({
      pieces: [
        { pieceId: 'p0', partId: 'A', turn: 'left' },
        { pieceId: 'p1', partId: 'IKEA-C45', turn: 'left' },
      ],
      welds: [],
    }));
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    for (const d of document.querySelectorAll('details')) d.open = true;
    expect(screen.getAllByText('Small-peg track').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Generic and Small-peg track do not physically join/).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Add a part' })[0]!);
    expect(screen.getByRole('option', { name: 'Look-alike' })).toBeTruthy();
    const hits = everythingShown().flatMap((s) => s.match(new RegExp(MAKER.source, 'gi')) ?? []);
    expect([...new Set(hits)]).toEqual([]);
  });
});
