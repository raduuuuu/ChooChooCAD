/**
 * JOINING IS A MODE YOU CAN SEE AND LEAVE (design review 27A, 28A, 28B,
 * 2026-10-31).
 *
 * Value: protects=the verdict's "Join two ends" starts joining; a strip says
 * what to click and offers Cancel; the ends a join can go to are ringed;
 * Escape ends it; the canvas's Join button closes a loop that stops just short
 * Value: fails_when=the button is not offered, the strip does not follow the
 * armed end, Escape leaves joining on, or the Join button does nothing
 * Value: why_new=arming an end was a thin ring with no words and no Cancel;
 * no spec covered joining as a mode or the suggestion
 * Value: seam=jsdom plus testing-library, in the `dom` project, rendering
 * `App` inside `StrictMode` as `main.tsx` does
 * Value: no_claim=how the rings and button look; jsdom has no layout, and the
 * browser check covers the drawing
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const strip = () => screen.queryByRole('group', { name: 'Joining two ends' });
const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;

/** Near miss with its closing joint broken: a loop whose two ends stop 72mm apart. */
async function openLoop() {
  const user = userEvent.setup();
  const { container } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(button('Near miss'));
  const joints = screen.getAllByRole('button', { name: 'Break this joint' });
  await user.click(joints[joints.length - 1]!);
  expect(verdict().textContent).toMatch(/Not a loop yet/);
  return { user, container };
}

describe('joining two ends', () => {
  /*
   * MUTATION PROOFS, run:
   * - the `JoinStart` provider's value set to `null`: `Unable to find an
   *   accessible element with the role "button" and name "Join two ends"`.
   * - the `else if (joining) cancelJoin();` branch removed from `onEscape`:
   *   `expected <div class="mode-strip" …(2)>…(2)</div> to be null`.
   */
  it('starts from the verdict, says what to click, rings the targets, and Escape ends it', async () => {
    const { user, container } = await openLoop();

    await user.click(button('Join two ends'));
    expect(strip()?.textContent).toContain('Joining two ends. Click the first free end.');
    expect(container.querySelectorAll('.port-target-ring')).toHaveLength(2);

    await user.click(button(/free socket end/i));
    expect(strip()?.textContent).toContain('Joining from the start of piece 1. Click another free end to join it.');
    expect(container.querySelectorAll('.port-target-ring')).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(strip()).toBe(null);
    expect(container.querySelectorAll('.port-ring')).toHaveLength(0);
  });

  it('Cancel in the strip ends it too', async () => {
    const { user } = await openLoop();
    await user.click(button('Join two ends'));
    await user.click(button('Cancel (Esc)'));
    expect(strip()).toBe(null);
  });

  /*
   * MUTATION PROOF, run: `onSuggest` on the canvas made a no-op:
   * `expected '?Not a loop yet. 10 pieces, open at b…' not to match /Not a loop yet/`.
   */
  it("the canvas's Join button closes the loop in one press", async () => {
    const { user } = await openLoop();
    await user.click(button('Join the start of piece 1 to the end of piece 10'));
    expect(verdict().textContent).not.toMatch(/Not a loop yet/);
  });
});
