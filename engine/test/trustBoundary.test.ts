/**
 * The library's trust boundary: what a stored submission may and may not do.
 *
 * Value: protects=an unknown or absent dimensions.status can never outrank a
 * catalogue figure, and a submission missing ends or slop is dropped rather
 * than crashing the engine on load
 * Value: fails_when=trustRank returns -1 again for an unrecognised status, or
 * looksLikePart stops checking status, ends or slop
 * Value: why_new=no test reached looksLikePart's rejection paths or trustRank's
 * unknown-status branch; resolveLibrary was only ever given well-formed input
 * Value: seam=none
 * Value: no_claim=nothing about a server or about submissions from another
 * user; storage is local and same-origin, so this is data integrity, not
 * cross-user compromise
 *
 * EVERY CASE HERE REPRODUCES A DEMONSTRATED FAILURE, not a hypothesis. Before
 * the fix, `resolveLibrary` with a single forged submission returned curve E
 * with radius 1 and name FORGED in place of the published 182mm figure, and
 * `isUnverified` could not tell: the forged part had no status at all rather
 * than a bad one, so it read as verified.
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, loadSubmissions, resolveLibrary, type Submission } from '../data/library.js';
import { DIMENSION_TRUST, trustRank, type Part } from '../src/parts/schema.js';
import { layoutTrust } from '../src/joints/trust.js';
import { brandFit } from '../data/thirdParty.js';
import { makeResolver } from '../data/library.js';
import { SUBMISSIONS_STORAGE_KEY } from '../data/library.js';

const realE = BUILT_IN.find((p) => p.id === 'E')!;

const submissionWith = (over: Record<string, unknown>): Submission =>
  ({
    submissionId: 'forged-1',
    at: '2026-01-01T00:00:00.000Z',
    part: { ...realE, name: 'FORGED', innerRadiusMm: 1, ...over },
  }) as Submission;

function withStore<T>(seed: Record<string, string>, body: () => T): T {
  const store = new Map(Object.entries(seed));
  const g = globalThis as { localStorage?: unknown };
  const had = 'localStorage' in g;
  const prev = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  try {
    return body();
  } finally {
    if (had) g.localStorage = prev;
    else delete g.localStorage;
  }
}

describe('trustRank fails closed', () => {
  /*
   * MUTATION PROOF, run: restore `return DIMENSION_TRUST.indexOf(status)` and
   * every case here fails, because -1 is lower than user-measured's 0.
   */
  it('an unrecognised status is the LEAST trusted thing, not the most', () => {
    for (const bogus of ['made-up', '', 'PUBLISHED', undefined, null]) {
      expect(trustRank(bogus as never)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  /*
   * `expect(ranks).toEqual([...ranks].sort(...))` was here and could not fail:
   * `trustRank` is `indexOf`, so mapping it over `DIMENSION_TRUST` yields
   * [0..n-1], which is already sorted whatever the order of the array. The
   * literal is the pin.
   *
   * Being precise about what was wrong: the two `toBeLessThan` lines below are
   * real pins, so the BLOCK could always fail. It was the one self-sorting
   * LINE that could not, and it was the line carrying the claim about the
   * whole declared order.
   *
   * MUTATION PROOF, run: swap 'user-measured' and 'published' in
   * DIMENSION_TRUST and 2 tests fail, this one among them.
   */
  it('every real status still ranks in its declared order', () => {
    expect(DIMENSION_TRUST.map((s) => trustRank(s))).toEqual([0, 1, 2, 3]);
    expect(trustRank('user-measured')).toBeLessThan(trustRank('published'));
    expect(trustRank('published')).toBeLessThan(trustRank('unverified'));
  });
});

describe('a stored submission cannot forge provenance', () => {
  for (const status of [undefined, null, '', 'published-ish', 'PUBLISHED', 42]) {
    it(`status ${JSON.stringify(status)} does not override the published part`, () => {
      const resolved = resolveLibrary([
        submissionWith({ dimensions: { status, source: 'x' } }),
      ]);
      const e = resolved.find((p) => p.id === 'E')!;
      expect(e.name).not.toBe('FORGED');
      expect((e as { innerRadiusMm?: number }).innerRadiusMm).toBe(182);
    });
  }

  it('a WELL-FORMED better source still wins, so the guard is not a blanket refusal', () => {
    const measured = resolveLibrary([
      submissionWith({
        name: 'measured by hand',
        innerRadiusMm: 183,
        dimensions: { status: 'user-measured', source: 'my ruler' },
      }),
    ]);
    const e = measured.find((p) => p.id === 'E')!;
    expect(e.name).toBe('measured by hand');
    expect((e as { innerRadiusMm?: number }).innerRadiusMm).toBe(183);
  });
});

describe('loadSubmissions drops rows the engine would crash on', () => {
  const base = {
    submissionId: 's1',
    at: '2026-01-01T00:00:00.000Z',
    part: { ...realE, dimensions: { status: 'community', source: 'x' } },
  };

  const cases: Array<[string, unknown]> = [
    ['no dimensions.status', { ...base, part: { ...base.part, dimensions: { source: 'x' } } }],
    ['no dimensions.source', { ...base, part: { ...base.part, dimensions: { status: 'community' } } }],
    ['no ends', { ...base, part: { ...base.part, ends: undefined } }],
    ['a bad end polarity', { ...base, part: { ...base.part, ends: { start: 'magnet', end: 'peg' } } }],
    ['no slop', { ...base, part: { ...base.part, slop: undefined } }],
    ['a negative slop', { ...base, part: { ...base.part, slop: { axialMm: -1, angularDeg: 1 } } }],
    ['a non-finite slop', { ...base, part: { ...base.part, slop: { axialMm: NaN, angularDeg: 1 } } }],
  ];

  for (const [name, row] of cases) {
    it(`drops a submission with ${name}`, () => {
      const got = withStore({ [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([row]) }, () =>
        loadSubmissions(),
      );
      expect(got).toHaveLength(0);
    });
  }

  it('keeps a complete row, so the matrix above is not refusing everything', () => {
    const got = withStore({ [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([base]) }, () =>
      loadSubmissions(),
    );
    expect(got).toHaveLength(1);
  });

  it('drops ONLY the bad row, which is this loader\'s deliberate difference from the chain one', () => {
    const bad = { ...base, submissionId: 's2', part: { ...base.part, dimensions: {} } };
    const got = withStore({ [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([base, bad]) }, () =>
      loadSubmissions(),
    );
    expect(got.map((s) => s.submissionId)).toEqual(['s1']);
  });
});

/**
 * The slop a stored submission may claim (finding B2).
 *
 * Value: protects=the `estimated-give` caveat cannot be switched off by a
 * stored blob, and a give figure cannot be inflated until every layout
 * "might fit"
 * Value: fails_when=`looksLikePart` stops checking `slop.calibrationStatus`,
 * or drops either slop ceiling
 * Value: why_new=`calibrationStatus` was not validated at all, and `axialMm`
 * had only a non-negative check with no upper bound
 * Value: seam=none
 * Value: no_claim=nothing about a part whose slop is wrong but plausible;
 * 0.9mm instead of 0.8mm is indistinguishable from a real measurement and
 * this cannot tell them apart
 *
 * THIS REPRODUCES A MEASURED FAILURE. Before the fix, `layoutTrust` on the
 * published straight D reported `['estimated-give']`; after one stored row
 * claiming `calibrationStatus: 'measured'` and `axialMm: 999` was accepted,
 * it reported no give caveat at all. `trust.ts`'s own comment on that rule
 * says it "must stay true in EVERY verdict state".
 */
describe('a stored submission cannot claim its give was measured', () => {
  const realD = BUILT_IN.find((p) => p.id === 'D')!;
  const layout = { placements: [{ partId: 'D' }], closed: false } as never;
  const kindsFor = (parts: readonly Part[]) =>
    layoutTrust(layout, makeResolver(parts), brandFit).map((i) => i.kind);

  it('the published library says the give is estimated (control)', () => {
    expect(kindsFor(BUILT_IN)).toContain('estimated-give');
  });

  /*
   * MUTATION PROOF, run: delete the `slop.calibrationStatus` check from
   * `looksLikePart` and this case fails, because the forged row is accepted
   * and `estimated-give` vanishes from the register.
   */
  it('a row claiming measured give is dropped, so the caveat survives', () => {
    const forged = submissionWith({
      slop: { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: 'measured' },
      dimensions: { status: 'user-measured', source: 'my ruler' },
      id: 'D',
      kind: 'straight',
      lengthMm: (realD as { lengthMm?: number }).lengthMm,
    });
    const kept = withStore({ [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([forged]) }, () =>
      loadSubmissions(),
    );
    expect(kept).toHaveLength(0);
    expect(kindsFor(resolveLibrary(kept))).toContain('estimated-give');
  });

  /*
   * MUTATION PROOF, run: remove either ceiling from `bounded` and the matching
   * case here fails.
   */
  it('refuses a give figure too large to be a tolerance', () => {
    for (const slop of [
      { axialMm: 999, angularDeg: 1.5, calibrationStatus: 'estimated' },
      { axialMm: 0.8, angularDeg: 400, calibrationStatus: 'estimated' },
      { axialMm: Number.POSITIVE_INFINITY, angularDeg: 1.5, calibrationStatus: 'estimated' },
    ]) {
      const got = withStore(
        { [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([submissionWith({ slop })]) },
        () => loadSubmissions(),
      );
      expect(got).toHaveLength(0);
    }
  });

  it('still accepts the real figures, and a published calibration', () => {
    for (const status of ['estimated', 'published']) {
      const got = withStore(
        {
          [SUBMISSIONS_STORAGE_KEY]: JSON.stringify([
            submissionWith({
              slop: { axialMm: 0.8, angularDeg: 1.5, calibrationStatus: status },
            }),
          ]),
        },
        () => loadSubmissions(),
      );
      expect(got).toHaveLength(1);
    }
  });
});
