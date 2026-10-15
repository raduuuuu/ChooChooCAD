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
 *   POLARITY  a property of each weld, peg against socket, with heels exempt
 *             because a heel is neither (T8).
 */

import { type Cyc, equals, toXY } from '../geom/cyclotomic.js';
import { portFrame, type Placement, type PortsOf } from './frames.js';
import { portPolarity, weldHasPolarity, type Graph } from './model.js';
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
  readonly polarity: 'peg' | 'socket';
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
 * "spatial grid" usually means -- passes all 428 specs, verified by running
 * it. No fixture in the suite has two distinct lattice points that collide
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
  const find = vertices(graph);
  const claimed = claimedPorts(graph);
  const placed: Array<{
    pieceId: string;
    port: number;
    vertex: string;
    free: boolean;
    pos: Cyc;
  }> = [];

  for (const piece of graph.pieces) {
    const count = ports(piece).length;
    for (let i = 0; i < count; i++) {
      const key = `${piece.pieceId}#${i}`;
      placed.push({
        pieceId: piece.pieceId,
        port: i,
        vertex: find(key),
        free: !claimed.has(key),
        pos: portFrame(placement, ports, piece, i).pos,
      });
    }
  }

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
   * precisely because `equals` is `isZero(sub(a, b))` over integers. The
   * comparison below is then the SAME loop with `j` restricted to the ports
   * that actually coincide with `i`, walked in ascending `i` then ascending
   * `j`, so the pairs are visited in the identical order and the output is
   * byte-identical rather than merely equivalent.
   *
   * WHAT THIS DOES NOT BOUND, and it is the bigger half. When ports COINCIDE
   * the group is the whole layout, so the pair walk below is quadratic again
   * and grouping buys only a constant. An earlier version of this comment
   * called that "work proportional to the answer" and said it was measured in
   * the spec. Both were wrong: the answer is itself quadratic in the input,
   * and NO spec measures it -- the only timed case anchors its rings 100,000
   * apart precisely so that nothing coincides, and that spec's own `no_claim`
   * line says so.
   *
   * MEASURED, open run of `E` (45 degrees, so eight of them close a circle
   * and a run laps the same EIGHT places), this function alone:
   *
   *     1,000 pieces   0.11MB     59ms      62,124 records
   *     4,000 pieces   0.44MB    973ms     998,499 records
   *     8,000 pieces   0.92MB   3912ms   4,191,231 records, 2.35GB resident
   *
   * Reachable by clicking one palette button: 800 `add` actions through the
   * real reducer is 87KB stored and 39,699 records, visible by 200 clicks.
   * Tracked as its own P0 in `docs/plan/brio-TODOS.md`; the fix is to stop
   * enumerating pairs, which needs a decision about what a clash IS when
   * three or more ends meet, so it is not a one-line change.
   */
  const at = new Map<string, number[]>();
  for (let i = 0; i < placed.length; i++) {
    const key = latticeKey(placed[i]!.pos);
    const group = at.get(key);
    if (group) group.push(i);
    else at.set(key, [i]);
  }
  /*
   * ONE CLASH PER PAIR OF VERTICES, not per pair of ports.
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
   * circle and an open run laps the same EIGHT places. MEASURED before this,
   * on an open run of `E`:
   *
   *     1,000 pieces   0.11MB     59ms      62,124 records
   *     4,000 pieces   0.44MB    973ms     998,499 records
   *     8,000 pieces   0.92MB   3912ms   4,191,231 records, 2.35GB resident
   *
   * 800 `add` actions through the real reducer is 87KB stored and 39,699
   * records. At 16,384 pieces it is a renderer OOM inside a render `useMemo`,
   * which is not a catchable throw, so nothing clears the storage key and
   * every reload repeats it.
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
   * VERIFIED IDENTICAL, which is the point of reformulating rather than
   * re-deciding. Against the previous implementation over 1,088 fixtures --
   * every catalogue part at both turns as chains and loops of 3/4/8/9/16/17/
   * 24 pieces, 700 random soups, lapped runs of 9/17/33/64 of every part,
   * piles of 2..60 loose unanchored pieces, mixed-part piles, the 16xE double
   * circle and the 8L8R tangent pair: the set of reported PLACES is identical
   * in all 1,088, and no layout changes verdict.
   *
   * WHAT DOES CHANGE is the COUNT: places, not vertex pairs. That is forced,
   * because a place can hold n vertices and C(n,2) is quadratic in the input.
   * It is also the right number. `clashMarkers` already dedupes to one marker
   * per place, and over 582 of those fixtures the old count disagreed with
   * the markers drawn in 142 of the 241 that clash at all. The note below
   * records this defect being half-fixed once already: the 16xE double circle
   * said 32 "when there are EIGHT such spots ... the verdict and the picture
   * disagreed, and the verdict was the wrong one". Counting vertex pairs
   * matched that case only because each place held exactly two vertices.
   * 16xE still reports 8 and the tangent pair still reports 1.
   *
   * MEASURED after, on the shapes above:
   *
   *   lapped E, 8,000 pieces   5907ms -> 29ms, 3,996,999 records -> 8
   *   pile,     2,000 pieces   4922ms -> 16ms, 3,998,000 records -> 2
   *
   * and `solveGraph` end to end on the 8,000-piece lapped run is 63ms.
   */

  /** Places holding two or more distinct vertices, in discovery order. */
  const sites: Array<{
    readonly key: string;
    readonly clash: VertexClash;
    /** Some vertex here is welded, which is a clash on its own. */
    readonly welded: boolean;
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
    // Kept as an assertion of the grouping, not as a filter: `at` already
    // guarantees it, and if that ever stops being true this is where the
    // wrong answer would come from.
    if (!equals(a.pos, b.pos)) continue;

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
    sites.push({
      key,
      clash,
      welded: freeReps.length < reps.length,
      // Only two or more free vertices here form a free-free pair, which is
      // what the pile-up rule counts.
      freePieces:
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
    if (site.welded) {
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
   * This is an endpoint test, not a body test. Pieces that cross mid-span are
   * still not checked, which the verdict copy says out loud.
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

/** Welds that put two ends of the same kind together. */
export function findWeldPolarityViolations(
  graph: Graph,
  resolve: (id: string) => Part,
  ports: PortsOf,
): readonly WeldPolarityViolation[] {
  const byId = new Map(graph.pieces.map((p) => [p.pieceId, p]));
  const out: WeldPolarityViolation[] = [];
  graph.welds.forEach((w, index) => {
    const pieceA = byId.get(w.a.pieceId);
    const pieceB = byId.get(w.b.pieceId);
    if (!pieceA || !pieceB) return;
    const portA = ports(pieceA)[w.a.port];
    const portB = ports(pieceB)[w.b.port];
    if (!portA || !portB) return;
    if (!weldHasPolarity(portA, portB)) return;
    const pa = portPolarity(resolve(pieceA.partId), w.a.port);
    const pb = portPolarity(resolve(pieceB.partId), w.b.port);
    if (pa !== pb) return;
    out.push({ weld: index, between: [pieceA.partId, pieceB.partId], polarity: pa });
  });
  return out;
}
