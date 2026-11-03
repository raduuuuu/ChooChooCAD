/**
 * THE STATION'S OTHER SIDE THROUGH THE REAL APP (decorated-pieces plan T4,
 * eng D5, design 5A).
 *
 * Value: protects=a placed station straight offers "Other side (F)" on the
 * selected-piece strip, and the button and the F key both move its platform
 * across, said aloud, as one undoable step; a plain straight offers nothing
 * Value: fails_when=App stops showing the button, the F key stops reaching a
 * selected piece, or the step is not undoable
 * Value: why_new=flipping a placed piece is new
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=the platform's drawn side (render and 3D tests hold that)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const strip = () => screen.queryByRole('group', { name: 'Selected piece' });

const mount = async () => {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await place(user, button(/^Add Medium straight\. Measured\.$/));
  await place(user, button(/^Add Station straight\./));
  return user;
};

describe("a placed station's platform to the other side", () => {
  /*
   * MUTATION PROOFS, run:
   * - the strip's button removed: `Unable to find role="button" and name
   *   "Other side (F)"`.
   * - F not wired for a selected piece: `expected 'Selected Piece 2: Station
   *   straight (SS).' to be 'Piece 2: Platform on the other side.'`.
   */
  it('the strip button and the F key both move it, each undoable', async () => {
    const user = await mount();
    await user.click(button('Piece 1: Medium straight (A), 144mm'));
    expect(within(strip()!).queryByRole('button', { name: 'Other side (F)' })).toBeNull();
    await user.click(button(/^Piece 2: Station straight \(SS\)/));
    await user.click(within(strip()!).getByRole('button', { name: 'Other side (F)' }));
    expect(announced().textContent).toBe('Piece 2: Platform on the other side.');
    await user.click(button('Undo other side'));
    expect(announced().textContent).toBe('Undid that. Back on the side it was.');
    // Still selected after the undo: F does the same as the button.
    expect(strip()).not.toBeNull();
    await user.keyboard('f');
    expect(announced().textContent).toBe('Piece 2: Platform on the other side.');
  });
});
