/**
 * THE APP SAYS ITS NAME (brio-TODOS.md, "The app's name is not on screen").
 *
 * Value: protects=the rail names the app in text a screenshot or a screen
 * reader gets, and the logo mark beside it stays decorative
 * Value: fails_when=the name line is dropped, or the mark becomes announced or
 * focusable
 * Value: why_new="ChooChooCAD" was only in the tab title
 * Value: seam=App mounted under jsdom
 * Value: no_claim=how the line or the favicon look, which were checked in a
 * browser
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('the app name', () => {
  /*
   * MUTATION PROOFS, run:
   * - no `<AppName />` in App: fails with `Unable to find an element with the
   *   text: ChooChooCAD`.
   * - the mark announced (`aria-hidden` removed from AppName's svg): fails with
   *   `expected null to be 'true'`.
   */
  it('heads the parts rail, with the mark beside it kept out of the reading', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const title = screen.getByText('ChooChooCAD');
    const line = title.closest('.app-name')!;
    expect(line.closest('section.palette')).not.toBeNull();
    expect(line.textContent).toBe('ChooChooCADwooden railway layouts');
    const mark = line.querySelector('svg')!;
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.getAttribute('focusable')).toBe('false');
  });
});
