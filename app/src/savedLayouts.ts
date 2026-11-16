/**
 * SEVERAL SAVED LAYOUTS: THE STORE (plan 2026-11-16, saved layouts; the
 * owner's decisions D1, D5, D7; outside findings O4, O6, O9).
 *
 *   generic.layouts.v1.<id>   ONE KEY PER SAVED LAYOUT
 *     { "name": "Rug loop", "keptAt": "2026-11-16T10:00:00.000Z",
 *       "pieces": 24, "layout": "<the layout's stored bytes, as a string>" }
 *
 *   keep ───▶ a new key; read back; on failure no key is left
 *   update ─▶ re-read the key, write the new layout onto it  ┐ on failure the entry is put
 *   rename ─▶ re-read the key, write the new name onto it    ┘ back; if that fails, `stranded`
 *   remove ─▶ re-read the key, delete it; the exact bytes come back for "Put it back"
 *   putBack ▶ the same bytes to the same key; on failure the caller still holds them
 *
 * NO INDEX, ON PURPOSE. The list is every key with the prefix. Two tabs that
 * each keep a layout write two different keys, so neither can overwrite the
 * other; there is no shared record for a lost write to happen in. The id is
 * random, never a counter two tabs could both pick.
 *
 * EVERY CHANGE TO AN ENTRY RE-READS ITS KEY IN THE SAME STEP AS THE WRITE
 * (O4). A rename made from what a panel drew a minute ago would put an older
 * layout back over another tab's update; a rename made from what is in
 * storage NOW cannot. What is left is the gap between this tab's read and its
 * own write, which a page cannot close.
 *
 * THE LAYOUT IS A STRING, NEVER READ HERE. It is the same bytes the working
 * slot holds, and only the loader that already validates the working layout
 * (`checkStored`) ever looks inside, when one is opened. So there is one
 * validator, and no second layout format.
 *
 * Read by the My layouts panel (`MyLayouts.tsx`), and loaded with it.
 */

import { remove, write } from '../../engine/data/storage.js';
import { SAVED_PREFIX, savedKeys } from './savedKeys.js';

export { SAVED_PREFIX, savedKeys };

export const NAME_MAX = 40;

/** A saved layout as the list draws it. `layout` is opaque here. */
export interface SavedLayout {
  readonly id: string;
  readonly name: string;
  /** When it was kept or last updated, an ISO date. */
  readonly keptAt: string;
  /** A label for the row. Never trusted: the loader counts for itself on opening. */
  readonly pieces: number;
  readonly layout: string;
}

/** A key under the prefix whose value is not a saved layout: one row, saying so (O6). */
export interface Unreadable {
  readonly id: string;
  /** The exact bytes, for "Save to a file" and "Remove". */
  readonly raw: string;
}

export type Row = ({ readonly kind: 'layout' } & SavedLayout) | ({ readonly kind: 'unreadable' } & Unreadable);

const keyOf = (id: string) => SAVED_PREFIX + id;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Write `value` (or remove, for null) and read it back. Exactly what landed, or false. */
function put(key: string, value: string | null): boolean {
  const r = value === null ? remove(key) : write(key, value);
  return r === 'ok' && read(key) === value;
}

/**
 * A name as it will be stored, or null when it cannot be one: trimmed, on one
 * line, 1 to 40 characters. Inner runs of white space become one space, so a
 * pasted line break cannot make a two-line row.
 */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/** "Layout 1", "Layout 2": the first number no saved layout is using. */
export function defaultName(taken: readonly string[]): string {
  const used = new Set(taken);
  let n = 1;
  while (used.has(`Layout ${n}`)) n++;
  return `Layout ${n}`;
}

/**
 * A file name for a saved layout: its name with everything a file system or
 * a download attribute could trip on taken out. A name is the person's own
 * text, and this is the one place it leaves the page.
 */
export function fileNameOf(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-').slice(0, NAME_MAX);
  return `${safe === '' ? 'layout' : safe}.json`;
}

/** THE WHOLE ENTRY, VALIDATED ALONE (O6). Anything else is `null`, and the row says it cannot be read. */
function parse(id: string, raw: string): SavedLayout | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const { name, keptAt, pieces, layout } = v as Record<string, unknown>;
  if (typeof name !== 'string' || cleanName(name) !== name) return null;
  if (typeof keptAt !== 'string' || Number.isNaN(Date.parse(keptAt))) return null;
  if (typeof pieces !== 'number' || !Number.isInteger(pieces) || pieces < 0) return null;
  if (typeof layout !== 'string') return null;
  return { id, name, keptAt, pieces, layout };
}

const rowOf = (id: string, raw: string): Row => {
  const entry = parse(id, raw);
  return entry ? { kind: 'layout', ...entry } : { kind: 'unreadable', id, raw };
};

/**
 * The list: readable layouts newest first, then the entries that cannot be
 * read. One bad entry is one row; it never hides or reorders another.
 */
export function listSaved(): Row[] {
  const rows = savedKeys().flatMap((key) => {
    const raw = read(key);
    return raw === null ? [] : [rowOf(key.slice(SAVED_PREFIX.length), raw)];
  });
  const at = (r: Row) => (r.kind === 'layout' ? Date.parse(r.keptAt) : -Infinity);
  // Ties and unreadable rows fall back to the id, so the order never flickers between renders.
  return rows.sort((a, b) => at(b) - at(a) || a.id.localeCompare(b.id));
}

const bytesOf = (e: Omit<SavedLayout, 'id'>) => JSON.stringify({ name: e.name, keptAt: e.keptAt, pieces: e.pieces, layout: e.layout });

export type KeepResult =
  | { readonly kind: 'kept'; readonly id: string }
  | { readonly kind: 'bad-name' }
  /** Nothing was written: no key is left behind, and nothing else was touched (D7). */
  | { readonly kind: 'failed' };

/**
 * Keep a layout under a new key. `layout` is what is ON SCREEN, serialized
 * as the editor saves it (O1): the caller's to supply, never read from the
 * working slot here.
 */
export function keepLayout(
  rawName: string,
  layout: string,
  pieces: number,
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): KeepResult {
  const name = cleanName(rawName);
  if (name === null) return { kind: 'bad-name' };
  const key = keyOf(id);
  // An id that is somehow in use is not overwritten: that would be losing a layout to keep one.
  if (read(key) !== null) return { kind: 'failed' };
  if (put(key, bytesOf({ name, keptAt: now.toISOString(), pieces, layout }))) return { kind: 'kept', id };
  // A write that half-landed, or landed and read back wrong: take it out again.
  if (read(key) !== null) put(key, null);
  return { kind: 'failed' };
}

export type ChangeResult =
  | { readonly kind: 'done' }
  | { readonly kind: 'bad-name' }
  /** The entry is no longer there (removed in another tab), or cannot be read. */
  | { readonly kind: 'gone' }
  /** The write failed and the entry is as it was. */
  | { readonly kind: 'failed' }
  /** The write AND putting the entry back failed: its bytes exist only here now (O9). */
  | { readonly kind: 'stranded'; readonly raw: string };

/** Re-read, change, write, read back; on failure put back what was read, and say which of the two is true. */
function change(id: string, next: (now: SavedLayout) => Omit<SavedLayout, 'id'>): ChangeResult {
  const key = keyOf(id);
  const raw = read(key);
  const entry = raw === null ? null : parse(id, raw);
  if (raw === null || entry === null) return { kind: 'gone' };
  if (put(key, bytesOf(next(entry)))) return { kind: 'done' };
  // A write that threw changed nothing, so the entry may already be as it was: look, then put back, then look.
  if (read(key) === raw || put(key, raw) || read(key) === raw) return { kind: 'failed' };
  return { kind: 'stranded', raw };
}

/** D1, "Update <name>": the entry's own key takes the layout on screen. Its name and id stay. */
export function updateLayout(id: string, layout: string, pieces: number, now: Date = new Date()): ChangeResult {
  return change(id, (e) => ({ name: e.name, keptAt: now.toISOString(), pieces, layout }));
}

/** The new name goes onto the layout that is in storage now, whatever the panel last drew (O4). */
export function renameLayout(id: string, rawName: string): ChangeResult {
  const name = cleanName(rawName);
  if (name === null) return { kind: 'bad-name' };
  return change(id, (e) => ({ name, keptAt: e.keptAt, pieces: e.pieces, layout: e.layout }));
}

export type RemoveResult =
  /** Gone from storage. `raw` is exactly what was there, for "Put it back" (D5). */
  | { readonly kind: 'removed'; readonly raw: string }
  | { readonly kind: 'gone' }
  /** Still there. */
  | { readonly kind: 'failed' };

/** Works for a row that cannot be read too: it has an id and bytes like any other. */
export function removeLayout(id: string): RemoveResult {
  const key = keyOf(id);
  const raw = read(key);
  if (raw === null) return { kind: 'gone' };
  return put(key, null) ? { kind: 'removed', raw } : { kind: 'failed' };
}

/**
 * "Put it back": the same bytes to the same key. False when it could not be
 * written (the room it freed may be gone) or the key is in use again; the
 * caller still holds `raw` and offers it as a file (O9).
 */
export function putBackLayout(id: string, raw: string): boolean {
  const key = keyOf(id);
  if (read(key) !== null) return false;
  if (put(key, raw)) return true;
  if (read(key) !== null) put(key, null);
  return false;
}
