/**
 * A JOIN THAT CAN NEVER BE BUILT IS NOT OFFERED (brio-TODOS.md P2, "Offer only
 * polarity-compatible free ends in the editor").
 *
 * Value: protects=with an end selected, a peg cannot be joined to a peg, nor
 * an end to one on the other level; the click changes no track and says why;
 * the canvas dims those ends and names the reason; the list names it too; two
 * sockets still join, through an adapter
 * Value: fails_when=the reducer welds a refused pair, the refusal goes
 * unsaid, the canvas or list stops marking those ends, or sockets are refused
 * Value: why_new=the editor made any join it was asked for, and only the
 * verdict then said it could never be built
 * Value: seam=the reducer and `describeAction` directly; renderToStaticMarkup
 * for the canvas and the list; the stylesheet as text
 * Value: no_claim=the painted dimming
 */

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { fromInt } from '../../engine/src/geom/cyclotomic.js';
import { connectorSites } from '../../engine/src/graph/feasible.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece, type PortRef } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { describeAction } from './announce.js';
import { reduce, type EditorState } from './editorReducer.js';
import { GraphListing } from './GraphListing.js';
import { joinRefusal } from './layoutModel.js';
import { TrackCanvas } from './TrackCanvas.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** Five lone pieces: two-peg `p` and `q`, two-socket `s` and `t`, and a raised two-socket `u`. */
const g: Graph = {
  pieces: ['p:B', 'q:B', 's:C', 't:C', 'u:C'].map((x) => {
    const [pieceId, partId] = x.split(':') as [string, string];
    return { pieceId, partId, turn: 'left' as const };
  }),
  welds: [],
  anchors: new Map([
    ['p', { pos: fromInt(0), heading: 0 }],
    ['q', { pos: fromInt(400), heading: 0 }],
    ['s', { pos: fromInt(800), heading: 0 }],
    ['t', { pos: fromInt(1200), heading: 0 }],
    ['u', { pos: fromInt(1600), heading: 0, level: 1 }],
  ]),
};
const end = (pieceId: string, port = 1): PortRef => ({ pieceId, port });
const sites = connectorSites(g, ports, placeAll(g, ports));
const armedAt = (ref: PortRef): EditorState => ({ graph: g, cursor: ref, armed: ref });

describe('which joins are refused', () => {
  /*
   * MUTATION PROOFS, run:
   * - the peg check removed from `joinRefusal`: fails with `expected null to
   *   be 'pegs'`.
   * - the level check removed: fails with `expected null to be 'levels'`.
   * - sockets refused too (`pa.polarity === pb.polarity`): fails with
   *   `expected 'pegs' to be 'levels'` (two sockets now read as refused).
   */
  it('two pegs and two levels are refused; two sockets and an end with itself are not', () => {
    expect(joinRefusal(sites, end('p'), end('q'))).toBe('pegs');
    expect(joinRefusal(sites, end('s'), end('u'))).toBe('levels');
    expect(joinRefusal(sites, end('s'), end('t'))).toBeNull();
    expect(joinRefusal(sites, end('p'), end('s'))).toBeNull();
    expect(joinRefusal(sites, end('p'), end('p'))).toBeNull();
  });
});

describe('clicking a refused end', () => {
  /*
   * MUTATION PROOFS, run:
   * - the refusal removed from `clickPort`: fails with `expected [ { …(2) }
   *   ] to deeply equal []`.
   * - the refusal sentence removed from `describeAction`: fails with
   *   `expected null to be 'Can\'t join the end of piece 1 to the…'`.
   */
  it('makes no joint, keeps the end selected, and says why', () => {
    const before = armedAt(end('p'));
    const after = reduce(before, { kind: 'clickPort', ref: end('q') }, ports);
    expect(after.graph.welds).toEqual([]);
    expect(after.armed).toEqual(end('p'));
    expect(describeAction(before, { kind: 'clickPort', ref: end('q') }, after, resolve)).toBe(
      "Can't join the end of piece 1 to the end of piece 2: both are pegs, and two pegs never join.",
    );
  });

  it('two sockets still join, through an adapter', () => {
    const after = reduce(armedAt(end('s')), { kind: 'clickPort', ref: end('t') }, ports);
    expect(after.graph.welds).toHaveLength(1);
  });
});

describe('the canvas and the list mark the ends that cannot join', () => {
  const unjoinable = new Map([['q#1', 'pegs' as const]]);
  /*
   * MUTATION PROOFS, run:
   * - the `is-unjoinable` class dropped from the canvas: fails with
   *   `expected '<div class="canvas-frame"><div class=…' to match
   *   /class="port is-unjoinable"[^>]*aria-l…/`.
   * - the reason left out of the list: fails with `expected 'This layout, as
   *   a list: 5 pieces, 0 j…' to contain 'Can\'t join the selected end: both
   *   ar…'`.
   * - the rule's opacity a literal 0.3: fails with `expected '0.3' to be
   *   'var(--unjoinable-opacity)'`.
   */
  it('dimmed on the canvas, with the reason in its name', () => {
    const html = renderToStaticMarkup(
      createElement(TrackCanvas, { render: renderGraph(g, ports, resolve, placeAll(g, ports)), resolve, armed: end('p'), unjoinable }),
    ).replace(/&#x27;/g, "'");
    expect(html).toMatch(/class="port is-unjoinable"[^>]*aria-label="Free peg end, can't join the selected end: both are pegs"/);
  });

  it('named in the list', () => {
    const text = renderToStaticMarkup(
      createElement(GraphListing, { graph: g, resolve, ports, onPortClick: () => {}, armed: end('p'), unjoinable }),
    )
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'");
    expect(text).toContain("Can't join the selected end: both are pegs");
  });

  it('the stylesheet dims it by the token', () => {
    const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = [...css.matchAll(/\.port\.is-unjoinable\s*\{([^}]*)\}/g)].pop()?.[1] ?? '';
    expect(rule.match(/opacity:\s*([^;]+)/)?.[1]?.trim()).toBe('var(--unjoinable-opacity)');
    expect(rule).toMatch(/cursor:\s*not-allowed/);
  });
});
