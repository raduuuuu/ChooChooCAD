/**
 * A PIECE FROM SOMEONE ELSE, CHECKED (contributor-brief plan, step 3 and
 * Section 3; T3).
 *
 * Value: protects=a crafted or mistaken piece never reaches the renderer or
 * the maintainer unbounded: numbers in range, strings capped and brand-free,
 * ids new, status unverified, a multi-road piece's roads landing on its ends,
 * a decorated spec's derive errors said rather than thrown
 * Value: fails_when=a check is dropped or loosened past what a built-in needs
 * Value: why_new=only typed straights and curves were checked before
 * (looksLikePart); a preview link can carry any kind and its decoration
 * Value: seam=checkUntrustedPart over JSON made from the built-in catalogue
 * Value: no_claim=that an accepted piece measures right (the review does)
 */

import { describe, expect, it } from 'vitest';
import type { MultiRoadPart } from '../src/parts/schema.js';
import { asSubmission, specAs } from '../test/submissions.js';
import { TERMS } from './brandWords.js';
import { DECORATED_SEEDS } from './decoratedSeeds.js';
import { BUILT_IN, isStructure, makeResolver } from './library.js';
import { checkUntrustedPart, MAX_REASONS } from './untrustedPart.js';

const builtIn = makeResolver(BUILT_IN);

const reasons = (data: unknown): readonly string[] => {
  const r = checkUntrustedPart(data);
  return r.ok ? [] : r.reasons;
};

describe('the bounds fit every piece the library already holds', () => {
  /*
   * MUTATION PROOF, run: MAX_TEXT.source at 400 (the double-arch bridge's is
   * 441). Fails with `AssertionError: DA: expected [ Array(1) ] to deeply
   * equal []`.
   */
  it('every built-in piece but a structure, sent as a submission, is accepted', () => {
    for (const p of BUILT_IN) {
      if (isStructure(p) || p.decoratedFrom !== undefined) continue;
      expect(reasons(asSubmission(p, `${p.brand}-NEW${p.id.replace(/-/g, '')}`)), p.id).toEqual([]);
    }
    for (const seed of DECORATED_SEEDS) expect(reasons(specAs(`N${seed.id}`, seed)), seed.id).toEqual([]);
  });
});

describe('a multi-road piece whose roads and ends disagree', () => {
  /*
   * MUTATION PROOF, run: the `out.push` in multiRoadReasons' walk made a
   * no-op. Fails with `AssertionError: expected [] to have a length of 2 but
   * got +0`.
   */
  it('a road whose far end misses its port is refused, both ways up, naming the road', () => {
    const l = asSubmission(builtIn('L'), 'L9') as unknown as { ports: { at: { pos: number[] } }[] };
    l.ports[2]!.at.pos[0] = 1;
    const got = reasons(l);
    expect(got).toHaveLength(2);
    expect(got[0]).toMatch(/^roads\[1\]: walked from end 0 \(placed left\), it ends at pos \[0, 0, 0, 0, 202, 0, -202, 0\] heading 2, not on end 2/);
    expect(got[1]).toMatch(/^roads\[1\]: walked from end 0 \(placed right\)/);
  });

  /*
   * MUTATION PROOF, run: the "is on no road" check made `if (false)`. Fails
   * with `AssertionError: expected [] to deeply equal [ 'ports[3]: end 3 is
   * on no road' ]`.
   */
  it('an end on no road is refused', () => {
    const l = asSubmission(builtIn('L'), 'L9') as unknown as { ports: unknown[] };
    l.ports.push({ at: { pos: [300, 0, 0, 0, 0, 0, 0, 0], heading: 0 }, polarity: 'peg', name: 'stray end' });
    expect(reasons(l)).toEqual(['ports[3]: end 3 is on no road']);
  });

  /*
   * MUTATION PROOF, run: the entry check made `if (false)`. Fails with
   * `AssertionError: expected 'roads[0]: walked from end 0 (placed l…' to be
   * 'ports[0].at: end 0 must be the entry,…'`: only the walks were left.
   */
  it('end 0 off the origin is refused, and a road to an end that is not there', () => {
    const tj = asSubmission(builtIn('TJ'), 'TJ9') as unknown as MultiRoadPart & { ports: { at: { heading: number } }[]; roads: { to: number }[] };
    tj.ports[0]!.at.heading = 0;
    expect(reasons(tj)[0]).toBe('ports[0].at: end 0 must be the entry, at the origin facing back (pos all 0, heading 8)');
    const bad = asSubmission(builtIn('TJ'), 'TJ9') as unknown as { roads: { to: number }[] };
    bad.roads[2]!.to = 7;
    expect(reasons(bad)).toEqual(['roads[2]: joins end 7, but the piece has ends 0 to 2']);
  });
});

describe('numbers', () => {
  /*
   * MUTATION PROOF, run: `&& v <= max` dropped from `num`. Fails with
   * `AssertionError: expected [] to deeply equal [ Array(1) ]` (5000 and
   * Infinity pass), and the next test the same way (-2000 passes).
   */
  it('out of range or not finite is refused, naming the field', () => {
    const big = { ...asSubmission(builtIn('A'), 'A9'), lengthMm: 5000 };
    expect(reasons(big)).toEqual(['lengthMm: must be a number over 0 to 1000, not 5000']);
    // JSON can't write Infinity, but 1e999 parses to it.
    const inf = JSON.parse(JSON.stringify(asSubmission(builtIn('A'), 'A9')).replace('"lengthMm":144', '"lengthMm":1e999'));
    expect(reasons(inf)).toEqual(['lengthMm: must be a number over 0 to 1000, not Infinity']);
    const slop = { ...asSubmission(builtIn('A'), 'A9'), slop: { axialMm: 50, angularDeg: 1.5, calibrationStatus: 'estimated' } };
    expect(reasons(slop)).toEqual(['slop.axialMm: must be a number from 0 to 5, not 50']);
  });

  /*
   * MUTATION PROOF, run: ARC_STEPS as num(0, 16). Fails with
   * `AssertionError: expected [] to deeply equal [ Array(1) ]`.
   */
  it('a curve that turns all the way round, and a shape coordinate out of range, are refused', () => {
    expect(reasons({ ...asSubmission(builtIn('E'), 'E9'), arcSteps: 16 })).toEqual(['arcSteps: must be a whole number from 1 to 15, not 16']);
    const spec = specAs('LC9') as { decor: { atMm: number[] }[] };
    spec.decor[0]!.atMm[1] = -2000;
    expect(reasons(spec)).toEqual(['decor[0].atMm[1]: must be a number from -1000 to 1000, not -2000']);
  });
});

describe('strings and ids', () => {
  const brand = TERMS[0]!;
  const Cap = `${brand[0]!.toUpperCase()}${brand.slice(1)}`;

  /*
   * MUTATION PROOF, run: the brand check in `text` made `if (false)`. Fails
   * with `AssertionError: expected [] to deeply equal [ Array(1) ]`.
   */
  it('a brand name in a name, a source or a shape\'s noun is refused', () => {
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), name: `${Cap} straight` })).toEqual(['name: names a brand: write "the maker", or a trait (AGENTS.md)']);
    const spec = specAs('LC9') as { dimensions: { source: string }; decor: { noun?: string }[] };
    spec.dimensions.source = `read off a ${brand}Track box`;
    spec.decor[0]!.noun = `${brand} post`;
    expect(reasons(spec)).toEqual([
      'decor[0].noun: names a brand: write "the maker", or a trait (AGENTS.md)',
      'dimensions.source: names a brand: write "the maker", or a trait (AGENTS.md)',
    ]);
  });

  /*
   * MUTATION PROOF, run: the RESERVED_ID_PREFIX check in idReasons made
   * `if (false)`. Fails with `AssertionError: expected [ Array(1) ] to deeply
   * equal [ Array(1) ]` (the id pattern's reason, not the reserved one). The
   * BUILT_IN_IDS check made `if (false)`: `AssertionError: expected [] to
   * deeply equal [ Array(1) ]`.
   */
  it('a reserved id, a taken one, and one with odd characters are refused', () => {
    expect(reasons(asSubmission(builtIn('A'), '__adapters'))).toEqual(['id: must not start with "__", which is reserved for keys that are not parts']);
    expect(reasons(asSubmission(builtIn('A'), 'A'))).toEqual(['id: "A" is already a built-in piece\'s id; pick a new one']);
    expect(reasons(specAs('LC'))).toEqual(['id: "LC" is already a built-in piece\'s id; pick a new one']);
    expect(reasons(asSubmission(builtIn('A'), 'A 9'))).toEqual(['id: must be letters, digits and dashes, starting with a letter or digit, not "A 9"']);
  });

  /*
   * MUTATION PROOF, run: the UNSAFE_CHARS check in `text` made `if (false)`.
   * Fails with `AssertionError: expected [] to deeply equal [ Array(1) ]`.
   */
  it('a control character or a text-direction override is refused, and a long name', () => {
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), name: 'Straight\u001b[2J' })).toEqual(['name: holds a control or text-direction character']);
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), name: 'x'.repeat(61) })).toEqual(['name: must be at most 60 characters, not 61']);
  });
});

describe('what a submission may not claim or carry', () => {
  /*
   * MUTATION PROOF, run: the status check accepting 'published' too
   * (`v !== 'unverified' && v !== 'published'`). Fails with
   * `AssertionError: expected [] to deeply equal [ Array(1) ]`.
   */
  it('a status other than unverified is refused, and give claimed as measured', () => {
    const p = asSubmission(builtIn('A'), 'A9');
    expect(reasons({ ...p, dimensions: { status: 'published', source: 'x' } })).toEqual(['dimensions.status: must be "unverified", not "published": a submitted piece can\'t claim more; review upgrades it']);
    expect(reasons({ ...p, slop: { axialMm: 1, angularDeg: 1, calibrationStatus: 'measured' } })).toEqual(['slop.calibrationStatus: must be "estimated", not "measured": a joint\'s give is measured only by the maintainer\'s calibration']);
  });

  /*
   * MUTATION PROOF, run: `obj`'s unknown-field push made a no-op. Fails with
   * `AssertionError: expected [] to deeply equal [ Array(1) ]`, and the next
   * test with `expected [] to have a length of 21 but got +0`. And `show`
   * without its brand-name line fails the system-value case with
   * `AssertionError: expected [ Array(1) ] to deeply equal [ Array(1) ]`
   * (the word echoed back).
   */
  it('an unknown field is refused, and a built-in-only one says why', () => {
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), colour: 'red' })).toEqual(['colour: not a field this piece can have (unknown fields are refused, not dropped)']);
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), deck: 1 })).toEqual(['deck: a raised deck is built-in only (OV2)']);
    // A bad system value is refused without listing the others, which spell makers' names.
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), brand: TERMS[0] })).toEqual(['brand: must be one of the library\'s system values, as the piece it was drawn from has, not a brand name']);
    expect(reasons({ ...asSubmission(builtIn('A'), 'A9'), kind: 'block' })[0]).toMatch(/^\.kind: must be "straight", "curve", "multi-road", "buffer" \(a block is built-in only/);
  });

  /*
   * MUTATION PROOF, run: `refuse` without `capped`. Fails with
   * `AssertionError: expected [ …(30) ] to have a length of 21 but got 30`.
   */
  it('neither a piece nor a spec, or both, is refused; too many reasons are counted', () => {
    expect(reasons(null)).toEqual(['the piece: must be an object, not null']);
    expect(reasons({ kind: 'straight', base: 'A' })[0]).toMatch(/has both "kind".*and "base"/);
    const many = { ...asSubmission(builtIn('A'), 'A9'), ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`x${i}`, 1])) };
    const got = reasons(many);
    expect(got).toHaveLength(MAX_REASONS + 1);
    expect(got[MAX_REASONS]).toBe('and 10 more');
  });
});

describe('derived, never thrown', () => {
  /*
   * MUTATION PROOF, run: the try/catch in checkUntrustedPart replaced by
   * `finally {}`. Fails with `Error: Decorated piece LC9: no built-in part
   * NOPE to take its track from.` thrown out of the test, and the next test
   * with `Error: Decorated piece LC9: a shape needs a height: ...`.
   */
  it('a decorated spec whose base the library lacks is refused with the reason', () => {
    const spec = { ...specAs('LC9'), base: 'NOPE' };
    expect(checkUntrustedPart(spec)).toEqual({ ok: false, reasons: ['the decorated piece: Decorated piece LC9: no built-in part NOPE to take its track from.'] });
  });

  /*
   * MUTATION PROOF, run: the spec returned as the part, not derived
   * (`{ ok: true, part: data as unknown as Part }`). Fails with `TypeError:
   * .toMatch() expects to receive a string, but got undefined`, and the test
   * above with `expected { ok: true, part: { id: 'LC9', …(4) } } to deeply
   * equal { ok: false, …(1) }`.
   */
  it('a shape with no height is refused with the reason, and an accepted spec derives its boxes', () => {
    const spec = specAs('LC9') as { decor: { base: { topMm: number } }[] };
    spec.decor[0]!.base.topMm = 0;
    expect(reasons(spec)[0]).toMatch(/^the decorated piece: Decorated piece LC9: a shape needs a height/);
    const ok = checkUntrustedPart(specAs('LC9'));
    expect(ok.ok && ok.part.decoratedFrom).toBe('HP');
    expect(ok.ok && ok.part.decorBody!.length).toBe(BUILT_IN.find((p) => p.id === 'LC')!.decorBody!.length);
  });
});
