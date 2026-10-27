/**
 * Reading and writing the layout graph.
 *
 * Same discipline as the chain loader it replaces: a blob that does not parse,
 * or that names a part the library no longer has, is DISCARDED WHOLE and the
 * user is told. Repairing it would change the layout's geometry without
 * saying so, and dropping one piece out of the middle of a loop changes its
 * shape.
 *
 * What is new is that a weld can point at a piece that is not there. That is
 * not repairable either: a weld is a user's declared intent about two
 * specific ends, and inventing a different one is worse than starting empty.
 *
 * TWO KINDS OF LOSS, AND THEY ARE NOT THE SAME (task T5, finding E2)
 *
 * A WHOLE-LAYOUT loss returns `EMPTY_GRAPH` with a `discarded` sentence. An
 * ANCHOR loss keeps every piece and returns a count. The review found the plan
 * about to ship a notice reading "Loaded 12 of 14 pieces, two were left out",
 * which is false against this file twice over: the anchor loop below drops
 * ANCHORS, never pieces, and every piece reaches the return at the bottom.
 *
 * What a dropped anchor actually costs is worse than a missing piece, which is
 * why it gets reported rather than swallowed. `placeAll` reads anchors only for
 * forest ROOTS and falls back to the identity, so a component whose root lost
 * its anchor is placed at the origin on top of whatever is already there, and
 * `findVertexClashes` then reports a clash in a layout the user built
 * correctly. The verdict flips to "can't be built" for a reason that is a
 * loader artifact. A notice that says a piece went missing while the canvas
 * shows every piece and the verdict says the track is broken is worse than
 * silence.
 *
 * EVERY REFUSAL IS RESCUED FIRST (finding E1)
 *
 * Before any `discarded` result and before any anchor is dropped, the raw
 * string is copied to `GRAPH_RESCUE_KEY` verbatim. `App.tsx`'s save effect
 * used to overwrite the original at first paint; the rescue copy is what makes
 * that loss recoverable even if a later save does land.
 */

import { frameOf, levelOf, type Frame, type Graph, type Piece, type Weld } from '../../engine/src/graph/model.js';
import { scale, toXY, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { placeAll, portFrame, type PortsOf } from '../../engine/src/graph/frames.js';
import { CHAIN_STORAGE_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { EMPTY_GRAPH, RUN_SPACING_MM } from './layoutModel.js';



const DISCARDED = 'Your saved track could not be read, so the canvas started empty.';

/**
 * What `loadGraph` returns.
 *
 * Deliberately NOT `LoadResult<Graph>` any more. That type carries one
 * optional sentence, which cannot express "every piece loaded and two of them
 * may be in the wrong place" — the state E2 is about. Conflating the two is
 * what let the wrong notice copy get as far as a frozen design decision.
 */
export interface GraphLoadResult {
  readonly value: Graph;
  /** Whole-layout refusal. Present only when `value` is `EMPTY_GRAPH`. */
  readonly discarded?: string;
  /** Anchors dropped while KEEPING every piece. Zero when nothing was lost. */
  readonly droppedAnchors: number;
  /** True when the raw blob was copied to `GRAPH_RESCUE_KEY`. */
  readonly rescued: boolean;
  /**
   * True only when the layout key held bytes this load did not keep whole AND
   * they could not be copied aside, so the next save would destroy the only
   * copy. This, not `!rescued`, is what holds the graph save until Dismiss.
   *
   * `!rescued` was the gate and it said too much (filed by /ship 2026-10-14).
   * On the legacy path the layout key is EMPTY: the old bytes live under the
   * chain key, which `saveGraph` never writes. A full quota made the rescue
   * fail, so a user upgrading from the chain format built a track and nothing
   * was saved, to protect bytes no save could reach. The clean loads also
   * reported `rescued: false` and were safe only because they carry no notice.
   */
  readonly uncopied: boolean;
}

interface StoredGraph {
  pieces: Array<{ pieceId: string; partId: string; turn?: string }>;
  welds: Array<{ a: { pieceId: string; port: number }; b: { pieceId: string; port: number } }>;
  /** `level` only off the floor (two-layer plan, I1 and SC1): absent is the floor. */
  anchors?: Array<[string, { pos: number[]; heading: number; level?: number }]>;
}

/**
 * A lattice point this engine could have written.
 *
 * SAFE INTEGERS, not merely finite. Integrality was already enforced, by a
 * separate `pos.every(Number.isInteger)` at the one call site, so what this
 * adds is the BOUND -- and the two checks are folded into one here rather
 * than left in two places claiming the same thing.
 *
 * SAFE-INTEGER IS NOT TIGHT ENOUGH, which is why there is a magnitude ceiling
 * as well. Two separate failures live above it:
 *
 * - Eight 1e308s make `toXY` return Infinity, the orphan placement computes
 *   an infinite lane, and the stored anchor becomes `[NaN, ..., Infinity]`.
 *   `equals` and `isZero` are false for NaN, so every closure and clash test
 *   downstream quietly answers "no" -- a layout reporting no problems because
 *   the arithmetic stopped working.
 * - A coefficient that IS a safe integer can still break exactness, because
 *   composing two poses multiplies and adds before anything checks the
 *   result. MEASURED: an eight-curve loop that closes exactly, anchored at
 *   2^53 - 1, comes back `closesExactly: false` with a non-zero gap. That is
 *   a false "can't be built" -- the same invariant the orphan-lane P0
 *   inverted, reached a different way. The identical loop at 2^31 closes
 *   exactly, gap zero.
 *
 * Nothing legitimate comes near the ceiling: these are millimetres,
 * `nextRunAnchor` scales zeta^4 by 216 per lane, and 2^31 is about ten
 * million lanes.
 */
/** Past this, composing two poses stops being exact. */
const COEFFICIENT_CEILING = 2 ** 31;

function isCyc(v: unknown): v is Cyc {
  return (
    Array.isArray(v) &&
    v.length === 8 &&
    v.every(
      (n) => typeof n === 'number' && Number.isSafeInteger(n) && Math.abs(n) <= COEFFICIENT_CEILING,
    )
  );
}

/**
 * A heading this engine could have written is 0..15 (finding E9).
 *
 * Integrality alone was not enough. Headings normalize mod 16 downstream
 * (`model.ts:60`), so `heading: 400` was accepted here and silently remapped
 * to 0 rather than dropped — which contradicts the rule the comment beside the
 * `pos` check states, that a value this engine did not write gets dropped
 * rather than repaired. Out of range is now dropped, like a non-integer.
 */
function isHeading(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 15;
}

/**
 * A level this engine could have written: absent (the floor) or 1, the raised
 * level (two-layer plan, decision I1). The saver never writes 0 (SC1). Any
 * other value is dropped with its anchor, like an out-of-range heading.
 */
function isAnchorLevel(v: unknown): v is number | undefined {
  return v === undefined || v === 1;
}

/** Copy the refused bytes aside, untouched. Never throws; losing the rescue is not worth losing the session. */
function rescue(raw: string): boolean {
  try {
    localStorage.setItem(GRAPH_RESCUE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where every orphan goes: past the FOOTPRINT of what is already placed, not
 * past the anchor points.
 *
 * THE BUG THIS REPLACES (P0, filed 2026-10-14). The previous version kept a set
 * of occupied anchor POSITIONS and handed each orphan the first lane not in it.
 * An anchor names where a component STARTS; a run marching along the lane axis
 * occupies lanes its root never mentions. MEASURED: two 216mm straights welded
 * into a run anchored at the identity with `heading: 4` span lanes 0 to 2, the
 * set contained only lane 0, so the orphan took lane 1 -- the middle of the run
 * -- and landed on an already-welded joint. A welded end is spoken for, so
 * `findVertexClashes` reported it rather than excusing it the way it excuses
 * two free ends meeting, and the verdict read "Can't be built" about a layout
 * the user built correctly. That is the third invariant inverted: a passing
 * layout styled as a failure, on the one output this product exists to give.
 *
 * `layoutModel.nextRunAnchor` has always done this correctly for the in-app
 * path, clearing a new run by the existing layout's own height. The loader used
 * a weaker rule for the same decision because it had part ids and no geometry.
 * It has the geometry now.
 *
 * ONE PLACEMENT, NOT ONE PER ORPHAN. Moving an anchor along zeta^4 without
 * changing its heading translates that whole component rigidly, so its height
 * is the same wherever it is put. Every component is therefore measured once,
 * and the orphans are stacked using those heights. Re-placing per orphan would
 * be correct too and would make the loader quadratic in pieces, which is the
 * shape of a separate filed P1 about this file.
 *
 * Every anchor written here is an integer multiple of zeta^4: the lane is
 * rounded UP to the next whole multiple, so clearance is preserved and the
 * stored point stays exactly on the lattice. No epsilon enters.
 */
function clearOfEveryFootprint(
  pieces: readonly Piece[],
  welds: readonly Weld[],
  anchors: Map<string, Frame>,
  orphans: readonly string[],
  ports: PortsOf,
): void {
  if (orphans.length === 0) return;

  /*
   * Provisional distinct lanes, so one `placeAll` can measure every component.
   *
   * DE-DUPLICATED, because the stored anchors are an ARRAY from an untrusted
   * blob and may name the same id twice. Without this the loop below recovers
   * each component's provisional y from its index, which would then disagree
   * with the lane actually written -- the span would be measured against one
   * position and corrected against another.
   */
  const unique = [...new Set(orphans)];
  unique.forEach((id, i) =>
    anchors.set(id, { pos: scale(zetaPow(4), RUN_SPACING_MM * (i + 1)), heading: 0 }),
  );
  const placement = placeAll({ pieces, welds, anchors }, ports);

  // Piece to the root of its component. `forest.order` visits a parent before
  // its children, so one pass is enough.
  const rootOf = new Map<string, string>();
  for (const id of placement.forest.order) {
    const link = placement.forest.parent.get(id);
    rootOf.set(id, link ? rootOf.get(link.from)! : id);
  }

  // The y-extent each component actually occupies, measured at its provisional
  // position. Floats are fine here: choosing where to put something is not
  // computing geometry, and what gets STORED below is an exact lattice point.
  const byId = new Map(pieces.map((p) => [p.pieceId, p]));
  const span = new Map<string, { min: number; max: number }>();
  for (const id of placement.forest.order) {
    const piece = byId.get(id);
    const root = rootOf.get(id);
    if (!piece || root === undefined) continue;
    const count = ports(piece).length;
    for (let i = 0; i < count; i++) {
      const [, y] = toXY(portFrame(placement, ports, piece, i).pos);
      const seen = span.get(root);
      if (!seen) span.set(root, { min: y, max: y });
      else {
        if (y < seen.min) seen.min = y;
        if (y > seen.max) seen.max = y;
      }
    }
  }

  // Everything that is NOT an orphan has to be cleared, including components
  // whose root has no anchor at all -- `placeAll` puts those at the identity,
  // which is exactly the region an orphan would otherwise be handed.
  const isOrphan = new Set(orphans);
  let frontier = 0;
  for (const [root, s] of span) {
    if (!isOrphan.has(root) && s.max > frontier) frontier = s.max;
  }

  for (const [i, id] of unique.entries()) {
    /*
     * A NON-ROOT ORPHAN'S ANCHOR IS DELETED, NOT LEFT.
     *
     * The first version of this said the provisional anchor was "inert:
     * `placeAll` reads the root's", and left it. Something did read it.
     * `captureAnchors` (`graph/edit.ts`) then kept an existing anchor in
     * preference to the frame a piece was actually at, so the moment a weld
     * break or a delete made that piece a component root, the stale lane
     * won and the component teleported onto whatever was already there.
     * `captureAnchors` now takes the measured frame for every root (codex
     * review, 2026-10-22), so this deletion is no longer the only guard; it
     * stays because a dead anchor in the stored blob helps nobody.
     *
     * MEASURED: a survivor anchored at lane 1 plus a two-piece run whose
     * second piece has an unreadable anchor loads clean with 0 clashes, and
     * after ONE `removeWeld` reports 2 clashes at [1.32e-14, 216] -- the same
     * coordinate, and the same manufactured "can't be built", that this whole
     * function exists to prevent. The previous anchor-point rule did not have
     * this hole because its occupancy set de-duplicated orphan lanes against
     * surviving anchors.
     *
     * Deleting is right rather than placing: a non-root has no position of
     * its own to preserve, and if it becomes a root later `captureAnchors`
     * will record where it actually was.
     */
    if (rootOf.get(id) !== id) {
      anchors.delete(id);
      continue;
    }
    // Every root is in `forest.order` and in `byId`, so `span` has an entry
    // unless a part reports zero ports, which nothing in the catalogue does.
    // Conservative if it ever fires: keep the lane, do not advance.
    const s = span.get(id);
    if (!s) continue;
    // The index, not `orphans.indexOf(id)`, which would be a quadratic hiding
    // inside a loop that already has the number it needs.
    const provisionalY = RUN_SPACING_MM * (i + 1);
    // Put this component's BOTTOM edge one full spacing above the frontier.
    const wantedY = frontier + RUN_SPACING_MM - s.min + provisionalY;
    // `isCyc` bounds every coefficient, so `wantedY` is finite by
    // construction. A `Number.isFinite` ternary stood here and was
    // unreachable the moment that bound existed -- a guard nobody can trip is
    // the dead code this file's own comments argue against.
    const lane = Math.max(1, Math.ceil(wantedY / RUN_SPACING_MM));
    anchors.set(id, { pos: scale(zetaPow(4), RUN_SPACING_MM * lane), heading: 0 });
    frontier = RUN_SPACING_MM * lane + (s.max - provisionalY);
  }
}

export function loadGraph(
  knownPartIds: ReadonlySet<string>,
  /**
   * Port geometry, REQUIRED. It was an optional port COUNT, which left the
   * suite exercising a weaker branch than production and left the loader
   * unable to see where a component actually sits. Both holes closed by
   * taking the real thing.
   */
  ports: PortsOf,
): GraphLoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(GRAPH_STORAGE_KEY);

    /** A whole-layout refusal: rescue the bytes, then report. */
    const refuse = (discarded: string): GraphLoadResult => {
      const rescued = raw === null ? false : rescue(raw);
      return { value: EMPTY_GRAPH, discarded, droppedAnchors: 0, rescued, uncopied: raw !== null && !rescued };
    };

    if (!raw) {
      // An older chain blob cannot be carried over: it has no welds and no
      // anchors, and silently starting empty would look like data loss.
      const legacy = localStorage.getItem(CHAIN_STORAGE_KEY);
      if (legacy) {
        return {
          value: EMPTY_GRAPH,
          discarded:
            'Your saved track was in the older format, which had no way to record joins, ' +
            'so it could not be carried over. The canvas started empty.',
          droppedAnchors: 0,
          rescued: rescue(legacy),
          // The chain key is never written by `saveGraph`, so a failed copy
          // leaves the old bytes exactly where they were.
          uncopied: false,
        };
      }
      return { value: EMPTY_GRAPH, droppedAnchors: 0, rescued: false, uncopied: false };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return refuse(DISCARDED);
    const { pieces, welds, anchors } = parsed as Partial<StoredGraph>;
    if (!Array.isArray(pieces) || !Array.isArray(welds)) {
      return refuse(DISCARDED);
    }

    const ids = new Set<string>();
    const out: Piece[] = [];
    for (const p of pieces) {
      if (typeof p !== 'object' || p === null) return refuse(DISCARDED);
      const { pieceId, partId, turn } = p as Record<string, unknown>;
      if (typeof pieceId !== 'string' || typeof partId !== 'string') {
        return refuse(DISCARDED);
      }
      if (!knownPartIds.has(partId)) {
        return refuse(
          `Your saved track used a part the library no longer has (${partId}), ` +
            'so the whole layout was cleared. Dropping one piece would have changed its shape.',
        );
      }
      if (turn !== undefined && turn !== 'left' && turn !== 'right') {
        return refuse(DISCARDED);
      }
      if (ids.has(pieceId)) return refuse(DISCARDED);
      ids.add(pieceId);
      out.push({ pieceId, partId, turn: turn as Piece['turn'] });
    }

    const outWelds: Weld[] = [];
    /*
     * One Map, built once. The first version called `out.find(...)` twice per
     * weld inside this loop, which is O(pieces x welds): measured 0.7ms at 100
     * pieces, 7.2ms at 1000, 340ms at 8000. Not a blocker at real layout
     * sizes, and a gratuitous quadratic two lines from proof that the right
     * structure was already in hand.
     */
    const pieceOf = new Map(out.map((p) => [p.pieceId, p]));
    /*
     * A PORT INDEX GETS THE SAME TREATMENT AS A HEADING (finding B1).
     *
     * `typeof port === 'number'` was the whole check here, which let every
     * in-type integer through: `7` on a two-port straight, `-1`, `2.5`,
     * `1e9`. None of them is repairable and none of them was refused. The
     * loader reported a clean load -- no `discarded` sentence, no notice,
     * `droppedAnchors: 0`, no rescue copy written -- and then `placeAll`
     * threw `Cannot read properties of undefined (reading 'at')` inside
     * render. `ErrorBoundary` caught it, `GRAPH_STORAGE_KEY` was never
     * touched, so every reload reproduced it identically. The one button that
     * broke the loop also removed the inventory and the submissions, which is
     * the data `library.ts` singles out as impossible to recreate.
     *
     * MEASURED before this fix: ports 2, 7, -1 and 2.5 on a two-port part
     * were all accepted, and all four threw in `placeAll` and `renderGraph`.
     *
     * `isHeading` right above was tightened for exactly this reason, and its
     * comment states the rule this now follows: a value this engine did not
     * write gets dropped rather than repaired. A weld is a declared intent
     * about two specific ends; inventing a different end is worse than
     * starting empty, which is why this refuses the whole layout rather than
     * dropping the weld -- the same call the missing-piece check below makes.
     */
    const isPort = (v: unknown, pieceId: string): v is number => {
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return false;
      // Non-null is sound: `ids.has` gated this lookup, and `ids` and
      // `pieceOf` are filled from the same array in lockstep.
      return v < ports(pieceOf.get(pieceId)!).length;
    };
    /*
     * A PORT HOLDS ONE WELD. `weldEnds` refuses a port that is not free and
     * `addPiece` welds only free ports, so a second weld on the same end is a
     * value this engine did not write -- and the loader was the one place
     * that did not say so. It checked a port index's RANGE and never its
     * OCCUPANCY.
     *
     * That hole was not cosmetic. Every duplicate weld becomes another
     * closing weld, so it inflates the cycle rank, and a piece welded many
     * times over sits in many fundamental cycles at once, which makes the
     * fundamental-sharing graph dense. MEASURED through this loader before
     * the check existed: a 303,940-byte layout of 3000 pieces with 20
     * duplicate welds loaded with no discarded sentence at all, and the solve
     * then blocked the main thread for 11,058ms. A freeze is not a throw, so
     * `ErrorBoundary` never fired and the key was never cleared: every
     * reload did it again.
     *
     * Refused whole rather than dropped, for the reason the comment above
     * gives: a weld is a declared intent about two specific ends, and there
     * is no way to tell WHICH of the duplicates was meant.
     */
    const claimed = new Set<string>();
    for (const w of welds) {
      const a = (w as Weld | undefined)?.a;
      const b = (w as Weld | undefined)?.b;
      if (!a || !b) return refuse(DISCARDED);
      // A weld naming a piece that is not here cannot be repaired: it is a
      // declared intent about two specific ends, and inventing another is
      // worse than starting empty.
      if (!ids.has(a.pieceId) || !ids.has(b.pieceId)) {
        return refuse(DISCARDED);
      }
      if (!isPort(a.port, a.pieceId) || !isPort(b.port, b.pieceId)) {
        return refuse(DISCARDED);
      }
      const endA = `${a.pieceId}:${a.port}`;
      const endB = `${b.pieceId}:${b.port}`;
      // Also catches a weld joining one end to itself, which claims it twice.
      if (endA === endB || claimed.has(endA) || claimed.has(endB)) {
        return refuse(DISCARDED);
      }
      claimed.add(endA);
      claimed.add(endB);
      // Only the two fields a weld end IS. The stored object may carry extra
      // keys and the accepted graph should not inherit them.
      outWelds.push({
        a: { pieceId: a.pieceId, port: a.port },
        b: { pieceId: b.pieceId, port: b.port },
      });
    }

    /*
     * The anchor loop. Every `continue` here is a COUNTED loss, not a silent
     * one. The layout is kept whole; what is lost is a position, and the
     * consequence is a component drawn somewhere it never was.
     */
    const anchorMap = new Map<string, Frame>();
    /** Entries too broken to name a piece: each one is some piece's position. */
    let nameless = 0;
    /*
     * Pieces whose anchor was unreadable. They are re-anchored AFTER the loop,
     * to a lane beyond every surviving anchor, rather than left to fall to the
     * identity (finding E2).
     *
     * THIS IS A DECIDED TRADE, not an oversight. Leaving them unanchored is
     * what produces the false verdict: `placeAll` puts an unanchored root at
     * the identity, so the orphan lands on top of the component that is
     * legitimately at the origin, `findVertexClashes` reports an overlap the
     * user never built, and the verdict reads "can't be built" about a track
     * that is fine. Choosing a lane instead means the piece is drawn somewhere
     * it probably was not — which is exactly what the notice says, in those
     * words — and no verdict is manufactured. A wrong position the user can
     * see and the notice explains beats a wrong verdict they cannot.
     *
     * The offset is an integer multiple of zeta^4, so it is an exact lattice
     * point: closure stays exact in Z[zeta16] and no epsilon enters here.
     */
    const unreadable = new Set<string>();
    for (const entry of anchors ?? []) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        // No id to re-anchor: the entry itself is unreadable. Counted, because
        // some piece has lost its position and we cannot say which.
        nameless++;
        continue;
      }
      const [id, frame] = entry as [unknown, unknown];
      // An anchor for a piece that is not here is not a loss of position: the
      // piece it described is already gone from the blob, so there is nothing
      // to misplace. Not counted.
      if (typeof id !== 'string' || !ids.has(id)) continue;
      if (typeof frame !== 'object' || frame === null) {
        unreadable.add(id);
        continue;
      }
      const { pos, heading, level } = frame as Record<string, unknown>;
      // Anchors are exact lattice points. A non-integer or absurdly large one
      // is not an anchor this engine wrote, so it is dropped rather than
      // rounded or truncated into place. Both checks live in `isCyc`.
      if (!isCyc(pos)) {
        unreadable.add(id);
        continue;
      }
      if (!isHeading(heading)) {
        unreadable.add(id);
        continue;
      }
      if (!isAnchorLevel(level)) {
        unreadable.add(id);
        continue;
      }
      anchorMap.set(id, frameOf(pos, heading, level ?? 0));
    }
    /*
     * PIECES, NOT ENTRIES, and a readable position wins (filed 2026-10-15).
     * The stored anchors are an array from an untrusted blob and may name a
     * piece twice. Counting entries told the user "2 had unreadable
     * positions" about one piece, and a piece with one bad entry and one good
     * one was re-laned anyway, throwing away a position that was right there.
     */
    const orphans = [...unreadable].filter((id) => !anchorMap.has(id));
    const droppedAnchors = nameless + orphans.length;

    /*
     * NOT WRAPPED IN A try/catch, and that is the considered choice.
     *
     * A previous version caught here, reasoning that a throw should cost one
     * misplaced piece rather than the whole layout. That reasoning was
     * backwards. `clearOfEveryFootprint` can only throw out of `placeAll` or
     * `portFrame`, and both depend solely on pieces, welds and `ports` --
     * never on the anchors map. So anything that throws here throws again at
     * `App.tsx`'s own `placeAll` on the very next line of the render. Catching
     * converts a clean `refuse(DISCARDED)` -- empty canvas, rescue copy
     * written, inventory and submissions untouched -- into an unavoidable
     * crash screen whose only exit deletes the inventory and the submissions,
     * which is the data this file singles out as impossible to recreate.
     *
     * The half-caught state was worse still: a throw partway leaves every
     * orphan on a raw provisional lane, and lane 1 is exactly where a
     * survivor sits in the fixture this whole function exists for. The
     * fallback would have been the P0, not "positions that may be wrong".
     */
    clearOfEveryFootprint(out, outWelds, anchorMap, orphans, ports);

    const rescued = droppedAnchors > 0 ? rescue(raw) : false;
    return {
      value: { pieces: out, welds: outWelds, anchors: anchorMap },
      droppedAnchors,
      rescued,
      // A clean load loses nothing: saving it back writes what was read.
      uncopied: droppedAnchors > 0 && !rescued,
    };
  } catch {
    const rescued = raw === null ? false : rescue(raw);
    return {
      value: EMPTY_GRAPH,
      discarded: DISCARDED,
      droppedAnchors: 0,
      rescued,
      uncopied: raw !== null && !rescued,
    };
  }
}

/**
 * The notice for a partial load, in the words the user reads.
 *
 * Lives here rather than in `App.tsx` because the copy is a claim about what
 * this file did, and the two drifted apart once already. It names POSITION,
 * never omission: every piece loaded.
 */
export function partialLoadNotice(pieces: number, droppedAnchors: number): string {
  const subject = droppedAnchors === 1 ? 'one had an unreadable position' : `${droppedAnchors} had unreadable positions`;
  return (
    `Loaded all ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}, but ${subject}, ` +
    'so part of your track may be in the wrong place.'
  );
}

/** Whether the browser stored it. The caller says so when it did not (see saveNotice.ts). */
export function saveGraph(graph: Graph): boolean {
  try {
    const payload: StoredGraph = {
      pieces: graph.pieces.map((p) => ({ pieceId: p.pieceId, partId: p.partId, turn: p.turn })),
      welds: graph.welds.map((w) => ({ a: { ...w.a }, b: { ...w.b } })),
      // The level only off the floor (SC1), so a flat layout saves exactly as before.
      anchors: [...(graph.anchors ?? [])].map(([id, f]) => [
        id,
        { pos: [...f.pos], heading: f.heading, ...(levelOf(f) !== 0 ? { level: levelOf(f) } : {}) },
      ]),
    };
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    // Private browsing and full quotas both throw. Losing persistence is not
    // worth losing the session over, but the user is told (saveNotice.ts).
    return false;
  }
}

/**
 * Whether ONE store's save must stay suppressed.
 *
 * Extracted from `App.tsx` so it can be TESTED. The effects it gates need a
 * DOM and StrictMode, which `vitest.config.ts` deliberately does not provide,
 * but the decision itself is a pure boolean and belongs where a test can reach
 * it. Every bug this logic has produced -- three now -- was in the condition
 * rather than the wiring.
 *
 * PER STORE, NOT GLOBAL, and that is the third fix to this function.
 *
 * The first version gated only the graph. The second gated all three saves on
 * any unread notice, which had no bound and left persistence off for the whole
 * session. The third added `rescued` globally, and that was worse: `rescue()`
 * writes only `GRAPH_RESCUE_KEY`, so there is no rescue copy for the inventory
 * or the submissions and `rescued` is false on every clean graph load.
 * MEASURED: with a clean layout and one dropped submission row, suppression
 * stayed on after the user built a track AND after they typed a new caliper
 * measurement -- `userHasActed` was inert in every row where `rescued` was
 * false. Only Dismiss released it. That is verbatim the failure this file's
 * own comments call worse than the bug the gate fixes.
 *
 * So each store answers for its own loss:
 *
 * - Nothing lost, or the notice was dismissed: save.
 * - Lost and unread, and the user has done nothing yet: hold. This is the
 *   case E1 exists for -- the mount-time write that overwrote stored bytes
 *   before anybody had seen the notice.
 * - Lost and unread, and the user has deliberately acted: save. The banner is
 *   on screen, and their action is about the thing it names. Refusing here
 *   loses the data they just typed to protect data they have already been
 *   told about, which is the wrong way round.
 *
 * `noRescueCopy` is the one exception, and it applies only to the graph. A
 * whole-layout refusal means the stored bytes are the only record of what may
 * be hours of work, and `rescue()` swallows a quota or private-browsing
 * failure and returns false. When that copy does not exist the user is the
 * only backup, so a stray click is not enough and a dismissal is required.
 * The inventory and the submissions have no rescue mechanism at all, so
 * passing `noRescueCopy` for them would suppress forever rather than protect
 * anything -- which is exactly the bug above.
 */
export function savesSuppressed(state: {
  /** This store's loss notice, or undefined when it loaded cleanly. */
  readonly notice: string | undefined;
  readonly dismissed: boolean;
  /**
   * THIS store's acknowledgement, never a global flag. One flag feeding all
   * three gates is the bug the per-store rule above exists to prevent: a graph
   * edit then released the submissions write and destroyed a caliper
   * measurement that has no rescue copy.
   */
  readonly userHasActed: boolean;
  /**
   * Graph only: the refused bytes could NOT be copied aside, so overwriting
   * the live key destroys the only copy. Always false for stores that have no
   * rescue key.
   */
  readonly noRescueCopy?: boolean;
}): boolean {
  if (state.notice === undefined || state.dismissed) return false;
  if (state.noRescueCopy === true) return true;
  return !state.userHasActed;
}
