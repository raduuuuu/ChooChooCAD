/**
 * THE ONE OWNER OF STORAGE WRITES (share plan, eng D31, D35).
 *
 * Value: protects=a read-only session skips every key it was not given, an
 * import writes exactly its keys and then puts the session back (also when it
 * throws), and a skipped write is not reported as a failure
 * Value: fails_when=`allowed` ignores the session, `withImport` leaks its keys
 * past its call, or `stored` treats 'skipped' as 'failed'
 * Value: why_new=storage.ts is new; every saver's own tests run with no session
 * Value: seam=none: a Map-backed `localStorage` on globalThis (node has none),
 * and a fresh module per test so the session starts off
 * Value: no_claim=that every write in the app goes through here, which
 * storage.guard.test.ts checks by reading the sources
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type StorageModule = typeof import('../data/storage.js');

let data: Map<string, string>;
let full = false;
let storage: StorageModule;

beforeEach(async () => {
  data = new Map();
  full = false;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
  vi.resetModules();
  storage = await import('../data/storage.js');
});

describe('without a session', () => {
  it('writes and removes', () => {
    expect(storage.write('a', '1')).toBe('ok');
    expect(data.get('a')).toBe('1');
    expect(storage.remove('a')).toBe('ok');
    expect(data.has('a')).toBe(false);
  });

  it('a full storage is a failure, and stored() says so', () => {
    full = true;
    const r = storage.write('a', '1');
    expect(r).toBe('failed');
    expect(storage.stored(r)).toBe(false);
  });
});

describe('a read-only session', () => {
  /*
   * MUTATION PROOF, run: `allowed` returning true always: `expected 'ok' to
   * be 'skipped' // Object.is equality`.
   */
  it('skips every key except the allowed ones, and a skip is not a failure', () => {
    data.set('generic.graph.v1', 'mine');
    storage.startReadOnlySession(['generic.build.link.v0']);
    const r = storage.write('generic.graph.v1', 'theirs');
    expect(r).toBe('skipped');
    expect(storage.stored(r)).toBe(true);
    expect(storage.remove('generic.graph.v1')).toBe('skipped');
    expect(data.get('generic.graph.v1')).toBe('mine');
    expect(storage.write('generic.build.link.v0', '3')).toBe('ok');
    expect(storage.readOnly()).toBe(true);
  });

  /*
   * MUTATION PROOF, run: `withImport` without its `finally` restore: `expected
   * 'ok' to be 'skipped' // Object.is equality` on the write after the throw.
   */
  it('an import writes its keys only during the call, and the session survives a throw (D35)', () => {
    storage.startReadOnlySession([]);
    expect(storage.withImport(['generic.graph.v1'], () => storage.write('generic.graph.v1', 'link'))).toBe('ok');
    expect(storage.write('generic.graph.v1', 'later')).toBe('skipped');
    expect(() =>
      storage.withImport(['generic.graph.v1'], () => {
        throw new Error('quota');
      }),
    ).toThrow('quota');
    expect(storage.write('generic.graph.v1', 'after a failed import')).toBe('skipped');
    expect(storage.write('generic.view.v0', '3d')).toBe('skipped');
    expect(data.get('generic.graph.v1')).toBe('link');
  });
});
