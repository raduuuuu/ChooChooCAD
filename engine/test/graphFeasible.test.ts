/**
 * T9: feasibility lifted to vertices.
 *
 * The acceptance condition from the plan is a pair: a declared weld must
 * never be reported as an overlap, AND the two known false-pass fixtures
 * must still FAIL. Either alone is easy and useless. Excluding too much is
 * exactly what the chain engine's index rules did.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { findVertexClashes, findWeldPolarityViolations } from '../src/graph/feasible.js';
import { placeAll } from '../src/graph/frames.js';
import { graphFromChain } from '../src/graph/fromChain.js';
import { portsOf, type Graph, type Piece, type Port } from '../src/graph/model.js';
import type { Layout } from '../src/parts/schema.js';

const resolve = makeResolver(BUILT_IN);
const ports = (piece: Piece): readonly Port[] => portsOf(resolve(piece.partId), piece.turn);
const clashes = (g: Graph) => findVertexClashes(g, ports, placeAll(g, ports));

const chain = (ids: string[], closed: boolean, turn: 'left' | 'right' = 'left'): Layout => ({
  placements: ids.map((partId) => ({ partId, turn })),
  closed,
});

describe('a declared weld is never an overlap', () => {
  it('an open chain reports nothing', () => {
    expect(clashes(graphFromChain(chain(Array(6).fill('A'), false)))).toEqual([]);
  });

  it('the exact circle reports nothing, including at its seam', () => {
    // The chain engine needed two index exclusions to get this right: the
    // `(0, n)` seam and `(0, n-1)`. There is no exclusion here at all.
    expect(clashes(graphFromChain(chain(Array(8).fill('E'), true)))).toEqual([]);
  });

  it('the stadium reports nothing', () => {
    const g = graphFromChain(
      chain([...Array(4).fill('E'), 'D', ...Array(4).fill('E'), 'D'], true),
    );
    expect(clashes(g)).toEqual([]);
  });

  it('a switch feeding two branches reports nothing', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'a', partId: 'A' },
        { pieceId: 'b', partId: 'A2' },
      ],
      welds: [{ a: { pieceId: 'a', port: 1 }, b: { pieceId: 'b', port: 0 } }],
    };
    expect(clashes(g)).toEqual([]);
  });
});

describe('the known false passes still FAIL', () => {
  /*
   * 16 E curves closed is two laps of the same circle. Every connector
   * position is visited twice, so eight pairs of distinct vertices share a
   * position. The loop closes exactly, which is what made this a false pass:
   * geometry says yes and physics says the track is on top of itself.
   */
  it('16xE double circle: eight spots, one clash each', () => {
    const found = clashes(graphFromChain(chain(Array(16).fill('E'), true)));
    /*
     * EIGHT, not 32. Sixteen curves are two laps of an eight-position
     * circle, so eight places each hold two separate joins. Counting PORT
     * pairs instead gave 32, because each place has two vertices of two
     * ports, and the verdict then said "32 pairs" while the canvas drew
     * eight markers. The number a user reads has to be the number of
     * problems they have to fix.
     */
    expect(found).toHaveLength(8);
    const places = new Set(found.map((c) => `${c.at[0]},${c.at[1]}`));
    expect(places.size).toBe(found.length);
    for (const c of found) {
      expect(`${c.a.pieceId}#${c.a.port}`).not.toBe(`${c.b.pieceId}#${c.b.port}`);
    }
  });

  it('8L+8R figure eight: the tangency is caught', () => {
    const g = graphFromChain({
      placements: [
        ...Array(8).fill({ partId: 'E', turn: 'left' }),
        ...Array(8).fill({ partId: 'E', turn: 'right' }),
      ],
      closed: true,
    });
    expect(clashes(g).length).toBeGreaterThan(0);
  });

  /*
   * The exclusions are GONE, not widened. A chain-adjacent pair that is not
   * welded must be reported, which is precisely what `b - a === 1` used to
   * suppress. Two separate pieces placed at the same spot with no weld
   * between them is the minimal case.
   */
  it('two unwelded pieces in the same place are reported', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'x', partId: 'A' },
        { pieceId: 'y', partId: 'A' },
      ],
      welds: [],
    };
    // Both start at the identity frame, so all four ports coincide pairwise.
    expect(clashes(g).length).toBeGreaterThan(0);
  });
});

describe('polarity is a property of the weld', () => {
  it('an ordinary chain of alternating ends is fine', () => {
    const g = graphFromChain(chain(Array(4).fill('A'), false));
    expect(findWeldPolarityViolations(g, resolve, ports)).toEqual([]);
  });

  /*
   * B2 is "mini straight, two pegs" and C2 is "two sockets": real adapter
   * pieces that exist because two pegs cannot be joined. Welding B2 to B2
   * is the physical impossibility the check is for.
   */
  it('two pieces of the same polarity cannot be welded', () => {
    const g: Graph = {
      pieces: [
        { pieceId: 'p', partId: 'B2' },
        { pieceId: 'q', partId: 'B2' },
      ],
      welds: [{ a: { pieceId: 'p', port: 1 }, b: { pieceId: 'q', port: 1 } }],
    };
    const found = findWeldPolarityViolations(g, resolve, ports);
    expect(found).toHaveLength(1);
    expect(found[0]!.between).toEqual(['B2', 'B2']);
  });

  it('a heel is exempt, so a switch raises nothing', () => {
    // Covered in switches.test.ts at the predicate level; this is the
    // end-to-end path through the weld scan.
    const g: Graph = {
      pieces: [{ pieceId: 's', partId: 'A' }],
      welds: [],
    };
    expect(findWeldPolarityViolations(g, resolve, ports)).toEqual([]);
  });
});
