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

const everyPart = (n: number): Record<string, number> =>
  Object.fromEntries(BRIO_PARTS.map((p) => [p.id, n]));

export const QUICK_FILLS: readonly QuickFill[] = [
  {
    label: 'A few of each',
    note: '4 of every part in the catalogue. Not a real BRIO set.',
    counts: everyPart(4),
  },
  {
    label: 'Enough for a circle',
    note: '8 large curves and nothing else, so the shortfall line has something to say.',
    counts: { ...everyPart(0), E: 8 },
  },
  {
    label: 'A big box',
    note: '16 of every part. Not a real BRIO set.',
    counts: everyPart(16),
  },
];

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
const KNOWN_PART_IDS: ReadonlySet<string> = new Set(BRIO_PARTS.map((p) => p.id));

export function loadInventory(): Inventory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      // An unknown part id means the catalogue moved under the blob. Discard the
      // whole inventory rather than keeping the half of it that still resolves,
      // which would understate what the user owns without saying so.
      if (!KNOWN_PART_IDS.has(k)) return null;
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
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
