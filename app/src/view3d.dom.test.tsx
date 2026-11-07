/**
 * THE 2D/3D SWITCH AND EVERY STATE THE 3D VIEW CAN BE IN (3D plan: eng D9,
 * D10, D13, D14, D17; design 1A, 2A, 4A-8A, 10A-12A).
 *
 * Value: protects=3D replaces the canvas and comes back; the choice is
 * remembered unless the layout is empty; picking a part returns to 2D and
 * says so; pressing 3D cancels a piece being placed; a failed download, a
 * browser without WebGL and a lost context each say what happened, and a
 * second failed download offers Reload only when everything is saved; an
 * empty layout offers the preset; too big a layout says so with its figures;
 * a piece clicked in 3D is selected for 2D and said, and build mode picks
 * nothing (P3, pick in 3D)
 * Value: fails_when=any of those words, buttons or transitions goes missing
 * or wrong
 * Value: why_new=no 3D view existed
 * Value: seam=`Viewer3D.js` is mocked (jsdom has no WebGL); the mock throws
 * or reports a lost context on demand, and the real boundary, panel and App
 * do the rest
 * Value: no_claim=that the real viewer draws; the browser pass is that check
 * (eng D15, design 24A)
 */

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAINT_TOKENS } from '../../engine/data/library.js';
import { App } from './App.js';
import { VIEW_STORAGE_KEY } from './storageKeys.js';
import { View3DPanel } from './View3DPanel.js';

const viewer = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' | 'webgl' }));
vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; paintTokens?: readonly string[]; onContextLost: () => void; input: { segments: readonly { pieceId?: string }[]; selected?: string }; onPick?: (id: string) => void }) => {
    if (viewer.mode === 'throw') throw new TypeError('Failed to fetch dynamically imported module');
    if (viewer.mode === 'webgl') {
      const e = new Error('no WebGL');
      e.name = 'WebGLUnavailable';
      throw e;
    }
    return (
      <div data-testid="viewer3d" aria-label={props.label} data-paints={(props.paintTokens ?? []).join(' ')} data-selected={props.input.selected ?? ''} data-third={[...new Set(props.input.segments.map((s) => s.pieceId))].filter(Boolean)[2] ?? ''}>
        <button onClick={props.onContextLost}>simulate context loss</button>
        {props.onPick && (
          // A click on the third piece drawn, as the real viewer's ray would report it.
          <button onClick={() => props.onPick!([...new Set(props.input.segments.map((s) => s.pieceId))].filter(Boolean)[2]!)}>
            simulate pick
          </button>
        )}
      </div>
    );
  },
}));

afterEach(() => {
  viewer.mode = 'ok';
  vi.restoreAllMocks();
});

const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const canvas2d = () => screen.queryByRole('img', { name: 'Track layout' });
const viewer3d = () => screen.queryByTestId('viewer3d');
const said = () => document.querySelector('p.sr-only[role="status"]')!.textContent;

function app() {
  const user = userEvent.setup();
  const r = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return { user, ...r };
}

describe('the switch', () => {
  /*
   * MUTATION PROOFS, run:
   * - `showView` returns before switching (`return;` first): `Unable to
   *   find an element by: [data-testid="viewer3d"]`.
   * - the panel's `paintTokens` left out: `expected '' to be '--paint-base
   *   --paper --paint-grey --i…' // Object.is equality`.
   */
  it('3D replaces the canvas, Reset appears, and 2D brings the canvas back', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    expect(button('2D').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Reset view' })).toBe(null);

    await user.click(button('3D'));
    expect(await screen.findByTestId('viewer3d')).not.toBe(null);
    expect(canvas2d()).toBe(null);
    expect(button('3D').getAttribute('aria-pressed')).toBe('true');
    expect(button('Reset view')).toBeTruthy();
    expect(viewer3d()!.getAttribute('aria-label')).toBe('3D view of the layout: 10 pieces, 1 level, 0 marks');
    // Every built-in paint, handed in so the viewer need not import the library (chunk budget).
    expect(viewer3d()!.getAttribute('data-paints')).toBe(PAINT_TOKENS.join(' '));

    await user.click(button('2D'));
    expect(canvas2d()).not.toBe(null);
    expect(viewer3d()).toBe(null);
  });

  /*
   * MUTATION PROOF, run: `openingView` ignores the piece count (always the
   * remembered view): `expected <p class="canvas-empty-lead"></p> to be null`.
   */
  it('remembers 3D across a reload, but an empty layout opens 2D (design 11A)', async () => {
    const first = app();
    await first.user.click(button('Stadium'));
    await first.user.click(button('3D'));
    first.unmount();
    const second = app();
    expect(await screen.findByTestId('viewer3d')).not.toBe(null);
    second.unmount();

    localStorage.clear();
    localStorage.setItem(VIEW_STORAGE_KEY, '3d');
    app();
    // 2D's own empty state, not 3D's (an empty 2D canvas draws no picture).
    expect(screen.queryByText('Nothing to show in 3D yet.')).toBe(null);
    expect(screen.getByText('Nothing on the floor yet.')).toBeTruthy();
    expect(button('2D').getAttribute('aria-pressed')).toBe('true');
  });

  /*
   * MUTATION PROOF, run: the 3D branch of `pick` removed: `expected null not
   * to be null` (still in 3D, no canvas).
   */
  it('picking a part in 3D goes back to 2D with it, and says so (D10, 12A)', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await screen.findByTestId('viewer3d');
    await user.click(button(/^Add Medium straight/));
    expect(canvas2d()).not.toBe(null);
    expect(screen.queryByRole('group', { name: 'Placing a piece' })).not.toBe(null);
    expect(said()).toMatch(/^Back in 2D to place the piece\. Placing Medium straight\./);
  });

  /*
   * MUTATION PROOF, run: `showView` no longer cancels the ghost: `expected
   * <div class="mode-strip" …(2)>…(4)</div> to be null`.
   */
  it('pressing 3D while placing cancels the piece (eng D17)', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button(/^Add Medium straight/));
    expect(screen.queryByRole('group', { name: 'Placing a piece' })).not.toBe(null);
    await user.click(button('3D'));
    await user.click(button('2D'));
    expect(screen.queryByRole('group', { name: 'Placing a piece' })).toBe(null);
  });

  it('an empty layout in 3D offers the same preset as 2D (design 5A)', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await user.click(button('Clear'));
    expect(screen.getByText('Nothing to show in 3D yet.')).toBeTruthy();
    await user.click(button(/^Build a /));
    expect(await screen.findByTestId('viewer3d')).not.toBe(null);
  });
});

describe('a piece clicked in 3D (P3, pick in 3D)', () => {
  /*
   * MUTATION PROOF, run: `pickIn3d` does nothing (its body replaced by
   * `void pieceId;`): `expected undefined to be truthy` (nothing said, so no
   * name), and the next test's `expected null not to be null`.
   */
  it('is selected in the editor, so 2D shows it selected, and the pick is said', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await screen.findByTestId('viewer3d');
    expect(screen.queryByRole('group', { name: 'Selected piece' })).toBe(null);
    await user.click(button('simulate pick'));
    const name = /^Selected (Piece \d+: [^,]+),/.exec(said())?.[1];
    expect(name).toBeTruthy();
    // Still in 3D: a pick does not move the view.
    expect(viewer3d()).not.toBe(null);
    await user.click(button('2D'));
    const strip = screen.getByRole('group', { name: 'Selected piece' });
    expect(strip.textContent).toContain(name!);
  });

  /*
   * THE SELECTION IS MARKED IN 3D (P3, owner 2026-11-05): the scene is given
   * the selected piece, picked there or carried over from 2D, and nothing
   * before one is picked.
   * MUTATION PROOF, run: the editor's scene built without `selected`:
   * `expected '' to be 'p2' // Object.is equality`.
   */
  it('the 3D view is given the selected piece to outline, and nothing without one', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    const v = await screen.findByTestId('viewer3d');
    expect(v.getAttribute('data-selected')).toBe('');
    await user.click(button('simulate pick'));
    const picked = screen.getByTestId('viewer3d');
    expect(picked.getAttribute('data-selected')).toBe(picked.getAttribute('data-third'));
    // Carried over: back to 2D and into 3D again, still marked.
    await user.click(button('2D'));
    await user.click(button('3D'));
    const again = await screen.findByTestId('viewer3d');
    expect([again.getAttribute('data-selected'), again.getAttribute('data-third')!.length > 0]).toEqual([picked.getAttribute('data-third'), true]);
  });

  /*
   * MUTATION PROOF, run: `pickIn3d` dispatches `selectPiece` even when the
   * piece is already selected, so the reducer's toggle lets it go: `expected
   * null not to be null`.
   */
  it('a second click on the same piece keeps it selected', async () => {
    const { user } = app();
    await user.click(button('Stadium'));
    await user.click(button('3D'));
    await screen.findByTestId('viewer3d');
    await user.click(button('simulate pick'));
    await user.click(button('simulate pick'));
    await user.click(button('2D'));
    expect(screen.queryByRole('group', { name: 'Selected piece' })).not.toBe(null);
  });

  /*
   * MUTATION PROOF, run: the panel passes `onPick` whether or not a view is
   * live (`live &&` dropped): `expected <button></button> to be null`.
   */
  it('build mode passes no pick to the viewer', async () => {
    const input = { segments: [], ports: [], welds: [], partOf: () => { throw new Error('unused'); }, riseMm: 64, plankMm: 12 };
    const panel = (build: { focus: string[] } | null) => (
      <View3DPanel
        input={input}
        pieceCount={3}
        segmentCount={3}
        ceiling={10000}
        allSaved
        emptyAction={null}
        tableNote={null}
        label="3D"
        resetSignal={0}
        corner={null}
        build={build}
        onPick={() => {}}
      />
    );
    const r = render(panel(null));
    expect(await screen.findByRole('button', { name: 'simulate pick' })).toBeTruthy();
    r.rerender(panel({ focus: [] }));
    expect(await screen.findByTestId('viewer3d')).not.toBe(null);
    expect(screen.queryByRole('button', { name: 'simulate pick' })).toBe(null);
  });
});

describe('when 3D cannot be shown', () => {
  async function in3d() {
    const r = app();
    await r.user.click(button('Stadium'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await r.user.click(button('3D'));
    return r;
  }

  /*
   * MUTATION PROOF, run: the second-failure branch removed (every download
   * failure reads as the first): `Unable to find an element with the text:
   * /Still couldn’t load the 3D view\. Reloading the app usually fixes
   * this\. Your layout is saved\./`.
   */
  it('a failed download offers Try again; a second one offers Reload, since the layout is saved (D13, D14, 8A)', async () => {
    viewer.mode = 'throw';
    const { user } = await in3d();
    expect(await screen.findByText('Couldn’t load the 3D view.')).toBeTruthy();
    expect(canvas2d()).toBe(null);
    expect(button('2D')).toBeTruthy();
    await user.click(button('Try again'));
    expect(await screen.findByText(/Still couldn’t load the 3D view\. Reloading the app usually fixes this\. Your layout is saved\./)).toBeTruthy();
    expect(button('Reload')).toBeTruthy();
    // And the editor is still there.
    await user.click(button('2D'));
    expect(canvas2d()).not.toBe(null);
  });

  /*
   * MUTATION PROOF, run: `allSaved` passed as `true`: `Unable to find an
   * element with the text: /Reloading now would lose changes that aren’t
   * saved; keep working in 2D\./`.
   */
  it('when a save failed, a second failure does not offer Reload (D14)', async () => {
    viewer.mode = 'throw';
    const { user } = await in3d();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(button('Stadium'));
    await user.click(button('Try again'));
    expect(await screen.findByText(/Reloading now would lose changes that aren’t saved; keep working in 2D\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBe(null);
  });

  it('a browser without WebGL is told so (D9)', async () => {
    viewer.mode = 'webgl';
    await in3d();
    expect(await screen.findByText('This browser can’t draw 3D. The 2D plan has everything.')).toBeTruthy();
  });

  /*
   * MUTATION PROOF, run: `onContextLost` reports a download failure
   * (`kind: 'download'`): `Unable to find an element with the text: The 3D
   * view stopped. Try again..`.
   */
  it('a lost graphics context says the view stopped, and Try again brings it back (7A)', async () => {
    const { user } = await in3d();
    await user.click(await screen.findByRole('button', { name: 'simulate context loss' }));
    expect(screen.getByText('The 3D view stopped. Try again.')).toBeTruthy();
    await user.click(button('Try again'));
    expect(await screen.findByTestId('viewer3d')).not.toBe(null);
  });
});

describe('too big to draw (eng D12, design 6A)', () => {
  it('says how many pieces, the limit, and where the whole layout still is', () => {
    render(
      <View3DPanel
        input={{ segments: [], ports: [], welds: [], partOf: () => { throw new Error('unused'); }, riseMm: 64, plankMm: 12 }}
        pieceCount={12000}
        segmentCount={12345}
        ceiling={10000}
        allSaved
        emptyAction={null}
        tableNote={null}
        label=""
        resetSignal={0}
        corner={null}
      />,
    );
    expect(screen.getByText(/more than 3D can/).textContent).toBe(
      'This layout has 12,345 pieces of track, more than 3D can draw (10,000). The 2D plan and the verdict still cover all of it.',
    );
  });
});
