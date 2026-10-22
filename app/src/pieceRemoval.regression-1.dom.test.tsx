/**
 * FOCUS SURVIVES REMOVING A PIECE (decision 2A; DESIGN.md keyboard rules).
 *
 * Value: protects=removing the focused piece by Delete, or by the strip's
 * Remove piece, leaves focus on a neighbouring piece, so a keyboard user can
 * carry on from where they were
 * Value: fails_when=focus is left on the removed element and falls to the
 * page body
 * Value: why_new=pieceRemoval.dom.test.tsx checks what is removed, not where
 * focus goes after
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=that the focus ring is drawn; jsdom has no paint
 */

// Regression: ISSUE-001 — removing the focused piece dropped focus to the page body
// Found by /qa on 2026-10-22
// Report: .gstack/qa-reports/run-20261022T200820Z/qa-report-localhost-2026-10-22.md

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const strip = () => screen.queryByRole('group', { name: 'Selected piece' });

const threeStraights = async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  for (let i = 0; i < 3; i++) await place(user, button(/^Add Medium straight$/));
  return user;
};

describe('after removing a piece, focus stays on the track', () => {
  /*
   * MUTATION PROOF, run: the canvas's refocus effect removed (the code before
   * the fix): both specs fail with `expected null to be 'Piece 2: Medium
   * straight (A), 144mm'`, focus having fallen to the body, which has no name.
   */
  it('Delete on the focused piece moves focus to the piece after it', async () => {
    const user = await threeStraights();
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    button('Piece 2: Medium straight (A), 144mm').focus();
    await user.keyboard('{Delete}');
    // The old piece 3 is now piece 2.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Piece 2: Medium straight (A), 144mm');
  });

  it("the strip's Remove piece moves focus to a neighbouring piece", async () => {
    const user = await threeStraights();
    await user.click(button('Piece 3: Medium straight (A), 144mm'));
    await user.click(within(strip()!).getByRole('button', { name: 'Remove piece' }));
    // The last piece had no piece after it, so the one before.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Piece 2: Medium straight (A), 144mm');
  });
});
