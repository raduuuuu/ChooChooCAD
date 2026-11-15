/**
 * RUN A TRAIN, ON SCREEN (plan 2026-11-14, E5, step 6).
 *
 * Value: protects=a layout whose joints all meet offers a train run; the run
 * shows its sentences and one moving mark; any edit, a hidden tab or Stop
 * ends it; a layout that does not join up is not run; under reduced motion
 * nothing moves
 * Value: fails_when=the run is offered on a layout that does not close, is
 * left running after an edit, moves under reduced motion, or the mark is not
 * placed by the run
 * Value: seam=jsdom plus testing-library, in the `dom` project
 * Value: no_claim=nothing about how the train looks or how smoothly it moves;
 * that was checked in a browser. Where it is at a moment is pinned in
 * playback.test.ts
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { storedGraphOf } from './layoutStore.js';
import { presetByLabel } from './presets.js';
import { initialEditor, reduce } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { portsOf, type Piece } from '../../engine/src/graph/model.js';
import { presetGraph, verdictKind } from './presetVerdict.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';
import { TrainControl, TrainMark } from './TrainControl.js';
import type { TrainRun } from './trainRun.js';

afterEach(() => vi.unstubAllGlobals());

const runButton = () => screen.queryByRole('button', { name: 'Run a train' }) as HTMLButtonElement | null;
/** The button once the app has drawn its layout. The walker loads on the first press, which can take a moment in a test. */
const WAIT = { timeout: 8000 };
const ready = () => screen.findByRole('button', { name: 'Run a train' }, WAIT) as Promise<HTMLButtonElement>;
const said = (text: string) => screen.findByText(text, undefined, WAIT);
const stopping = () => screen.findByRole('button', { name: 'Stop the train' }, WAIT);
const stopButton = () => screen.queryByRole('button', { name: 'Stop the train' });
const mark = () => document.querySelector('.train-mark');
const preset = (label: string) =>
  screen.getAllByRole('button').find((b) => b.textContent === label && b.closest('.palette-controls'))!;

describe('run a train, in the app', () => {
  /*
   * MUTATION PROOF, run: `trainRun` in App.tsx made `train?.run ?? null`
   * (the layout it was planned for not compared): the run and its mark are
   * still there after another layout is loaded.
   */
  it('runs on a layout that works, and any edit ends the run', async () => {
    const user = userEvent.setup();
    render(<App />);
    // A test page opens on an empty floor: nothing to run a train on, and no button.
    expect(runButton()).toBe(null);
    await user.click(preset('Stadium'));
    expect((await ready()).disabled).toBe(false);
    await user.click(runButton()!);
    expect(await said('A train gets all the way round.')).toBeTruthy();
    expect(document.body.textContent).toContain('This is the 55mm train the app measures with');
    expect(stopButton()).not.toBe(null);
    expect(mark()?.querySelector('.train-car')?.getAttribute('transform')).toMatch(/^translate\(/);

    await user.click(preset('Circle'));
    expect(mark()).toBe(null);
    expect(stopButton()).toBe(null);
    expect(runButton()).not.toBe(null);
  });

  /*
   * UNDO PUTS THE SAME LAYOUT BACK, NOT THE RUN. Undo restores the very
   * layout object the run was planned for, so "is this still that layout"
   * says yes again.
   *
   * MUTATION PROOF, run: the effect in App.tsx that clears the run on every
   * change to the layout removed: after Undo the Stop button and the mark
   * are back, `expected <button …> to be null`.
   */
  it('an edit ends the run for good: Undo does not bring it back', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(await ready());
    await stopping();
    await user.click(screen.getByRole('button', { name: 'Remove last' }));
    expect(stopButton()).toBe(null);
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(stopButton()).toBe(null);
    expect(mark()).toBe(null);
    expect(runButton()).not.toBe(null);
  });

  it('stops when asked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(await ready());
    await user.click(await stopping());
    expect(mark()).toBe(null);
    expect(runButton()).not.toBe(null);
  });

  /*
   * NOT ON A LAYOUT THAT DOES NOT JOIN UP (owner, choice C8).
   *
   * MUTATION PROOF, run: `canRunTrain` in App.tsx made `true`: the button is
   * live on a ring whose ends do not meet.
   */
  it('is not offered on a layout whose loop does not close, and says why', async () => {
    const resolve = makeResolver(BUILT_IN);
    const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
    // Six large curves joined into a ring: three quarters of a circle, its ends far apart.
    const broken = reduce(initialEditor(EMPTY_GRAPH, ports), { kind: 'preset', ids: Array<string>(6).fill('E') }, ports).graph;
    expect(['EXACT', 'NEEDS_GIVE', 'NO_CYCLE']).not.toContain(verdictKind(broken));
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(storedGraphOf(broken)));
    render(<App />);
    expect((await ready()).disabled).toBe(true);
    expect(document.body.textContent).toContain('The track does not join up yet, so no train is run on it.');
  });

  /*
   * MUTATION PROOF, run: the `!stillMotion` test on the overlay in App.tsx
   * removed: the mark is drawn, and moves, for someone who asked for no motion.
   */
  it('under reduced motion, says what the run would do and moves nothing', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === '(prefers-reduced-motion: reduce)',
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(await ready());
    expect(await said('A train gets all the way round.')).toBeTruthy();
    expect(mark()).toBe(null);
  });

  /*
   * MUTATION PROOF, run: the `visibilitychange` listener in App.tsx removed:
   * the run is still going when the tab comes back.
   */
  it('ends the run when the tab is hidden', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(preset('Stadium'));
    await user.click(await ready());
    await stopping();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    expect(stopButton()).toBe(null);
    expect(mark()).toBe(null);
  });

  it('runs a layout with no loop at all, to the end of its track', async () => {
    const open = presetGraph(presetByLabel('Stadium'));
    // The stadium with its closing joint left off: one open run of ten pieces.
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(storedGraphOf({ ...open, welds: open.welds.slice(0, -1) })));
    const user = userEvent.setup();
    render(<App />);
    expect((await ready()).disabled).toBe(false);
    await user.click(runButton()!);
    expect(await said('A train runs to the end of the track at piece 10.')).toBeTruthy();
  });
});

describe('the train mark', () => {
  const at = (x: number, done = false) => ({ pose: { x, y: 5, h: Math.PI / 2 }, level: 0, pieceId: 'p', on: null, t: 0, done });
  const inSvg = (run: Pick<TrainRun, 'carsAt'>) => render(<svg><TrainMark run={run} /></svg>);
  const cars = () => [...mark()!.querySelectorAll('.train-car')];

  /*
   * AN ENGINE AND TWO WAGONS, EACH PLACED BY THE RUN. MUTATION PROOFS, run:
   * - the `setAttribute` in `TrainMark` removed: `expected [ null, null,
   *   null ] to deeply equal [ 'translate(120 5) rotate(90)', … ]` here, and
   *   the app spec above fails on a mark with no place.
   * - every car given the engine's place (`cars[0]` for all): `expected
   *   [ 'translate(120 5) rotate(90)', …(2) ] to deeply equal …` with the two
   *   wagons on the engine.
   * - a car left hidden once placed (`removeAttribute('visibility')`
   *   dropped): `expected [ 'hidden', 'hidden', 'hidden' ] to deeply equal
   *   [ null, null, null ]`.
   */
  it('is three cars, each put where the run says, facing the way it says', () => {
    inSvg({ carsAt: () => [at(120), at(58), at(6)] });
    expect(cars().map((c) => c.getAttribute('class'))).toEqual(['train-car is-engine', 'train-car is-wagon', 'train-car is-wagon']);
    expect(cars().map((c) => c.getAttribute('transform'))).toEqual(['translate(120 5) rotate(90)', 'translate(58 5) rotate(90)', 'translate(6 5) rotate(90)']);
    expect(cars().map((c) => c.getAttribute('visibility'))).toEqual([null, null, null]);
    // The engine is told from a wagon by its chimney, the one paper disc.
    expect(cars().map((c) => c.querySelectorAll('.train-light').length)).toEqual([1, 0, 0]);
  });

  it('shows no car before it has a place', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    inSvg({ carsAt: () => [] });
    expect(cars().map((c) => c.getAttribute('visibility'))).toEqual(['hidden', 'hidden', 'hidden']);
  });

  /*
   * NOTHING KEEPS RUNNING. MUTATION PROOF, run: the `if (!cars[0]?.done)` test
   * removed, so a finished run asks for frames for ever; and the cleanup's
   * `cancelAnimationFrame` removed, so an unmounted mark's frame still fires.
   */
  it('asks for no more frames once the run is done, and cancels its frame when it goes', () => {
    const asked: FrameRequestCallback[] = [];
    const cancelled: number[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => asked.push(cb));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => void cancelled.push(id));

    const done = inSvg({ carsAt: () => [at(504, true)] });
    expect(asked).toHaveLength(0);
    done.unmount();

    const going = inSvg({ carsAt: () => [at(10)] });
    expect(asked).toHaveLength(1);
    going.unmount();
    expect(cancelled).toEqual([1]);
  });
});

describe('the train button', () => {
  it('is off, with the reason, where a run is not offered', () => {
    render(<TrainControl run={null} whyNot="No." onRun={() => undefined} onStop={() => undefined} />);
    expect(runButton()!.disabled).toBe(true);
    expect(document.body.textContent).toContain('No.');
  });
});
