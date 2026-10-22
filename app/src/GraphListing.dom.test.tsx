/**
 * THE EDITING JOURNEY, KEYBOARD ONLY, THROUGH THE LIST (task U7b).
 *
 * Value: protects=a keyboard and screen reader user can build a loop, close
 * it by joining two named ends, break a joint and undo, using the list, with
 * every action announced and focus never dropped to the page body
 * Value: fails_when=a list control stops activating, an action goes
 * unannounced, focus is lost when the focused control disappears, or focus is
 * pulled back into the list after the user has left it
 * Value: why_new=U7a built the list read-only; U7b makes it operable, and
 * this is the "storyboard completes with the keyboard alone" verify, adapted
 * to the editor as it exists (the plan's step 6 was the ramp, cut with
 * elevation)
 * Value: seam=jsdom plus user-event in the `dom` project; keypresses only,
 * with `.focus()` standing in for the arrow and Tab keys a screen reader user
 * would move with
 * Value: no_claim=nothing about what a given screen reader speaks or when;
 * jsdom has no speech, so the live region's TEXT is asserted. Opening the
 * list is a click, not a key, because of a jsdom gap described at `openList`
 */

import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const listing = () => document.querySelector('details.graph-listing') as HTMLDetailsElement;

async function press(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
  el.focus();
  await user.keyboard('{Enter}');
}

/*
 * THE ONE CLICK IN THESE SPECS, and it is jsdom's gap, not the app's. Browsers
 * open a `<details>` when its summary gets Enter or Space; jsdom 30 opens it on
 * a click only (measured: Enter left `open` false, a click set it true). So
 * the list is opened with a click, and every editing step after it is a
 * keypress.
 */
async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(listing().querySelector('summary')!);
}

describe('the list, operated from the keyboard', () => {
  /*
   * MUTATION PROOF, run: empty the `useLayoutEffect` in `GraphListing.tsx`.
   * Fails with `expected <body><div>…(1)</div></body> to be <button
   * type="button" …(1)></button>`: after the join removed the focused button,
   * focus fell to the page body.
   */
  it('builds, closes, breaks and restores a loop, announcing each step and keeping focus', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    for (let i = 0; i < 8; i++) await press(user, button('Add Large curve'));
    expect(announced().textContent).toBe(
      'Added piece 8, Large curve (E), joined to the end of piece 7.',
    );
    expect(verdict().textContent).toMatch(/Not a loop yet/);

    await openList(user);
    expect(listing().open).toBe(true);

    await press(user, button('End of piece 8, a peg'));
    expect(announced().textContent).toBe(
      'Selected the end of piece 8. Choose another free end to join it to.',
    );

    await press(user, button('Start of piece 1, a socket'));
    expect(announced().textContent).toBe('Joined the end of piece 8 to the start of piece 1.');
    expect(verdict().textContent).toMatch(/This works/);
    // The joined ends' buttons are gone; focus moved to a control still in
    // the list rather than falling to the body.
    expect(document.activeElement).toBe(listing().querySelector('li button'));

    await press(user, button(/^Break Joint 3:/));
    expect(announced().textContent).toBe(
      'Broke the joint between the end of piece 3 and the start of piece 4.',
    );
    expect(verdict().textContent).toMatch(/Not a loop yet/);
    expect(listing().contains(document.activeElement)).toBe(true);

    await press(user, button('Undo break'));
    expect(announced().textContent).toBe('Undid the break. The joint is back.');
    expect(verdict().textContent).toMatch(/This works/);
  });

  /*
   * Focus order is reading order: native buttons, no tabindex.
   *
   * MUTATION PROOF, run: give the Break button `tabIndex={-1}`. Fails with
   * `expected null to be 'Break Joint 1: end of piece 1 to star…'`: Tab
   * skipped the joint's control.
   */
  it('tabs through the list in reading order', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    for (let i = 0; i < 2; i++) await press(user, button('Add Large curve'));
    await openList(user);
    const first = listing().querySelector('li button') as HTMLElement;
    first.focus();
    await user.tab();
    expect((document.activeElement as HTMLElement).textContent).toBe('End of piece 2, a peg');
    await user.tab();
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe(
      'Break Joint 1: end of piece 1 to start of piece 2',
    );
  });

  /*
   * The repair must not fight the user. Clicking somewhere that takes no focus
   * leaves focus on the page body with the list's flag still set; a later
   * action must not drag focus back into the list.
   *
   * MUTATION PROOF, run: delete `if (left.isConnected) focusInside.current =
   * false;` from the blur handler. Fails with `expected <button type="button"
   * …(1)></button> to be <body><div>…(1)</div></body>`: the next action yanked
   * focus into the list.
   */
  it('leaves focus alone once the user has clicked away from the list', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    for (let i = 0; i < 2; i++) await press(user, button('Add Large curve'));
    await openList(user);
    (listing().querySelector('li button') as HTMLElement).focus();
    // Focus leaves for nothing, as a click on blank page does.
    act(() => (document.activeElement as HTMLElement).blur());
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(document.body);
    // An action that does not itself move focus: HTMLElement.click().
    act(() => button('Add Large curve').click());
    expect(document.activeElement).toBe(document.body);
  });
});
