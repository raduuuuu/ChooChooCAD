/**
 * THE TABLE OUTLINE IN THE APP (backlog E4, owner ruling 2026-10-23).
 *
 * Value: protects=entering a table size draws its outline under the track and
 * says in words whether the track fits; the size survives a reload; Remove
 * table deletes it; and a stored size that could not be read is not
 * overwritten until the user acts on the table
 * Value: fails_when=the panel never reaches the canvas, the size is not
 * saved, or the table's save runs at mount over a blob its notice describes
 * Value: why_new=a fourth persisted store, with its own gate (see
 * suppression.dom.test.tsx for the other three)
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=where the outline lands in pixels; jsdom has no layout.
 * tableModel.test.ts owns the arithmetic
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY, TABLE_STORAGE_KEY } from './storageKeys.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const outline = () => document.querySelector('rect.table-outline');
const caption = () => document.querySelector('.table-caption')?.textContent ?? null;

function mount() {
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

async function oneStraight(): Promise<{ user: UserEvent; unmount: () => void }> {
  const user = userEvent.setup();
  const { unmount } = mount();
  await place(user, button(/^Add Medium straight$/));
  return { user, unmount };
}

async function enterTable(user: UserEvent, width: string, depth: string) {
  await user.click(button('Your table'));
  const panel = screen.getByRole('region', { name: 'Your table' });
  const w = within(panel).getByRole('spinbutton', { name: 'Table width in centimetres' });
  const d = within(panel).getByRole('spinbutton', { name: 'Table depth in centimetres' });
  await user.clear(w);
  await user.type(w, width);
  await user.clear(d);
  await user.type(d, depth);
  return panel;
}

describe('a table size draws an outline and a fit sentence', () => {
  /*
   * MUTATION PROOFS, run:
   * - `table={tableView}` not passed to TrackCanvas: three specs fail, the
   *   first with `expected null to be 'Fits your 120 × 80 cm table: the
   *   trac…'`.
   * - `saveTable(table)` deleted from the table's save effect: the first and
   *   reload specs fail with `expected null to be
   *   '{"widthMm":1200,"depthMm":800}'`, and the gate spec below with
   *   `expected '{' to be …`.
   */
  it('a medium straight fits a 120 x 80 table, and the size is saved', async () => {
    const { user } = await oneStraight();
    await enterTable(user, '120', '80');
    // 144 x 40 mm of wood, rounded up to whole centimetres.
    expect(caption()).toBe('Fits your 120 × 80 cm table: the track is 15 × 4 cm.');
    expect(outline()?.getAttribute('class')).toBe('table-outline');
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).toBe('{"widthMm":1200,"depthMm":800}');
  });

  it('a table smaller than the track says by how much, and turns the outline red', async () => {
    const { user } = await oneStraight();
    await enterTable(user, '12', '10');
    expect(caption()).toBe('Too big for your 12 × 10 cm table: the track is 15 × 4 cm, 3 cm over its 12 cm side.');
    expect(outline()?.getAttribute('class')).toBe('table-outline is-over');
  });

  it('a side under 10 cm is refused in the field, not stored', async () => {
    const { user } = await oneStraight();
    const panel = await enterTable(user, '120', '5');
    expect(within(panel).getByRole('spinbutton', { name: 'Table depth in centimetres' }).getAttribute('aria-invalid')).toBe('true');
    expect(within(panel).getByText('10 to 2000 cm')).toBeTruthy();
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).toBeNull();
    expect(outline()).toBeNull();
  });

  it('survives a reload, and Remove table deletes it', async () => {
    const { user, unmount } = await oneStraight();
    await enterTable(user, '120', '80');
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).toBe('{"widthMm":1200,"depthMm":800}');
    // Unmount and mount again over the same storage, as a reload does.
    unmount();
    const again = userEvent.setup();
    mount();
    expect(caption()).toBe('Fits your 120 × 80 cm table: the track is 15 × 4 cm.');
    await again.click(button('Your table'));
    await again.click(button('Remove table'));
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).toBeNull();
    expect(outline()).toBeNull();
    expect(caption()).toBeNull();
  });
});

describe("an unreadable stored table is kept until the user acts on the table", () => {
  /*
   * MUTATION PROOFS, run against App.tsx:
   * - `if (tableSaveBlocked) return;` deleted: `a save ran at mount: expected
   *   null to be '{'`, `saveTable(null)` having removed the key.
   * - `setTableActed(true)` dropped from the panel's onChange: the last
   *   assertion fails with `expected '{' to be '{"widthMm":1200,"depthMm":800}'`.
   */
  it('mount and a graph edit leave the blob alone; entering a size replaces it', async () => {
    localStorage.setItem(TABLE_STORAGE_KEY, '{');
    const user = userEvent.setup();
    mount();
    expect(localStorage.getItem(TABLE_STORAGE_KEY), 'a save ran at mount').toBe('{');
    expect(
      screen.getByText('Your saved table size could not be read, so the table outline was removed.'),
    ).toBeTruthy();

    await place(user, button(/^Add Medium straight$/));
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(TABLE_STORAGE_KEY), 'a graph edit released the table').toBe('{');

    await enterTable(user, '120', '80');
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).toBe('{"widthMm":1200,"depthMm":800}');
  });
});
