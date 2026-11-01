/**
 * A LINK THAT CRASHES THE SCREEN LOSES NOTHING (share plan, eng D7).
 *
 * Value: protects=a shared layout that decodes but throws while drawing shows
 * "This link couldn't be shown." with a way out, and every key in storage is
 * as it was: the app-wide crash screen, whose only exit clears the saved
 * layout, is never reached from a link
 * Value: fails_when=LinkRoute stops wrapping App in its own boundary, so the
 * throw reaches the app-wide one (or nothing)
 * Value: why_new=links are new; ErrorBoundary.tsx's tests cover the editor
 * Value: seam=`TrackCanvas.js` mocked to throw, standing in for any render
 * failure a crafted layout could cause
 * Value: no_claim=which real layouts throw; none is known
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { startReadOnlySession } from '../../engine/data/storage.js';
import { LinkRoute } from './LinkRoute.js';
import { BUILD_LINK_STORAGE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

vi.mock('./TrackCanvas.js', async (original) => ({
  ...(await original<typeof import('./TrackCanvas.js')>()),
  TrackCanvas: () => {
    throw new Error('drawing failed');
  },
}));

const STADIUM = '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw';

beforeAll(() => startReadOnlySession([BUILD_LINK_STORAGE_KEY]));

/*
 * MUTATION PROOF, run: LinkRoute returning `<App link={…} />` without
 * `<LinkBoundary>`: `Unable to find role="alert"`, the throw unhandled.
 */
it("a crash inside a link shows its own sentence and changes no key", async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const own = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
  localStorage.setItem(GRAPH_STORAGE_KEY, own);
  render(
    <StrictMode>
      <LinkRoute fragment={STADIUM} />
    </StrictMode>,
  );
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toBe("This link couldn't be shown.");
  expect(screen.getByRole('button', { name: 'Back to my layout' })).toBeTruthy();
  expect(Object.keys(localStorage)).toEqual([GRAPH_STORAGE_KEY]);
  expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(own);
});
