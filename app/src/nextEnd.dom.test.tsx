/**
 * WHAT THE PHONE'S SHEET AND "NEXT END" NEED FROM THE SHELVES AND THE CANVAS
 * (plan 2026-11-14, design DD7, DD13; eng ED4).
 *
 * Value: protects=shelves handed no drag pick a card on a tap and carry no
 * pointer handlers at all; the canvas reports the free ends a pointer can
 * reach and the scale it drew them at, and reports again when the scale
 * changes
 * Value: fails_when=a card without drag stops picking, still starts a drag,
 * or the canvas keeps its ends and scale to itself
 * Value: why_new=only the canvas knows the scale, and "Next end" is worked
 * out outside it; a sheet that scrolls must not grab a piece
 * Value: seam=the real components under jsdom, with a ResizeObserver stub
 * reporting the box size, as the browser's does after layout
 * Value: no_claim=that a screen uses either yet (the phone's shell, a later
 * step); the wide screen's drag, which `usePaletteDrag.dom.test.tsx` covers
 */

import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { PieceShelves } from './Palette.js';
import { TrackCanvas } from './TrackCanvas.js';
import type { ClickableEnd } from './trackPath.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shelves with no drag', () => {
  /*
   * MUTATION PROOFS, run:
   * - the no-drag branch given no `onClick`: `expected [] to deeply equal
   *   [ 'A' ]`.
   * - `paletteDrag` called without the check: the render throws `paletteDrag
   *   is not a function`.
   */
  it('pick a card on a tap, and a press that moves starts nothing', () => {
    const picked: string[] = [];
    const { container } = render(
      <PieceShelves
        library={BUILT_IN}
        resolve={resolve}
        inventory={null}
        counts={{}}
        overLimit={false}
        pickedId={null}
        onPick={(id) => picked.push(id)}
        onAdd={() => {}}
      />,
    );
    const card = [...container.querySelectorAll<HTMLButtonElement>('button.piece-main')].find(
      (b) => b.getAttribute('aria-label')?.startsWith(`Add ${resolve('A').name}`),
    )!;
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 80, clientY: 80 });
    expect(picked).toEqual([]);
    fireEvent.click(card);
    expect(picked).toEqual(['A']);
  });
});

/** Two straights joined end to end: 288mm of track with a free end at each end. */
const g: Graph = {
  pieces: [
    { pieceId: 'p0', partId: 'A', turn: 'left' },
    { pieceId: 'p1', partId: 'A', turn: 'left' },
  ],
  welds: [{ a: { pieceId: 'p0', port: 1 }, b: { pieceId: 'p1', port: 0 } }],
};
const drawing = renderGraph(g, ports, resolve, placeAll(g, ports));

function observerReporting(px: () => number) {
  const live: { cb: ResizeObserverCallback; self: unknown }[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe() {
        live.push({ cb: this.cb, self: this });
        this.cb([{ contentRect: { width: px(), height: px() } } as ResizeObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  return () => live.forEach(({ cb, self }) => cb([{ contentRect: { width: px(), height: px() } } as ResizeObserverEntry], self as never));
}

describe('the canvas says which ends can be reached, and at what scale', () => {
  /*
   * MUTATION PROOFS, run:
   * - the effect removed: `expected undefined to deeply equal [ 'p0#0',
   *   'p1#1' ]` (nothing is reported).
   * - the scale left out of the effect's dependencies: `expected 0 to be 1`
   *   (no second report; the new scale never arrives).
   * - the scale reported as a constant 1: the "halves" expectation fails
   *   with `expected 1 to be close to 0.5`.
   */
  it('reports the free ends and the scale, and again when the box changes size', () => {
    let px = 936;
    const seen: { ends: readonly ClickableEnd[]; pxPerMm: number }[] = [];
    const again = observerReporting(() => px);
    const onReachable = (ends: readonly ClickableEnd[], pxPerMm: number) => seen.push({ ends, pxPerMm });
    render(<TrackCanvas render={drawing} resolve={resolve} onReachable={onReachable} />);
    const first = seen[seen.length - 1];
    expect(first?.ends.map((e) => `${e.ref.pieceId}#${e.ref.port}`)).toEqual(['p0#0', 'p1#1']);
    const scale = first!.pxPerMm;
    expect(scale).toBeGreaterThan(0);
    const reports = seen.length;
    px = 468;
    act(() => again());
    expect(seen.length - reports).toBe(1);
    expect(seen[seen.length - 1]!.pxPerMm / scale).toBeCloseTo(0.5, 5);
  });
});
