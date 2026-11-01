/**
 * A SLOW LINK SAYS IT IS OPENING, A FAST ONE SAYS NOTHING (share plan,
 * design 6A; the house rule, LOADING_DELAY_MS).
 *
 * Value: protects=for the first 300ms a link shows only the app's name, then
 * "Opening a shared railway…"; the editor never flashes meanwhile
 * Value: fails_when=the delay goes (a flash of words on every fast link) or
 * the sentence never comes (a blank page that reads as broken)
 * Value: why_new=links are new
 * Value: seam=`decodeLink` mocked to never settle, standing in for a slow
 * phone; fake timers
 * Value: no_claim=how long a real phone takes (the plan's D38 device run)
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LinkRoute } from './LinkRoute.js';

vi.mock('./shareLink.js', async (original) => ({
  ...(await original<typeof import('./shareLink.js')>()),
  decodeLink: () => new Promise(() => undefined),
}));

afterEach(() => vi.useRealTimers());

/*
 * MUTATION PROOF, run: LinkRoute starting with `slow` true: `expected
 * 'Opening a shared railway…' to be null // Object.is equality` at 299ms.
 */
it('nothing for 300ms, then one quiet sentence, and never the editor', () => {
  vi.useFakeTimers();
  render(<LinkRoute fragment="#v1.abc" />);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByText('Opening a shared railway…')?.textContent ?? null).toBe(null);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText('Opening a shared railway…')).toBeTruthy();
  expect(document.querySelector('.palette')).toBe(null);
});
