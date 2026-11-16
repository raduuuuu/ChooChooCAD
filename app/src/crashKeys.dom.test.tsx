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
import { CLEAR_CONFIRM, ErrorBoundary } from './ErrorBoundary.js';
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
});
