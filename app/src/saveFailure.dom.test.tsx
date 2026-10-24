/**
 * A SAVE THE BROWSER REFUSES IS SAID (brio-TODOS.md P1, "The three save
 * functions swallow every failure").
 *
 * Value: protects=each save returns whether storage took it; App shows a
 * notice naming what was not stored once there is something to lose; a later
 * save that succeeds takes its store off the notice; Dismiss hides it
 * Value: fails_when=a save swallows the failure again, App ignores the
 * result, the notice shows for an empty layout, or stays after storage
 * recovers
 * Value: why_new=private browsing and a full quota both made the app stop
 * saving without a word, so closing the tab lost the work
 * Value: seam=the real App in StrictMode, with jsdom's Storage made to throw
 * on write, as Safari's private mode and a full quota do
 * Value: no_claim=the rescue copy's share of the quota (still open in the
 * TODO)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveSubmissions } from '../../engine/data/library.js';
import { place } from '../test/place.js';
import { App } from './App.js';
import { saveInventory } from './inventoryModel.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { saveGraph } from './layoutStore.js';
import { saveFailureNotice } from './saveNotice.js';
import { saveTable } from './tableModel.js';

const refuseWrites = () =>
  vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
const notice = () => screen.queryByText(/^Not saved:/);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the save functions say whether storage took it', () => {
  /*
   * MUTATION PROOF, run: `saveGraph`'s catch returning true: fails with
   * `expected true to be false`.
   */
  it('false when the browser refuses, true when it does not', () => {
    expect(saveGraph(EMPTY_GRAPH)).toBe(true);
    refuseWrites();
    expect(saveGraph(EMPTY_GRAPH)).toBe(false);
    expect(saveSubmissions([])).toBe(false);
    expect(saveInventory({ A: 1 })).toBe(false);
    expect(saveTable({ widthMm: 1200, depthMm: 800 })).toBe(false);
  });

  it('the notice names every store refused, in a fixed order', () => {
    expect(saveFailureNotice(new Set())).toBeUndefined();
    expect(saveFailureNotice(new Set(['submissions', 'layout']))).toBe(
      'Not saved: this browser refused to store your layout and the parts you added. ' +
        'It stays on screen, but is lost when you close or reload this tab. ' +
        'Private browsing and a full browser storage both cause this.',
    );
    expect(saveFailureNotice(new Set(['inventory', 'table', 'layout']))).toMatch(
      /^Not saved: this browser refused to store your layout, your table size and your inventory\./,
    );
  });
});

describe('the app says so', () => {
  /*
   * MUTATION PROOFS, run:
   * - the layout effect ignoring the result (`saved('layout', true)`): fails
   *   with `expected null not to be null`.
   * - the empty-layout exemption removed (`|| graph.pieces.length === 0`
   *   dropped): fails with `expected <p class="notice-line"></p> to be
   *   null`.
   * - a success no longer clearing the flag (`if (ok) next.delete(store)`
   *   removed): fails with `expected <p class="notice-line"></p> to be
   *   null`.
   */
  it('once there is track to lose, and not after storage recovers', async () => {
    const refused = refuseWrites();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(notice()).toBeNull();

    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(notice()).not.toBeNull();
    expect(notice()!.textContent).toMatch(/refused to store your layout\. /);

    refused.mockRestore();
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(notice()).toBeNull();
  });

  /*
   * MUTATION PROOF, run: Dismiss's handler a no-op: fails with `expected
   * <p class="notice-line"></p> to be null`.
   */
  it('Dismiss hides it', async () => {
    refuseWrites();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    const box = notice()!.closest('.notice')!;
    await user.click(box.querySelector('button')!);
    expect(notice()).toBeNull();
  });
});
