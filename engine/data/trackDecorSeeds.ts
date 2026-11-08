/**
 * THE CARGO CRANE (owner's photos 2026-11-08: one lying on its side on
 * millimetre paper beside a medium straight, one side-on and two end-on
 * standing): two short straights (108, the owner's) side by side, 50 apart,
 * crossing a grey base 390 long under a green gantry; a crane on the
 * gantry's beam over the cargo end.
 *
 *   side view, across the tracks (y)         x: along the tracks, 0 to 108
 *
 *        crane  ___jib___                     y (mm, + toward the cargo end)
 *          ||  /         \__ hook             223  the base's cargo end
 *    ______||_________________________        189  the first leg
 *   |  ______________________________ |       124  the cargo pegs' middle
 *   | |   cargo pegs    post  ==  == | |       36  the black-and-yellow post
 *   |_|_____________________|_A__B__|_|        0   track A;  -50 track B
 *   base                                     -132  the second leg; -167 the far end
 *
 * READ, NOT MEASURED, but for the tracks' length: the base's length and the
 * heights from the lying photo against the medium straight, the places along
 * from the side view, the legs' shape from the end views. Within about 10mm.
 */

import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { domeTop } from '../src/parts/dome.js';
import type { DecorDome, DecorShape, DecorSlab, MultiRoadPart, Paint, SlopBudget, StraightPart } from '../src/parts/schema.js';

const ESTIMATED_SLOP: SlopBudget = { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' };
const PROFILE = { heightMm: 0, gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6 } as const;
/** A point x along the tracks and y across them, in whole millimetres. */
const xy = (x: number, y: number): Cyc => add(fromInt(x), scale(zetaPow(4), y)) as Cyc;

const GREEN: Paint = { fill: '--paint-roof', line: '--ink' };
const GREY: Paint = { fill: '--paint-grey', line: '--ink' };
const RED: Paint = { fill: '--paint-red', line: '--ink' };
const YELLOW: Paint = { fill: '--paint-yellow', line: '--ink' };
const BEECH: Paint = { fill: '--track-fill', line: '--ink-soft' };
const STRIPE: Paint = { fill: '--ink', line: '--paper' };

/** The tracks: 108 long, the second 50 to the right of the first. */
const LEN = 108;
const PITCH = 50;
/** The base, as deep as the tracks are long (the end views' 128 counts the pegs), from the cargo end (223) to the far end (-167). */
const BASE = { from: 0, to: LEN, cargo: 223, far: -167, top: 10 } as const;
/** The gantry: legs 24 thick across the tracks, the beam from 112 to 146. */
const LEGS = [189, -132];
const BEAM = { bottom: 112, top: 146, from: 17, to: 92 } as const;

const slab = (x: number, y: number, l: number, w: number, bottomMm: number, topMm: number, noun: string, paint: Paint, solid = true): DecorSlab =>
  ({ kind: 'slab', atMm: [x, y], lengthMm: l, widthMm: w, bottomMm, topMm, noun, paint, ...(solid ? {} : { solid: false as const }) });

/**
 * A leg seen end-on: two posts and an arch over the trains' opening between
 * them, filled to the beam. Seen side-on the real legs splay out to the
 * floor; here they step out, 40 thick to 45 up and 24 above.
 */
const leg = (y: number): DecorShape[] => [
  slab(BASE.from + 8, y, 16, 40, 0, 45, 'gantry', GREEN),
  slab(BASE.to - 8, y, 16, 40, 0, 45, 'gantry', GREEN),
  slab(BASE.from + 8, y, 16, 24, 45, 70, 'gantry', GREEN),
  slab(BASE.to - 8, y, 16, 24, 45, 70, 'gantry', GREEN),
  { kind: 'arch', fromMm: BASE.from, toMm: BASE.to, baseMm: 70, riseMm: 30, depthMm: 0, widthMm: 24, acrossMm: y, fillToMm: BEAM.bottom, noun: 'gantry', paint: GREEN },
];

const CRANE_DECOR: readonly DecorShape[] = [
  // The base either side of the tracks; the tracks' own planks cover it between.
  slab(54, (BASE.cargo + 25) / 2, LEN, BASE.cargo - 25, 0, BASE.top, 'base', GREY),
  slab(54, (-PITCH - 25 + BASE.far) / 2, LEN, -PITCH - 25 - BASE.far, 0, BASE.top, 'base', GREY),
  // Cargo pegs: two rows of four on the cargo half.
  ...[78, 152].flatMap((y) => [30, 78].flatMap((x) => [-8, 8].map((d) => ({ kind: 'wheel' as const, axis: 'up' as const, atMm: [x, y + d] as const, centreMm: BASE.top + 4, diameterMm: 6, thickMm: 8, noun: 'base', paint: GREY })))),
  ...leg(LEGS[0]!),
  ...leg(LEGS[1]!),
  slab((BEAM.from + BEAM.to) / 2, (LEGS[0]! + 12 + LEGS[1]! - 12) / 2, BEAM.to - BEAM.from, LEGS[0]! - LEGS[1]! + 24, BEAM.bottom, BEAM.top, 'gantry', GREEN),
  // The black-and-yellow post between the cargo and the first track, floor to beam, in bands 12 tall.
  ...Array.from({ length: Math.ceil((BEAM.bottom - BASE.top) / 12) }, (_, k) =>
    slab(54, 36, 14, 14, BASE.top + 12 * k, Math.min(BEAM.bottom, BASE.top + 12 * (k + 1)), 'post', k % 2 === 0 ? YELLOW : STRIPE)),
  // The crane on the beam over the cargo end: its beech post with a red band, the yellow head, the jib out over the tracks, the hook and its spreader.
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: (BEAM.top + 206) / 2, diameterMm: 46, thickMm: 206 - BEAM.top, noun: 'crane', paint: BEECH },
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: 161, diameterMm: 47, thickMm: 22, noun: 'crane', paint: RED },
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: 218, diameterMm: 40, thickMm: 24, noun: 'crane', paint: YELLOW },
  { kind: 'wheel', atMm: [54, 160], centreMm: 218, diameterMm: 16, thickMm: 6, noun: 'crane', paint: RED },
  slab(54, 65, 10, 140, 212, 226, 'jib', RED, false),
  // The hook's spreader, just over the beam under the jib's tip, its two arms out either side.
  slab(54, -2, 30, 12, BEAM.top + 4, BEAM.top + 14, 'hook', RED, false),
  ...[-1, 1].map((d) => slab(54 + d * 22, -2, 10, 12, BEAM.top + 4, BEAM.top + 38, 'hook', RED, false)),
];

export const CARGO_CRANE: MultiRoadPart = {
  id: 'CC', brand: 'GENERIC', kind: 'multi-road', name: 'Cargo crane',
  ports: [
    { at: { pos: xy(0, 0), heading: 8 }, polarity: 'socket', name: "first track's near end" },
    { at: { pos: xy(LEN, 0), heading: 0 }, polarity: 'peg', name: "first track's far end" },
    { at: { pos: xy(0, -PITCH), heading: 8 }, polarity: 'socket', name: "second track's near end" },
    { at: { pos: xy(LEN, -PITCH), heading: 0 }, polarity: 'peg', name: "second track's far end" },
  ],
  roads: [
    { from: 0, to: 1, shape: { kind: 'straight', lengthMm: LEN } },
    { from: 2, to: 3, shape: { kind: 'straight', lengthMm: LEN } },
  ],
  sizeLabel: '2 × 108',
  decor: CRANE_DECOR,
  dimensions: {
    status: 'unverified',
    source: "the owner's photos of a real one, 2026-11-08: the tracks' length the owner's (a short straight's), the rest read off the photos",
    note: 'Two 108 tracks 50 apart crossing a base 390 long under a gantry 146 tall, its beam from 112; a crane on the beam to 230, its jib over the tracks. Within about 10mm.',
  },
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/*
 * THE ACTION TUNNEL STATION (owner's photos 2026-11-08: from above on
 * millimetre paper, lying on its side, and standing, side-on and end-on): a
 * grey straight twice a medium straight's length (288, the owner's) through
 * a station: four beech posts and an orange roof arching along the track
 * between them, on a grey base with a round plate in its middle.
 *
 *   side view                      roof: a dome 174 along, 120 across at
 *         ___ crown 162 _____            its ends and 200 in its middle,
 *        /      vents        \\          its rim 100 up
 *       || post            post ||       posts 20 square at 85 and 203 along,
 *   ====||======== track ========||====  42 either side, up to the roof
 *      (______ round plate 170 ______)   base 288, plate 170 across, 8 tall
 *
 * READ, NOT MEASURED, but for the track's length: scaled by it (side view)
 * and by the track's 26 gauge (end view), so within about 10mm. The roof's
 * vents, its flared ends and the sign under it are not drawn.
 */
const ORANGE: Paint = { fill: '--paint-orange', line: '--ink' };
const AT_LEN = 288;
const AT_POSTS = { along: [85, 203], across: 42, size: 20 } as const;
/*
 * The roof: a dome arched along the track and across it (side and end
 * views), 174 along, 120 across at its ends and 200 in its middle (the top
 * view), its rim 100 up, its crown 162. Each post stands up to meet it.
 */
const AT_ROOF: DecorDome = {
  kind: 'dome', atMm: [AT_LEN / 2, 0], lengthMm: 174, widthMm: 120, bulgeMm: 40,
  baseMm: 100, alongRiseMm: 38, acrossRiseMm: 24, thickMm: 4, noun: 'roof', paint: ORANGE,
};
/** A post's top: 2 under the roof's underside, as the roof is drawn in flat facets that sag a little between its points. */
const postTop = (x: number, y: number) => Math.floor(domeTop(AT_ROOF, x - AT_LEN / 2, y) - AT_ROOF.thickMm - 2);
export const ACTION_TUNNEL_STATION: StraightPart = {
  id: 'AT', brand: 'GENERIC', kind: 'straight', name: 'Action Tunnel Station',
  lengthMm: AT_LEN, ends: { start: 'socket', end: 'peg' },
  decor: [
    { kind: 'wheel', axis: 'up', atMm: [AT_LEN / 2, 0], centreMm: 4, diameterMm: 170, thickMm: 8, noun: 'base', paint: GREY },
    ...[-1, 1].flatMap((side) => [AT_LEN / 2 - 103, AT_LEN / 2 + 103].map((x) => slab(x, side * 35, 44, 30, 0, 8, 'base', GREY))),
    ...AT_POSTS.along.flatMap((x) => [-1, 1].map((side) => slab(x, side * AT_POSTS.across, AT_POSTS.size, AT_POSTS.size, 8, postTop(x, side * AT_POSTS.across), 'post', BEECH))),
    AT_ROOF,
  ],
  dimensions: {
    status: 'unverified',
    source: "the owner's photos of a real one, 2026-11-08: the track's length the owner's (two medium straights'), the rest read off the photos",
    note: 'A 288 straight through four posts 20 square, 42 either side, at 85 and 203 along; an orange domed roof on them, 174 along, 120 across at its ends and 200 in its middle, its rim 100 up and its crown 162; a round plate 170 across in the middle. Within about 10mm.',
  },
  slop: ESTIMATED_SLOP, ...PROFILE,
};

export const CRANE_SEEDS: readonly MultiRoadPart[] = [CARGO_CRANE];
/** Straights with their own decoration that work like no standard part. */
export const TRACK_DECOR_SEEDS: readonly StraightPart[] = [ACTION_TUNNEL_STATION];
