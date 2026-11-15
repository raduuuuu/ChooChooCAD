/**
 * THE PHONE'S EDITOR: PANELS, WARNINGS AND "NEXT END" (plan 2026-11-14,
 * design DD5, DD7, DD10; eng ED4, ED7, ED12).
 *
 * Value: protects=a panel opens full screen with its name and Done in a row
 * outside the scrolling form; a half-typed field survives the screen being
 * rearranged and is gone after a real close; with two warnings live the
 * failed save shows first, "and 1 more" opens the other, and each keeps its
 * button; "Next end" moves the preview (or, while joining, the chosen end) to
 * the other end in reach and back, and makes no Undo step
 * Value: fails_when=Done scrolls away with the form, turning the phone
 * empties a field, a failed save is hidden behind another warning or loses
 * its button, or "Next end" is missing where two ends share a spot
 * Value: why_new=none of these existed on a phone
 * Value: seam=the real App under jsdom; matchMedia stubbed and turnable; a
 * full storage is `Storage.prototype.setItem` throwing for the layout key;
 * another tab is a dispatched `storage` event; the stylesheet as text
 * Value: no_claim=the look, the keyboard scrolling a field into view, and
 * how far a fingertip reaches on a real screen (task T12): under jsdom the
 * canvas reports its fallback scale, one pixel a millimetre
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { STALE_TAB } from './linkWords.js';
import { PHONE_SHELL, PHONE_SHELL_QUERY } from './phoneEditor.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';
import { TOUCH_QUERY } from './stripWords.js';
import { NARROW_QUERY } from './useMatchMedia.js';

const straight = (ids: string[]) => ({
  pieces: ids.map((pieceId) => ({ pieceId, partId: 'A', turn: 'left' })),
  welds: ids.slice(1).map((id, i) => ({ a: { pieceId: ids[i]!, port: 1 }, b: { pieceId: id, port: 0 } })),
  anchors: [],
});
/** Eight large curves joined in a ring but for the last joint: its two free ends lie on one spot. */
const RING = {
  pieces: Array.from({ length: 8 }, (_, i) => ({ pieceId: `e${i}`, partId: 'E', turn: 'left' })),
  welds: Array.from({ length: 7 }, (_, i) => ({ a: { pieceId: `e${i}`, port: 1 }, b: { pieceId: `e${i + 1}`, port: 0 } })),
  anchors: [],
};
type Stored = { pieces: { pieceId: string }[]; welds: { a: { pieceId: string; port: number }; b: { pieceId: string; port: number } }[] };
const stored = () => JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)!) as Stored;

/** A phone whose screen the test can turn into a wide one and back. */
function phoneScreen() {
  let isPhone = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (q: string) => ({
    get matches() {
      return q === TOUCH_QUERY || ((q === PHONE_SHELL_QUERY || q === NARROW_QUERY) && isPhone);
    },
    media: q,
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  }));
  return (next: boolean) =>
    act(() => {
      isPhone = next;
      listeners.forEach((f) => f());
    });
}
const open = (layout: object) => {
  localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(layout));
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};
const moreRow = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('button', { name: 'More' }));
  await user.click([...screen.getByRole('dialog', { name: 'More' }).querySelectorAll<HTMLButtonElement>('button.more-row')].find((b) => b.textContent === name)!);
};
/** The panel's own Done, in its fixed first row (the form's own close button is hidden by the stylesheet). */
const panelDone = () => document.querySelector<HTMLButtonElement>('.phone-panel > .sheet-head .sheet-close');
const pickFromSheet = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('button', { name: 'Pieces' }));
  await user.click(screen.getByRole('dialog', { name: 'Pieces' }).querySelector<HTMLButtonElement>(`button.piece-main[aria-label^="Add ${name}"]`)!);
};

let turn: (phone: boolean) => void;
beforeEach(() => {
  PHONE_SHELL.on = true;
  turn = phoneScreen();
});
afterEach(() => {
  PHONE_SHELL.on = false;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a panel on a phone', () => {
  /*
   * MUTATION PROOFS, run:
   * - the panel's first row drawn inside `.phone-panel-body`: `Cannot read
   *   properties of null` (no Done in a row of its own).
   * - the rule hiding the panel's own first row removed: `expected '' to
   *   match /display:\s*none/`.
   */
  it('is full screen, with its name and Done outside the scrolling form', async () => {
    const user = userEvent.setup();
    open(straight(['m1', 'm2']));
    await moreRow(user, 'Your table');
    const panel = document.querySelector('.phone-panel')!;
    expect(panel.getAttribute('aria-label')).toBe('Your table');
    const done = panelDone()!;
    expect(done.textContent).toBe('Done');
    expect(panel.querySelector('.sheet-head .sheet-title')!.textContent).toBe('Your table');
    expect(panel.querySelector('.phone-panel-body input')).not.toBeNull();
    const css = readFileSync(join(__dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.match(/\.phone-panel-body \.inventory-head\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/display:\s*none/);
    await user.click(done);
    expect(document.querySelector('.phone-panel')).toBeNull();
  });

  /*
   * MUTATION PROOFS, run:
   * - the table's width back on `useState`: `expected '' to be '12'` (turning
   *   the phone emptied the field).
   * - the draft never dropped on a close: `expected '12' to be ''`.
   */
  it('keeps a half-typed field when the screen is rearranged, and forgets it after a real close', async () => {
    const user = userEvent.setup();
    open(straight(['m1', 'm2']));
    await moreRow(user, 'Your table');
    const width = () => document.querySelector<HTMLInputElement>('section[aria-label="Your table"] input')!;
    await user.type(width(), '12');
    turn(false);
    expect(document.querySelector('.phone')).toBeNull();
    expect(width().value).toBe('12');
    turn(true);
    await screen.findByRole('button', { name: 'Pieces' });
    expect(panelDone()).not.toBeNull();
    expect(width().value).toBe('12');
    await user.click(panelDone()!);
    await moreRow(user, 'Your table');
    expect(width().value).toBe('');
  });
});

describe('warnings on a phone', () => {
  /*
   * MUTATION PROOFS, run:
   * - the warnings left in the wide editor's order (the stale tab first):
   *   `expected 'This layout was changed in another tab…' not to contain
   *   'changed in another tab'`.
   * - the rest drawn without being asked for: `expected 2 to be 1`.
   */
  it('shows the failed save first, with its button, and "and 1 more" opens the other with its own', async () => {
    const user = userEvent.setup();
    open(straight(['m1', 'm2']));
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === GRAPH_STORAGE_KEY) throw new DOMException('quota', 'QuotaExceededError');
      realSet.call(this, k, v);
    });
    await pickFromSheet(user, 'Medium straight');
    await user.click(screen.getByRole('button', { name: 'Place' }));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: GRAPH_STORAGE_KEY }));
    });
    const line = document.querySelector('.phone-warnings')!;
    const shown = () => [...line.querySelectorAll('.notice')];
    expect(shown().length).toBe(1);
    expect(shown()[0]!.textContent).not.toContain('changed in another tab');
    expect(shown()[0]!.querySelector('button')!.textContent).toBe('Dismiss');
    await user.click(screen.getByRole('button', { name: 'and 1 more' }));
    expect(shown().length).toBe(2);
    expect(shown()[1]!.textContent).toContain(STALE_TAB);
    expect(shown()[1]!.querySelector('button')!.textContent).toBe('Reload');
  });
});

describe('"Next end", where two free ends share a spot', () => {
  const joinedTo = () => {
    const { pieces, welds } = stored();
    const added = pieces[pieces.length - 1]!.pieceId;
    return welds.filter((w) => w.a.pieceId === added || w.b.pieceId === added).map((w) => (w.a.pieceId === added ? w.b : w.a).pieceId).sort().join(',');
  };
  /** Pick a mini straight, press Next end `steps` times, Place: which piece did it go on? */
  const placeAfter = async (steps: number) => {
    const user = userEvent.setup();
    const view = open(RING);
    await pickFromSheet(user, 'Mini straight');
    for (let i = 0; i < steps; i++) await user.click(screen.getByRole('button', { name: 'Next end' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /undo/i }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    const on = joinedTo();
    view.unmount();
    localStorage.clear();
    return on;
  };

  /*
   * MUTATION PROOFS, run:
   * - the button sending nothing: `expected 'e7' not to be 'e7'` (the piece
   *   went on the same end either way).
   * Which end the ring is measured from needs three ends to tell apart: that
   * is `nextEnd.test.ts`.
   */
  it('moves the preview to the other end and round again, with no Undo step', async () => {
    const first = await placeAfter(0);
    const other = await placeAfter(1);
    const back = await placeAfter(2);
    expect(other).not.toBe(first);
    expect(back).toBe(first);
  });

  /*
   * MUTATION PROOF, run: Next end left out of the joining strip: `Unable to
   * find role="button" and name "Next end"`.
   */
  it('while joining, moves the chosen end without joining', async () => {
    const user = userEvent.setup();
    open(RING);
    await user.click(await screen.findByRole('button', { name: 'Join two ends' }));
    const end = document.querySelector<SVGElement>('.port')!;
    await user.click(end);
    const strip = () => document.querySelector('.phone-strip')!.textContent!;
    const from = strip();
    expect(from).toContain('Tap another free end to join it.');
    await user.click(screen.getByRole('button', { name: 'Next end' }));
    expect(strip()).not.toBe(from);
    expect(strip()).toContain('Tap another free end to join it.');
    expect(stored().welds.length).toBe(7);
    await user.click(screen.getByRole('button', { name: 'Next end' }));
    expect(strip()).toBe(from);
  });
});
