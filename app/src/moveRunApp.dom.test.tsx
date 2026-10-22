/**
 * MOVING A RUN THROUGH THE REAL APP, WITHOUT A POINTER (decisions E6, 2A,
 * 6A, D12; eng review S7).
 *
 * Value: protects=a selected piece's run moves by the arrow keys and the
 * strip's Move run buttons, turns with R and Rotate run, is undoable as one
 * "move" step, and a refused move says why in the strip; turning a preview
 * does not redraw the committed track
 * Value: fails_when=App stops wiring the run move, the keyboard or strip
 * route, the refusal line, or the track layers lose their memo
 * Value: why_new=moving placed track is new
 * Value: seam=jsdom plus user-event, App mounted in StrictMode; the layer
 * render counter exported by TrackCanvas
 * Value: no_claim=the pointer drag itself: jsdom has no screen matrix, so a
 * drag never starts there (checked in a browser instead)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { layerRenders } from './TrackCanvas.js';

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
  for (let i = 0; i < 2; i++) await place(user, button(/^Add Medium straight$/));
  return user;
};

describe('moving a run without a pointer', () => {
  /*
   * MUTATION PROOFS, run:
   * - the arrow-key move removed: `expected 'Selected Piece 1: Medium straight
   *   (A).' to be 'Moved the run.'`.
   * - the strip's Move run up does nothing: `expected 'Selected Piece 2: Medium
   *   straight (A).' to be 'Moved the run.'`.
   */
  it('the arrow keys move the selected run, as one undoable step', async () => {
    const user = await mount();
    await user.click(button('Piece 1: Medium straight (A), 144mm'));
    button('Piece 1: Medium straight (A), 144mm').focus();
    await user.keyboard('{ArrowRight}');
    expect(announced().textContent).toBe('Moved the run.');
    expect(button('Undo move')).toBeTruthy();
    await user.click(button('Undo move'));
    expect(announced().textContent).toBe('Undid the move.');
  });

  it('the strip moves and turns the run', async () => {
    const user = await mount();
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    await user.click(within(strip()!).getByRole('button', { name: 'Move run up 1 cm' }));
    expect(announced().textContent).toBe('Moved the run.');
    await user.click(within(strip()!).getByRole('button', { name: 'Rotate run (R)' }));
    expect(announced().textContent).toBe('Moved the run.');
    expect(strip()!.textContent).toMatch(/run of 2 pieces/);
  });
});

describe('a refused move', () => {
  /*
   * MUTATION PROOFS, run:
   * - the refusal line removed from the strip: `expected 'Piece 2: Medium
   *   straight (A), 144mm ·…' to match /Can.t move it there: …/`.
   * - the reducer never clears a refusal: `expected 'Piece 1: Medium straight
   *   (A), 144mm ·…' not to match /Can.t move it there/`. Survived while the
   *   spec's next action was another move, which clears it itself.
   */
  it('says why in the strip, and the next action clears it', async () => {
    const user = await mount();
    // Piece 2 selected, then its joint broken: it is its own run, its start
    // still sitting on piece 1's far end. Any turn about that point leaves the
    // two ends together but no longer facing, so the move is refused.
    await user.click(button('Piece 2: Medium straight (A), 144mm'));
    await user.click(screen.getAllByRole('button', { name: 'Break this joint' })[0]!);
    expect(strip()).not.toBeNull();
    await user.click(within(strip()!).getByRole('button', { name: 'Rotate run (R)' }));
    expect(strip()!.textContent).toMatch(/Can.t move it there: its ends would land on other track ends\./);
    expect(announced().textContent).toBe("Can't move it there: its ends would land on other track ends.");
    // Any next action clears it, not only another move: select the other piece.
    await user.click(button('Piece 1: Medium straight (A), 144mm'));
    expect(strip()!.textContent).not.toMatch(/Can.t move it there/);
  });
});

describe('the committed track is not redrawn by a preview', () => {
  /*
   * Eng review S7: the static layers are memoised, so flipping a preview
   * re-renders only the preview. MUTATION PROOF, run: `TrackLayers` without `memo`.
   * Fails with `expected 6 to be +0`: two flips re-rendered the track
   * layers six times (StrictMode doubles each render).
   */
  it('flipping the piece being placed leaves the track layers alone', async () => {
    const user = await mount();
    await user.click(button('Add Large curve'));
    const before = layerRenders.count;
    await user.keyboard('f');
    await user.keyboard('f');
    expect(layerRenders.count - before).toBe(0);
  });
});
