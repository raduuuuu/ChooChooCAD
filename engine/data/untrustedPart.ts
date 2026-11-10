/**
 * A PIECE FROM SOMEONE ELSE, CHECKED BEFORE ANYTHING DRAWS IT
 * (contributor-brief plan, step 3 and Section 3; T3). Shared by the app's
 * preview route (T4) and `engine/tools/briefLink.ts`, so a link the brief's
 * script accepts is a link the preview opens, and the other way round.
 *
 *   unknown JSON ─▶ a Part ("kind") or a decorated piece's spec ("base")?
 *     ─▶ every field: known, typed, finite, in range, strings capped and brand-free
 *     ─▶ id: simple, not reserved, not a built-in's; dimensions 'unverified'
 *     ─▶ derive: its decoration's boxes (decorBoxesOf), or the spec against
 *        BUILT_IN (deriveDecorated); a throw is a refusal, never a crash
 *     ─▶ a multi-road piece: every road walked lands on its end, both ways up
 *     ─▶ { ok: true, part } | { ok: false, reasons }
 *
 * Today only typed straights and curves are checked (`looksLikePart` in
 * library.ts, for the Add a part form's rows); a link can carry any piece the
 * schema holds, its decoration included, so this checks the whole shape.
 *
 * UNKNOWN FIELDS ARE REFUSED, NOT STRIPPED. A field this file does not know is
 * a field nobody bounded: the renderer might read it tomorrow. Stripping it
 * would also make the preview differ silently from the data the maintainer
 * decodes from the same link; refusing names it, so the sender's Claude takes
 * it out and both read the same thing.
 *
 * Every reason names its field, as `decor[2].hall.wallMm: ...`, in plain
 * words: the brief's Claude fixes the field, and the preview shows the reason.
 */

import { SYSTEM_NAME, type Brand, type Part } from '../src/parts/schema.js';
import { equals, ZERO } from '../src/geom/cyclotomic.js';
import { portsOf, roadEnd, roadsOf } from '../src/graph/model.js';
import { brandWords } from './brandWords.js';
import type { DecoratedSpec } from './decoratedSeeds.js';
import { BUILT_IN, decorBoxesOf, deriveDecorated, RESERVED_ID_PREFIX } from './library.js';
import { CLEARANCE } from './rampSeeds.js';

// ── The bounds, each with why ────────────────────────────────────────────────

/** Any length, position or height in a piece, millimetres either way: the longest built-in piece is 527mm, and no wooden piece is a metre long. */
export const MAX_MM = 1000;
/** A port position's coefficients (Z[zeta16], cyclotomic.ts): a road under MAX_MM moves any one by at most twice its reach, so four times it is a typo. */
export const MAX_COEFF = 4 * MAX_MM;
/** Joint give, the same ceilings `looksLikePart` sets and explains (library.ts, finding B2): about 6x and 3x the published figures. */
export const SLOP_CEILING_MM = 5;
export const SLOP_CEILING_DEG = 5;
/** A multi-road piece's ends: the most a built-in has is 8; 16 leaves room without letting a link list thousands. */
export const MAX_PORTS = 16;
/** Its roads: the most a built-in has is 4. */
export const MAX_ROADS = 32;
/** Decoration shapes: the most a built-in has is 42. */
export const MAX_SHAPES = 128;
/** Any other list inside a shape (a section's points, a dome's patches, stripes, rings): the most a built-in has is 27. */
export const MAX_LIST = 64;
/** String caps, characters, each at least twice the longest built-in's (in brackets). */
export const MAX_TEXT = {
  /** Ids show on palette cards and travel in saved layouts (12). */
  id: 24,
  /** A piece's name, in the palette and every sentence about it (31). */
  name: 60,
  /** Where the figures came from, and why this status (441, 403). */
  source: 1000,
  note: 1000,
  /** What a sentence calls a shape, or an end ("platform", 11; "first road's far end", 23). */
  noun: 40,
  /** The palette card's size, "108 x 108" (8). */
  sizeLabel: 16,
  /** F's label, verb and the sentence after it (34). */
  flip: 80,
  /** An ISO date. */
  date: 40,
} as const;
/** Reasons listed at most; the rest are counted. A crafted payload could otherwise fill a screen. */
export const MAX_REASONS = 20;

/** Ids: letters, digits and dashes, starting with a letter or digit (every built-in id is one). */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
/** A paint is a tokens.css colour name with its leading `--`, nothing that could close a CSS value. */
const TOKEN_PATTERN = /^--[a-z][a-z0-9-]{0,38}$/;
/** Control characters (a terminal escape in the maintainer's decode) and bidirectional overrides (text that reads differently than it is). */
const UNSAFE_CHARS = /[\u0000-\u001f\u007f‪-‮⁦-⁩]/;

const BRANDS = Object.keys(SYSTEM_NAME) as Brand[];
const BUILT_IN_IDS: ReadonlySet<string> = new Set(BUILT_IN.map((p) => p.id));

// ── A small checker: each check adds reasons for the value at `at` ───────────

type Check = (v: unknown, at: string, out: string[]) => void;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (min: number, max: number, opts: { int?: boolean; aboveMin?: boolean } = {}): Check => (v, at, out) => {
  const what = opts.int ? 'a whole number' : 'a number';
  const ok = typeof v === 'number' && Number.isFinite(v) && (opts.aboveMin ? v > min : v >= min) && v <= max && (!opts.int || Number.isInteger(v));
  if (!ok) out.push(`${at}: must be ${what} ${opts.aboveMin ? `over ${min}` : `from ${min}`} to ${max}, not ${show(v)}`);
};
/** A position or a height, millimetres, either way from the piece's origin. */
const MM = num(-MAX_MM, MAX_MM);
/** A size, millimetres, never negative. */
const SIZE = num(0, MAX_MM);
/** A size that must be something: a road's length, a curve's radius, a plank's width. */
const LENGTH = num(0, MAX_MM, { aboveMin: true });

const literal = (...values: readonly unknown[]): Check => (v, at, out) => {
  if (!values.includes(v)) out.push(`${at}: must be ${values.map(show).join(' or ')}, not ${show(v)}`);
};

/** A string: capped, no unsafe characters, no brand name (AGENTS.md). `ownPrefix` is a brand prefix an id may keep. */
const text = (max: number, ownPrefix?: string): Check => (v, at, out) => {
  if (typeof v !== 'string' || v.length === 0) return void out.push(`${at}: must be some text, not ${show(v)}`);
  if (v.length > max) return void out.push(`${at}: must be at most ${max} characters, not ${v.length}`);
  if (UNSAFE_CHARS.test(v)) return void out.push(`${at}: holds a control or text-direction character`);
  const words = brandWords(ownPrefix && v.startsWith(ownPrefix) ? v.slice(ownPrefix.length) : v);
  // The word itself is not repeated: the preview shows these reasons, and the app never names a brand.
  if (words.length > 0) out.push(`${at}: names a brand: write "the maker", or a trait (AGENTS.md)`);
};

const list = (each: Check, max: number, min = 0): Check => (v, at, out) => {
  if (!Array.isArray(v)) return void out.push(`${at}: must be a list, not ${show(v)}`);
  if (v.length < min || v.length > max) return void out.push(`${at}: must hold ${min} to ${max} items, not ${v.length}`);
  v.forEach((x, i) => each(x, `${at}[${i}]`, out));
};

const tuple = (...each: Check[]): Check => (v, at, out) => {
  if (!Array.isArray(v) || v.length !== each.length) return void out.push(`${at}: must be a list of ${each.length} numbers, not ${show(v)}`);
  each.forEach((c, i) => c(v[i], `${at}[${i}]`, out));
};
const PAIR = tuple(MM, MM);

/**
 * An object whose every field is known. `refused` names fields the schema has
 * but a submission may not set, each with why, so the reason says more than
 * "unknown field".
 */
const obj = (required: Record<string, Check>, optional: Record<string, Check> = {}, refused: Record<string, string> = {}): Check => (v, at, out) => {
  if (!isObj(v)) return void out.push(`${at || 'the piece'}: must be an object, not ${show(v)}`);
  const field = (k: string) => (at ? `${at}.${k}` : k);
  for (const [k, c] of Object.entries(required)) {
    if (!(k in v)) out.push(`${field(k)}: missing`);
    else c(v[k], field(k), out);
  }
  for (const k of Object.keys(v)) {
    if (k in required) continue;
    if (k in optional) optional[k]!(v[k], field(k), out);
    else if (k in refused) out.push(`${field(k)}: ${refused[k]}`);
    else out.push(`${field(k)}: not a field this piece can have (unknown fields are refused, not dropped)`);
  }
};

/** One of several object shapes, picked by its `kind`. */
const byKind = (shapes: Record<string, Check>, what: string): Check => (v, at, out) => {
  if (!isObj(v)) return void out.push(`${at}: must be an object, not ${show(v)}`);
  const c = typeof v.kind === 'string' && Object.hasOwn(shapes, v.kind) ? shapes[v.kind] : undefined;
  if (!c) return void out.push(`${at}.kind: must be ${Object.keys(shapes).map(show).join(', ')} (${what}), not ${show(v.kind)}`);
  c(v, at, out);
};

/** A short, safe rendering of a bad value for a reason: never a brand name, nor a control character. */
function show(v: unknown): string {
  if (typeof v === 'string' && brandWords(v).length > 0) return 'a brand name';
  if (typeof v === 'string') return JSON.stringify(v.length > 24 ? `${v.slice(0, 24)}...` : v).replace(UNSAFE_CHARS, '?');
  if (typeof v === 'number') return String(v);
  if (v === null || v === undefined || typeof v === 'boolean') return String(v);
  return Array.isArray(v) ? 'a list' : 'an object';
}

/** Every field in `keys` gets `check`. */
const each = (keys: string, check: Check): Record<string, Check> => Object.fromEntries(keys.split(' ').map((k) => [k, check]));

// ── The schema's shapes (engine/src/parts/schema.ts) ─────────────────────────

const NOUN = text(MAX_TEXT.noun);
const PAINT = obj({ fill: tokenCheck(), line: tokenCheck() });
function tokenCheck(): Check {
  return (v, at, out) => {
    if (typeof v !== 'string' || !TOKEN_PATTERN.test(v)) out.push(`${at}: must be a colour token like "--paint-orange", not ${show(v)}`);
  };
}
const LOOKS = { noun: NOUN, paint: PAINT };
const MM_LIST = list(MM, MAX_LIST);

const DECOR: Check = byKind({
  slab: obj({ kind: literal('slab'), atMm: PAIR, ...each('lengthMm widthMm', SIZE), ...each('bottomMm topMm', MM) }, { solid: literal(false), drawn: literal(false), ...LOOKS }),
  vault: obj(
    { kind: literal('vault'), atMm: PAIR, ...each('lengthMm widthMm wallMm', SIZE), ...each('springMm topMm', MM) },
    {
      bore: obj({ centreMm: MM, radiusMm: SIZE, floorMm: MM }),
      round: literal(true),
      joints: obj({ ringsMm: MM_LIST, wallMm: MM_LIST, archDeg: list(num(0, 180), MAX_LIST) }),
      ...LOOKS,
    },
  ),
  truss: obj(
    { kind: literal('truss'), ...each('fromMm toMm springMm crownMm innerCrownMm', MM), sideMm: SIZE },
    {
      hangers: num(0, MAX_LIST, { int: true }),
      hangerMm: SIZE,
      parabolic: literal(true),
      elliptical: literal(true),
      braced: literal(false),
      band: literal(true),
      ...each('drawnFromMm drawnToMm', MM),
      ...LOOKS,
    },
  ),
  arch: obj({ kind: literal('arch'), ...each('fromMm toMm baseMm', MM), ...each('riseMm depthMm widthMm', SIZE) }, { acrossMm: MM, fillToMm: MM, ...LOOKS }),
  wheel: obj(
    { kind: literal('wheel'), atMm: PAIR, centreMm: MM, ...each('diameterMm thickMm', SIZE) },
    { knobMm: SIZE, axis: literal('across', 'along', 'up'), ringsMm: list(SIZE, MAX_LIST), chordMm: SIZE, ...LOOKS },
  ),
  towers: obj(
    { kind: literal('towers'), towers: list(obj({ atMm: MM, heightMm: SIZE }), 8, 1), ...each('postMm spreadMm openingMm', SIZE), ...each('cableFromMm cableToMm', MM) },
    { noun: NOUN },
  ),
  station: obj(
    {
      kind: literal('station'),
      atMm: PAIR,
      hall: obj({ ...each('lengthMm widthMm wallMm', SIZE), ...each('bottomMm topMm', MM) }),
      openings: list(obj({ side: literal(1, -1), ...each('fromMm toMm topMm', MM) }), MAX_LIST),
      roof: obj({ ...each('lengthMm widthMm baseMm radiusMm', SIZE), topMm: MM }),
      vents: list(obj({ atMm: PAIR, sizeMm: SIZE, topMm: MM }), MAX_LIST),
      tower: obj({ atMm: PAIR, sizeMm: SIZE, ...each('bottomMm topMm', MM) }),
      cap: list(obj({ sizeMm: SIZE, ...each('bottomMm topMm', MM) }), MAX_LIST),
      clock: obj({ sizeMm: SIZE, centreMm: MM, recessMm: SIZE }),
      sign: obj(each('fromMm toMm bottomMm topMm', MM)),
      lines: list(obj({ acrossMm: MM, ...each('lengthMm widthMm', SIZE), heightMm: MM }), MAX_LIST),
    },
    { noun: NOUN },
  ),
  barrier: obj(
    {
      kind: literal('barrier'),
      atMm: PAIR,
      base: obj({ diameterMm: SIZE, topMm: MM }),
      post: obj({ sizeMm: SIZE, topMm: MM, offsetMm: MM }),
      arm: obj({ hingeMm: MM, ...each('lengthMm widthMm thickMm discMm', SIZE), stripesMm: MM_LIST }),
    },
    { noun: NOUN },
  ),
  canopy: obj(
    { kind: literal('canopy'), alongMm: MM, lengthMm: SIZE, sectionMm: list(PAIR, MAX_LIST, 2), ...each('thickMm lipMm', SIZE) },
    { seamsMm: MM_LIST, ...LOOKS },
  ),
  dome: obj(
    { kind: literal('dome'), atMm: PAIR, ...each('lengthMm widthMm bulgeMm alongRiseMm acrossRiseMm thickMm', SIZE), baseMm: MM },
    { archMm: SIZE, patches: list(tuple(MM, MM, SIZE, SIZE), MAX_LIST), ...LOOKS },
  ),
  prism: obj({ kind: literal('prism'), ...each('fromMm toMm', MM), sectionMm: list(PAIR, MAX_LIST, 3) }, { solid: literal(false), ...LOOKS }),
}, 'a decoration shape');

const POLARITY = literal('peg', 'socket');
const ENDS = obj({ start: POLARITY, end: POLARITY });

/** A submission is 'unverified': only the maintainer's review can make it more (schema.ts, DimensionStatus). */
const DIMENSIONS = obj(
  {
    status: (v, at, out) => {
      if (v !== 'unverified') out.push(`${at}: must be "unverified", not ${show(v)}: a submitted piece can't claim more; review upgrades it`);
    },
    source: text(MAX_TEXT.source),
  },
  { note: text(MAX_TEXT.note), submittedAt: text(MAX_TEXT.date), corroborations: num(0, 1, { int: true }) },
);

/** Joint give: bounded as `looksLikePart` bounds it, and never claimed as measured (trust.ts rule 4). */
const SLOP = obj({
  axialMm: num(0, SLOP_CEILING_MM),
  angularDeg: num(0, SLOP_CEILING_DEG),
  calibrationStatus: (v, at, out) => {
    if (v !== 'estimated') out.push(`${at}: must be "estimated", not ${show(v)}: a joint's give is measured only by the maintainer's calibration`);
  },
});

/** A curve turns some of the way round: 1..15 of the 16 headings (`looksLikePart`'s reasoning: 0 or 16 steps go nowhere). */
const ARC_STEPS = num(1, 15, { int: true });

const ROAD_SHAPE = byKind({
  straight: obj({ kind: literal('straight'), lengthMm: LENGTH }),
  // A lead-in and an S-bend are whole millimetres, so the far end stays a lattice point (schema.ts).
  arc: obj({ kind: literal('arc'), innerRadiusMm: LENGTH, arcSteps: ARC_STEPS, side: literal('left', 'right') }, { leadMm: num(0, MAX_MM, { int: true }) }),
  's-bend': obj({ kind: literal('s-bend'), lengthMm: num(0, MAX_MM, { int: true, aboveMin: true }), offsetMm: num(-MAX_MM, MAX_MM, { int: true }) }),
}, 'a road shape');

/** An exact position: eight whole coefficients (cyclotomic.ts), as every built-in end has. */
const CYC = tuple(...Array.from({ length: 8 }, () => num(-MAX_COEFF, MAX_COEFF, { int: true })));
const PORT = obj(
  { at: obj({ pos: CYC, heading: num(0, 15, { int: true }) }), polarity: POLARITY, name: text(MAX_TEXT.noun) },
  { kind: literal('heel') },
);
const ROAD = obj({ from: num(0, MAX_PORTS - 1, { int: true }), to: num(0, MAX_PORTS - 1, { int: true }), shape: ROAD_SHAPE });

/** Fields the schema has that only the built-in catalogue may set, each with why. */
const BUILT_IN_ONLY = {
  partNumber: 'a catalogue number is only for a verified match of a real piece (CEO D3); markings go in the issue',
  body: "a structure's wood is built-in only (OV2)",
  deck: 'a raised deck is built-in only (OV2)',
  deckClearanceMm: 'a raised deck is built-in only (OV2)',
  hump: 'an up-and-over road is built-in only (bridges eng D10)',
  decoratedFrom: 'a decorated piece is sent as its spec, with "base" (deriveDecorated)',
  decorBody: "derived from decor, never written by hand (eng D4): leave it out",
} as const;

const partBase = (brandPrefix: string | undefined) => ({
  required: {
    id: text(MAX_TEXT.id, brandPrefix),
    // Said without listing them: the system values spell makers' names (schema.ts, SYSTEM_NAME).
    brand: ((v, at, out) => {
      if (!BRANDS.includes(v as Brand)) out.push(`${at}: must be one of the library's system values, as the piece it was drawn from has, not ${show(v)}`);
    }) as Check,
    dimensions: DIMENSIONS,
    name: text(MAX_TEXT.name),
    ...each('gaugeWidthMm plankWidthMm plankThicknessMm', LENGTH),
    slop: SLOP,
    heightMm: SIZE,
  },
  optional: {
    grooveWidthMm: LENGTH,
    decor: list(DECOR, MAX_SHAPES),
    flip: obj(each('label verb after', text(MAX_TEXT.flip))),
  },
});

function partCheck(brandPrefix: string | undefined): Check {
  const { required, optional } = partBase(brandPrefix);
  const kind = (k: string, more: Record<string, Check>, moreOptional: Record<string, Check> = {}) =>
    obj({ ...required, kind: literal(k), ...more }, { ...optional, ...moreOptional }, BUILT_IN_ONLY);
  return byKind({
    straight: kind('straight', { ends: ENDS, lengthMm: LENGTH }, { rise: literal(1) }),
    curve: kind('curve', { ends: ENDS, innerRadiusMm: LENGTH, arcSteps: ARC_STEPS }),
    'multi-road': kind('multi-road', { ports: list(PORT, MAX_PORTS, 3), roads: list(ROAD, MAX_ROADS, 2), sizeLabel: text(MAX_TEXT.sizeLabel) }),
    buffer: kind('buffer', { lengthMm: LENGTH, end: POLARITY }),
  }, "a block is built-in only (OV2); a piece's kind is");
}

const SPEC: Check = obj(
  {
    id: text(MAX_TEXT.id),
    name: text(MAX_TEXT.name),
    base: text(MAX_TEXT.id),
    decor: list(DECOR, MAX_SHAPES, 1),
    dimensions: DIMENSIONS,
  },
  { oneSided: NOUN },
  { partNumber: BUILT_IN_ONLY.partNumber },
);

// ── The whole check ──────────────────────────────────────────────────────────

export type UntrustedResult =
  | { readonly ok: true; readonly part: Part }
  | { readonly ok: false; readonly reasons: readonly string[] };

/** The id rules beyond its characters: a simple pattern, not reserved, not already a built-in's. */
function idReasons(id: unknown, field: string): string[] {
  if (typeof id !== 'string') return [];
  if (id.startsWith(RESERVED_ID_PREFIX)) return [`${field}: must not start with "${RESERVED_ID_PREFIX}", which is reserved for keys that are not parts`];
  if (!ID_PATTERN.test(id)) return [`${field}: must be letters, digits and dashes, starting with a letter or digit, not ${show(id)}`];
  if (BUILT_IN_IDS.has(id)) return [`${field}: ${show(id)} is already a built-in piece's id; pick a new one`];
  return [];
}

/**
 * THE GEOMETRY A MULTI-ROAD PIECE STATES TWICE (schema.ts, MultiRoadPart):
 * its ends are listed and its roads name the ends they join, so they must
 * agree. The same walk `engine/test/multiRoad.test.ts` runs over the
 * catalogue, with the engine's own `portsOf`, `roadsOf` and `roadEnd`: every
 * road from its `from` end lands EXACTLY on its `to` end, placed both ways
 * up; end 0 is the entry (the origin, heading 8); every end is on a road.
 */
export function multiRoadReasons(part: Extract<Part, { kind: 'multi-road' }>): string[] {
  const out: string[] = [];
  const n = part.ports.length;
  part.roads.forEach((r, i) => {
    if (r.from >= n || r.to >= n) out.push(`roads[${i}]: joins end ${r.from >= n ? r.from : r.to}, but the piece has ends 0 to ${n - 1}`);
    else if (r.from === r.to) out.push(`roads[${i}]: joins end ${r.from} to itself`);
  });
  if (out.length > 0) return out;
  const first = part.ports[0]!.at;
  if (!equals(first.pos, ZERO) || first.heading !== 8) out.push('ports[0].at: end 0 must be the entry, at the origin facing back (pos all 0, heading 8)');
  part.ports.forEach((_, i) => {
    if (!part.roads.some((r) => r.from === i || r.to === i)) out.push(`ports[${i}]: end ${i} is on no road`);
  });
  for (const turn of ['left', 'right'] as const) {
    const ends = portsOf(part, turn);
    roadsOf(part, turn).forEach((road, i) => {
      const got = roadEnd(ends[road.from]!.at, road.shape, part.plankWidthMm);
      const want = ends[road.to]!.at;
      if (!equals(got.pos, want.pos) || got.heading !== want.heading) {
        out.push(`roads[${i}]: walked from end ${road.from} (placed ${turn}), it ends at pos [${got.pos.join(', ')}] heading ${got.heading}, not on end ${road.to} (pos [${want.pos.join(', ')}] heading ${want.heading})`);
      }
    });
  }
  return out;
}

/** At most MAX_REASONS, the rest counted. */
const capped = (reasons: string[]): readonly string[] =>
  reasons.length <= MAX_REASONS ? reasons : [...reasons.slice(0, MAX_REASONS), `and ${reasons.length - MAX_REASONS} more`];

const refuse = (reasons: string[]): UntrustedResult => ({ ok: false, reasons: capped(reasons) });

/**
 * Check `data` (parsed JSON, from anyone) as a piece: a `Part` (it has
 * "kind") or a `DecoratedSpec` (it has "base"). Never throws; anything it
 * can't vouch for is a refusal naming the field.
 */
export function checkUntrustedPart(data: unknown): UntrustedResult {
  if (!isObj(data)) return refuse([`the piece: must be an object, not ${show(data)}`]);
  const isSpec = 'base' in data, isPart = 'kind' in data;
  if (isSpec === isPart) {
    return refuse([isSpec
      ? 'the piece: has both "kind" (a piece) and "base" (a decorated piece\'s spec); send one'
      : 'the piece: must have "kind" (a straight, curve, multi-road or buffer piece) or "base" (a decorated piece built on a built-in one)']);
  }
  const reasons: string[] = [];
  const brandPrefix = isPart && typeof data.brand === 'string' && BRANDS.includes(data.brand as Brand) ? `${data.brand}-` : undefined;
  (isSpec ? SPEC : partCheck(brandPrefix))(data, '', reasons);
  reasons.push(...idReasons(data.id, 'id'));
  if (reasons.length > 0) return refuse(reasons);
  try {
    if (isSpec) {
      // Derived as the library derives its own seeds; a missing base or a bad shape throws, and is said.
      return { ok: true, part: deriveDecorated([data as unknown as DecoratedSpec], BUILT_IN, CLEARANCE.riseMm)[0]! };
    }
    const part = data as unknown as Part;
    if (part.kind === 'multi-road') {
      const geometry = multiRoadReasons(part);
      if (geometry.length > 0) return refuse(geometry);
    }
    if (!part.decor) return { ok: true, part };
    return { ok: true, part: { ...part, decorBody: decorBoxesOf(`Piece ${part.id}`, part.decor, CLEARANCE.riseMm) } };
  } catch (e) {
    return refuse([`${isSpec ? 'the decorated piece' : 'decor'}: ${(e as Error).message}`]);
  }
}
