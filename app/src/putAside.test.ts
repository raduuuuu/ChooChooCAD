/**
 * THE FRIEND'S OWN LAYOUT IS NEVER LOST (share plan, design doc step 3; eng
 * D23, D24, D29, D35, D36, D72).
 *
 * Value: protects=opening a link in the editor replaces only a provably empty
 * layout; otherwise the friend's bytes are put aside first, read back; a
 * different layout already put aside is never replaced without asking; a
 * failed write anywhere leaves both slots as they were; Restore swaps and
 * rolls back, and when even the roll-back fails it hands back the bytes that
 * exist only in memory; inside a link's read-only session the import writes
 * its two keys and nothing else, and the session holds afterwards
 * Value: fails_when=an order of writes changes, a read-back goes, a roll-back
 * is skipped, `replace` is ignored, or the import leaks its keys
 * Value: why_new=the put-aside slot is new
 * Value: seam=none; a Map-backed localStorage that can refuse writes to chosen
 * keys, standing in for a full browser storage
 * Value: no_claim=the screens that ask and explain (putAside.dom.test.tsx)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAPH_PREVIOUS_KEY, GRAPH_RESCUE_KEY, GRAPH_STORAGE_KEY } from './storageKeys.js';

type Mod = typeof import('./putAside.js');
type Storage = typeof import('../../engine/data/storage.js');

let data: Map<string, string>;
/** Keys whose next writes throw, as a full storage would. */
let full: Set<string>;
let m: Mod;
let storage: Storage;

beforeEach(async () => {
  data = new Map();
  full = new Set();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full.has(k)) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => {
      if (full.has(k)) throw new DOMException('quota', 'QuotaExceededError');
      data.delete(k);
    },
  });
  vi.resetModules();
  storage = await import('../../engine/data/storage.js');
  m = await import('./putAside.js');
});

const layout = (n: number) => JSON.stringify({ pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `p${i}`, partId: 'A' })), welds: [], anchors: [] });
const MINE = layout(7);
const EARLIER = layout(42);
const LINK = layout(10);
const slots = () => ({ saved: data.get(GRAPH_STORAGE_KEY) ?? null, aside: data.get(GRAPH_PREVIOUS_KEY) ?? null });

describe('opening a link in the editor', () => {
  it('a provably empty browser just takes the link (D23)', () => {
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: null });
  });

  it('an empty saved layout (zero pieces) is empty too', () => {
    data.set(GRAPH_STORAGE_KEY, layout(0));
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: null });
  });

  /*
   * MUTATION PROOF, run: the put-aside write skipped: `expected { …(2) } to
   * deeply equal { …(2) }`, the friend's layout gone from both slots.
   */
  it("the friend's own layout is put aside first", () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
  });

  /*
   * MUTATION PROOF, run: `holdsOwnLayout` reading a corrupt save as empty
   * (returning false from its catch): `expected { …(2) } to deeply equal {
   * …(2) }`, the corrupt bytes overwritten instead of put aside.
   */
  it('a corrupt save is a layout too: its exact bytes are put aside (D23)', () => {
    data.set(GRAPH_STORAGE_KEY, '{not json');
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: '{not json' });
  });

  /*
   * MUTATION PROOF, run: the ask removed (the `if (!answered) return` line):
   * `expected { kind: 'opened' } to deeply equal { kind: 'ask', …(2) }`.
   */
  it('a different layout already put aside is never replaced without asking (D29)', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'ask', previous: EARLIER, current: MINE });
    expect(slots()).toEqual({ saved: MINE, aside: EARLIER });
    expect(m.openInEditor(LINK, { previous: EARLIER, current: MINE })).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
  });

  /*
   * THE YES ANSWERS THE QUESTION THAT WAS SHOWN (plan 2026-11-16, O3). While
   * the question is on screen another tab puts a different layout aside, or
   * changes the saved one. A bare yes replaced a layout the person never saw.
   *
   * MUTATION PROOFS, run:
   * - any yes accepted (`answered = replace !== false`): `expected { kind:
   *   'opened' } to deeply equal { kind: 'ask', …(2) }`, and the other tab's
   *   layout is gone from both slots.
   * - only the put-aside half compared: the second case fails the same way.
   */
  it('a yes to one question does not replace a layout that arrived after it', () => {
    const OTHER = layout(3);
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    const asked = m.openInEditor(LINK);
    if (asked.kind !== 'ask') throw new Error('expected a question');
    // Another tab puts something else aside before the answer.
    data.set(GRAPH_PREVIOUS_KEY, OTHER);
    expect(m.openInEditor(LINK, asked)).toEqual({ kind: 'ask', previous: OTHER, current: MINE });
    expect(slots()).toEqual({ saved: MINE, aside: OTHER });
    // Or it changes the saved layout: what would go into the slot is no longer what was shown.
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    data.set(GRAPH_STORAGE_KEY, OTHER);
    expect(m.openInEditor(LINK, asked)).toEqual({ kind: 'ask', previous: EARLIER, current: OTHER });
    expect(slots()).toEqual({ saved: OTHER, aside: EARLIER });
  });

  /*
   * WHAT IS PUT ASIDE IS THE LAYOUT ON SCREEN (O1), when the caller has one:
   * the editor's saved slot is behind whenever saving is blocked.
   *
   * MUTATION PROOF, run: `onScreen` ignored (`current = saved`): `expected {
   * …(2) } to deeply equal { …(2) }` (the older saved bytes put aside, and
   * the screen's layout lost).
   */
  it('puts aside the layout on screen, not the older bytes in the saved slot', () => {
    const ON_SCREEN = layout(3);
    data.set(GRAPH_STORAGE_KEY, MINE);
    expect(m.openInEditor(LINK, false, ON_SCREEN)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: ON_SCREEN });
  });

  it('the same layout already put aside needs no question', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
  });

  /*
   * MUTATION PROOF, run: the `current === linkBytes` early return removed:
   * `expected { …(2) } to deeply equal { …(2) }`, the same layout put aside.
   */
  it('your own layout, opened from its own link, puts nothing aside', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    expect(m.openInEditor(MINE)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: MINE, aside: null });
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    expect(m.openInEditor(MINE)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: MINE, aside: EARLIER });
  });

  it('the rescue slot is never touched', () => {
    data.set(GRAPH_RESCUE_KEY, 'rescued bytes');
    m.openInEditor(LINK);
    expect(data.get(GRAPH_RESCUE_KEY)).toBe('rescued bytes');
  });

  /*
   * MUTATION PROOF, run: the roll-back after a failed saved-layout write
   * removed: `expected { …(2) } to deeply equal { …(2) }`, the put-aside slot
   * left changed by an open that reported failure.
   */
  it('a full storage changes nothing (both slots as they were)', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    full.add(GRAPH_PREVIOUS_KEY);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'failed' });
    expect(slots()).toEqual({ saved: MINE, aside: null });
    full.clear();
    full.add(GRAPH_STORAGE_KEY);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'failed' });
    expect(slots()).toEqual({ saved: MINE, aside: null });
  });
});

describe('a failed open says what is true (plan 2026-11-16, O2)', () => {
  /** A storage whose `nth` and later writes to `key` throw, as one that filled part-way. */
  const fillAfter = (key: string, nth: number) => {
    const real = globalThis.localStorage as unknown as { setItem: (k: string, v: string) => void; removeItem: (k: string) => void };
    const set = real.setItem, del = real.removeItem;
    let writes = 0;
    const guard = <T extends unknown[]>(f: (...a: T) => void) => (...a: T) => {
      if (a[0] === key && ++writes >= nth) throw new DOMException('quota', 'QuotaExceededError');
      f(...a);
    };
    real.setItem = guard(set);
    real.removeItem = guard(del);
  };

  /*
   * The put-aside write lands, the saved-slot write fails, and the roll-back
   * of the put-aside slot fails too. The earlier put-aside layout is then in
   * NEITHER slot. This used to return `failed`, which the screen reads as
   * "nothing changed".
   *
   * MUTATION PROOFS, run:
   * - `settle` returning `failed` without looking: `expected { kind: 'failed' }
   *   to deeply equal { kind: 'stranded', bytes: … }`.
   * - the lost layout looked for among the wrong bytes (`atStake` holding only
   *   the current layout): the same failure.
   */
  it('when the roll-back fails too, the layout that is in neither slot comes back', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    full.add(GRAPH_STORAGE_KEY);
    // The put-aside slot takes its first write (MINE), then refuses the roll-back to EARLIER.
    fillAfter(GRAPH_PREVIOUS_KEY, 2);
    expect(m.openInEditor(LINK, { previous: EARLIER, current: MINE })).toEqual({ kind: 'stranded', bytes: EARLIER });
    // Nothing of the friend's own is lost: it is in both slots.
    expect(slots()).toEqual({ saved: MINE, aside: MINE });
  });

  /*
   * MUTATION PROOF, run: `stranded` returned whenever a write fails:
   * `expected { kind: 'stranded', … } to deeply equal { kind: 'failed' }`
   * (a download offered for a layout that is safe where it was).
   */
  it('a write that simply fails still reports failed, with both slots as they were', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    full.add(GRAPH_STORAGE_KEY);
    expect(m.openInEditor(LINK, { previous: EARLIER, current: MINE })).toEqual({ kind: 'failed' });
    expect(slots()).toEqual({ saved: MINE, aside: EARLIER });
  });
});

describe("inside a shared link's read-only session (D35)", () => {
  /*
   * MUTATION PROOF, run: `openInEditor` without its `withImport`: `expected {
   * kind: 'failed' } to deeply equal { kind: 'opened' }`, every write skipped.
   */
  it('the import writes its two keys, and afterwards the session holds again', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    storage.startReadOnlySession(['generic.build.link.v0']);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
    expect(storage.write(GRAPH_STORAGE_KEY, 'later')).toBe('skipped');
    expect(storage.write('generic.view.v0', '3d')).toBe('skipped');
  });

  it('a failed import also leaves the session holding', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    storage.startReadOnlySession([]);
    full.add(GRAPH_PREVIOUS_KEY);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'failed' });
    full.clear();
    expect(storage.write('generic.view.v0', '3d')).toBe('skipped');
    expect(slots()).toEqual({ saved: MINE, aside: null });
  });
});

describe('Restore swaps, and never loses either layout (D24, D36)', () => {
  it('swaps the two', () => {
    data.set(GRAPH_STORAGE_KEY, LINK);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    expect(m.restorePrevious()).toEqual({ kind: 'restored' });
    expect(slots()).toEqual({ saved: MINE, aside: LINK });
  });

  /*
   * MUTATION PROOF, run: the roll-back of the put-aside slot after a failed
   * saved-layout write removed: `expected { …(2) } to deeply equal { …(2) }`,
   * the earlier layout gone from both slots.
   */
  it('a failed write rolls back: both as they were', () => {
    data.set(GRAPH_STORAGE_KEY, LINK);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    full.add(GRAPH_STORAGE_KEY);
    expect(m.restorePrevious()).toEqual({ kind: 'failed' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
  });

  it('when the roll-back fails too, the bytes come back to the caller (D36)', () => {
    data.set(GRAPH_STORAGE_KEY, LINK);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    full.add(GRAPH_STORAGE_KEY);
    // The put-aside slot accepts the first write, then storage fills before the roll-back.
    const realSet = (globalThis.localStorage as { setItem: (k: string, v: string) => void }).setItem;
    let writes = 0;
    (globalThis.localStorage as { setItem: (k: string, v: string) => void }).setItem = (k, v) => {
      if (k === GRAPH_PREVIOUS_KEY && ++writes > 1) throw new DOMException('quota', 'QuotaExceededError');
      realSet(k, v);
    };
    expect(m.restorePrevious()).toEqual({ kind: 'stranded', bytes: MINE });
  });

  it('nothing put aside: nothing to restore', () => {
    data.set(GRAPH_STORAGE_KEY, LINK);
    expect(m.restorePrevious()).toEqual({ kind: 'failed' });
    expect(slots()).toEqual({ saved: LINK, aside: null });
  });
});

describe('a copy that is the saved layout itself', () => {
  /*
   * MUTATION PROOF, run: `dropSameCopy` never removing: `expected { …(2) } to
   * deeply equal { …(2) }`.
   */
  it('is emptied; any other copy stays', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    m.dropSameCopy();
    expect(slots()).toEqual({ saved: MINE, aside: null });
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    m.dropSameCopy();
    expect(slots()).toEqual({ saved: MINE, aside: EARLIER });
  });
});

describe('a copy that gives nothing back', () => {
  /*
   * MUTATION PROOFS, run:
   * - `current` ignored (the saved slot always compared): `expected { saved:
   *   null, aside: '…' } to deeply equal { saved: null, aside: null }`, and
   *   the "just put aside" spec fails the other way round.
   * - the empty-floor test dropped: `expected { …(2) } to deeply equal
   *   { …(2) }`, the empty copy still there.
   */
  it('the layout on screen, not saved yet, is emptied', () => {
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    m.dropSameCopy(EARLIER);
    expect(slots()).toEqual({ saved: null, aside: MINE });
    m.dropSameCopy(MINE);
    expect(slots()).toEqual({ saved: null, aside: null });
  });

  // Clear has put MINE aside and the save of the empty floor has not run yet.
  it('a layout just put aside is kept while the saved slot still holds it', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    m.dropSameCopy(layout(0));
    expect(slots()).toEqual({ saved: MINE, aside: MINE });
  });

  it('an empty floor is emptied', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, layout(0));
    m.dropSameCopy();
    expect(slots()).toEqual({ saved: MINE, aside: null });
  });
});

describe('keeping a layout before it is replaced (ED10)', () => {
  /*
   * MUTATION PROOFS, run:
   * - nothing written (`put` skipped, 'kept' returned): `expected { saved:
   *   null, aside: null } to deeply equal { saved: null, aside: '…' }`.
   * - the empty-floor guard dropped: `expected 'kept' to be 'nothing'`.
   */
  it('goes in the empty slot; an empty floor and unreadable bytes do not', () => {
    expect(m.keepBeforeReplacing(MINE)).toBe('kept');
    expect(slots()).toEqual({ saved: null, aside: MINE });
    data.delete(GRAPH_PREVIOUS_KEY);
    expect(m.keepBeforeReplacing(layout(0))).toBe('nothing');
    expect(m.keepBeforeReplacing('{not json')).toBe('nothing');
    expect(slots()).toEqual({ saved: null, aside: null });
  });

  /*
   * MUTATION PROOF, run: the `previous !== null` guard dropped (the newer
   * layout replaces the older, unasked): `expected 'kept' to be 'occupied'`.
   */
  it('never replaces another layout already put aside (D29), and the same one is kept as it is', () => {
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    expect(m.keepBeforeReplacing(MINE)).toBe('occupied');
    expect(slots().aside).toBe(EARLIER);
    expect(m.keepBeforeReplacing(EARLIER)).toBe('kept');
    expect(slots().aside).toBe(EARLIER);
  });

  /*
   * MUTATION PROOF, run: a failed write reported as kept (`put(…) || true`):
   * `expected 'kept' to be 'failed'`.
   */
  it('a full storage is reported, and the slot is left empty', () => {
    full.add(GRAPH_PREVIOUS_KEY);
    expect(m.keepBeforeReplacing(MINE)).toBe('failed');
    expect(slots().aside).toBeNull();
  });
});

describe('Discard and the summary', () => {
  it('discard empties the put-aside slot', () => {
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    expect(m.discardPrevious()).toBe(true);
    expect(data.has(GRAPH_PREVIOUS_KEY)).toBe(false);
  });

  it('a summary counts pieces, or says the layout cannot be read (D72)', () => {
    expect(m.summaryOf(null)).toEqual({ kind: 'none' });
    expect(m.summaryOf(EARLIER)).toEqual({ kind: 'layout', pieces: 42 });
    expect(m.summaryOf('{not json')).toEqual({ kind: 'unreadable' });
    expect(m.summaryOf('{"pieces":3}')).toEqual({ kind: 'unreadable' });
  });
});
