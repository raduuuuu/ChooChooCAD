/**
 * Generic buffer stops R and S, as UNVERIFIED seeds.
 *
 * A buffer stop ends a track: one end, and a short body with a barrier
 * behind it (schema.ts `BufferPart`). Nothing about it reaches a verdict
 * except where its one end sits and whether it is a peg or a socket; the
 * body is drawn and checked for overlap.
 *
 * WHERE THE FIGURES COME FROM, and why they are unverified:
 *
 * - The 40mm body is the piece table's figure (`GENERIC_PIECE_TABLE`, from
 *   the published track guide). The printed reproductions run
 *   35 to 66mm along the track, bumpers and springs included (three
 *   printed sets), so they do not settle it.
 * - R has a peg and S a socket on the word of one printed listing
 *   , which labels its male stop R and its female stop S and calls
 *   the letters the trade's track-type names. One printed set has both
 *   versions, so both exist; which letter is which rests on that listing.
 *
 * A user who measures a real one submits it under the same id.
 */

import type { BufferPart, DimensionSource, SlopBudget } from '../src/parts/schema.js';

const ESTIMATED_SLOP: SlopBudget = {
  axialMm: 0.8,
  angularDeg: 1.5,
  calibrationStatus: 'estimated',
};

const SOURCE: DimensionSource = {
  status: 'unverified',
  source:
    'the published track guide (R, S: 40mm); R male and S female per one printed listing; ' +
    'three printed reproductions compared',
  note:
    'Body length from the piece table, not measured; reproductions run 35 to 66mm with ' +
    'their bumpers. The peg/socket assignment of R and S rests on one listing.',
};

const PROFILE = {
  heightMm: 0,
  gaugeWidthMm: 26,
  plankWidthMm: 40,
  plankThicknessMm: 12,
  grooveWidthMm: 6,
} as const;

export const BUFFER_SEEDS: readonly BufferPart[] = [
  {
    id: 'R', brand: 'GENERIC', kind: 'buffer', name: 'Buffer stop, peg', lengthMm: 40, end: 'peg',
    dimensions: SOURCE, slop: ESTIMATED_SLOP, ...PROFILE,
  },
  {
    id: 'S', brand: 'GENERIC', kind: 'buffer', name: 'Buffer stop, socket', lengthMm: 40, end: 'socket',
    dimensions: SOURCE, slop: ESTIMATED_SLOP, ...PROFILE,
  },
];
