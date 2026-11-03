/**
 * WHERE PRINTED PARTS COME FROM (docs/plan/2026-11-03-printable-mark.md,
 * decisions 6A, 7A, 8A; the source rule lifted for part origin, 2026-11-03).
 *
 * Value: protects=every part sized from one printable model links to it and
 * credits its creator; a part sized from several models has no link; no
 * origin ever names the brand the app shows as "Generic"; the page address
 * is built from the model id
 * Value: fails_when=an origin points at a part that does not exist, a printed
 * part loses its link, a multi-model part gains one, or the brand name leaks
 * Value: why_new=no origins existed
 * Value: seam=none: the real catalogue and origin table
 * Value: no_claim=that the pages are still online (checked by hand, 2026-11-03)
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../data/library.js';
import { originLabel, originOf, originUrl, PART_ORIGINS } from '../data/origins.js';

const printed = BUILT_IN.filter((p) => /printed reproduction|3D-print/.test(p.dimensions.source));

describe('part origins', () => {
  it('names only parts the catalogue has', () => {
    const ids = new Set(BUILT_IN.map((p) => p.id));
    for (const id of Object.keys(PART_ORIGINS)) expect(ids.has(id), id).toBe(true);
  });

  /*
   * MUTATION PROOF, run: IKEA-205's entry removed from PART_ORIGINS fails
   * with `expected [ 'R', 'S', 'IKEA-150', …(6) ] to deeply equal [ 'R',
   * 'S', 'IKEA-150', …(5) ]`.
   */
  it('every printed part has one, except those sized from several models (7A)', () => {
    const without = printed.filter((p) => !originOf(p)).map((p) => p.id);
    // R and S: sized by the published guide, three reproductions compared.
    expect(without).toEqual(['R', 'S', 'IKEA-150', 'PLAYTIVE-30', 'PLAYTIVE-60', 'PLAYTIVE-110', 'PLAYTIVE-150', 'PLAYTIVE-200']);
  });

  it('the T switch keeps the model it was first drawn from (8A)', () => {
    expect(originOf(BUILT_IN.find((p) => p.id === 'T')!)?.modelId).toBe('904802');
  });

  /*
   * MUTATION PROOF, run: a creator written as "Brio Fan" fails with
   * `expected 'Brio Fan' not to match /brio/i`.
   */
  it('never names the brand the app shows as Generic', () => {
    for (const o of Object.values(PART_ORIGINS)) {
      expect(o.creator).not.toMatch(/brio/i);
      expect(originLabel(o)).not.toMatch(/brio/i);
    }
  });

  it('links to the model page by its id and says it opens a new tab (6A)', () => {
    const o = PART_ORIGINS.L!;
    expect(originUrl(o)).toBe('https://makerworld.com/en/models/1001504');
    expect(originLabel(o)).toBe('Model by Cactus 973 on MakerWorld (opens in a new tab)');
  });
});
