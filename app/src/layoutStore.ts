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

import type { Frame, Graph, Piece, Weld } from '../../engine/src/graph/model.js';
import { scale, zetaPow, type Cyc } from '../../engine/src/geom/cyclotomic.js';
import { CHAIN_STORAGE_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { EMPTY_GRAPH } from './layoutModel.js';

/** The grid runs are spaced on, matching `layoutModel`'s. One long straight. */
const RUN_SPACING_MM = 216;

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
}

interface StoredGraph {
  pieces: Array<{ pieceId: string; partId: string; turn?: string }>;
  welds: Array<{ a: { pieceId: string; port: number }; b: { pieceId: string; port: number } }>;
  anchors?: Array<[string, { pos: number[]; heading: number }]>;
}

function isCyc(v: unknown): v is Cyc {
  return Array.isArray(v) && v.length === 8 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
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

/** Copy the refused bytes aside, untouched. Never throws; losing the rescue is not worth losing the session. */
function rescue(raw: string): boolean {
  try {
    localStorage.setItem(GRAPH_RESCUE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function loadGraph(knownPartIds: ReadonlySet<string>): GraphLoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(GRAPH_STORAGE_KEY);

    /** A whole-layout refusal: rescue the bytes, then report. */
    const refuse = (discarded: string): GraphLoadResult => ({
      value: EMPTY_GRAPH,
      discarded,
      droppedAnchors: 0,
      rescued: raw === null ? false : rescue(raw),
    });

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
        };
      }
      return { value: EMPTY_GRAPH, droppedAnchors: 0, rescued: false };
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
    for (const w of welds) {
      const a = (w as Weld | undefined)?.a;
      const b = (w as Weld | undefined)?.b;
      if (!a || !b || typeof a.port !== 'number' || typeof b.port !== 'number') {
        return refuse(DISCARDED);
      }
      // A weld naming a piece that is not here cannot be repaired: it is a
      // declared intent about two specific ends, and inventing another is
      // worse than starting empty.
      if (!ids.has(a.pieceId) || !ids.has(b.pieceId)) {
        return refuse(DISCARDED);
      }
      outWelds.push({ a: { ...a }, b: { ...b } });
    }

    /*
     * The anchor loop. Every `continue` here is a COUNTED loss, not a silent
     * one. The layout is kept whole; what is lost is a position, and the
     * consequence is a component drawn somewhere it never was.
     */
    const anchorMap = new Map<string, Frame>();
    let droppedAnchors = 0;
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
    const orphans: string[] = [];
    for (const entry of anchors ?? []) {
      if (!Array.isArray(entry) || entry.length !== 2) {
        // No id to re-anchor: the entry itself is unreadable. Counted, because
        // some piece has lost its position and we cannot say which.
        droppedAnchors++;
        continue;
      }
      const [id, frame] = entry as [unknown, unknown];
      // An anchor for a piece that is not here is not a loss of position: the
      // piece it described is already gone from the blob, so there is nothing
      // to misplace. Not counted.
      if (typeof id !== 'string' || !ids.has(id)) continue;
      if (typeof frame !== 'object' || frame === null) {
        droppedAnchors++;
        orphans.push(id);
        continue;
      }
      const { pos, heading } = frame as Record<string, unknown>;
      // Anchors are exact lattice points. A non-integer one is not an anchor
      // this engine wrote, so it is dropped rather than rounded into place.
      if (!isCyc(pos) || !pos.every(Number.isInteger)) {
        droppedAnchors++;
        orphans.push(id);
        continue;
      }
      if (!isHeading(heading)) {
        droppedAnchors++;
        orphans.push(id);
        continue;
      }
      anchorMap.set(id, { pos, heading });
    }

    /*
     * Re-anchor the orphans into free lanes past everything that survived, so
     * no two components start at the same frame. `heading: 0` because a lost
     * heading is not recoverable either and zero is the only non-claim.
     */
    for (let k = 0; k < orphans.length; k++) {
      const steps = anchorMap.size + k + 1;
      anchorMap.set(orphans[k]!, { pos: scale(zetaPow(4), RUN_SPACING_MM * steps), heading: 0 });
    }

    return {
      value: { pieces: out, welds: outWelds, anchors: anchorMap },
      droppedAnchors,
      rescued: droppedAnchors > 0 ? rescue(raw) : false,
    };
  } catch {
    return {
      value: EMPTY_GRAPH,
      discarded: DISCARDED,
      droppedAnchors: 0,
      rescued: raw === null ? false : rescue(raw),
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

export function saveGraph(graph: Graph): void {
  try {
    const payload: StoredGraph = {
      pieces: graph.pieces.map((p) => ({ pieceId: p.pieceId, partId: p.partId, turn: p.turn })),
      welds: graph.welds.map((w) => ({ a: { ...w.a }, b: { ...w.b } })),
      anchors: [...(graph.anchors ?? [])].map(([id, f]) => [id, { pos: [...f.pos], heading: f.heading }]),
    };
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing and full quotas both throw. Losing persistence is not
    // worth losing the session over.
  }
}
