import { describe, expect, it } from 'vitest';
import { boxWords, byBox, canBuild, shortBy } from './canBuild.js';
import { presetByLabel, PRESETS } from './presets.js';

/*
 * WHICH READY LAYOUTS THE BOX CAN BUILD (plan 2026-11-14, E2). Each pin names
 * the change that fails it, and each was run.
 */

const circle = presetByLabel('Circle'); // 8 large curves
const stadium = presetByLabel('Stadium'); // 8 large curves, 2 long straights
const nameOf = (id: string) => ({ E: 'Large curve', D: 'Long straight' })[id] ?? id;

describe('your box and the ready layouts', () => {
  /*
   * Fails when: an undeclared box is treated as an empty one (`inventory ?? {}`
   * in `canBuild`): every layout would then read "short of" for a visitor who
   * never said what they own.
   */
  it('says nothing when no box is declared', () => {
    expect(canBuild(null, stadium)).toBe(null);
    expect(boxWords(canBuild(null, stadium), nameOf)).toBe(null);
    expect(byBox(PRESETS, null).map((r) => r.preset.label)).toEqual(PRESETS.map((p) => p.label));
  });

  /*
   * Fails when: the comparison counts kinds of piece, not pieces
   * (`usedCounts` replaced by a set of ids): a box with one large curve would
   * then cover a circle of eight.
   */
  it('a box with every piece covers the layout', () => {
    expect(canBuild({ E: 8 }, circle)).toEqual([]);
    expect(canBuild({ E: 1 }, circle)).toEqual([{ partId: 'E', used: 8, owned: 1, shortBy: 7 }]);
    expect(boxWords([], nameOf)).toEqual({ tag: 'in your box', line: 'Your box has every piece.' });
  });

  /*
   * Fails when: the count in the words is the number of part kinds short, not
   * pieces (`short.length` for `shortBy(short)`): this box is short of two
   * kinds and five pieces.
   */
  it('says how many pieces short, and of what', () => {
    const short = canBuild({ E: 4, D: 1 }, stadium)!;
    expect(shortBy(short)).toBe(5);
    expect(boxWords(short, nameOf)).toEqual({
      tag: 'short of 5',
      line: 'Short of 5 pieces: 1 × Long straight, 4 × Large curve.',
    });
    expect(boxWords(canBuild({ E: 8, D: 1 }, stadium), nameOf)!.line).toBe('Short of 1 piece: 1 × Long straight.');
  });

  /*
   * Fails when: `byBox` returns the layouts unsorted (its last line replaced
   * by `return rows`). Twelve large curves and nothing else cover the Circle
   * and the Bean, so the Bean moves ahead of Stadium, which needs straights;
   * the rest keep their written order. (A box that covers only the Circle
   * cannot fail this: the Circle is written first anyway. That version of the
   * pin was run and stayed green.)
   */
  it('offers the layouts the box covers first', () => {
    const order = byBox(PRESETS, { E: 12 }).map((r) => r.preset.label);
    const rest = PRESETS.map((p) => p.label).filter((l) => l !== 'Circle' && l !== 'Bean');
    expect(order).toEqual(['Circle', 'Bean', ...rest]);
    const all = byBox(PRESETS, { E: 16, D: 4, A: 4 });
    expect(all.filter((r) => r.short!.length === 0).map((r) => r.preset.label)).toEqual(PRESETS.map((p) => p.label));
  });
});
