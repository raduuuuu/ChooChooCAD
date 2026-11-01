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

import { StrictMode, useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
const reloaded = (calls: unknown[][]) => calls.some((c) => String(c[0]).includes('Not implemented: navigation'));

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
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const user = userEvent.setup();
    await openLink();
    await user.click(screen.getByRole('button', { name: 'Open in editor' }));
    expect(localStorage.getItem(GRAPH_PREVIOUS_KEY)).toBe(OWN);
    expect(JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)!).pieces).toHaveLength(10);
    expect(location.hash).toBe('');
    expect(reloaded(errors.mock.calls)).toBe(true);
  });

  /*
   * MUTATION PROOF, run: the `busy` guard removed: `expected <div
   * class="friend-ask" …(2)>…(3)</div> to be null`, a second question about
   * replacing what the first tap had just put aside.
   */
  it('a second tap before the reload writes nothing more (D27)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    await openLink();
    const button = screen.getByRole('button', { name: 'Open in editor' });
    await user.click(button);
    await user.click(button);
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

  it('a phone is told where to change it (18A)', async () => {
    await openLink();
    expect(screen.getByText('Open this link on a tablet or computer to change it.')).toBeTruthy();
  });
});
