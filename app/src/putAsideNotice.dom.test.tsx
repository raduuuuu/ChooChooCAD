/**
 * THE EDITOR GIVES THE PUT-ASIDE LAYOUT BACK, AND A STALE TAB STOPS SAVING
 * (share plan, design doc step 3; eng D24, D36, D37, D72; design 9A, 13A, 22A).
 *
 * Value: protects=a put-aside layout is named in the editor with its count;
 * Restore swaps the two and reloads, only when everything is saved; Discard
 * asks first and only then empties the slot; when a swap and its roll-back
 * both fail, the warning offers the exact bytes as a download; a tab whose
 * layout another tab changed stops writing its own over it
 * Value: fails_when=Discard empties the slot on the first tap, Restore runs
 * with an unsaved change, the download changes the bytes, or the stale tab
 * keeps autosaving
 * Value: why_new=the put-aside slot and cross-tab handling are new
 * Value: seam=a full storage is `Storage.prototype.setItem` throwing for
 * chosen keys; the download is seen through a stubbed `URL.createObjectURL`;
 * another tab is a dispatched `storage` event, as the browser sends one
 * Value: no_claim=the swap's write order (putAside.test.ts); opening a link
 * (openInEditor.dom.test.tsx)
 */

import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { place } from '../test/place.js';
import { App } from './App.js';
import { GRAPH_PREVIOUS_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

const OWN = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
const EARLIER = JSON.stringify({
  pieces: [
    { pieceId: 'e1', partId: 'A', turn: 'left' },
    { pieceId: 'e2', partId: 'A', turn: 'left' },
  ],
  welds: [],
  anchors: [],
});

const realSet = Storage.prototype.setItem;
/** Writes to `keys` throw from now on, as a full storage would; `after` lets that many through first. */
function fill(keys: Record<string, number>) {
  const seen: Record<string, number> = {};
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
    if (k in keys && (seen[k] = (seen[k] ?? 0) + 1) > keys[k]!) throw new DOMException('quota', 'QuotaExceededError');
    realSet.call(this, k, v);
  });
}

const openEditor = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

afterEach(() => vi.restoreAllMocks());

describe('the put-aside notice (22A)', () => {
  it('names the earlier layout, and Restore swaps the two and reloads (D24)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reloaded = watchReloads();
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    openEditor();
    expect(screen.getByText('Your earlier layout (2 pieces) is put aside.')).toBeTruthy();
    const current = localStorage.getItem(GRAPH_STORAGE_KEY);
    await user.click(screen.getByRole('button', { name: 'Restore it' }));
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(EARLIER);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(current);
    expect(reloaded()).toBe(true);
  });

  it('nothing put aside: no notice', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    openEditor();
    expect(screen.queryByRole('button', { name: 'Restore it' })).toBe(null);
  });

  /*
   * MUTATION PROOF, run: `dropSameCopy` never removing: `expected <button
   * …(1)></button> to be null`, Restore offered for a swap that changes nothing.
   */
  it('a copy that is the saved layout itself is not offered, and is emptied', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, OWN);
    openEditor();
    expect(screen.queryByRole('button', { name: 'Restore it' })).toBe(null);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(null);
  });

  it('an unreadable layout put aside is named in words (D72)', () => {
    localStorage.setItem(GRAPH_PREVIOUS_KEY, '{not json');
    openEditor();
    expect(screen.getByText("An earlier layout that couldn't be read is put aside, kept exactly as saved.")).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: Discard calling `discard` on the first tap:
   * `expected 'Nothing on the floor yet.Build a circ…' to be 'Discard the
   * put-aside layout (2 piece…'`, the slot emptied with no question.
   */
  it('Discard asks first; Keep it keeps it; Discard empties the slot (9A)', async () => {
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    openEditor();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(document.activeElement?.textContent).toBe("Discard the put-aside layout (2 pieces)? This can't be undone.");
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(EARLIER);
    expect(screen.getByText('Your earlier layout (2 pieces) is put aside.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(null);
    expect(screen.queryByText('Your earlier layout (2 pieces) is put aside.')).toBe(null);
  });

  /*
   * MUTATION PROOF, run: Restore's `disabled={!allSaved}` removed: `expected
   * false to be true // Object.is equality`, a swap and reload with the
   * unsaved layout on screen.
   */
  it('Restore waits while a change is unsaved: a reload would lose it', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    // The mount save of the one-piece layout fails, so it is not saved.
    fill({ [GRAPH_STORAGE_KEY]: 0 });
    openEditor();
    const restore = screen.getByRole('button', { name: 'Restore it' }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    expect(screen.getByText('Restore waits until your changes are saved.')).toBeTruthy();
  });

  it('a failed swap rolls back and says so; both as they were', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    openEditor();
    const current = localStorage.getItem(GRAPH_STORAGE_KEY);
    fill({ [GRAPH_STORAGE_KEY]: 0 });
    await user.click(screen.getByRole('button', { name: 'Restore it' }));
    expect(screen.getByText("Storage is full, so your layouts couldn't be swapped. Both are as they were.")).toBeTruthy();
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(current);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(EARLIER);
  });

  /*
   * MUTATION PROOF, run: the download given `JSON.stringify(JSON.parse(
   * stranded))` instead of the bytes: `expected '{"pieces":[{"pieceId":"e1","partId":"…'
   * to be '{"pieces": [{"pieceId":"e1","partId":…'`.
   */
  it('a swap AND its roll-back failing: the warning offers the exact bytes (D36, 13A)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Spaced on purpose: a download that re-serialised the layout would lose them.
    const spaced = EARLIER.replace('"pieces":', '"pieces": ');
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, spaced);
    const user = userEvent.setup();
    openEditor();
    // The put-aside slot takes the first swap write, then storage is full for both keys.
    fill({ [GRAPH_STORAGE_KEY]: 0, [GRAPH_PREVIOUS_KEY]: 1 });
    let blob: Blob | undefined;
    URL.createObjectURL = (b: Blob) => ((blob = b), 'blob:x');
    URL.revokeObjectURL = () => undefined;
    await user.click(screen.getByRole('button', { name: 'Restore it' }));
    expect(screen.getByRole('alert').textContent).toContain('Storage is full, so your previous layout is only in this tab now.');
    await user.click(screen.getByRole('button', { name: 'Download a copy' }));
    const text = await new Promise<string>((done) => {
      const r = new FileReader();
      r.onload = () => done(String(r.result));
      r.readAsText(blob!);
    });
    expect(text).toBe(spaced);
  });
});

describe('another tab changed the layout (D37)', () => {
  /*
   * MUTATION PROOF, run: the autosave without `|| staleTab`: `expected [ [
   * 'generic.graph.v1', …(1) ] ] to have a length of +0 but got 1`.
   */
  it('this tab stops saving the layout and says so', async () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    openEditor();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: GRAPH_STORAGE_KEY, storageArea: localStorage }));
    });
    expect(screen.getByText('This layout was changed in another tab. Reload to see the latest.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    writes.mockClear();
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(writes.mock.calls.filter((c) => c[0] === GRAPH_STORAGE_KEY)).toHaveLength(0);
  });

  it('another key changing is not the layout changing', () => {
    openEditor();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'generic.view.v0', storageArea: localStorage }));
    });
    expect(screen.queryByText('This layout was changed in another tab. Reload to see the latest.')).toBe(null);
  });
});
