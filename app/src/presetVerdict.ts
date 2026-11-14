/**
 * A READY LAYOUT, BUILT AND JUDGED THE WAY THE APP DOES IT (plan 2026-11-14, E2).
 *
 * One home for two questions that the preset pins (`presets.test.ts`) and the
 * search-engine pages (`layoutPages.ts`) both ask: what layout does this
 * preset build, and does the verdict say it closes exactly. Both go through
 * the code the user's click goes through: the reducer's `preset` step, then
 * `solveGraph` classified by `viewOf`. The old chain engine is not asked.
 *
 * No React here, so the tests need no DOM.
 */

import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { initialEditor, reduce, type EditorAction } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import type { Preset } from './presets.js';
import { viewOf, type VerdictView } from './verdictView.js';

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** The step a preset's button dispatches: its pieces and which way each bends. */
export const presetAction = (preset: Preset): EditorAction => ({
  kind: 'preset',
  ids: preset.pieces,
  turns: preset.turns,
});

/** The layout a preset builds, through the same reducer step the app's button takes. */
export function presetGraph(preset: Preset): Graph {
  return reduce(initialEditor(EMPTY_GRAPH, ports), presetAction(preset), ports).graph;
}

/** The verdict for a layout, classified exactly as the screen does. */
export function verdictKind(graph: Graph): VerdictView['kind'] {
  const placement = placeAll(graph, ports);
  const render = renderGraph(graph, ports, resolve, placement);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const result = solveGraph(
    graph,
    ports,
    resolve,
    (id: string) => slop.get(id) ?? 0,
    placement,
    { parts: BUILT_IN, brandFit },
    render.segments,
    render.bodies,
  );
  return viewOf(result).kind;
}

/** Only this earns the words "closes exactly". */
export const closesExactly = (graph: Graph): boolean => verdictKind(graph) === 'EXACT';
