/**
 * PLACING A PIECE THROUGH THE REAL APP (decisions R3, 1A, 3A, 4A, 9A, 14A,
 * 18A, 20A, P-g; Codex OV6).
 *
 * Value: protects=a palette click shows the piece and the Placing strip with
 * its status, puts focus on Place, prefixes the verdict "Placed track:"; R
 * and F work from there; Esc cancels and hands focus back; a red preview
 * says why and can still be placed; an empty floor shows the canvas once a
 * piece is picked; a double-click places straight away
 * Value: fails_when=App stops wiring the preview to the canvas or strip, the
 * focus hand-off breaks, the verdict loses its scope prefix, or a key typed in
 * a text field turns the preview
 * Value: why_new=the preview is new
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=how the preview looks (no layout or paint in jsdom), and the
 * over-the-drawing-limit pause, which needs 10,001 pieces to reach
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const strip = () => screen.queryByRole('group', { name: 'Placing a piece' });
const listCount = () => screen.getByText(/This layout, as a list/).textContent;

const mount = () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return user;
};

describe('placing a piece', () => {
  /*
   * MUTATION PROOFS, run:
   * - no focus to Place on pick: `expected 'ELarge curver202' to be 'Place
   *   (Enter)'` (focus stayed on the palette button), and Enter then picked
   *   instead of placing.
   * - no verdict scope: `expected '?Not a loop yet. 1 piece, open at bot…' to
   *   match /^.?Placed track:/`.
   * - Cancel keeps focus where it was: `expected <body…> to be <button
   *   class="piece-main" …>`.
   * - no F key: `expected 'Placing Large curve. Press F to bend …' to be
   *   'Now bends the other way.'`.
   * - keys reach the preview from a text field: `expected '' to be 'f'`.
   * - an empty floor ignores the preview: `expected <p
   *   class="canvas-empty-lead"></p> to be null`.
   * - a refused fit not reported: `expected 'O Fits here.' to match /^X Peg
   *   meets peg here\. You can still…/`.
   * - no double-click placement: the setup's straight is never placed, so
   *   the first two specs fail as above.
   */
  it('a click shows it, focuses Place, scopes the verdict; Esc cancels and hands focus back', async () => {
    const user = mount();
    await user.dblClick(button(/^Add Medium straight$/));
    const palette = button('Add Large curve');
    await user.click(palette);

    expect(within(strip()!).getByText(/Placing: Large curve \(E\)/)).toBeTruthy();
    expect(within(strip()!).getByText(/Fits here\./)).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Place (Enter)');
    expect(verdict().textContent).toMatch(/^.?Placed track:/);

    await user.keyboard('f');
    expect(announced().textContent).toBe('Now bends the other way.');

    await user.keyboard('{Escape}');
    expect(strip()).toBeNull();
    expect(document.activeElement).toBe(palette);
    expect(verdict().textContent).not.toMatch(/Placed track:/);
    expect(listCount()).toMatch(/1 piece/);
  });

  it('Enter places it, joined to the end it was shown at', async () => {
    const user = mount();
    await user.dblClick(button(/^Add Medium straight$/));
    await user.click(button('Add Large curve'));
    await user.keyboard('{Enter}');
    expect(strip()).toBeNull();
    expect(listCount()).toMatch(/2 pieces, 1 joint/);
    expect(announced().textContent).toBe('Added piece 2, Large curve (E), joined to the end of piece 1.');
  });

  it('a red preview says why, and can still be placed', async () => {
    const user = mount();
    await user.dblClick(button(/^Add Medium straight$/));
    // Two pegs, onto the straight's peg end.
    await user.click(button(/^Add Medium straight, two pegs/));
    const status = within(strip()!).getByRole('status');
    expect(status.textContent).toMatch(/^X Peg meets peg here\. You can still place it\./);
    // The caveat that crossings went unchecked is gone now they are checked
    // (overlap.ts). MUTATION PROOF, run: the footnote span restored: `expected
    // 'X Peg meets peg here. You can still p…' not to match /mid-piece/`.
    expect(status.textContent).not.toMatch(/mid-piece/);
    await user.click(button('Place (Enter)'));
    expect(listCount()).toMatch(/2 pieces/);
  });

  it('on an empty floor, picking swaps the welcome panel for the canvas', async () => {
    const user = mount();
    expect(screen.getByText('Nothing on the floor yet.')).toBeTruthy();
    await user.click(button('Add Large curve'));
    expect(screen.queryByText('Nothing on the floor yet.')).toBeNull();
    expect(screen.getByRole('img', { name: 'Track layout' }).querySelector('.ghost')).not.toBeNull();
    await user.click(button('Cancel (Esc)'));
    expect(screen.getByText('Nothing on the floor yet.')).toBeTruthy();
  });

  it('a double-click places straight away, with no preview', async () => {
    const user = mount();
    await user.dblClick(button('Add Large curve'));
    expect(strip()).toBeNull();
    expect(listCount()).toMatch(/1 piece/);
  });

  it('a key typed in a text field does not turn the preview', async () => {
    const user = mount();
    await user.dblClick(button(/^Add Medium straight$/));
    await user.click(button('Add Large curve'));
    await user.click(button('Add a part'));
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('f');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('f');
    expect(announced().textContent).not.toMatch(/^Now bends/);
  });
});
