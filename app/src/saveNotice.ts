/**
 * WHAT THE BROWSER REFUSED TO KEEP (brio-TODOS.md P1, "The three save
 * functions swallow every failure").
 *
 * Each save returns whether `localStorage` took it. Private browsing and a
 * full quota both refuse, and until now the app went on as if it had saved,
 * so a closed tab lost the work without a word. App.tsx keeps one flag per
 * store and shows this sentence while any is set; a later save that succeeds
 * clears its flag.
 */

export type SavedStore = 'layout' | 'table' | 'inventory' | 'submissions';

/** In the order the sentence names them: the track first, measurements last. */
export const SAVED_STORES: readonly SavedStore[] = ['layout', 'table', 'inventory', 'submissions'];

const NAME: Readonly<Record<SavedStore, string>> = {
  layout: 'your layout',
  table: 'your table size',
  inventory: 'your inventory',
  submissions: 'the parts you added',
};

const list = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** The notice for the stores whose last save failed, or undefined when none did. */
export function saveFailureNotice(failed: ReadonlySet<SavedStore>): string | undefined {
  const names = SAVED_STORES.filter((s) => failed.has(s)).map((s) => NAME[s]);
  if (names.length === 0) return undefined;
  return (
    `Not saved: this browser refused to store ${list(names)}. ` +
    'It stays on screen, but is lost when you close or reload this tab. ' +
    'Private browsing and a full browser storage both cause this.'
  );
}
