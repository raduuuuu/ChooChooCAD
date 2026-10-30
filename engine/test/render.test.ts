/**
 * Render geometry, engine side.
 *
 * This file used to also pin the SVG sweep flag, and it did so against its own
 * hand-copied `SWEEP_FOR_LEFT = 1` rather than against the renderer. That made
 * it a circular pin: inverting the renderer's literal left the whole suite
 * green, proven by mutation during the fourth eng review. Those assertions now
 * live in `app/src/trackPath.test.ts`, where they parse the flag out of
 * `segmentPath`'s actual output, and the flag itself has one owner in
 * `app/src/trackPath.ts`.
 *
 * What stays here is the part that is genuinely about the engine: that the float
 * walk emits one segment per placed piece and carries a radius only for curves.
 */

import { describe, expect, it } from 'vitest';
import { getPart } from '../data/brio.js';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { walkFloat } from '../src/geom/fk.js';
import { placeAll } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';
import { renderBounds, renderGraph } from '../src/graph/render.js';
import { centrelineRadiusMm } from '../src/parts/schema.js';
import type { Layout, Part } from '../src/parts/schema.js';

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

describe('the float walk', () => {
  it('emits one segment per placed piece, with curves carrying a radius', () => {
    const { segments, poses } = walkFloat(
      loop([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D']),
      getPart,
    );
    expect(segments).toHaveLength(10);
    expect(poses).toHaveLength(11);
    // Derived from the part, not a literal: this asserts that a curve segment
    // CARRIES its part's radius, which is the renderer contract. Pinning the
    // radius value itself is analytic.test.ts's source-comparison test.
    const expected = centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    expect(segments.filter((s) => s.kind === 'curve').every((s) => s.centrelineRadiusMm === expected)).toBe(true);
    expect(segments.filter((s) => s.kind === 'straight').every((s) => s.centrelineRadiusMm === undefined)).toBe(true);
  });
});

/*
 * Value: protects=renderGraph's free-port flag, one drawn segment per ROAD carrying its part's radius and turn-driven sweep, and renderBounds' empty fallback
 * Value: fails_when=a weld stops claiming both of its ends, sweep stops following `turn`, a road stops carrying its radius, or empty bounds return Infinity
 * Value: why_new=this file covered only walkFloat, which no production code calls any more; renderGraph is what App.tsx draws from and had no test at all
 * Value: seam=none
 * Value: no_claim=nothing about SVG path text (trackPath.test.ts owns the sweep flag and the `d` string) and nothing about hit-test tolerance in the browser
 *
 * Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
 */
describe('the graph renderer, which is what the canvas actually draws', () => {
  const resolve = makeResolver(BUILT_IN);
  const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
  const render = (g: Graph) => renderGraph(g, ports, resolve, placeAll(g, ports));
  const chain = (ids: string[], closed: boolean, turn: 'left' | 'right' = 'left') =>
    graphFromChain({ placements: ids.map((partId) => ({ partId, turn })), closed });

  it('marks a port free only when NO weld claims it, which is what free-end clicking hit-tests', () => {
    // Three straights in a row: the two outer ends are clickable and the four
    // welded ones are not. MUTATION: dropping the `b` side of each weld from
    // `claimed` reports p1#0 and p2#0 free as well, and the UI then offers to
    // attach a piece to a joint that is already made.
    const r = render(chain(['A', 'A', 'A'], false));
    const free = r.ports.filter((p) => p.free).map((p) => `${p.pieceId}#${p.port}`).sort();
    expect(free).toEqual(['p0#0', 'p2#1']);
    expect(r.ports).toHaveLength(6);
  });

  it('a closed loop leaves nothing free, so a finished circle offers no end to click', () => {
    expect(render(chain(Array(8).fill('E'), true)).ports.every((p) => !p.free)).toBe(true);
  });

  it('emits one segment per road: a curve carries its part radius, a straight carries none', () => {
    const expected = centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    const curves = render(chain(Array(8).fill('E'), true)).segments;
    expect(curves).toHaveLength(8);
    expect(curves.every((s) => s.kind === 'curve' && s.centrelineRadiusMm === expected)).toBe(true);
    const straights = render(chain(['A', 'A', 'A'], false)).segments;
    expect(straights).toHaveLength(3);
    expect(straights.every((s) => s.kind === 'straight' && s.centrelineRadiusMm === undefined)).toBe(true);
  });

  it('the drawn sweep follows the piece turn, so a right curve is not drawn as a left one', () => {
    // MUTATION: inverting the `piece.turn === 'right'` test in render.ts swaps
    // both expectations below, which is a track drawn as its own mirror image.
    expect(render(chain(Array(8).fill('E'), true, 'right')).segments.every((s) => s.sweep === 'right')).toBe(true);
    expect(render(chain(Array(8).fill('E'), true, 'left')).segments.every((s) => s.sweep === 'left')).toBe(true);
  });

  it('the circle it draws is as wide as the circle it computes, in both directions', () => {
    // Derived from the part, not a copied figure: eight 45-degree arcs put
    // their ports on a circle of the part's own centreline radius, so the
    // drawing must span one diameter each way. MUTATION (run): making
    // renderGraph read the identity instead of `placement.frames` collapses
    // both spans to 0 -- the renderer disagreeing with the solver about where
    // a piece is, which is the one thing one shared traversal exists to stop.
    // Halving render.ts's RAD does NOT fail here and the comment used to say
    // it would: RAD only scales the outward heading, never a position.
    // What this does not pin is the radius FIGURE (both sides derive it from
    // centrelineRadiusMm; analytic.test.ts compares that to the source) or
    // renderBounds' ports loop, which a closed loop's segments already cover.
    const b = renderBounds(render(chain(Array(8).fill('E'), true)));
    const diameter = 2 * centrelineRadiusMm(getPart('E') as Extract<Part, { kind: 'curve' }>);
    expect(b.maxX - b.minX).toBeCloseTo(diameter, 6);
    expect(b.maxY - b.minY).toBeCloseTo(diameter, 6);
  });

  it('an empty canvas has zero bounds, never Infinity, because the viewBox is computed from them', () => {
    // MUTATION: removing the `Number.isFinite` guard in renderBounds returns
    // +/-Infinity here, and TrackCanvas then writes a NaN viewBox and draws
    // nothing at all -- a blank page for an empty layout.
    const empty = render({ pieces: [], welds: [] });
    expect(empty.segments).toEqual([]);
    expect(renderBounds(empty)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

/**
 * EVERY DRAWN END CARRIES ITS POLARITY, AND IT IS THE CHECK'S OWN ANSWER.
 *
 * Value: protects=a two-peg piece, a two-socket piece and an ordinary one are
 * distinguishable on the canvas, so a join the solver will refuse can be seen
 * before it is made rather than explained afterwards
 * Value: fails_when=`polarity` stops being carried, or stops agreeing with
 * `portPolarity`, including at a switch's heel
 * Value: why_new=B2 (two pegs), C2 (two sockets) and A2 all drew BYTE-IDENTICAL
 * geometry -- four paths, same `d`, same fills, two hollow dots -- verified on
 * the live site. The polarity check worked and the verdict said so in words,
 * but nothing in the picture differed, so the user could not tell which piece
 * they had placed or which end of it was which.
 * Value: seam=`renderGraph` takes `resolve`, so the part's `ends` were always
 * reachable from here; only the field was missing.
 * Value: no_claim=nothing about how the canvas STYLES it. That is
 * `trackCanvasPolarity.test.ts`, and the two are deliberately separate: this
 * pins the datum, that pins the ink.
 */
describe('a rendered end knows whether it is a peg or a socket', () => {
  const resolveBuiltIn = makeResolver(BUILT_IN);
  const portsOfPiece = (piece: Piece): readonly Port[] =>
    portsOf(resolveBuiltIn(piece.partId), piece.turn);
  const renderOf = (partId: string) => {
    const graph: Graph = { pieces: [{ pieceId: 'one', partId }], welds: [] };
    return renderGraph(
      graph,
      portsOfPiece,
      resolveBuiltIn,
      placeAll(graph, portsOfPiece),
    );
  };

  /*
   * MUTATION PROOF, run: return `part.ends.start` for every index in
   * `portPolarity`. RE-RUN after the de-circularising fix below. This spec
   * fails with `expected [ 'socket', 'socket' ] to deeply equal
   * [ 'socket', 'peg' ]`; the agreement sweep fails with `A2 port 1: expected
   * 'socket' to be 'peg'`; the switch spec with `expected
   * [ null, 'socket', 'socket' ] to deeply equal [ null, 'peg', 'peg' ]`; and
   * the polarity-violation and canvas specs fail with their own messages,
   * which are all different. An earlier version of this record said they
   * shared one message; they do not, and it also gave a failing count whose
   * groups did not add up. No total here on purpose.
   *
   * The agreement sweep failing is the point of that fix: while it computed
   * its expectation with `portPolarity` itself, this mutation moved both
   * sides together and left it GREEN. Reading `ends` directly is what makes
   * it red.
   */
  it('an ordinary straight alternates socket then peg', () => {
    expect(renderOf('A2').ports.map((p) => p.polarity)).toEqual(['socket', 'peg']);
  });

  /*
   * The two parts the user cannot otherwise tell apart. Both are 54mm, both
   * draw the same four paths; only this differs.
   *
   * The field cannot silently stop being carried: dropping it from the pushed
   * port fails `tsc --noEmit`, because the object no longer satisfies
   * `RenderedPort`. That is a compiler check, not this spec's -- this spec
   * would still pass -- so it is stated as a property, not as a count of
   * diagnostics that would rot.
   */
  it('B2 is two pegs and C2 is two sockets', () => {
    expect(renderOf('B2').ports.map((p) => p.polarity)).toEqual(['peg', 'peg']);
    expect(renderOf('C2').ports.map((p) => p.polarity)).toEqual(['socket', 'socket']);
  });

  /*
   * THE PROPERTY THAT MATTERS, over the whole catalogue at both turns: the
   * canvas and the solver answer this question the same way. The two
   * disagreeing is the defect class this canvas has shipped twice, once on
   * clash counts and once on clash markers.
   *
   * MUTATION PROOF, run: compute the field as
   * `portPolarity(part, i === 0 ? 1 : 0)`. TWO specs fail, this one with
   * `A2 port 0: expected 'peg' to be 'socket'`.   *
   * And for the heel: compute it as
   * `portPolarity(part, part.kind === 'switch' && i === 0 ? 1 : i)`, which
   * draws the heel with its roads' polarity. This spec fails with
   * `L port 0: expected 'peg' to be 'socket'`.
   */
  it('agrees with portPolarity for every catalogue part, both turns', () => {
    for (const part of BUILT_IN) {
      for (const turn of ['left', 'right'] as const) {
        const graph: Graph = { pieces: [{ pieceId: 'one', partId: part.id, turn }], welds: [] };
        const r = renderGraph(graph, portsOfPiece, resolveBuiltIn, placeAll(graph, portsOfPiece));
        r.ports.forEach((rendered, i) => {
          /*
           * READ FROM `ends`, NOT FROM `portPolarity`. Computing the expected
           * value with the same function the renderer calls made this a
           * tautology: both sides moved together, so swapping `start` and
           * `end` inside `portPolarity` left it green. Reading the part's own
           * data is one level less circular and catches that swap.
           */
          const expected =
            part.kind === 'multi-road' ? part.ports[i]!.polarity : i === 0 ? part.ends.start : part.ends.end;
          expect(rendered.polarity, `${part.id} port ${i}`).toBe(expected);
        });
        // The sweep reaches real heels (L, M, O1, P1) and the H crossing, so
        // a multi-road piece's ends are checked here like any other.
        expect(r.ports, part.id).toHaveLength(part.kind === 'multi-road' ? part.ports.length : 2);
      }
    }
  });
});
