/**
 * REMOVE ANY PIECE, THROUGH THE REAL APP (decisions R1/D2, 2A, D12, E5).
 *
 * Value: protects=a piece can be selected on the canvas by click or keyboard,
 * named in the selection strip, and removed from there, by Delete, or from
 * the layout list; Undo and Redo walk it back and forth by key; keys typed in
 * a text field never edit the layout
 * Value: fails_when=App stops passing the selection to the canvas or the
 * strip, the piece buttons lose their handlers, the list loses Remove, or the
 * document-wide keys fire inside a text field
 * Value: why_new=removal was Remove last only, with no selection at all
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=how the selection looks; jsdom has no layout or paint
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const listCount = () => screen.getByText(/This layout, as a list/).textContent;
const strip = () => screen.queryByRole('group', { name: 'Selected piece' });

const threeStraights = async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  for (let i = 0; i < 3; i++) await user.click(button(/^Add Medium straight$/));
  return user;
};

describe('removing any piece', () => {
  /*
   * MUTATION PROOFS, run:
   * - the piece's `onClick` stops selecting: `Expected container to be an
   *   Element, a Document or a DocumentFragment but got null` (no strip).
   * - the strip's Remove button does nothing: `expected 'This layout, as a
   *   list: 3 pieces, 2 j…' to match /2 pieces, 0 joints/`.
   * - no Alt+arrow stepping: `expected 'Piece 1: Medium straight (A), 144mm'
   *   to be 'Piece 2: Medium straight (A), 144mm'`.
   * - no Delete on the selected piece: `expected 'This layout, as a list: 3
   *   pieces, 2 j…' to match /2 pieces, 0 joints/`.
   * - App stops passing `onRemove` to the list: `Unable to find an accessible
   *   element with the role "button" and name "Remove piece 2"`.
   */
  it('click a piece, read it in the strip, remove it there, and Undo brings it back', async () => {
    const user = await threeStraights();
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    expect(within(strip()!).getByText(/Piece 2: Medium straight \(A\), 144mm · run of 3 pieces/)).toBeTruthy();

    await user.click(within(strip()!).getByRole('button', { name: 'Remove piece' }));
    expect(listCount()).toMatch(/2 pieces, 0 joints/);
    expect(announced().textContent).toBe('Removed piece 2, Medium straight (A).');
    expect(strip()).toBeNull();

    await user.click(button('Undo remove'));
    expect(listCount()).toMatch(/3 pieces, 2 joints/);
    await user.click(button('Redo remove'));
    expect(listCount()).toMatch(/2 pieces, 0 joints/);
  });

  it('from the keyboard: Tab to the track, Alt+arrow to a piece, Enter, Delete', async () => {
    const user = await threeStraights();
    const first = button('Piece 1: Medium straight (A), 144mm');
    first.focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Piece 2: Medium straight (A), 144mm');
    await user.keyboard('{Enter}');
    expect(strip()).not.toBeNull();
    await user.keyboard('{Delete}');
    expect(listCount()).toMatch(/2 pieces, 0 joints/);
  });

  it('from the layout list', async () => {
    const user = await threeStraights();
    await user.click(document.querySelector('details.graph-listing summary') as HTMLElement);
    await user.click(button('Remove piece 2'));
    expect(listCount()).toMatch(/2 pieces, 0 joints/);
  });
});

describe('the document-wide keys', () => {
  /*
   * MUTATION PROOFS, run:
   * - the editable-target check dropped: `Ctrl+Z in a text field undid a
   *   layout edit: expected 'This layout, as a list: 2 pieces, 1 j…' to match
   *   /3 pieces/`.
   * - Esc does nothing: `expected <div class="mode-strip" …(2)>…(2)</div> to
   *   be null`; the floor click does nothing: the same failure, one step
   *   later in the spec.
   */
  it('Esc clears a selection, and a click on bare floor does too', async () => {
    const user = await threeStraights();
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    await user.keyboard('{Escape}');
    expect(strip()).toBeNull();
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    await user.click(screen.getByRole('img', { name: 'Track layout' }));
    expect(strip()).toBeNull();
  });

  it('Ctrl+Z undoes and Shift+Ctrl+Z redoes, but not inside a text field', async () => {
    const user = await threeStraights();
    await user.keyboard('{Control>}z{/Control}');
    expect(listCount()).toMatch(/2 pieces/);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(listCount()).toMatch(/3 pieces/);

    await user.click(button('Add a part'));
    await user.click(screen.getByLabelText('Name'));
    await user.keyboard('{Control>}z{/Control}');
    expect(listCount(), 'Ctrl+Z in a text field undid a layout edit').toMatch(/3 pieces/);
  });
});
