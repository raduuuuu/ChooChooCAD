/**
 * Inventory model, task U4 / decisions D6 and D8.
 *
 * Pure functions only, no DOM: the persistence half of the module touches
 * localStorage and is not exercised here, because a document needs task E11.
 * What IS covered is every rule that could silently produce a wrong number.
 */

import { describe, expect, it } from 'vitest';
import { BRIO_PARTS } from '../../engine/data/brio.js';
import {
  QUICK_FILLS,
  shortfalls,
  usedCounts,
  wouldExceed,
  type Inventory,
} from './inventoryModel.js';

describe('undeclared is not zero', () => {
  const used = usedCounts(['E', 'E', 'E']);

  it('an undeclared inventory produces NO shortfall', () => {
    // The failure this prevents: treating null as all-zeroes, which would tell
    // every new user they are short of everything they just placed.
    expect(shortfalls(null, used)).toHaveLength(0);
  });

  it('an undeclared inventory never greys a palette piece', () => {
    for (const p of BRIO_PARTS) {
      expect(wouldExceed(null, used, p.id), p.id).toBe(false);
    }
  });

  it('declaring zero IS a claim, and does produce a shortfall', () => {
    const owned: Inventory = { E: 0 };
    expect(shortfalls(owned, used)).toEqual([{ partId: 'E', used: 3, owned: 0, shortBy: 3 }]);
    expect(wouldExceed(owned, used, 'E')).toBe(true);
  });
});

describe('shortfall arithmetic', () => {
  it('reports only the parts actually short, with the exact amount', () => {
    const used = usedCounts(['E', 'E', 'E', 'E', 'D', 'A2']);
    const owned: Inventory = { E: 2, D: 4, A2: 1 };
    expect(shortfalls(owned, used)).toEqual([{ partId: 'E', used: 4, owned: 2, shortBy: 2 }]);
  });

  it('a part absent from the inventory counts as zero owned, not as unconstrained', () => {
    // Per-part absence is different from a null inventory: the user declared
    // their box and this part was not in it.
    const used = usedCounts(['E1']);
    expect(shortfalls({ E: 8 }, used)).toEqual([
      { partId: 'E1', used: 1, owned: 0, shortBy: 1 },
    ]);
  });

  it('is stably ordered, so the line does not reshuffle as counts change', () => {
    const used = usedCounts(['E', 'A2', 'D', 'A1']);
    const owned: Inventory = {};
    const ids = shortfalls(owned, used).map((s) => s.partId);
    expect(ids).toEqual([...ids].sort());
  });

  it('never reports a shortfall for a part that is exactly used up', () => {
    const used = usedCounts(['E', 'E']);
    expect(shortfalls({ E: 2 }, used)).toHaveLength(0);
    // ...but one MORE would exceed, which is what greys the button.
    expect(wouldExceed({ E: 2 }, used, 'E')).toBe(true);
  });
});

describe('quick-fills write counts and are then forgotten (D6)', () => {
  it('every quick-fill names only parts the catalogue has', () => {
    const known = new Set(BRIO_PARTS.map((p) => p.id));
    for (const q of QUICK_FILLS) {
      for (const id of Object.keys(q.counts)) {
        expect(known.has(id), `${q.label} names ${id}`).toBe(true);
      }
    }
  });

  it('every count is a non-negative integer', () => {
    for (const q of QUICK_FILLS) {
      for (const [id, n] of Object.entries(q.counts)) {
        expect(Number.isInteger(n), `${q.label}/${id}`).toBe(true);
        expect(n, `${q.label}/${id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a quick-fill is just counts: nothing records which one was used', () => {
    // The drift class D6 deletes. If a fill carried an identity that something
    // re-read later, a wrong manifest could corrupt counts invisibly. It does
    // not: the applied value is a plain count map and that is all that is kept.
    const applied: Inventory = { ...QUICK_FILLS[0]!.counts };
    expect(Object.values(applied).every((v) => typeof v === 'number')).toBe(true);
    expect(Object.keys(applied)).not.toContain('label');
    expect(Object.keys(applied)).not.toContain('note');
  });

  it('the circle fill is short for a double circle, which is the point', () => {
    const circle = QUICK_FILLS.find((q) => q.label === 'Enough for a circle')!;
    expect(shortfalls({ ...circle.counts }, usedCounts(Array(8).fill('E')))).toHaveLength(0);
    expect(shortfalls({ ...circle.counts }, usedCounts(Array(16).fill('E')))).toEqual([
      { partId: 'E', used: 16, owned: 8, shortBy: 8 },
    ]);
  });
});

describe('usedCounts', () => {
  it('counts an empty layout as nothing, not as an error', () => {
    expect(usedCounts([])).toEqual({});
  });

  it('counts repeats', () => {
    expect(usedCounts(['E', 'E', 'D'])).toEqual({ E: 2, D: 1 });
  });
});
