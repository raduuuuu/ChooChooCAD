/**
 * OPEN IN EDITOR, FROM A SHARED LINK (share plan, design doc step 3; eng D23,
 * D27, D28, D29, D35, D72; design 11A, 18A).
 *
 * Value: protects=the friend's own layout is put aside before the link's
 * replaces it, and the tab leaves the link and reloads; a second tap writes
 * nothing more; a different layout already put aside is never replaced
 * without the question, which shows both layouts at stake (an unreadable one
 * in words, undrawn); Keep it and a full storage change no key at all
 * Value: fails_when=the guard goes (a second tap puts aside again, now the
 * link's layout over the friend's), the ask shows the wrong layouts, or a
 * declined or failed open writes anything
 * Value: why_new=a link could only be viewed and built until now
 * Value: seam=`Viewer3D.js` mocked (no WebGL in jsdom); the reload is seen
 * through jsdom's "Not implemented: navigation" report; a full storage is
 * `Storage.prototype.setItem` throwing for the put-aside key
 * Value: no_claim=the swap's own write order and roll-backs (putAside.test.ts);
 * the phone layout (CSS, checked in a browser)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode, useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { LinkRoute } from './LinkRoute.js';
import { BUILD_LINK_STORAGE_KEY, GRAPH_PREVIOUS_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: unknown }) => {
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

/** The frozen Stadium link (shareLink.frozen.test.ts): 10 pieces. */
const STADIUM = '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw';
const OWN = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
const EARLIER = JSON.stringify({
  pieces: [
    { pieceId: 'e1', partId: 'A', turn: 'left' },
    { pieceId: 'e2', partId: 'A', turn: 'left' },
  ],
  welds: [],
  anchors: [],
});

const everything = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));

// What main.tsx does before it mounts a link.
beforeAll(() => startReadOnlySession([BUILD_LINK_STORAGE_KEY]));
afterEach(() => {
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

async function openLink() {
  history.replaceState(null, '', `/${STADIUM}`);
  render(
    <StrictMode>
      <LinkRoute fragment={STADIUM} />
    </StrictMode>,
  );
  await screen.findByRole('heading', { name: 'A wooden railway · 10 pieces' });
}

describe('Open in editor', () => {
  it("puts the friend's layout aside, takes the link's, and reloads off the link (D23, D28)", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reloaded = watchReloads();
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(OWN);
    expect(JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)!).pieces).toHaveLength(10);
    expect(location.hash).toBe('');
    expect(reloaded()).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the `busy` guard removed: `expected [
   * 'action/open-in-editor', …(1) ] to have a length of 1 but got 2`, the
   * second tap counted and sent away again. (This pin used to record a
   * second question about replacing the layout; since `openInEditor` treats a
   * link already in the editor's slot as opened, that no longer happens, and
   * the deep checkup of 2026-11-15 found the pin could not fail.)
   */
  it('a second tap before the reload writes nothing more (D27)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const counted: string[] = [];
    window.goatcounter = { count: (v) => void counted.push(v.path) };
    const user = userEvent.setup();
    await openLink();
    const button = screen.getByRole('button', { name: 'Open in editor' });
    await user.click(button);
    await user.click(button);
    delete window.goatcounter;
    expect(counted.filter((p) => p.includes('open-in-editor'))).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Replace the layout you put aside last time?' })).toBe(null);
    expect(writes.mock.calls.filter((c) => c[0] === GRAPH_PREVIOUS_KEY)).toHaveLength(1);
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(OWN);
  });

  /*
   * MUTATION PROOF, run: the ask's two rows given each other's layout:
   * `expected 'Replace the layout you put aside last…' to contain 'Put aside
   * earlier (will be replaced):…'`.
   */
  it('a different layout put aside: it asks, showing both at stake (D29, D72, 11A)', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    const ask = screen.getByRole('group', { name: 'Replace the layout you put aside last time?' });
    expect(ask.textContent).toContain('Put aside earlier (will be replaced): 2 pieces');
    expect(ask.textContent).toContain('Your current layout (goes into its place): 1 piece');
    expect(ask.querySelectorAll('svg.layout-thumb')).toHaveLength(2);
    expect(document.activeElement?.textContent).toBe('Replace the layout you put aside last time?');
  });

  /*
   * "REPLACE IT" ANSWERS THE QUESTION ON SCREEN (plan 2026-11-16, O3). While
   * it is asked, another tab puts a three-piece layout aside.
   *
   * MUTATION PROOF, run: any yes accepted in `openInEditor` (`answered =
   * replace !== false`): `expected '{"pieces":[{"pieceId":"mine"…' to be
   * '{"pieces":[{"pieceId":"o1"…'`, the other tab's layout replaced unseen.
   */
  it('a yes does not replace a layout another tab put aside meanwhile: it asks again', async () => {
    const OTHER = JSON.stringify({ pieces: ['o1', 'o2', 'o3'].map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' })), welds: [], anchors: [] });
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    localStorage.setItem(GRAPH_PREVIOUS_KEY, OTHER);
    await user.click(screen.getByRole('button', { name: 'Replace it' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(OTHER);
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(OWN);
    const ask = screen.getByRole('group', { name: 'Replace the layout you put aside last time?' });
    expect(ask.textContent).toContain('Put aside earlier (will be replaced): 3 pieces');
  });

  /*
   * A LAYOUT IN NEITHER SLOT IS OFFERED AS A FILE (O2). The put-aside slot
   * takes the friend's layout, the saved slot refuses the link's, and the
   * put-aside slot then refuses the roll-back.
   *
   * MUTATION PROOF, run: `stranded` shown as the plain failure sentence:
   * `Unable to find an accessible element with the role "alert"`.
   */
  it('when a failed open cannot be undone, the layout left in neither slot can be downloaded', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    const realSet = Storage.prototype.setItem;
    let asideWrites = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === GRAPH_STORAGE_KEY || (k === GRAPH_PREVIOUS_KEY && ++asideWrites > 1)) throw new DOMException('quota', 'QuotaExceededError');
      realSet.call(this, k, v);
    });
    await user.click(screen.getByRole('button', { name: 'Replace it' }));
    expect(screen.getByRole('alert').textContent).toContain('one of your layouts is only in this tab now');
    expect(screen.getByRole('button', { name: 'Download a copy' })).toBeTruthy();
    // The friend's own layout is safe in both slots; the earlier one is the one offered.
    expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(OWN);
  });

  it('an unreadable layout put aside is named in words and not drawn (D72)', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, '{not json');
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    const ask = screen.getByRole('group', { name: 'Replace the layout you put aside last time?' });
    expect(ask.textContent).toContain("Put aside earlier (will be replaced): A layout that couldn't be read (kept exactly as saved)");
    expect(ask.querySelectorAll('svg.layout-thumb')).toHaveLength(1);
  });

  /*
   * MUTATION PROOF, run: Keep it calling `open(true)`: `Unable to find an
   * element with the text: Nothing changed. To keep both, restore your
   * earlier layout first.`, the earlier layout replaced instead.
   */
  it('Keep it changes no key and says why (D29)', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    await openLink();
    const before = everything();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByText('Nothing changed. To keep both, restore your earlier layout first.')).toBeTruthy();
    expect(everything()).toEqual(before);
  });

  it('Replace it puts the current layout aside in its place', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    await user.click(screen.getByRole('button', { name: 'Replace it' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(OWN);
    expect(location.hash).toBe('');
  });

  it('a full storage changes no key and says so; afterwards the view still writes nothing (D35)', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === GRAPH_PREVIOUS_KEY) throw new DOMException('quota', 'QuotaExceededError');
      realSet.call(this, k, v);
    });
    const user = userEvent.setup();
    await openLink();
    const before = everything();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    expect(screen.getByText("Your layout couldn't be put aside, so nothing changed.")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'See it in 3D' }));
    expect(everything()).toEqual(before);
  });

  /*
   * A PHONE HAS THE SAME EXIT (plan 2026-11-14, design DD12). It used to be
   * told to open the link on a tablet or computer, and the stylesheet hid
   * Open in editor and its ask-before-replacing step under 620px.
   *
   * MUTATION PROOFS, run:
   * - `.friend-open, .friend-ask { display: none; }` back in the 620px block:
   *   `expected '…display: none…' not to match /friend-open|friend-ask/`.
   * - the old sentence drawn again: `expected <p …> to be null`.
   */
  it('a phone is offered the same way into the editor, and is not sent elsewhere (DD12)', async () => {
    await openLink();
    expect(screen.queryByText(/on a tablet or computer/)).toBeNull();
    const css = readFileSync(join(__dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const narrow = [...css.matchAll(/@media \(max-width: 620px\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)].map((m) => m[1]!).join('\n');
    expect(narrow).toMatch(/friend-build/);
    expect(narrow).not.toMatch(/friend-open|friend-ask/);
    expect(css).not.toMatch(/needs a larger screen/);
  });
});
