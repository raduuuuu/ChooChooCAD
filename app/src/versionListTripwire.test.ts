/**
 * THE VERSION LIST IS DESIGNED, NOT BUILT (design review 2026-11-04, D8, D9).
 *
 * Value: protects=no piece reaches three versions to swap to while the strip
 * still shows one button per version
 * Value: fails_when=a third version of one base piece joins the library
 * Value: why_new=the list was deferred until a real piece needs it
 * Value: seam=none: the real library and `swapsOf`
 * Value: no_claim=the list itself; build it to
 * docs/plan/2026-11-04-version-list-and-trait-names.md, then retire this test
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { swapsOf } from './layoutModel.js';

/** Design 3A and D4: from this many swaps the strip shows "Make it…" and a list. */
const LIST_FROM = 3;

describe('the version-list tripwire', () => {
  /*
   * MUTATION PROOF, run: `LIST_FROM` lowered to 1, as if every decorated
   * family had grown: `Build the version list first
   * (docs/plan/2026-11-04-version-list-and-trait-names.md): A, D, HP, LC, SS,
   * TT have 1+ swaps: expected [ 'A', 'D', 'HP', 'LC', 'SS', 'TT' ] to deeply
   * equal []`.
   */
  it('no piece has three or more versions to swap to yet', () => {
    const resolve = makeResolver(BUILT_IN);
    const crowded = BUILT_IN.filter((p) => swapsOf(p, BUILT_IN, resolve).length >= LIST_FROM).map((p) => p.id);
    expect(
      crowded,
      `Build the version list first (docs/plan/2026-11-04-version-list-and-trait-names.md): ${crowded.join(', ')} have ${LIST_FROM}+ swaps`,
    ).toEqual([]);
  });
});
