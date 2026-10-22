/**
 * THE ROUTES TO A LOST CURSOR, DRIVEN THROUGH THE REAL APP.
 *
 * Value: protects=the next piece joins the track the user is building after
 * each interaction that used to drop the cursor: deselecting the end it sits
 * on, a join that uses the cursor's end while another stays free, and a
 * burst of palette clicks handled from one render
 * Value: fails_when=App wires a handler that reads a stale editor state, or
 * the reducer drops the cursor on a disarm or after a join with free ends
 * left
 * Value: why_new=the reducer specs in `editorReducer.test.ts` pin these by
 * constructing states and calling `reduce`, which cannot see wiring; the two
 * defects that actually shipped here were both wiring (TODOS, "Three
 * interaction routes to the cursor bug"). The fourth route, a reload, is
 * `reload.dom.test.tsx`
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=nothing about the non-closing preset route, which needs
 * synthetic input because every shipped preset closes
 *
 * THE SYMPTOM, for every route: the next piece starts a separate run, 648mm
 * away, and the verdict reads "2 separate runs of track".
 */

import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';

const verdict = () => screen.getAllByRole('status').find((el) => el.classList.contains('verdict'))!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const mount = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

describe('the next piece joins the track, whatever came before', () => {
  /*
   * ROUTE 1: select the end the next piece attaches to, then select it again
   * to deselect. Before the fix the second click cleared the attach point
   * along with the selection.
   *
   * MUTATION PROOF, run: in `editorReducer.ts`, make the disarm branch return
   * `{ ...state, cursor: null, armed: null }`. Fails with `expected '?Not a
   * loop yet. 2 separate runs of t…' to match /4 pieces/`.
   */
  it('after deselecting the end it would attach to', async () => {
    const user = userEvent.setup();
    mount();
    for (let i = 0; i < 3; i++) await place(user, button('Add Large curve'));
    await user.click(button('Next piece attaches here, free peg end'));
    await user.click(button('Selected free peg end'));
    expect(announced().textContent).toBe('Selection cleared.');

    await place(user, button('Add Large curve'));
    expect(verdict().textContent).toMatch(/4 pieces, open at both ends/);
    expect(announced().textContent).toBe(
      'Added piece 4, Large curve (E), joined to the end of piece 3.',
    );
  });

  /*
   * ROUTE 2, AS IT ACTUALLY HAPPENS IN THE APP. The TODO named "a weld that
   * consumes neither end of the cursor", and that state is not reachable from
   * the UI: selecting an end also moves the cursor there, so a join always
   * consumes the cursor's end (the reducer's state walk asserts exactly that).
   * What IS reachable, and was broken: a join that consumes the cursor while
   * other free ends remain. The cursor went null and the next piece started a
   * separate run. It now resumes on the newest free end, as Remove last and a
   * reload do.
   *
   * The L switch gives three free ends: heel, curved road and, after an E on
   * the straight road, the E's far end. Joining the heel to the curved road
   * leaves the E's end free.
   *
   * MUTATION PROOF, run: in the join branch of `clickPort`, drop `??
   * resumeCursor(graph, ports)`. Fails with `expected 'Added piece 3, Large
   * curve (E), start…' to be 'Added piece 3, Large curve (E), joine…'`: the
   * piece started a new run.
   */
  it('after a join that used up the attach point, with a free end left', async () => {
    const user = userEvent.setup();
    mount();
    await place(user, button(/^Add Curved switch\. Unverified/));
    await place(user, button('Add Large curve'));
    await user.click(document.querySelector('details.graph-listing summary') as HTMLElement);
    await user.click(button('Heel of piece 1, a socket'));
    await user.click(button('Curved road of piece 1, a peg'));
    expect(announced().textContent).toBe(
      'Joined the heel of piece 1 to the curved road of piece 1.',
    );

    await place(user, button('Add Large curve'));
    expect(announced().textContent).toBe(
      'Added piece 3, Large curve (E), joined to the end of piece 2.',
    );
  });

  /*
   * ROUTE 3, THE FIRST SHIPPED DEFECT: eight palette clicks built eight runs,
   * because each handler read the selection from its render closure and saw
   * the same stale value eight times. User-event waits for a render between
   * clicks, which hides exactly this, so the eight are dispatched inside ONE
   * act: every handler comes from the same render.
   *
   * NOW DOUBLE-CLICKS (eng decision D4, the second listed change). A single
   * click only picks a piece since decision R3, and Place cannot be pressed
   * eight times from one render because its button appears only after one;
   * the direct placement (decision 9A) is the path that dispatches eight
   * edits from one render. And eight large curves now CLOSE by themselves
   * (decision D13, the first listed change), so the verdict reads a loop.
   *
   * MUTATION PROOF, run: in App.tsx's `dispatch`, replace the functional
   * updater's `reduce(e, ...)` with `reduce(editor, ...)`, the closure read.
   * Fails with `expected '?Not a loop yet. 1 piece, open at bot…' to match
   * /This works/`: every placement reduced the same stale state, so the eight
   * collapsed into one piece.
   */
  it('after eight placements handled from one render', () => {
    mount();
    const add = button('Add Large curve');
    act(() => {
      for (let i = 0; i < 8; i++) fireEvent.doubleClick(add);
    });
    expect(verdict().textContent).toMatch(/This works/);
    expect(screen.getByText(/This layout, as a list/).textContent).toMatch(/8 pieces, 8 joints/);
  });
});
