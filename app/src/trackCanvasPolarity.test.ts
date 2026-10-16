/**
 * THE CANVAS DRAWS THE DIFFERENCE BETWEEN A PEG AND A SOCKET.
 *
 * Value: protects=you can see which piece you placed and which end of it is
 * which, before making a join the solver would refuse
 * Value: fails_when=the class stops being emitted, or a heel starts taking one
 * Value: why_new=reported from the live site: "there is no difference when i
 * place a piece with 2 pegs or 2 sockets or a normal one". Measured on
 * woodentrain.world, A2, B2 and C2 produced byte-identical path geometry --
 * four paths each, same `d`, same fills -- and two identical hollow dots. The
 * polarity CHECK was working the whole time and the verdict reported it in
 * words; the picture simply never showed it.
 * Value: seam=`renderToStaticMarkup` needs no DOM, so the component renders in
 * this node environment. It cannot dispatch an event, which is why this reads
 * markup rather than clicking a port.
 * Value: no_claim=nothing about the COLOURS. `app.css` owns whether a peg is
 * filled with `--ink-soft` or something else; what is pinned here is that the
 * two ends are marked differently and that a heel is marked as neither.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const markupFor = (partId: string): string => {
  const graph: Graph = { pieces: [{ pieceId: 'one', partId }], welds: [] };
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  return renderToStaticMarkup(
    createElement(TrackCanvas, { render, resolve, clashes: [], gaps: [] } as never),
  );
};

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe('a peg and a socket are drawn differently', () => {
  /*
   * MUTATION PROOF, run: drop the `is-${p.polarity}` class so every dot is
   * plain `port-dot`. ALL FOUR specs in this file fail; this one with
   * `expected +0 to be 1`.
   */
  it('an ordinary straight shows one of each', () => {
    const html = markupFor('A2');
    expect(count(html, 'port-dot is-socket')).toBe(1);
    expect(count(html, 'port-dot is-peg')).toBe(1);
  });

  /*
   * THE REPORTED CASE. These two and A2 are all 54mm and drew identically.
   */
  it('the two-peg piece shows two pegs and no sockets', () => {
    const html = markupFor('B2');
    expect(count(html, 'port-dot is-peg')).toBe(2);
    expect(count(html, 'port-dot is-socket')).toBe(0);
  });

  it('the two-socket piece shows two sockets and no pegs', () => {
    const html = markupFor('C2');
    expect(count(html, 'port-dot is-socket')).toBe(2);
    expect(count(html, 'port-dot is-peg')).toBe(0);
  });

  /*
   * The three pieces the report was about, side by side: whatever the styling,
   * these three must not all render the same ends. This is the assertion that
   * would have caught the original defect, stated as the user stated it.
   */
  it('A2, B2 and C2 no longer draw identical ends', () => {
    const ends = ['A2', 'B2', 'C2'].map((id) => {
      const html = markupFor(id);
      return `${count(html, 'is-peg')}peg/${count(html, 'is-socket')}socket`;
    });
    expect(new Set(ends).size).toBe(3);
  });
});
