/**
 * THE VERSION, SHOWN (owner, 2026-11-15).
 *
 * Value: protects=the app shows "Version" and the stamped number as a link
 * to the releases, with the ready layouts on a wide screen and in More on a
 * phone, and draws no line where nothing stamped a number
 * Value: fails_when=the line is missing from either screen, shows a number
 * other than the build's, or invents one when there is none
 * Value: why_new=the app showed no version
 * Value: seam=the real App under jsdom, the build's stamp set as a global
 * Value: no_claim=that vite stamps package.json's number into a build (the
 * built file is looked at in the pull request), or how the line looks
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { RELEASES_URL } from './appVersion.js';
import { PHONE_SHELL_QUERY } from './phoneEditor.js';
import { TOUCH_QUERY } from './stripWords.js';
import { NARROW_QUERY } from './useMatchMedia.js';

const line = () => document.querySelector<HTMLAnchorElement>('a.app-version');
const phone = () => {
  const yes = new Set([PHONE_SHELL_QUERY, NARROW_QUERY, TOUCH_QUERY]);
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: yes.has(q), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the version line', () => {
  /*
   * MUTATION PROOFS, run:
   * - the line taken out of the wide editor: `expected null not to be null`.
   * - a fixed number drawn in place of the stamp: `expected 'Version 1.0.0'
   *   to be 'Version 9.8.7'`.
   */
  it('a wide screen shows the stamped number, as a link to the releases', () => {
    vi.stubGlobal('__APP_NUMBER__', '9.8.7');
    render(<App />);
    expect(line()).not.toBeNull();
    expect(line()!.textContent).toBe('Version 9.8.7');
    expect(line()!.getAttribute('href')).toBe(RELEASES_URL);
    expect(line()!.closest('section.palette')).not.toBeNull();
  });

  /*
   * MUTATION PROOF, run: the line taken out of More: `expected null not to
   * be null`.
   */
  it('a phone shows it in More', async () => {
    vi.stubGlobal('__APP_NUMBER__', '9.8.7');
    phone();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'More' }));
    const inMore = screen.getByRole('dialog', { name: 'More' }).querySelector('a.app-version');
    expect(inMore).not.toBeNull();
    expect(inMore!.textContent).toBe('Version 9.8.7');
  });

  /*
   * MUTATION PROOF, run: `appNumber` falling back to '0.0.0': `expected
   * <a class="contribute-link app-version"> to be null`.
   */
  it('draws nothing where no number was stamped', () => {
    render(<App />);
    expect(document.querySelector('section.palette')).not.toBeNull();
    expect(line()).toBeNull();
  });
});
