/**
 * A TRAIN RUN IS SHOWN IN THE 3D VIEW TOO (plan 2026-11-14, E5; DESIGN.md
 * rule 8).
 *
 * Value: protects=a run started in the editor is handed to the 3D viewer with
 * the moment it began; the same run is still the one shown after the view is
 * changed; any edit takes it away; under reduced motion the viewer is given
 * no train
 * Value: fails_when=the 3D view shows no train during a run, starts the run
 * again when the view changes, keeps the train after an edit, or moves under
 * reduced motion
 * Value: seam=`Viewer3D.js` is mocked (jsdom has no WebGL), as in
 * view3dDesign.dom.test.tsx; the mock says what train it was given
 * Value: no_claim=where the train is drawn or how; viewer3dTrain.test.ts and
 * the browser pass cover that
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { train?: { run: { trainMm: number }; startedMs: number } | null }) => (
    <div data-testid="viewer3d" data-train={props.train ? `${props.train.run.trainMm}@${props.train.startedMs}` : 'none'} />
  ),
}));

afterEach(() => vi.unstubAllGlobals());

const WAIT = { timeout: 8000 };
const button = (name: string) => screen.getAllByRole('button', { name })[0]!;
const preset = (label: string) =>
  screen.getAllByRole('button').find((b) => b.textContent === label && b.closest('.palette-controls'))!;
const viewer = () => screen.findByTestId('viewer3d', undefined, WAIT);
const given = async () => (await viewer()).dataset.train;

describe('a train run in the 3D view', () => {
  /*
   * MUTATION PROOF, run: App.tsx stops passing `train` to the editor's
   * View3DPanel: `expected 'none' to match /^55@/`.
   *
   * MUTATION PROOF, run: View3DPanel drops `train` from the viewer's props:
   * the same failure.
   */
  it('is handed to the viewer, is the same run after the view changes, and is gone after an edit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(button('3D'));
    expect(await given()).toBe('none');

    await user.click(await screen.findByRole('button', { name: 'Run a train' }, WAIT));
    await screen.findByRole('button', { name: 'Stop the train' }, WAIT);
    const first = await given();
    expect(first).toMatch(/^55@\d/);

    // To the plan and back: one run, counted from the same moment.
    await user.click(button('2D'));
    expect(document.querySelector('.train-mark')).not.toBe(null);
    await user.click(button('3D'));
    expect(await given()).toBe(first);

    await user.click(preset('Circle'));
    expect(await given()).toBe('none');
  });

  /*
   * MUTATION PROOF, run: App.tsx passes `trainShown` whatever the motion
   * setting (`stillMotion ? null :` removed): `expected '55@…' to be 'none'`.
   */
  it('gives the viewer no train under reduced motion, and still says the run', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(button('3D'));
    await user.click(await screen.findByRole('button', { name: 'Run a train' }, WAIT));
    expect(await screen.findByText('A train gets all the way round.', undefined, WAIT)).toBeTruthy();
    expect(await given()).toBe('none');
  });
});
