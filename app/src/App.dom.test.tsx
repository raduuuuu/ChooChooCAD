/**
 * THE WHOLE APP, DRIVEN BY EVENTS (task E11's first DOM specs).
 *
 * Value: protects=the editing flow works end to end through real clicks and
 * keypresses: a preset loads, Enter on a joint breaks it, the freed ends
 * appear, Undo names the break and restores the loop, and a free end armed
 * from the keyboard says so
 * Value: fails_when=a handler is not wired, keyboard activation stops
 * working, or the verdict and the Undo label stop following the state
 * Value: why_new=until E11 the suite had no document, so every one of these
 * was checked by hand in a browser and pinned only as markup or as reducer
 * transitions; `weldBreak.test.ts` and `editorReducer.test.ts` say so in
 * their no_claim lines
 * Value: seam=jsdom plus testing-library, in the `dom` project
 * (vitest.config.ts), rendering `App` inside `StrictMode` as `main.tsx`
 * does, because an earlier bug here only showed under StrictMode's double
 * effects
 * Value: no_claim=nothing about pixels, hit-testing by paint order or CSS
 * hover, which jsdom does not lay out; `weldBreak.test.ts` pins the paint
 * order and the hover rule as text
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;

describe('the app, driven by events', () => {
  /*
   * MUTATION PROOF, run: remove the `onKeyDown` handler from the joint `<g>`
   * in `TrackCanvas.tsx`. Fails with `expected 'OThis works. Closes exactly,
   * no give …' to match /Not a loop yet/` (the leading O is the verdict's
   * glyph).
   */
  it('breaks a joint from the keyboard and puts it back with Undo', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect((button(/^Undo$/) as HTMLButtonElement).disabled).toBe(true);
    await user.click(button('Circle'));
    expect(verdict().textContent).toMatch(/This works/);

    const joints = screen.getAllByRole('button', { name: 'Break this joint' });
    expect(joints).toHaveLength(8);
    joints[3]!.focus();
    await user.keyboard('{Enter}');

    expect(verdict().textContent).toMatch(/Not a loop yet/);
    expect(screen.getAllByRole('button', { name: 'Break this joint' })).toHaveLength(7);
    expect(screen.getAllByRole('button', { name: /^(Next piece attaches here, )?free \w+ end$|^Free \w+ end$/i })).toHaveLength(2);

    await user.click(button('Undo break'));
    expect(verdict().textContent).toMatch(/This works/);
    expect((button(/^Undo$/) as HTMLButtonElement).disabled).toBe(true);
  });

  /*
   * MUTATION PROOF, run: remove the `onKeyDown` handler from the free-end
   * `<g>`. Fails with `Unable to find an accessible element with the role
   * "button" and name "Selected free peg end"`.
   */
  it('arms a free end from the keyboard, and says so in its name', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(button('Add Large curve'));
    const end = screen.getByRole('button', { name: 'Next piece attaches here, free peg end' });
    end.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Selected free peg end' })).toBeTruthy();
  });

  it('keeps Remove last repeatable, beside the one-step Undo', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(button('Circle'));
    await user.click(button('Remove last'));
    await user.click(button('Remove last'));
    const list = screen.getByText(/This layout, as a list/).closest('details')!;
    expect(within(list).getByText(/6 pieces/)).toBeTruthy();
  });

  /*
   * THE REPORTED BUG, end to end: the M switch, then a large curve, from the
   * palette. Before the auto-flip this read "Can't be built" because the E
   * went on socket-first against M's socket road.
   *
   * MUTATION PROOF, run: make `orientation` in layoutModel.ts always return
   * `{ port: 0, turn }`. Fails with `expected 'XCan’t be built. 1 joint puts
   * two end…' to match /Not a loop yet/`.
   */
  it('places an E after the M switch without a refused joint', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(button(/^Add Curved switch, peg heel/));
    await user.click(button('Add Large curve'));
    expect(verdict().textContent).toMatch(/Not a loop yet/);
    expect(verdict().textContent).not.toMatch(/Can.t be built/);
  });
});

