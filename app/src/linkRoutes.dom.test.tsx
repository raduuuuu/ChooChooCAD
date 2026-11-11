/**
 * A LINK SCREEN THAT NEVER ARRIVES SAYS SO, AND A PASTED LINK OPENS (eng
 * review 2026-11-11, R1 and R2; contributor-brief plan).
 *
 * Value: protects=a shared layout or piece preview whose lazy chunk fails to
 * download shows "This link couldn't be shown.", Reload and the way out, not a
 * blank page; a new address pasted into a link screen's tab reloads into it
 * Value: fails_when=main.tsx's link routes lose LinkRouteShell's boundary, or
 * its hashchange listener goes (the old piece stays under the new link)
 * Value: why_new=previewCrash.dom and linkCrash.dom cover a screen that
 * arrived and crashed; nothing covered one that never arrived, or a paste
 * Value: seam=both route modules mocked to fail on import, standing in for a
 * chunk the network or a deploy lost; jsdom's reload report (test/reloads.ts)
 * Value: no_claim=a real browser's failed chunk fetch, or its same-document
 * navigation on a pasted fragment
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { watchReloads } from '../test/reloads.js';
import { linkScreen } from './linkRoutes.js';

vi.mock('./LinkRoute.js', () => {
  throw new Error('chunk failed to load');
});
vi.mock('./PreviewRoute.js', () => {
  throw new Error('chunk failed to load');
});

afterEach(() => history.replaceState(null, '', '/'));

/*
 * MUTATION PROOF, run: linkScreen without LinkRouteShell's boundary (its
 * children in a bare Suspense): `Unable to find an element with the text:
 * This link couldn't be shown.`, the layout route first.
 */
it.each(['layout', 'piece'] as const)("a %s screen that fails to download says so, with Reload and the way out", async (route) => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reloaded = watchReloads();
  render(<StrictMode>{linkScreen(route, route === 'piece' ? '#p1.abc' : '#v1.abc')}</StrictMode>);
  expect(await screen.findByText("This link couldn't be shown.")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start your own' })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));
  expect(reloaded()).toBe(true);
  errors.mockRestore();
});

/*
 * MUTATION PROOF, run: LinkRouteShell's hashchange listener removed:
 * `expected false to be true // Object.is equality`.
 */
it('a new link pasted into the tab reloads into it', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const reloaded = watchReloads();
  render(<StrictMode>{linkScreen('piece', '#p1.abc')}</StrictMode>);
  await screen.findByText("This link couldn't be shown.");
  expect(reloaded()).toBe(false);
  location.hash = '#p1.another';
  await waitFor(() => expect(reloaded()).toBe(true));
  vi.restoreAllMocks();
});
