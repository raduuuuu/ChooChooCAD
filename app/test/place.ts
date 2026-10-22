/**
 * PLACING A PIECE IN A DOM SPEC, the one way every spec does it (eng decision
 * D4 of the 2026-10-22 editing plan, ENG-R3).
 *
 * A palette click used to put the piece down. It now only PICKS it: a preview
 * appears, and Place puts it down (decision R3). Twelve call sites in five
 * spec files clicked the palette and asserted on the result, so they all go
 * through these two helpers and keep every assertion they had. Change the
 * placing flow here, once.
 */

import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Pick with a click, then Place with a click. */
export async function place(user: UserEvent, paletteButton: HTMLElement): Promise<void> {
  await user.click(paletteButton);
  await user.click(screen.getByRole('button', { name: 'Place (Enter)' }));
}

/**
 * The keyboard route: Enter on the palette button picks, which moves focus to
 * Place (Codex OV6), and Enter again places.
 */
export async function placeByKeyboard(user: UserEvent, paletteButton: HTMLElement): Promise<void> {
  paletteButton.focus();
  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');
}
