/**
 * STRUCTURES: an elevated station, a riser and a tunnel with overpass, all
 * UNVERIFIED (plan docs/plan/2026-11-02-photo-parts-and-stations.md; CEO S1,
 * X1, X3; eng D1, E4). The riser and the tunnel are measured printable
 * designs (2026-11-03, below); the station, the retired pier and the retired
 * tunnel are round-number estimates.
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

/*
 * PIER and TUNNEL above are RETIRED from the library (owner, 2026-11-03): two
 * measured printable designs replace them. They stay as test fixtures, the
 * only block and the only roof over a floor road the engine's rules are
 * checked against.
 */

/**
 * MEASURED FROM PRINTABLE DESIGNS (2026-11-03), read off each model's 3MF
 * mesh; where each came from is in engine/data/origins.ts.
 *
 * Both are raised straights on supports, the deck one level up like the
 * station's, so floor track passes underneath:
 *
 *   riser   RS   a 58mm deck on four 8x8 corner legs; arches 42mm wide and
 *                about 60mm high open both ways
 *   tunnel  TO   a 72mm deck on two walls at right angles to it; the passage
 *                between them is 43mm wide and about 61mm high
 *
 * HEIGHT: the owner's ramp tops out at 73mm (measurements.ts Q5), the
 * raised level. The tunnel's road top is at about 72.3mm and the riser's
 * "standard height" print at 72.8, both within 1mm of it; the riser's default
 * print (76.1) stands 3mm high, so print the standard height.
 */
const printed = (what: string): DimensionSource => ({
  status: 'unverified',
  source: 'a printed reproduction, measured off the 3MF mesh on 2026-11-03',
  note: `${what} Unverified until a real one is measured.`,
});

/** A riser leg: 8mm square, at a corner of the 58mm deck, 25mm either side of the road. */
const LEG = 8;
const RISER_LEN = 58;
const leg = (x: number, y: number) => ({ role: 'footprint' as const, atMm: [x, y] as const, lengthMm: LEG, widthMm: LEG, levels: [0, 0] as const });

export const RISER: StraightPart = {
  id: 'RS', brand: 'GENERIC', kind: 'straight', name: 'Riser',
  lengthMm: RISER_LEN, ends: { start: 'socket', end: 'peg' }, deck: 1,
  body: [
    leg(LEG / 2, 25), leg(LEG / 2, -25),
    leg(RISER_LEN - LEG / 2, 25), leg(RISER_LEN - LEG / 2, -25),
  ],
  dimensions: printed('A 58 deck on four 8 by 8 legs at its corners, 50 apart across; floor track passes under either way.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/** The tunnel's walls, along the road from its socket end: -10 to 14, and 57 to 82; 108 long across it. */
const TO_LEN = 72;
const towall = (from: number, to: number) => ({
  role: 'wall' as const, atMm: [(from + to) / 2, 0] as const, lengthMm: to - from, widthMm: 108, levels: [0, 0] as const,
});

export const TUNNEL_OVERPASS: StraightPart = {
  id: 'TO', brand: 'GENERIC', kind: 'straight', name: 'Tunnel with overpass',
  lengthMm: TO_LEN, ends: { start: 'socket', end: 'peg' }, deck: 1,
  body: [towall(-10, 14), towall(57, 82)],
  dimensions: printed('A 72 deck on two walls at right angles to it; the 43 passage between them takes floor track.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

export const STRUCTURE_SEEDS = [STATION, RISER, TUNNEL_OVERPASS] as const;

/** How the app names each structure in a sentence, and what its list line says it carries (design decision 5). */
export const STRUCTURE_WORDS: Readonly<Record<string, { readonly word: string; readonly carries: string }>> = {
  ST: { word: 'station', carries: 'road raised, footprint on the floor' },
  RS: { word: 'riser', carries: 'road raised on legs, floor track passes under' },
  TO: { word: 'tunnel', carries: 'road raised over a passage, floor track passes through' },
  PR: { word: 'pier', carries: 'no track connections' },
  TU: { word: 'tunnel', carries: 'road between walls, under a roof' },
};
