/**
 * Inventory: what track the user actually owns.
 *
 * COUNTS ARE THE TRUTH (decision D6 of the design re-review).
 *
 * The CEO re-review accepted "declare which sets you own" and left the data
 * model open, naming the risk itself: a set manifest is a second body of
 * transcribed third-party data, and a manifest that names a part the catalogue
 * does not have silently corrupts the counts derived from it. The drift is
 * invisible, because nothing downstream can tell a wrong count from a right one.
 *
 * So the manifest is not the stored thing. A COUNT PER PART is, and declaring a
 * set is a one-way fast path: it writes counts and is then forgotten. There is
 * no stored link back to the set, nothing re-reads a manifest later, and a wrong
 * manifest is correctable by editing the number it produced. That deletes the
 * drift class rather than mitigating it.
 *
 * UNDECLARED IS NOT ZERO. `null` means the user has not said, and the product
 * must treat that as unconstrained and say so out loud. Zero means "I own none
 * of these", which is a real and different claim. Collapsing them would render
 * the whole palette as unavailable for every new user.
 *
 * NO REAL SET MANIFESTS SHIP HERE YET. Transcribing BRIO set contents is the
 * same open provenance question flagged over the part data, and inventing
 * plausible-looking contents would be worse than offering none. The fast-path
 * MECHANISM is built and tested; the quick-fills below are described in terms of
 * this catalogue and are labelled as not being official set contents.
 */

import { BRIO_PARTS } from '../../engine/data/brio.js';

/** Count per part id. `null` is UNDECLARED, which is not the same as all zeroes. */
export type Inventory = Readonly<Record<string, number>> | null;

export interface Shortfall {
  readonly partId: string;
  readonly used: number;
  readonly owned: number;
  /** used - owned, always positive. */
  readonly shortBy: number;
}

/**
 * A quick-fill. Deliberately NOT called a set: these are not BRIO set contents.
 * Each writes counts and is then forgotten, which is the whole point of D6.
 */
export interface QuickFill {
  readonly label: string;
  readonly note: string;
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * Quick-fills are BRIO-ONLY, deliberately.
 *
 * A "set you own" is brand-specific: nobody buys a box containing BRIO and IKEA
 * and Playtive track. Once the catalogue gained third-party brands, spanning all
 * of them would have handed a BRIO owner six pieces they do not have, and the
 * third-party sizes are unverified besides. Declaring third-party stock is a
 * manual count, which is what the editable fields are for.
 */
const everyBrioPart = (n: number): Record<string, number> =>
  Object.fromEntries(BRIO_PARTS.map((p) => [p.id, n]));

export const QUICK_FILLS: readonly QuickFill[] = [
  {
    label: 'A few of each',
    note: '4 of every BRIO part. Not a real BRIO set, and no third-party track.',
    counts: everyBrioPart(4),
  },
  {
    label: 'Enough for a circle',
    note: '8 large curves and nothing else, so the shortfall line has something to say.',
    counts: { ...everyBrioPart(0), E: 8 },
  },
  {
    label: 'A big box',
    note: '16 of every BRIO part. Not a real BRIO set, and no third-party track.',
    counts: everyBrioPart(16),
  },
];

/**
 * Turn whatever the count field contains into a storable count, or refuse it.
 *
 * Pure, and in this file rather than in the component, for one reason: the
 * component cannot be tested. There is no DOM environment in the suite until the
 * DOM test project exists, so a guard living inside `Inventory.tsx` is a guard
 * nothing can verify. An earlier version of this fix put it there, and deleting
 * it left all 92 tests green.
 *
 * `null` means REFUSE and show the field as invalid. Returning 0 instead would
 * silently turn a typo into "I own none of these", which is a real claim.
 *
 *   ''      -> 0        blanking a field means zero, documented behaviour
 *   '3'     -> 3
 *   '2.7'   -> 2        floor, not round: you cannot own 2.7 pieces
 *   '-5'    -> 0        clamp, because negative stock is not a thing
 *   'abc'   -> null     REFUSED. Used to become NaN and destroy the whole blob
 *   '1e309' -> null     REFUSED. Infinity, same path
 */
export function sanitizeCount(raw: string): number | null {
  if (raw.trim() === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

/** How many of each part a layout consumes. */
export function usedCounts(partIds: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of partIds) out[id] = (out[id] ?? 0) + 1;
  return out;
}

/**
 * What the layout needs beyond what is owned.
 *
 * Empty when the inventory is UNDECLARED, because an undeclared inventory
 * constrains nothing and inventing a shortfall from it would be a fabrication.
 */
export function shortfalls(inventory: Inventory, used: Readonly<Record<string, number>>): readonly Shortfall[] {
  if (inventory === null) return [];
  const out: Shortfall[] = [];
  for (const [partId, usedN] of Object.entries(used)) {
    const owned = inventory[partId] ?? 0;
    if (usedN > owned) out.push({ partId, used: usedN, owned, shortBy: usedN - owned });
  }
  // Stable order, so the line does not reshuffle as counts change.
  return out.sort((a, b) => a.partId.localeCompare(b.partId));
}

/**
 * Whether one more of this part would exceed what is owned.
 *
 * Advice only (decision D8). This greys a palette button; it never disables one.
 * Always false when undeclared.
 */
export function wouldExceed(
  inventory: Inventory,
  used: Readonly<Record<string, number>>,
  partId: string,
): boolean {
  if (inventory === null) return false;
  return (used[partId] ?? 0) >= (inventory[partId] ?? 0);
}

/*
 * Persistence. Same discipline as the chain in App.tsx: anything unexpected is
 * DISCARDED rather than repaired, because with no version field and no hash
 * there is nothing that could tell a stale blob from a current one.
 *
 * Discarding here returns to UNDECLARED, which is the safe state: the product
 * stops constraining anything and says so, rather than silently showing a
 * shortfall computed from a half-read blob.
 */
const STORAGE_KEY = 'brio.inventory.v0';

/**
 * The outcome of a load, so a discard can be SHOWN rather than swallowed.
 *
 * Returning a bare `Inventory` meant a rejected blob and a genuinely empty one
 * were indistinguishable, so the user saw their counts vanish with no message.
 * That is Prime Directive 1, a silent failure, and it was live in shipped code.
 */
export interface LoadResult<T> {
  readonly value: T;
  /** Present when stored data was rejected. User-facing sentence. */
  readonly discarded?: string;
}

/**
 * Takes the library's ids, because the library is no longer a static list: it
 * includes parts this user submitted. Load submissions, resolve the library,
 * then load inventory against it.
 */
export function loadInventory(knownPartIds: ReadonlySet<string>): LoadResult<Inventory> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { value: null };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { value: null, discarded: 'Your saved inventory could not be read, so it was cleared.' };
    }
    const out: Record<string, number> = {};
    let dropped = 0;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      // An unknown id is DROPPED, not fatal. This differs from the chain loader
      // on purpose. Dropping a piece out of the middle of a chain changes its
      // geometry, so the chain discards wholesale. Dropping one count changes
      // nothing about the other counts, and discarding a whole inventory because
      // one submitted part failed to load would throw away measurements the user
      // took with calipers. Per-entry is the right granularity here.
      if (!knownPartIds.has(k)) { dropped++; continue; }
      // A malformed VALUE is still fatal for the blob: a count that is not a
      // non-negative integer means the writer was broken, not the catalogue.
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        return {
          value: null,
          discarded:
            `Your saved inventory had an unusable count for ${k}, so it was cleared. ` +
            'This is a bug; the app should not have been able to store that.',
        };
      }
      out[k] = v;
    }
    return {
      value: out,
      discarded: dropped > 0
        ? `${dropped} saved ${dropped === 1 ? 'count was' : 'counts were'} for ` +
          'parts no longer in the library, so they were dropped. Your other counts are intact.'
        : undefined,
    };
  } catch {
    return { value: null, discarded: 'Your saved inventory could not be read, so it was cleared.' };
  }
}

export function saveInventory(inventory: Inventory): void {
  try {
    if (inventory === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  } catch {
    // Private browsing and full quotas both throw. Losing persistence is not
    // worth losing the session over.
  }
}
