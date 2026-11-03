/**
 * THE MODEL LINK IN THE LIBRARY AND THE PULL LIST
 * (docs/plan/2026-11-03-printable-mark.md, decisions 4B, 6A, 9A, 10A, 12A).
 *
 * Value: protects=a printed part's card has a link beside its button (never
 * inside it) to its model page, in a new tab, credited by name; a part with
 * no model has none; the key names the glyph; build mode's pull list carries
 * the same link
 * Value: fails_when=the link moves into the card's button, loses its target
 * or credit, appears on an unprinted part, or the key or pull-list link goes
 * Value: why_new=no part origins were shown
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=how the glyph looks (checked in the browser)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const mount = () => {
  const user = userEvent.setup();
  const { container } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return { user, container };
};

describe('the model link', () => {
  /*
   * MUTATION PROOFS, run:
   * - the link left out of the card row: fails with `Unable to find an
   *   accessible element with the role "link" and name "Model by Cactus 973
   *   on MakerWorld (opens in a new tab)"`.
   * - `rel` dropped: fails with `expected null to be 'noopener noreferrer'`.
   * - the key's third entry dropped: fails with `expected ' Measured. *
   *   Unverified size. ' to be ' Measured. * Unverified size.  Printa…'`.
   */
  it('sits beside a printed card, opens its model page in a new tab, and the key names it', () => {
    const { container } = mount();
    const card = screen.getByRole('button', { name: /^Add Curved switch\./ });
    const row = card.parentElement!;
    const link = within(row).getByRole('link', { name: 'Model by Cactus 973 on MakerWorld (opens in a new tab)' });
    expect(card.contains(link)).toBe(false);
    expect(link.getAttribute('href')).toBe('https://makerworld.com/en/models/1001504');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    const plain = screen.getByRole('button', { name: /^Add Medium straight\./ }).parentElement!;
    expect(within(plain).queryByRole('link')).toBeNull();
    expect(container.querySelector('.palette-key')!.textContent).toBe(' Measured. * Unverified size.  Printable model.');
  });

  /*
   * MUTATION PROOF, run: the pull-list cell left empty fails with `Unable to
   * find an accessible element with the role "link" and name "Model by
   * Cactus 973 on MakerWorld (opens in a new tab)"`.
   */
  it("is on a printed part's row in build mode's pull list (12A)", async () => {
    const { user } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Curved switch\./ }));
    await user.click(screen.getByRole('button', { name: 'Build it' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('link', { name: 'Model by Cactus 973 on MakerWorld (opens in a new tab)' })).toBeTruthy();
  });
});
