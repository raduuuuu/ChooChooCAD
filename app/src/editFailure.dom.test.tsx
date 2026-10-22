/**
 * AN ENGINE THROW DURING AN EDIT REACHES THE CRASH SCREEN.
 *
 * Value: protects=a reducer throw from a click shows "Something broke." with
 * its Reload and repro, instead of a frozen page
 * Value: fails_when=the next state is computed in the click handler rather
 * than inside the `setEditor` updater
 * Value: why_new=brio-TODOS.md filed "an engine throw from a handler is
 * uncatchable" and decision D18 of the 2026-10-22 editing plan scheduled a
 * catch in `dispatch`. Building it showed the catch is not needed: React
 * computes an eager update inside its own try/catch, discards the throw, and
 * recomputes during render, where the boundary sees it
 * (react-dom-client.development.js, `dispatchSetStateInternal`). What CAN
 * break it is reading the reducer outside the updater, and nothing pinned that
 * Value: seam=`vi.mock` of `./editorReducer.js`, throwing for one action kind
 * Value: no_claim=which real engine inputs throw; the throw is injected
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';

vi.mock('./editorReducer.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./editorReducer.js')>();
  return {
    ...real,
    reduce: (...args: Parameters<typeof real.reduce>) => {
      if (args[1].kind === 'clear') throw new Error('injected engine failure');
      return real.reduce(...args);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an edit that throws', () => {
  /*
   * MUTATION PROOFS, run:
   * - `dispatch` computes `reduce(editor, action, ports)` in the handler and
   *   hands the updater the result: `no crash screen: the throw never reached
   *   ErrorBoundary: expected null not to be null`.
   * - NOT a mutation that fails, recorded so nobody re-adds it: wrapping the
   *   updater's `reduce` in try/catch-and-rethrow changes nothing, and this
   *   spec stays green, because React already routes the throw to render.
   */
  it('shows the crash screen, not a frozen page', async () => {
    // React logs a caught render error; it is the expected outcome here.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    await place(user, screen.getAllByRole('button', { name: /^Add Large curve\b/ })[0]!);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      screen.queryByRole('heading', { name: 'Something broke.' }),
      'no crash screen: the throw never reached ErrorBoundary',
    ).not.toBeNull();
  });
});
