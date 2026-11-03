/**
 * STRUCTURES THROUGH THE REAL APP (plan 2026-11-02; design decisions 1, 2, 3).
 *
 * Value: protects=the library's Structures group comes after the track and
 * says what each carries and that its size is a guess; a pier, double-clicked,
 * lands selected with the strip telling how to move it, and the canvas draws
 * its body and a target for it where an empty-floor message would otherwise be
 * Value: fails_when=structures mix into the track list, the notes go, a pier
 * is placed unselected or reads as a run, or a canvas with only a pier shows
 * "Nothing on the floor yet"
 * Value: why_new=no structures existed in the app
 * Value: seam=jsdom plus user-event, App mounted in StrictMode
 * Value: no_claim=how bodies look (no paint in jsdom; checked in the browser)
 */

import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const mount = () => {
  const user = userEvent.setup();
  const { container } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return { user, container };
};

describe('structures in the library and on the floor', () => {
  /*
   * MUTATION PROOFS, run:
   * - `partsByBrand` keeping structures in the track list: fails with
   *   `expected 3 to be +0` (the track list's own cards).
   * - 'Estimated size' left off the card: fails with `Unable to find an
   *   element with the text: Estimated size`.
   */
  it('come last, under their own heading, each saying what it carries and that its size is estimated', () => {
    const { container } = mount();
    const heading = screen.getByRole('heading', { name: 'Structures' });
    const group = heading.nextElementSibling as HTMLElement;
    const names = within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Add Elevated station. Raised road. Unverified size.',
      'Add Bridge pier. No track connections. Unverified size.',
      'Add Tunnel. Floor road. Unverified size.',
    ]);
    expect(within(group).getAllByText('Estimated size')).toHaveLength(3);
    const trackList = container.querySelector('.palette-parts .palette-row') as HTMLElement;
    expect(within(trackList).queryAllByRole('button', { name: /Elevated station|Bridge pier|Tunnel/ }).length).toBe(0);
  });

  /*
   * MUTATION PROOFS, run:
   * - the placed line dropped (the piece's name instead): fails with `Unable
   *   to find an element with the text: Bridge pier placed. Move it with the
   *   arrows, R to turn, or drag it.`.
   * - the canvas's empty check counting segments only: fails with `Unable to
   *   find an accessible element with the role "group" and name "Selected
   *   piece"`: the floor read as empty and the pier could not be selected.
   * - `add` not selecting a piece with no ends: fails with the same message.
   */
  it('a pier, double-clicked, lands selected with the strip saying how to move it, drawn as a body', async () => {
    const { user, container } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Bridge pier\./ }));
    const strip = screen.getByRole('group', { name: 'Selected piece' });
    expect(within(strip).getByText('Bridge pier placed. Move it with the arrows, R to turn, or drag it.')).toBeTruthy();
    expect(container.querySelector('.canvas-empty-lead')).toBeNull();
    expect(container.querySelectorAll('path.body')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Bridge pier/, pressed: true })).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: Place (`placeGhost`) not selecting a piece with no
   * ends fails with `Unable to find an accessible element with the role
   * "group" and name "Selected piece"`.
   */
  it('picked and placed, it lands selected too; moved, the strip names it', async () => {
    const { user } = mount();
    await user.click(screen.getByRole('button', { name: /^Add Bridge pier\./ }));
    await user.keyboard('{Enter}');
    const strip = () => screen.getByRole('group', { name: 'Selected piece' });
    expect(within(strip()).getByText('Bridge pier placed. Move it with the arrows, R to turn, or drag it.')).toBeTruthy();
    await user.click(within(strip()).getByRole('button', { name: 'Move run right 1 cm' }));
    expect(within(strip()).getByText('Piece 1: Bridge pier (PR), 40×40')).toBeTruthy();
  });
});
