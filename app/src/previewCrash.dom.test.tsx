/**
 * A PIECE PREVIEW THAT CRASHES LOSES NOTHING (contributor-brief T4, the state
 * table's last row; share plan eng D7).
 *
 * Value: protects=a piece that decodes but throws while drawing shows the
 * shared link's crash sentence with the way out, and every key is as it was
 * Value: fails_when=PreviewRoute stops wrapping the screen in LinkBoundary
 * Value: why_new=the preview route is new; linkCrash.dom.test.tsx covers layouts
 * Value: seam=`TrackCanvas.js` mocked to throw, standing in for any render
 * failure a crafted piece could cause
 * Value: no_claim=which real pieces throw; none is known
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { encodePreview } from '../../engine/data/previewLink.js';
import { asSubmission } from '../../engine/test/submissions.js';
import { PreviewRoute } from './PreviewRoute.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

vi.mock('./TrackCanvas.js', async (original) => ({
  ...(await original<typeof import('./TrackCanvas.js')>()),
  TrackCanvas: () => {
    throw new Error('drawing failed');
  },
}));

/*
 * MUTATION PROOF, run: PreviewRoute returning `<PreviewScreen … />` without
 * `<LinkBoundary>`: `Unable to find role="alert"`, and `Error: drawing failed`
 * unhandled.
 */
it('a crash inside a piece preview shows the shared-link crash sentence and changes no key', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const own = JSON.stringify({ pieces: [{ pieceId: 'mine', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
  localStorage.setItem(GRAPH_STORAGE_KEY, own);
  const packed = await encodePreview(asSubmission(makeResolver(BUILT_IN)('A'), 'A9'));
  if (!packed.ok) throw new Error('the fixture should pack');
  render(
    <StrictMode>
      <PreviewRoute fragment={packed.fragment} />
    </StrictMode>,
  );
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toBe("This link couldn't be shown.");
  expect(screen.getByRole('button', { name: 'Back to my layout' })).toBeTruthy();
  expect(Object.keys(localStorage)).toEqual([GRAPH_STORAGE_KEY]);
  expect(localStorage.getItem(GRAPH_STORAGE_KEY)).toBe(own);
});
