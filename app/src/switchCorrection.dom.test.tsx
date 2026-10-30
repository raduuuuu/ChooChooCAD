/**
 * A SWITCH CANNOT BE "CORRECTED" INTO A TWO-ENDED PART.
 *
 * Value: protects=a layout with a joint on a switch's third end survives the
 * user submitting a correction for that switch's id: the app neither crashes
 * nor replaces the switch, and the form says why it will not
 * Value: fails_when=the library lets a two-ended submission override a
 * switch, or the form accepts one
 * Value: why_new=codex review, 2026-10-22: correcting a connected switch with
 * a straight threw `piece p0 has no port 2` from placement and took the whole
 * app down to the crash screen
 * Value: seam=jsdom plus user-event, App mounted in StrictMode over a stored
 * layout
 * Value: no_claim=nothing about correcting a switch's own geometry, which the
 * form cannot express (it measures straights and curves only)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/** An L with a Large curve on its curved road, the switch's port 2. */
const GRAPH = JSON.stringify({
  pieces: [
    { pieceId: 'p0', partId: 'L', turn: 'left' },
    { pieceId: 'p1', partId: 'E', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'p0', port: 2 }, b: { pieceId: 'p1', port: 0 } }],
});

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const verdict = () =>
  screen.getAllByRole('status').find((el) => el.classList.contains('verdict'));

describe('correcting a switch from the submission form', () => {
  /*
   * MUTATION PROOF, run: in `SubmitPart.tsx`, set `const correctsMultiRoad =
   * false`. Fails with `expected false to be true`: the button is live. With
   * the library guard still in place the app does not crash, which is why
   * that guard has its own spec in `engine/test/analytic.test.ts`. Before
   * either guard existed, this spec (without the `disabled` check) failed
   * with `Error: piece p0 has no port 2`, the crash the review found.
   */
  it('is refused, and the layout that uses the switch stays up', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, GRAPH);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(button('Add a part'));
    await user.type(screen.getByLabelText('Name'), 'not a switch');
    await user.type(screen.getByLabelText('Length, mm'), '144');
    await user.type(screen.getByLabelText('Correcting an existing part?'), 'L');

    const add = button('Add to the library') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByText(/has more than two ends, like a switch or a\s+crossing/)).toBeTruthy();
    await user.click(add);
    expect(localStorage.getItem(SUBMISSIONS_STORAGE_KEY)).toBe('[]');
    expect(verdict()?.textContent).toMatch(/2 pieces/);
  });
});
