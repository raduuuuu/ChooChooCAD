/**
 * Every browser-storage key this app writes, in one place.
 *
 * Single ownership, for the same reason `trackPath.ts` owns the SVG sweep flag
 * and `inventoryModel.ts` owns the count guard. The error boundary's repro
 * (`repro.ts`) has to read back exactly what the app wrote; if it declared its
 * own copies of these strings, renaming a key here would leave the repro
 * silently reading nothing and reporting an empty layout for a crash that
 * happened with a full one. That is the circular-pin failure this project has
 * now hit four times, so the keys are exported and imported rather than
 * retyped.
 *
 * `repro.test.ts` enforces it: no `localStorage` call anywhere may pass a
 * string literal as its key.
 *
 * The submissions key is NOT here. It belongs to `engine/data/library.ts`,
 * which owns submissions, and the app imports it from there. An engine module
 * must not import from the app.
 */

/** The placed chain. A list of `{ partId, turn }`. */
export const CHAIN_STORAGE_KEY = 'brio.chain.v0';

/** What the user says they own. A map of part id to count. */
export const INVENTORY_STORAGE_KEY = 'brio.inventory.v0';
