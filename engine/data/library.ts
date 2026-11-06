/**
 * The part library: everything a layout can be built from, across every brand.
 *
 * THE SHAPE, AND WHY IT IS NOT THE OLD ONE
 *
 * Until now there was one array of parts that served as the catalogue, the
 * palette, and the set of things inventory could count. That works for one brand
 * whose dimensions are published. It breaks the moment the answer to "what track
 * exists" is "more than anyone has written down", which is the real situation:
 * nobody publishes piece dimensions for IKEA Lillabo or Lidl Playtive, and the
 * reference says there is no dimensional standard because brands deviate
 * deliberately to avoid patents.
 *
 * So the library is now three tiers that resolve into one list:
 *
 *   BUILT-IN       Generic, published figures from an established reference.
 *   SEEDS          parts whose dimensions are UNVERIFIED: third-party track, and
 *                  the Generic switches read off 3D-print reproductions. Present so
 *                  someone who owns the track has a row to correct rather than a
 *                  blank form. Any user submission overrides a seed.
 *   SUBMISSIONS    parts a user measured, or that reached the shared library from
 *                  someone else. Highest trust available for third-party track,
 *                  because the only reliable source is somebody with the piece
 *                  in their hand.
 *
 * A submission for an id that already exists WINS if its source is more trusted,
 * which is what makes a seed correctable. See `resolveLibrary`.
 *
 * LOCAL TODAY, SHARED LATER. Submissions persist in browser storage. The decision
 * to make the library shared between users is recorded and accepted; the server,
 * accounts, moderation and the children's-privacy posture it needs do not exist
 * yet. Everything here is shaped so that turning sharing on is a transport
 * change: every submission carries a stable id, a provenance record and a
 * timestamp, and nothing depends on the submitter being the only author.
 */

import { isStructure, type BodyBox, type DecorBox, type DecorShape, type DimensionSource, type DrawnShape, type Part } from '../src/parts/schema.js';
import { DIMENSION_TRUST, trustRank, type DimensionStatus } from '../src/parts/schema.js';
import { portsOf } from '../src/graph/model.js';
import { GENERIC_PARTS } from './generic.js';
import { CLEARANCE, RAMP_SEEDS } from './rampSeeds.js';
import { DECORATED_SEEDS, type DecoratedSpec } from './decoratedSeeds.js';
import { BUFFER_SEEDS } from './bufferSeeds.js';
import { STRUCTURE_SEEDS } from './structureSeeds.js';
import { stored, write } from './storage.js';
import { CROSSING_SEEDS, MULTI_ROAD_SEEDS, SWITCH_SEEDS } from './switchSeeds.js';
import { THIRD_PARTY_SEEDS } from './thirdParty.js';

/**
 * Built-in parts: published Generic, unverified Generic switches measured off 3D-print
 * reproductions, and unverified third-party seeds.
 */
const PLAIN_BUILT_IN: readonly Part[] = [
  ...GENERIC_PARTS, ...RAMP_SEEDS, ...SWITCH_SEEDS, ...CROSSING_SEEDS, ...MULTI_ROAD_SEEDS, ...BUFFER_SEEDS,
  // A structure's drawn detail is shapes too, its boxes derived like a decorated piece's (eng D3, D6).
  ...STRUCTURE_SEEDS.map((p): Part => (p.decor ? { ...p, decorBody: decorBoxesOf(`Structure ${p.id}`, p.decor, CLEARANCE.riseMm) } : p)),
  ...THIRD_PARTY_SEEDS,
];

/**
 * The levels a decoration shape blocks, from its height (eng D9): every
 * level its millimetre range reaches, level n being [n x rise, (n+1) x rise).
 * A range ending exactly on a level line does not reach into the next.
 */
export function decorLevels(bottomMm: number, topMm: number, riseMm: number): readonly [number, number] {
  const lo = Math.floor(bottomMm / riseMm);
  return [lo, Math.max(lo, Math.ceil(topMm / riseMm) - 1)];
}

/**
 * THE BOXES A PART'S SHAPES TAKE UP (eng D4, D9, D10), derived, never written
 * by hand: each box at the whole levels its heights reach, carrying those
 * heights for drawing. A slab is its own box; a vault collides with its two
 * walls and its roof, and one more box, not solid, draws it; a truss, an
 * arch band or a bridge's towers is drawing only, one box that draws it and
 * never collides. A shape with no height is a seed error, refused when the
 * library loads.
 */
export function decorBoxesOf(owner: string, decor: readonly DecorShape[], riseMm: number): DecorBox[] {
  const boxOf = (
    role: BodyBox['role'], atMm: readonly [number, number], lengthMm: number, widthMm: number,
    bottomMm: number, topMm: number, more: Partial<DecorBox> & { solid: boolean; draw: boolean },
  ): DecorBox => {
    if (!(topMm > bottomMm) || bottomMm < 0 || !Number.isFinite(topMm)) {
      throw new Error(`${owner}: a shape needs a height: a bottom no lower than the floor, and a top higher than its bottom.`);
    }
    return { role, atMm, lengthMm, widthMm, levels: decorLevels(bottomMm, topMm, riseMm), bottomMm, topMm, ...more };
  };
  return decor.flatMap((shape): DecorBox[] => {
    const noun = shape.noun ? { noun: shape.noun } : {};
    const drawOnly = (drawn: DrawnShape) => ({ solid: false, draw: true, ...noun, shape: drawn });
    switch (shape.kind) {
      case 'slab':
        return [boxOf('footprint', shape.atMm, shape.lengthMm, shape.widthMm, shape.bottomMm, shape.topMm, { solid: shape.solid !== false, draw: true, ...noun })];
      case 'vault': {
        /*
         * A vault's solid parts only (eng D10): its two walls, from the floor
         * to where the arch springs, and its roof across the top; the passage
         * between the walls stays open.
         */
        const [x, y] = shape.atMm;
        const { lengthMm: l, widthMm: w, wallMm: t, springMm: spring, topMm: top } = shape;
        if (!(t > 0 && 2 * t < w && spring < top)) throw new Error(`${owner}: a vault needs walls thinner than half its width and a top higher than its spring.`);
        const wall = (side: 1 | -1) => boxOf('wall', [x, y + side * (w - t) / 2], l, t, 0, spring, { solid: true, draw: false, ...noun });
        return [
          wall(1),
          wall(-1),
          boxOf('roof', [x, y], l, w, spring, top, { solid: true, draw: false, ...noun }),
          boxOf('footprint', [x, y], l, w, 0, top, drawOnly(shape)),
        ];
      }
      case 'truss':
        return [boxOf('footprint', [(shape.fromMm + shape.toMm) / 2, 0], shape.toMm - shape.fromMm, 2 * shape.sideMm, shape.springMm, shape.crownMm, drawOnly(shape))];
      case 'arch':
        return [boxOf('footprint', [(shape.fromMm + shape.toMm) / 2, 0], shape.toMm - shape.fromMm, shape.widthMm, shape.baseMm, shape.baseMm + shape.riseMm + shape.depthMm, drawOnly(shape))];
      case 'towers':
        return [boxOf('footprint', [(shape.cableFromMm + shape.cableToMm) / 2, 0], shape.cableToMm - shape.cableFromMm, 2 * shape.spreadMm + shape.postMm, 0, Math.max(...shape.towers.map((t) => t.heightMm)), drawOnly(shape))];
      case 'station': {
        /*
         * A station collides as its hall, its roof, its tower and the tower's
         * cap, each a solid box at its measured size, none drawn; one more
         * box, not solid, draws the building (owner B1, eng E-A1). Every box
         * keeps the role `footprint`, so 2D draws them as it always has (X2).
         */
        const [x, y] = shape.atMm;
        const { hall, roof, tower, cap, clock } = shape;
        const at = (dx: number, dy: number): readonly [number, number] => [x + dx, y + dy];
        const bad = (why: string) => new Error(`${owner}: a station ${why}.`);
        if (!(hall.wallMm > 0 && 2 * hall.wallMm < hall.widthMm && 2 * hall.wallMm < hall.lengthMm)) throw bad('needs walls thinner than half its hall');
        for (const o of shape.openings) {
          if (!(o.fromMm < o.toMm && o.fromMm > -hall.lengthMm / 2 + hall.wallMm && o.toMm < hall.lengthMm / 2 - hall.wallMm)) throw bad('opening must lie between its end walls');
          if (!(o.topMm > hall.bottomMm && o.topMm < hall.topMm)) throw bad('opening must stop short of the top of its wall');
        }
        if (!(roof.baseMm > 0 && roof.radiusMm > 0 && 2 * roof.radiusMm <= roof.widthMm && roof.topMm >= hall.topMm + roof.radiusMm)) throw bad('roof needs a barrel no wider than the roof, under its top');
        if (!(tower.bottomMm < tower.topMm && clock.sizeMm < tower.sizeMm && clock.recessMm > 0 && clock.recessMm < tower.sizeMm / 2)) throw bad('clock must fit on its tower');
        if (!(clock.centreMm - clock.sizeMm / 2 > tower.bottomMm && clock.centreMm + clock.sizeMm / 2 < tower.topMm)) throw bad('clock must sit within its tower');
        const n = { noun: shape.noun ?? 'station building' };
        const collides = { solid: true, draw: false } as const;
        const extent = Math.max(hall.widthMm, roof.widthMm, 2 * (Math.abs(tower.atMm[1]) + Math.max(tower.sizeMm, ...cap.map((c) => c.sizeMm)) / 2));
        const top = Math.max(roof.topMm, tower.topMm, ...cap.map((c) => c.topMm));
        return [
          boxOf('footprint', at(0, 0), hall.lengthMm, hall.widthMm, hall.bottomMm, hall.topMm, { ...collides, ...n }),
          boxOf('footprint', at(0, 0), roof.lengthMm, roof.widthMm, hall.topMm, roof.topMm, { ...collides, noun: 'roof' }),
          boxOf('footprint', at(...tower.atMm), tower.sizeMm, tower.sizeMm, tower.bottomMm, tower.topMm, { ...collides, noun: 'clock tower' }),
          ...cap.map((c) => boxOf('footprint', at(...tower.atMm), c.sizeMm, c.sizeMm, c.bottomMm, c.topMm, { ...collides, noun: 'clock tower' })),
          boxOf('footprint', at(0, 0), Math.max(hall.lengthMm, roof.lengthMm), extent, hall.bottomMm, top, drawOnly(shape)),
        ];
      }
      case 'canopy': {
        /*
         * A roof collides stretch by stretch of its section (owner, elevated
         * station 2026-11-06): each stretch between two points a solid box
         * from the shell's underside to its top, the lip under the first
         * eave, none drawn; one more box, not solid, draws it. A roof high
         * over the road beside it reaches only the levels it is at.
         */
        const { alongMm: x, lengthMm: l, sectionMm: pts, thickMm: t, lipMm: lip } = shape;
        const bad = (why: string) => new Error(`${owner}: a canopy ${why}.`);
        if (pts.length < 2) throw bad('needs at least two points in its section');
        const dir = Math.sign(pts[1]![0] - pts[0]![0]);
        if (dir === 0 || !pts.every((p, i) => i === 0 || Math.sign(p[0] - pts[i - 1]![0]) === dir)) throw bad('section must run one way across, eave to eave');
        if (!(t > 0 && lip >= 0 && pts.every(([, h]) => h - t > 0))) throw bad('needs a thickness, and to stand clear of its floor');
        const n = { noun: shape.noun ?? 'roof' };
        const pieces = pts.slice(1).map((b, i) => {
          const a = pts[i]!;
          const low = Math.min(a[1], b[1]) - t - (i === 0 ? lip : 0);
          return boxOf('roof', [x, (a[0] + b[0]) / 2], l, Math.abs(b[0] - a[0]), low, Math.max(a[1], b[1]), { solid: true, draw: false, ...n });
        });
        if (!(shape.seamsMm ?? []).every((s) => Math.abs(s) < l / 2)) throw bad('seams must lie on it');
        const ys = pts.map(([y]) => y);
        const zs = pts.map(([, h]) => h);
        const low = Math.min(Math.min(...zs) - t, pts[0]![1] - t - lip);
        return [
          ...pieces,
          boxOf('roof', [x, (Math.min(...ys) + Math.max(...ys)) / 2], l, Math.max(...ys) - Math.min(...ys), low, Math.max(...zs), drawOnly(shape)),
        ];
      }
      case 'barrier': {
        /*
         * A barrier collides as its base (a square around the round base, as
         * every box is) and its post, each a solid box at its measured size,
         * none drawn; one more box, not solid, draws it, arm and all (owner,
         * detail plan 2026-11-05). The arm stays out of the way of track.
         */
        const [x, y] = shape.atMm;
        const { base, post, arm } = shape;
        const bad = (why: string) => new Error(`${owner}: a barrier ${why}.`);
        if (!(post.sizeMm < base.diameterMm && post.topMm > base.topMm && Math.abs(post.offsetMm) + post.sizeMm / 2 <= base.diameterMm / 2)) throw bad('needs a post narrower than its base, standing on it and taller');
        if (!(arm.hingeMm > base.topMm && arm.hingeMm < post.topMm)) throw bad('arm must hinge in its post');
        if (!arm.stripesMm.every((s) => s > arm.discMm / 2 && s + arm.widthMm < arm.lengthMm)) throw bad('stripes must lie on its arm');
        const collides = { solid: true, draw: false, noun: shape.noun ?? 'barrier post' } as const;
        const reach = Math.max(base.diameterMm / 2, Math.abs(post.offsetMm) + Math.max(post.sizeMm, arm.discMm) / 2);
        return [
          boxOf('footprint', [x, y], base.diameterMm, base.diameterMm, 0, base.topMm, collides),
          boxOf('footprint', [x + post.offsetMm, y], post.sizeMm, post.sizeMm, base.topMm, post.topMm, collides),
          boxOf('footprint', [x, y], 2 * reach, base.diameterMm, 0, arm.hingeMm + arm.lengthMm, drawOnly(shape)),
        ];
      }
    }
  });
}

/**
 * BUILD EACH DECORATED PIECE FROM ITS BASE (eng D2): the base part whole,
 * under the piece's own id, name and provenance, plus its decoration and
 * the boxes derived from it (eng D4). The base's catalogue number never
 * carries over (CEO D3: only a verified match has one). A missing base, a
 * shape with no height, or an id already taken is a seed error, refused
 * when the library loads.
 */
export function deriveDecorated(specs: readonly DecoratedSpec[], builtIn: readonly Part[], riseMm: number): Part[] {
  const byId = new Map(builtIn.map((p) => [p.id, p]));
  return specs.map((spec) => {
    const base = byId.get(spec.base);
    if (!base) throw new Error(`Decorated piece ${spec.id}: no built-in part ${spec.base} to take its track from.`);
    if (byId.has(spec.id)) throw new Error(`Decorated piece ${spec.id}: that id is already a built-in part.`);
    const decorBody = decorBoxesOf(`Decorated piece ${spec.id}`, spec.decor, riseMm);
    const { partNumber: _theBases, ...track } = base;
    return {
      ...track,
      id: spec.id,
      name: spec.name,
      dimensions: spec.dimensions,
      ...(spec.partNumber ? { partNumber: spec.partNumber } : {}),
      decoratedFrom: base.id,
      decor: spec.decor,
      decorBody,
      ...(spec.oneSided
        ? {
            flip: {
              label: 'Other side',
              verb: `put the ${spec.oneSided} on the other side`,
              after: `${spec.oneSided[0]!.toUpperCase()}${spec.oneSided.slice(1)} on the other side.`,
            },
          }
        : {}),
    } as Part;
  });
}

export const BUILT_IN: readonly Part[] = [...PLAIN_BUILT_IN, ...deriveDecorated(DECORATED_SEEDS, PLAIN_BUILT_IN, CLEARANCE.riseMm)];

/**
 * One submitted part. A `Part` plus the bookkeeping a shared library needs.
 *
 * `id` follows the same brand-prefixed scheme as the seeds, so a submission can
 * correct a seed by reusing its id. A brand-new piece gets a new id.
 */
export interface Submission {
  readonly part: Part;
  /** Stable across machines, so the server can dedupe without guessing. */
  readonly submissionId: string;
  /** ISO timestamp. */
  readonly at: string;
}

/**
 * Resolve the library: built-ins, then submissions, better source wins.
 *
 * The override rule is the whole reason the tiers exist. A seed says "IKEA
 * straights are about 150mm, nobody has measured one"; the moment a user
 * measures theirs, that figure replaces the seed for them, and later for
 * everyone. Equal trust keeps the newer submission, because a person
 * re-measuring their own piece is correcting themselves.
 *
 * Trust beats recency, never the other way round. A community submission cannot
 * overwrite a published Generic figure by arriving later, because one stranger's
 * word is weaker than a reference. An earlier draft of this had those two
 * reversed and a test caught it.
 *
 * NOT IMPLEMENTED, and it matters: several independent submitters agreeing
 * SHOULD outrank a single published figure, because published figures are
 * occasionally wrong and this project has already hit one. `corroborations` is
 * recorded on every submission so that comparison can be added without
 * re-modelling anything, but nothing reads it yet. Until it does, a corroborated
 * community figure is treated exactly like an uncorroborated one.
 */
/** The built-in rising parts and their rise; nothing else may rise (S1). */
const BUILT_IN_RISE = new Map(
  BUILT_IN.flatMap((p) => (p.kind === 'straight' && p.rise !== undefined ? [[p.id, p.rise] as const] : [])),
);

/**
 * THE BUILT-IN STRUCTURES (plan 2026-11-02, OV2): a part with a body or a
 * raised deck, or a block. Nothing in storage may correct one: a two-ended
 * "correction" of the station would otherwise replace it, deck, footprint and
 * roof gone, because a correction is matched by end count alone.
 */
export { isStructure };
// Decorated pieces are fixed the same way (eng O5), though they are not structures.
const BUILT_IN_STRUCTURES = new Set(BUILT_IN.filter((p) => isStructure(p) || p.decoratedFrom !== undefined).map((p) => p.id));

/** `part` with the built-in rise, or with none: a stored rise never survives, nor a body, a decoration, a deck, a plate, a truss arch or a hump (OV2, bridges eng D10). */
function withRise(part: Part, rise: 1 | undefined): Part {
  const { body: _noBody, decoratedFrom: _noBase, decor: _noDecor, decorBody: _noDecorBody, ...rest } = part;
  // A stored straight never gains an F of its own: only a multi-road piece's mirror is data (eng D8).
  const bare = (rest.kind === 'multi-road' ? rest : (({ flip: _noFlip, ...r }) => r)(rest)) as Part;
  if (bare.kind !== 'straight') return bare as Part;
  const { rise: _dropped, deck: _noDeck, deckClearanceMm: _noClear, hump: _noHump, ...flat } = bare;
  return rise === undefined ? flat : { ...flat, rise };
}

/**
 * How many ends a part has, read off the same ports the solver uses (eng
 * review D6). This was `kind === 'switch' ? 3 : 2`, which counted a
 * four-ended crossing as two and would have let a straight replace it.
 */
const endCount = (p: Part): number => portsOf(p).length;

export function resolveLibrary(submissions: readonly Submission[]): readonly Part[] {
  const byId = new Map<string, { part: Part; rank: number; at: string }>();
  for (const part of BUILT_IN) {
    byId.set(part.id, { part, rank: trustRank(part.dimensions.status), at: '' });
  }
  for (const s of submissions) {
    const rank = trustRank(s.part.dimensions.status);
    const held = byId.get(s.part.id);
    /*
     * A CORRECTION KEEPS THE PART'S ENDS. A layout's joints name ends by
     * number, so a two-ended part standing in for a switch leaves any joint
     * on the switch's third end pointing at nothing, and placement threw
     * `piece p0 has no port 2` (codex review, 2026-10-22). The form refuses
     * this; a row already in storage is refused here, and the built-in part
     * stays.
     */
    if (held && endCount(held.part) !== endCount(s.part)) continue;
    /*
     * A PART'S RISE COMES FROM THE BUILT-IN CATALOGUE ONLY (two-layer plan,
     * decision S1). A stored submission is checked field by field and passed
     * through, so a rise on one would make it a ramp; and the ramp is
     * `unverified`, so any measured correction outranks it and, without this,
     * would quietly flatten every ramp. So a submission's rise is dropped, a
     * correction of a rising part keeps the built-in rise, and one that turns
     * the ramp into another kind of piece is refused like an end-count change
     * (eng decision D5): a curved ramp is not something the engine models.
     */
    // A structure is never corrected from storage (OV2): its body and deck are built-in only.
    if (BUILT_IN_STRUCTURES.has(s.part.id)) continue;
    const rise = BUILT_IN_RISE.get(s.part.id);
    if (rise !== undefined && s.part.kind !== 'straight') continue;
    const part = withRise(s.part, rise);
    if (!held || rank < held.rank || (rank === held.rank && s.at >= held.at)) {
      byId.set(s.part.id, { part, rank, at: s.at });
    }
  }
  return [...byId.values()].map((v) => v.part);
}

/**
 * A resolver for the engine, over a resolved library.
 *
 * The engine already takes `resolve` as a parameter everywhere, so the library
 * plugs in with no change to the solver, the walkers or the feasibility checks.
 * That was worth the earlier design and is why this file adds no engine churn.
 */
export function makeResolver(parts: readonly Part[]): (id: string) => Part {
  const byId = new Map(parts.map((p) => [p.id, p]));
  return (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`unknown part id: ${id}`);
    return p;
  };
}

/** The provenance record for something this user measured themselves. */
export function userMeasured(note?: string): DimensionSource {
  return {
    status: 'user-measured',
    source: 'measured by this user',
    note,
    submittedAt: new Date().toISOString(),
    corroborations: 1,
  };
}

/*
 * Persistence. Same discipline as the chain and the inventory: anything
 * unexpected is DISCARDED rather than repaired.
 *
 * One deliberate difference. A bad chain blob costs you a layout you can rebuild
 * in a minute. A bad submission blob costs you measurements you took with
 * calipers, which you cannot. So this validates PER SUBMISSION and keeps the
 * ones that parse, rather than discarding the whole set on one bad row.
 */
/** Exported so the error boundary's repro reads the same key the app wrote. */
export const SUBMISSIONS_STORAGE_KEY = 'generic.library.submissions.v1';

/**
 * Ids starting with this are not part ids, ever (socket adapter plan, eng
 * review E2). The inventory keeps its male-male adapter count beside the part
 * counts under one such key, so a part allowed to take that name would share
 * the count and hide its own shortfall. Refused by the Add a part form and
 * dropped here on load.
 */
export const RESERVED_ID_PREFIX = '__';
const STORAGE_KEY = SUBMISSIONS_STORAGE_KEY;

function looksLikePart(v: unknown): v is Part {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) return false;
  // Reserved for non-part keys (RESERVED_ID_PREFIX); counted as a dropped row.
  if (p.id.startsWith(RESERVED_ID_PREFIX)) return false;
  if (typeof p.brand !== 'string') return false;
  if (p.kind !== 'straight' && p.kind !== 'curve') return false;
  if (typeof p.dimensions !== 'object' || p.dimensions === null) return false;
  /*
   * THE PROVENANCE IS VALIDATED, not just the shape. Without this a stored
   * submission with `dimensions: {}` reached `trustRank`, which returned -1 and
   * outranked every published figure in the catalogue. The two halves are
   * independent on purpose: this rejects the row, and `trustRank` failing
   * closed means a second caller cannot reintroduce the inversion.
   */
  const dims = p.dimensions as Record<string, unknown>;
  if (!DIMENSION_TRUST.includes(dims.status as DimensionStatus)) return false;
  if (typeof dims.source !== 'string') return false;
  /*
   * `ends` and `slop` are dereferenced unconditionally by the engine
   * (`portPolarity` reads part.ends.start; the solver reads part.slop.axialMm),
   * so a row missing either is an app-wide crash on load rather than a dropped
   * row -- the opposite of what this file promises.
   */
  const ends = p.ends as Record<string, unknown> | undefined;
  if (!ends || (ends.start !== 'peg' && ends.start !== 'socket')) return false;
  if (ends.end !== 'peg' && ends.end !== 'socket') return false;
  const slop = p.slop as Record<string, unknown> | undefined;
  /*
   * SLOP IS BOUNDED, AND ITS CALIBRATION STATUS IS NOT SELF-ASSERTED
   * (finding B2, the most serious of the adversarial pass).
   *
   * `calibrationStatus` went unvalidated entirely, and `trust.ts`'s rule 4
   * reads `parts.some((p) => p.slop.calibrationStatus !== 'measured')` with a
   * comment saying it is always true today and "must stay true in EVERY
   * verdict state". MEASURED: a stored row claiming
   * `calibrationStatus: 'measured'` with `axialMm: 999` was accepted here, and
   * the `estimated-give` caveat -- the one that says the give total and any
   * verdict resting on it are provisional -- DISAPPEARED from the trust
   * register. 999mm of give also makes every layout "might fit", which
   * switches off the one definite claim the engine exists to make: that a gap
   * exceeding the give definitely will not fit. A confidently wrong verdict
   * with no visible qualification is worse than a crash.
   *
   * `SubmitPart.tsx:88` hardcodes `'estimated'`, so nothing the app writes can
   * ever carry `'measured'`. A stored row that does was not produced by this
   * app.
   *
   * COERCED, NOT REFUSED. The first version of this fix dropped the whole row,
   * which contradicted the priority stated at the top of this section: a
   * submission's dimensions are measurements somebody took with calipers, and
   * destroying them to reject a self-asserted calibration flag throws away the
   * data to punish the claim. `loadSubmissionsResult` now forces every stored
   * row to `'estimated'`, so rule 4's invariant holds BY CONSTRUCTION -- no
   * stored row can ever read `'measured'` -- and the user keeps the figures
   * they measured. The status is only validated for shape here.
   *
   * THE CEILING IS NEAR THE REAL FIGURE, not two orders of magnitude above it.
   *
   * The first version of this fix used 50mm and 45 degrees, reasoning that the
   * harm needed something absurd like 999mm. MEASURED: it does not. On eight
   * large curves plus one straight -- a ring with a 216mm gap and no clashes --
   * a stored row at exactly 50mm per joint gives 450mm of total give across 9
   * joints, and the verdict goes from EXCEEDS (`withinBound: false`, a definite
   * "this will not fit") to NEEDS_GIVE (`withinBound: true`, a "this might").
   * The ceiling as chosen permitted the exact harm the paragraph above
   * describes, which is the third invariant: a failed check must never be
   * styled as a pass.
   *
   * 5mm and 5 degrees are about 6x and 3x the published figures (0.8mm axial,
   * 1.5 degrees in `generic.ts`). A Generic joint's real slop is sub-millimetre, so
   * this is already generous for somebody measuring their own worn track, and
   * 5mm across 9 joints is 45mm against that 216mm gap.
   *
   * It is a plausibility bound, NOT a guarantee. Give scales with joint count,
   * so a large enough layout of legitimate-looking rows can still soften a
   * definite claim; that is filed as the P2 on provenance rather than pretended
   * away with a constant. What keeps the verdict honest meanwhile is the
   * `calibrationStatus` refusal below: `estimated-give` always fires, so the
   * user is always told the give is a guess.
   */
  const SLOP_CEILING_MM = 5;
  const SLOP_CEILING_DEG = 5;
  const bounded = (x: unknown, ceiling: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= ceiling;
  if (!slop) return false;
  if (!bounded(slop.axialMm, SLOP_CEILING_MM)) return false;
  if (!bounded(slop.angularDeg, SLOP_CEILING_DEG)) return false;
  if (typeof slop.calibrationStatus !== 'string') return false;
  const finite = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;
  if (!finite(p.gaugeWidthMm) || !finite(p.plankWidthMm) || !finite(p.plankThicknessMm)) return false;
  if (p.kind === 'straight') return finite(p.lengthMm);
  if (!finite(p.innerRadiusMm)) return false;
  if (typeof p.arcSteps !== 'number' || !Number.isInteger(p.arcSteps)) return false;
  /*
   * A CURVE TURNS SOME OF THE WAY ROUND, so its arc is 1..15 of the 16
   * headings. This checked only that the value was an integer, which let a
   * submission declare a 360 degree "curve": MEASURED, `arcSteps` of 0, 16,
   * 32 or -16 all give displacement exactly ZERO and heading 0, so the piece
   * occupies no length and makes no turn, and a chain of them puts every
   * port of every piece on one lattice point. Bounded the same way `slop` is
   * a few lines up, because a value this engine could not have written
   * belongs refused rather than drawn.
   */
  return p.arcSteps >= 1 && p.arcSteps <= 15;
}

/**
 * What `loadSubmissionsResult` returns.
 *
 * `dropped` EXISTS SO THE LOSS CAN BE SHOWN. Before it, every drop here was a
 * bare `continue`: the row vanished, `App.tsx` had no notice for it, so
 * `savesSuppressed` saw no loss and the mount effect wrote the survivors
 * straight over the stored bytes. The scenario the save gate was written for
 * was the one scenario it could not see, because the loss never reached it.
 *
 * It matters most for exactly this loader. A dropped layout is a minute of
 * clicking; the comment at the top of this section says a dropped submission
 * "costs you measurements you took with calipers, which you cannot" recreate.
 */
export interface SubmissionsLoadResult {
  readonly value: readonly Submission[];
  /** How many stored rows were refused. Zero on a clean load. */
  readonly dropped: number;
  /** Set when the whole blob was unreadable, as opposed to some rows. */
  readonly discarded?: string;
}

/**
 * THE PER-ROW FILTER, ONE COPY (generic-TODOS.md P2, "The crash repro can
 * report a failure the app cannot produce"). The app's load and the crash
 * repro both run stored rows through this, so a repro never resolves rows the
 * app dropped, or drops rows the app kept. `droppedAt` is each refused row's
 * index, so the repro can name them.
 */
export function readSubmissionRows(parsed: readonly unknown[]): { readonly value: Submission[]; readonly droppedAt: number[] } {
  const out: Submission[] = [];
  const droppedAt: number[] = [];
  for (const [i, item] of parsed.entries()) {
    if (typeof item !== 'object' || item === null) {
      droppedAt.push(i);
      continue;
    }
    const s = item as Record<string, unknown>;
    if (typeof s.submissionId !== 'string' || typeof s.at !== 'string') {
      droppedAt.push(i);
      continue;
    }
    if (!looksLikePart(s.part)) {
      droppedAt.push(i);
      continue;
    }
    /*
     * THE ONE FIELD A STORED ROW DOES NOT GET TO ASSERT.
     *
     * `trust.ts` rule 4 emits the `estimated-give` caveat only while some
     * part reads other than `'measured'`, and its comment says that must
     * stay true in every verdict state. Forcing it here makes that true by
     * construction: no row that came out of storage can claim its give was
     * measured, whatever the bytes said, and the row's dimensions survive.
     */
    out.push({
      part: { ...s.part, slop: { ...s.part.slop, calibrationStatus: 'estimated' } },
      submissionId: s.submissionId,
      at: s.at,
    });
  }
  return { value: out, droppedAt };
}

export function loadSubmissionsResult(): SubmissionsLoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { value: [], dropped: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        value: [],
        dropped: 0,
        discarded:
          'Your submitted part measurements could not be read, so none of them ' +
          'were loaded. The original is kept until you dismiss this.',
      };
    }
    const rows = readSubmissionRows(parsed);
    return { value: rows.value, dropped: rows.droppedAt.length };
  } catch {
    return {
      value: [],
      dropped: 0,
      discarded:
        'Your submitted part measurements could not be read, so none of them ' +
        'were loaded. The original is kept until you dismiss this.',
    };
  }
}

/** The sentence shown when some rows were refused and the rest were kept. */
export function droppedSubmissionsNotice(kept: number, dropped: number): string {
  const rows = dropped === 1 ? '1 saved measurement' : `${dropped} saved measurements`;
  const was = dropped === 1 ? 'was' : 'were';
  const rest =
    kept === 0
      ? 'Nothing was loaded.'
      : `The other ${kept === 1 ? 'one' : kept} loaded normally.`;
  return (
    `${rows} ${was} in a format this version does not accept, so ${dropped === 1 ? 'it' : 'they'} ` +
    `${dropped === 1 ? 'was' : 'were'} not loaded. ${rest} ` +
    'Nothing is saved over them until you dismiss this.'
  );
}

/** Kept for callers that do not care why rows are missing. */
export function loadSubmissions(): readonly Submission[] {
  return loadSubmissionsResult().value;
}

/** Whether the browser stored them. The caller says so when it did not (see saveNotice.ts). */
export function saveSubmissions(subs: readonly Submission[]): boolean {
  // Private browsing and full quotas both fail. Losing persistence is not
  // worth losing the session over, but unlike the chain this IS data the user
  // cannot trivially recreate, so the caller surfaces the failure.
  return stored(write(STORAGE_KEY, JSON.stringify(subs)));
}

/** Stable enough to dedupe on a server without coordinating ids. */
export function newSubmissionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `sub-${Date.now().toString(36)}-${rand}`;
}
