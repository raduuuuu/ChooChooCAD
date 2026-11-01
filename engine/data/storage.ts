/**
 * EVERY WRITE TO BROWSER STORAGE GOES THROUGH HERE (share plan, eng D31, D35).
 *
 * One owner, so a shared link can be opened without any chance of changing
 * the recipient's saved work. A link session turns on a READ-ONLY SESSION
 * before the app mounts; from then on every write is skipped except the keys
 * the session allows (the link's own build progress). Opening the link in
 * the editor is the one sanctioned exception, and it never lifts the switch:
 * `withImport` makes exactly the named keys writable for the length of one
 * call, success or failure (D35).
 *
 *   write(key, value) ─▶ session? ─ key allowed? ─no─▶ 'skipped'
 *                          │no            │yes
 *                          ▼              ▼
 *                     localStorage.setItem ─throws─▶ 'failed'
 *                          └─────────────────────▶ 'ok'
 *
 * 'skipped' is not a failure: callers treat it as stored, so a link session
 * never shows a save-failure notice for writes it chose not to make.
 *
 * `storage.guard.test.ts` reads every source file with the TypeScript parser
 * and fails if anything else calls `localStorage.setItem`, `removeItem` or
 * `clear`, so a write added later cannot walk around the switch.
 *
 * Lives in `engine/data`, not `app/src`, because `library.ts` saves the
 * custom parts and the engine never imports from the app.
 */

export type WriteResult = 'ok' | 'skipped' | 'failed';

/** The keys a session lets through, or null when there is no session. */
let session: ReadonlySet<string> | null = null;
/** Keys an import may write right now (D35); empty outside `withImport`. */
let importing: ReadonlySet<string> = new Set();

const allowed = (key: string): boolean => session === null || session.has(key) || importing.has(key);

/** Store `value` under `key`, unless a read-only session holds it back. Never throws. */
export function write(key: string, value: string): WriteResult {
  if (!allowed(key)) return 'skipped';
  try {
    localStorage.setItem(key, value);
    return 'ok';
  } catch {
    // Private browsing and full quotas both throw; the caller says so.
    return 'failed';
  }
}

/** Remove `key`, unless a read-only session holds it back. Never throws. */
export function remove(key: string): WriteResult {
  if (!allowed(key)) return 'skipped';
  try {
    localStorage.removeItem(key);
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** True when the write landed, or was deliberately skipped by a session. */
export const stored = (r: WriteResult): boolean => r !== 'failed';

/**
 * From now on, only `allow` may be written. Called by the link route before
 * the app mounts. There is no way to end it short of a reload: leaving a link
 * is always a reload into the editor (share plan D8, D28).
 */
export function startReadOnlySession(allow: Iterable<string>): void {
  session = new Set(allow);
}

/** Whether a read-only session is on. */
export const readOnly = (): boolean => session !== null;

/**
 * Run `fn` with `keys` writable too, then put the session back, whether `fn`
 * returns or throws (D35). Outside a session this is just `fn()`.
 */
export function withImport<T>(keys: Iterable<string>, fn: () => T): T {
  const before = importing;
  importing = new Set([...before, ...keys]);
  try {
    return fn();
  } finally {
    importing = before;
  }
}
