/**
 * A LAYOUT FILE DROPPED ON THE CANVAS (App.tsx's stage, LayoutFileControls.tsx).
 *
 * Value: protects=a file dropped on the canvas opens as "Open a layout file"
 * does: a good file's fragment goes in the address, the pasted-link road into
 * the read-only view; a refused file says why on the file row and leaves the
 * address alone; a drag carrying files is accepted, any other drag is not
 * Value: fails_when=the drop is ignored, a refused drop still navigates or is
 * silent, or the canvas never accepts a file drag
 * Value: why_new=drop is the second way in the design doc names for layout
 * files; only the picker shipped before
 * Value: seam=the real App in StrictMode; the drop and drag through
 * fireEvent with a DataTransfer-shaped object (jsdom has no DataTransfer)
 * Value: no_claim=what the address change then does (pastedLink.dom.test.tsx
 * owns the hashchange road); the decoder's refusals (layoutFile.test.ts); the
 * picker (layoutFile.dom.test.tsx)
 */

import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { FILE_REFUSED } from './linkWords.js';

const openEditor = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
const stage = () => document.querySelector('main.stage')!;
const drop = (file: File) => fireEvent.drop(stage(), { dataTransfer: { files: [file], types: ['Files'] } });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('a layout file dropped on the canvas', () => {
  /*
   * MUTATION PROOF, run: the drop handler not calling `openLayoutFile`:
   * `expected '' to match /^#v1\./`.
   */
  it('takes the link road for a good file', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    openEditor();
    const backup = JSON.stringify({ pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }], welds: [], anchors: [] });
    drop(new File([backup], 'choochoocad-layout.json', { type: 'application/json' }));
    await waitFor(() => expect(location.hash).toMatch(/^#v1\./));
  });

  /*
   * MUTATION PROOF, run: the drop handing `openLayoutFile` a `say` that
   * shows nothing (`() => undefined` for `setFileSaid`): `Unable to find an
   * element with the text: This file isn't a layout ChooChooCAD can open..`
   */
  it('says why a bad file is refused, on the file row, and stays put', async () => {
    openEditor();
    drop(new File(['not a layout'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText(FILE_REFUSED.malformed)).not.toBeNull();
    expect(location.hash).toBe('');
  });

  /*
   * MUTATION PROOFS, run:
   * - dragover never calling `preventDefault`: `expected true to be false //
   *   Object.is equality`.
   * - dragover calling `preventDefault` whatever the drag carries: `expected
   *   false to be true // Object.is equality`.
   */
  it('accepts a drag that carries files, and only that', () => {
    openEditor();
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.dragOver(stage(), { dataTransfer: { files: [], types: ['Files'] } })).toBe(false);
    expect(fireEvent.dragOver(stage(), { dataTransfer: { files: [], types: ['text/plain'] } })).toBe(true);
  });
});
