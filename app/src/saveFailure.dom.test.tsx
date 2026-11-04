/**
 * A SAVE THE BROWSER REFUSES IS SAID (generic-TODOS.md P1, "The three save
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
 * Value: no_claim=that a real browser's quota is what refused; that the
 * download reached the disk (the file is seen as the Blob handed to it)
 *
 * THE RESCUE COPY (P2, "The rescue copy can fail on a full storage"): while a
 * save fails and a rescue copy is stored, the notice offers it as a download,
 * then, and only then, offers to remove it, and the saves run again.
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
import { rescueCopyLine, saveFailureNotice } from './saveNotice.js';
import { GRAPH_RESCUE_KEY } from './storageKeys.js';
import { saveTable } from './tableModel.js';

const refuseWrites = () =>
  vi.spyOn(Object.getPrototypeOf(localStorage) as Storage, 'setItem').mockImplementation(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  });
const notice = () => screen.queryByText(/^Not saved:/);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
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

describe('the rescue copy, while a save fails', () => {
  /*
   * MUTATION PROOFS, run:
   * - Remove shown before Download (`rescueDownloaded &&` dropped): fails with
   *   `expected <button …(1)></button> to be null`.
   * - Remove not re-running the saves (`setSaveRetry` call dropped): fails with
   *   `expected <p class="notice-line"></p> to be null`.
   * - the download given `JSON.stringify(JSON.parse(old))`: fails with
   *   `expected '{"pieces":[],"welds":0}' to be '{"pieces": [], "welds": 0}'`.
   */
  it('is offered as a file first, then removed, and the saves run again', async () => {
    // Spaced on purpose: a download that re-serialised the bytes would lose them.
    const old = '{"pieces": [], "welds": 0}';
    localStorage.setItem(GRAPH_RESCUE_KEY, old);
    // Full while the rescue copy is there, as a copy filling the quota would be.
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (localStorage.getItem(GRAPH_RESCUE_KEY) !== null) throw new DOMException('quota', 'QuotaExceededError');
      realSet.call(this, k, v);
    });
    let blob: Blob | undefined;
    URL.createObjectURL = (b: Blob) => ((blob = b), 'blob:x');
    URL.revokeObjectURL = () => undefined;
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(screen.getByText(rescueCopyLine(old.length))).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove it' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Download it' }));
    const text = await new Promise<string>((done) => {
      const r = new FileReader();
      r.onload = () => done(String(r.result));
      r.readAsText(blob!);
    });
    expect(text).toBe(old);
    expect(localStorage.getItem(GRAPH_RESCUE_KEY)).toBe(old);

    await user.click(screen.getByRole('button', { name: 'Remove it' }));
    expect(localStorage.getItem(GRAPH_RESCUE_KEY)).toBeNull();
    expect(notice()).toBeNull();
  });

  it('is not mentioned when there is none, and its size is never 0 KB', async () => {
    refuseWrites();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(notice()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Download it' })).toBeNull();
    expect(rescueCopyLine(10)).toMatch(/\(1 KB\)/);
    expect(rescueCopyLine(2_500_000)).toMatch(/\(2442 KB\)/);
  });
});
