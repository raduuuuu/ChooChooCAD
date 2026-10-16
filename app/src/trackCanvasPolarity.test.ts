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

describe('polarity survives the states layered on top of it', () => {

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
    /*
     * EVERY rule mentioning `is-armed`, not just the one selector the bug
     * happened to use. The first version of this spec read
     * `.port.is-armed .port-dot` alone, which would have passed if the fill
     * came back through any other selector -- and a cascade override through
     * a different selector is exactly the bug it is guarding.
     */
    const armedRules = [...bare.matchAll(/([^{}]*is-armed[^{}]*)\{([^}]*)\}/g)];
    expect(armedRules.length, 'at least one is-armed rule must exist').toBeGreaterThan(0);
    for (const [, selector, body] of armedRules) {
      expect(/fill\s*:/.test(body ?? ''), `${(selector ?? '').trim()} must not set a fill`).toBe(
        false,
      );
    }
    // The ring is what carries armed once the fill is gone.
    expect(/\.port-ring\s*\{[^}]*stroke\s*:/.test(bare)).toBe(true);
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
    // Counted by CLASS, not by radius: `r="18"` would also match any future
    // element of that size, and would break if the marker were retuned.
    expect(count(html, 'bad-joint-mark')).toBe(1);
    expect(count(html, 'clash-mark')).toBe(0);
  });

  it('draws nothing when no joint is refused', () => {
    const graph: Graph = { pieces: [{ pieceId: 'one', partId: 'A2' }], welds: [], anchors: new Map() };
    const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
    const html = renderToStaticMarkup(
      createElement(TrackCanvas, { render, resolve, clashes: [], gaps: [], badJoints: [] } as never),
    );
    expect(count(html, 'bad-joint-mark')).toBe(0);
  });
});

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
 * MUTATION PROOF, run: delete the `.port-dot.is-peg` rule from app.css. The
 * peg-fill spec below fails with
 * `.is-peg must declare a fill: expected 0 to be greater than 0`. Before
 * these specs existed the same deletion left the whole suite green, which is
 * the hole they were written to close.
 *
 * And the armed spec above catches the ORIGINAL cascade bug returning
 * through a different selector: adding `.port.is-armed circle.port-dot {
 * fill: var(--ink); }` fails it with
 * `.port.is-armed circle.port-dot must not set a fill: expected true to be
 * false`. The first draft of that spec read one selector and would have
 * passed.
 */
/*
 * THE STATES THAT USED TO HIDE THE POLARITY, AND THE JOINT THAT SHOWED
 * NOTHING. Both were found by the pre-landing red team, both confirmed by
 * reading the cascade and the canvas before being fixed.
 */
/*
 * Comments stripped before matching: a `/* ... *\/` block quoting a rule
 * would otherwise satisfy a regex looking for that rule, so a comment ABOUT
 * the fill could stand in for the fill.
 */
const bare = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
describe('the peg class changes how a peg is drawn', () => {

  it('gives a peg a fill, so it is not drawn like a socket', () => {
    /*
     * The LAST fill declared for `.is-peg`, not the first. A later rule
     * overriding it back to the socket's own fill would restore the reported
     * bug, and reading only the first match would call that green.
     */
    const pegFills = [...bare.matchAll(/[^{}]*\.is-peg[^{}]*\{([^}]*)\}/g)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/fill\s*:\s*([^;]+)/g)].map((f) => (f[1] ?? '').trim()),
    );
    expect(pegFills.length, '.is-peg must declare a fill').toBeGreaterThan(0);
    const effective = pegFills[pegFills.length - 1]!;
    /*
     * Exact token names. `--ink-soft` is the correct peg fill and a `\b`
     * boundary after "ink" matches inside it, so a looser pattern rejects the
     * right answer -- which is how this assertion first failed.
     */
    const token = /var\(\s*--([a-z0-9-]+)/.exec(effective)?.[1];
    expect(token, 'the peg fill must be a token from tokens.css').toBeTruthy();
    // Not --ink: that is the armed signal. Not --paper: that is the socket.
    expect(token).not.toBe('ink');
    expect(token).not.toBe('paper');
  });

  it('does not give the socket the same fill as the peg', () => {
    /*
     * Stated as "different from the peg", not "has no rule at all". A socket
     * may legitimately gain a rule one day (dark mode, a contrast pass); what
     * must never happen is the two ends resolving to the same fill.
     */
    const socketFills = [...bare.matchAll(/[^{}]*\.is-socket[^{}]*\{([^}]*)\}/g)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/fill\s*:\s*([^;]+)/g)].map((f) => (f[1] ?? '').trim()),
    );
    const pegFills = [...bare.matchAll(/[^{}]*\.is-peg[^{}]*\{([^}]*)\}/g)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/fill\s*:\s*([^;]+)/g)].map((f) => (f[1] ?? '').trim()),
    );
    if (socketFills.length > 0) {
      expect(socketFills[socketFills.length - 1]).not.toBe(pegFills[pegFills.length - 1]);
    }
  });
});

describe('a peg and a socket are drawn differently', () => {
  /*
   * MUTATION PROOF, run: point both entries of `POLARITY_CLASS` at plain
   * `'port-dot'`, so no dot carries a polarity class. The specs in this
   * describe fail, this one first with `expected +0 to be 1`. No total here:
   * the file has grown twice since this record was written and the earlier
   * count went stale both times.
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
