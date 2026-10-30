/**
 * What a switch IS to the rest of the engine, captured in one value: its
 * ports (exact poses and polarity, both turns) and the segments the renderer
 * draws for it, placed at a frame that is neither the origin nor heading 0.
 *
 * Used twice: once at commit 86e3eaa, before `SwitchPart` was replaced by
 * the multi-road kind, to write `fixtures/switches-86e3eaa.json`; and on
 * every run since, by `switchRegression.test.ts`, which requires today's
 * value to equal that file. Only public engine calls appear here, so the
 * capture means the same thing on both sides of the change.
 */

import { BUILT_IN, makeResolver } from '../data/library.js';
import { add, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { placeAll } from '../src/graph/frames.js';
import { portPolarity, portsOf, type Frame, type Graph, type Piece } from '../src/graph/model.js';
import { renderGraph } from '../src/graph/render.js';

export const FROZEN_SWITCHES = ['L', 'M', 'O1', 'P1'] as const;

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);

/** An awkward frame: off the origin, and turned 3 sixteenths. */
const AT: Frame = { pos: add(scale(zetaPow(0), 30), scale(zetaPow(3), 20)) as Cyc, heading: 3 };

export function switchSnapshot() {
  const out: Record<string, unknown> = {};
  for (const id of FROZEN_SWITCHES) {
    for (const turn of ['left', 'right'] as const) {
      const piece: Piece = { pieceId: 's', partId: id, turn };
      const graph: Graph = { pieces: [piece], welds: [], anchors: new Map([['s', AT]]) };
      const part = resolve(id);
      out[`${id} ${turn}`] = {
        ports: portsOf(part, turn).map((p, i) => ({
          kind: p.kind,
          pos: [...p.at.pos],
          heading: p.at.heading,
          level: p.at.level ?? null,
          polarity: p.polarity,
          portPolarity: portPolarity(part, i),
        })),
        segments: renderGraph(graph, ports, resolve, placeAll(graph, ports)).segments,
      };
    }
  }
  return out;
}
