/**
 * NO MAKER IS NAMED IN WHAT THE APP SHOWS (design review 2026-11-04, D1, D2).
 *
 * Value: protects=every string a built-in part can put on screen (name,
 * where its size came from, its ends, its decoration), every track system's
 * name, every join reason and every trust note names a physical trait, never
 * a maker
 * Value: fails_when=a part, a system name, a join reason or a trust note
 * spells a maker's name, or a code shown for an id keeps its maker prefix
 * Value: why_new=the systems were named after their makers until this change
 * Value: seam=none: the real library, `brandFit` and `layoutTrust`
 * Value: no_claim=the rendered screens (traitNames.dom.test.tsx); code
 * comments and internal ids, which nobody sees
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { STRUCTURE_WORDS } from '../../engine/data/structureSeeds.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { layoutTrust } from '../../engine/src/joints/trust.js';
import { SYSTEM_NAME, codeOf, type Brand } from '../../engine/src/parts/schema.js';
import { MAKER } from '../test/makers.js';

/** Every string in a part except the internal ids saved layouts and links depend on. */
function shown(v: unknown, key = ''): string[] {
  if (key === 'id' || key === 'brand' || key === 'decoratedFrom') return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap((x) => shown(x));
  if (v !== null && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => shown(x, k));
  return [];
}

describe('no maker is named', () => {
  /*
   * MUTATION PROOF, run:
   * - a curve named 'Lillabo curve, 45°' again: `expected [ 'Lillabo curve,
   *   45°' ] to deeply equal []`.
   * - SYSTEM_NAME.IKEA back to 'IKEA Lillabo': `expected [ 'IKEA Lillabo' ]
   *   to deeply equal []`, and the trust note `expected [ Array(1) ] to
   *   deeply equal []`.
   * - `codeOf` returning the id unchanged: `expected [ 'IKEA-150',
   *   'IKEA-50', …(15) ] to deeply equal []`.
   */
  it('in any built-in part', () => {
    expect(BUILT_IN.flatMap((p) => shown(p)).filter((s) => MAKER.test(s))).toEqual([]);
  });

  it('in the system names, join reasons and structure words', () => {
    const brands = Object.keys(SYSTEM_NAME) as Brand[];
    const reasons = brands.flatMap((a) => brands.map((b) => brandFit(a, b).why));
    const words = Object.values(STRUCTURE_WORDS).flatMap((w) => [w.word, w.carries]);
    expect([...Object.values(SYSTEM_NAME), ...reasons, ...words].filter((s) => MAKER.test(s))).toEqual([]);
  });

  it('in the trust notes for a layout mixing all three systems', () => {
    const r = makeResolver(BUILT_IN);
    const ids = ['A', 'IKEA-C45', 'IKEA-150', 'PLAYTIVE-110'];
    const notes = layoutTrust({ placements: ids.map((partId) => ({ partId, turn: 'left' as const })), closed: true }, r, brandFit);
    expect(notes.map((t) => t.kind)).toContain('brands-do-not-join');
    expect(notes.map((t) => t.detail).filter((s) => MAKER.test(s))).toEqual([]);
  });

  it('in the code shown for any id', () => {
    expect(BUILT_IN.map((p) => codeOf(p.id)).filter((s) => MAKER.test(s))).toEqual([]);
    expect(codeOf('IKEA-C45')).toBe('C45');
    expect(codeOf('E1')).toBe('E1');
  });
});
