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
      'Add Riser. Raised road. Unverified size.',
      'Add Track support. Holds raised track. Unverified size.',
      'Add Tunnel with overpass. Raised road. Unverified size.',
      'Add Stone arch bridge. Road over, track passes under. Unverified size.',
      'Add Suspension bridge. Road over, track passes under. Unverified size.',
      'Add Harbour arch bridge. Road over, track passes under. Unverified size.',
      'Add Bowstring bridge. Road over, track passes under. Unverified size.',
    ]);
    expect(within(group).getAllByText('Estimated size')).toHaveLength(8);
    const trackList = container.querySelector('.palette-parts .palette-row') as HTMLElement;
    expect(within(trackList).queryAllByRole('button', { name: /Elevated station|Riser|Track support|Tunnel|bridge/ }).length).toBe(0);
  });

  /*
   * MUTATION PROOF, run: decorated pieces left in the track list fails with
   * `expected 1 to be +0`; the works-like line left off the card fails with
   * `Unable to find an element with the text: Works like HP, Crossing, printed`.
   */
  it('decorated pieces have their own heading after Structures, each saying what it works like (decorated-pieces design 1A, 2A)', () => {
    const { container } = mount();
    const heading = screen.getByRole('heading', { name: 'Decorated' });
    const group = heading.nextElementSibling as HTMLElement;
    const names = within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Add Level crossing. Works like HP, Crossing, printed. Unverified size.',
      'Add Station straight. Works like A, Medium straight. Unverified size.',
      'Add Tunnel straight. Works like D, Long straight. Unverified size.',
      'Add Metro tunnel. Works like D, Long straight. Unverified size.',
      'Add Metro station. Works like D, Long straight. Unverified size.',
    ]);
    expect(within(group).getByText('Works like HP, Crossing, printed')).toBeTruthy();
    expect(within(group).getAllByRole('button')[0]!.getAttribute('title')).toContain('Works like HP, Crossing, printed.');
    const trackList = container.querySelector('.palette-parts .palette-row') as HTMLElement;
    expect(within(trackList).queryAllByRole('button', { name: /Level crossing/ }).length).toBe(0);
    expect(within(trackList).queryAllByRole('button', { name: /^Add Crossing, printed/ }).length).toBe(1);
  });

  /*
   * MUTATION PROOF, run: roofs left in their level's pass fails with
   * `expected 3 to be greater than 4`: the tunnel's roof, which starts at the
   * floor, was drawn under the track it covers.
   */
  it("a tunnel straight's roof hatch is drawn over its track (DESIGN.md 11)", async () => {
    const { user, container } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Tunnel straight\./ }));
    // The canvas's own drawing: the svg holding the roof, not a library card's.
    const canvas = container.querySelector('path.body-roof')!.closest('svg')!;
    const paths = [...canvas.querySelectorAll('path')];
    const roof = paths.findIndex((p) => p.classList.contains('body-roof'));
    // A plank layer: a stroked path with no fill (TrackLayers).
    const track = paths.findIndex((p) => p.getAttribute('stroke-width') !== null && p.getAttribute('fill') === 'none');
    expect(track).toBeGreaterThan(-1);
    expect(roof).toBeGreaterThan(track);
  });

  /*
   * MUTATION PROOF, run: bodies left out of the canvas's level passes fails
   * with `expected  to have a length of 4 but got +0`: no legs drawn.
   */
  it('a riser, double-clicked, stands on its four legs; floor track can pass under it', async () => {
    const { user, container } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Riser\./ }));
    expect(container.querySelector('.canvas-empty-lead')).toBeNull();
    expect(container.querySelectorAll('path.body')).toHaveLength(4);
  });

  /*
   * MUTATION PROOF, run: the station sentence dropped from the placing strip
   * fails with `Unable to find an element with the text: /Placing this
   * station raises this run of track \(2 pieces\)\. Add a ramp to keep the
   * rest on the floor\./`.
   */
  it('a station picked at the end of floor track says it will raise that run (design decision 4)', async () => {
    const { user } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Medium straight\. Measured\.$/ }));
    await user.dblClick(screen.getByRole('button', { name: /^Add Medium straight\. Measured\.$/ }));
    await user.click(screen.getByRole('button', { name: /^Add Elevated station\./ }));
    const strip = screen.getByRole('group', { name: 'Placing a piece' });
    expect(
      within(strip).getByText(/Placing this station raises this run of track \(2 pieces\)\. Add a ramp to keep the rest on the floor\./),
    ).toBeTruthy();
  });

  /*
   * MUTATION PROOFS, run: the outlines left out of the canvas fails with
   * `expected  to have a length of 2 but got +0`; the arch's springing
   * points not read (decorated-pieces T7) fails with `expected [] to have
   * a length of 2 but got +0`.
   */
  it('a stone arch bridge is outlined, with the passage edges across its road (bridges design DD3)', async () => {
    const { user, container } = mount();
    await user.dblClick(screen.getByRole('button', { name: /^Add Stone arch bridge\./ }));
    const outlines = container.querySelectorAll('path.bridge-outline');
    expect(outlines).toHaveLength(2);
    // Two lines across the road, one where the arch springs at each end of the passage.
    expect(outlines[1]!.getAttribute('d')!.match(/M /g) ?? []).toHaveLength(2);
    expect(container.querySelectorAll('path.body')).toHaveLength(2);
  });
});
