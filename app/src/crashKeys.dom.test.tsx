/**
 * THE CRASH SCREEN AND EVERY KEY THE APP KEEPS (owner, 2026-11-16; the deep
 * checkup of 2026-11-15).
 *
 * Value: protects=when the app crashes, the report shows the bytes of every
 * key the app keeps, and "Clear saved data", once confirmed, removes every
 * one of them; the confirming button says all of what goes, the layout put
 * aside included
 * Value: fails_when=a key is kept by the app and missing from the report or
 * from the clear (as the table, the view, the two build positions, the
 * layout put aside and the selection hint all were), so a crash one of them
 * caused could be neither sent nor recovered from
 * Value: why_new=the lists were hand-written, five keys long, and checked
 * only by reading the source for those same five names
 * Value: seam=the real `ErrorBoundary` round a child that throws; the keys
 * are every string exported by storageKeys.ts plus the submissions key, read
 * from the modules, not listed here; `location.reload` stubbed
 * Value: no_claim=that the reload then starts cleanly in a browser
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import { CLEAR_CONFIRM, CLEAR_EVERYTHING, CLEAR_KEEPS_SAVED, ErrorBoundary } from './ErrorBoundary.js';
import * as keys from './storageKeys.js';

const KEPT = [...Object.values(keys), SUBMISSIONS_STORAGE_KEY].filter((v): v is string => typeof v === 'string');
function Broken(): never {
  throw new Error('drawing failed');
}
const crash = () => {
  for (const k of KEPT) localStorage.setItem(k, `bytes-of-${k}`);
  // A key the app does not own must survive: the clear is not `localStorage.clear()`.
  localStorage.setItem('someone.elses', 'kept');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the crash screen', () => {
  /*
   * MUTATION PROOFS, run:
   * - `other` left out of the report (`other: []`): `expected [ 'generic.table.v0',
   *   …(5) ] to deeply equal []`.
   * - one key dropped from `MOVED_KEYS`: oldNames.dom.test.tsx fails first,
   *   and this fails with that key's name.
   */
  it('shows the bytes of every key the app keeps', () => {
    crash();
    expect(KEPT.length).toBe(11);
    const report = (screen.getByLabelText('Crash details to copy') as HTMLTextAreaElement).value;
    expect(KEPT.filter((k) => !report.includes(`bytes-of-${k}`))).toEqual([]);
  });

  /*
   * MUTATION PROOFS, run:
   * - the clear put back to its five hand-written keys: `expected [
   *   'generic.table.v0', …(5) ] to deeply equal []`.
   * - the clear run on the first press, with no confirmation: `expected +0
   *   to be 11` (everything already gone before anything was confirmed).
   */
  it('removes every one of them, only after the confirmation that names what goes', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    crash();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear saved data' }));
    expect(KEPT.filter((k) => localStorage.getItem(k) !== null).length).toBe(11);
    expect(CLEAR_CONFIRM).toContain('the layout put aside');
    await user.click(screen.getByRole('button', { name: CLEAR_CONFIRM }));
    expect(KEPT.filter((k) => localStorage.getItem(k) !== null)).toEqual([]);
    expect(localStorage.getItem('someone.elses')).toBe('kept');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  /*
   * SAVED LAYOUTS (owner, 2026-11-16, D4): kept by the first answer, removed
   * by the second, in the report either way.
   *
   * MUTATION PROOFS, run:
   * - the saved layouts left out of the report: `expected [
   *   'generic.layouts.v1.a', … ] to deeply equal []`.
   * - the first answer removing them too: `expected [] to deeply equal [
   *   'generic.layouts.v1.a', 'generic.layouts.v1.b' ]`.
   * - the second answer removing ONLY them (the crash left in place):
   *   `expected [ 'generic.chain.v0', …(10) ] to deeply equal []`.
   * - the sentence about added parts not shown: `expected null not to be null`.
   */
  const SAVED = ['generic.layouts.v1.a', 'generic.layouts.v1.b'];
  const withSaved = () => {
    for (const k of SAVED) localStorage.setItem(k, `bytes-of-${k}`);
    crash();
  };
  const left = (keys: readonly string[]) => keys.filter((k) => localStorage.getItem(k) !== null);

  it('carries the saved layouts in the report, and the first answer keeps them', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    withSaved();
    const report = (screen.getByLabelText('Crash details to copy') as HTMLTextAreaElement).value;
    expect(SAVED.filter((k) => !report.includes(`bytes-of-${k}`))).toEqual([]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear saved data' }));
    // Said before anything is pressed: what is kept, and what that costs.
    expect(screen.queryByText(CLEAR_KEEPS_SAVED)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: CLEAR_CONFIRM }));
    expect(left(KEPT)).toEqual([]);
    expect(left(SAVED)).toEqual(SAVED);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('the second answer removes everything, the saved layouts too, and still nothing that is not the app’s', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    withSaved();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear saved data' }));
    await user.click(screen.getByRole('button', { name: CLEAR_EVERYTHING }));
    expect(left(KEPT)).toEqual([]);
    expect(left(SAVED)).toEqual([]);
    expect(localStorage.getItem('someone.elses')).toBe('kept');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  /*
   * MUTATION PROOF, run: the second answer always offered: `expected <button>
   * to be null` (a button about saved layouts for someone who has none).
   */
  it('with no saved layouts there is one answer, and nothing is said about them', async () => {
    crash();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear saved data' }));
    expect(screen.queryByRole('button', { name: CLEAR_EVERYTHING })).toBeNull();
    expect(screen.queryByText(CLEAR_KEEPS_SAVED)).toBeNull();
  });
});
