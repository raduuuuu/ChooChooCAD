/**
 * SEVERAL SAVED LAYOUTS: THE STORE (plan 2026-11-16, saved layouts).
 *
 * Value: protects=a layout is kept under a key of its own and listed newest
 * first; a name is trimmed, one line and 1 to 40 characters; two tabs that
 * both read the list and then both keep a layout leave two layouts; an
 * update or a rename is made onto what is in storage at that moment, so a
 * rename cannot undo another tab's update; a failed keep leaves no key, a
 * failed update or rename leaves the entry as it was or hands its bytes
 * back, a remove returns the exact bytes and put-back restores them; an
 * entry that is damaged in any field is one row that hides no other; the
 * layout inside an entry is never read; a file name made from a name is safe
 * Value: fails_when=a layout is lost to another tab's write, a failure is
 * reported as success or leaves half an entry, one bad entry empties or
 * breaks the list, or a name reaches a file name or a row unbounded
 * Value: why_new=the store is new; nothing reads it yet
 * Value: seam=`localStorage` stubbed with a Map that can be told to refuse a
 * key, as putAside.test.ts does; two tabs are two interleaved call sequences
 * on the one store
 * Value: no_claim=a real full store, two real tabs, and the gap between one
 * tab's read and its own write, which a page cannot close
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('./savedLayouts.js');
let data: Map<string, string>;
/** Keys whose writes and removals throw, as a full storage would. */
let full: Set<string>;
let m: Mod;

beforeEach(async () => {
  data = new Map();
  full = new Set();
  const refuse = (k: string) => {
    if (full.has(k) || full.has('*')) throw new DOMException('quota', 'QuotaExceededError');
  };
  vi.stubGlobal('localStorage', {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      refuse(k);
      data.set(k, v);
    },
    removeItem: (k: string) => {
      refuse(k);
      data.delete(k);
    },
  });
  vi.resetModules();
  m = await import('./savedLayouts.js');
});

const layout = (n: number) => JSON.stringify({ pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `p${i}`, partId: 'A' })), welds: [], anchors: [] });
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 10));
const key = (id: string) => `generic.layouts.v1.${id}`;
const names = () => m.listSaved().map((r) => (r.kind === 'layout' ? r.name : `unreadable:${r.id}`));

describe('keeping and listing', () => {
  /*
   * MUTATION PROOFS, run:
   * - the list sorted oldest first: `expected [ 'Rug loop', 'Table' ] to
   *   deeply equal [ 'Table', 'Rug loop' ]`.
   * - the entry's `layout` re-encoded (parsed and stringified) on the way in:
   *   `expected { kind: 'layout', id: 'b', …(4) } to deeply equal { kind:
   *   'layout', id: 'b', …(4) }` (bytes the working slot never held).
   */
  it('keeps a layout under its own key, newest first, with the bytes untouched', () => {
    const odd = `  ${layout(2).replace('"pieces":', '"pieces" :')}`;
    expect(m.keepLayout('Rug loop', layout(24), 24, day(14), 'a')).toEqual({ kind: 'kept', id: 'a' });
    expect(m.keepLayout('Table', odd, 2, day(16), 'b')).toEqual({ kind: 'kept', id: 'b' });
    expect([...data.keys()].sort()).toEqual([key('a'), key('b')]);
    expect(names()).toEqual(['Table', 'Rug loop']);
    const table = m.listSaved()[0]!;
    expect(table).toEqual({ kind: 'layout', id: 'b', name: 'Table', keptAt: '2026-11-16T10:00:00.000Z', pieces: 2, layout: odd });
  });

  /*
   * MUTATION PROOF, run:
   * - an id already in use overwritten: `expected { kind: 'kept', id: 'a' }
   *   to deeply equal { kind: 'failed' }` (a layout lost to keep another).
   */
  it('a keep that cannot be written leaves no key, and never overwrites an id in use', () => {
    full.add(key('a'));
    expect(m.keepLayout('Rug loop', layout(3), 3, day(14), 'a')).toEqual({ kind: 'failed' });
    expect(data.size).toBe(0);
    full.clear();
    m.keepLayout('First', layout(1), 1, day(14), 'a');
    expect(m.keepLayout('Rug loop', layout(3), 3, day(15), 'a')).toEqual({ kind: 'failed' });
    expect(names()).toEqual(['First']);
  });

  /*
   * TWO TABS. Both read the list (each sees it empty), then both keep. With
   * a shared index the second write would carry a list without the first.
   *
   * MUTATION PROOF, run: every layout written to ONE key (`keyOf` ignoring
   * the id): the second keep finds the key in use, `expected { kind: 'failed'
   * } to deeply equal { kind: 'kept', id: 'b' }` in the spec before this one,
   * and here `expected 'failed' to be 'kept'`.
   */
  it('two tabs that both read, then both keep, leave two layouts', () => {
    const seenByA = m.listSaved();
    const seenByB = m.listSaved();
    expect(seenByA).toEqual([]);
    expect(seenByB).toEqual([]);
    expect(m.keepLayout(m.defaultName([]), layout(4), 4, day(14)).kind).toBe('kept');
    expect(m.keepLayout(m.defaultName([]), layout(6), 6, day(15)).kind).toBe('kept');
    // Both chose "Layout 1": names may repeat, and the rows still differ.
    expect(m.listSaved().map((r) => (r.kind === 'layout' ? [r.name, r.pieces] : r))).toEqual([['Layout 1', 6], ['Layout 1', 4]]);
    data.clear();
    m.keepLayout('From tab A', layout(1), 1, day(14));
    m.keepLayout('From tab B', layout(2), 2, day(15));
    expect(names()).toEqual(['From tab B', 'From tab A']);
  });
});

describe('a name', () => {
  /*
   * MUTATION PROOFS, run:
   * - the length bound dropped: `expected 'xxxxxxxx…' to be null` (41).
   * - inner white space left alone: `expected 'Rug\nloop' to be 'Rug loop'`.
   */
  it('is trimmed, on one line, and 1 to 40 characters', () => {
    expect(m.cleanName('  Rug   loop \n')).toBe('Rug loop');
    expect(m.cleanName('Rug\nloop')).toBe('Rug loop');
    expect(m.cleanName('x'.repeat(40))).toBe('x'.repeat(40));
    for (const bad of ['', '   ', '\n', 'x'.repeat(41)]) expect(m.cleanName(bad), JSON.stringify(bad)).toBeNull();
    expect(m.keepLayout('   ', layout(1), 1)).toEqual({ kind: 'bad-name' });
    expect(data.size).toBe(0);
    // Markup is a name like any other: it is text, and the row draws it as text.
    expect(m.cleanName('<b>mine</b>')).toBe('<b>mine</b>');
  });

  /*
   * MUTATION PROOF, run: `defaultName` counting the list in place of looking
   * for a free number: `expected 'Layout 4' to be 'Layout 2'`.
   */
  it('defaults to the first "Layout N" not in use', () => {
    expect(m.defaultName([])).toBe('Layout 1');
    expect(m.defaultName(['Layout 1', 'Rug loop', 'Layout 3'])).toBe('Layout 2');
    expect(m.defaultName(['Layout 1', 'Layout 2'])).toBe('Layout 3');
  });

  /*
   * MUTATION PROOF, run: the name used as the file name unchanged: `expected
   * 'Rug loop.json' to be 'Rug-loop.json'`, and the path and the markup pass
   * through in the expectation after it.
   */
  it('becomes a file name with nothing a file system or a download could trip on', () => {
    expect(m.fileNameOf('Rug loop')).toBe('Rug-loop.json');
    expect(m.fileNameOf('../../etc/passwd<b>')).toBe('etcpasswdb.json');
    expect(m.fileNameOf('🚂')).toBe('layout.json');
    expect(m.fileNameOf('a\r\nb')).toBe('ab.json');
  });
});

describe('changing an entry', () => {
  /*
   * RENAME AFTER ANOTHER TAB'S UPDATE (O4). This tab drew the entry holding
   * four pieces. Another tab updates it to nine. This tab then renames it.
   *
   * MUTATION PROOF, run: rename not carrying the layout it re-read (writing
   * an empty one): `expected [ { kind: 'layout', id: 'a', …(4) } ] to deeply
   * equal [ { kind: 'layout', id: 'a', …(4) } ]`, the update gone.
   */
  it('a rename keeps the layout another tab has just updated', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    const drawn = m.listSaved()[0]!;
    expect(drawn.kind === 'layout' && drawn.pieces).toBe(4);
    // The other tab:
    expect(m.updateLayout('a', layout(9), 9, day(15))).toEqual({ kind: 'done' });
    // This tab, still showing four pieces:
    expect(m.renameLayout('a', 'Living room')).toEqual({ kind: 'done' });
    expect(m.listSaved()).toEqual([{ kind: 'layout', id: 'a', name: 'Living room', keptAt: '2026-11-15T10:00:00.000Z', pieces: 9, layout: layout(9) }]);
  });

  /*
   * MUTATION PROOFS, run:
   * - update changing the name too: `expected 'Layout 1' to be 'Rug loop'`.
   * - update writing a new key: `expected 2 to be 1`.
   */
  it('an update changes that entry and no other, and keeps its name', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    m.keepLayout('Table', layout(2), 2, day(13), 'b');
    expect(m.updateLayout('a', layout(5), 5, day(16))).toEqual({ kind: 'done' });
    expect(data.size).toBe(2);
    expect(m.listSaved().map((r) => (r.kind === 'layout' ? [r.id, r.name, r.pieces] : r))).toEqual([['a', 'Rug loop', 5], ['b', 'Table', 2]]);
  });

  /*
   * MUTATION PROOFS, run:
   * - a failed update reported as done: `expected { kind: 'done' } to deeply
   *   equal { kind: 'failed' }`.
   * - `stranded` never returned (`failed` whenever the write fails): the last
   *   expectation, `expected { kind: 'failed' } to deeply equal { kind:
   *   'stranded', raw: … }`.
   */
  it('a failed update or rename leaves the entry as it was, or hands its bytes back', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    const before = data.get(key('a'))!;
    full.add(key('a'));
    expect(m.updateLayout('a', layout(9), 9, day(15))).toEqual({ kind: 'failed' });
    expect(m.renameLayout('a', 'Other')).toEqual({ kind: 'failed' });
    expect(data.get(key('a'))).toBe(before);
    // A write that lands wrong (another writer between this tab's write and its look), then cannot be put back.
    full.clear();
    const store = globalThis.localStorage as unknown as { setItem: (k: string, v: string) => void };
    let writes = 0;
    store.setItem = (k, v) => {
      if (++writes > 1) throw new DOMException('quota', 'QuotaExceededError');
      data.set(k, `${v} `);
    };
    expect(m.updateLayout('a', layout(9), 9, day(15))).toEqual({ kind: 'stranded', raw: before });
  });

  it('an entry that is gone, or a name that is not one, changes nothing', () => {
    expect(m.updateLayout('nope', layout(1), 1)).toEqual({ kind: 'gone' });
    expect(m.renameLayout('nope', 'x')).toEqual({ kind: 'gone' });
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    const before = data.get(key('a'));
    expect(m.renameLayout('a', '   ')).toEqual({ kind: 'bad-name' });
    expect(data.get(key('a'))).toBe(before);
  });
});

describe('removing and putting back', () => {
  /*
   * MUTATION PROOFS, run:
   * - put-back overwriting a key that is in use again: `expected true to be false`.
   * - a failed put-back reported as done: `expected true to be false`.
   */
  it('remove hands back the exact bytes, and put-back restores them or says it could not', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    const before = data.get(key('a'))!;
    const removed = m.removeLayout('a');
    expect(removed).toEqual({ kind: 'removed', raw: before });
    expect(data.size).toBe(0);
    expect(m.putBackLayout('a', before)).toBe(true);
    expect(data.get(key('a'))).toBe(before);
    // In use again: never overwritten.
    expect(m.putBackLayout('a', 'other')).toBe(false);
    expect(data.get(key('a'))).toBe(before);
    // The room it freed is gone: the caller keeps the bytes.
    m.removeLayout('a');
    full.add(key('a'));
    expect(m.putBackLayout('a', before)).toBe(false);
    expect(data.size).toBe(0);
  });

  /*
   * REMOVE AFTER ANOTHER TAB'S UPDATE: what comes back is what was actually
   * removed. MUTATION PROOF, run: an update that reports done and writes
   * nothing: `expected [ 4 ] to deeply equal [ 9 ]` here, with the update's
   * own specs failing beside it.
   */
  it('what is put back is what was removed, even when another tab updated it first', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    m.updateLayout('a', layout(9), 9, day(15));
    const removed = m.removeLayout('a');
    if (removed.kind !== 'removed') throw new Error('expected a removal');
    m.putBackLayout('a', removed.raw);
    expect(m.listSaved().map((r) => r.kind === 'layout' && r.pieces)).toEqual([9]);
  });

  /*
   * MUTATION PROOF, run: a remove that could not be written reported as
   * removed: `expected { kind: 'removed', …(1) } to deeply equal { kind:
   * 'failed' }`.
   */
  it('a remove that cannot be written leaves the entry, and one that is gone says so', () => {
    m.keepLayout('Rug loop', layout(4), 4, day(14), 'a');
    full.add(key('a'));
    expect(m.removeLayout('a')).toEqual({ kind: 'failed' });
    expect(data.size).toBe(1);
    expect(m.removeLayout('nope')).toEqual({ kind: 'gone' });
  });
});

describe('an entry that is damaged', () => {
  const good = () => m.keepLayout('Rug loop', layout(4), 4, day(14), 'good');
  const entry = (over: object) => JSON.stringify({ name: 'X', keptAt: '2026-11-15T10:00:00.000Z', pieces: 1, layout: layout(1), ...over });

  /*
   * MUTATION PROOFS, run:
   * - only JSON and a string `layout` checked: `expected [ { toString: 1 },
   *   'Rug loop' ] to deeply equal [ 'Rug loop', 'unreadable:bad' ]` (an
   *   object for a name, drawn as a layout and sorted first).
   * - one bad entry throwing out of the list: `SyntaxError: Expected property
   *   name or '}' in JSON` from `listSaved`, the good layout hidden with it.
   */
  it.each([
    ['not JSON', '{not json'],
    ['not an object', '7'],
    ['a name that is not a string', entry({ name: { toString: 1 } })],
    ['an empty name', entry({ name: '   ' })],
    ['a name with a line break', entry({ name: 'a\nb' })],
    ['a name too long', entry({ name: 'x'.repeat(41) })],
    ['a date that does not parse', entry({ keptAt: 'yesterday' })],
    ['a count that is not a number', entry({ pieces: '4' })],
    ['a count that is not whole', entry({ pieces: 1.5 })],
    ['a layout that is not a string', entry({ layout: { pieces: [] } })],
  ])('with %s is one row, and hides no other', (_, raw) => {
    good();
    data.set(key('bad'), raw);
    expect(names()).toEqual(['Rug loop', 'unreadable:bad']);
    expect(m.listSaved()[1]).toEqual({ kind: 'unreadable', id: 'bad', raw });
    // It can still be removed, and put back, byte for byte.
    expect(m.removeLayout('bad')).toEqual({ kind: 'removed', raw });
    expect(names()).toEqual(['Rug loop']);
  });

  /*
   * THE LAYOUT INSIDE IS NOT THIS MODULE'S TO JUDGE. MUTATION PROOF, run:
   * `parse` also requiring `layout` to be JSON: `expected [ 'unreadable:odd' ]
   * to deeply equal [ 'X' ]` (a layout only the loader may refuse, hidden
   * from the list where it could have been saved to a file by name).
   */
  it('an entry whose inner layout is not a layout is still listed: only opening reads it', () => {
    data.set(key('odd'), entry({ layout: '{not a layout' }));
    expect(names()).toEqual(['X']);
  });

  /*
   * MUTATION PROOF, run: `savedKeys` returning every key: `expected [
   * 'generic.layouts.v1.good', …(2) ] to deeply equal [
   * 'generic.layouts.v1.good' ]` (the working layout listed, and later
   * removable, as a saved one).
   */
  it('only keys under the prefix are saved layouts', () => {
    good();
    data.set('generic.graph.v1', layout(3));
    data.set('someone.elses', 'x');
    expect(m.savedKeys()).toEqual([key('good')]);
    expect(names()).toEqual(['Rug loop']);
  });
});
