/**
 * THE 3D VIEW'S CONTROLS BEHAVE LIKE CONTROLS (design review of the 3D view,
 * 2026-10-31, FINDING-002, FINDING-005 and FINDING-006).
 *
 * Value: protects=keyboard focus stays on the switch when the view changes,
 * and Reset is offered only when there is a view to reset
 * Value: fails_when=switching drops focus to the page, or Reset shows on the
 * empty, failed or too-big states
 * Value: why_new=both were found by the design review; no spec covered them
 * Value: seam=`Viewer3D.js` is mocked (jsdom has no WebGL), as in
 * view3d.dom.test.tsx
 * Value: no_claim=how the controls look; the review's screenshots are that
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

vi.mock('./Viewer3D.js', () => ({
  // The real viewer puts `describedBy` on its canvas; the mock puts it on its stand-in.
  default: (props: { describedBy?: string }) => <div data-testid="viewer3d" aria-describedby={props.describedBy} />,
}));

const button = (name: string) => screen.getAllByRole('button', { name })[0]!;

function app() {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return user;
}

describe('the view switch keeps keyboard focus (FINDING-002)', () => {
  /*
   * MUTATION PROOF, run: the effect that refocuses the pressed button removed
   * (`focusSwitch.current = true;` deleted from `showView`): `expected
   * '3D view: drag to turn, scroll or pinc…' to be '3D'` (focus fell to the
   * page, whose text begins with the how-to).
   */
  it('focus moves to the newly pressed button, both ways', async () => {
    const user = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await screen.findByTestId('viewer3d');
    expect(document.activeElement?.textContent).toBe('3D');
    await user.click(button('2D'));
    expect(document.activeElement?.textContent).toBe('2D');
  });
});

describe('Reset is offered only with a view to reset (FINDING-005)', () => {
  /*
   * MUTATION PROOF, run: the panel renders `{reset}` instead of `{live &&
   * reset}`: `expected <button class="view-reset"></button> to be null`.
   */
  it('shown over a drawn layout, gone once the layout is empty', async () => {
    const user = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await screen.findByTestId('viewer3d');
    expect(button('Reset view')).toBeTruthy();
    await user.click(button('Clear'));
    expect(screen.getByText('Nothing to show in 3D yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset view' })).toBe(null);
  });
});

describe('the 3D view says its keys (FINDING-006)', () => {
  /*
   * MUTATION PROOF, run: the panel stops passing `describedBy: howToId` to the
   * viewer: `expected null not to be null`.
   */
  it('the view is described by the how-to, and the how-to names the keys', async () => {
    const user = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    const view = await screen.findByTestId('viewer3d');
    const id = view.getAttribute('aria-describedby');
    expect(id).not.toBe(null);
    expect(document.getElementById(id!)?.textContent).toMatch(/Keys: arrows turn, \+ and − zoom, 0 resets\./);
  });
});
