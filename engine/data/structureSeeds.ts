/**
 * STRUCTURES: an elevated station, a riser and a tunnel with overpass, all
 * UNVERIFIED (plan docs/plan/2026-11-02-photo-parts-and-stations.md; CEO S1,
 * X1, X3; eng D1, E4). The riser and the tunnel are measured printable
 * designs (2026-11-03, below); the station is read off the owner's photos of
 * a real one (2026-11-06, below); the retired pier and the retired tunnel are
 * round-number estimates.
 *
 * Each is wood that is partly not track, held as body boxes (schema.ts
 * `BodyBox`), each at its own levels above the piece's frame:
 *
 *   piece           floor (level 0 above its frame)          raised (level 1)
 *   station  ST     base slab: no floor track through it     deck road (a medium straight), and the
 *                                                            building beside it: no other raised track
 *   pier     PR     footprint: no floor track through it     nothing: raised track passes over
 *   tunnel   TU     own road through; walls either side      roof: no raised track over it
 *
 * THE PIER AND THE OLD TUNNEL ARE ESTIMATES until a real piece is
 * photographed (photo guide, docs/photo-guide.html): round numbers that look
 * right beside the 144mm medium straight. Verdicts that use one say so, like
 * any unverified piece.
 */

import type { BlockPart, DecorSlab, DimensionSource, Paint, SlopBudget, StraightPart } from '../src/parts/schema.js';
import { CLEARANCE } from './rampSeeds.js';

const ESTIMATED_SLOP: SlopBudget = { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'estimated' };

const PROFILE = { gaugeWidthMm: 26, plankWidthMm: 40, plankThicknessMm: 12, grooveWidthMm: 6, heightMm: 0 } as const;

const ESTIMATE = (what: string): DimensionSource => ({
  status: 'unverified',
  source: 'round-number estimates beside the medium straight',
  note: `${what} Not measured: photograph a real one (docs/photo-guide.html) to replace these.`,
});

/** The deck's length: a medium straight. */
const DECK = 144;

/*
 * THE ELEVATED STATION (owner's photos 2026-11-06: one from straight above
 * on millimetre paper, three side-on in front of it). The deck carries a
 * medium straight one level up; the building stands on its right as the
 * deck runs from its socket, on a base slab whose edge is under the track's
 * centre line, so the deck's far half reaches past it.
 *
 *   seen along the track            the deck's centre line at 0, across in mm
 *
 *     0   16      60    106 129     roof: a curved shell, 183 over the deck's
 *     |    ___roof___   ___          edge falling to 97 at 129, an 18 lip
 *     |  /|    clock |cap|  \       over the track; 204 along in two halves
 *  ===|== |pillar  posts+lift \      either side of the lift shaft (65),
 *                                     seamed at 55 and 76 from its middle
 *   deck  |  platform  |  |    |    platform 56 to 80, beside the deck
 *  -------+------base slab----+     base 201 along, 126 across, 12 tall
 *    ^ table
 *
 * READ, NOT MEASURED. The plan is the top view's, its perspective solved
 * from the deck's straight (73 up) against the straight lying on the paper
 * (12 up): the camera was 665 above the table. Heights are the side views',
 * scaled from the deck straight's end (12 thick, its top at the raised
 * level) with the camera's height solved from the base slab's two edges;
 * the two readings of that height agree within 10. Lengths along the track
 * not seen in any view (the platform's, the lift car's) are estimated.
 */
/*
 * THE STATION'S PAINT IN 3D (paint plan docs/plan/2026-11-07-3d-colour.md):
 * read off the owner's photos, white-balanced to the beech of the loose
 * straight, each a token in tokens.css with its measured ratio and its
 * distance from --fail. Lines are chosen per paint so every edge on it reads
 * at 3:1 or more (design D6).
 */
const ROOF: Paint = { fill: '--paint-roof', line: '--ink' };
const RED: Paint = { fill: '--paint-red', line: '--ink' };
const BEECH: Paint = { fill: '--track-fill', line: '--ink-soft' };
const BASE: Paint = { fill: '--paint-base', line: '--paper' };
const GREY: Paint = { fill: '--paint-grey', line: '--ink' };

/** How far the station's base reaches past each end of its deck: (201 - 144) / 2. */
const BASE_PAST = 28.5;
/** Half the base's printed top: a skin this far either side of its top face, so the beech never shows through it. */
const PRINT_SKIN = 0.5;
/** The lift shaft along the deck, its posts' outer faces, and each post. */
const SHAFT = 65;
const POST = 12;
/** Each of the roof's two curved sections: 204 overall, less the shaft between them. */
const ROOF_SIDE = (204 - SHAFT) / 2;
/** The roof seen along the deck: its top from over the deck's edge to the far eave (across, height). */
const ROOF_SECTION = [[-16, 183], [-27, 184.5], [-45, 183], [-63, 180], [-81, 173], [-95, 165], [-104, 156], [-113, 144.5], [-120, 131], [-125, 116], [-129, 97]] as const;

/**
 * The lift car (owner's back photo, 2026-11-07): an open red frame you see
 * the platform through, on a tray floor, between the shaft's posts. Only
 * its floor collides: it blocks the levels the solid car did, and the
 * clock over it (wider, from 150) the level above, so the bars are 3D
 * only and the 2D drawing keeps its one rectangle.
 *
 *    top bars  +========+   147
 *              |        |   corner posts, CAR_BAR square
 *              |        |
 *    floor     [________]   63 to 71
 */
const CAR_BAR = 3;
function liftCar(): DecorSlab[] {
  const along = SHAFT - 2 * POST, across = 40, at = [DECK / 2, -83.5] as const, floorTop = 71, top = 147;
  const red = { noun: 'lift', paint: RED } as const;
  const bar = { ...red, solid: false } as const;
  const inset = (n: number) => n / 2 - CAR_BAR / 2;
  return [
    { kind: 'slab', atMm: at, lengthMm: along, widthMm: across, bottomMm: 63, topMm: floorTop, ...red },
    ...[-1, 1].flatMap((sa) => [-1, 1].map((sc): DecorSlab => ({ kind: 'slab', atMm: [at[0] + sa * inset(along), at[1] + sc * inset(across)], lengthMm: CAR_BAR, widthMm: CAR_BAR, bottomMm: floorTop, topMm: top - CAR_BAR, ...bar }))),
    ...[-1, 1].map((sc): DecorSlab => ({ kind: 'slab', atMm: [at[0], at[1] + sc * inset(across)], lengthMm: along, widthMm: CAR_BAR, bottomMm: top - CAR_BAR, topMm: top, ...bar })),
    ...[-1, 1].map((sa): DecorSlab => ({ kind: 'slab', atMm: [at[0] + sa * inset(along), at[1]], lengthMm: CAR_BAR, widthMm: across - 2 * CAR_BAR, bottomMm: top - CAR_BAR, topMm: top, ...bar })),
  ];
}

export const STATION: StraightPart = {
  id: 'ST', brand: 'GENERIC', kind: 'straight', name: 'Elevated station',
  lengthMm: DECK, ends: { start: 'socket', end: 'peg' }, deck: 1,
  decor: [
    /*
     * The base, 201 along: solid under the deck, and its two ends, 28.5 past
     * each end of the deck, drawn but not solid. A ramp or raised track
     * joined to the deck sits over them (owner, 2026-11-06: a ramp joins the
     * deck directly).
     */
    { kind: 'slab', atMm: [DECK / 2, -62], lengthMm: DECK, widthMm: 126, bottomMm: 0, topMm: 12, noun: 'base', paint: BEECH },
    { kind: 'slab', atMm: [-BASE_PAST / 2, -62], lengthMm: BASE_PAST, widthMm: 126, bottomMm: 0, topMm: 12, solid: false, noun: 'base', paint: BEECH },
    { kind: 'slab', atMm: [DECK + BASE_PAST / 2, -62], lengthMm: BASE_PAST, widthMm: 126, bottomMm: 0, topMm: 12, solid: false, noun: 'base', paint: BEECH },
    // Its printed top: the beech base wears it as a skin, drawn in 3D only (not solid, so 2D and the clash check never see it).
    { kind: 'slab', atMm: [(DECK + 2 * BASE_PAST) / 2 - BASE_PAST, -62], lengthMm: DECK + 2 * BASE_PAST, widthMm: 126, bottomMm: 12 - PRINT_SKIN, topMm: 12 + PRINT_SKIN, solid: false, noun: 'base', paint: BASE },
    // The grey frame the deck's straight sits in; its lips under the next piece's ends are left out.
    { kind: 'slab', atMm: [DECK / 2, 0], lengthMm: DECK, widthMm: 40, bottomMm: 55, topMm: CLEARANCE.riseMm, noun: 'deck', paint: GREY },
    { kind: 'slab', atMm: [-2, -27], lengthMm: 10, widthMm: 10, bottomMm: 12, topMm: 177, noun: 'pillar', paint: BEECH },
    { kind: 'slab', atMm: [DECK + 2, -27], lengthMm: 10, widthMm: 10, bottomMm: 12, topMm: 177, noun: 'pillar', paint: BEECH },
    { kind: 'slab', atMm: [DECK / 2, -41.5], lengthMm: DECK, widthMm: 43, bottomMm: 56, topMm: 80, noun: 'platform', paint: BEECH },
    /*
     * The lift: a shaft 65 along, open at the back, between two posts that
     * rise through the gap in the roof to the clock's cap; its car up at the
     * platform, seen through the arch in the back panel over the shaft.
     */
    { kind: 'slab', atMm: [DECK / 2 - SHAFT / 2 + POST / 2, -83], lengthMm: POST, widthMm: 46, bottomMm: 12, topMm: 187, noun: 'lift tower', paint: BEECH },
    { kind: 'slab', atMm: [DECK / 2 + SHAFT / 2 - POST / 2, -83], lengthMm: POST, widthMm: 46, bottomMm: 12, topMm: 187, noun: 'lift tower', paint: BEECH },
    ...liftCar(),
    // The back panel over the shaft, under the clock: an arch springing at 132 from the posts' outer faces, its crown at 154.
    { kind: 'arch', fromMm: DECK / 2 - SHAFT / 2, toMm: DECK / 2 + SHAFT / 2, baseMm: 132, riseMm: 22, depthMm: 0, widthMm: 6, acrossMm: -107, fillToMm: 183, noun: 'roof', paint: ROOF },
    { kind: 'slab', atMm: [DECK / 2, -83], lengthMm: 45, widthMm: 46, bottomMm: 150, topMm: 187, noun: 'clock', paint: ROOF },
    { kind: 'slab', atMm: [DECK / 2, -85], lengthMm: 73, widthMm: 50, bottomMm: 187, topMm: 201, noun: 'clock tower', paint: ROOF },
    /*
     * The lift's winding wheel, on the clock's far face (owner's back photo,
     * 2026-11-07: scaled by the posts' outer faces, 65 apart, its ledge
     * landing on the clock's bottom at 150): 31 across, its hub at 171 and
     * its knob 10 under the hub. A toy's moving part, never in the way of track.
     */
    { kind: 'wheel', atMm: [DECK / 2, -111], centreMm: 171, diameterMm: 31, thickMm: 10, knobMm: 10, noun: 'crank', paint: RED },
    // The roof: two curved sections, one either side of the lift shaft.
    ...[-1, 1].map((side) => ({
      kind: 'canopy' as const, alongMm: DECK / 2 + side * (SHAFT / 2 + ROOF_SIDE / 2), lengthMm: ROOF_SIDE,
      sectionMm: ROOF_SECTION, thickMm: 7, lipMm: 18,
      // Two seams in each, 55 and 76 from the station's middle.
      seamsMm: [55, 76].map((m) => side * (m - SHAFT / 2 - ROOF_SIDE / 2)),
      noun: 'roof', paint: ROOF,
    })),
    /*
     * Over the shaft the roof is open only at the back (owner, 2026-11-07,
     * the track-side photo): at the front its edge runs on across, the
     * section as far back as the clock (63), and a panel hangs from it
     * between the posts, down to 142.
     */
    { kind: 'canopy', alongMm: DECK / 2, lengthMm: SHAFT, sectionMm: ROOF_SECTION.slice(0, 4), thickMm: 7, lipMm: 18, noun: 'roof', paint: ROOF },
    { kind: 'slab', atMm: [DECK / 2, -18], lengthMm: SHAFT - 2 * POST, widthMm: 4, bottomMm: 142, topMm: 158, noun: 'roof', paint: ROOF },
  ],
  dimensions: {
    status: 'unverified',
    source: "the owner's four photos of a real one, 2026-11-06: the plan read off the top view with its perspective solved; heights scaled off the side views from the deck's straight; the platform's and lift car's lengths estimated",
    note: 'A 144 deck one level up beside a base 201 by 126 and 12 tall, its edge under the track. Pillars, a platform 56 to 80, a lift tower to 187 under a clock to 201, and a curved roof from 183 over the deck to 97 at 129 across. Heights within about 5mm; a ruler would settle them.',
  },
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

/**
 * A riser leg: 8mm square, at a corner of the 58mm deck, 25mm either side of
 * the road. In 3D (riser plan 2026-11-03, read off 3MF 597436): the legs are
 * posts up to the deck, which is a 58 by 58 plate under the road, from the
 * posts' tops to just under the road's top. The plate is drawn only: the legs
 * and the road are what collide.
 */
const LEG = 8;
const RISER_LEN = 58;
/** A deck plate's top sits this far under the road's, so the track reads on it and the two never share a face. */
export const PLATE_DROP_MM = 1;
const leg = (x: number, y: number) => ({ role: 'footprint' as const, atMm: [x, y] as const, lengthMm: LEG, widthMm: LEG, levels: [0, 0] as const });

export const RISER: StraightPart = {
  id: 'RS', brand: 'GENERIC', kind: 'straight', name: 'Riser',
  lengthMm: RISER_LEN, ends: { start: 'socket', end: 'peg' }, deck: 1,
  decor: [{
    kind: 'slab', atMm: [RISER_LEN / 2, 0], lengthMm: RISER_LEN, widthMm: 58,
    bottomMm: CLEARANCE.riseMm, topMm: CLEARANCE.riseMm + CLEARANCE.plankMm - PLATE_DROP_MM, solid: false, noun: 'plate',
  }],
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

/*
 * THE STONE ARCH BRIDGE (SA), measured off its 3MF mesh on 2026-11-03
 * (bridges plan; eng D1, D7, D8, D9; design DD3-DD6):
 *
 *   socket end                 ___crown ~100___                 socket end
 *   (floor)        ramp up    /   stone arch   \   ramp down     (floor)
 *     0 ------------------- 120 ---- 153 ...... 323 ---- 356 ------------ 476
 *                  embankment  |abut| passage 170 |abut| embankment
 *                   61 ---------- 153            323 ---------- 415
 *
 * - Each base: a ramp road climbing on a curve from 12mm (track height) at its
 *   socket end to 57.1mm at 120mm in; its abutment's inner face meets the
 *   12mm foot plate at 153mm. The arch's frame spans the 170mm between the
 *   two inner feet and rises 57.2mm from the plate: a 69.2mm opening.
 * - The stones (46 wide, 30.8 deep) carry the road over the arch; its crown
 *   is about 100mm, ESTIMATED from frame plus stone, not read off the kit
 *   assembled.
 * - Length 476: 2 x 153 + 170, rounded from 475.6 to the whole millimetre.
 * - Collision (eng D8): each embankment and abutment a 54-wide floor footprint
 *   from 61 to 153 (and 323 to 415); the passage between is open floor. The
 *   kit's foot plates under the passage carry the crossing; here any floor
 *   track may cross there, which is the same thing.
 */
const SA_LEN = 476;
const SA_RAMP = 120;
const SA_FOOT = 153;
const SA_CROWN = 100;
/** The ramp's measured top surface, every 5mm from 20mm in to 120mm. */
const SA_RAMP_PROFILE: readonly (readonly [number, number])[] = [
  [0, 12], [20, 13.3], [25, 14], [30, 14.9], [35, 15.9], [40, 17.1], [45, 18.5], [50, 20], [55, 21.8],
  [60, 23.7], [65, 25.8], [70, 28.2], [75, 30.7], [80, 33.5], [85, 36.5], [90, 39.7], [95, 42.9],
  [100, 46.2], [105, 49.4], [110, 52.7], [115, 55.9], [120, 57.1],
];
/** Over the arch: a circle through both ramp tops and the crown, every 16mm. */
function overArch(): (readonly [number, number])[] {
  const chord = SA_LEN - 2 * SA_RAMP;
  const sag = SA_CROWN - 57.1;
  const radius = (chord * chord / 4 + sag * sag) / (2 * sag);
  const mid = SA_LEN / 2;
  const out: (readonly [number, number])[] = [];
  for (let a = SA_RAMP + 16; a < SA_LEN - SA_RAMP; a += 16) {
    const d = a - mid;
    out.push([a, SA_CROWN - (radius - Math.sqrt(radius * radius - d * d))]);
  }
  return out;
}
const SA_PROFILE = [
  ...SA_RAMP_PROFILE,
  ...overArch(),
  ...SA_RAMP_PROFILE.slice().reverse().map(([a, h]) => [SA_LEN - a, h] as const),
];
const SA_EMBANK = SA_FOOT - 61;

export const STONE_ARCH_BRIDGE: StraightPart = {
  id: 'SA', brand: 'GENERIC', kind: 'straight', name: 'Stone arch bridge',
  lengthMm: SA_LEN, ends: { start: 'socket', end: 'socket' },
  hump: {
    upMm: SA_RAMP, topMm: SA_LEN - 2 * SA_RAMP, downMm: SA_RAMP,
    profileMm: SA_PROFILE,
    clearanceMm: 69.2,
  },
  decor: [{ kind: 'arch', fromMm: SA_FOOT, toMm: SA_LEN - SA_FOOT, baseMm: 12, riseMm: 57.2, depthMm: 30.8, widthMm: 46, noun: 'arch' }],
  body: [
    { role: 'footprint', atMm: [61 + SA_EMBANK / 2, 0], lengthMm: SA_EMBANK, widthMm: 54, levels: [0, 0], profileMm: [[0, 11], [59, 45], [SA_EMBANK, 12]] },
    { role: 'footprint', atMm: [SA_LEN - 61 - SA_EMBANK / 2, 0], lengthMm: SA_EMBANK, widthMm: 54, levels: [0, 0], profileMm: [[0, 12], [SA_EMBANK - 59, 45], [SA_EMBANK, 11]] },
  ],
  dimensions: printed('A 476 road up a curved ramp, over a stone arch and down, on two embankments; a 170 passage under the arch, 69.2 high.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/*
 * THE SUSPENSION BRIDGE (SB), ESTIMATED from its kit on 2026-11-03 (bridges
 * plan B-T6; owner: "build it as an estimate"). The kit is printed flat: two
 * side faces (deck edge and cables), three tower bases, six posts and two
 * ramps. Read off the parts: the main span 157, the tower bases 28 x 73 and
 * 62 high, the posts 178, the ramps 85. NOT read, estimated from the parts
 * and the designer's renders: how they sit assembled.
 *
 *   ramp 85   side span ~100      main span 157        side span ~100   ramp 85
 *   12->~37   climbs to the deck  T1 ---- T2 ---- T3   comes down       ->12
 *              (deck top ~73, the raised level)   towers ~200 / ~240 / ~200
 *
 * Floor track passes under the main span between the tower bases (50 wide
 * each side of the middle base). The deck's underside, ~61, is the opening.
 */
const SB_RAMP = 85;
const SB_SIDE = 100;
const SB_MAIN = 157;
const SB_UP = SB_RAMP + SB_SIDE;
const SB_LEN = 2 * SB_UP + SB_MAIN;
const SB_DECK = 73;
const SB_RAMP_TOP = 37;
const sbClimb: (readonly [number, number])[] = [[0, 12], [SB_RAMP, SB_RAMP_TOP]];
for (let a = 20; a <= SB_SIDE; a += 20) {
  const t = a / SB_SIDE;
  sbClimb.push([SB_RAMP + a, SB_RAMP_TOP + (SB_DECK - SB_RAMP_TOP) * (1 - (1 - t) * (1 - t))]);
}
const SB_PROFILE = [...sbClimb, ...sbClimb.slice().reverse().map(([a, h]) => [SB_LEN - a, h] as const)];
const SB_TOWERS = [SB_UP, SB_UP + SB_MAIN / 2, SB_UP + SB_MAIN];
const sbBase = (at: number) => ({
  role: 'footprint' as const, atMm: [at, 0] as const, lengthMm: 28, widthMm: 73, levels: [0, 0] as const,
  profileMm: [[0, 62], [28, 62]] as const,
});

export const SUSPENSION_BRIDGE: StraightPart = {
  id: 'SB', brand: 'GENERIC', kind: 'straight', name: 'Suspension bridge',
  lengthMm: SB_LEN, ends: { start: 'socket', end: 'peg' },
  hump: {
    upMm: SB_UP, topMm: SB_MAIN, downMm: SB_UP,
    profileMm: SB_PROFILE,
    clearanceMm: SB_DECK - 12,
    clearanceEstimated: true,
  },
  /*
   * Each tower two 8mm posts 30 either side of the road, a crossbeam 70 over
   * it; the cables reach the road 100 back from the top of each climb. All
   * estimated, like the towers' heights.
   */
  decor: [{
    kind: 'towers',
    towers: [
      { atMm: SB_TOWERS[0]!, heightMm: 200 },
      { atMm: SB_TOWERS[1]!, heightMm: 240 },
      { atMm: SB_TOWERS[2]!, heightMm: 200 },
    ],
    postMm: 8, spreadMm: 30, openingMm: 70,
    cableFromMm: SB_UP - 100, cableToMm: SB_LEN - SB_UP + 100,
    noun: 'towers',
  }],
  body: SB_TOWERS.map(sbBase),
  dimensions: {
    status: 'unverified',
    source: 'a printed reproduction, read off the 3MF parts on 2026-11-03; assembled sizes estimated',
    note: 'A 527 road up ramps and curved side spans to a 157 main span between three towers. The assembled height, length and tower heights are estimates. Unverified until a real one is measured.',
  },
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/*
 * THE TRACK SUPPORT (more parts plan 2026-11-03), read off 3MF 1238767,
 * printed lying down: a slab 25 thick along the track and 52 across, its
 * cradle (44.6 wide between 3.7 walls) 60.7 up: raised track sits in it one
 * level up. No track of its own, like the pier it replaces in the list.
 */
export const TRACK_SUPPORT: BlockPart = {
  id: 'TS', brand: 'GENERIC', kind: 'block', name: 'Track support',
  body: [{ role: 'footprint', atMm: [0, 0], lengthMm: 25, widthMm: 52, levels: [0, 0] }],
  sizeLabel: '25×52',
  dimensions: printed('A 25 by 52 footprint; its cradle holds track 60.7 up, one level.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

/*
 * THE HARBOUR ARCH BRIDGE (Sydney bridge plan 2026-11-03), read off 3MF
 * 1124746: two portals, two truss arch sides and two 108 tracks.
 *
 *                     ______ crown 142.5 (outer chord) ______
 *          pylon    /   inner chord 118.3, hangers to deck  \    pylon 127
 *   socket |  |====/========== deck, top 72.8 ===============\===|  | peg
 *          |  |   /       floor track passes under            \  |  |
 *         -24 0  20.5 ......... 47.3 ......... 168.7 ...... 195.5 216 240
 *         portal (71.3 along)    open floor between portals    portal
 *
 * - The tracks rest on a ledge 60.8 up in each portal, 24 in from its outer
 *   face: one level up. The two make a 216 road, socket to peg.
 * - Each portal is 103 across: two pylons, 25.9 wide, 25.6 to 51.5 out from
 *   the road, 127 tall; between them, under the road, the portal fills the
 *   floor from the ledge to its inner face. Its outer 24 is a 7mm apron,
 *   left out so a ramp or raised track can come in over it.
 * - The arch sides (175 long, rib centres 28 either side) spring 19.8 up at
 *   20.5 and 195.5 along; outer chord crown 142.5, inner 118.3.
 */
const HB_LEN = 216;
const PORTAL = 71.3;
const PORTAL_IN = 47.3;
const pylon = (mid: number, side: 1 | -1) => ({
  role: 'wall' as const, atMm: [mid, side * 38.55] as const, lengthMm: PORTAL, widthMm: 25.9, levels: [0, 1] as const,
  profileMm: [[0, 127], [PORTAL, 127]] as const,
});
const portalFloor = (mid: number) => ({
  role: 'footprint' as const, atMm: [mid, 0] as const, lengthMm: PORTAL_IN, widthMm: 51.2, levels: [0, 0] as const,
});

export const HARBOUR_BRIDGE: StraightPart = {
  id: 'HB', brand: 'GENERIC', kind: 'straight', name: 'Harbour arch bridge',
  lengthMm: HB_LEN, ends: { start: 'socket', end: 'peg' }, deck: 1,
  body: [
    portalFloor(PORTAL_IN / 2), portalFloor(HB_LEN - PORTAL_IN / 2),
    pylon(PORTAL_IN - PORTAL / 2, 1), pylon(PORTAL_IN - PORTAL / 2, -1),
    pylon(HB_LEN - PORTAL_IN + PORTAL / 2, 1), pylon(HB_LEN - PORTAL_IN + PORTAL / 2, -1),
  ],
  deckClearanceMm: 60.8,
  decor: [{ kind: 'truss', fromMm: 20.5, toMm: 195.5, springMm: 19.8, crownMm: 142.5, innerCrownMm: 118.3, sideMm: 28, noun: 'arch' }],
  dimensions: printed('A 216 road one level up between two portals 121.4 apart; floor track passes under between them.'),
  slop: ESTIMATED_SLOP, ...PROFILE,
};

export const STRUCTURE_SEEDS = [STATION, RISER, TRACK_SUPPORT, TUNNEL_OVERPASS, STONE_ARCH_BRIDGE, SUSPENSION_BRIDGE, HARBOUR_BRIDGE] as const;

/** How the app names each structure in a sentence, and what its list line says it carries (design decision 5). */
export const STRUCTURE_WORDS: Readonly<Record<string, { readonly word: string; readonly carries: string }>> = {
  ST: { word: 'station', carries: 'road raised, footprint on the floor' },
  RS: { word: 'riser', carries: 'road raised on legs, floor track passes under' },
  TS: { word: 'support', carries: 'holds raised track, no track connections' },
  TO: { word: 'tunnel', carries: 'road raised over a passage, floor track passes through' },
  SA: { word: 'bridge', carries: 'road over the arch, floor track passes under' },
  HB: { word: 'bridge', carries: 'road raised between the portals, floor track passes under' },
  SB: { word: 'bridge', carries: 'road over the main span, floor track passes under' },
  PR: { word: 'pier', carries: 'no track connections' },
  TU: { word: 'tunnel', carries: 'road between walls, under a roof' },
};
