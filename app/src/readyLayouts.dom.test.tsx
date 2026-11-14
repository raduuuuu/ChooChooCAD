/**
 * THE READY LAYOUTS SAY WHAT YOUR BOX CAN BUILD (plan 2026-11-14, E2).
 *
 * Value: protects=with a box declared, each ready layout's button says
 * whether the box covers it, covered ones lead, and pressing one builds it
 * with its turns; with no box the buttons say nothing extra
 * Value: fails_when=the words are shown with no box, are missing with one,
 * the covered layout does not lead, or a two-way layout is built all one way
 * Value: seam=jsdom plus testing-library, in the `dom` project
 * Value: no_claim=nothing about how the second line looks; that was checked
 * in a browser
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { PRESETS } from './presets.js';
import { INVENTORY_STORAGE_KEY } from './storageKeys.js';

const labels = PRESETS.map((p) => p.label);
/** The ready-layout buttons, in the order the screen offers them. */
const ready = () =>
  screen.getAllByRole('button').filter((b) => labels.some((l) => b.textContent === l || b.textContent?.startsWith(l)) && b.closest('.palette-controls'));
const tagOf = (b: HTMLElement) => b.querySelector('.ready-box')?.textContent ?? null;

describe('ready layouts and your box', () => {
  /*
   * MUTATION PROOF, run: `boxWords(short, ...)` given `[]` for a null box in
   * App.tsx: every button then reads "in your box" for a visitor with no box.
   */
  it('says nothing extra when no box is declared', () => {
    render(<App />);
    expect(ready().map((b) => b.textContent)).toEqual(labels);
    expect(ready().map(tagOf)).toEqual(labels.map(() => null));
  });

  /*
   * MUTATION PROOF, run: `byBox(PRESETS, inventory)` replaced by
   * `byBox(PRESETS, null)` in App.tsx: no words, and the Circle no longer leads
   * (it already leads here, so the words are what fail).
   */
  it('with a box, says which it covers and offers those first', () => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify({ E: 10, D: 2 }));
    render(<App />);
    const buttons = ready();
    expect(buttons.slice(0, 2).map((b) => b.textContent)).toEqual(['Circlein your box', 'Stadiumin your box']);
    expect(tagOf(buttons.find((b) => b.textContent?.startsWith('Long oval'))!)).toBe('short of 2');
    expect(buttons.find((b) => b.textContent?.startsWith('Bean'))!.title).toContain('Short of 2 pieces: 2 × Large curve.');
  });

  /*
   * MUTATION PROOF, run: `dispatch(presetAction(p))` replaced by
   * `dispatch({ kind: 'preset', ids: p.pieces })` in App.tsx: the Bean is then
   * built bending one way only and the verdict no longer says it works.
   */
  it('builds a two-way layout so that it closes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(ready().find((b) => b.textContent === 'Bean')!);
    expect(document.body.textContent).toContain('This works.');
  });
});
