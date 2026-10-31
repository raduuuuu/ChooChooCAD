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

/**
 * The placed chain. A list of `{ partId, turn }`.
 *
 * SUPERSEDED by GRAPH_STORAGE_KEY. Kept only so the loader can notice an old
 * blob and say the layout could not be carried over, rather than starting
 * empty with no explanation. Nothing writes it any more.
 */
export const CHAIN_STORAGE_KEY = 'brio.chain.v0';

/**
 * The layout, as a graph: pieces, declared welds, and captured anchors.
 *
 * A NEW KEY, not a bumped version of the chain one. The shapes have nothing
 * in common and `closed: boolean` is gone, so there is no migration to write
 * and no blob that could be half-read as either. T3's owed storage bump,
 * settled here because this is the first time anchors are persisted at all.
 */
export const GRAPH_STORAGE_KEY = 'brio.graph.v1';

/** What the user says they own. A map of part id to count. */
export const INVENTORY_STORAGE_KEY = 'brio.inventory.v0';

/** The table or room the track must fit on: `{ widthMm, depthMm }` (backlog E4). */
export const TABLE_STORAGE_KEY = 'brio.table.v0';

/**
 * The last layout blob this app REFUSED to load, kept verbatim (task T5, E1).
 *
 * The loader used to be the end of the story for a damaged save: it returned
 * `EMPTY_GRAPH`, and `App.tsx`'s save effect then wrote that empty graph back
 * over the unreadable bytes at first paint, before the notice telling the user
 * anything had rendered. The original was gone and nothing could recover it,
 * which is Prime Directive 1's exact failure arriving zero interactions after
 * the load rather than one.
 *
 * So the raw string is copied here first, untouched and unparsed. It is never
 * read by the app and never migrated; it exists so a user who loses a layout
 * has something to send, and so the loss is recoverable by hand.
 */
export const GRAPH_RESCUE_KEY = 'brio.graph.v1.rejected';

/** Which view was last shown, '2d' or '3d' (3D plan, eng D10, design 11A). Per browser. */
export const VIEW_STORAGE_KEY = 'brio.view.v0';

/**
 * Where a build was left (build mode plan, scope 5, D18): `{ layout, index }`,
 * the layout's hash and the position in build mode's one list. Only the latest
 * build is kept; reaching the last piece clears it.
 */
export const BUILD_STORAGE_KEY = 'brio.build.v0';
