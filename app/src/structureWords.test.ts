/**
 * WHAT THE APP SAYS ABOUT A BUILDING (plan 2026-11-02; design decisions 4, 5).
 *
 * Value: protects=track that runs into a station's footprint, a tunnel's wall
 * or roof, or a pier gets a sentence naming the building and "Move either
 * piece", never the crossing or ramp advice; the layout list says what each
 * structure carries; a station joined onto floor track counts the run it
 * would lift
 * Value: fails_when=a building clash falls back to the crossing sentence, a
 * roof is worded like a footprint, the list loses the structure words, or
 * the lift count goes
 * Value: why_new=no structures existed in the app's words
 * Value: seam=`renderToStaticMarkup` for the verdict; the real catalogue,
 * renderer, solver and reducer
 * Value: no_claim=the placing strip's layout (structures.dom.test.tsx)
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { add, fromInt, scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece, type Port } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { reduce } from './editorReducer.js';
import { pieceName } from './GraphListing.js';
import { EMPTY_GRAPH, ghostFit } from './layoutModel.js';
import { ACTION_WHEN_BUILDING } from './verdictAction.js';
import { VerdictLine } from './VerdictLine.js';
import { buildingClashSentence, viewOf } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);

const at = (x: number, y: number, heading: number, level = 0): Frame => {
  const pos = add(fromInt(x), scale(zetaPow(4), y)) as Cyc;
  return level === 0 ? { pos, heading } : { pos, heading, level };
};

/** Lone pieces where they are told, numbered in this order. */
function scene(items: readonly (readonly [string, string, Frame])[]): Graph {
  return {
    pieces: items.map(([pieceId, partId]) => ({ pieceId, partId, turn: 'left' as const })),
    welds: [],
    anchors: new Map(items.map(([pieceId, , frame]) => [pieceId, frame])),
  };
}

function words(g: Graph): { sentences: string[]; text: string } {
  const placement = placeAll(g, ports);
  const r = renderGraph(g, ports, resolve, placement);
  const result = solveGraph(g, ports, resolve, () => 0, placement, undefined, r.segments, r.bodies);
  if (!result.ok && !('overlaps' in result)) throw new Error('expected overlaps');
  const number = new Map(g.pieces.map((p, i) => [p.pieceId, i + 1]));
  const partOf = new Map(g.pieces.map((p) => [p.pieceId, p.partId]));
  const sentences = result.overlaps.flatMap((o) => {
    const s = buildingClashSentence(o, (id) => number.get(id), (id) => resolve(partOf.get(id)!));
    return s ? [s] : [];
  });
  const html = renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(result), buildings: sentences }));
  return { sentences, text: html.replace(/<[^>]+>/g, '').replace(/&#x27;|&rsquo;|’/g, "'") };
}

describe('track that runs into a building (design decision 5)', () => {
  /*
   * MUTATION PROOFS, run:
   * - the verdict not drawing `buildings`: fails with `expected 'XCan\'t be
   *   built.Raised track: suppor…' to contain 'Piece 2 runs into the
   *   station\'s foot…'`.
   * - the action keyed on overlaps alone (ACTION_WHEN_CROSSING): fails with
   *   `expected 'XCan\'t be built. Piece 2 runs into t…' to contain 'Move the
   *   track or the building so the…'`.
   */
  it("floor track through a station's footprint names the footprint and never says ramps", () => {
    const { text } = words(scene([['st', 'ST', at(0, 0, 0)], ['floor', 'D', at(72, -100, 4)]]));
    expect(text).toContain("Piece 2 runs into the station's footprint (piece 1). Move either piece.");
    expect(text).toContain(ACTION_WHEN_BUILDING);
    expect(text).not.toMatch(/ramps|crossing piece/);
  });

  /*
   * MUTATION PROOF, run: roofs worded like a footprint (the roof test
   * replaced by `false`) fails with `expected [ Array(1) ] to deeply equal [
   * Array(1) ]`: the roof read "runs into the tunnel's footprint".
   */
  it('a tunnel roof, a tunnel wall and a pier each in their own words', () => {
    expect(words(scene([['tun', 'TU', at(0, 300, 0)], ['over', 'D', at(72, 200, 4, 1)]])).sentences).toEqual([
      'Raised track at piece 2 hits the tunnel roof (piece 1). Move either piece.',
    ]);
    expect(words(scene([['tun', 'TU', at(0, 300, 0)], ['beside', 'A', at(0, 340, 0)]])).sentences).toEqual([
      "Piece 2 runs into the tunnel's wall (piece 1). Move either piece.",
    ]);
    expect(words(scene([['pier', 'PR', at(300, 0, 0)], ['floor', 'D', at(300, -100, 4)]])).sentences).toEqual([
      'Piece 2 runs into the pier (piece 1). Move either piece.',
    ]);
  });
});

describe('the layout list (design decision 5)', () => {
  /*
   * MUTATION PROOF, run: the station's line dropped from pieceName fails
   * with `expected 'Piece 12: Elevated station (ST), road…' to be 'Piece 12:
   * Elevated station (ST), road…'`: the station fell through to the
   * tunnel's words.
   */
  it('says what each structure carries, in the floor and raised words', () => {
    const piece = (partId: string): Piece => ({ pieceId: 'p', partId, turn: 'left' });
    expect(pieceName(12, piece('ST'), resolve('ST'), undefined)).toBe('Piece 12: Elevated station (ST), road raised, footprint on the floor');
    expect(pieceName(7, piece('PR'), resolve('PR'), undefined)).toBe('Piece 7: Bridge pier (PR), no track connections');
    expect(pieceName(3, piece('TU'), resolve('TU'), undefined)).toBe('Piece 3: Tunnel (TU), road between walls, under a roof');
  });
});

describe('a station placed on floor track (design decision 4)', () => {
  /*
   * MUTATION PROOF, run: `lifted` left null fails with `expected undefined
   * to deeply equal [ 'p0', 'p1' ]`.
   */
  it('counts the run it would lift, and hands the preview that run raised', () => {
    let s = { graph: EMPTY_GRAPH, cursor: null, armed: null } as Parameters<typeof reduce>[0];
    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    s = reduce(s, { kind: 'add', partId: 'A', turn: 'left' }, ports);
    s = reduce(s, { kind: 'pick', partId: 'ST' }, ports);
    const fit = ghostFit(s.graph, ports, s.ghost!, undefined, undefined, { resolve });
    expect(fit.lifted?.ids).toEqual(['p0', 'p1']);
    const after = placeAll(fit.lifted!.graph, ports);
    expect(fit.lifted!.ids.map((id) => after.frames.get(id)!.level)).toEqual([1, 1]);
  });
});
