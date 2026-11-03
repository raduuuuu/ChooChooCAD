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

import type { DecorShape, DimensionSource } from '../src/parts/schema.js';

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

export const DECORATED_SEEDS: readonly DecoratedSpec[] = [];
