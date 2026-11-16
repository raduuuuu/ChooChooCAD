/**
 * A COUNT TYPED INTO YOUR BOX (hardening, 2026-11-16; the review backlog's
 * group E).
 *
 * Value: protects=a count that is not a number is refused in words, the field
 * goes on showing what was typed, and the stored count is left as it was; a
 * number typed afterwards is stored and the sentence goes; the sentence has
 * a line of its own across the row
 * Value: fails_when=a slip of the finger is stored as zero with no word, the
 * typed text vanishes under the sentence that refuses it, or the sentence is
 * a cell beside the count, where it ran out past a narrow row's edge
 * Value: why_new=the field was a number field: it handed the page an empty
 * string for a typo, an empty field means zero, and "needs a number" could
 * not be reached in a browser at all
 * Value: seam=the real App under jsdom; the stylesheet as text
 * Value: no_claim=the keypad a phone shows, and the row's look (seen in a
 * browser at three widths in the pull request)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY, INVENTORY_STORAGE_KEY } from './storageKeys.js';

const OWN = JSON.stringify({ pieces: [{ pieceId: 'p0', partId: 'A', turn: 'left' }], welds: [], anchors: [] });
const stored = () => JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY) ?? 'null') as Record<string, number> | null;

describe('a count in Your box', () => {
  /*
   * MUTATION PROOFS, run:
   * - the field put back to `type="number"`: jsdom, like a browser, will not
   *   hold "3x": `expected '3' to be '3x'`.
   * - the refused text not kept (`value={owned ?? ''}`): `expected '3' to be '3x'`.
   * - the sentence left on after a good number: `expected <span …> to be null`.
   */
  it('refuses a typo in words, keeps what was typed, and leaves the stored count alone', async () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ A: 3 }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: 'Your box' })[0]!);
    const field = screen.getByLabelText('How many Medium straight you own') as HTMLInputElement;
    const row = field.closest('.inventory-row')!;
    expect(field.value).toBe('3');

    await user.type(field, 'x');
    expect(field.value).toBe('3x');
    expect(row.querySelector('.inventory-row-bad')!.textContent).toBe('needs a number');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(stored()).toEqual({ A: 3 });

    await user.clear(field);
    await user.type(field, '5');
    expect(row.querySelector('.inventory-row-bad')).toBeNull();
    expect(field.value).toBe('5');
    expect(stored()).toEqual({ A: 5 });
  });

  /*
   * MUTATION PROOF, run: `grid-column: 1 / -1` taken off the sentence:
   * `expected null not to be null`.
   */
  it('gives the sentence a line of its own across the row', () => {
    const css = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/\.inventory-row-bad\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.exec(css)).not.toBeNull();
  });
});
