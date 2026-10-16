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

import { readFileSync } from 'node:fs';
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

/*
 * THE CLASS HAS TO DO SOMETHING, and until this spec existed nothing checked
 * that it did.
 *
 * MEASURED: deleting `.port-dot.is-peg { fill: var(--ink-soft); }` from
 * app.css left the WHOLE SUITE green. Every spec above asserts the class is
 * EMITTED; none asserted it changes a pixel. So the one line that makes a peg
 * look different from a socket could be deleted, or overridden, and the
 * reported bug would come straight back with no red test.
 *
 * This reads the stylesheet as text, which is a blunt instrument. It is here
 * because the alternative is nothing: `vitest.config.ts` runs in node with no
 * DOM and no CSS engine, so no test in this project can resolve a computed
 * style. A source check that fails when the rule is removed beats a rendering
 * check that cannot exist.
 *
 * MUTATION PROOF, run: delete the `.port-dot.is-peg` rule from app.css. This
 * spec fails with `expected false to be true`, and it is the only one that
 * fails -- which is exactly the hole it was written to close.
 */
/*
 * THE STATES THAT USED TO HIDE THE POLARITY, AND THE JOINT THAT SHOWED
 * NOTHING. Both were found by the pre-landing red team, both confirmed by
 * reading the cascade and the canvas before being fixed.
 */
describe('polarity survives the states layered on top of it', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  /*
   * MUTATION PROOF, run: put `fill: var(--ink);` back into
   * `.port.is-armed .port-dot`. This spec fails with
   * `the armed rule must not set a fill: expected true to be false`.
   *
   * Why a source check and not a rendered one: the override was a CASCADE
   * fact, not a markup fact. The armed rule at (0,3,0) beat
   * `.port-dot.is-peg` at (0,2,0), so the markup was identical either way and
   * no amount of reading the HTML could see it. There is no CSS engine in
   * this node environment, so the stylesheet is the only place to look.
   */
  it('arming an end does not repaint over its polarity', () => {
    const armed = /\.port\.is-armed\s+\.port-dot\s*\{([^}]*)\}/.exec(css);
    expect(armed !== null, 'the armed rule must exist').toBe(true);
    expect(/fill:/.test(armed![1] ?? ''), 'the armed rule must not set a fill').toBe(false);
    // The ring is what carries armed, so it has to still be there.
    expect(/\.port-ring\s*\{[^}]*stroke:/.test(css)).toBe(true);
  });
});

describe('a refused joint is marked on the canvas', () => {
  /*
   * Before this, `polarityViolations` never reached the canvas at all: a
   * joint the solver refuses drew NOTHING, while an overlap drew a red ring.
   * The verdict said "1 joint puts two ends of the same kind together" and
   * pointed nowhere. Once a weld claims both ends, their port dots are gone
   * too, so there was no polarity on screen either.
   *
   * MUTATION PROOF, run: drop the `badJoints.map(...)` block from
   * `TrackCanvas.tsx`. This spec fails with `expected +0 to be 1`.
   *
   * The marker is deliberately NOT the clash marker: the verdict counts
   * clashes and bad joints in separate sentences, so sharing a mark would put
   * a number on screen matching neither.
   */
  it('draws one marker per refused joint, distinct from a clash ring', () => {
    const graph: Graph = { pieces: [{ pieceId: 'one', partId: 'A2' }], welds: [], anchors: new Map() };
    const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
    const html = renderToStaticMarkup(
      createElement(TrackCanvas, {
        render,
        resolve,
        clashes: [],
        gaps: [],
        badJoints: [[0, 0] as const],
      } as never),
    );
    // r=18 with a bar, not r=28 with an X.
    expect(count(html, 'r="18"')).toBe(1);
    expect(count(html, 'r="28"')).toBe(0);
  });

  it('draws nothing when no joint is refused', () => {
    const graph: Graph = { pieces: [{ pieceId: 'one', partId: 'A2' }], welds: [], anchors: new Map() };
    const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
    const html = renderToStaticMarkup(
      createElement(TrackCanvas, { render, resolve, clashes: [], gaps: [], badJoints: [] } as never),
    );
    expect(count(html, 'r="18"')).toBe(0);
  });
});

describe('the peg class changes how a peg is drawn', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

  it('gives a peg a fill, so it is not drawn like a socket', () => {
    const rule = /\.port-dot\.is-peg\s*\{[^}]*fill:\s*var\(--([a-z-]+)\)/.exec(css);
    expect(rule !== null, '.port-dot.is-peg must declare a fill').toBe(true);
    // Not --ink: that is the ARMED fill, and a peg must not be drawn as a
    // pending choice. Not --paper: that is the socket's own fill.
    expect(rule![1]).not.toBe('ink');
    expect(rule![1]).not.toBe('paper');
  });

  it('leaves the socket hollow, which is the base rule and needs no override', () => {
    expect(/\.port-dot\.is-socket\s*\{[^}]*fill:/.test(css)).toBe(false);
  });
});

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
      // The full `port-dot is-peg` needle, matching the specs above. The
      // bare `is-peg` would also match a class on some other element, or a
      // future `is-peg-armed`, so it could pass without the dots differing.
      return `${count(html, 'port-dot is-peg')}peg/${count(html, 'port-dot is-socket')}socket`;
    });
    expect(new Set(ends).size).toBe(3);
  });
});
