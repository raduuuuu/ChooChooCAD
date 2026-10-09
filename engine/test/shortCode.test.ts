import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../data/library.js';
import { shortCode } from '../src/parts/schema.js';

describe('shortCode', () => {
  it('strips a part its own brand prefix', () => {
    const ikea = BUILT_IN.find((p) => p.id === 'IKEA-150')!;
    expect(shortCode(ikea)).toBe('150');
    const playtive = BUILT_IN.find((p) => p.id === 'PLAYTIVE-200')!;
    expect(shortCode(playtive)).toBe('200');
  });

  it('leaves a bare id alone', () => {
    const brio = BUILT_IN.find((p) => p.id === 'A2')!;
    expect(shortCode(brio)).toBe('A2');
  });

  /*
   * The defect this exists for. The palette card is a two-column grid whose
   * first column was 2.6ch, sized for "A2". "PLAYTIVE-200" wrapped inside it
   * and printed on top of the part name: the screenshot read "PLAYMIYVE".
   * Nothing stops a future brand from being long, so the CSS floor was raised
   * to minmax(2.6ch, auto) as well. This pins the other half: no code the
   * palette draws is longer than it has to be.
   */
  it('no built-in code is long enough to crowd the card', () => {
    const tooLong = BUILT_IN.filter((p) => shortCode(p).length > 4);
    expect(tooLong.map((p) => p.id)).toEqual([]);
  });

  it('every built-in part keeps a non-empty code', () => {
    for (const p of BUILT_IN) expect(shortCode(p).length).toBeGreaterThan(0);
  });
});
