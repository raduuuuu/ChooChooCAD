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
   * MUTATION PROOF, run: the `previous !== current && !replace` ask removed:
   * `expected { kind: 'opened' } to deeply equal { kind: 'ask', …(2) }`.
   */
  it('a different layout already put aside is never replaced without asking (D29)', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, EARLIER);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'ask', previous: EARLIER, current: MINE });
    expect(slots()).toEqual({ saved: MINE, aside: EARLIER });
    expect(m.openInEditor(LINK, true)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
  });

  it('the same layout already put aside needs no question', () => {
    data.set(GRAPH_STORAGE_KEY, MINE);
    data.set(GRAPH_PREVIOUS_KEY, MINE);
    expect(m.openInEditor(LINK)).toEqual({ kind: 'opened' });
    expect(slots()).toEqual({ saved: LINK, aside: MINE });
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
