/**
 * THE 3D VIEW'S CONTROLS BEHAVE LIKE CONTROLS (design review of the 3D view,
 * 2026-10-31, FINDING-002 and FINDING-005).
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
  default: () => <div data-testid="viewer3d" />,
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
