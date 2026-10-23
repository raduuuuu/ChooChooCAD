/**
 * A PALETTE DROP ONTO TRACK PLACES NOTHING, THROUGH THE WHOLE APP (the
 * crossing bug's follow-up, 2026-10-23).
 *
 * Value: protects=dragging a piece from the palette and letting go over a
 * placed piece leaves the layout as it was and says why, exactly as a drop
 * whose ends clash does (6A)
 * Value: fails_when=App stops handing the part geometry to the reducer, so
 * the drop guard compares ends only and puts the piece down on the track
 * Value: why_new=paletteDrop.test.ts drives the reducer directly and hands it
 * the geometry itself, so it cannot see App forget to
 * Value: seam=jsdom plus fireEvent pointer events; the canvas's screen
 * mapping is stubbed to one pixel per millimetre, because jsdom has no layout
 * Value: no_claim=the real pixel mapping (checked in a browser)
 */

import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { GRAPH_STORAGE_KEY } from './storageKeys.js';

/*
 * The fake screen: client pixels ARE model millimetres, everywhere. The
 * canvas reads its bounds and its drawing's screen matrix; both are stubbed
 * so every point is on the canvas and maps to itself.
 */
let restore: (() => void) | null = null;
beforeEach(() => {
  const el = Element.prototype as unknown as Record<string, unknown>;
  const html = HTMLElement.prototype as unknown as Record<string, unknown>;
  const g = globalThis as Record<string, unknown>;
  const had = {
    rect: el.getBoundingClientRect,
    ctm: el.getScreenCTM,
    set: html.setPointerCapture,
    release: html.releasePointerCapture,
    point: g.DOMPoint,
  };
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
    g.DOMPoint = had.point;
  };
});
afterEach(() => restore?.());

const ptr = (x: number, y: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, pointerType: 'mouse' });
const storedPieces = () =>
  (JSON.parse(localStorage.getItem(GRAPH_STORAGE_KEY)!) as { pieces: unknown[] }).pieces.length;

describe('dragging a straight from the palette', () => {
  /*
   * MUTATION PROOF, run: App's dispatch calling `reduce(e, action, ports)`
   * without `{ resolve }`: the first spec fails with `expected 2 to be 1`,
   * the straight put down along the first one.
   */
  function mountOneStraight() {
    // One medium straight from (0, 0) to (144, 0), heading 0.
    localStorage.setItem(
      GRAPH_STORAGE_KEY,
      JSON.stringify({
        pieces: [{ pieceId: 'p0', partId: 'A', turn: 'left' }],
        welds: [],
        anchors: [['p0', { pos: [0, 0, 0, 0, 0, 0, 0, 0], heading: 0 }]],
      }),
    );
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    return screen.getAllByRole('button', { name: /^Add Medium straight$/ })[0]!;
  }

  it('let go 10 mm off the first straight, along it: nothing is placed, and it says why', () => {
    const button = mountOneStraight();
    fireEvent.pointerDown(button, ptr(0, 0));
    // Far from both free ends, (0, 0) and (144, 0), so it floats free.
    fireEvent.pointerMove(button, ptr(-50, 10));
    fireEvent.pointerUp(button, ptr(-50, 10));
    expect(storedPieces()).toBe(1);
    expect(document.body.textContent).toContain("Didn't place it: it doesn't fit there.");
  });

  it('let go clear of it: the straight is placed', () => {
    const button = mountOneStraight();
    fireEvent.pointerDown(button, ptr(0, 0));
    fireEvent.pointerMove(button, ptr(-50, 200));
    fireEvent.pointerUp(button, ptr(-50, 200));
    expect(storedPieces()).toBe(2);
  });
});
