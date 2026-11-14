import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { CLEARANCE } from '../../engine/data/rampSeeds.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { openings } from '../../engine/src/graph/openings.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { allTrainLayouts, trainLayouts, trainSentences } from '../test/trainSentences.js';

/*
 * THE TRAIN SENTENCES DID NOT CHANGE WHEN THE JUDGEMENT MOVED (plan
 * 2026-11-14, E5, step 4). `app/test/trainSentences.fixture.json` was written
 * on main at 008d0c3, BEFORE `engine/src/graph/openings.ts` existed, by the
 * same `trainSentences` this test calls: every sentence the verdict line
 * showed about the train for 688 layouts (the 670 of the verdict corpus and
 * 18 made to have bridges, tunnels and raised crossings), 70 of which say
 * something.
 *
 * Each pin names the change that fails it, and each was run.
 */

const fixture: Record<string, string[]> = JSON.parse(
  readFileSync(new URL('../test/trainSentences.fixture.json', import.meta.url), 'utf8'),
);
const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

describe('the train sentences', () => {
  /*
   * Fails when: the engine's subtraction changes (`- f.trainMm` dropped from
   * `trainMargin`: every "may not pass" becomes a pass), a tunnel's first
   * vault is taken for its lowest (the metro tunnel then says 71mm, not 69),
   * or a deck's stated opening is not read (the harbour arch bridge loses
   * its sentence). All three run.
   */
  it('are word for word what they were before the judgement moved into the engine', () => {
    const layouts = allTrainLayouts();
    expect(layouts.length).toBe(688);
    let saying = 0;
    for (const [name, graph] of layouts) {
      const now = trainSentences(graph);
      expect(now, name).toEqual(fixture[name] ?? []);
      if (now.length > 0) saying += 1;
    }
    // The fixture is not vacuous, and no layout in it has gone missing from the list.
    expect(saying).toBe(Object.keys(fixture).length);
    expect(saying).toBe(70);
  });

  it('cover all three kinds of opening, passing and not', () => {
    const all = Object.values(fixture).flat();
    expect(all.some((s) => /^X .*may not pass under raised track/.test(s))).toBe(true);
    expect(all.some((s) => /^Under the stone arch bridge .* to spare/.test(s))).toBe(true);
    expect(all.some((s) => /^X .*may not pass under the harbour arch bridge/.test(s))).toBe(true);
    expect(all.some((s) => /fits through the metro tunnel .*69mm opening/.test(s))).toBe(true);
  });
});

describe('openings, on real layouts', () => {
  const found = (graph: Graph) => {
    const placement = placeAll(graph, ports);
    const render = renderGraph(graph, ports, resolve, placement);
    const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
    const result = solveGraph(graph, ports, resolve, (id: string) => slop.get(id) ?? 0, placement, { parts: BUILT_IN, brandFit }, render.segments, render.bodies);
    return { graph, list: openings(result, graph.pieces, resolve, render.segments, CLEARANCE) };
  };
  const layout = (name: string) => found(trainLayouts().find(([n]) => n === name)![1]);
  const partOf = (graph: Graph, pieceId: string) => graph.pieces.find((p) => p.pieceId === pieceId)!.partId;

  /*
   * THE ROUTE'S VIEW AGREES WITH THE SENTENCE. Fails when: `openings` judges
   * an opening the verdict line does not (or the other way round): each
   * layout's list is compared with what its fixture sentences say.
   */
  it('finds the opening each sentence is about, with the same answer', () => {
    const arch = layout('bridge SA over a straight');
    expect(arch.list.map((o) => [o.kind, partOf(arch.graph, o.over), partOf(arch.graph, o.under), o.fits])).toEqual([
      ['bridge', 'SA', 'D', true],
    ]);
    expect(arch.list[0]!.at).not.toBe(null);

    const harbour = layout('bridge HB over a straight');
    expect(harbour.list.map((o) => [o.kind, o.fits, o.openingMm])).toEqual([['bridge', false, 60.8]]);

    const raised = layout('raised track over two straights');
    expect(raised.list.map((o) => [o.kind, partOf(raised.graph, o.over), partOf(raised.graph, o.under), o.fits])).toEqual([
      ['raised', 'D', 'D', false],
      ['raised', 'D', 'D', false],
    ]);
    // Overhead is the raised straight, not the loose one on the floor: they are different pieces.
    for (const o of raised.list) expect(o.over).not.toBe(o.under);

    const mixed = layout('two tunnels and a bridge');
    expect(mixed.list.map((o) => [o.kind, partOf(mixed.graph, o.over), o.fits])).toEqual([
      ['bridge', 'SA', true],
      ['tunnel', 'TT', true],
      ['tunnel', 'MT', true],
    ]);

    expect(layout('raised track alone').list).toEqual([]);
    expect(layout('bridge SA alone').list).toEqual([]);
  });
});
