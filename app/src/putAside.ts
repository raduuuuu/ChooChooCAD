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
 *     own layout, the very same bytes as the link ─▶ nothing to do
 *     own layout:
 *       put-aside empty, or already the same bytes ─▶ put-aside ← saved, saved ← link
 *       put-aside holds something else ─▶ 'ask' (the caller asks; D29, D72)
 *     every write is read back; a failure puts back whatever it changed,
 *     LOOKS, and reports 'failed' only when both slots are as they were;
 *     otherwise 'stranded' hands back the layout that is in neither
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
  /** Something could not be written, and both slots are as they were (D23, design doc). */
  | { readonly kind: 'failed' }
  /** A write AND its roll-back failed: these bytes are in neither slot now, only here (D36). */
  | { readonly kind: 'stranded'; readonly bytes: string };

/** The two layouts the person was shown when asked, so "Replace it" answers THAT question. */
export interface Shown {
  readonly previous: string;
  readonly current: string;
}

/**
 * Put the link's layout in the editor's slot, keeping the friend's own.
 *
 * `replace`: the friend said yes to replacing what was put aside earlier, and
 * these are the two layouts the question showed. A BARE YES WAS NOT ENOUGH
 * (plan 2026-11-16, saved layouts, O3): between the question and the answer
 * another tab can put a different layout aside, and the yes then replaced a
 * layout the person never saw. If either slot no longer holds what was shown,
 * this asks again, with what is there now.
 *
 * `onScreen`: the friend's own layout as it is ON SCREEN, when the caller has
 * one that may be ahead of the saved slot (the editor, whose saving can be
 * blocked; O1). It is what gets put aside. A link's screen has none: there
 * the saved slot is the friend's layout.
 *
 * THE ROLL-BACK IS CHECKED (O2). A failed write used to be followed by
 * writing the old values back and reporting "nothing changed", without
 * looking. When the roll-back fails too, a layout can be in neither slot;
 * `stranded` now hands it back for a download, as `restorePrevious` does.
 */
export function openInEditor(linkBytes: string, replace: Shown | false = false, onScreen?: string): OpenResult {
  return withImport([GRAPH_STORAGE_KEY, GRAPH_PREVIOUS_KEY], (): OpenResult => {
    const saved = read(GRAPH_STORAGE_KEY);
    const current = onScreen ?? saved;
    // Nothing of their own, or only bytes in the rescue or legacy slots, which this never touches.
    if (!holdsOwnLayout() || current === null) {
      if (put(GRAPH_STORAGE_KEY, linkBytes)) return { kind: 'opened' };
      return settle(saved, read(GRAPH_PREVIOUS_KEY), [saved]);
    }
    // Their own layout, opened from its own link: a copy put aside would be the same layout twice.
    if (current === linkBytes) {
      // The saved slot can be behind the screen (`onScreen`); then it is brought level.
      if (saved === linkBytes || put(GRAPH_STORAGE_KEY, linkBytes)) return { kind: 'opened' };
      return settle(saved, read(GRAPH_PREVIOUS_KEY), [saved]);
    }
    const previous = read(GRAPH_PREVIOUS_KEY);
    if (previous !== null && previous !== current) {
      const answered = replace !== false && replace.previous === previous && replace.current === current;
      if (!answered) return { kind: 'ask', previous, current };
    }
    if (!put(GRAPH_PREVIOUS_KEY, current)) return settle(saved, previous, [previous]);
    if (!put(GRAPH_STORAGE_KEY, linkBytes)) return settle(saved, previous, [current, previous]);
    return { kind: 'opened' };
  });
}

/**
 * After a failed write: put both slots back as they were, LOOK, and say what
 * is true. `failed` only when both hold what they held. Otherwise the first
 * of `atStake` that is now in neither slot is handed back.
 */
function settle(saved: string | null, previous: string | null, atStake: readonly (string | null)[]): OpenResult {
  // A write that threw changed nothing, so the slot may already be right: look before and after.
  const back = (key: string, value: string | null) => read(key) === value || put(key, value) || read(key) === value;
  const savedBack = back(GRAPH_STORAGE_KEY, saved);
  // Never roll the put-aside slot back over the friend's layout when the saved slot has lost it.
  const asideBack = savedBack ? back(GRAPH_PREVIOUS_KEY, previous) : read(GRAPH_PREVIOUS_KEY) === previous;
  if (savedBack && asideBack) return { kind: 'failed' };
  const held = new Set([read(GRAPH_STORAGE_KEY), read(GRAPH_PREVIOUS_KEY)]);
  const lost = atStake.find((b): b is string => b !== null && !held.has(b));
  return lost === undefined ? { kind: 'failed' } : { kind: 'stranded', bytes: lost };
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

/**
 * A put-aside copy that gives nothing back is emptied, not offered:
 *
 * - byte for byte the saved layout, or `current` (the layout on screen, which
 *   may not be saved yet): Restore would swap a layout with itself. Opening
 *   your own layout's link made such copies before `openInEditor` skipped it;
 *   Undo after Clear makes one now.
 * - an empty floor: what Restore leaves behind after Clear, since the two
 *   slots are swapped.
 */
export function dropSameCopy(current?: string): void {
  const previous = read(GRAPH_PREVIOUS_KEY);
  if (previous === null) return;
  const s = summaryOf(previous);
  // With the layout on screen known, IT is what Restore would replace: the saved
  // slot may still hold the layout Clear has just put aside, until the next save.
  const shown = current ?? read(GRAPH_STORAGE_KEY);
  if (previous === shown || (s.kind === 'layout' && s.pieces === 0)) put(GRAPH_PREVIOUS_KEY, null);
}

/**
 * KEEP A LAYOUT BEFORE IT IS REPLACED (plan 2026-11-14, eng ED10; owner: "Put
 * the old layout aside first"). Clear and the ready layouts replace the whole
 * layout with only Undo as the way back, and Undo's history is gone when a
 * phone discards the tab. So the layout goes in the put-aside slot first.
 *
 *   an empty floor, or bytes that are no layout ─▶ 'nothing' (nothing to keep)
 *   the slot already holds these bytes ─▶ 'kept'
 *   the slot holds ANOTHER layout ─▶ 'occupied': it is left alone. Replacing a
 *     put-aside layout is asked first everywhere else (D29), and Clear asks
 *     nothing (design DD14), so the older one wins.
 *   the slot is empty ─▶ written and read back: 'kept', or 'failed' with the
 *     slot empty again
 *
 * Never blocks the caller: whatever this returns, Clear still clears.
 */
export type KeepResult = 'kept' | 'nothing' | 'occupied' | 'failed';
export function keepBeforeReplacing(bytes: string): KeepResult {
  const s = summaryOf(bytes);
  if (s.kind !== 'layout' || s.pieces === 0) return 'nothing';
  const previous = read(GRAPH_PREVIOUS_KEY);
  if (previous === bytes) return 'kept';
  if (previous !== null) return 'occupied';
  if (put(GRAPH_PREVIOUS_KEY, bytes)) return 'kept';
  put(GRAPH_PREVIOUS_KEY, null);
  return 'failed';
}

export const putAside = (): Summary => summaryOf(read(GRAPH_PREVIOUS_KEY));
