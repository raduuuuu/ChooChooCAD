/**
 * THE SWAP DIFFERENTIAL (decorated-pieces plan T6, CEO E8, eng O1).
 *
 * Value: protects=swapping a placed piece for a decorated or plain version of
 * it moves no end of any piece and leaves every loop closing as it did, over
 * the whole 670-layout verdict corpus
 * Value: fails_when=a decorated piece stops joining exactly like its base, or
 * a swap is offered between parts whose ends differ
 * Value: why_new=a swap that changes a piece's part id is new
 * Value: seam=none: the real catalogue, corpus, placement and residuals
 * Value: no_claim=whether the decoration clashes with nearby track (the
 * swap's refusal is tested in structuresApp.test.ts)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { placeAll, portFrame, residuals } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { corpus } from '../test/verdictCorpus.js';
import { swapsOf } from './layoutModel.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece) => portsOf(resolve(piece.partId), piece.turn);

/** Every end of every piece where it lands, and every loop's gap. */
function shape(g: Graph): string {
  const placement = placeAll(g, ports);
  const ends = g.pieces.map((p) => ports(p).map((_, i) => portFrame(placement, ports, p, i)));
  return JSON.stringify([ends, residuals(g, ports, placement)]);
}

describe('a swap keeps every end and every loop (670 layouts)', () => {
  /*
   * MUTATION PROOF, run: the station straight derived 1mm longer than its
   * base (library.ts `deriveDecorated`) with the joins check left out of
   * `swapsOf` fails with `expected [ 'chain 0 -> SS', …(9) ] to deeply equal
   * []`; with the check in, the station is no longer offered and the count
   * of swapped pieces falls: `expected 483 to be greater than 800`.
   */
  it('every plain piece swapped for each of its versions', () => {
    const moved: string[] = [];
    let swapped = 0;
    for (const [name, g] of corpus()) {
      const before = shape(g);
      const targets = new Set(g.pieces.flatMap((p) => swapsOf(resolve(p.partId), BUILT_IN, resolve).map((v) => v.id)));
      for (const to of targets) {
        const dressed: Graph = {
          ...g,
          pieces: g.pieces.map((p) => (swapsOf(resolve(p.partId), BUILT_IN, resolve).some((v) => v.id === to) ? { ...p, partId: to } : p)),
        };
        swapped += dressed.pieces.filter((p, i) => p.partId !== g.pieces[i]!.partId).length;
        if (shape(dressed) !== before) moved.push(`${name} -> ${to}`);
      }
    }
    expect(moved.slice(0, 10)).toEqual([]);
    expect(swapped).toBeGreaterThan(800);
  });
});
