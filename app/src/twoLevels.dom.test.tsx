/**
 * TWO LEVELS ON SCREEN (two-layer plan: core 6, OV4, design 1A, 2A, 5A, 6A,
 * 11A, 12A).
 *
 * Value: protects=raised track and its targets drawn after floor track's, the
 * bridge casing and rise chevron, the level-fault marks, the strip saying
 * which way a ramp goes, the drop status for an end on the other level, the
 * list naming levels, and the ramp's place in the palette
 * Value: fails_when=the canvas draws one pass, a mark or casing goes missing,
 * a sentence is lost, or the drop status never shows without a selection
 * Value: why_new=all new with levels
 * Value: seam=jsdom plus user-event and fireEvent pointer events, App mounted
 * in StrictMode, layouts seeded through storage as a reload loads them; the
 * screen-to-drawing transform stubbed as in dropOnTrack.dom.test
 * Value: no_claim=pixels and real hit-testing (jsdom has neither; document
 * order is what decides which target is on top, and a browser check covers
 * the look)
 */

import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

let restore: (() => void) | null = null;
beforeEach(() => {
  const el = Element.prototype as unknown as Record<string, unknown>;
  const html = HTMLElement.prototype as unknown as Record<string, unknown>;
  const g = globalThis as Record<string, unknown>;
  // The dragged piece is an SVG element, so capture is stubbed on Element too.
  const had = {
    rect: el.getBoundingClientRect,
    ctm: el.getScreenCTM,
    set: html.setPointerCapture,
    release: html.releasePointerCapture,
    elSet: el.setPointerCapture,
    elRelease: el.releasePointerCapture,
    point: g.DOMPoint,
  };
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.getBoundingClientRect = () => ({ left: -5000, right: 5000, top: -5000, bottom: 5000, width: 10000, height: 10000, x: -5000, y: -5000 });
  el.getScreenCTM = () => ({ inverse: () => null });
  html.setPointerCapture = () => {};
  html.releasePointerCapture = () => {};
  g.DOMPoint = class {
    constructor(readonly x: number, readonly y: number) {}
    matrixTransform() {
      return { x: this.x, y: this.y };
    }
  };
  restore = () => {
    el.getBoundingClientRect = had.rect;
    el.getScreenCTM = had.ctm;
    html.setPointerCapture = had.set;
    html.releasePointerCapture = had.release;
    el.setPointerCapture = had.elSet;
    el.releasePointerCapture = had.elRelease;
    g.DOMPoint = had.point;
  };
});
afterEach(() => restore?.());

/** Eight lattice coefficients: whole mm along x, and along y (zeta^4 is i). */
const pos = (x: number, y: number) => [x, 0, 0, 0, y, 0, 0, 0];
type Seed = { id: string; part: string; x: number; y: number; heading: number; level?: 1 };
function mount(pieces: readonly Seed[], welds: readonly [string, number, string, number][] = []) {
  localStorage.setItem(
    GRAPH_STORAGE_KEY,
    JSON.stringify({
      pieces: pieces.map((p) => ({ pieceId: p.id, partId: p.part, turn: 'left' })),
      welds: welds.map(([a, ap, b, bp]) => ({ a: { pieceId: a, port: ap }, b: { pieceId: b, port: bp } })),
      anchors: pieces.map((p) => [p.id, { pos: pos(p.x, p.y), heading: p.heading, ...(p.level ? { level: p.level } : {}) }]),
    }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return userEvent.setup();
}
const button = (name: string | RegExp) => screen.getAllByRole('button', { name })[0]!;
const count = (sel: string) => document.querySelectorAll(sel).length;

/** A floor straight along x, and a raised straight crossing its middle: a bridge. */
const BRIDGE: readonly Seed[] = [
  { id: 'f', part: 'A', x: 0, y: 0, heading: 0 },
  { id: 'u', part: 'A', x: 72, y: -72, heading: 4, level: 1 },
];

describe('a bridge on the canvas', () => {
  /*
   * MUTATION PROOFS, run:
   * - the two passes swapped (`levelLayer(true)` first): fails with
   *   `expected false to be true` (the raised piece's target is no longer
   *   after the floor's free ends).
   * - the casing block removed: fails with `expected +0 to be 1`.
   * - the casing unmasked (`mask` attribute dropped): fails with `expected
   *   null not to be null`.
   */
  it('reads as a bridge: no fault, a casing, raised targets on top', () => {
    mount(BRIDGE);
    expect(document.querySelector('.verdict-text')!.textContent).not.toMatch(/^Can.t be built/);
    expect(count('path.bridge-casing')).toBe(1);
    // Masked to floor wood, so it never paints over the raised piece's own shadow.
    expect(document.querySelector('path.bridge-casing')!.closest('g[mask]')).not.toBeNull();
    const raised = button(/^Piece 2:/).closest('g')!;
    const floorEnd = screen.getAllByRole('button', { name: /free (peg|socket) end/i })[0]!;
    // Later in the document means on top: SVG hit-testing takes the last painted.
    expect(Boolean(floorEnd.compareDocumentPosition(raised) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  /*
   * MUTATION PROOF, run: `RaisedNote` dropped from `notesFor`: fails with
   * `expected 'Grid: 10 cm?Not a loop yet. 2 separat…' to contain 'Raised
   * track: supports are not checke…'`.
   */
  it('the note says supports are not checked and gives the estimated clearance', () => {
    mount(BRIDGE);
    const text = document.body.textContent!;
    expect(text).toContain('Raised track: supports are not checked.');
    expect(text).toMatch(/crosses other track at\s*1\s*place; clearance is about\s*8\s*mm/);
  });
});

describe('raised track casts a shadow; floor track does not (owner, 2026-10-23)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the shadow pass removed: fails with `expected +0 to be 1`.
   * - shadows for every piece (the level filter dropped): fails with
   *   `expected 2 to be 1`.
   * - shadows drawn after the floor wood (the raised pass): fails with
   *   `expected false to be true` (a shadow after the first plank).
   */
  it('one shadow, the raised piece\'s, under all the wood', () => {
    mount(BRIDGE);
    const shadows = document.querySelectorAll('path.raised-shadow');
    expect(shadows.length).toBe(1);
    const firstWood = document.querySelector('svg[aria-label="Track layout"] path[stroke]:not(.raised-shadow):not(.grid)')!;
    expect(Boolean(shadows[0]!.compareDocumentPosition(firstWood) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('a ramp\'s shadow is the tapering quad, filled', () => {
    mount([{ id: 'r', part: 'N', x: 0, y: 0, heading: 0 }]);
    expect(count('path.raised-shadow.is-ramp')).toBe(1);
  });
});

describe('the shadow outside the still canvas (design review of PR #46: 1A, 2A, 3A)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the caption without the key: `expected 'Grid: 10 cm' to contain
   *   'Shadow: raised'`.
   * - the ghost's shadows removed: `expected +0 to be 1`.
   * - the drag overlay's shadows removed: `expected +0 to be 1`.
   */
  it('the caption names the shadow only when track is raised', () => {
    mount(BRIDGE);
    expect(document.querySelector('.grid-caption')!.textContent).toContain('Shadow: raised');
  });

  it('a flat layout keeps the plain caption', () => {
    mount([{ id: 'f', part: 'A', x: 0, y: 0, heading: 0 }]);
    expect(document.querySelector('.grid-caption')!.textContent).not.toContain('Shadow');
  });

  it('a piece about to go on raised track casts its shadow in the preview', async () => {
    const user = mount([{ id: 'u', part: 'A', x: 0, y: 0, heading: 0, level: 1 }]);
    await user.click(screen.getByRole('button', { name: /end of piece 1/i }));
    await user.click(button(/^Add Medium straight$/));
    expect(document.querySelectorAll('g.ghost path.raised-shadow').length).toBe(1);
  });

  it('a dragged raised run keeps its shadow while it moves', () => {
    mount([{ id: 'u', part: 'A', x: 0, y: 0, heading: 0, level: 1 }]);
    const piece = button(/^Piece 1:/);
    fireEvent.pointerDown(piece, { pointerId: 1, button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(piece, { pointerId: 1, button: 0, clientX: 0, clientY: -200, pointerType: 'mouse' });
    expect(document.querySelectorAll('g.drag-run path.raised-shadow').length).toBe(1);
  });
});

describe('after raised track, a ramp comes down instead of opening red (owner, 2026-10-23)', () => {
  /*
   * The reported case: a ramp after a raised long straight had one way on,
   * climbing to a third level, and no way out. Now it goes on flipped over.
   *
   * MUTATION PROOFS, run:
   * - `defaultFit` without the level preference: fails with `expected 'X It
   *   would lift track to a third level…' to match /^O Comes down to the
   *   floor\./`.
   * - F withheld from ramps (`ghostKeys` without its ramp branch): fails
   *   with `expected null not to be null`.
   */
  it('the preview comes down, and Flip turns it over', async () => {
    const user = mount([{ id: 'd', part: 'D', x: 0, y: 0, heading: 0, level: 1 }]);
    await user.click(screen.getByRole('button', { name: /end of piece 1/i }));
    await user.click(button(/^Add Ascending track\./));
    const group = screen.getByRole('group', { name: /Placing/ });
    expect(within(group).getByRole('status').textContent).toMatch(/^O Comes down to the floor\./);
    expect(within(group).queryByRole('button', { name: 'Turn over: climb (F)' })).not.toBeNull();
  });
});

describe('a ramp: chevron, palette, strip and list', () => {
  /*
   * MUTATION PROOFS, run:
   * - the chevron map removed from the canvas: `expected +0 to be 1`.
   * - `partsByBrand` back to library order: `expected 'Add Middle straight'
   *   to be 'Add Ascending track'`.
   */
  it('a placed ramp draws one chevron; the palette lists it after D', () => {
    mount([{ id: 'r', part: 'N', x: 0, y: 0, heading: 0 }]);
    expect(count('.canvas path.rise-chevron, svg[aria-label="Track layout"] path.rise-chevron')).toBe(1);
    const names = screen.getAllByRole('button', { name: /^Add / }).map((b) => b.getAttribute('aria-label')!);
    const d = names.findIndex((n) => n.startsWith('Add Long straight'));
    expect(names[d + 1]!.split('.')[0]).toBe('Add Ascending track');
    expect(names[d + 1]).toContain('Climbs one level.');
  });

  /*
   * MUTATION PROOF, run: the level sentence left out of the strip: fails
   * with `expected 'O Fits here.' to match /^O Climbs from the floor to the
   * raised level\./`.
   */
  it('the strip says which way it goes', async () => {
    const user = mount([{ id: 's', part: 'A', x: 0, y: 0, heading: 0 }]);
    await user.click(screen.getByRole('button', { name: /end of piece 1/i }));
    await user.click(button(/^Add Ascending track/));
    const status = within(screen.getByRole('group', { name: /Placing/ })).getByRole('status').textContent!;
    expect(status).toMatch(/^O Climbs from the floor to the raised level\./);
  });

  /*
   * MUTATION PROOF, run: `endName` without the ramp branch: fails with
   * `expected [ 'Start of piece 1, a socket', …(1) ] to include 'Low end of
   * piece 1, a socket'`.
   */
  it('the list names its low and high end, and their levels', () => {
    mount([{ id: 'r', part: 'N', x: 0, y: 0, heading: 0 }]);
    const list = document.querySelector('.graph-listing')!;
    const ends = [...list.querySelectorAll('li li button')].map((b) => b.textContent);
    expect(ends).toContain('Low end of piece 1, a socket');
    expect(ends).toContain('High end of piece 1, a peg');
    expect(list.textContent).toContain('On the floor. Free');
    expect(list.textContent).toContain('Raised. Free');
  });
});

describe('a drop beside an end on the other level says why it did not join (5A, D1)', () => {
  /*
   * A floor straight `r` far off, and a raised straight `t` whose start sits
   * where `r`'s far end lands after the drag. They never join: different
   * levels. With nothing selected, only the drop strip can say so.
   *
   * MUTATION PROOFS, run:
   * - `dropStrip` left out of the canvas strip slot: fails with `expected
   *   null not to be null`.
   * - `otherLevelNear` always false: fails the same way.
   */
  it('shows the reason with no piece selected', () => {
    mount([
      { id: 't', part: 'A', x: 144, y: 0, heading: 0, level: 1 },
      { id: 'r', part: 'A', x: 0, y: 400, heading: 0 },
    ]);
    // The stubbed transform maps client y straight to model y (no flip).
    const piece = button(/^Piece 2:/);
    fireEvent.pointerDown(piece, { pointerId: 1, button: 0, clientX: 0, clientY: 0, pointerType: 'mouse' });
    fireEvent.pointerMove(piece, { pointerId: 1, button: 0, clientX: 0, clientY: -400, pointerType: 'mouse' });
    fireEvent.pointerUp(piece, { pointerId: 1, button: 0, clientX: 0, clientY: -400, pointerType: 'mouse' });
    const strip = screen.queryByRole('group', { name: 'Last move' });
    expect(strip).not.toBeNull();
    expect(strip!.textContent).toContain("Didn't join: that end is on the other level.");
  });
});

describe('level faults on the canvas and in the verdict (6A, 8A)', () => {
  /*
   * An anchored raised straight with a ramp climbing from its far end: a
   * third level.
   *
   * MUTATION PROOFS, run:
   * - `thirdLevels` not passed to the canvas: `expected +0 to be 1`.
   * - the third-level branch removed from the verdict: `expected 'Can’t be
   *   built. 0 spots have two or m…' to match /^Can’t be built\. 1 ramp would
   *   lift t…/` (the fallback sentence, with nothing to count).
   */
  it('a third level: one double-chevron mark, its sentence and its action', () => {
    mount(
      [
        { id: 's', part: 'A', x: 0, y: 0, heading: 0, level: 1 },
        { id: 'r', part: 'N', x: 144, y: 0, heading: 0 },
      ],
      [['s', 1, 'r', 0]],
    );
    expect(count('g.third-level-mark')).toBe(1);
    expect(document.querySelector('.verdict-text')!.textContent).toMatch(
      /^Can’t be built\. 1 ramp would lift track to a third level\. Only two levels are supported\./,
    );
    expect(document.querySelector('.verdict-action')!.textContent).toBe('Turn that ramp round or remove it.');
  });
});
