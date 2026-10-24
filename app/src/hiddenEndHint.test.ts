/**
 * A FREE END UNDER A BRIDGE IS POINTED TO THE LIST (brio-TODOS.md P3).
 *
 * Raised track is drawn after the floor's ends, so where raised wood covers a
 * free floor end the wood takes the click, and the end is reachable only from
 * the layout list. The canvas says so in one line.
 *
 * Value: protects=the plank test (`onPlank`) and the hint's count and wording
 * Value: fails_when=an end under raised wood goes uncounted, one beside it is
 * counted, or the hint shows with nothing hidden
 * Value: why_new=nothing told a mouse user the list exists
 * Value: seam=renderToStaticMarkup for the canvas; `onPlank` directly
 * Value: no_claim=that the wood really takes the click (no hit testing
 * without a layout engine)
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { onPlank } from '../../engine/src/graph/overlap.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const half = (id: string) => resolve(id).plankWidthMm / 2;
const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};

/** A floor straight `f` from (0, fy), and a raised straight `u` across x = 144. */
const bridge = (fy: number): Graph => ({
  pieces: [
    { pieceId: 'f', partId: 'A', turn: 'left' },
    { pieceId: 'u', partId: 'A', turn: 'left' },
  ],
  welds: [],
  anchors: new Map([
    ['f', at(0, fy, 0)],
    ['u', at(144, -72, 4, 1)],
  ]),
});
const drawn = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports));
const text = (g: Graph) =>
  renderToStaticMarkup(createElement(TrackCanvas, { render: drawn(g), resolve })).replace(/<[^>]+>/g, ' ');

describe('onPlank', () => {
  /*
   * MUTATION PROOF, run: the edge test flipped to `<= 0`: fails with
   * `expected false to be true`.
   */
  it('on the wood, at its edge, and just off it', () => {
    const segs = drawn(bridge(0)).segments.filter((s) => s.pieceId === 'u');
    expect(onPlank(144, 0, segs, half)).toBe(true);
    expect(onPlank(144 + 19, 0, segs, half)).toBe(true);
    expect(onPlank(144 + 21, 0, segs, half)).toBe(false);
  });
});

describe('the hint on the canvas', () => {
  /*
   * MUTATION PROOFS, run (the markup's tags become spaces, hence the blank
   * start of each quoted value):
   * - the hint never rendered (`hiddenEnds > 0` as `false`): fails with
   *   `expected '                                     …' to contain '1 free
   *   end is under raised track. Rea…'`.
   * - every free floor end counted, covered or not (`onPlank(…)` as `true`):
   *   the same failure, and the second spec fails with
   *   `expected '                                     …' not to contain
   *   'under raised track'`.
   */
  it('one free floor end under the bridge: says so, and where to reach it', () => {
    expect(text(bridge(0))).toContain('1 free end is under raised track. Reach it from “This layout, as a list”.');
  });

  it('with the floor straight clear of the bridge, no hint', () => {
    expect(text(bridge(200))).not.toContain('under raised track');
  });
});
