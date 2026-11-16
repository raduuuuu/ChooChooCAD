/**
 * THE WIDE EDITOR'S PAGE: ITS HEADING, AND WHERE A NOTICE GOES (hardening,
 * 2026-11-16; the review backlog's group E).
 *
 * Value: protects=the editor has exactly one `<h1>`, the identity line, and
 * the line stays a paragraph wherever a screen does not ask for the heading
 * (a friend's screen has its own title as its `<h1>`); every notice is drawn
 * inside one `.notices` box, which is absent when there is none; at 1000px
 * and up that box and the shortfall line each have a row in the plan's
 * column; the inventory's count field is 44px on every screen
 * Value: fails_when=the editor has no first heading or a screen has two, a
 * notice is loose in the grid (where it fell under the palette at the foot of
 * the screen), or the count field shrinks under 44px off a touch screen
 * Value: why_new=none of the four had a pin
 * Value: seam=the real App under jsdom; the stylesheet read as text, comments
 * stripped (blunt, per CLAUDE.md: it proves the rule, not the pixel)
 * Value: no_claim=where the notice lands on screen; looked at in a browser at
 * 1280x800 in the pull request
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import { AppName } from './AppName.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

const css = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const wide = css.slice(css.indexOf('@media (min-width: 1000px)'));
const OWN = JSON.stringify({ pieces: [{ pieceId: 'p0', partId: 'A', turn: 'left' }], welds: [], anchors: [] });

describe('the wide editor’s page', () => {
  /*
   * MUTATION PROOF, run: `heading` not passed by the editor: `expected []
   * to deeply equal [ 'app-name' ]`.
   */
  it('has one first heading, the identity line', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    render(<App />);
    expect([...document.querySelectorAll('h1')].map((h) => h.className)).toEqual(['app-name']);
    expect(document.querySelector('h1')!.textContent).toBe('ChooChooCADwooden railway layouts');
  });

  /*
   * MUTATION PROOF, run: `heading` true by default: `expected 'H1' to be 'P'`
   * (a friend's screen would then have two first headings).
   */
  it('stays a plain line where no heading is asked for', () => {
    render(<AppName />);
    expect(document.querySelector('.app-name')!.tagName).toBe('P');
  });

  /*
   * THE BOX IS THERE EVEN WHEN EMPTY. Its row in the wide grid must be held,
   * or the grid places the next unplaced block in it: from 1.0.3 to 1.1.2
   * "Run a train" sat over the plan whenever no notice was showing.
   *
   * MUTATION PROOFS, run:
   * - the wrapper removed (notices loose again): `expected null not to be null`.
   * - the wrapper drawn only with a notice in it: `expected null not to be null`
   *   on the first expectation, before any notice exists.
   */
  it('draws every notice inside one box, which is there, empty, when there is none', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, OWN);
    render(<App />);
    expect(document.querySelector('.shell > .notices')).not.toBeNull();
    expect(document.querySelector('.notices')!.childElementCount).toBe(0);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: GRAPH_STORAGE_KEY }));
    });
    const box = document.querySelector('.notices');
    expect(box).not.toBeNull();
    expect(screen.getByRole('alert').parentElement).toBe(box);
    expect(document.querySelectorAll('.shell > .notice').length).toBe(0);
  });

  /*
   * MUTATION PROOFS, run:
   * - `.notices` given no row: `expected null not to be null`.
   * - `.notice` put back in the both-columns list: `expected true to be false`.
   * - the count field's 44px moved back under `pointer: coarse` (32px
   *   otherwise): `expected '32px' to be '44px'`.
   */
  it('gives the notices and the shortfall a row in the plan’s column, and the count field 44px', () => {
    expect(/\.notices\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;\s*\}/.exec(wide)).not.toBeNull();
    expect(/\.stage\s*\{\s*grid-column:\s*1;\s*grid-row:\s*3;\s*\}/.exec(wide)).not.toBeNull();
    expect(/\.shortfall\s*\{\s*grid-column:\s*1;\s*grid-row:\s*6;\s*\}/.exec(wide)).not.toBeNull();
    expect(/\.notice\b[^{]*\{\s*grid-column:\s*1\s*\/\s*-1/.test(wide)).toBe(false);
    const field = [...css.matchAll(/\.inventory-row-input\s*\{([^}]*)\}/g)].map((m) => /min-height:\s*(\d+px)/.exec(m[1]!)?.[1]).filter(Boolean);
    expect(field.at(-1)).toBe('44px');
    expect(field.every((v) => v === '44px')).toBe(true);
  });
});
