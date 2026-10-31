/**
 * THE PICKED CARD SAYS SO (part previews TODO, P3).
 *
 * Value: protects=the card whose ghost is on the canvas is the one marked
 * pressed, and only while that ghost is out
 * Value: fails_when=`aria-pressed` stops following the ghost, or marks every
 * card, or stays set after the pick is cancelled
 * Value: why_new=the pick had no state of its own on its card; `data-picked`
 * only set touch-action
 * Value: seam=jsdom plus testing-library, in the `dom` project
 * Value: no_claim=nothing about the 2px ink edge itself, which jsdom does not
 * paint; that was checked in a browser
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getPart } from '../../engine/data/brio.js';
import { App } from './App.js';

const card = (id: string) =>
  screen.getAllByRole('button', { name: new RegExp(`^Add ${getPart(id).name}\\b`) })[0]!;
// Part cards only: the 2D/3D switch is a pressed button too (3D plan, design 1A).
const pressed = () => screen.queryAllByRole('button', { pressed: true }).filter((b) => b.classList.contains('piece-main'));

describe('the picked card', () => {
  /*
   * MUTATION PROOF, run: `aria-pressed={ghost?.partId === part.id}` replaced
   * with `aria-pressed={false}`: `expected [] to have a length of 1 but got +0`.
   */
  it('is pressed while its ghost is out, and only it', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(pressed()).toHaveLength(0);
    await user.click(card('A'));
    expect(pressed()).toHaveLength(1);
    expect(card('A').getAttribute('aria-pressed')).toBe('true');

    await user.click(card('E'));
    expect(pressed()).toHaveLength(1);
    expect(card('E').getAttribute('aria-pressed')).toBe('true');
    expect(card('A').getAttribute('aria-pressed')).toBe('false');

    await user.keyboard('{Escape}');
    expect(pressed()).toHaveLength(0);
  });
});
