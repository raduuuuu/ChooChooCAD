/**
 * WHAT PEOPLE DO, COUNTED BY NAME (linkFragment.ts ACTIONS; owner, 2026-11-05).
 *
 * Value: protects=a preset, Build it and Your box each count their fixed
 * name; "This works" counts once, when the user's own layout turns from not
 * working to working, and not again on the next working layout
 * Value: fails_when=a call site stops counting, "works" counts every working
 * render, or counts a layout that already worked
 * Value: why_new=action counting is new
 * Value: seam=the real App in StrictMode with `window.goatcounter.count`
 * captured, as count.js would install it
 * Value: no_claim=what count.js sends for an event (counter.dom.test.tsx)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';

let counted: string[] = [];
const openEditor = () => {
  counted = [];
  window.goatcounter = { count: (v) => void counted.push(v.path) };
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

afterEach(() => {
  delete window.goatcounter;
  localStorage.clear();
});

describe('actions are counted by name', () => {
  /*
   * MUTATION PROOF, run: `preset` without its `countAction`: `expected [
   * 'action/works', …(2) ] to deeply equal [ 'action/preset', …(4) ]`.
   */
  it('a preset, "This works" once, Build it and Your box', async () => {
    const user = userEvent.setup();
    openEditor();
    await user.click(screen.getAllByRole('button', { name: 'Circle' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Your box' }));
    // A second working layout: "This works" is not counted again.
    await user.click(screen.getAllByRole('button', { name: 'Stadium' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Build it' }));
    expect(counted).toEqual(['action/preset', 'action/works', 'action/your-box', 'action/preset', 'action/build-it']);
  });

  /*
   * MUTATION PROOFS, run:
   * - `workedBefore` starting as `false` instead of being set from the first
   *   render: `expected [ 'action/works' ] to deeply equal []`.
   * - the works effect without its `workedBefore.current === false` check
   *   (counting every working render): `expected [ 'action/works',
   *   'action/works' ] to deeply equal []`.
   */
  it('a layout that already worked when the page opened is not counted', async () => {
    const user = userEvent.setup();
    const first = openEditor();
    await user.click(screen.getAllByRole('button', { name: 'Circle' })[0]!);
    first.unmount();
    openEditor();
    expect(counted).toEqual([]);
  });
});
