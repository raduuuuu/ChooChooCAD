/**
 * THE PALETTE DRAG'S POINTER HANDLING (decisions E6, 6A, 16A; plan task T7).
 *
 * Value: protects=a press that stays under 4px is a click (a pick); past it,
 * the drag picks once, attaches near a free end and otherwise floats on whole
 * centimetres, sending each spot once; release over the canvas drops, release
 * off it, Esc or pointercancel cancels; the click after a drag is no pick; a
 * touch on a piece that is not picked starts nothing
 * Value: fails_when=the threshold, the snap, the de-duplication, the
 * drop-or-cancel rule, the click swallow or the touch gate breaks
 * Value: why_new=dragging from the palette is new
 * Value: seam=jsdom; a fake CanvasProbe stands in for the canvas, because
 * jsdom has no screen matrix; pointer capture is stubbed for the same reason
 * Value: no_claim=that the real canvas maps pixels correctly (checked in a
 * browser) or what the reducer does with each call (paletteDrop.test.ts)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toXY } from '../../engine/src/geom/cyclotomic.js';
import { usePaletteDrag, type CanvasProbe } from './usePaletteDrag.js';

/*
 * The fake canvas: everything right of x = 100 client pixels, one pixel per
 * millimetre, model x = clientX - 100, model y = clientY. One free end at
 * model (200, 0).
 */
const probe: CanvasProbe = {
  toModel: (cx, cy) => (cx >= 100 ? [cx - 100, cy] : null),
  freeEndNear: (x, y, r) => (Math.hypot(x - 200, y) <= r ? { pieceId: 'p0', port: 1 } : null),
};

function Harness({ log, picked = null }: { log: string[]; picked?: string | null }) {
  const { handlers } = usePaletteDrag({
    probe: { current: probe },
    canDrag: (id, type) => type !== 'touch' || id === picked,
    onStart: (id) => log.push(`start ${id}`),
    onAttach: (r) => log.push(`attach ${r.pieceId}#${r.port}`),
    onFloat: (pos) => log.push(`float ${toXY(pos).map(Math.round).join(',')}`),
    onDrop: () => log.push('drop'),
    onCancel: () => log.push('cancel'),
  });
  const { swallowsClick, ...h } = handlers('A');
  return (
    <button {...h} onClick={() => (swallowsClick() ? undefined : log.push('click'))}>
      Add Medium straight
    </button>
  );
}

const ptr = (x: number, y: number, pointerType = 'mouse') => ({ pointerId: 1, button: 0, clientX: x, clientY: y, pointerType });

let restore: (() => void) | null = null;
beforeEach(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const had = { set: proto.setPointerCapture, release: proto.releasePointerCapture };
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  restore = () => {
    proto.setPointerCapture = had.set;
    proto.releasePointerCapture = had.release;
  };
});
afterEach(() => restore?.());

const setup = (picked: string | null = null) => {
  const log: string[] = [];
  render(<Harness log={log} picked={picked} />);
  return { log, button: screen.getByRole('button') };
};

describe('a palette drag', () => {
  /*
   * MUTATION PROOFS, run:
   * - no threshold (`< 0`): the click spec fails with `expected [ 'start A',
   *   'cancel' ] to deeply equal [ 'click' ]`.
   * - no de-duplication (`if (true) onFloat`): `expected [ 'start A', 'float
   *   50,40', …(3) ] to deeply equal [ 'start A', 'float 50,40', …(2) ]`.
   * - release always drops: the off-canvas spec fails with `expected [
   *   'start A', 'drop' ] to deeply equal [ 'start A', 'cancel' ]`.
   * - the click after a drag is not swallowed: the same message as the
   *   de-duplication one (a fifth entry, 'click').
   * - the touch gate ignored: `expected [ 'start A', 'cancel' ] to deeply
   *   equal []`.
   * - no Esc listener: `expected [ 'start A', 'float 60,10', 'drop' ] to
   *   deeply equal [ 'start A', 'float 60,10', 'cancel' ]`.
   */
  it('a press that stays under 4px is a plain click', () => {
    const { log, button } = setup();
    fireEvent.pointerDown(button, ptr(10, 10));
    fireEvent.pointerMove(button, ptr(12, 11));
    fireEvent.pointerUp(button, ptr(12, 11));
    fireEvent.click(button);
    expect(log).toEqual(['click']);
  });

  it('picks once, floats on whole centimetres, attaches near a free end, and drops over the canvas', () => {
    const { log, button } = setup();
    fireEvent.pointerDown(button, ptr(10, 10));
    fireEvent.pointerMove(button, ptr(20, 10)); // off the canvas: picked, nothing else
    fireEvent.pointerMove(button, ptr(153, 37)); // model (53, 37) -> (50, 40)
    fireEvent.pointerMove(button, ptr(154, 38)); // same centimetre: nothing sent
    fireEvent.pointerMove(button, ptr(310, 5)); // model (210, 5): near the free end
    fireEvent.pointerMove(button, ptr(305, 2)); // still that end: nothing sent
    fireEvent.pointerUp(button, ptr(305, 2));
    fireEvent.click(button); // the click a browser fires after the drag
    expect(log).toEqual(['start A', 'float 50,40', 'attach p0#1', 'drop']);
  });

  it('released off the canvas, it cancels', () => {
    const { log, button } = setup();
    fireEvent.pointerDown(button, ptr(10, 10));
    fireEvent.pointerMove(button, ptr(40, 10));
    fireEvent.pointerUp(button, ptr(40, 10));
    expect(log).toEqual(['start A', 'cancel']);
  });

  it('Esc cancels, and the release after it drops nothing', () => {
    const { log, button } = setup();
    fireEvent.pointerDown(button, ptr(10, 10));
    fireEvent.pointerMove(button, ptr(160, 10));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerUp(button, ptr(160, 10));
    expect(log).toEqual(['start A', 'float 60,10', 'cancel']);
  });

  it('a touch starts a drag only on the picked piece, so the palette still scrolls', () => {
    const other = setup('B');
    fireEvent.pointerDown(other.button, ptr(10, 10, 'touch'));
    fireEvent.pointerMove(other.button, ptr(40, 10, 'touch'));
    fireEvent.pointerUp(other.button, ptr(40, 10, 'touch'));
    expect(other.log).toEqual([]);
  });
});
