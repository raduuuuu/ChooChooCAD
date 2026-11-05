/**
 * WHAT THE EDITOR SAYS ALOUD WHILE TRACK IS PLACED (generic-TODOS.md P2,
 * "Nothing has ever verified what the verdict announces", filed by /qa
 * 2026-10-19).
 *
 *   one placement ─▶ verdict region  (polite, atomic: the whole sentence)
 *                └─▶ action region   (polite, not atomic: "Added piece N, …")
 *
 * Value: protects=the exact words each live region holds at every step of a
 * real session, read the way a screen reader reads them (aria-hidden marks
 * left out), so a change to any announced sentence is a reviewed change; the
 * verdict region holds one sentence and nothing else; an edit that leaves the
 * verdict's words unchanged does not touch the region
 * Value: fails_when=a verdict or action sentence changes wording, a mark
 * stops being hidden, or a note moves back into the atomic region
 * Value: why_new=the announcement had never been read back by anything
 * Value: seam=the real App in StrictMode, placing by keyboard; each region's
 * text with `aria-hidden` subtrees removed
 * Value: no_claim=what VoiceOver actually speaks, its queueing of two polite
 * regions, or its pauses: that needs a human with VoiceOver (the checklist in
 * docs/plan/2026-11-05-verdict-announcement.md)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { placeByKeyboard } from '../test/place.js';
import { App } from './App.js';

/** What a screen reader reads in `el`: its text without `aria-hidden` subtrees. */
function spoken(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}
const verdictRegion = () => document.querySelector('[aria-live][aria-atomic="true"]')!;
const actionRegion = () => document.querySelector('p.sr-only[role="status"]')!;
const step = () => [spoken(verdictRegion()), spoken(actionRegion())];

afterEach(() => localStorage.clear());

describe('the words announced while placing', () => {
  /*
   * MUTATION PROOFS, run (vitest prints both arrays shortened):
   * - the verdict mark no longer aria-hidden: `expected [ …(2) ] to deeply
   *   equal [ …(2) ]`, and in the second test `expected 'OThis works. Closes
   *   exactly, no give …' to be 'This works. Closes exactly, no give n…'`.
   * - "This works." reworded to "It works.": `expected [ …(2) ] to deeply
   *   equal [ …(2) ]`.
   */
  it('a loop of eight curves, then a stray piece, then presets', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const curve = () => screen.getAllByRole('button', { name: /^Add Large curve/ })[0]!;
    expect(step()).toEqual(['Nothing to check yet.', '']);

    await placeByKeyboard(user, curve());
    expect(step()).toEqual(['Not a loop yet. 1 piece, open at both ends', 'Added piece 1, Large curve (E), starting a new run.']);
    for (let i = 2; i <= 7; i++) await placeByKeyboard(user, curve());
    expect(step()).toEqual(['Not a loop yet. 7 pieces, open at both ends', 'Added piece 7, Large curve (E), joined to the end of piece 6.']);

    await placeByKeyboard(user, curve());
    expect(step()).toEqual([
      'This works. Closes exactly, no give needed at any joint.',
      'Added piece 8, Large curve (E), joined to the end of piece 7. It also joined the start of piece 1.',
    ]);

    await placeByKeyboard(user, screen.getAllByRole('button', { name: /^Add Mini straight/ })[0]!);
    expect(step()).toEqual([
      'This works. Closes exactly, no give needed at any joint. 1 other run of track is not a loop yet.',
      'Added piece 9, Mini straight (A2), starting a new run.',
    ]);

    await user.click(screen.getByRole('button', { name: 'Remove last' }));
    expect(step()).toEqual(['This works. Closes exactly, no give needed at any joint.', 'Removed piece 9, Mini straight (A2).']);

    await user.click(screen.getAllByRole('button', { name: 'Near miss' })[0]!);
    expect(step()).toEqual(['Tight. Closes with bend: needs up to 2.7° at a joint.', 'Loaded a layout of 10 pieces.']);
  });

  /*
   * MUTATION PROOF, run: the notes rendered inside the atomic region
   * (`{notes}` moved into the `aria-live` div): `expected 'This works. Closes
   * exactly, no give n…' to be 'This works. Closes exactly, no give n…'`
   * (the same opening; the notes follow it).
   */
  it('the verdict region holds the sentence alone; its notes are a sibling it points at', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(screen.getAllByRole('button', { name: 'Circle' })[0]!);
    const region = verdictRegion();
    expect(spoken(region)).toBe('This works. Closes exactly, no give needed at any joint.');
    const notes = region.getAttribute('aria-describedby');
    expect(notes === null || !region.contains(document.getElementById(notes))).toBe(true);
  });
});
