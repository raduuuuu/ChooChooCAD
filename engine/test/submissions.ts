/**
 * A built-in piece as a contributor's Claude would send it (contributor-brief
 * T3): a new id, `dimensions.status` 'unverified', its give 'estimated', and
 * nothing the library derives. Shared by the validator's and the brief
 * link's tests, as JSON (a fresh copy each call, safe to change).
 */

import { DECORATED_SEEDS } from '../data/decoratedSeeds.js';
import type { Part } from '../src/parts/schema.js';

export function asSubmission(part: Part, id: string): Record<string, unknown> {
  const { partNumber: _n, decorBody: _b, ...rest } = part;
  return JSON.parse(JSON.stringify({ ...rest, id, dimensions: { ...part.dimensions, status: 'unverified' }, slop: { ...part.slop, calibrationStatus: 'estimated' } }));
}

/** A decorated seed's spec (the level crossing by default) under a new id, unverified. */
export function specAs(id: string, seed = DECORATED_SEEDS[0]!): Record<string, unknown> {
  const { partNumber: _n, ...rest } = seed;
  return JSON.parse(JSON.stringify({ ...rest, id, dimensions: { ...seed.dimensions, status: 'unverified' } }));
}
