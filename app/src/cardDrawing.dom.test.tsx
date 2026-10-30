/**
 * THE DRAWING ON A PART CARD, IN THE APP (docs/plan/2026-10-30-part-previews.md).
 *
 * Value: protects=every card carries a 32×20 drawing that is aria-hidden and
 * unfocusable (eng D2, 10A); the card's spoken name is what it was; the
 * tooltip carries the full code and name a narrow card may cut (11A, eng D5)
 * Value: fails_when=the box size changes, the drawing becomes announced or
 * focusable, or the card's accessible name changes
 * Value: why_new=no drawings existed on the cards
 * Value: seam=App mounted under jsdom
 * Value: no_claim=row heights or look, which jsdom cannot measure and were
 * checked in a browser (eng D2)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('a part card', () => {
  /*
   * MUTATION PROOF, run: the drawing announced (`aria-hidden` removed from
   * PartPreview's svg): fails with `expected null to be 'true'`.
   */
  it('carries a 32×20 decorative drawing, and its name and tooltip say the part', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const card = screen.getByRole('button', { name: 'Add Mini straight' });
    const svg = card.querySelector('svg.part-preview')!;
    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('20');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(card.getAttribute('title')).toBe('A2 Mini straight. Double-click to place directly');
    // Every card in the palette has one.
    const cards = [...document.querySelectorAll('.piece-main')];
    expect(cards.length).toBeGreaterThan(40);
    expect(cards.every((c) => c.querySelector('svg.part-preview'))).toBe(true);
  });
});
