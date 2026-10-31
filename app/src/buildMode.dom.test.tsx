/**
 * BUILD MODE, END TO END IN THE EDITOR (build mode plan: scope 1-10; D10,
 * D25, D27, D32, D33, D35, D37-D41, D46, D50, D51).
 *
 * Value: protects=Build it opens the pull list and Start walks the layout a
 * piece at a time; a tap or swipe moves one step, never two, and never from a
 * button; keys move too; leaving by Esc or Back returns to the editor with
 * focus on Build it and the layout untouched; a build is picked up where it
 * was left; the adapter line comes first; the end says what is true; the
 * build screen never animates
 * Value: fails_when=any of those transitions, guards or sentences goes
 * missing or wrong
 * Value: why_new=no build mode existed
 * Value: seam=`Viewer3D.js` is mocked (jsdom has no WebGL) and reports
 * "drawn" as the real one does after each scene; `performance.now` is set by
 * hand for the tap guard
 * Value: no_claim=the real picture, pointer behaviour on a tablet, or the
 * wake lock on a device (the scripted browser pass)
 */

import { StrictMode, useEffect } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import BuildMode, { bandWords, TAP_GUARD_MS } from './BuildMode.js';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: unknown }) => {
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

let now = 10_000;
beforeEach(() => {
  now = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const said = () => [...document.querySelectorAll('.build-mode [role="status"]')].map((n) => n.textContent).join(' ');
const meta = () => document.querySelector('.build-meta')?.textContent ?? '';
const picture = () => document.querySelector('.build-picture')!;
const tap = (x = 100, y = 100) => {
  fireEvent.pointerDown(picture(), { clientX: x, clientY: y });
  fireEvent.pointerUp(picture(), { clientX: x, clientY: y });
};
const swipe = (dx: number) => {
  fireEvent.pointerDown(picture(), { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(picture(), { clientX: 200 + dx, clientY: 104 });
};
/** Start, and wait for the first picture: until it draws, build mode holds still (D37). */
async function start(user: ReturnType<typeof userEvent.setup>, label = 'Start') {
  await user.click(button(label));
  await screen.findByTestId('viewer3d');
  await waitFor(() => expect(meta()).toMatch(/^Step \d+ of \d+$/));
}
/** Past the tap guard, as a person pausing between pieces would be. */
const later = () => {
  now += TAP_GUARD_MS + 1;
};

async function building() {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(button('Stadium'));
  await user.click(button('Build it'));
  await screen.findByRole('heading', { name: 'Get these out of the box' });
  return user;
}

describe('into build mode and out (scope 1, D10, D27)', () => {
  /*
   * MUTATION PROOF, run: `if (building && buildScene)` made false (build mode
   * never shown): `Unable to find role="heading" and name "Get these out of
   * the box"`.
   */
  it('Build it opens the pull list; Start shows the first piece, announced', async () => {
    const user = await building();
    expect(screen.getByText('Large curve')).toBeTruthy();
    await start(user);
    expect(meta()).toBe('Step 1 of 10');
    expect(said()).toMatch(/^(Large curve|Long straight), [ED]\. Step 1 of 10\./);
  });

  /*
   * MUTATION PROOF, run: `enabled: !building` dropped from useEditorKeys:
   * KEYS_MESSAGE
   */
  it('Esc returns to the editor with focus on Build it, and editor shortcuts did nothing meanwhile', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await user.click(button('Stadium'));
    // One placed piece, so Cmd+Z has something it could undo.
    await user.click(button(/^Add Medium straight/));
    await user.click(button(/^Place/));
    expect(screen.getByText(/This layout, as a list: 11 pieces/)).toBeTruthy();
    await user.click(button('Build it'));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    await start(user);
    await user.keyboard('{Meta>}z{/Meta}');
    await user.keyboard('{Escape}');
    expect(document.querySelector('.build-mode')).toBe(null);
    expect(document.activeElement?.textContent).toBe('Build it');
    // Still eleven pieces: the undo never reached the editor.
    expect(screen.getByText(/This layout, as a list: 11 pieces/)).toBeTruthy();
  });

  it('the system Back gesture leaves build mode (D10)', async () => {
    const user = await building();
    await start(user);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    expect(document.querySelector('.build-mode')).toBe(null);
  });
});

describe('moving through the build (D25, D40, D50, D51)', () => {
  /*
   * MUTATION PROOF, run: the tap guard removed (`if (fromTap && …) return`
   * dropped): `expected 'Step 3 of 10' to be 'Step 2 of 10' // Object.is
   * equality`.
   */
  it('a double tap moves one step; a tap after a pause moves the next', async () => {
    const user = await building();
    await start(user);
    later();
    tap();
    now += 50;
    tap();
    expect(meta()).toBe('Step 2 of 10');
    later();
    tap();
    expect(meta()).toBe('Step 3 of 10');
  });

  it('a swipe right goes back, a swipe left goes on, and a short drag does nothing', async () => {
    const user = await building();
    await start(user);
    later();
    tap();
    expect(meta()).toBe('Step 2 of 10');
    swipe(80);
    expect(meta()).toBe('Step 1 of 10');
    swipe(-80);
    expect(meta()).toBe('Step 2 of 10');
    swipe(30);
    expect(meta()).toBe('Step 2 of 10');
  });

  /*
   * MUTATION PROOF, run: the `closest('button, .build-dead')` check removed:
   * `expected 'Step 2 of 10' to be 'Step 1 of 10' // Object.is equality`,
   * the tap on the corner also advanced.
   */
  it('a tap in the corner’s dead zone does nothing', async () => {
    const user = await building();
    await start(user);
    later();
    const dead = document.querySelector('.build-dead')!;
    fireEvent.pointerDown(dead, { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(dead, { clientX: 5, clientY: 5 });
    expect(meta()).toBe('Step 1 of 10');
  });

  /*
   * MUTATION PROOF, run: `if (e.repeat) return` removed: `expected 'Step 3
   * of 10' to be 'Step 2 of 10' // Object.is equality`.
   */
  it('Right and Left step; a held key moves once; Previous and Next are real buttons', async () => {
    const user = await building();
    await start(user);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight', repeat: true });
    expect(meta()).toBe('Step 2 of 10');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(meta()).toBe('Step 1 of 10');
    await user.click(button('Next step'));
    expect(meta()).toBe('Step 2 of 10');
    await user.click(button('Previous step'));
    expect(meta()).toBe('Step 1 of 10');
  });

  it('the last screen says what is true and does not advance further (D38)', async () => {
    const user = await building();
    await start(user);
    for (let i = 0; i < 10; i++) fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('That’s the last piece.')).toBeTruthy();
    expect(document.querySelector('.build-code-line')!.textContent).toBe('All 10 pieces are down.');
    tap();
    expect(screen.getByText('That’s the last piece.')).toBeTruthy();
  });
});

describe('picking up where it was left (scope 5, D35)', () => {
  /*
   * MUTATION PROOF, run: Continue goes to the first piece (`go(1)` for
   * both): `expected 'Step 1 of 10' to be 'Step 3 of 10' // Object.is
   * equality`.
   */
  it('reopening shows where it was left, Continue goes there, Start again starts over', async () => {
    const user = await building();
    await start(user);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await user.keyboard('{Escape}');
    await user.click(button('Build it'));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    expect(document.querySelector('.build-resume')!.textContent).toBe('Picking up at step 3.');
    await start(user, 'Continue');
    expect(meta()).toBe('Step 3 of 10');
    await user.keyboard('{Escape}');
    await user.click(button('Build it'));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    await start(user, 'Start again');
    expect(meta()).toBe('Step 1 of 10');
  });

  it('reaching the end forgets the build', async () => {
    const user = await building();
    await start(user);
    for (let i = 0; i < 10; i++) fireEvent.keyDown(document, { key: 'ArrowRight' });
    await user.keyboard('{Escape}');
    await user.click(button('Build it'));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    expect(document.querySelector('.build-resume')).toBe(null);
    expect(button('Start')).toBeTruthy();
  });
});

describe('the words (D33, D41)', () => {
  it('a band card names the band that ended and the one starting', () => {
    expect(bandWords({ kind: 'band', band: 1, phase: 'ramp', level: 0 }, 0)).toEqual({ done: 'Floor done.', now: 'Now the ramps that climb to level 1.' });
    expect(bandWords({ kind: 'band', band: 2, phase: 'raised', level: 1 }, 1)).toEqual({ done: 'Ramps done.', now: 'Now the track on level 1.' });
  });

  /*
   * MUTATION PROOF, run: the adapter line moved after the name: `expected
   * 'Medium straight' to be 'Adapter first: male-male' // Object.is
   * equality`.
   */
  it('a step that seats a socket-to-socket joint opens with the adapter line', async () => {
    const resolve = makeResolver(BUILT_IN);
    const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
    const g: Graph = {
      pieces: [
        { pieceId: 'p0', partId: 'A', turn: 'left' },
        { pieceId: 'p1', partId: 'A', turn: 'left' },
      ],
      welds: [{ a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } }],
    };
    const r = renderGraph(g, ports, resolve, placeAll(g, ports));
    render(
      <BuildMode
        graph={g}
        segments={r.segments}
        result={{ ok: false, detail: '', adapterJoints: [{ weld: 0, between: ['p0', 'p1'] }] } as never}
        scene={{ segments: r.segments, ports: r.ports, welds: g.welds, partOf: (id) => resolve(g.pieces.find((p) => p.pieceId === id)!.partId), riseMm: 64, plankMm: 12 }}
        partName={(id) => resolve(id).name}
        pull={{ rows: [], adapters: { count: 1, short: 0 } }}
        verdict={null}
        verdictPass
        segmentCount={r.segments.length}
        ceiling={10000}
        allSaved
        onExit={() => {}}
      />,
    );
    await start(userEvent.setup());
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    const names = [...document.querySelectorAll('.build-label .build-name')].map((n) => n.textContent);
    expect(names[0]).toBe('Adapter first: male-male');
    expect(names[1]).toBe('Medium straight');
  });
});

describe('no motion (D46)', () => {
  /*
   * MUTATION PROOF, run: `transition: opacity var(--settle-ms)` added to
   * `.build-step`: `expected [ 'transition' ] to deeply equal []`.
   */
  it('nothing in build mode’s styles animates', () => {
    const css = readFileSync(join(__dirname, 'app.css'), 'utf8');
    const block = css.slice(css.indexOf(' * BUILD MODE (docs/plan/2026-10-31-build-mode.md'));
    expect(block.length).toBeGreaterThan(100);
    expect(block.match(/\b(transition|animation)\b(?=\s*:)/g) ?? []).toEqual([]);
  });
});
