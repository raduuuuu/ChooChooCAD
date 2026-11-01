/**
 * OPENING A SHARED LINK IN THE EDITOR, AND GETTING YOUR OWN LAYOUT BACK
 * (share plan, design doc step 3; eng D23, D24, D29, D35, D36, D72).
 *
 * Two slots: the saved layout (GRAPH_STORAGE_KEY) and the put-aside one
 * (GRAPH_PREVIOUS_KEY). Both hold RAW BYTES, moved untouched, so a layout the
 * app cannot read survives exactly as it was.
 *
 *   openInEditor(link)
 *     provably empty (D23) ─▶ saved ← link
 *     own layout:
 *       put-aside empty, or already the same bytes ─▶ put-aside ← saved, saved ← link
 *       put-aside holds something else ─▶ 'ask' (the caller asks; D29, D72)
 *     every write is read back; a failure puts back whatever it changed and
 *     reports 'failed', so nothing is ever half done
 *
 *   restorePrevious(): swap the two slots, read back, roll back on failure;
 *     if even the roll-back fails, 'stranded' hands back the bytes that now
 *     exist only in memory, for "Download a copy" (D24, D36)
 *
 * Writes go through storage.ts. In a shared link's read-only session only
 * `withImport` makes these two keys writable, for the length of one call
 * (D35); in the editor there is no session and they write as usual.
 */

import { remove, withImport, write } from '../../engine/data/storage.js';
import { holdsOwnLayout } from './layoutStore.js';
import { GRAPH_PREVIOUS_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Write `value` (or remove, for null) and read it back. Exactly what landed, or false. */
function put(key: string, value: string | null): boolean {
  const r = value === null ? remove(key) : write(key, value);
  return r === 'ok' && read(key) === value;
}

export type OpenResult =
  | { readonly kind: 'opened' }
  /** The put-aside slot holds a different layout: ask before replacing it (D29). */
  | { readonly kind: 'ask'; readonly previous: string; readonly current: string }
  /** Something could not be written; everything is as it was (D23, design doc). */
  | { readonly kind: 'failed' };

/**
 * Put the link's layout in the editor's slot, keeping the friend's own.
 * `replace`: the friend said yes to replacing what was put aside earlier.
 */
export function openInEditor(linkBytes: string, replace = false): OpenResult {
  return withImport([GRAPH_STORAGE_KEY, GRAPH_PREVIOUS_KEY], (): OpenResult => {
    const current = read(GRAPH_STORAGE_KEY);
    // Nothing of their own, or only bytes in the rescue or legacy slots, which this never touches.
    if (!holdsOwnLayout() || current === null) {
      if (put(GRAPH_STORAGE_KEY, linkBytes)) return { kind: 'opened' };
      put(GRAPH_STORAGE_KEY, current);
      return { kind: 'failed' };
    }
    const previous = read(GRAPH_PREVIOUS_KEY);
    if (previous !== null && previous !== current && !replace) return { kind: 'ask', previous, current };
    if (!put(GRAPH_PREVIOUS_KEY, current)) {
      put(GRAPH_PREVIOUS_KEY, previous);
      return { kind: 'failed' };
    }
    if (!put(GRAPH_STORAGE_KEY, linkBytes)) {
      put(GRAPH_STORAGE_KEY, current);
      put(GRAPH_PREVIOUS_KEY, previous);
      return { kind: 'failed' };
    }
    return { kind: 'opened' };
  });
}

export type RestoreResult =
  | { readonly kind: 'restored' }
  /** Nothing changed: a write failed and was rolled back. */
  | { readonly kind: 'failed' }
  /** A write AND its roll-back failed: these bytes now exist only here (D36). */
  | { readonly kind: 'stranded'; readonly bytes: string };

/** Swap the saved and the put-aside layouts (D24). */
export function restorePrevious(): RestoreResult {
  const current = read(GRAPH_STORAGE_KEY);
  const previous = read(GRAPH_PREVIOUS_KEY);
  if (previous === null) return { kind: 'failed' };
  // The put-aside slot first: if this fails, nothing has moved.
  if (!put(GRAPH_PREVIOUS_KEY, current)) {
    return put(GRAPH_PREVIOUS_KEY, previous) ? { kind: 'failed' } : { kind: 'stranded', bytes: previous };
  }
  if (!put(GRAPH_STORAGE_KEY, previous)) {
    // The earlier layout now lives only in `previous`; put it back where it was.
    return put(GRAPH_PREVIOUS_KEY, previous) ? { kind: 'failed' } : { kind: 'stranded', bytes: previous };
  }
  return { kind: 'restored' };
}

/** Empty the put-aside slot (design 9A: only after the friend confirms). */
export const discardPrevious = (): boolean => put(GRAPH_PREVIOUS_KEY, null);

/** What is put aside, for the notice and the ask: its piece count, or that it cannot be read. */
export type Summary = { readonly kind: 'none' } | { readonly kind: 'unreadable' } | { readonly kind: 'layout'; readonly pieces: number };

export function summaryOf(bytes: string | null): Summary {
  if (bytes === null) return { kind: 'none' };
  try {
    const pieces = (JSON.parse(bytes) as { pieces?: unknown } | null)?.pieces;
    return Array.isArray(pieces) ? { kind: 'layout', pieces: pieces.length } : { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
}

export const putAside = (): Summary => summaryOf(read(GRAPH_PREVIOUS_KEY));
