/**
 * A SIZE TYPED INTO "ADD A PART" (hardening, 2026-11-16; the review backlog's
 * group E).
 *
 * Value: protects=a decimal comma is read as a decimal point and the part is
 * saved with that size; something that is not a size gets a sentence under
 * its field and marks the field invalid; an empty field says nothing
 * Value: fails_when=`12,5` is refused, a refused size shows only a greyed
 * button, or the sentence nags before anything is typed
 * Value: why_new=the field was a number field, which hands the page an empty
 * string for a comma, so the page could neither read it nor say why
 * Value: seam=`parseMm` directly, and the real App under jsdom for the field
 * Value: no_claim=which keypad a phone shows for `inputMode="decimal"`
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { App } from './App.js';
import { parseMm, SIZE_REFUSED } from './SubmitPart.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/** A layout of the user's own: the editor offers "Add a part" beside one, not on the first-visit example. */
const OWN = JSON.stringify({ pieces: [{ pieceId: 'p0', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
const open = async () => {
  localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(screen.getAllByRole('button', { name: 'Add a part' })[0]!);
  return user;
};
const length = () => screen.getByLabelText(/^Length, mm/) as HTMLInputElement;
const add = () => screen.getAllByRole('button', { name: 'Add to the library' })[0] as HTMLButtonElement;

describe('a size in Add a part', () => {
  /*
   * MUTATION PROOF, run: the comma no longer replaced: `expected null to be
   * 12.5`.
   */
  it('reads one comma as the decimal mark, and guesses at nothing else', () => {
    expect(parseMm('12,5')).toBe(12.5);
    expect(parseMm(' 144 ')).toBe(144);
    expect(parseMm('12.5')).toBe(12.5);
    for (const bad of ['1,234.5', '1.234,5', '1,2,3', ',', 'abc', '0', '-3', '', '  ', '1e999']) expect(parseMm(bad), bad).toBeNull();
  });

  /*
   * MUTATION PROOF, run: the field put back to `type="number"`: under jsdom a
   * number field drops the comma as a browser does, and the saved length is
   * `expected [ 125 ] to deeply equal [ 12.5 ]`.
   */
  it('saves a part whose length was typed with a comma', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Name'), 'short straight');
    await user.type(length(), '12,5');
    expect(add().disabled).toBe(false);
    await user.click(add());
    const saved = JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY)!) as { part: { lengthMm: number } }[];
    expect(saved.map((s) => s.part.lengthMm)).toEqual([12.5]);
  });

  /*
   * MUTATION PROOFS, run:
   * - the sentence not drawn: `expected null not to be null`.
   * - the sentence drawn for an empty field too: `expected <span …> to be null`.
   */
  it('says why a size is refused, and says nothing about an empty field', async () => {
    const user = await open();
    const said = () => document.querySelector('.submit-field-bad');
    expect(said()).toBeNull();
    await user.type(screen.getByLabelText('Name'), 'odd one');
    expect(said()).toBeNull();
    await user.type(length(), '1,2,3');
    expect(said()).not.toBeNull();
    expect(said()!.textContent).toBe(SIZE_REFUSED);
    expect(length().getAttribute('aria-invalid')).toBe('true');
    expect(add().disabled).toBe(true);
    await user.clear(length());
    expect(said()).toBeNull();
    expect(length().getAttribute('aria-invalid')).toBe('false');
  });
});
