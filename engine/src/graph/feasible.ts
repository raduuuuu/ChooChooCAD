/**
 * FEASIBILITY, LIFTED TO VERTICES (task T9).
 *
 * The chain version of these predicates carried two exclusion rules:
 * `b - a === 1` and, for a closed layout, the `(0, n)` and `(0, n-1)` seam.
 * They were not geometry. They existed because the chain had no way to say
 * "these two connectors are JOINED" as distinct from "these two connectors
 * are in the same place", so consecutive pieces and the closing seam had to
 * be excluded by index or every layout would report itself as a pile-up.
 *
 * A graph says it in the data: a weld is a declared join. So the exclusions
 * are deleted, and with them the thing they cost, which was that any OTHER
 * pair the rules happened to cover was silently exempt too.
 *
 * The two predicates become:
 *
 *   OVERLAP   no two DISTINCT vertices occupy the same position. A vertex is
 *             a set of ports tied together by welds, so a declared join is
 *             one vertex and can never report itself.
 *   POLARITY  a property of each weld. Peg against socket is a joint. Peg
 *             against peg cannot be built. Socket against socket is buildable
 *             with a male-male adapter, which adds no length (owner, 2026-10-23),
 *             so it is reported as an ADAPTER joint, not a violation. A
 *             switch's heel is a peg or a socket like any end, so it is
 *             checked too.
 */

import { type Cyc, equals, toXY } from '../geom/cyclotomic.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import { norm16, portPolarity, type Frame, type Graph, type PortRef } from './model.js';
import type { Polarity } from '../parts/schema.js';
import type { Part } from '../parts/schema.js';

/** Two separate places on the track asked to be the same place. */
export interface VertexClash {
  readonly a: { readonly pieceId: string; readonly port: number };
  readonly b: { readonly pieceId: string; readonly port: number };
  readonly at: [number, number];
}

export interface WeldPolarityViolation {
  readonly weld: number;
  readonly between: readonly [string, string];
  /** Always 'peg' since socket-to-socket became an adapter joint; kept as the polarity met. */
  readonly polarity: 'peg' | 'socket';
}

/** A weld where two sockets meet: buildable with a male-male adapter. */
export interface AdapterJoint {
  readonly weld: number;
  readonly between: readonly [string, string];
}

/**
 * Ports a weld already claims. A port nobody has welded is FREE.
 *
 * The distinction decides whether two ends in one place are a problem or an
 * invitation, which is the difference between the two cases below.
 */
function claimedPorts(graph: Graph): ReadonlySet<string> {
  const out = new Set<string>();
  for (const w of graph.welds) {
    out.add(`${w.a.pieceId}#${w.a.port}`);
    out.add(`${w.b.pieceId}#${w.b.port}`);
  }
  return out;
}

/** Union-find over ports, joined by welds. One set is one vertex. */
function vertices(graph: Graph): (key: string) => string {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (p === undefined || p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (x: string, y: string) => {
    const a = find(x);
    const b = find(y);
    if (a !== b) parent.set(a, b);
  };
  for (const w of graph.welds) {
    union(`${w.a.pieceId}#${w.a.port}`, `${w.b.pieceId}#${w.b.port}`);
  }
  return find;
}

/**
 * A position's identity as a grouping key: its eight coefficients, exactly.
 *
 * NAMED, AND IN ONE PLACE, BECAUSE NO TEST CAN CATCH THE WRONG CHOICE HERE.
 * Keying on `toXY(pos)` instead -- the float projection, which is what a
 * "spatial grid" usually means -- leaves the whole suite green, verified by
 * running it. No fixture in the suite has two distinct lattice points that collide
 * under the float projection, and constructing one needs coefficients large
 * enough for double spacing to swallow their difference. So the rule that
 * keeps this sound is not enforced from outside; it is enforced by this
 * function being the only place the question is asked.
 *
 * Sound because a position is eight INTEGERS in a fixed basis and `equals` is
 * `isZero(sub(a, b))`: joining can neither merge two different elements nor
 * split one. `-0` keys as `"0"` and `-0 === 0`, so it matches what `equals`
 * does with it. Decision f333f98f says the replacement for the all-pairs scan
 * must key on "the exact lattice position, never a tolerance" -- this is that
 * sentence, as code.
 */
function latticeKey(pos: Cyc): string {
  return pos.join(',');
}

/** One placed connector: where it is, which way it faces, and what it is. */
export interface PlacedPort {
  readonly pieceId: string;
  readonly port: number;
  /** Its weld group (union-find over welds): ports joined together share one. */
  readonly vertex: string;
  /** True when no weld claims it. */
  readonly free: boolean;
  readonly pos: Cyc;
  /** The way the end points, OUT of its piece, in sixteenths of a turn. */
  readonly heading: number;
  readonly polarity: Polarity;
}

/** Every placed connector, and the indices of those at each exact lattice point. */
export interface ConnectorSites {
  readonly placed: readonly PlacedPort[];
  readonly at: ReadonlyMap<string, readonly number[]>;
}

/**
 * WHICH ENDS SIT AT EACH EXACT SPOT, for every caller that asks (eng decision
 * D2 of the 2026-10-22 editing plan, ENG-R1).
 *
 * The verdict's clash check, the preview's fit check, the drop guard and
 * auto-join all need full membership per place, keyed the same exact way. Two
 * copies of this grouping in app code could disagree with the verdict about
 * what shares a spot; one engine function cannot. Full membership matters:
 * the clash records keep only representatives, so a third piece landing on a
 * pile was invisible to a filter over them (Codex, OV3).
 */
export function connectorSites(graph: Graph, ports: PortsOf, placement: Placement): ConnectorSites {
  const find = vertices(graph);
  const claimed = claimedPorts(graph);
  const placed: PlacedPort[] = [];
  for (const piece of graph.pieces) {
    const own = ports(piece);
    for (let i = 0; i < own.length; i++) {
      const key = `${piece.pieceId}#${i}`;
      const frame = portFrame(placement, ports, piece, i);
      placed.push({
        pieceId: piece.pieceId,
        port: i,
        vertex: find(key),
        free: !claimed.has(key),
        pos: frame.pos,
        heading: frame.heading,
        polarity: own[i]!.polarity,
      });
    }
  }
  const at = new Map<string, number[]>();
  for (let i = 0; i < placed.length; i++) {
    const key = latticeKey(placed[i]!.pos);
    const group = at.get(key);
    if (group) group.push(i);
    else at.set(key, [i]);
  }
  return { placed, at };
}

/**
 * What a new end would meet if it landed at `frame` (decisions E1, D13/D20,
 * and the drop guard).
 *
 * - `clear`: nothing is there.
 * - `joins`: exactly one other end is there, free, of the opposite kind, and
 *   FACING it (its heading is this one's turned half round). That is a real
 *   joint, so Place or a drop may weld it (D20 added the facing condition:
 *   a peg meeting a socket at a right angle would rotate a piece if welded).
 * - `conflict`: anything else: an end already joined, two or more ends, the
 *   same kind meeting, or ends that do not face each other.
 *
 * `ignore` skips the moved or previewed pieces' own ends.
 */
export type Landing =
  | { readonly kind: 'clear' }
  /** `adapter`: two sockets meet, joined with a male-male adapter. Absent is a plain joint. */
  | { readonly kind: 'joins'; readonly with: PortRef; readonly adapter?: true }
  | {
      readonly kind: 'conflict';
      readonly reason: 'crowded' | 'polarity' | 'facing';
      readonly with: readonly PortRef[];
    };

export function landingOf(
  sites: ConnectorSites,
  frame: Frame,
  polarity: Polarity,
  ignore: ReadonlySet<string> = new Set(),
): Landing {
  const here = (sites.at.get(latticeKey(frame.pos)) ?? [])
    .map((i) => sites.placed[i]!)
    .filter((p) => !ignore.has(p.pieceId));
  if (here.length === 0) return { kind: 'clear' };
  const refs = here.map((p) => ({ pieceId: p.pieceId, port: p.port }));
  const only = here.length === 1 ? here[0]! : null;
  if (only === null || !only.free) return { kind: 'conflict', reason: 'crowded', with: refs };
  /*
   * Pegs keep the old order: peg on peg is a polarity conflict whether or not
   * it faces, so every peg refusal keeps its wording. Sockets check facing
   * first, because a facing socket pair is a real joint with an adapter.
   */
  if (only.polarity === polarity && polarity === 'peg') {
    return { kind: 'conflict', reason: 'polarity', with: refs };
  }
  if (only.heading !== norm16(frame.heading + 8)) return { kind: 'conflict', reason: 'facing', with: refs };
  if (only.polarity === polarity) return { kind: 'joins', with: refs[0]!, adapter: true };
  return { kind: 'joins', with: refs[0]! };
}

/**
 * Ports that land on the same spot without being welded there.
 *
 * Exact equality in Z[zeta16], no epsilon: two connectors either occupy the
 * same lattice point or they do not. This is a FEASIBILITY fact and never a
 * connectivity one, which is the distinction the chain engine could not draw.
 */
export function findVertexClashes(
  graph: Graph,
  ports: PortsOf,
  placement: Placement,
): readonly VertexClash[] {
  const { placed, at } = connectorSites(graph, ports, placement);

  /*
   * GROUPED BY EXACT POSITION, which is decision f333f98f's own prescribed
   * replacement for the all-pairs comparison this used to do.
   *
   * The old loop compared every port against every other and threw away
   * 99.99% of the pairs on `!equals(a.pos, b.pos)`. Its shortcut note said to
   * upgrade "when a layout exceeds roughly 500 ports", which nothing
   * enforced: MEASURED on 20 clean rings of ordinary straights, every port
   * claimed once and no duplicate welds, so no guard anywhere objects --
   *
   *     1,000 pieces     85ms
   *     5,000 pieces   2,221ms
   *    10,000 pieces   8,337ms   (a 1MB stored layout, verdict "ok")
   *
   * -- and a freeze is not a throw, so `ErrorBoundary` never fired and the
   * key was never cleared. That is the same uncatchable hang the cycle
   * enumeration used to cause, one function upstream of every bound that was
   * added to stop it: this runs BEFORE the rank ceiling and before
   * `analyseCycles`, on every branch including `rank === 0`.
   *
   * A lattice position is an exact 8-integer tuple, so grouping on it needs
   * no tolerance and no grid resolution to tune -- `join` is sound as a key
   * precisely because `equals` is `isZero(sub(a, b))` over integers.
   *
   * GROUPING ALONE WAS NOT ENOUGH, and the paragraph that used to sit here
   * said so correctly: when ports COINCIDE the group is the whole layout, so
   * a pair walk inside the group is quadratic again. It then went on to say
   * that no spec measures it and that the case was work proportional to the
   * answer. Both are now false, and the fix is 150 lines below rather than
   * outstanding: the rule is counted per PIECE, there is no pair walk left to
   * be quadratic, and three timed specs cover the coincident case. The
   * before-and-after measurements live once, in the block at `clashes`.
   */
  /*
   * HOW THE COUNT GOT HERE: ports, then pairs of vertices, now places.
   *
   * The first version counted ports and the number it produced was wrong in
   * the way that matters: the 16xE double circle reported "32 pairs of track
   * ends land in exactly the same spot" when there are EIGHT such spots. At
   * each one sit two vertices of two ports each, which is four port-pairs,
   * so the count was inflated fourfold while the canvas drew eight markers.
   * The verdict and the picture disagreed, and the verdict was the wrong one.
   *
   * A vertex is the thing a user sees as "a join". Two of them in one place
   * is one problem to fix, however many connectors that involves.
   */
  const clashes: VertexClash[] = [];
  /*
   * ONE RECORD PER PLACE, AND NO PAIR ENUMERATION ANYWHERE.
   *
   * It used to emit one record per PAIR of vertices in a place, which is
   * C(k,2) when k of them land together -- and grouping by position did not
   * help, because when ports coincide the group IS the layout. Reachable by
   * clicking one palette button: `E` turns 45 degrees, so eight close a
   * circle and an open run laps the same EIGHT places. At a few thousand
   * pieces that was seconds and millions of records, and at 16,384 it was a
   * renderer OOM inside a render `useMemo` -- not a catchable throw, so
   * nothing cleared the storage key and every reload repeated it.
   *
   * The before-and-after figures live ONCE, in the `MEASURED` block further
   * down this comment. They used to be restated here as well, and the two
   * copies disagreed with each other on the record count -- which is the
   * whole reason this comment now cites rather than repeats.
   *
   * THE SAME PLACES ARE REPORTED, by reformulating the rule rather than
   * changing it. The old walk reported a place when EITHER some vertex there
   * was welded, OR some pair of pieces had free vertices in two or more
   * places -- the "two pieces lying on top of each other share BOTH of their
   * ends" rule. The second half is what cost C(k,2): it accumulated per pair
   * of PIECES.
   *
   * It does not need pairs. Two pieces share two all-free places exactly when
   * both of them SPAN that same pair of places, and a piece has two ports, so
   * it spans at most one pair. Counting per piece instead of per pair gives
   * the identical answer in one linear pass: for each piece, take the pair of
   * all-free places its ports sit in, and if two pieces ever name the same
   * pair, both of those places are a pile-up.
   *
   * A first attempt reported any place holding three or more vertices
   * outright, reading the note below's "a third thing landing on it is a
   * clash" as covering loose ends too. MEASURED over 1,023 fixtures, that
   * flipped 84 layouts from fine to impossible -- three loose ends meeting at
   * one point, which the product calls an invitation. Rejected: turning a
   * passing layout into a failure is the same invariant as the reverse, and
   * this reformulation needs no such decision.
   *
   * VERIFIED IDENTICAL OVER THE FIXTURES, AND A SUPERSET IN GENERAL. Against
   * the previous implementation over 1,088 fixtures -- every catalogue part at
   * both turns as chains and loops of 3/4/8/9/16/17/24 pieces, 700 random
   * soups, lapped runs of 9/17/33/64 of every part, piles of 2..60 loose
   * unanchored pieces, mixed-part piles, the 16xE double circle and the 8L8R
   * tangent pair: the set of reported PLACES is identical in all 1,088, and
   * no layout changes verdict.
   *
   * "Identical in all 1,088" was for a while the whole claim, and it was the
   * corpus mistaken for the general case. The two sets are NOT equal in
   * general: the new one is a strict SUPERSET. The old rule deduped on the
   * vertex PAIR across the whole layout, so when the SAME two vertices
   * coincided at two distinct places it reported only the first. A piece
   * whose own two ends are welded together is one vertex at two positions, so
   * two such pieces stacked coincide twice -- MEASURED: two unanchored
   * self-welded `A` straights report 2 places here (`0,0` and `144,0`) and
   * reported 1 before. The corpus has no self-weld, which is why 1,088
   * fixtures agreed. `graphFeasible.test.ts` now carries that blob as a
   * fixture so the divergence is pinned rather than rediscovered.
   *
   * The direction is always this way round, never the reverse, and that is
   * what matters: the old rule had already reported ONE place of the pair, so
   * the verdict was IMPOSSIBLE before and is IMPOSSIBLE after. No layout
   * passes that used to fail, and none fails that used to pass; only the
   * count rises, and the extra marker is drawn where something really is.
   *
   * WHAT DOES CHANGE is the COUNT: places, not vertex pairs. That is forced,
   * because a place can hold n vertices and C(n,2) is quadratic in the input.
   * It is also the right number. `clashMarkers` already dedupes to one marker
   * per place, and over 582 of those fixtures the old count disagreed with
   * the markers drawn in 142 of the 241 that clash at all. This is the same
   * defect the HOW THE COUNT GOT HERE block above records being half-fixed
   * once already, told once there rather than twice in one function.
   *
   * MEASURED after, on the shapes above:
   *
   *   lapped E, 8,000 pieces   5907ms -> 29ms, 3,996,999 records -> 8
   *   pile,     2,000 pieces   4922ms -> 16ms, 3,998,000 records -> 2
   *
   * and `solveGraph` end to end on the 8,000-piece lapped run is 63ms.
   *
   * THAT NUMBER IS ABOUT THE ENGINE, NOT ABOUT THE TAB, and reading it as
   * "the tab is fine" is the mistake this comment used to invite. The freeze
   * this function caused is gone; the freeze has moved one layer out, into
   * the render that consumes the result in the same synchronous pass.
   * MEASURED on 120,000 loose straights -- a 3.72M-char blob, inside a ~5MB
   * quota, which `loadGraph` accepts with nothing discarded: the whole engine
   * is 576ms and `TrackCanvas` alone is 3,153ms for 1.2M SVG elements, and
   * that is `renderToStaticMarkup`, which is a FLOOR for what the browser
   * then does. Filed as its own P0 in `docs/plan/brio-TODOS.md`; it is not
   * this function's problem any more, which is exactly why it needs saying
   * here, next to the figure someone would otherwise quote.
   */

  /** Places holding two or more distinct vertices, in discovery order. */
  const sites: Array<{
    readonly key: string;
    readonly clash: VertexClash;
    /** Some vertex here is welded, which is a clash on its own. */
    readonly welded: boolean;
    /** ONE piece has two or more free ends here, which is a clash on its own. */
    readonly selfPileUp: boolean;
    /** Pieces with a FREE end here, when two or more of them meet. */
    readonly freePieces: readonly string[];
  }> = [];

  for (const [key, idxs] of at) {
    if (idxs.length < 2) continue;

    // The distinct vertices here, each remembered by its first port. One
    // vertex is a DECLARED joint, not a collision.
    const byVertex = new Map<string, number>();
    for (const i of idxs) {
      const v = placed[i]!.vertex;
      if (!byVertex.has(v)) byVertex.set(v, i);
    }
    if (byVertex.size < 2) continue;

    const reps = [...byVertex.values()].sort((x, y) => x - y);
    const a = placed[reps[0]!]!;
    const b = placed[reps[1]!]!;
    /*
     * FAILS CLOSED. This is an assertion of the grouping, not a filter: `at`
     * already guarantees it.
     *
     * It used to be `continue`, which was the wrong direction for the one
     * function whose job is finding reasons a layout cannot be built. A
     * `continue` drops the WHOLE site, including the welded clash below,
     * which does not depend on the grouping at all -- so a broken key would
     * have turned a real overlap into a silent pass. A throw from render is
     * caught by `ErrorBoundary` and shown to someone; a dropped clash is a
     * green verdict on a layout that cannot be built.
     *
     * `latticeKey` and `equals` agree on every input except NaN, which is
     * also the only input that can fire this, so in practice this says: a
     * coordinate stopped being a number.
     */
    if (!equals(a.pos, b.pos)) {
      throw new Error(
        'findVertexClashes: positions grouped under one lattice key are not equal; a coordinate is not a number',
      );
    }

    const [x, y] = toXY(a.pos);
    const clash: VertexClash = {
      a: { pieceId: a.pieceId, port: a.port },
      b: { pieceId: b.pieceId, port: b.port },
      at: [x, y],
    };

    /*
     * TWO INDEPENDENT QUESTIONS ABOUT ONE PLACE, and conflating them lost 30
     * places on the first attempt. A place can hold a welded vertex AND two
     * or more free ones, and the old pair walk treated each PAIR separately:
     * the pairs touching the welded vertex became clashes, while the
     * free-free pairs there still counted toward the pile-up. So a place is
     * reported for being welded, and ALSO contributes its free pieces.
     *
     * Free-ness is read off the VERTEX, which is sound: a port is claimed
     * exactly when a weld names it, and welds are what the union-find joins,
     * so a vertex holding two or more ports is always welded and a vertex
     * holding one is always free.
     */
    const freeReps = reps.filter((i) => placed[i]!.free);
    /*
     * A PIECE WITH TWO FREE ENDS IN ONE PLACE IS A PILE-UP BY ITSELF, and
     * this is the one corner where the per-piece reformulation could report
     * LESS than the rule it replaced.
     *
     * The span rule asks each piece for the PAIR of places it spans. A piece
     * whose two free ends sit in the same place names no pair, so it dropped
     * out of its own pile-up: with a zero-extent part lying on an `A`
     * straight, 1,120 places went missing over 3,000 generated graphs and 538
     * flipped from "has a clash" to NO_CYCLE -- the overlap gone from the
     * sentence AND from the canvas. A false pass, the one direction that is
     * never acceptable here.
     *
     * UNREACHABLE TODAY, and only by accident: `looksLikePart` admits only
     * `straight` and `curve`, requires `lengthMm > 0`, and bounds `arcSteps`
     * to 1..15 -- a check this same change added for an unrelated reason --
     * and no catalogue part has two ports at one local position. `PortsOf` is
     * an engine seam the suite already drives with other port counts, and
     * nothing here asserted that the ports of one piece are distinct.
     *
     * Counted, not thrown: a throw would refuse the layout instead of
     * reporting it. Counted here, not in the span rule, because the span rule
     * cannot see a pair that does not exist. This only ADDS a report, and
     * only in a case no stored layout can currently reach, so no answer
     * reachable today changes.
     */
    const freeByPiece = new Map<string, number>();
    for (const i of freeReps) {
      const id = placed[i]!.pieceId;
      freeByPiece.set(id, (freeByPiece.get(id) ?? 0) + 1);
    }
    let selfPileUp = false;
    for (const n of freeByPiece.values()) if (n >= 2) selfPileUp = true;
    sites.push({
      key,
      clash,
      selfPileUp,
      welded: freeReps.length < reps.length,
      // Only two or more free vertices here form a free-free pair, which is
      // what the pile-up rule counts.
      freePieces:
        /*
         * `>= 2` is REDUNDANT WITH THE PILE-UP RULE, not a threshold that
         * decides anything, and saying so is worth four lines because a
         * reader will otherwise try to tune it. A pair of places is piled up
         * only when TWO distinct pieces have free ends at BOTH of them, which
         * already forces two free vertices at each. So relaxing this to `>= 1`
         * changes no output: MEASURED over 40,000 generated layouts, 3,357 of
         * them clashing, zero differences in the reported place set. It stays
         * because it skips building an array that cannot be used.
         */
        freeReps.length >= 2 ? [...new Set(freeReps.map((i) => placed[i]!.pieceId))] : [],
    });
  }

  /*
   * A welded end is spoken for: a third thing landing on it is a clash
   * however few places are shared. That case never reaches the pile-up count
   * below, exactly as it never reached the old pair accumulation.
   */
  const reportedPlaces = new Set<string>();
  for (const site of sites) {
    if (site.welded || site.selfPileUp) {
      clashes.push(site.clash);
      reportedPlaces.add(site.key);
    }
  }

  /*
   * TWO FREE ENDS MEETING AT ONE POINT ARE NOT A CLASH. They are the moment
   * before you join them, and it is the single most common state in building
   * track: eight large curves laid end to end bring their two loose ends
   * together, and the next thing anybody does is push them into each other.
   *
   * Reporting that as "can't be built" was a real defect, found by a user
   * doing exactly this. It arrived when clashes were made to outrank
   * NO_CYCLE so two overlapping RUNS would stop being silent; that fix was
   * right, and this is the other half of it.
   *
   * COUNT DISCRIMINATES. Two pieces that meet share exactly ONE point. Two
   * pieces lying on top of each other share BOTH of their ends, and that is
   * not an invitation, it is a pile-up: no weld makes their middles stop
   * overlapping. So a single shared point between a pair of pieces is excused
   * and two or more are reported.
   *
   * COUNTED PER PIECE, NOT PER PAIR, which is what makes it linear. Two
   * pieces share two all-free places exactly when both SPAN the same pair of
   * places, so each piece names the pair its own free ends sit in and a pair
   * named twice is a pile-up. Identical answer, one pass.
   *
   * This is an endpoint test, not a body test. Pieces that cross mid-span
   * are found by `overlap.ts`, which exempts pairs already caught here.
   */
  const placesOfPiece = new Map<string, string[]>();
  for (const site of sites) {
    for (const pieceId of site.freePieces) {
      const list = placesOfPiece.get(pieceId);
      if (list) list.push(site.key);
      else placesOfPiece.set(pieceId, [site.key]);
    }
  }
  const spanCount = new Map<string, number>();
  for (const keys of placesOfPiece.values()) {
    // Two ports per piece on this catalogue, so at most one pair; written as
    // a loop so a part with a third port cannot quietly fall through it.
    const sorted = [...new Set(keys)].sort();
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const pairKey = `${sorted[i]!}~${sorted[j]!}`;
        spanCount.set(pairKey, (spanCount.get(pairKey) ?? 0) + 1);
      }
  }
  const piledUp = new Set<string>();
  for (const [pairKey, n] of spanCount) {
    if (n < 2) continue;
    const sep = pairKey.lastIndexOf('~');
    piledUp.add(pairKey.slice(0, sep));
    piledUp.add(pairKey.slice(sep + 1));
  }
  // Emitted in discovery order, so the array reads the way the old one did,
  // and never twice for one place.
  for (const site of sites) {
    if (piledUp.has(site.key) && !reportedPlaces.has(site.key)) {
      clashes.push(site.clash);
      reportedPlaces.add(site.key);
    }
  }

  return clashes;
}

/**
 * Every weld whose two ends are of the same kind, sorted in ONE pass: pegs
 * into `violations`, sockets into `adapters` (eng review E1). One read per
 * weld is what makes the two lists disjoint and complete by construction; two
 * loops reading the same ports could drift apart.
 */
export function classifyWelds(
  graph: Graph,
  resolve: (id: string) => Part,
  ports: PortsOf,
): { readonly violations: readonly WeldPolarityViolation[]; readonly adapters: readonly AdapterJoint[] } {
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const violations: WeldPolarityViolation[] = [];
  const adapters: AdapterJoint[] = [];
  graph.welds.forEach((w, index) => {
    const pieceA = byId.get(w.a.pieceId);
    const pieceB = byId.get(w.b.pieceId);
    if (!pieceA || !pieceB) return;
    const portA = ports(pieceA)[w.a.port];
    const portB = ports(pieceB)[w.b.port];
    if (!portA || !portB) return;
    const pa = portPolarity(resolve(pieceA.partId), w.a.port);
    const pb = portPolarity(resolve(pieceB.partId), w.b.port);
    if (pa !== pb) return;
    const between = [pieceA.partId, pieceB.partId] as const;
    if (pa === 'socket') adapters.push({ weld: index, between });
    else violations.push({ weld: index, between, polarity: pa });
  });
  return { violations, adapters };
}

/** Welds that put two pegs together: the joints that cannot be built. */
export function findWeldPolarityViolations(
  graph: Graph,
  resolve: (id: string) => Part,
  ports: PortsOf,
): readonly WeldPolarityViolation[] {
  return classifyWelds(graph, resolve, ports).violations;
}
