/**
 * CANVAS MARKS KEEP THEIR SCREEN SIZE (brio-TODOS.md P2, filed by
 * /plan-design-review 2026-10-23).
 *
 * The canvas fits the whole layout into its box, and the fault marks and the
 * adapter diamond were drawn in millimetres, so on a big board they shrank to
 * dots and their red strokes thinned to hairlines.
 *
 * Value: protects=below `MARK_MIN_PX_PER_MM` every fault mark and the adapter
 * diamond are enlarged to that floor, and not at all above it; the red
 * strokes keep their device size
 * Value: fails_when=a mark stops being enlarged, is enlarged on a board that
 * needs none, or its strokes go back to drawing units
 * Value: why_new=DESIGN.md rule 11 covered the adapter's stroke only
 * Value: seam=the real canvas under jsdom, with a ResizeObserver stub
 * reporting the box size, as the browser's does after layout; the
 * stylesheet as text
 * Value: no_claim=the painted pixels
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { MARK_MIN_PX_PER_MM, markScale, TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** Twenty straights in a row: a 2.9m board. */
const g: Graph = {
  pieces: Array.from({ length: 20 }, (_, i) => ({ pieceId: `p${i}`, partId: 'A', turn: 'left' as const })),
  welds: Array.from({ length: 19 }, (_, i) => ({ a: { pieceId: `p${i}`, port: 1 }, b: { pieceId: `p${i + 1}`, port: 0 } })),
};
const drawing = renderGraph(g, ports, resolve, placeAll(g, ports));

/** Mount the canvas in a box `px` wide and tall, with one mark of each kind at the origin. */
function canvasIn(px: number): HTMLElement {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe() {
        this.cb([{ contentRect: { width: px, height: px } } as ResizeObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  const { container } = render(
    <TrackCanvas
      render={drawing}
      resolve={resolve}
      clashes={[{ at: [0, 0] }]}
      badJoints={[[144, 0]]}
      adapterJoints={[[288, 0]]}
    />,
  );
  return container;
}
const scaleOf = (root: HTMLElement, cls: string) =>
  Number(root.querySelector(`.${cls}`)?.getAttribute('transform')?.match(/scale\(([^)]+)\)/)?.[1]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('markScale', () => {
  /*
   * MUTATION PROOF, run: the floor without `Math.max(1, …)` (marks shrink on
   * a zoomed-in board): fails with `expected 0.5 to be 1 // Object.is
   * equality`, and the canvas spec below with `expected 0.11475 to be 1`.
   */
  it('enlarges below the floor, never above it, and not before layout', () => {
    expect(markScale(MARK_MIN_PX_PER_MM / 4)).toBe(4);
    expect(markScale(MARK_MIN_PX_PER_MM * 2)).toBe(1);
    expect(markScale(null)).toBe(1);
  });
});

describe('on the canvas', () => {
  /*
   * MUTATION PROOF, run: the canvas's `k` fixed at 1: fails with `expected 1
   * to be greater than 1`.
   */
  it('a big board in a small box: every mark is enlarged by the same factor', () => {
    const root = canvasIn(300);
    const k = scaleOf(root, 'clash-mark');
    expect(k).toBeGreaterThan(1);
    expect(scaleOf(root, 'bad-joint-mark')).toBe(k);
    expect(scaleOf(root, 'adapter-joint-mark')).toBe(k);
  });

  it('the same board in a box big enough: drawn at their size on the wood', () => {
    expect(scaleOf(canvasIn(20000), 'clash-mark')).toBe(1);
  });

  /*
   * MUTATION PROOF, run: `vector-effect` removed from the `.red-mark` rule:
   * fails with `expected '.red-mark .mark-halo,\n.red-mark .mar…' to match
   * /vector-effect:\s*non-scaling-stroke/`.
   */
  it('the red strokes keep their device size', () => {
    const css = readFileSync(join(import.meta.dirname, 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]*\.red-mark[^{}]*)\{([^}]*)\}/g)].map((m) => `${m[1]!.trim()} {${m[2]}}`).join('\n');
    expect(rules).toMatch(/vector-effect:\s*non-scaling-stroke/);
    expect(rules).toMatch(/\.mark-ink\s*\{\s*stroke-width:\s*3;/);
  });
});
