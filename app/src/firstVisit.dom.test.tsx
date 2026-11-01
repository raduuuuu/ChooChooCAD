/**
 * THE FIRST-VISIT EXAMPLE AND THE PHONE SCREEN (share plan; design 3A, 19A;
 * eng D65, D66, D68, D70, D71).
 *
 * Value: protects=a browser with nothing stored opens on the Stadium,
 * labelled as an example, and writes no layout until it is edited; a stored
 * layout or a rescue copy means no example; Start my own clears to an empty
 * editor and writes nothing; the example blocks only the layout key, so the
 * table still saves; on a phone the example and your own layout are shown
 * read-only in the friend's composition; turning across 620px keeps the
 * layout and its permissions follow; build progress goes to the slot of
 * whoever owns the layout, whatever the width
 * Value: fails_when=the example is saved on mount, shown over a stored
 * layout, blocks the other stores, can be edited on a phone, loses the
 * layout on rotation, or a build of your own layout lands in the link slot
 * Value: why_new=the first visit was a blank floor and a phone saw only "needs
 * a larger screen"
 * Value: seam=App mounted under jsdom with `offerExample`, as main.tsx mounts
 * it; `matchMedia` stubbed with a width the test can turn; `Viewer3D.js`
 * mocked as build mode's own test does (jsdom has no WebGL)
 * Value: no_claim=how the phone screen looks at 360 and 390px (checked in a
 * browser)
 */

import { StrictMode, useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { place } from '../test/place.js';
import { App } from './App.js';
import { PHONE_DESIGN_ELSEWHERE } from './linkWords.js';
import { BUILD_LINK_STORAGE_KEY, BUILD_STORAGE_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY, TABLE_STORAGE_KEY } from './storageKeys.js';
import { NARROW_QUERY } from './useMatchMedia.js';

vi.mock('./Viewer3D.js', () => ({
  default: (props: { label: string; onDrawn?: () => void; input: unknown }) => {
    useEffect(() => {
      props.onDrawn?.();
    }, [props.input]);
    return <div data-testid="viewer3d" aria-label={props.label} />;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const visit = () =>
  render(
    <StrictMode>
      <App offerExample />
    </StrictMode>,
  );
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const storedPieces = () => (JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY) ?? 'null') as { pieces: unknown[] } | null)?.pieces.length;
const FOUR = JSON.stringify({ pieces: ['a', 'b', 'c', 'd'].map((pieceId) => ({ pieceId, partId: 'A' })), welds: [], anchors: [] });

/** A window whose width the test can turn across NARROW_QUERY. */
function width(narrow: boolean) {
  let isNarrow = narrow;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() {
      return q === NARROW_QUERY && isNarrow;
    },
    media: q,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  }));
  return (next: boolean) =>
    act(() => {
      isNarrow = next;
      listeners.forEach((f) => f());
    });
}

describe('the first-visit example (3A, D66, D68)', () => {
  /*
   * MUTATION PROOF, run: `!screen.saveLayout` dropped from the save effect's
   * guard: `expected 10 to be undefined`, the example written on mount.
   */
  it('nothing stored: the Stadium, labelled, and no layout written', () => {
    visit();
    expect(screen.getByRole('group', { name: 'An example' }).textContent).toContain('An example · 10 pieces');
    expect(button('Build this')).toBeTruthy();
    expect(button('Start my own')).toBeTruthy();
    expect(document.querySelector('.verdict')!.textContent).toMatch(/./);
    expect(storedPieces()).toBe(undefined);
  });

  /*
   * MUTATION PROOF, run: `hadLayout` set from `!offerExample` alone (no
   * holdsOwnLayout): `expected <div class="example-line" …(2)>…(3)</div> to
   * be null`.
   */
  it('a stored layout or a rescue copy: no example', () => {
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const { unmount } = visit();
    expect(screen.queryByRole('group', { name: 'An example' })).toBe(null);
    unmount();
    localStorage.clear();
    localStorage.setItem(GRAPH_RESCUE_KEY, 'not json');
    visit();
    expect(screen.queryByRole('group', { name: 'An example' })).toBe(null);
  });

  it('the first edit makes it yours, and from then on it saves', async () => {
    const user = userEvent.setup();
    visit();
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(screen.queryByRole('group', { name: 'An example' })).toBe(null);
    expect(storedPieces()).toBe(11);
  });

  /*
   * MUTATION PROOF, run: the empty-floor guard (`!layoutWritten.current`)
   * removed: `expected +0 to be undefined`, Start my own writing an empty
   * layout.
   */
  it('Start my own: an empty editor, nothing written until a piece is placed', async () => {
    const user = userEvent.setup();
    visit();
    await user.click(button('Start my own'));
    expect(screen.queryByRole('group', { name: 'An example' })).toBe(null);
    expect(screen.getByText('Nothing on the floor yet.')).toBeTruthy();
    expect(storedPieces()).toBe(undefined);
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(storedPieces()).toBe(1);
  });

  /*
   * MUTATION PROOF, run: the table's save effect also gated on
   * `screen.saveLayout`: `expected null not to be null`.
   */
  it('only the layout waits: the table saves, and a reload shows the example again (D68)', async () => {
    const user = userEvent.setup();
    const { unmount } = visit();
    await user.click(button('Your table'));
    const panel = screen.getByRole('region', { name: 'Your table' });
    await user.type(within(panel).getByRole('spinbutton', { name: 'Table width in centimetres' }), '120');
    await user.type(within(panel).getByRole('spinbutton', { name: 'Table depth in centimetres' }), '80');
    expect(localStorage.getItem(TABLE_STORAGE_KEY)).not.toBe(null);
    unmount();
    visit();
    expect(screen.getByRole('group', { name: 'An example' })).toBeTruthy();
    expect(storedPieces()).toBe(undefined);
  });
});

describe('a phone with no link (19A, D65, D70)', () => {
  /*
   * MUTATION PROOF, run: `phone` set to `screen.mode === 'view'` only:
   * `Unable to find an accessible element with the role "heading"`, the
   * editor shown instead.
   */
  it('nothing stored: the example, read-only, with Build this', () => {
    width(true);
    visit();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('An example · 10 pieces');
    expect(button('Build this')).toBeTruthy();
    expect(screen.getByText(PHONE_DESIGN_ELSEWHERE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open in editor' })).toBe(null);
    expect(screen.queryByText('Checked with catalogue sizes.')).toBe(null);
    expect(storedPieces()).toBe(undefined);
  });

  it('a stored layout: yours, read-only, with Build it', () => {
    width(true);
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    visit();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your railway · 4 pieces');
    expect(button('Build it')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add / })).toBe(null);
  });

  /*
   * MUTATION PROOF, run: `canEditNow.current` frozen at its first value
   * (`useRef(screen.canEdit)` without the per-render assignment): the
   * widened editor refused the piece, `expected 4 to be 5`.
   */
  it('turning across 620px keeps the layout, and editing follows the width (D70)', async () => {
    const turn = width(true);
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const user = userEvent.setup();
    visit();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your railway · 4 pieces');
    turn(false);
    await place(user, screen.getAllByRole('button', { name: 'Add Large curve' })[0]!);
    expect(storedPieces()).toBe(5);
    turn(true);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your railway · 5 pieces');
  });
});

describe('build progress follows ownership, not width (D71)', () => {
  const steps = async (user: ReturnType<typeof userEvent.setup>, label: string, n: number) => {
    await user.click(button(label));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    await user.click(button('Start'));
    await screen.findByTestId('viewer3d');
    await waitFor(() => expect(document.querySelector('.build-meta')?.textContent).toMatch(/^Step 1 of/));
    /*
     * A key is ignored until the step before it has drawn (BuildMode's
     * `settled`), so press until each step shows; a press while unsettled
     * moves nothing, so this never skips one. Pressing once per step failed
     * on the slower CI runner: `expected 'Picking up at step 1.' to be
     * 'Picking up at step 3.'`.
     */
    const meta = () => document.querySelector('.build-meta')?.textContent ?? '';
    for (let k = 2; k <= n; k++) {
      await waitFor(() => {
        if (meta().startsWith(`Step ${k - 1} of`)) fireEvent.keyDown(document, { key: 'ArrowRight' });
        expect(meta()).toMatch(new RegExp(`^Step ${k} of`));
      });
    }
    await user.keyboard('{Escape}');
  };

  /*
   * MUTATION PROOF, run: `resumeKey` chosen by width (`narrow ?
   * BUILD_LINK_STORAGE_KEY : undefined`): `expected null not to be null`,
   * the phone's progress in the link slot.
   */
  it('3 steps on the phone view of your layout, widen, and it resumes at 3', async () => {
    const turn = width(true);
    localStorage.setItem(GRAPH_STORAGE_KEY, FOUR);
    const user = userEvent.setup();
    visit();
    await steps(user, 'Build it', 3);
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).not.toBe(null);
    expect(localStorage.getItem(BUILD_LINK_STORAGE_KEY)).toBe(null);
    turn(false);
    await user.click(button('Build it'));
    await screen.findByRole('heading', { name: 'Get these out of the box' });
    expect(document.querySelector('.build-resume')!.textContent).toBe('Picking up at step 3.');
  });

  it("the example's build goes to the link slot, never yours", async () => {
    const user = userEvent.setup();
    visit();
    await steps(user, 'Build this', 2);
    expect(localStorage.getItem(BUILD_LINK_STORAGE_KEY)).not.toBe(null);
    expect(localStorage.getItem(BUILD_STORAGE_KEY)).toBe(null);
  });
});
