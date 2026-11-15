/**
 * THE PHONE'S EDITOR (plan 2026-11-14, E4; design DD1, DD4, DD6, DD13, DD14;
 * eng ED2, ED3, ED6, ED9).
 *
 * Value: protects=a narrow screen gets the editor as one screen with Pieces,
 * Undo, Redo and More and no palette section; a wide screen gets the editor
 * it always had; a card picked in the
 * Pieces sheet closes the sheet and is previewed; Place keeps the same piece
 * ready; a key pressed while a sheet is open edits nothing; Clear in More
 * clears, closes the sheet and can be undone
 * Value: fails_when=a wide screen is given the phone's shell, the sheet stays open
 * over a picked piece, Place puts the preview away on a phone, Ctrl+Z inside
 * a sheet undoes track behind it, or More's Clear cannot be undone
 * Value: why_new=a phone never drew the editor at all
 * Value: seam=the real App under jsdom; matchMedia stubbed to a narrow touch
 * screen; the dialog stand-in in `app/test/domSetup.ts`; the shell's chunk
 * loaded for real through `lazy`
 * Value: no_claim=how it looks, that nothing scrolls, 44px targets, focus
 * and Escape in the sheet (a real phone, task T12); "Next end", the warning
 * line and the panels (their own tests)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { PHONE_SHELL_QUERY } from './phoneEditor.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';
import { TOUCH_QUERY } from './stripWords.js';
import { NARROW_QUERY } from './useMatchMedia.js';

const OWN = JSON.stringify({
  pieces: [
    { pieceId: 'm1', partId: 'A', turn: 'left' },
    { pieceId: 'm2', partId: 'A', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'm1', port: 1 }, b: { pieceId: 'm2', port: 0 } }],
  anchors: [],
});
const stored = () => (JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY) ?? 'null') as { pieces: unknown[] } | null)?.pieces.length;

/** A narrow touch screen: every query a phone answers yes to. */
function phoneScreen() {
  const yes = new Set([PHONE_SHELL_QUERY, NARROW_QUERY, TOUCH_QUERY]);
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: yes.has(q), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
}
const open = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

beforeEach(() => {
  phoneScreen();
  localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the phone’s editor', () => {
  /*
   * MUTATION PROOFS, run:
   * - `phone` true on every screen: the "wide screen" spec fails with
   *   `expected <button class="phone-pieces"></button> to be null`.
   * - the phone path removed from App's render: `Unable to find role="button"
   *   and name "Pieces"`.
   */
  it('is one screen with Pieces, Undo, Redo and More, and no palette section', async () => {
    open();
    const row = (await screen.findByRole('button', { name: 'Pieces' })).parentElement!;
    expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Pieces', 'Undo', 'Redo', 'More']);
    expect(document.querySelector('section.palette')).toBeNull();
    expect(document.querySelector('.phone .stage')).not.toBeNull();
    expect(document.querySelector('.phone-verdict .verdict')).not.toBeNull();
  });

  it('a wide screen does not get it: the palette section, as always', () => {
    vi.unstubAllGlobals();
    open();
    expect(screen.queryByRole('button', { name: 'Pieces' })).toBeNull();
    expect(document.querySelector('.phone')).toBeNull();
    expect(document.querySelector('section.palette')).not.toBeNull();
  });

  /*
   * MUTATION PROOFS, run:
   * - the pick not closing the sheet: `expected true to be false`.
   * - Place sent without `again`: `expected null not to be null` (no preview
   *   after the first Place, so no second Place to press).
   */
  it('a card picked in the sheet closes it and is previewed; Place keeps the same piece ready', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Pieces' }));
    const sheet = screen.getByRole('dialog', { name: 'Pieces' });
    expect(sheet.hasAttribute('open')).toBe(true);
    await user.click(sheet.querySelector<HTMLButtonElement>('button.piece-main[aria-label^="Add Medium straight"]')!);
    expect(sheet.hasAttribute('open')).toBe(false);
    expect(document.querySelector('.phone-strip')!.textContent).toContain('Placing: Medium straight');
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(stored()).toBe(3);
    expect(screen.queryByRole('button', { name: 'Place' })).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(stored()).toBe(4);
  });

  /*
   * MUTATION PROOF, run: the keys left on while a sheet is open: `expected 2
   * to be 3` (Ctrl+Z inside More undid the piece behind it).
   */
  it('a key pressed while a sheet is open edits nothing', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'Pieces' }));
    await user.click(screen.getByRole('dialog', { name: 'Pieces' }).querySelector<HTMLButtonElement>('button.piece-main[aria-label^="Add Medium straight"]')!);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(stored()).toBe(3);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(stored()).toBe(3);
  });

  /*
   * MUTATION PROOF, run: More's Clear not closing the sheet: `expected true
   * to be false`.
   */
  it('Clear in More clears, closes the sheet, and Undo brings the layout back', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'More' }));
    const more = screen.getByRole('dialog', { name: 'More' });
    expect([...more.querySelectorAll('.more-heading')].map((h) => h.textContent)).toEqual(['This layout', 'Your things', 'Ready layouts']);
    await user.click([...more.querySelectorAll<HTMLButtonElement>('button.more-row')].find((b) => b.textContent === 'Clear')!);
    expect(more.hasAttribute('open')).toBe(false);
    expect(stored()).toBe(0);
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(stored()).toBe(2);
  });
});
