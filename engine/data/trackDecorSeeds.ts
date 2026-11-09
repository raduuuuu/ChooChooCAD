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
 *    ______||_________________________        176  the first leg's foot
 *   |  ______________________________ |       124  the cargo pegs' middle
 *   | |   cargo pegs    post  ==  == | |       36  the black-and-yellow post
 *   |_|_____________________|_A__B__|_|        0   track A;  -50 track B
 *   base                                     -124  the second leg's foot; -167 the far end
 *
 * READ, NOT MEASURED, but for the tracks' length: the base's length and the
 * heights from the lying photo against the medium straight, the places along
 * from the side view, the legs' shape from the end views. Within about 10mm.
 */

import { add, fromInt, scale, zetaPow, type Cyc } from '../src/geom/cyclotomic.js';
import { domeBarrel, domeTop } from '../src/parts/dome.js';
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
/*
 * Each leg leans in to the beam (the side view, owner 2026-11-08): from the
 * cargo end, the first from 15 to 78 at the floor and 41 to 100 under the
 * beam, the second from 316 to 379 at the floor and 289 to 345 under it.
 * Drawn as sloping posts at both ends of the base.
 */
const LEG_FEET = [[15, 78, 41, 100], [316, 379, 289, 345]] as const;
const BEAM = { bottom: 112, top: 146, from: 17, to: 92 } as const;

const slab = (x: number, y: number, l: number, w: number, bottomMm: number, topMm: number, noun: string, paint: Paint, solid = true): DecorSlab =>
  ({ kind: 'slab', atMm: [x, y], lengthMm: l, widthMm: w, bottomMm, topMm, noun, paint, ...(solid ? {} : { solid: false as const }) });

/**
 * A leg seen end-on: two posts and an arch over the trains' opening between
 * them, filled to the beam. Seen side-on the real legs splay out to the
 * floor; here they step out, 40 thick to 45 up and 24 above.
 */
const leg = ([outFoot, inFoot, outTop, inTop]: readonly [number, number, number, number]): DecorShape[] => {
  // From the cargo end to across the piece; the leg's outline seen side-on, sloping from its foot to its top.
  const y = (d: number) => BASE.cargo - d;
  const section = [[y(outFoot), 0], [y(inFoot), 0], [y(inTop), BEAM.bottom], [y(outTop), BEAM.bottom]] as const;
  const archAt = (outTop + inTop + outFoot + inFoot) / 4 + ((outTop + inTop - outFoot - inFoot) / 4) * 0.7;
  return [
    // Its two posts, at either end of the base, each 18 along.
    { kind: 'prism', fromMm: BASE.from, toMm: BASE.from + 18, sectionMm: section, noun: 'gantry', paint: GREEN },
    { kind: 'prism', fromMm: BASE.to - 18, toMm: BASE.to, sectionMm: section, noun: 'gantry', paint: GREEN },
    // Over the opening between them, seen end-on: an arch near its top, as wide as the leg there.
    { kind: 'arch', fromMm: BASE.from, toMm: BASE.to, baseMm: 80, riseMm: 18, depthMm: 0, widthMm: Math.abs(inTop - outTop), acrossMm: y(archAt), fillToMm: BEAM.bottom, noun: 'gantry', paint: GREEN },
  ];
};

/*
 * The jib, side-on (the side view): a lattice from the head out to over the
 * first track's edge, a top and a bottom chord with six diagonals between.
 */
const JIB = { from: 135, to: 12, x: 54, width: 8, top: [226, 223], bottom: [208, 212], bar: 3 } as const;
const jibAt = (y: number, chord: readonly [number, number]) => chord[0] + ((chord[1] - chord[0]) * (JIB.from - y)) / (JIB.from - JIB.to);
const jib = (): DecorShape[] => {
  const member = (pts: readonly (readonly [number, number])[]): DecorShape =>
    ({ kind: 'prism', fromMm: JIB.x - JIB.width / 2, toMm: JIB.x + JIB.width / 2, sectionMm: pts, solid: false, noun: 'jib', paint: RED });
  const chord = (c: readonly [number, number], down: number) =>
    member([[JIB.from, jibAt(JIB.from, c)], [JIB.to, jibAt(JIB.to, c)], [JIB.to, jibAt(JIB.to, c) - down], [JIB.from, jibAt(JIB.from, c) - down]]);
  const n = 6;
  const diagonals = Array.from({ length: n }, (_, k) => {
    const y0 = JIB.from - ((JIB.from - JIB.to) * k) / n, y1 = JIB.from - ((JIB.from - JIB.to) * (k + 1)) / n;
    // Alternately down and up between the chords, each a bar 3 wide along the jib.
    const [a, b] = k % 2 === 0 ? [[y0, jibAt(y0, JIB.top)], [y1, jibAt(y1, JIB.bottom)]] : [[y0, jibAt(y0, JIB.bottom)], [y1, jibAt(y1, JIB.top)]];
    return member([[a[0]!, a[1]!], [a[0]! - JIB.bar, a[1]!], [b[0]! - JIB.bar, b[1]!], [b[0]!, b[1]!]]);
  });
  return [chord(JIB.top, JIB.bar), chord(JIB.bottom, -JIB.bar), ...diagonals];
};

const CRANE_DECOR: readonly DecorShape[] = [
  // The base either side of the tracks; the tracks' own planks cover it between.
  slab(54, (BASE.cargo + 25) / 2, LEN, BASE.cargo - 25, 0, BASE.top, 'base', GREY),
  slab(54, (-PITCH - 25 + BASE.far) / 2, LEN, -PITCH - 25 - BASE.far, 0, BASE.top, 'base', GREY),
  // Cargo pegs: two rows of four on the cargo half.
  // Square stubs, not discs: sixteen 32-sided discs cost nearly the piece's whole triangle budget (eng D8).
  ...[78, 152].flatMap((y) => [30, 78].flatMap((x) => [-8, 8].map((d) => slab(x, y + d, 6, 6, BASE.top, BASE.top + 8, 'base', GREY)))),
  ...leg(LEG_FEET[0]),
  ...leg(LEG_FEET[1]),
  // The beam, from the first leg's top to the second's.
  slab((BEAM.from + BEAM.to) / 2, BASE.cargo - (LEG_FEET[0][2] + LEG_FEET[1][3]) / 2, BEAM.to - BEAM.from, LEG_FEET[1][3] - LEG_FEET[0][2], BEAM.bottom, BEAM.top, 'gantry', GREEN),
  // The black-and-yellow post between the cargo and the first track, floor to beam, in bands 12 tall.
  ...Array.from({ length: Math.ceil((BEAM.bottom - BASE.top) / 12) }, (_, k) =>
    slab(54, 36, 14, 14, BASE.top + 12 * k, Math.min(BEAM.bottom, BASE.top + 12 * (k + 1)), 'post', k % 2 === 0 ? YELLOW : STRIPE)),
  // The crane on the beam over the cargo end: its beech post with a red band, the yellow head, the jib out over the tracks, the hook and its spreader.
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: (BEAM.top + 206) / 2, diameterMm: 46, thickMm: 206 - BEAM.top, noun: 'crane', paint: BEECH },
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: 170, diameterMm: 47, thickMm: 27, noun: 'crane', paint: RED },
  { kind: 'wheel', axis: 'up', atMm: [54, 135], centreMm: 218, diameterMm: 40, thickMm: 24, noun: 'crane', paint: YELLOW },
  { kind: 'wheel', atMm: [54, 160], centreMm: 218, diameterMm: 16, thickMm: 6, noun: 'crane', paint: RED },
  ...jib(),
  // The hook's bar, from the jib's tip down to the spreader.
  slab(54, 20, 4, 4, BEAM.top + 14, 212, 'hook', RED, false),
  // The hook's spreader, just over the beam under the jib's tip, its two arms out either side.
  slab(54, 20, 30, 12, BEAM.top + 4, BEAM.top + 14, 'hook', RED, false),
  ...[-1, 1].map((d) => slab(54 + d * 22, 20, 10, 12, BEAM.top + 4, BEAM.top + 38, 'hook', RED, false)),
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
 * and by the track's 26 gauge (end view), so within about 10mm. Its track
 * is drawn in beech, as all track is; the real one is grey plastic.
 */
const ORANGE: Paint = { fill: '--paint-orange', line: '--ink' };
const AT_LEN = 288;
const AT_POSTS = { along: [85, 203], across: 42, size: 20 } as const;
/*
 * The roof: a groin vault (dome.ts), 140 along, 104 across at its ends and
 * 160 in its middle (the top view), thin plastic 4 thick. Its round arch
 * springs at the posts, 118 apart, from 90 to its crown at 162 (the side
 * view); the hoods over the posts are arched to 134 in their middle (the end
 * view, the arch's ends the wings behind them); the two meet in the orange X
 * of the top view.
 * Each post stands up to meet it.
 */
const AT_ROOF: DecorDome = {
  kind: 'dome', atMm: [AT_LEN / 2, 0], lengthMm: 140, widthMm: 104, bulgeMm: 28, archMm: AT_POSTS.along[1] - AT_POSTS.along[0],
  baseMm: 90, alongRiseMm: 72, acrossRiseMm: 44, thickMm: 4, noun: 'roof', paint: ORANGE,
};
/*
 * The roof's vent windows (the top view): 11 square on an 18 grid round its
 * middle, five rows along and seven across, but where the roof's orange X
 * creases, where there are none: each window lies on one barrel.
 */
const AT_WINDOWS: DecorDome = {
  ...AT_ROOF,
  noun: 'roof',
  paint: { fill: '--ink', line: '--paper' },
  patches: [-2, -1, 0, 1, 2].flatMap((row) =>
    [-3, -2, -1, 0, 1, 2, 3]
      .map((col) => [row * 18, col * 18, 11, 11] as const)
      .filter(([a, c, l, w]) => new Set([-1, 1].flatMap((i) => [-1, 1].map((j) => domeBarrel(AT_ROOF, a + (i * l) / 2, c + (j * w) / 2)))).size === 1),
  ),
};
/** A post's top: 2 under the roof's underside, as the roof is drawn in flat facets that sag a little between its points. */
const postTop = (x: number, y: number) => Math.floor(domeTop(AT_ROOF, x - AT_LEN / 2, y) - AT_ROOF.thickMm - 2);
/** The sign hangs 15 in from the front posts, where the roof has risen clear of its hood (the end view). */
const SIGN_AT = AT_POSTS.along[0] + 15;
const SIGN_WIDTH = 2 * AT_POSTS.across - AT_POSTS.size;
/** Under the roof at both its ends, where the vault is lowest. */
const signTop = postTop(SIGN_AT, SIGN_WIDTH / 2);
export const ACTION_TUNNEL_STATION: StraightPart = {
  id: 'AT', brand: 'GENERIC', kind: 'straight', name: 'Action Tunnel Station',
  lengthMm: AT_LEN, ends: { start: 'socket', end: 'peg' },
  decor: [
    { kind: 'wheel', axis: 'up', atMm: [AT_LEN / 2, 0], centreMm: 4, diameterMm: 170, thickMm: 8, noun: 'base', paint: GREY },
    ...[-1, 1].flatMap((side) => [AT_LEN / 2 - 103, AT_LEN / 2 + 103].map((x) => slab(x, side * 35, 44, 30, 0, 8, 'base', GREY))),
    ...AT_POSTS.along.flatMap((x) => [-1, 1].map((side) => slab(x, side * AT_POSTS.across, AT_POSTS.size, AT_POSTS.size, 8, postTop(x, side * AT_POSTS.across), 'post', BEECH))),
    AT_ROOF,
    AT_WINDOWS,
    // The sign just inside the roof's front, behind the front posts, 14 tall, 2 under the roof.
    slab(SIGN_AT, 0, 2, SIGN_WIDTH, signTop - 14, signTop, 'sign', { fill: '--paper', line: '--ink' }, false),
  ],
  dimensions: {
    status: 'unverified',
    source: "the owner's photos of a real one, 2026-11-08: the track's length the owner's (two medium straights'), the rest read off the photos",
    note: 'A 288 straight through four posts 20 square, 42 either side, at 85 and 203 along, to about 104; an orange domed roof on them, 140 along, 120 across at its ends and 200 in its middle, its crown 165, its ends curling down over the posts and its corners flaring up; a round plate 170 across in the middle. Within about 10mm.',
  },
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/*
 * THE DOUBLE-ARCH BRIDGE (a contributor's photos, 2026-11-09, issue #231): a 240
 * straight, socket to peg, between two orange sides, each a row of
 * overlapping arches on a flat band, joined over the road by two round
 * cross bars at the big arches' tops. No deck and no supports of its own:
 * like any straight it lies on the floor, or at a level on separate
 * supports.
 *
 *   side view            cross bars 118 to 124, at 86.5 and 156.5 along
 *          ___ crown 126 ___     ___ crown 126 ___
 *         /    inner 116    \ X /    inner 116    \
 *        |                   X                     |
 *    ====|=== band, 23 tall ===================== |====  road, 0 to 240
 *   socket 15                85  158              228  peg
 *
 * - Four equal arches each side, each 143 across, springing at the band's
 *   top: the two big ones whole (15 to 158, 85 to 228); the two at the ends,
 *   centred on the band's ends (15 and 228), show only their inner halves,
 *   cut there (`drawnFromMm`, `drawnToMm`).
 * - Where the arches rise past one level they block raised track (library.ts);
 *   the low ends and the band never do.
 * - The sides 28.6 either side of the road's middle (the top views, at
 *   the cross bars).
 *
 * READ, NOT MEASURED, but for the length: the side view traced off the side
 * photo, scaled by the 240 along its bottom edge, so within about 5mm.
 */
const DA_LEN = 240;
const DA_SIDE = 28.6;
const DA_BAND = { from: 15, to: 228, top: 23 } as const;
const DA_ARCH = { crown: 126, inner: 116, span: 143 } as const;
const DA_BARS = [86.5, 156.5] as const;
const daArch = (fromMm: number, cut: { drawnFromMm?: number; drawnToMm?: number } = {}): DecorShape => ({
  kind: 'truss', fromMm, toMm: fromMm + DA_ARCH.span, springMm: DA_BAND.top, crownMm: DA_ARCH.crown, innerCrownMm: DA_ARCH.inner,
  sideMm: DA_SIDE, hangers: 0, parabolic: true, braced: false, ...cut, noun: 'arch', paint: ORANGE,
});
export const DOUBLE_ARCH_BRIDGE: StraightPart = {
  id: 'DA', brand: 'GENERIC', kind: 'straight', name: 'Double-arch bridge',
  lengthMm: DA_LEN, ends: { start: 'socket', end: 'peg' },
  decor: [
    // The flat band along the bottom of each side, 4 thick.
    ...[-1, 1].map((side) => slab((DA_BAND.from + DA_BAND.to) / 2, side * DA_SIDE, DA_BAND.to - DA_BAND.from, 4, 0, DA_BAND.top, 'side', ORANGE)),
    // The two big arches each side, overlapping in the middle.
    daArch(DA_BAND.from),
    daArch(DA_BAND.to - DA_ARCH.span),
    // The half arches at the ends, centred on the band's ends and cut there.
    daArch(DA_BAND.from - DA_ARCH.span / 2, { drawnFromMm: DA_BAND.from }),
    daArch(DA_BAND.to - DA_ARCH.span / 2, { drawnToMm: DA_BAND.to }),
    // The cross bars over the road, about 6 round, at the big arches' tops.
    ...DA_BARS.map((x) => slab(x, 0, 6, 2 * DA_SIDE, 118, 124, 'cross bar', ORANGE)),
  ],
  dimensions: {
    status: 'unverified',
    source:
      "a contributor's photos of a real one, 2026-11-09 (issue #231): the length read off two top views beside a medium straight (240.01 and 240.22, agreed 240.11); " +
      'the side view (the band, the arches, the cross bars) traced off a side photo and scaled by that length; ' +
      "the sides' place across read off both top views at the cross bars; nothing from a ruler",
    note: 'A 240 straight between two orange sides 28.6 either side of it: a band 23 tall from 15 to 228 along, two overlapping arches each side (15 to 158 and 85 to 228, crowns 126 outer and 116 inner), two cross bars 118 to 124 up at 86.5 and 156.5, and a half arch at each end of each side. Within about 5mm.',
  },
  slop: ESTIMATED_SLOP, ...PROFILE,
};

export const CRANE_SEEDS: readonly MultiRoadPart[] = [CARGO_CRANE];
/** Straights with their own decoration that work like no standard part. */
export const TRACK_DECOR_SEEDS: readonly StraightPart[] = [ACTION_TUNNEL_STATION, DOUBLE_ARCH_BRIDGE];
