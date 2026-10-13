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
 */

import type { Frame, Graph, Piece, Weld } from '../../engine/src/graph/model.js';
import type { Cyc } from '../../engine/src/geom/cyclotomic.js';
import type { LoadResult } from './inventoryModel.js';
import { CHAIN_STORAGE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';
import { EMPTY_GRAPH } from './layoutModel.js';

const DISCARDED = 'Your saved track could not be read, so the canvas started empty.';

interface StoredGraph {
  pieces: Array<{ pieceId: string; partId: string; turn?: string }>;
  welds: Array<{ a: { pieceId: string; port: number }; b: { pieceId: string; port: number } }>;
  anchors?: Array<[string, { pos: number[]; heading: number }]>;
}

function isCyc(v: unknown): v is Cyc {
  return Array.isArray(v) && v.length === 8 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function loadGraph(knownPartIds: ReadonlySet<string>): LoadResult<Graph> {
  try {
    const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
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
        };
      }
      return { value: EMPTY_GRAPH };
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { value: EMPTY_GRAPH, discarded: DISCARDED };
    const { pieces, welds, anchors } = parsed as Partial<StoredGraph>;
    if (!Array.isArray(pieces) || !Array.isArray(welds)) {
      return { value: EMPTY_GRAPH, discarded: DISCARDED };
    }

    const ids = new Set<string>();
    const out: Piece[] = [];
    for (const p of pieces) {
      if (typeof p !== 'object' || p === null) return { value: EMPTY_GRAPH, discarded: DISCARDED };
      const { pieceId, partId, turn } = p as Record<string, unknown>;
      if (typeof pieceId !== 'string' || typeof partId !== 'string') {
        return { value: EMPTY_GRAPH, discarded: DISCARDED };
      }
      if (!knownPartIds.has(partId)) {
        return {
          value: EMPTY_GRAPH,
          discarded:
            `Your saved track used a part the library no longer has (${partId}), ` +
            'so the whole layout was cleared. Dropping one piece would have changed its shape.',
        };
      }
      if (turn !== undefined && turn !== 'left' && turn !== 'right') {
        return { value: EMPTY_GRAPH, discarded: DISCARDED };
      }
      if (ids.has(pieceId)) return { value: EMPTY_GRAPH, discarded: DISCARDED };
      ids.add(pieceId);
      out.push({ pieceId, partId, turn: turn as Piece['turn'] });
    }

    const outWelds: Weld[] = [];
    for (const w of welds) {
      const a = (w as Weld | undefined)?.a;
      const b = (w as Weld | undefined)?.b;
      if (!a || !b || typeof a.port !== 'number' || typeof b.port !== 'number') {
        return { value: EMPTY_GRAPH, discarded: DISCARDED };
      }
      // A weld naming a piece that is not here cannot be repaired: it is a
      // declared intent about two specific ends, and inventing another is
      // worse than starting empty.
      if (!ids.has(a.pieceId) || !ids.has(b.pieceId)) {
        return { value: EMPTY_GRAPH, discarded: DISCARDED };
      }
      outWelds.push({ a: { ...a }, b: { ...b } });
    }

    const anchorMap = new Map<string, Frame>();
    for (const entry of anchors ?? []) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [id, frame] = entry as [unknown, unknown];
      if (typeof id !== 'string' || !ids.has(id)) continue;
      if (typeof frame !== 'object' || frame === null) continue;
      const { pos, heading } = frame as Record<string, unknown>;
      // Anchors are exact lattice points. A non-integer one is not an anchor
      // this engine wrote, so it is dropped rather than rounded into place.
      if (!isCyc(pos) || !pos.every(Number.isInteger)) continue;
      if (typeof heading !== 'number' || !Number.isInteger(heading)) continue;
      anchorMap.set(id, { pos, heading });
    }

    return { value: { pieces: out, welds: outWelds, anchors: anchorMap } };
  } catch {
    return { value: EMPTY_GRAPH, discarded: DISCARDED };
  }
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
