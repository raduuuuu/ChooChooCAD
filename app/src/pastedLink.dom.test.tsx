/**
 * A LINK PASTED INTO AN OPEN EDITOR (share plan, eng D8, D15, D34).
 *
 * Value: protects=with everything saved, a `#v…` arriving in an open tab
 * reloads into the link route; with a save held back, it does not reload, the
 * address goes back, and one sentence says why
 * Value: fails_when=the gate reads only failed saves (a held-back save fails
 * nothing), or the editor ignores the new hash
 * Value: why_new=pasting a link into an open tab never reloads by itself
 * Value: seam=none; a held-back save is a real one (a stored layout the
 * loader refused, whose notice nobody has read), and the reload is seen
 * through jsdom's "Not implemented: navigation" report
 * Value: no_claim=what happens after the reload (friendScreen.dom.test.tsx)
 */

import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

afterEach(() => {
  vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

const paste = (hash: string) =>
  act(() => {
    const oldURL = location.href;
    history.replaceState(null, '', `/${hash}`);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
  });

it('everything saved: the tab reloads into the link (D8)', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reloaded = watchReloads();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  paste('#v1.abc');
  expect(reloaded()).toBe(true);
});

/*
 * MUTATION PROOF, run: the gate reading `unsaved.size === 0` alone (the
 * pre-D34 rule): `expected true to be false // Object.is equality`, a reload
 * with a held-back save.
 */
it('a save held back: no reload, the address goes back, and it says so (D15, D34)', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reloaded = watchReloads();
  // A stored layout the loader refuses: its notice is unread, so the graph save is held back.
  localStorage.setItem(GRAPH_STORAGE_KEY, '{not json');
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  paste('#v1.abc');
  expect(reloaded()).toBe(false);
  expect(location.hash).toBe('');
  expect(screen.getByText("Your last changes couldn't be saved, so the link wasn't opened. Your changes are still here.")).toBeTruthy();
});

it('an ordinary hash is not a link and changes nothing', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reloaded = watchReloads();
  render(<App />);
  paste('#notes');
  expect(reloaded()).toBe(false);
});
