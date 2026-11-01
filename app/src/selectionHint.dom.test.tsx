/**
 * THE "CLICK A PIECE" HINT AND THE REMOVAL LINE (plan 2026-11-01; design DR2,
 * DR3, DR4, DR8).
 *
 * Value: protects=the hint shows in the 2D editor with a piece down and none
 * selected or being placed, in words for the pointer; any selection retires it
 * in this browser for good, and blocked storage shows it again; after Remove
 * piece the strip says what was removed with an Undo that works
 * Value: fails_when=the hint shows on an empty floor or while placing, comes
 * back after a selection and a reload, says "Click" to a touch screen, or the
 * removal leaves no trace on screen
 * Value: why_new=removing a middle piece worked but nothing said a piece could
 * be selected, and a removal was only announced to screen readers
 * Value: seam=App under jsdom; `matchMedia` stubbed for a touch screen;
 * `localStorage.getItem` made to throw for blocked storage
 * Value: no_claim=how the line looks (checked in a browser)
 */

import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { HINT_MOUSE, HINT_TOUCH } from './selectHint.js';
import { GRAPH_STORAGE_KEY, SELECT_HINT_STORAGE_KEY } from './storageKeys.js';

const FOUR = JSON.stringify({ pieces: ['a', 'b', 'c', 'd'].map((pieceId) => ({ pieceId, partId: 'A' })), welds: [], anchors: [] });
const open = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
const hint = () => screen.queryByRole('group', { name: 'Tip' });
const piece = (n: number) => document.querySelectorAll<SVGGElement>('g.piece')[n - 1]!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the hint (DR2, DR3, DR8)', () => {
  /*
   * An empty floor draws its own panel and no strip (TrackCanvas's empty
   * branch), so the hint has nowhere to go there.
   *
   * MUTATION PROOF, run: the empty branch also drawing `{strip}`: `expected
   * <div class="mode-strip" …(2)>…(1)</div> to be null`.
   */
  it('not on an empty floor; shown with a piece down and none selected', () => {
    const { unmount } = open();
    expect(hint()).toBe(null);
    unmount();
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    open();
    expect(hint()!.textContent).toBe(HINT_MOUSE);
  });

  /*
   * MUTATION PROOF, run: `rememberHintSeen()` removed from the effect:
   * `expected null to be '1'`.
   */
  it('a canvas selection retires it, and it stays gone after a reload', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const { unmount } = open();
    fireEvent.click(piece(2));
    expect(hint()).toBe(null);
    expect(localStorage.getItem(SELECT_HINT_STORAGE_KEY)).toBe('1');
    unmount();
    open();
    expect(hint()).toBe(null);
  });

  it('a keyboard selection retires it too', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    open();
    fireEvent.keyDown(piece(1), { key: 'Enter' });
    expect(hint()).toBe(null);
  });

  it('not while a piece is being placed', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const user = userEvent.setup();
    open();
    await user.click(screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(hint()).toBe(null);
  });

  it('blocked storage shows it again rather than hiding it', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    localStorage.setItem(SELECT_HINT_STORAGE_KEY, '1');
    const real = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === SELECT_HINT_STORAGE_KEY) throw new DOMException('blocked', 'SecurityError');
      return real.call(this, key);
    });
    open();
    expect(hint()!.textContent).toBe(HINT_MOUSE);
  });

  /*
   * MUTATION PROOF, run: the touch sentence never chosen (always
   * HINT_MOUSE): `expected 'Click a piece to select it; Remove pi…' to be
   * 'Tap a piece to select it; Remove piec…'`.
   */
  it('says "Tap" on a touch screen', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)', media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    open();
    expect(hint()!.textContent).toBe(HINT_TOUCH);
  });
});

describe('the removal line (DR4)', () => {
  /*
   * MUTATION PROOF, run: `setRemovedNote` never called: `Unable to find an
   * accessible element with the role "group" and name "Last move"`.
   */
  it('says what was removed, offers Undo, and clears on the next change', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const user = userEvent.setup();
    open();
    fireEvent.click(piece(2));
    await user.click(screen.getByRole('button', { name: 'Remove piece' }));
    const line = screen.getByRole('group', { name: 'Last move' });
    expect(line.textContent).toMatch(/^Removed piece 2, /);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('group', { name: 'Last move' })).toBe(null);
    expect(document.querySelectorAll('g.piece').length).toBe(4);
  });
});
