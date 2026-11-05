/**
 * YOUR BOX, SIMPLE FIRST (owner, 2026-11-05: "always reachable and stripped
 * back"; docs/plan/2026-11-05-inventory-by-part.md B1, B2).
 *
 * Value: protects=Your box is offered on an empty canvas; the panel is a
 * plain list of counts, with no quick-fills; a typed count is stored
 * Value: fails_when=the button goes back behind "a layout exists", or the
 * quick-fills return
 * Value: why_new=the box used to wait for a layout (D10)
 * Value: seam=the real App in StrictMode, empty storage
 * Value: no_claim=the count guard (inventoryModel.test.ts), adapters
 * (socketAdapter.dom.test.tsx)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { INVENTORY_STORAGE_KEY } from './storageKeys.js';

afterEach(() => localStorage.clear());

describe('Your box, on an empty canvas', () => {
  /*
   * MUTATION PROOF, run: the row gated on `graph.pieces.length > 0 &&
   * !inventoryOpen` again: `Unable to find an accessible element with the role
   * "button" and name "Your box"`.
   */
  it('is offered, opens as plain counts, and stores what is typed', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Your box' }));
    const panel = screen.getByRole('region', { name: 'What you own' });
    expect(panel.textContent).toContain('Type how many of each piece you own.');
    expect(panel.textContent).not.toMatch(/Quick-fill|A few of each/);
    // Your table and Add a part still wait for track (D10 kept for them).
    expect(screen.queryByRole('button', { name: 'Add a part' })).toBeNull();

    const first = screen.getAllByRole('spinbutton')[0]!;
    await user.type(first, '6');
    const stored = JSON.parse(localStorage.getItem(INVENTORY_STORAGE_KEY)!) as Record<string, number>;
    expect(Object.values(stored)).toContain(6);
  });
});
