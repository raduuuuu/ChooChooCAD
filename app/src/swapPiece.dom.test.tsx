/**
 * SWAPPING A PLACED PIECE THROUGH THE REAL APP (decorated-pieces plan T6,
 * CEO E8, design 3A).
 *
 * Value: protects=a selected plain piece offers "Make it a <name>" for each
 * decorated version, a decorated piece offers "Make it plain", a piece with
 * no version offers neither, and the swap is said aloud and undoable
 * Value: fails_when=App stops showing the buttons, shows them on a piece
 * with no version, or the swap is not one undoable step
 * Value: why_new=swapping a placed piece is new
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=the refusal's wording and the joints kept (structuresApp.test.ts)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const strip = () => screen.getByRole('group', { name: 'Selected piece' });
const swapButtons = () => within(strip()).queryAllByRole('button', { name: /^Make it / }).map((b) => b.textContent);

describe('a placed piece made decorated and plain again', () => {
  /*
   * MUTATION PROOF, run:
   * - the strip's swap buttons removed: `expected [] to deeply equal [ 'Make
   *   it a Station straight' ]`.
   * - every decorated piece offered, unfiltered: `expected [ 'Make it a
   *   Level crossing', …(2) ] to deeply equal []`.
   */
  it('offers each version by name, swaps, undoes, and offers nothing on a piece with none', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await place(user, button(/^Add Medium straight\. Measured\.$/));
    await place(user, button('Add Large curve'));
    await user.click(button(/^Piece 2: Large curve/));
    expect(swapButtons()).toEqual([]);
    await user.click(button('Piece 1: Medium straight (A), 144mm'));
    expect(swapButtons()).toEqual(['Make it a Station straight']);
    await user.click(within(strip()).getByRole('button', { name: 'Make it a Station straight' }));
    expect(announced().textContent).toBe('Piece 1 is now a Station straight.');
    expect(swapButtons()).toEqual(['Make it plain']);
    await user.click(button('Undo swap'));
    expect(announced().textContent).toBe('Undid the swap. The piece is back as it was.');
    expect(swapButtons()).toEqual(['Make it a Station straight']);
  });
});
