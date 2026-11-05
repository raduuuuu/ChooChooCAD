/**
 * THE EXAMPLE IS NOT CHECKED AGAINST YOUR BOX (live site, 2026-11-05).
 *
 * Value: protects=with a box declared, the example layout shows no "Short by"
 * line; the user's own layout still does
 * Value: fails_when=the shortfall line judges the example again, or stops
 * judging the user's layout
 * Value: why_new=seen on the live site: "Short by 2 D, 1 E against what you
 * own" under the example
 * Value: seam=the real App in StrictMode with offerExample, a box in storage
 * Value: no_claim=the palette's greyed pieces (unchanged)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { INVENTORY_STORAGE_KEY } from './storageKeys.js';

afterEach(() => localStorage.clear());

describe('the shortfall line and the example', () => {
  /*
   * MUTATION PROOF, run: the line's `screen.mode !== 'example' &&` removed:
   * `expected 'Short by 2 D, 7 E against what you ow…' to be null`.
   */
  it('says nothing under the example, and speaks for the user\'s own layout', async () => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ E: 1 }));
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App offerExample />
      </StrictMode>,
    );
    expect(screen.getByRole('button', { name: 'Start my own' })).not.toBeNull();
    const line = () => document.querySelector('.shortfall')?.textContent ?? null;
    expect(line()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Start my own' }));
    for (let i = 0; i < 2; i++) await place(user, screen.getAllByRole('button', { name: /^Add Large curve/ })[0]!);
    expect(line()).toMatch(/^Short by/);
  });
});
