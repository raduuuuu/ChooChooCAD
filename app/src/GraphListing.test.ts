/**
 * THE LAYOUT AS A LIST: COMPLETE, NAMED, AND INERT (task U7a).
 *
 * Value: protects=every piece, end and joint appears exactly once under its
 * template name, state rides as a description, deleting a piece removes
 * exactly its entries, and nothing in the list claims to be operable
 * Value: fails_when=an entry is dropped or duplicated, a name drifts from
 * the template, the state moves into the name, or a tabindex or interactive
 * role appears before U7b makes the list operable
 * Value: why_new=the listing is new
 * Value: seam=`renderToStaticMarkup`, which needs no DOM; U7a asserts
 * structure only
 * Value: no_claim=nothing about events, focus order or announcements, which
 * are U7b's and need a real DOM (E11); nothing about how a given screen
 * reader voices `aria-label` on a list item
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { graphFromChain } from '../../engine/src/graph/fromChain.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { GraphListing, LISTING_CEILING } from './GraphListing.js';
import { reduce, type EditorState } from './editorReducer.js';
import { deletePiece, EMPTY_GRAPH } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const html = (graph: Graph) =>
  renderToStaticMarkup(createElement(GraphListing, { graph, resolve, ports }));
const labels = (markup: string) => [...markup.matchAll(/<li aria-label="([^"]*)"/g)].map((m) => m[1]!);
const run = (ids: string[], closed = false): Graph =>
  graphFromChain({ placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed });

/** A switch with a straight on its straight road: three kinds of end. */
const withSwitch: Graph = {
  pieces: [
    { pieceId: 's', partId: 'L', turn: 'right' },
    { pieceId: 'a', partId: 'A' },
  ],
  welds: [{ a: { pieceId: 's', port: 1 }, b: { pieceId: 'a', port: 0 } }],
};

describe('the graph listing', () => {
  /*
   * The docblock's worked examples, verbatim, so the template is the code's
   * and not only the comment's.
   *
   * MUTATION PROOF, run: drop `, a ${portPolarity(part, port)}` from the end
   * name. Fails with `expected [ …(7) ] to deeply equal [ …(7) ]` and the
   * diff shows the missing "a socket".
   */
  it('names each node by the template, with one worked example per type', () => {
    const markup = html(run(['E', 'E']));
    expect(labels(markup)).toEqual([
      'Piece 1: Large curve (E), turning left',
      'Start of piece 1, a socket',
      'End of piece 1, a peg',
      'Piece 2: Large curve (E), turning left',
      'Start of piece 2, a socket',
      'End of piece 2, a peg',
      'Joint 1: end of piece 1 to start of piece 2',
    ]);
    expect(markup).toContain('>Free</span>');
    expect(markup).toContain('>Joined to the start of piece 2</span>');
  });

  /*
   * MUTATION PROOF, run: render the state inside the end's `aria-label`
   * (append "Free" or "Joined" to `name`). Fails here with `expected null not
   * to be null`: no end is labelled by its name alone. The template spec
   * above fails too.
   */
  it('keeps state out of the name, as a description the item points to', () => {
    const markup = html(run(['E', 'E']));
    const end = markup.match(/<li aria-label="Start of piece 1, a socket" aria-describedby="([^"]+)">/);
    expect(end).not.toBeNull();
    expect(markup).toContain(`<span id="${end![1]}" class="graph-listing-state">Free</span>`);
  });

  it('names a switch by its heel and its two roads', () => {
    const l = labels(html(withSwitch));
    expect(l).toContain('Piece 1: Curved switch (L), branching right');
    expect(l).toContain('Heel of piece 1, a socket');
    expect(l).toContain('Straight road of piece 1, a peg');
    expect(l).toContain('Curved road of piece 1, a peg');
    expect(l).toContain('Joint 1: straight road of piece 1 to start of piece 2');
  });

  /*
   * A TURNED-ROUND PIECE READS THE WAY IT BENDS AS YOU BUILD. The M switch's
   * roads are sockets, so an E goes on by its peg end and its stored turn is
   * flipped (the auto-flip in layoutModel.ts). Named from its own start it
   * read "turning right" although the user pressed "Add Large curve" (left)
   * and watched it bend left. Built through the real reducer, so the graph is
   * the one the editor makes.
   *
   * MUTATION PROOF, each run separately:
   * - in `pieceName`, name the side from the stored turn always (`const side
   *   = stored`). Fails with `expected [ …(3) ] to deeply equal [ …(3) ]`, the
   *   diff showing "turning right, joined by its end";
   * - in `laidFrom`, take the EARLIER piece's port (`ia > ib ? w.b : w.a`).
   *   Fails the same way, and so do the template and switch specs above: an
   *   ordinary E-then-E run then reads "turning right, joined by its end".
   */
  it('names a turned-round curve from the end it went on by', () => {
    const build = (ids: string[]) => {
      let s: EditorState = { graph: EMPTY_GRAPH, cursor: null, armed: null };
      for (const partId of ids) s = reduce(s, { kind: 'add', partId, turn: 'left' }, ports);
      return labels(html(s.graph)).filter((x) => x.startsWith('Piece '));
    };
    expect(build(['M', 'E', 'E'])).toEqual([
      'Piece 1: Curved switch, peg heel (M), branching left',
      'Piece 2: Large curve (E), turning left, joined by its end',
      'Piece 3: Large curve (E), turning left, joined by its end',
    ]);
    // The same run off an L, whose roads are pegs, is not turned round.
    expect(build(['L', 'E', 'E'])).toEqual([
      'Piece 1: Curved switch (L), branching left',
      'Piece 2: Large curve (E), turning left',
      'Piece 3: Large curve (E), turning left',
    ]);
  });

  /*
   * EXACTLY ONCE: pieces, ends and joints counted against the graph, on a
   * closed loop and on a run with a switch.
   *
   * MUTATION PROOF, run: list each weld twice (`[...graph.welds,
   * ...graph.welds].map`). Fails with `expected 16 to be 8`.
   */
  it('lists every piece, every end and every joint exactly once', () => {
    for (const g of [run(Array(8).fill('E'), true), withSwitch]) {
      const l = labels(html(g));
      const pieces = l.filter((x) => x.startsWith('Piece '));
      const joints = l.filter((x) => x.startsWith('Joint '));
      const ends = l.filter((x) => !x.startsWith('Piece ') && !x.startsWith('Joint '));
      expect(pieces.length).toBe(g.pieces.length);
      expect(joints.length).toBe(g.welds.length);
      expect(ends.length).toBe(g.pieces.reduce((n, p) => n + ports(p).length, 0));
      expect(new Set(l).size).toBe(l.length);
    }
  });

  it('removes exactly one piece entry, with its ends and joints, when a piece is deleted', () => {
    const g = run(['E', 'E', 'E']);
    const after = deletePiece(g, ports, g.pieces[2]!.pieceId);
    const before = labels(html(g));
    const now = labels(html(after));
    expect(before.filter((x) => x.startsWith('Piece ')).length - now.filter((x) => x.startsWith('Piece ')).length).toBe(1);
    expect(now.filter((x) => x.startsWith('Joint ')).length).toBe(after.welds.length);
    expect(now).not.toContain('Piece 3: Large curve (E), turning left');
  });

  /*
   * THE INERT HALF MUST NOT ADVERTISE THE OPERABLE HALF.
   *
   * MUTATION PROOF, run: add `tabIndex={0}` to the end `<li>`. Fails with
   * `expected '<section class="graph-listing" aria-…' not to match
   * /tabindex/i`.
   */
  it('carries no tabindex, no interactive role and no active descendant, beyond its one disclosure', () => {
    for (const g of [run(Array(8).fill('E'), true), withSwitch]) {
      const markup = html(g);
      expect(markup).not.toMatch(/tabindex/i);
      expect(markup).not.toMatch(/\srole="/);
      expect(markup).not.toMatch(/aria-activedescendant/);
      expect(markup).not.toMatch(/<(button|a|input|select|option)\b/);
      // The one control is the disclosure's summary, which really does open
      // and close the list. Exactly one, and none inside the lists.
      expect(markup.match(/<summary/g)).toHaveLength(1);
      expect(markup.slice(markup.indexOf('</summary>'))).not.toContain('<summary');
    }
  });

  it('renders nothing for an empty layout, and a sentence past the ceiling', () => {
    expect(html({ pieces: [], welds: [] })).toBe('');
    const big = run(Array(LISTING_CEILING + 1).fill('A'));
    const markup = html(big);
    expect(markup).toContain(`${LISTING_CEILING + 1} pieces is more than this list shows`);
    expect(markup).not.toContain('<li');
  });
});

/*
 * THE CONTROL ROW, FIXED IN PASSING. U5 made the edit buttons three, and the
 * desktop rule still gave them halves of the row while the last three took
 * thirds, so Clear shared a row with the first preset and a gap.
 *
 * MUTATION PROOF, run: restore `grid-column: span 3` on
 * `.palette-controls > button`. Fails with `expected 'span 3' to be 'span 2'`.
 */
describe('the control row', () => {
  it('gives every control button a third of the row at desktop width', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const spans = [...css.matchAll(/\.palette-controls > button[^{]*\{([^}]*)\}/g)].flatMap((m) =>
      [...m[1]!.matchAll(/grid-column\s*:\s*([^;]+)/g)].map((d) => d[1]!.trim()),
    );
    expect(spans[spans.length - 1]).toBe('span 2');
    expect(css).not.toMatch(/\.palette-controls > button:nth-last-of-type/);
  });
});

/*
 * THE LIST MUST NOT STRETCH THE PAGE. Measured before these rules: a ten-piece
 * loop made the page 1890px tall on a 720px window (wide), and the open list
 * crushed the parts tray to nothing (narrow).
 *
 * MUTATION PROOF, run: delete `overflow-y: auto;` from the 1000px block's
 * `.palette`. Fails with `expected false to be true` on the wide-rail check.
 */
describe('the listing stays inside its column', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('scrolls the wide rail as a whole, and the narrow tray while the list is open', () => {
    const wide = css.slice(css.indexOf('@media (min-width: 1000px)'));
    const railRule = wide.match(/\.palette\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(/overflow-y\s*:\s*auto/.test(railRule)).toBe(true);
    expect(css).toMatch(/\.palette:has\(\.graph-listing\[open\]\)\s*\{\s*overflow-y\s*:\s*auto/);
  });
});


/*
 * U7b: THE LIST BECOMES OPERABLE WHEN IT IS GIVEN SOMETHING TO DO.
 *
 * With handlers, every FREE end is a native button and every joint has a
 * Break button; a joined end stays text, because a control there would do
 * nothing. Still no tabindex and no active-descendant: native buttons are in
 * the tab order on their own, in reading order. Without handlers the list is
 * exactly the read-only U7a list, which the specs above still pin.
 *
 * MUTATION PROOF, run: render the button for joined ends too (drop `&&
 * !other` from the operable branch). Fails with `expected [ 'Start of piece
 * 1, a socket', …(11) ] to deeply equal [ 'Start of piece 1, a socket', …(1)
 * ]`: twelve end buttons where two ends are free.
 */
describe('the operable list', () => {
  const operable = (graph: Graph, armed: { pieceId: string; port: number } | null = null) =>
    renderToStaticMarkup(
      createElement(GraphListing, {
        graph,
        resolve,
        ports,
        onPortClick: () => undefined,
        onBreak: () => undefined,
        armed,
      }),
    );
  const buttons = (markup: string) => [...markup.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]!);

  it('makes free ends and joints the only controls, as native buttons', () => {
    const g = run(['E', 'E', 'E', 'E', 'E', 'E']);
    const markup = operable(g);
    const ends = buttons(markup).filter((b) => b !== 'Break');
    expect(ends).toEqual(['Start of piece 1, a socket', 'End of piece 6, a peg']);
    expect(buttons(markup).filter((b) => b === 'Break')).toHaveLength(5);
    expect(markup).toContain('aria-label="Break Joint 1: end of piece 1 to start of piece 2"');
    expect(markup).not.toMatch(/tabindex/i);
    expect(markup).not.toMatch(/aria-activedescendant/);
  });

  it('says on the selected end that it is selected', () => {
    const g = run(['E', 'E']);
    const markup = operable(g, { pieceId: g.pieces[1]!.pieceId, port: 1 });
    expect(markup).toContain('Selected. Choose another free end to join it to</span>');
  });

  it('stays read-only without handlers', () => {
    expect(html(run(['E', 'E']))).not.toContain('<button');
  });
});
