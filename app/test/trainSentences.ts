/**
 * WHAT THE VERDICT SAYS ABOUT THE TRAIN, for a layout (plan 2026-11-14, E5).
 *
 * The sentences about whether the train passes under raised track, under a
 * bridge and through a tunnel, read off the verdict line composed the way
 * App.tsx composes it. `trainFit.test.ts` holds these to a fixture written
 * BEFORE the judgement moved into the engine (`engine/src/graph/openings.ts`),
 * so the move is proved to change no sentence.
 *
 * Uses only functions that existed before and after the move, so the same
 * file ran on both sides of it.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { add, fromInt, scale, zetaPow } from '../../engine/src/geom/cyclotomic.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Frame, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { addPiece, EMPTY_GRAPH } from '../src/layoutModel.js';
import { VerdictLine } from '../src/VerdictLine.js';
import { bridgeNotesOf, supportNoteOf, tunnelNotesOf, viewOf } from '../src/verdictView.js';
import { corpus } from './verdictCorpus.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** Every "verdict-raised" sentence the verdict line shows for this layout, as plain text, in order. */
export function trainSentences(graph: Graph): string[] {
  const placement = placeAll(graph, ports);
  const render = renderGraph(graph, ports, resolve, placement);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const result = solveGraph(graph, ports, resolve, (id: string) => slop.get(id) ?? 0, placement, { parts: BUILT_IN, brandFit }, render.segments, render.bodies);
  const partOf = new Map(graph.pieces.map((p) => [p.pieceId, p.partId]));
  const number = new Map(graph.pieces.map((p, i) => [p.pieceId, i + 1]));
  const numberOf = (id: string) => number.get(id)!;
  const bridgeNotes = [
    ...bridgeNotesOf(result.underBridges, (id) => partOf.get(id)!, resolve, numberOf),
    ...tunnelNotesOf(graph.pieces, resolve, numberOf),
  ];
  const html = renderToStaticMarkup(
    createElement(VerdictLine, { view: viewOf(result), bridgeNotes, supportNote: supportNoteOf(result.supports, numberOf) }),
  );
  return [...html.matchAll(/<p class="verdict-raised[^"]*">(.*?)<\/p>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/<!-- -->/g, ''),
  );
}

/** A loose piece at an exact place: `x` along the axis, `y` across it, pointing `heading` sixteenths round. */
export function loose(graph: Graph, partId: string, x: number, y: number, heading: number): Graph {
  const anchor: Frame = { pos: add(fromInt(x), scale(zetaPow(4), y)), heading };
  return addPiece(graph, partId, 'left', 2, null, ports, undefined, anchor).graph;
}

/** A run of pieces from the origin along the axis, each joined to the last. */
export function run(ids: readonly string[]): Graph {
  let graph: Graph = EMPTY_GRAPH;
  let at: { pieceId: string; port: number } | null = null;
  for (const id of ids) {
    // The piece's own count of ends: a buffer has one, and `addPiece` must be told.
    const step = addPiece(graph, id, 'left', ports({ pieceId: '', partId: id, turn: 'left' }).length, at, ports);
    graph = step.graph;
    at = step.select;
  }
  return graph;
}

/**
 * Layouts made to have something to say: each bridge with a long straight
 * crossing under its middle, each tunnel on its own, plain raised track over
 * a crossing straight, and each with nothing under it.
 */
export function trainLayouts(): Array<[string, Graph]> {
  const out: Array<[string, Graph]> = [];
  const lengthOf = (id: string) => (resolve(id) as { lengthMm: number }).lengthMm;
  for (const id of ['SA', 'SB', 'HB', 'BW']) {
    out.push([`bridge ${id} alone`, run([id])]);
    out.push([`bridge ${id} over a straight`, loose(run([id]), 'D', Math.round(lengthOf(id) / 2), -108, 4)]);
  }
  for (const id of ['TT', 'MT', 'MS']) {
    out.push([`tunnel ${id} alone`, run([id])]);
    out.push([`tunnel ${id} in a run`, run(['A', id, 'A'])]);
  }
  out.push(['two tunnels and a bridge', loose(run(['TT', 'MT', 'SA']), 'D', 216 + 216 + 238, -108, 4)]);
  out.push(['raised track alone', run(['N', 'D'])]);
  out.push(['raised track over a straight', loose(run(['N', 'D']), 'D', 324, -108, 4)]);
  out.push(['raised track over two straights', loose(loose(run(['N', 'D', 'D']), 'D', 324, -108, 4), 'D', 540, -108, 4)]);
  return out;
}

/** Every layout the fixture covers: the verdict corpus, then the layouts above. */
export function allTrainLayouts(): Array<[string, Graph]> {
  return [...corpus(), ...trainLayouts()];
}
