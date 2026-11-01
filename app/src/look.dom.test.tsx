/**
 * THE LOOK: THE SETTLE AND THE NOTES FOLD (share plan, design 4A, 15A; eng D69).
 *
 * Value: protects=a piece placed on its own settles, and nothing else moves (a
 * preset, the first render); reduced motion turns the settle off; the
 * verdict's explanations open and close behind "N notes", the button says
 * whether it is open, and the choice lasts the session
 * Value: fails_when=the settle fires for a whole preset or on load, the
 * reduced-motion rule goes, the fold forgets on every edit, or its button
 * stops reporting its state
 * Value: why_new=the product had no motion and no fold
 * Value: seam=App mounted under jsdom; the motion itself is CSS, so the test
 * reads which paths carry `.settle` and that app.css turns it off for reduced
 * motion
 * Value: no_claim=how the 160ms looks (checked in a browser)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';

const settling = () => document.querySelectorAll('path.settle').length;
const openApp = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

afterEach(() => sessionStorage.clear());

describe('the settle (15A)', () => {
  /*
   * MUTATION PROOF, run: `added.size === 1` loosened to `added.size > 0`:
   * `expected 36 to be +0`, every piece of the Stadium settling at once.
   */
  it('a piece placed on its own settles; a preset does not', async () => {
    const user = userEvent.setup();
    openApp();
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(settling()).toBeGreaterThan(0);
    const paths = [...document.querySelectorAll('path.settle')];
    expect(paths.every((p) => p.closest('.drag-run') === null)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Stadium' }));
    expect(settling()).toBe(0);
  });

  it('nothing settles on the first render of a stored layout', () => {
    localStorage.setItem('generic.graph.v1', JSON.stringify({ pieces: [{ pieceId: 'a', partId: 'A' }], welds: [], anchors: [] }));
    openApp();
    expect(settling()).toBe(0);
  });

  /*
   * MUTATION PROOF, run: the reduced-motion block removed from app.css:
   * `expected null not to be null`.
   */
  it('reduced motion turns it off', () => {
    const css = readFileSync(join(__dirname, 'app.css'), 'utf8');
    expect(css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.settle \{ animation: none; \}/)).not.toBeNull();
  });
});

describe('the notes fold (4A)', () => {
  /*
   * MUTATION PROOF, run: `toggle` not writing sessionStorage: `expected
   * 'false' to be 'true'`, the fold shut again after a remount.
   */
  it('opens and closes, says so, and stays open for the session', async () => {
    const user = userEvent.setup();
    const { unmount } = openApp();
    await user.click(screen.getByRole('button', { name: 'Stadium' }));
    const fold = screen.getByRole('button', { name: /^\d+ notes?$/ });
    const folded = document.getElementById('verdict-folded')!;
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(folded.hidden).toBe(true);
    await user.click(fold);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(folded.hidden).toBe(false);
    expect(folded.textContent).toContain('Exact to the catalogue.');
    unmount();
    openApp();
    expect(screen.getByRole('button', { name: /^\d+ notes?$/ }).getAttribute('aria-expanded')).toBe('true');
  });
});
