/**
 * "THESE ARE MINE" AND "COPY WHAT IS SHORT" IN YOUR BOX (plan 2026-11-16, A3).
 *
 * Value: protects="These are mine" raises the box to the layout on screen,
 * adapters included, says how many counts rose, is gone once nothing more
 * would rise, and "Put it back" restores the box as it was (an undeclared
 * box becomes undeclared again); typing a count ends that offer; "Copy what
 * is short" puts the list, adapters included, on the clipboard and says so;
 * when the browser refuses, the list is shown to copy by hand; a layout
 * short of adapters alone still gets its list
 * Value: fails_when=a tap lowers or loses a count, adapters are left out of
 * either control, the offer to put it back outlives a typed count, or a
 * refused copy is silent
 * Value: why_new=neither control existed
 * Value: seam=the real App under jsdom; `navigator.clipboard` stubbed, once
 * to accept and once to refuse
 * Value: no_claim=how the row of buttons looks on a phone (seen in a browser
 * in the pull request), or a real clipboard
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY, INVENTORY_STORAGE_KEY } from './storageKeys.js';

/** Eight lattice coefficients: whole mm along x, and along y. */
const pos = (x: number, y: number) => [x, 0, 0, 0, y, 0, 0, 0];
/** Two medium straights start to start (their sockets meet: one adapter), and a third joined on. */
const LAYOUT = JSON.stringify({
  pieces: ['a', 'r', 'c'].map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' })),
  welds: [
    { a: { pieceId: 'a', port: 0 }, b: { pieceId: 'r', port: 0 } },
    { a: { pieceId: 'a', port: 1 }, b: { pieceId: 'c', port: 0 } },
  ],
  anchors: [
    ['a', { pos: pos(0, 0), heading: 0 }],
    ['r', { pos: pos(0, 0), heading: 8 }],
  ],
});
const stored = () => JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY) ?? 'null') as Record<string, number> | null;
const said = () => document.querySelector('.inventory-said')!.textContent;
const btn = (name: string) => screen.queryByRole('button', { name });

async function open(inventory?: object, clipboard?: { writeText: (t: string) => Promise<void> }) {
  localStorage.setItem(GRAPH_STORAGE_KEY, LAYOUT);
  if (inventory) localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  const user = userEvent.setup();
  // After `setup`, which installs a clipboard of its own.
  if (clipboard) vi.stubGlobal('navigator', { ...navigator, clipboard });
  render(<App />);
  await user.click(screen.getAllByRole('button', { name: 'Your box' })[0]!);
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('These are mine', () => {
  /*
   * MUTATION PROOFS, run:
   * - "Put it back" restoring an empty box in place of the one before:
   *   `expected {} to deeply equal { A: 1, E: 7 }`.
   * - the button left on after everything is covered: `expected <button> to be null`.
   */
  it('raises the box to the layout, adapters included, says so, and can be put back', async () => {
    const user = await open({ A: 1, E: 7 });
    await user.click(btn('These are mine')!);
    expect(stored()).toEqual({ A: 3, E: 7, __adapter_male_male: 1 });
    expect(said()).toBe('2 counts raised to match this layout. ');
    expect(btn('These are mine')).toBeNull();
    expect(btn('Copy what is short')).toBeNull();

    await user.click(btn('Put it back')!);
    expect(stored()).toEqual({ A: 1, E: 7 });
    expect(btn('Put it back')).toBeNull();
    expect(btn('These are mine')).not.toBeNull();
  });

  /*
   * MUTATION PROOF, run: a count SET to what the layout uses, not only raised
   * (`n !== from` in `raiseToLayout`): `expected { A: 3, __adapter_male_male:
   * 1 } to deeply equal { A: 9, __adapter_male_male: 1 }` (nine straights cut
   * to three by one tap).
   */
  it('never lowers a count: a box holding more than the layout uses keeps it', async () => {
    const user = await open({ A: 9 });
    await user.click(btn('These are mine')!);
    expect(stored()).toEqual({ A: 9, __adapter_male_male: 1 });
    expect(said()).toBe('1 count raised to match this layout. ');
  });

  /*
   * MUTATION PROOFS, run:
   * - `setPutBack(null)` taken out of `setOne`: `expected <button> to be null`
   *   (the offer outlives a typed count, and would undo it).
   * - "Put it back" on an undeclared box writing `{}`: `expected {} to be null`.
   */
  it('declares an undeclared box, puts it back to undeclared, and a typed count ends the offer', async () => {
    const user = await open();
    expect(stored()).toBeNull();
    // Undeclared: nothing is short of a box that was never counted.
    expect(btn('Copy what is short')).toBeNull();
    await user.click(btn('These are mine')!);
    expect(stored()).toEqual({ A: 3, __adapter_male_male: 1 });
    await user.click(btn('Put it back')!);
    expect(stored()).toBeNull();

    await user.click(btn('These are mine')!);
    const field = screen.getByLabelText('How many Medium straight you own');
    await user.clear(field);
    await user.type(field, '5');
    expect(btn('Put it back')).toBeNull();
    expect(stored()).toEqual({ A: 5, __adapter_male_male: 1 });
  });
});

describe('Copy what is short', () => {
  /*
   * MUTATION PROOFS, run:
   * - the adapters not passed to the list: `expected "vi.fn()" to be called
   *   with arguments: [ Array(1) ]` (the adapter line missing from the text).
   * - "Copied." not said: `expected '' to be 'Copied.'`.
   */
  it('copies the pieces and the adapters this layout is short of, and says so', async () => {
    const writeText = vi.fn(async () => {});
    const user = await open({ A: 1 }, { writeText });
    await user.click(btn('Copy what is short')!);
    expect(writeText).toHaveBeenCalledWith('Still needed for this layout:\n2 x Medium straight (A)\n1 x male-male adapter');
    expect(said()).toBe('Copied.');
    expect(document.querySelector('.inventory-list')).toBeNull();
  });

  /*
   * MUTATION PROOFS, run:
   * - the refusal swallowed (an empty `catch`): `expected '' to be "Couldn't
   *   copy. The list is here to select…"`.
   * - the list built only when a PIECE is short: `expected '' to be "Couldn't
   *   copy. The list is here to sel…"` (nothing happens for a layout short of
   *   one adapter and nothing else).
   */
  it('a layout short of adapters alone has its list, shown to copy by hand when the browser refuses', async () => {
    const user = await open({ A: 3 }, { writeText: async () => Promise.reject(new Error('denied')) });
    await user.click(btn('Copy what is short')!);
    expect(said()).toBe("Couldn't copy. The list is here to select and copy by hand.");
    const list = document.querySelector<HTMLTextAreaElement>('.inventory-list')!;
    expect(list.value).toBe('Still needed for this layout:\n1 x male-male adapter');
    expect(list.readOnly).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the buttons always drawn: `expected <button> to be null`.
   */
  it('neither button is offered when the box covers the layout', async () => {
    await open({ A: 3, __adapter_male_male: 1 });
    expect(btn('Copy what is short')).toBeNull();
    expect(btn('These are mine')).toBeNull();
  });
});
