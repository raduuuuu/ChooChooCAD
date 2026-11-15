/**
 * CLEAR AND THE READY LAYOUTS KEEP WHAT THEY REPLACE (plan 2026-11-14, eng
 * ED10; owner: "Put the old layout aside first").
 *
 * Value: protects=Clear and a ready layout put your own layout in the
 * put-aside slot before replacing it, and the editor says so at once with
 * Restore beside it; Undo, which brings the layout back, takes the copy away
 * again; a layout already put aside is never replaced by this; the first-visit
 * example is not kept
 * Value: fails_when=Clear stops keeping the layout, keeps it only after a
 * reload, leaves a copy of what is on screen offered as "earlier", or writes
 * over an older put-aside layout unasked
 * Value: why_new=Undo was the only way back from Clear, and a phone that
 * discards the tab takes Undo's history with it
 * Value: seam=the real editor under jsdom, on jsdom's storage
 * Value: no_claim=Restore itself (putAsideNotice.dom.test.tsx); the slot's
 * write rules (putAside.test.ts)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_PREVIOUS_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

const layout = (ids: string[]) => JSON.stringify({ pieces: ids.map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' })), welds: [], anchors: [] });
const OWN = layout(['m1', 'm2', 'm3']);
const EARLIER = layout(['e1']);
const NOTICE = 'Your earlier layout (3 pieces) is put aside.';
const piecesAside = () => (JSON.parse(localStorage.getItem(GRAPH_PREVIOUS_KEY) ?? 'null') as { pieces: { pieceId: string }[] } | null)?.pieces.map((p) => p.pieceId) ?? null;

const openEditor = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

describe('Clear and the ready layouts', () => {
  /*
   * MUTATION PROOFS, run:
   * - `keepFirst` not called in `clear`: `expected null to deeply equal
   *   [ 'm1', 'm2', 'm3' ]`.
   * - the notice not told the layout changed (`current` not passed): `expected
   *   null to be truthy` (the copy is kept but nothing says so until a reload).
   */
  it('Clear keeps the layout and says so at once', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const user = userEvent.setup();
    openEditor();
    expect(screen.queryByText(NOTICE)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(piecesAside()).toEqual(['m1', 'm2', 'm3']);
    expect(screen.queryByText(NOTICE)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Restore it' }).disabled).toBe(false);
  });

  /*
   * MUTATION PROOF, run: the notice not reading the slot again when the
   * layout changes (its effect on `current` removed): `expected [ 'm1', 'm2',
   * 'm3' ] to be null` (the layout on screen is still kept as an earlier one).
   */
  it('Undo brings it back, and the copy goes', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const user = userEvent.setup();
    openEditor();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(piecesAside()).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  /*
   * MUTATION PROOF, run: `keepFirst` not called in `preset`: `expected null
   * to deeply equal [ 'm1', 'm2', 'm3' ]`.
   */
  it('a ready layout keeps it too', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    const user = userEvent.setup();
    openEditor();
    await user.click(screen.getByRole('button', { name: /^Circle/ }));
    expect(piecesAside()).toEqual(['m1', 'm2', 'm3']);
    expect(screen.queryByText(NOTICE)).toBeTruthy();
  });

  it('a layout already put aside stays; Clear still clears', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(GRAPH_PREVIOUS_KEY, EARLIER);
    const user = userEvent.setup();
    openEditor();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(piecesAside()).toEqual(['e1']);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' }).disabled).toBe(true);
  });

  /*
   * MUTATION PROOF, run: `keepFirst` without its `screen.mode === 'edit'`
   * test: `expected [ 'p0', 'p1', 'p2', 'p3', 'p4', …(5) ] to be null` (the example is put aside as if it
   * were yours).
   */
  it('the first-visit example is not kept', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App offerExample />
      </StrictMode>,
    );
    expect(screen.getByRole('group', { name: 'An example' })).toBeTruthy();
    // Not the ready layout the example itself is: that would replace it with itself.
    await user.click(screen.getByRole('button', { name: /^Circle/ }));
    expect(piecesAside()).toBeNull();
  });
});
