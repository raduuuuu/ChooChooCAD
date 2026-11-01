/**
 * SAVED DATA FROM BEFORE THE RENAME, MOVED ONCE (2026-11-01).
 *
 * Every storage key used to start with an older prefix, and stored custom
 * parts carried an older name for the Generic brand. This is the one file
 * that still spells them: it runs before anything reads storage, moves each
 * old key's bytes to the new key, and deletes the old key only once the new
 * one holds them. A key already present under its new name is kept, and the
 * old copy is dropped. Nothing else in the app knows the old names.
 *
 *   old key present? ─no─▶ nothing
 *        │yes
 *   new key present? ─yes─▶ remove old
 *        │no
 *   write new (bytes, brand renamed in custom parts) ─failed─▶ keep old, try next load
 *        │ok
 *   remove old
 *
 * Writes go through `storage.ts` like every other write. It runs before the
 * link route turns on its read-only session, so a shared link opened first
 * still moves the visitor's own saved work; moving bytes changes none of them.
 */

import { remove, write } from '../../engine/data/storage.js';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';
import {
  BUILD_LINK_STORAGE_KEY,
  BUILD_STORAGE_KEY,
  CHAIN_STORAGE_KEY,
  GRAPH_PREVIOUS_KEY,
  GRAPH_RESCUE_KEY,
  GRAPH_STORAGE_KEY,
  INVENTORY_STORAGE_KEY,
  SELECT_HINT_STORAGE_KEY,
  TABLE_STORAGE_KEY,
  VIEW_STORAGE_KEY,
} from './storageKeys.js';

const NEW_PREFIX = 'generic.';
const OLD_PREFIX = 'brio.';
const OLD_BRAND = 'BRIO';
const NEW_BRAND = 'GENERIC';

/** Every key that persists across visits, under its new name. */
export const MOVED_KEYS: readonly string[] = [
  CHAIN_STORAGE_KEY,
  GRAPH_STORAGE_KEY,
  GRAPH_RESCUE_KEY,
  GRAPH_PREVIOUS_KEY,
  INVENTORY_STORAGE_KEY,
  TABLE_STORAGE_KEY,
  VIEW_STORAGE_KEY,
  BUILD_STORAGE_KEY,
  BUILD_LINK_STORAGE_KEY,
  SELECT_HINT_STORAGE_KEY,
  SUBMISSIONS_STORAGE_KEY,
];

export const oldKeyOf = (key: string): string => OLD_PREFIX + key.slice(NEW_PREFIX.length);

/** Custom parts with the old brand name get the new one; anything unreadable moves as it is. */
function renameBrand(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    let changed = false;
    const out = parsed.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) return item;
      const row = item as { part?: { brand?: unknown } };
      if (row.part?.brand !== OLD_BRAND) return item;
      changed = true;
      return { ...row, part: { ...row.part, brand: NEW_BRAND } };
    });
    return changed ? JSON.stringify(out) : raw;
  } catch {
    return raw;
  }
}

/** Move every saved value from its old key. Never throws. */
export function moveOldNames(): void {
  for (const key of MOVED_KEYS) {
    const old = oldKeyOf(key);
    let bytes: string | null;
    let present: boolean;
    try {
      bytes = localStorage.getItem(old);
      present = localStorage.getItem(key) !== null;
    } catch {
      return;
    }
    if (bytes === null) continue;
    if (present) {
      remove(old);
      continue;
    }
    const value = key === SUBMISSIONS_STORAGE_KEY ? renameBrand(bytes) : bytes;
    if (write(key, value) === 'ok') remove(old);
  }
}
