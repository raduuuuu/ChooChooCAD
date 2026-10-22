/**
 * EACH ACTION RELEASES ITS OWN STORE'S SAVE, AND NO OTHER.
 *
 * Value: protects=a store that loaded with losses keeps its stored bytes
 * until the user acts on THAT store. A graph edit writes only the graph, an
 * inventory change only the inventory, a submission only the submissions; and
 * a layout whose refused bytes could not be copied aside is not overwritten by
 * an edit at all
 * Value: fails_when=one action sets another store's acknowledgement flag, two
 * flags alias one value, a gate is handed a literal or the wrong variable, or
 * a save effect consults the wrong gate or none
 * Value: why_new=this replaces the source-text describe "the suppression
 * wiring is present in App.tsx" in `layoutStore.test.ts`, which sliced
 * App.tsx by string offsets and needed a fresh measured patch each time a
 * mutation slipped past it. The rule itself, `savesSuppressed`, stays pinned
 * there as a pure function; this pins the wiring by its effect on storage
 * Value: seam=jsdom plus user-event, App mounted in StrictMode, storage seeded
 * before mount and read back as raw strings
 * Value: no_claim=nothing about the notice banners' wording or the Dismiss
 * route
 *
 * THE MEASURED BUG this exists for: one global "user has acted" flag let a
 * palette click, a GRAPH edit, release the submissions save, and the effect
 * wrote the survivors over a blob holding a row it could not read. That row
 * was a caliper measurement with no rescue copy.
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { App } from './App.js';
import { GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY, INVENTORY_STORAGE_KEY } from './storageKeys.js';

/*
 * All three blobs load with a loss, so all three stores open with a notice
 * and a held save. The graph keeps its one piece and loses its anchor (a
 * heading of 400 is off the lattice), which leaves a piece on the canvas, so
 * "Your box" and "Add a part" are offered without a graph edit first. The
 * submissions row `5` is not an object; the inventory count for `ZZZ` names
 * no part.
 */
const GRAPH = JSON.stringify({
  pieces: [{ pieceId: 'a', partId: 'E' }],
  welds: [],
  anchors: [['a', { pos: [1, 0, 0, 0, 0, 0, 0, 0], heading: 400 }]],
});
const SUBMISSIONS = '[5]';
const INVENTORY = '{"A":2,"ZZZ":1}';
const SEEDED = { graph: GRAPH, submissions: SUBMISSIONS, inventory: INVENTORY };

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const stored = () => ({
  graph: localStorage.getItem(GRAPH_STORAGE_KEY),
  submissions: localStorage.getItem(SUBMISSIONS_STORAGE_KEY),
  inventory: localStorage.getItem(INVENTORY_STORAGE_KEY),
});
const storedPieces = () =>
  (JSON.parse(stored().graph!) as { pieces: unknown[] }).pieces.length;

function mount() {
  localStorage.setItem(GRAPH_STORAGE_KEY, GRAPH);
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, SUBMISSIONS);
  localStorage.setItem(INVENTORY_STORAGE_KEY, INVENTORY);
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Mounting alone writes nothing: every gate starts closed.
  expect(stored(), 'a save ran at mount').toEqual(SEEDED);
}

afterEach(() => {
  vi.restoreAllMocks();
});

/*
 * MUTATION PROOFS, all run against App.tsx, each failing where it says. Any
 * mutation that opens a gate at mount fails all four specs at `mount()` with
 * `a save ran at mount: expected { …(3) } to deeply equal { …(3) }`. That
 * covers deleting any of the three `if (...SaveBlocked) return;` guards, and
 * passing `notice: undefined` to any of the three gates.
 */
describe('an action releases the save of the store it touched, and no other', () => {
  /*
   * - `dispatch` also calls `setSubmissionsActed(true)`: `expected '[]' to be
   *   '[5]'`, the measured bug.
   * - `dispatch` also calls `setInventoryActed(true)`: `expected '{"A":2}' to
   *   be '{"A":2,"ZZZ":1}'`.
   * - `setGraphActed(true)` deleted from `dispatch`, or the graph gate handed
   *   `userHasActed: false`: `expected 1 to be 2`, the edit never saved.
   * - the submissions gate handed `userHasActed: graphActed`: `expected '[]'
   *   to be '[5]'` (and the submission spec fails too).
   */
  it('a graph edit writes the graph and neither other blob', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(button(/^Add Large curve\b/));

    expect(storedPieces()).toBe(2);
    expect(stored().submissions).toBe(SUBMISSIONS);
    expect(stored().inventory).toBe(INVENTORY);
  });

  /*
   * - the inventory `onChange` also calls `setSubmissionsActed(true)`:
   *   `expected '[]' to be '[5]'`.
   * - it also calls `setGraphActed(true)`: `expected '{"pieces":[{"pieceId":
   *   "a","partId":"E…' to be '{"pieces":[{"pieceId":"a","partId":"E…'`.
   * - `const inventoryActed = submissionsActed; const setInventoryActed =
   *   setSubmissionsActed;` in place of its own `useState`, one flag under
   *   two names: `expected '[]' to be '[5]'`, and the submission spec fails
   *   with `expected '{"A":2}' to be '{"A":2,"ZZZ":1}'`.
   * - the inventory effect checks `submissionsSaveBlocked`, the gate is handed
   *   `userHasActed: false`, or it is handed `noRescueCopy: true`: `expected {
   *   A: 2, ZZZ: 1 } to deeply equal { A: 2, E: 3 }`, the user's own change
   *   never saved.
   */
  it('an inventory change writes the inventory and neither other blob', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(button('Your box'));
    const count = screen.getByLabelText('How many Large curve you own');
    await user.clear(count);
    await user.type(count, '3');

    expect(JSON.parse(stored().inventory!)).toEqual({ A: 2, E: 3 });
    expect(stored().submissions).toBe(SUBMISSIONS);
    expect(stored().graph).toBe(GRAPH);
  });

  /*
   * - the submit callback also calls `setInventoryActed(true)`: `expected
   *   '{"A":2}' to be '{"A":2,"ZZZ":1}'`.
   * - it also calls `setGraphActed(true)`: `expected '{"pieces":[{"pieceId":
   *   "a","partId":"E…' to be '{"pieces":[{"pieceId":"a","partId":"E…'`.
   * - the submissions gate handed `userHasActed: false`: `the submission was
   *   not saved: expected '[5]' not to be '[5]'`.
   */
  it('a submission writes the submissions and neither other blob', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(button('Add a part'));
    await user.type(screen.getByLabelText('Name'), 'long straight');
    await user.type(screen.getByLabelText('Length, mm'), '200');
    await user.click(button('Add to the library'));

    expect(stored().submissions, 'the submission was not saved').not.toBe(SUBMISSIONS);
    const subs = JSON.parse(stored().submissions!) as { part: { name: string } }[];
    expect(subs.map((s) => s.part.name)).toEqual(['long straight']);
    expect(stored().inventory).toBe(INVENTORY);
    expect(stored().graph).toBe(GRAPH);
  });

  /*
   * THE GRAPH-ONLY EXCEPTION. When the refused bytes could not be copied to
   * the rescue key (a full quota, private browsing), the live key is the only
   * copy, so an edit is not enough to release the save; only Dismiss is.
   *
   * MUTATION PROOF, run: delete `noRescueCopy: !graphLoad.rescued,` from the
   * graph gate. Fails with `expected '{"pieces":[{"pieceId":"a","partId":"E…'
   * to be '{"pieces":[{"pieceId":"a","partId":"E…'`: the edit overwrote the
   * only copy of the refused layout.
   */
  it('a graph edit does not overwrite a layout that has no rescue copy', async () => {
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === GRAPH_RESCUE_KEY) throw new Error('QuotaExceededError');
      setItem.call(this, key, value);
    });
    const user = userEvent.setup();
    mount();
    expect(localStorage.getItem(GRAPH_RESCUE_KEY)).toBeNull();
    await user.click(button(/^Add Large curve\b/));

    expect(stored().graph).toBe(GRAPH);
  });
});
