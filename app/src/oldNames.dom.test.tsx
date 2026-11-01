/**
 * SAVED DATA SURVIVES THE RENAME (2026-11-01).
 *
 * Value: protects=a visitor's saved layout, table, inventory, build progress
 * and custom parts, stored under the old key names, are there on the next
 * visit under the new ones; custom parts keep their brand under its new name
 * Value: fails_when=a persisted key is left out of the move, the old copy is
 * deleted before the new one holds it, or a newer value is overwritten
 * Value: why_new=the keys were renamed; without the move every saved layout
 * would read as empty
 * Value: seam=jsdom localStorage, through the same `storage.ts` writes the
 * app uses
 * Value: no_claim=nothing about the bytes' contents beyond the brand; each
 * loader's own suite owns those
 */

import { describe, expect, it } from 'vitest';
import * as keys from './storageKeys.js';
import { MOVED_KEYS, moveOldNames, oldKeyOf } from './oldNames.js';
import { SUBMISSIONS_STORAGE_KEY } from '../../engine/data/library.js';

describe('saved data under the old key names', () => {
  /*
   * MUTATION PROOF, run: TABLE_STORAGE_KEY dropped from MOVED_KEYS fails with
   * `expected [ 'generic.table.v0' ] to deeply equal []`.
   */
  it('every persisted key is moved', () => {
    const persisted = [...Object.values(keys), SUBMISSIONS_STORAGE_KEY].filter((v): v is string => typeof v === 'string');
    expect(persisted.filter((k) => !MOVED_KEYS.includes(k))).toEqual([]);
    for (const k of persisted) expect(k.startsWith('generic.')).toBe(true);
  });

  it('moves each value to its new key and removes the old one', () => {
    for (const k of MOVED_KEYS) localStorage.setItem(oldKeyOf(k), `bytes of ${k}`);
    moveOldNames();
    for (const k of MOVED_KEYS) {
      expect(localStorage.getItem(oldKeyOf(k))).toBeNull();
      if (k !== SUBMISSIONS_STORAGE_KEY) expect(localStorage.getItem(k)).toBe(`bytes of ${k}`);
    }
  });

  it('keeps a value already under the new key, and drops the old copy', () => {
    localStorage.setItem(keys.GRAPH_STORAGE_KEY, 'newer');
    localStorage.setItem(oldKeyOf(keys.GRAPH_STORAGE_KEY), 'older');
    moveOldNames();
    expect(localStorage.getItem(keys.GRAPH_STORAGE_KEY)).toBe('newer');
    expect(localStorage.getItem(oldKeyOf(keys.GRAPH_STORAGE_KEY))).toBeNull();
  });

  /*
   * MUTATION PROOF, run: `renameBrand` returning its input unchanged fails
   * with `expected 'BRIO' to be 'GENERIC'`.
   */
  it('custom parts keep their brand under its new name, and other brands as they were', () => {
    const rows = [
      { submissionId: 's1', at: '2026-10-01', part: { id: 'MINE', brand: 'BRIO', kind: 'straight' } },
      { submissionId: 's2', at: '2026-10-01', part: { id: 'IK', brand: 'IKEA', kind: 'straight' } },
    ];
    localStorage.setItem(oldKeyOf(SUBMISSIONS_STORAGE_KEY), JSON.stringify(rows));
    moveOldNames();
    const moved = JSON.parse(localStorage.getItem(SUBMISSIONS_STORAGE_KEY)!);
    expect(moved[0].part.brand).toBe('GENERIC');
    expect(moved[1].part.brand).toBe('IKEA');
    expect(moved[0].part.id).toBe('MINE');
  });

  it('unreadable custom parts move byte for byte', () => {
    localStorage.setItem(oldKeyOf(SUBMISSIONS_STORAGE_KEY), '{not json');
    moveOldNames();
    expect(localStorage.getItem(SUBMISSIONS_STORAGE_KEY)).toBe('{not json');
  });

  /*
   * MUTATION PROOF, run: the old key removed whatever the write returned
   * fails with `expected null to be 'older'`.
   */
  it('keeps the old copy when the browser refuses the write', () => {
    localStorage.setItem(oldKeyOf(keys.TABLE_STORAGE_KEY), 'older');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      moveOldNames();
    } finally {
      Storage.prototype.setItem = setItem;
    }
    expect(localStorage.getItem(oldKeyOf(keys.TABLE_STORAGE_KEY))).toBe('older');
    expect(localStorage.getItem(keys.TABLE_STORAGE_KEY)).toBeNull();
  });
});
