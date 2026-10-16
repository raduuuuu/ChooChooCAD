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
import type { Layout, Part, SwitchPart } from '../src/parts/schema.js';

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
 * `portPolarity`, or a heel stops being exempt
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
   * `portPolarity`. This spec fails with
   * `expected [ 'socket', 'socket' ] to deeply equal [ 'socket', 'peg' ]`, and
   * so do the polarity-violation specs and the canvas specs. No count here on
   * purpose: an earlier version of this record gave one, and its groups did
   * not add up to it. What matters is the SHAPE -- that function is the one
   * source both the check and the drawing read, so breaking it breaks both
   * together rather than letting them disagree.
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
   * `A2 port 0: expected 'peg' to be 'socket'`.
   */
  it('agrees with portPolarity for every catalogue part, both turns', () => {
    for (const part of BUILT_IN) {
      for (const turn of ['left', 'right'] as const) {
        const graph: Graph = { pieces: [{ pieceId: 'one', partId: part.id, turn }], welds: [] };
        const r = renderGraph(graph, portsOfPiece, resolveBuiltIn, placeAll(graph, portsOfPiece));
        const list = portsOfPiece({ pieceId: 'one', partId: part.id, turn });
        r.ports.forEach((rendered, i) => {
          /*
           * READ FROM `ends`, NOT FROM `portPolarity`. Computing the expected
           * value with the same function the renderer calls made this a
           * tautology: both sides moved together, so swapping `start` and
           * `end` inside `portPolarity` left it green. Reading the part's own
           * data is one level less circular and catches that swap.
           */
          const expected =
            list[i]!.kind === 'heel' ? null : i === 0 ? part.ends.start : part.ends.end;
          expect(rendered.polarity, `${part.id} port ${i}`).toBe(expected);
        });
        // No catalogue part is a switch, so none of them may yield null.
        // Stated here rather than implied, so the heel-exemption claim does
        // not rest on a sweep that never reaches a heel.
        expect(r.ports.every((rp) => rp.polarity !== null), part.id).toBe(true);
      }
    }
  });
});

/**
 * THE HEEL BRANCH, which no catalogue part can reach.
 *
 * Value: protects=a heel is drawn as neither a peg nor a socket, matching the
 * exemption the polarity check already makes for it
 * Value: fails_when=the `kind === 'heel'` gate is dropped, so a heel takes
 * `portPolarity(part, 0)` and the canvas asserts a polarity the check refuses
 * to judge
 * Value: why_new=`BUILT_IN` contains no switch, so the agreement spec above
 * iterates the whole catalogue WITHOUT ever reaching this branch. A heel that
 * wrongly took a polarity passed every other spec in this file.
 * Value: seam=none. `renderGraph` already takes `ports` and `resolve` as
 * parameters, so a locally declared switch needs no production change;
 * `switches.test.ts` drives the engine the same way.
 * Value: no_claim=nothing about how the CANVAS draws a heel. That branch of
 * the className ternary stays uncovered and is filed as such: a switch has no
 * placement flow yet, so it is unreachable from the product.
 *
 * MUTATION PROOF, run: drop the `kind === 'heel' ? null :` gate in
 * `render.ts` so the heel takes `portPolarity(part, 0)`. ONE spec fails, this
 * one, with `expected [ 'socket', 'peg', 'peg' ] to deeply equal
 * [ null, 'peg', 'peg' ]`.
 */
const SWITCH_ID = 'TEST-SWITCH';
const switchBase = makeResolver(BUILT_IN);
const E_PART = switchBase('E');
const A1_PART = switchBase('A1');
/*
 * `SwitchPart`, not `Part` with a cast. A cast would let a missing or
 * misnamed field through silently, and this fixture exists precisely to prove
 * the three-port shape reaches the renderer.
 */
const TEST_SWITCH: SwitchPart = {
  id: SWITCH_ID,
  brand: 'BRIO',
  kind: 'switch',
  name: 'Test switch',
  throughLengthMm: 108,
  arcSteps: E_PART.kind === 'curve' ? E_PART.arcSteps : 2,
  innerRadiusMm: E_PART.kind === 'curve' ? E_PART.innerRadiusMm : 182,
  dimensions: A1_PART.dimensions,
  slop: A1_PART.slop,
  ends: A1_PART.ends,
  heightMm: 0,
  gaugeWidthMm: A1_PART.gaugeWidthMm,
  plankWidthMm: A1_PART.plankWidthMm,
  plankThicknessMm: A1_PART.plankThicknessMm,
};

describe('a switch heel is exempt from polarity in the picture too', () => {
  it('the heel is null and both roads carry a polarity', () => {
    const resolveSw = (id: string): Part =>
      id === SWITCH_ID ? TEST_SWITCH : switchBase(id);
    const portsSw = (piece: Piece): readonly Port[] =>
      portsOf(resolveSw(piece.partId), piece.turn);
    const graph: Graph = { pieces: [{ pieceId: 'one', partId: SWITCH_ID }], welds: [] };
    const r = renderGraph(graph, portsSw, resolveSw, placeAll(graph, portsSw));
    // Literals, not `portPolarity(...)`: the roads are the two `end` values
    // of the A1 this fixture borrows its ends from, and spelling them out
    // keeps the expectation independent of the function under test.
    expect(TEST_SWITCH.ends).toEqual({ start: 'socket', end: 'peg' });
    expect(r.ports.map((p) => p.polarity)).toEqual([null, 'peg', 'peg']);
  });
});
