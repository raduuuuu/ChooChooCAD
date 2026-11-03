/**
 * DECORATED PIECES (decorated-pieces plan 2026-11-03, CEO D2, eng D1/D2):
 * real pieces that work exactly like a standard part, with decoration on
 * them. Each names the built-in part whose track it has (`base`) and its
 * own decoration, measured from a printable model; the library builds the
 * full part from the two (library.ts `deriveDecorated`). Nothing here
 * restates the base's ends, length or joint give.
 *
 * The pieces themselves arrive one at a time (plan tasks T3-T5).
 */

import type { DecorShape, DecorSlab, DimensionSource } from '../src/parts/schema.js';

export interface DecoratedSpec {
  readonly id: string;
  readonly name: string;
  /** The built-in part whose track this piece has. */
  readonly base: string;
  readonly decor: readonly DecorShape[];
  /** Where the DECORATION's figures come from; the track's are the base's. */
  readonly dimensions: DimensionSource;
  /** A catalogue number, only for a verified match of a real piece (CEO D3). */
  readonly partNumber?: string;
}

/*
 * THE LEVEL CROSSING (plan T3), read off 3MF 681643: the printed crossing
 * (HP) with a barrier post at two opposite corners, 38 along and 36.5 across
 * from where the roads cross, each 10 square and 31 tall, and a 107 arm on
 * each. The arms are drawn raised (open) and are not solid: a lowered arm
 * is a toy's moving part, not wood a layout is planned around.
 */
const post = (x: number, y: number): DecorSlab => ({ kind: 'slab', atMm: [x, y], lengthMm: 10, widthMm: 10, bottomMm: 0, topMm: 31, noun: 'barrier post' });
const arm = (x: number, y: number): DecorSlab => ({ kind: 'slab', atMm: [x, y], lengthMm: 6, widthMm: 6, bottomMm: 31, topMm: 132, solid: false, noun: 'barrier' });

export const DECORATED_SEEDS: readonly DecoratedSpec[] = [
  {
    id: 'LC', name: 'Level crossing', base: 'HP',
    decor: [post(113, 36.5), post(37, -36.5), arm(113, 36.5), arm(37, -36.5)],
    dimensions: {
      status: 'unverified',
      source: 'a printed design, measured off the 3MF mesh on 2026-11-03',
      note: 'Barrier posts 10 square and 31 tall at two opposite corners, 38 along and 36.5 across from the crossing point; arms 107 long, drawn raised.',
    },
  },
];
