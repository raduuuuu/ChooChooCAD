/**
 * WHICH KEYS ARE SAVED LAYOUTS (plan 2026-11-16, saved layouts). On its own
 * so the crash screen, which is on the first-load path, can list and remove
 * them without pulling in the store that reads them (`savedLayouts.ts`,
 * loaded with the My layouts panel).
 *
 * A family of keys, not a string in storageKeys.ts: every export there is one
 * kept key, and the tests on it count them.
 */

/** Every saved layout's key starts with this. */
export const SAVED_PREFIX = 'generic.layouts.v1.';

/** Every key the saved layouts hold now. */
export function savedKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(SAVED_PREFIX)) keys.push(k);
    }
  } catch {
    // Storage that cannot be listed holds nothing this app can show.
  }
  return keys;
}
