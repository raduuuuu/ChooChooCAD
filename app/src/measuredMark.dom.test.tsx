/**
 * THE MEASURED TICK IN THE LIBRARY (docs/plan/2026-11-03-verified-mark.md,
 * decisions 3A, 6C, 10A, 11A, 14A).
 *
 * Value: protects=a measured piece's card says "Measured." in its name and
 * title and carries the drawn tick after its code; an unmeasured one does
 * neither; the medium straight carries it from the owner's own reading; the key under the track list explains both card signs in words
 * Value: fails_when=the tick or its words go, it lands on an unmeasured piece,
 * or the key is dropped
 * Value: why_new=no measured mark existed
 * Value: seam=jsdom, App mounted in StrictMode
 * Value: no_claim=how the tick looks (checked in the browser)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('the measured tick on library cards', () => {
  /*
   * MUTATION PROOFS, run:
   * - the "Measured." sentence dropped from the name: fails with `Unable to
   *   find an accessible element with the role "button" and name "Add Long
   *   straight. Measured."`.
   * - the tick left out of the code: fails with `expected null not to be null`.
   * - the key dropped: fails with `expected null not to be null`.
   */
  it('marks the measured pieces in words and with the drawn tick, and keys both signs', () => {
    const { container } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const d = screen.getByRole('button', { name: 'Add Long straight. Measured.' });
    expect(d.getAttribute('title')).toBe('D Long straight. Measured. Double-click to place directly');
    expect(d.querySelector('.piece-id .measured-tick')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Add T switch. Measured.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Medium straight. Measured.' })).toBeTruthy();
    // A piece nothing has checked: no tick, no word.
    const a2 = screen.getByRole('button', { name: 'Add Mini straight' });
    expect(a2.querySelector('.measured-tick')).toBeNull();
    const key = container.querySelector('.palette-key');
    expect(key).not.toBeNull();
    // The printable-model entry joined it (printable-mark plan, 10A).
    expect(key!.textContent).toBe(' Measured. * Unverified size.  Printable model.');
  });
});
