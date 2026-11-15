/**
 * THE WAY FROM THE APP TO THE READY LAYOUTS' OWN PAGES.
 *
 * Value: protects=the editor links to `/layouts/`, the pages that list each
 * ready layout that closes with its pieces: beside the ready layouts on a wide
 * screen, and under Ready layouts in More on a phone
 * Value: fails_when=the link is dropped from either editor, or points
 * somewhere the site does not serve
 * Value: why_new=the pages were reachable from a search engine and from the
 * no-script text, and from nowhere inside the app
 * Value: seam=the real App under jsdom; matchMedia stubbed for the phone
 * Value: no_claim=that the pages exist (scripts/layoutPages.ts and its test);
 * what following the link does (a plain navigation, the browser's)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { LAYOUT_PAGES_WORDS } from './linkWords.js';
import { PHONE_SHELL_QUERY } from './phoneEditor.js';
import { NARROW_QUERY } from './useMatchMedia.js';

afterEach(() => vi.unstubAllGlobals());
const open = () =>
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

describe('the link to the layout pages', () => {
  /*
   * MUTATION PROOF, run: the link removed from the palette's ready layouts:
   * `Unable to find an accessible element with the role "link" and name
   * "Layouts that close, with the pieces each takes"`.
   */
  it('is beside the ready layouts on a wide screen', () => {
    open();
    const link = screen.getByRole<HTMLAnchorElement>('link', { name: LAYOUT_PAGES_WORDS });
    expect(link.getAttribute('href')).toBe('/layouts/');
    expect(link.closest('section.palette')).not.toBeNull();
  });

  /*
   * MUTATION PROOF, run: the link removed from More: `Unable to find an
   * accessible element with the role "link"` inside the More sheet.
   */
  it('is under Ready layouts in More on a phone', async () => {
    const yes = new Set([PHONE_SHELL_QUERY, NARROW_QUERY]);
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: yes.has(q), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('button', { name: 'More' }));
    const link = screen.getByRole<HTMLAnchorElement>('link', { name: LAYOUT_PAGES_WORDS });
    expect(link.getAttribute('href')).toBe('/layouts/');
    expect(link.closest('dialog')!.getAttribute('aria-label')).toBe('More');
  });
});
