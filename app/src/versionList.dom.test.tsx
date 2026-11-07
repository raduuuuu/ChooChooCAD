/**
 * THE VERSION LIST THROUGH THE REAL APP (design review 2026-11-04, D3-D7;
 * built with the metro pieces, the first third version of one piece).
 *
 * Value: protects=a piece with three or more versions shows one "Make it…"
 * instead of a button each; the list holds the whole family, plain first,
 * the current one marked "now"; a version the swap would refuse is greyed
 * with its reason and cannot be picked; focus goes to the first pickable
 * row, arrows walk the rows, Escape closes and returns focus; a pick swaps,
 * says so, and closes the list
 * Value: fails_when=the strip keeps a button per version, the family is out
 * of order or misses the current piece, a blocked row is offered, or focus
 * is lost on open or close
 * Value: why_new=no piece had three versions before (the tripwire it
 * replaces, versionListTripwire.test.ts, is retired)
 * Value: seam=jsdom plus user-event, App mounted in StrictMode on a saved
 * layout
 * Value: no_claim=how the list looks (the browser pass), and the swap's own
 * refusal check (structuresApp.test.ts)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const announced = () => screen.getAllByRole('status').find((el) => el.classList.contains('sr-only'))!;
const strip = () => screen.getByRole('group', { name: 'Selected piece' });
const list = () => within(strip()).queryByRole('group', { name: 'Versions' });
/** Each row as read: a pickable one as its name, the rest as their text. */
const rows = () => [...(list()?.children ?? [])].map((el) => (el.tagName === 'BUTTON' ? `[${el.textContent}]` : el.textContent));

/** A long straight at the origin; with `neighbour`, a medium straight 100 to its right, where the metro station's building would stand. */
function mount(neighbour: boolean) {
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: [{ pieceId: 'd', partId: 'D', turn: 'left' }, ...(neighbour ? [{ pieceId: 'a', partId: 'A', turn: 'left' }] : [])],
      welds: [],
      anchors: [
        ['d', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0 }],
        ...(neighbour ? [['a', { pos: [36, 0, 0, 0, -100, 0, 0, 0], heading: 0 }]] : []),
      ],
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return userEvent.setup();
}

describe('the version list', () => {
  /*
   * MUTATION PROOFS, run:
   * - `LIST_FROM` raised to 4 (a button each again): `expected [
   *   <button></button>, …(2) ] to deeply equal []`.
   * - `familyOf` leaving out the piece itself: `expected [ '[Tunnel
   *   straight]', …(2) ] to deeply equal [ 'Long straight now', …(3) ]`.
   */
  it('a long straight offers its family in one list, plain first and marked now; arrows walk it, Escape closes it', async () => {
    const user = mount(false);
    await user.click(button(/^Piece 1: Long straight/));
    expect(within(strip()).queryAllByRole('button', { name: /^Make it a / })).toEqual([]);
    const makeIt = within(strip()).getByRole('button', { name: 'Make it…' });
    expect(makeIt.getAttribute('aria-expanded')).toBe('false');
    await user.click(makeIt);
    expect(makeIt.getAttribute('aria-expanded')).toBe('true');
    expect(rows()).toEqual(['Long straight now', '[Tunnel straight]', '[Metro tunnel]', '[Metro station]']);
    expect(document.activeElement?.textContent).toBe('Tunnel straight');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Metro tunnel');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('Metro station');
    await user.keyboard('{Escape}');
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(makeIt);
  });

  /*
   * MUTATION PROOF, run: the pick not closing the list itself (no `close`;
   * the layout's change still closes it, so focus is lost): `expected
   * 'ChooChooCADwooden railway layoutsPiec…' to be 'Make it…'`.
   */
  it('a pick swaps the piece, says so, and closes the list; reopened, the new version is now', async () => {
    const user = mount(false);
    await user.click(button(/^Piece 1: Long straight/));
    await user.click(within(strip()).getByRole('button', { name: 'Make it…' }));
    await user.click(within(list()!).getByRole('button', { name: 'Metro station' }));
    expect(announced().textContent).toBe('Piece 1 is now a Metro station.');
    expect(list()).toBeNull();
    expect(document.activeElement?.textContent).toBe('Make it…');
    await user.click(within(strip()).getByRole('button', { name: 'Make it…' }));
    expect(rows()).toEqual(['[Long straight]', '[Tunnel straight]', '[Metro tunnel]', 'Metro station now']);
  });

  /*
   * MUTATION PROOF, run: rows never checked (`blocked: null`): `expected
   * '[Metro station]' to match /^Metro station, unavailable: its \w+ …/`.
   */
  it('a version that would sit on other track is greyed with its reason, and not a button', async () => {
    const user = mount(true);
    await user.click(button(/^Piece 1: Long straight/));
    await user.click(within(strip()).getByRole('button', { name: 'Make it…' }));
    const r = rows();
    expect(r.slice(0, 3)).toEqual(['Long straight now', '[Tunnel straight]', '[Metro tunnel]']);
    expect(r[3]).toMatch(/^Metro station, unavailable: its \w+ would sit on piece 2$/);
    expect(within(list()!).queryByRole('button', { name: 'Metro station' })).toBeNull();
  });
});
