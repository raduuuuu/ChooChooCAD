/**
 * SAVE TO A FILE AND OPEN A LAYOUT FILE, IN THE EDITOR (LayoutFileControls.tsx).
 *
 * Value: protects=Save to a file downloads the link's string as
 * layout.choochoo and says so; Open a layout file puts a good file's fragment
 * in the address, which is the pasted-link road into the read-only view; a
 * refused file says why and leaves the address alone; Save is offered only
 * once there is a layout
 * Value: fails_when=the download is not the file text, a refused file still
 * navigates, or the refusal is silent
 * Value: why_new=layout files are new
 * Value: seam=the real App in StrictMode; the download is seen through a
 * stubbed `URL.createObjectURL`; the file through userEvent.upload
 * Value: no_claim=what the address change then does (pastedLink.dom.test.tsx
 * owns the hashchange road); the decoder's refusals (layoutFile.test.ts)
 */

import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { FILE_REFUSED, FILE_SAVED } from './linkWords.js';

const openEditor = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
const blobText = (b: Blob) =>
  new Promise<string>((done) => {
    const r = new FileReader();
    r.onload = () => done(String(r.result));
    r.readAsText(b);
  });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('layout files in the editor', () => {
  /*
   * MUTATION PROOF, run: `save` downloading `JSON.stringify(graph)` instead of
   * `file.text`: `expected '{"pieces":[{"pieceId":"p0","partId":"…' to match
   * /^v1\.[A-Za-z0-9_-]+\n$/`.
   */
  it('Save to a file downloads the link string, once there is a layout', async () => {
    let blob: Blob | undefined;
    let name = '';
    URL.createObjectURL = (b: Blob) => ((blob = b), 'blob:x');
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    const user = userEvent.setup();
    openEditor();
    expect(screen.queryByRole('button', { name: 'Save to a file' })).toBeNull();
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Save to a file' }));
    await waitFor(() => expect(blob).toBeDefined());
    expect(await blobText(blob!)).toMatch(/^v1\.[A-Za-z0-9_-]+\n$/);
    expect(name).toBe('layout.choochoo');
    expect(document.body.textContent).toContain(FILE_SAVED);
  });

  /*
   * MUTATION PROOFS, run:
   * - `open` not setting the address: `expected '' to match /^#v1\./`.
   * - a refusal still navigating (the refusal branch setting
   *   `location.hash` too): `expected '#v1.x' to be '' // Object.is equality`.
   */
  it('Open a layout file takes the link road for a good file, and says why for a bad one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    openEditor();
    const picker = screen.getByLabelText('Layout file');

    await user.upload(picker, new File(['not a layout'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText(FILE_REFUSED.malformed)).not.toBeNull();
    expect(location.hash).toBe('');

    const backup = JSON.stringify({ pieces: [{ pieceId: 'a', partId: 'E', turn: 'left' }], welds: [], anchors: [] });
    await user.upload(picker, new File([backup], 'choochoocad-layout.json', { type: 'application/json' }));
    await waitFor(() => expect(location.hash).toMatch(/^#v1\./));
  });
});
