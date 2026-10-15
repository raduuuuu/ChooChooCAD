/**
 * THE CANVAS REFUSES TO DRAW RATHER THAN FREEZING THE TAB.
 *
 * Value: protects=a stored layout that is too big to draw says so and stays
 * usable, instead of blocking the main thread inside render where no throw
 * reaches `ErrorBoundary` and the "Clear saved data" escape is never painted
 * Value: fails_when=the ceiling stops being enforced, or the refusal branch
 * stops rendering the sentence that explains it
 * Value: why_new=this branch made the solver linear and the freeze moved one
 * layer out, into the render that consumes the solver's answer in the same
 * synchronous pass. MEASURED on 120,000 loose straights -- a 3.72M-char blob
 * that `loadGraph` accepts with nothing discarded -- the whole engine is
 * 576ms and this canvas alone is 3,153ms for 1.2M SVG elements, and that is
 * `renderToStaticMarkup`, a floor for what a browser then does. Nothing
 * bounded it.
 * Value: seam=`renderToStaticMarkup` needs no DOM, so the component renders
 * in this node environment. What it cannot do is dispatch an event, which is
 * why this asserts on markup rather than on a click.
 * Value: no_claim=nothing about how long the draw takes. The ceiling is a
 * COUNT, and the measurements behind the chosen value live at the guard in
 * `TrackCanvas.tsx`. A timing assertion here would be sized against SSR,
 * which is not the number that matters in a browser.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { CANVAS_SEGMENT_CEILING, TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

/** `n` loose straights, which is the densest shape per stored byte. */
const markupFor = (n: number): string => {
  const graph: Graph = {
    pieces: Array.from({ length: n }, (_, i) => ({
      pieceId: `p${i}`,
      partId: 'A',
    })),
    welds: [],
    anchors: new Map(),
  };
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  return renderToStaticMarkup(
    createElement(TrackCanvas, { render, resolve, clashes: [], gaps: [] } as never),
  );
};

describe('the canvas refuses to draw a layout it cannot draw', () => {
  /*
   * AT the ceiling, not below it: an off-by-one that refused the last
   * drawable layout would be invisible to a test that only checked a small
   * one, and `>` versus `>=` is exactly the mistake available here.
   *
   * MUTATION PROOF, run: change the guard to `>=`. ONE spec fails -- this
   * one -- with `expected '<div class="canvas-empty"><p class="c…' to
   * contain '<svg'`.
   */
  it('draws at the ceiling exactly', () => {
    const html = markupFor(CANVAS_SEGMENT_CEILING);
    expect(html).toContain('<svg');
    expect(html).not.toContain('Too much track to draw');
  });

  /*
   * MUTATION PROOF, run: delete the guard. TWO specs fail -- this one and
   * the copy spec below -- with `expected '<svg class="canvas" viewBox="-90
   * -90 …' to contain 'Too much track to draw'` and the same prefix `to
   * contain 'still checked'`.
   */
  it('says so, in words, one piece above it', () => {
    const html = markupFor(CANVAS_SEGMENT_CEILING + 1);
    expect(html).toContain('Too much track to draw');
    expect(html).toContain((CANVAS_SEGMENT_CEILING + 1).toLocaleString());
    expect(html).not.toContain('<svg');
  });

  /*
   * The refusal must not read as "your layout is broken". It is a drawing
   * limit, and the verdict below it still applies to the whole layout --
   * `solveGraph` does not depend on this component at all.
   */
  it('tells the user the layout is still there and still checked', () => {
    const html = markupFor(CANVAS_SEGMENT_CEILING + 1);
    expect(html).toContain('still checked');
    expect(html).toContain('Remove some track');
  });
});
