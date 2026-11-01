/**
 * THE FLOOR UN-SELECTS AN END, AND A JOIN IS SAID ON SCREEN (plan 2026-11-01;
 * eng R2, X2; design DR5).
 *
 * Value: protects=a click on the floor clears an end being joined, through
 * the real App; after two ends are joined the strip names them with an Undo
 * that works
 * Value: fails_when=the floor only clears a selected piece, or a join leaves
 * no trace on screen
 * Value: why_new=arming an end used to be cleared only by Esc or Cancel, and a
 * join was only announced to screen readers
 * Value: seam=App under jsdom; clicks go straight to the elements (jsdom has
 * no hit-testing; the PR's browser check covers stacked ends)
 * Value: no_claim=which of two stacked ends a real pointer reaches
 */

import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;

/** Near miss with its closing joint broken: a loop whose two ends stop 72mm apart. */
async function openLoop() {
  const user = userEvent.setup();
  const { container } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(button('Near miss'));
  const joints = screen.getAllByRole('button', { name: 'Break this joint' });
  await user.click(joints[joints.length - 1]!);
  return { user, container };
}

describe('the floor un-selects an end (X2)', () => {
  /*
   * MUTATION PROOF, run: the floor click's `cancelJoin()` removed: `expected
   * 1 to be +0`.
   */
  it('click an end, then the floor: nothing is armed', async () => {
    const { container } = await openLoop();
    fireEvent.click(button(/free socket end/i));
    expect(container.querySelectorAll('.port-ring').length).toBe(1);
    fireEvent.click(container.querySelector('svg.canvas, .canvas-area svg')!);
    expect(container.querySelectorAll('.port-ring').length).toBe(0);
  });
});

describe('a join is said on screen (DR5)', () => {
  /*
   * MUTATION PROOF, run: joins not noted (`'joined'` never set): `Unable to
   * find an accessible element with the role "group" and name "Last move"`.
   */
  it('names the two ends with Undo, and Undo takes the joint back', async () => {
    const { user } = await openLoop();
    fireEvent.click(button(/free socket end/i));
    fireEvent.click(button(/free peg end/i));
    const line = screen.getByRole('group', { name: 'Last move' });
    expect(line.textContent).toMatch(/^Joined /);
    const joints = screen.getAllByRole('button', { name: 'Break this joint' }).length;
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getAllByRole('button', { name: 'Break this joint' }).length).toBe(joints - 1);
    expect(screen.queryByRole('group', { name: 'Last move' })).toBe(null);
  });
});
