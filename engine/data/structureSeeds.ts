/**
 * STRUCTURES: an elevated station, a bridge pier and a tunnel, as UNVERIFIED
 * seeds (plan docs/plan/2026-11-02-photo-parts-and-stations.md; CEO S1, X1,
 * X3; eng D1, E4).
 *
 * Each is wood that is partly not track, held as body boxes (schema.ts
 * `BodyBox`), each at its own levels above the piece's frame:
 *
 *   piece           floor (level 0 above its frame)          raised (level 1)
 *   station  ST     footprint: no floor track through it     deck road (a medium straight), and the
 *                                                            roof: no other raised track through it
 *   pier     PR     footprint: no floor track through it     nothing: raised track passes over
 *   tunnel   TU     own road through; walls either side      roof: no raised track over it
 *
 * EVERY FIGURE HERE IS AN ESTIMATE until the owner photographs a real piece
 * (photo guide, docs/photo-guide.html): the deck is the 144mm medium straight
 * and the rest are round numbers that look right beside it. Verdicts that use
 * one say so, like any unverified piece.
 */

import type { BlockPart, DimensionSource, SlopBudget, StraightPart } from '../src/parts/schema.js';

const ESTIMATED_SLOP: SlopBudget = { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' };

const PROFILE = { gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6, heightMm: 0 } as const;

const ESTIMATE = (what: string): DimensionSource => ({
  status: 'unverified',
  source: 'round-number estimates beside the medium straight',
  note: `${what} Not measured: photograph a real one (docs/photo-guide.html) to replace these.`,
});

/** The deck's length: a medium straight. */
const DECK = 144;

export const STATION: StraightPart = {
  id: 'ST', brand: 'GENERIC', kind: 'straight', name: 'Elevated station',
  lengthMm: DECK, ends: { start: 'socket', end: 'peg' }, deck: 1,
  body: [
    { role: 'footprint', atMm: [DECK / 2, 0], lengthMm: DECK, widthMm: 60, levels: [0, 0] },
    { role: 'roof', atMm: [DECK / 2, 0], lengthMm: DECK, widthMm: 80, levels: [1, 1] },
  ],
  dimensions: ESTIMATE('A 144 deck one level up on a 144 by 60 footprint, under a 144 by 80 roof.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

export const PIER: BlockPart = {
  id: 'PR', brand: 'GENERIC', kind: 'block', name: 'Bridge pier',
  body: [{ role: 'footprint', atMm: [0, 0], lengthMm: 40, widthMm: 40, levels: [0, 0] }],
  sizeLabel: '40×40',
  dimensions: ESTIMATE('A 40 by 40 footprint on the floor.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/** A wall's thickness, and where it stands: just outside the road's 40mm plank. */
const WALL = 10;
const WALL_AT = PROFILE.plankWidthMm / 2 + WALL / 2;

export const TUNNEL: StraightPart = {
  id: 'TU', brand: 'GENERIC', kind: 'straight', name: 'Tunnel',
  lengthMm: DECK, ends: { start: 'socket', end: 'peg' },
  body: [
    { role: 'wall', atMm: [DECK / 2, WALL_AT], lengthMm: DECK, widthMm: WALL, levels: [0, 0] },
    { role: 'wall', atMm: [DECK / 2, -WALL_AT], lengthMm: DECK, widthMm: WALL, levels: [0, 0] },
    { role: 'roof', atMm: [DECK / 2, 0], lengthMm: DECK, widthMm: PROFILE.plankWidthMm + 2 * WALL, levels: [1, 1] },
  ],
  dimensions: ESTIMATE('A 144 floor road between 10mm walls, under a roof as wide as both.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/** Not yet in the library: the app draws bodies in the next step (plan, wave 2, app PR). */
export const STRUCTURE_SEEDS = [STATION, PIER, TUNNEL] as const;
