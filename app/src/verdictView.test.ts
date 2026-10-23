/**
 * The verdict's precedence rules (task T3a).
 *
 * Value: protects=viewOf's two precedences: IMPOSSIBLE beats EXACT and beats the
 * NO_CYCLE branch, EXACT needs closesExactly, NEEDS_GIVE/EXCEEDS are one
 * disjoint withinBound choice, and gapMm/giveMm come from the worst LOOP
 * Value: fails_when=the clash check moves below the closesExactly check, the
 * failure branch stops reporting clashes, polarity stops promoting to
 * IMPOSSIBLE, or giveMm starts summing across loops instead of naming one
 * Value: why_new=no test imported verdictView.ts at all; the module that decides
 * what the user reads had zero coverage, and .gstack/pregate.json declared it
 * with an empty lane
 * Value: seam=none
 * Value: no_claim=nothing about the rendered sentence or its tone class
 * (verdictView is pure and returns a kind; VerdictLine.tsx and task X2b own the
 * grey-is-not-green invariant), and nothing about which failure the SOLVER picks
 *
 * THERE ARE TWO PRECEDENCES AND THEY LIVE IN DIFFERENT FILES. That is what
 * split task T3, and getting it wrong is how the earlier draft of this task
 * asserted a rank that does not exist.
 *
 * In THIS file the order is: IMPOSSIBLE, then EXACT, then a `withinBound`
 * choice between NEEDS_GIVE and EXCEEDS. That last pair is a disjoint
 * predicate, not a rank, so "EXCEEDS outranks EXACT" is not a true statement
 * about `viewOf` and is not asserted here.
 *
 * The ordering AMONG the failure kinds is not here at all. It lives in
 * `engine/src/graph/solve.ts`, which decides `result.reason` before `viewOf`
 * ever sees it, in this order: NO_CYCLE, then TOO_MANY_LOOPS or
 * TOO_BIG_TO_CHECK by the truncation cause, then NUMERIC for a rank with no
 * traced cycles, then HEADING_MISMATCH, then NUMERIC again for a non-finite
 * figure. NUMERIC therefore sits both before and after HEADING_MISMATCH,
 * which is why naming the order matters more than counting the kinds.
 * `viewOf` passes the reason straight through, so these tests feed it one and
 * assert the passthrough, never a ranking between them.
 *
 * Also deliberately NOT here: "two free ends meeting is not a clash". That
 * behaviour is `engine/src/graph/feasible.ts` and is already tested by
 * `describe('free ends meeting are an invitation, not a clash')` in
 * `engine/test/graphFeasible.test.ts` -- named, not line-numbered, because a
 * single added import shifted that line in this very change. It is not observable from this file,
 * which only reads `result.clashes.length`.
 */

import { describe, expect, it } from 'vitest';
import { ACTION_FOR_FAILURE, FAILURE_COPY, isFailure } from './verdictAction.js';
import type { CycleReport } from '../../engine/src/graph/cycles.js';
import type { VertexClash, WeldPolarityViolation } from '../../engine/src/graph/feasible.js';
import type { GraphResult } from '../../engine/src/graph/solve.js';
import { viewOf, type VerdictKind } from './verdictView.js';
import { getPart } from '../../engine/data/brio.js';
import type { StraightPart } from '../../engine/src/parts/schema.js';

const ZERO_CYC = [0, 0, 0, 0, 0, 0, 0, 0] as const;

const cycle = (over: Partial<CycleReport> = {}): CycleReport => ({
  welds: [0, 1],
  pieces: ['p1', 'p2'],
  gap: [...ZERO_CYC] as unknown as CycleReport['gap'],
  gapMm: 0,
  giveMm: 1.5,
  withinGive: true,
  ...over,
});

const clash = (): VertexClash => ({
  a: { pieceId: 'p1', port: 0 },
  b: { pieceId: 'p2', port: 1 },
  at: [0, 0],
});

const polarity = (): WeldPolarityViolation => ({
  weld: 0,
  between: ['p1', 'p2'],
  polarity: 'peg',
});

/** A solved layout. Defaults to the closes-exactly case. */
function solved(over: Partial<Extract<GraphResult, { ok: true }>> = {}): GraphResult {
  const worst = cycle();
  return {
    ok: true,
    closesExactly: true,
    gapMm: 0,
    totalGiveMm: 1.5,
    withinBound: true,
    rank: 1,
    cycles: [worst],
    worst,
    clashes: [],
    overlaps: [],
    polarityViolations: [],
    residuals: [],
    repair: null,
    ...over,
  };
}

/** A refused layout. `reason` is whatever the SOLVER already decided. */
function refused(over: Partial<Extract<GraphResult, { ok: false }>> = {}): GraphResult {
  return {
    ok: false,
    reason: 'NO_CYCLE',
    detail: '2 pieces, open at both ends',
    rank: 0,
    clashes: [],
    overlaps: [],
    polarityViolations: [],
    residuals: [],
    ...over,
  };
}

describe('nothing placed', () => {
  it('a null result is NOTHING, with every figure zeroed', () => {
    const v = viewOf(null);
    expect(v.kind).toBe('NOTHING');
    expect(v).toMatchObject({
      detail: '',
      gapMm: 0,
      giveMm: 0,
      rank: 0,
      failingLoops: 0,
      clashCount: 0,
      polarityCount: 0,
      jointCount: 0,
    });
  });
});

describe('precedence 1: impossible geometry beats everything', () => {
  /*
   * THE HEADLINE CLAIM, and the reason the order in `viewOf` is not arbitrary:
   * sixteen large curves close perfectly and run the same circle twice. An
   * exact closure is not a reason to stay quiet about overlapping track.
   *
   * MUTATION PROOF, run: move the clash check below the `closesExactly` check
   * in verdictView.ts and this case returns EXACT. Verified.
   */
  it('a layout that closes EXACTLY but overlaps itself is IMPOSSIBLE, not EXACT', () => {
    const v = viewOf(solved({ closesExactly: true, clashes: [clash()] }));
    expect(v.kind).toBe('IMPOSSIBLE');
    expect(v.clashCount).toBe(1);
  });

  it('polarity violations promote too, not only clashes', () => {
    // The task's own text said "a failed solve with clashes". The code reads
    // `clashes.length > 0 || polarityViolations.length > 0`, on BOTH branches.
    // Asserting only the clash half would leave the other promotion untested.
    const v = viewOf(solved({ closesExactly: true, polarityViolations: [polarity()] }));
    expect(v.kind).toBe('IMPOSSIBLE');
    expect(v.polarityCount).toBe(1);
  });

  it('it beats a NEEDS_GIVE layout as well, not just an exact one', () => {
    const tight = cycle({ gapMm: 1.0, withinGive: true });
    const v = viewOf(
      solved({ closesExactly: false, withinBound: true, gapMm: 1.0, worst: tight, cycles: [tight], clashes: [clash()] }),
    );
    expect(v.kind).toBe('IMPOSSIBLE');
  });
});

describe('precedence 1 again, on the FAILED branch: a separate check in a separate place', () => {
  /*
   * This is not the same code path as above and the task is explicit about it.
   * A solve that failed outright still reports clashes, because overlapping
   * track is a fact about where the pieces ARE: it does not become true only
   * once you close a loop.
   *
   * MUTATION PROOF, run: delete the promotion block on the !ok branch and this
   * returns NO_CYCLE, which is the one thing that was NOT wrong. Verified.
   */
  it('a failed solve WITH clashes is promoted to IMPOSSIBLE, not left as its reason', () => {
    const v = viewOf(refused({ reason: 'NO_CYCLE', clashes: [clash()] }));
    expect(v.kind).toBe('IMPOSSIBLE');
    expect(v.clashCount).toBe(1);
  });

  it('a failed solve with a polarity violation is promoted too', () => {
    const v = viewOf(refused({ reason: 'NO_CYCLE', polarityViolations: [polarity()] }));
    expect(v.kind).toBe('IMPOSSIBLE');
    expect(v.polarityCount).toBe(1);
  });

  it('a failed solve with NEITHER keeps the solver\'s reason and its detail', () => {
    const v = viewOf(refused({ reason: 'NO_CYCLE', detail: '2 separate runs of track' }));
    expect(v.kind).toBe('NO_CYCLE');
    expect(v.detail).toBe('2 separate runs of track');
  });
});

describe('the five failure kinds are passed THROUGH, never ranked here', () => {
  // The ordering among these lives in engine/src/graph/solve.ts, which picks
  // one before viewOf runs. All this file does is carry it, so that is all
  // these cases assert.
  const kinds = [
    'NO_CYCLE',
    'TOO_MANY_LOOPS',
    'TOO_BIG_TO_CHECK',
    'HEADING_MISMATCH',
    'NUMERIC',
  ] as const;

  for (const reason of kinds) {
    it(`${reason} arrives as ${reason}`, () => {
      const v = viewOf(refused({ reason, detail: `because ${reason}` }));
      expect(v.kind).toBe(reason);
      expect(v.detail).toBe(`because ${reason}`);
    });
  }

  it('"NO_CYCLE at rank 0" is about WHY the solver returned it, not a ranking', () => {
    // solve.ts returns NO_CYCLE because it saw rank === 0. viewOf carries that
    // rank through untouched. The claim is the passthrough, nothing more.
    const v = viewOf(refused({ reason: 'NO_CYCLE', rank: 0 }));
    expect(v.kind).toBe('NO_CYCLE');
    expect(v.rank).toBe(0);
  });

  it('a failed solve at a NON-zero rank still carries its own rank', () => {
    const v = viewOf(refused({ reason: 'HEADING_MISMATCH', rank: 2 }));
    expect(v.rank).toBe(2);
  });
});

describe('precedence 2: EXACT needs closesExactly, and nothing else does', () => {
  it('EXACT is taken only when the layout closes exactly', () => {
    expect(viewOf(solved({ closesExactly: true })).kind).toBe('EXACT');
  });

  /*
   * MUTATION PROOF, run: change the EXACT branch to ignore `closesExactly`
   * (return EXACT unconditionally once nothing clashes) and FIVE cases fail, not
   * the two in this describe: every NEEDS_GIVE and EXCEEDS case collapses to
   * EXACT too, because that branch now swallows them all before the
   * `withinBound` choice is reached. Verified; the count is the whole point,
   * since it shows this one line gates three kinds rather than one.
   */
  it('a layout that does NOT close exactly is never EXACT', () => {
    const tight = cycle({ gapMm: 0.8, withinGive: true });
    const v = viewOf(solved({ closesExactly: false, withinBound: true, worst: tight, cycles: [tight] }));
    expect(v.kind).not.toBe('EXACT');
    expect(v.kind).toBe('NEEDS_GIVE');
  });
});

describe('precedence 3: NEEDS_GIVE and EXCEEDS are ONE disjoint choice, not a rank', () => {
  const tight = cycle({ gapMm: 1.0, withinGive: true });
  const over = cycle({ gapMm: 9.0, withinGive: false });

  it('withinBound true gives NEEDS_GIVE', () => {
    const v = viewOf(solved({ closesExactly: false, withinBound: true, gapMm: 1.0, worst: tight, cycles: [tight] }));
    expect(v.kind).toBe('NEEDS_GIVE');
  });

  it('withinBound false gives EXCEEDS', () => {
    const v = viewOf(solved({ closesExactly: false, withinBound: false, gapMm: 9.0, worst: over, cycles: [over] }));
    expect(v.kind).toBe('EXCEEDS');
  });

  it('the two are never both reachable for one result: the flag decides alone', () => {
    // Same result object, one flag flipped, nothing else touched. This is what
    // makes it a predicate rather than a precedence: there is no third outcome
    // and no ordering between them to assert.
    const base = { closesExactly: false, gapMm: 2.0, worst: over, cycles: [over] };
    expect(viewOf(solved({ ...base, withinBound: true })).kind).toBe('NEEDS_GIVE');
    expect(viewOf(solved({ ...base, withinBound: false })).kind).toBe('EXCEEDS');
  });
});

describe('the figures name ONE loop, never a total', () => {
  /*
   * The third rule in this file's docblock, and the invariant the whole
   * cyclotomic design rests on: give is never pooled across cycles. Two loops
   * each individually fine is fine; one bad loop fails the layout however good
   * the rest is.
   *
   * MUTATION PROOF, run: `viewOf` reads `result.totalGiveMm`, which `solve.ts`
   * has already derived from the worst cycle (`space.worst?.giveMm ?? 0`) -- it
   * does not reach into `worst` itself, and saying otherwise would misdescribe
   * the seam. Replace that read with a sum over `cycles` and this case alone
   * fails, reporting 3.0 instead of 1.5. Verified.
   */
  it('gapMm and giveMm come from the worst loop, not summed across loops', () => {
    const good = cycle({ gapMm: 0.1, giveMm: 1.5, withinGive: true });
    const bad = cycle({ welds: [2, 3], gapMm: 7.0, giveMm: 1.5, withinGive: false });
    const v = viewOf(
      solved({
        closesExactly: false,
        withinBound: false,
        gapMm: 7.0,
        totalGiveMm: 1.5,
        rank: 2,
        cycles: [good, bad],
        worst: bad,
      }),
    );
    expect(v.gapMm).toBe(7.0);
    expect(v.giveMm).toBe(1.5); // bad's own give, not 3.0 and not 4.5
    expect(v.rank).toBe(2);
  });

  it('failingLoops counts only the loops that do not fit', () => {
    const good = cycle({ withinGive: true });
    const bad1 = cycle({ welds: [2], withinGive: false });
    const bad2 = cycle({ welds: [3], withinGive: false });
    const v = viewOf(
      solved({ closesExactly: false, withinBound: false, rank: 3, cycles: [good, bad1, bad2], worst: bad1 }),
    );
    expect(v.failingLoops).toBe(2);
  });

  it('jointCount is the worst loop\'s weld count, which is what the gap spreads across', () => {
    const wide = cycle({ welds: [0, 1, 2, 3, 4], withinGive: true });
    const v = viewOf(solved({ closesExactly: false, withinBound: true, cycles: [wide], worst: wide }));
    expect(v.jointCount).toBe(5);
  });

  it('a null worst loop leaves jointCount at zero rather than throwing', () => {
    const v = viewOf(solved({ closesExactly: true, worst: null, cycles: [] }));
    expect(v.jointCount).toBe(0);
    expect(v.kind).toBe('EXACT');
  });
});

describe('completeness', () => {
  it('every VerdictKind is reachable from viewOf', () => {
    // Not a tone assertion: this file returns a KIND and knows nothing about
    // CSS. X2b owns grey-is-not-green over ten kinds and five tones.
    const tight = cycle({ gapMm: 1.0, withinGive: true });
    const over = cycle({ gapMm: 9.0, withinGive: false });
    const reached = new Set<VerdictKind>([
      viewOf(null).kind,
      viewOf(refused({ reason: 'NO_CYCLE' })).kind,
      viewOf(refused({ reason: 'TOO_MANY_LOOPS' })).kind,
      viewOf(refused({ reason: 'TOO_BIG_TO_CHECK' })).kind,
      viewOf(refused({ reason: 'HEADING_MISMATCH' })).kind,
      viewOf(refused({ reason: 'NUMERIC' })).kind,
      viewOf(refused({ clashes: [clash()] })).kind,
      viewOf(solved({ closesExactly: true })).kind,
      viewOf(solved({ closesExactly: false, withinBound: true, worst: tight, cycles: [tight] })).kind,
      viewOf(solved({ closesExactly: false, withinBound: false, worst: over, cycles: [over] })).kind,
    ]);

    /*
     * A RECORD, NOT AN ARRAY, and that is the whole point of this line.
     *
     * This was `readonly VerdictKind[]`, which a SUBSET satisfies, so the
     * list was hand-maintained and silently stopped being exhaustive. Adding
     * TOO_BIG_TO_CHECK to `VerdictKind` left this spec green while the new
     * kind was reachable from `viewOf` and covered by nothing. A Record over
     * the union cannot be short: tsc fails the file instead.
     *
     * MUTATION PROOF, run: delete the TOO_BIG_TO_CHECK line below and
     * `bun run typecheck` fails with TS2741, "Property 'TOO_BIG_TO_CHECK' is
     * missing in type ...". That is the failure the array shape could not
     * produce.
     */
    const ALL: Record<VerdictKind, true> = {
      NOTHING: true,
      NO_CYCLE: true,
      HEADING_MISMATCH: true,
      TOO_MANY_LOOPS: true,
      TOO_BIG_TO_CHECK: true,
      NUMERIC: true,
      IMPOSSIBLE: true,
      EXACT: true,
      NEEDS_GIVE: true,
      EXCEEDS: true,
    };
    const all = Object.keys(ALL) as readonly VerdictKind[];
    for (const k of all) expect(reached).toContain(k);
    expect(reached.size).toBe(all.length);
  });
});

/**
 * THE FAILURE REGISTER, which had no coverage at all.
 *
 * Value: protects=every VerdictKind that is a failure is classified as one,
 * so a refusal is rendered as a refusal and never as a near-pass
 * Value: fails_when=`isFailure` and `FAILURE_COPY` disagree, which is what a
 * hand-written predicate beside an exhaustive Record invites
 * Value: why_new=`isFailure` was a five-clause `||` chain inside
 * `VerdictLine.tsx`. Nothing referenced it or `FAILURE_COPY` from any test,
 * and nothing could: the suite collects `.test.ts` only in a node
 * environment with no DOM, so a `.tsx` spec is never even run. Adding
 * TOO_BIG_TO_CHECK needed three edits and tsc checked two of them; with the
 * predicate's arm missing, that refusal falls past the grey failure branch
 * and renders as a near-pass.
 * Value: seam=both moved to `verdictAction.ts`, a `.ts` module, which is the
 * whole reason they are reachable from here
 * Value: no_claim=nothing about how the copy is laid out or styled; this is
 * the register, not the rendering.
 */
describe('the failure register', () => {
  /*
   * A Record again, for the same reason the completeness spec above uses one:
   * an array of kinds is satisfied by a SUBSET, so it goes stale silently.
   *
   * MUTATION PROOF, run: delete a key from this literal and `bun run
   * typecheck` fails with TS2741 naming the missing property.
   */
  const ALL_KINDS: Record<VerdictKind, true> = {
    NOTHING: true,
    NO_CYCLE: true,
    HEADING_MISMATCH: true,
    TOO_MANY_LOOPS: true,
    TOO_BIG_TO_CHECK: true,
    NUMERIC: true,
    IMPOSSIBLE: true,
    EXACT: true,
    NEEDS_GIVE: true,
    EXCEEDS: true,
  };

  /*
   * MUTATION PROOF, run: hand-write the predicate again and drop one arm
   * (`k === 'TOO_BIG_TO_CHECK'`) and this fails with
   * `expected false to be true // Object.is equality` on that kind.
   */
  it('classifies exactly the kinds that have failure copy, and no others', () => {
    for (const k of Object.keys(ALL_KINDS) as VerdictKind[]) {
      expect(isFailure(k), k).toBe(Object.hasOwn(FAILURE_COPY, k));
    }
  });

  it('every failure kind has non-empty copy and an action', () => {
    const keys = Object.keys(FAILURE_COPY) as (keyof typeof FAILURE_COPY)[];
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(FAILURE_COPY[k].trim(), k).not.toBe('');
      expect(ACTION_FOR_FAILURE[k].trim(), k).not.toBe('');
    }
  });

  /* A pass or a near-pass must never be classified as a failure. */
  it('does not classify a pass or a near-pass as a failure', () => {
    for (const k of ['EXACT', 'NEEDS_GIVE', 'EXCEEDS', 'IMPOSSIBLE', 'NOTHING'] as const) {
      expect(isFailure(k), k).toBe(false);
    }
  });

  /*
   * TWO LIMITS, TWO SENTENCES, and nothing held them apart.
   *
   * Value: protects=each failure kind reads as its own refusal, so splitting
   * TOO_BIG_TO_CHECK out of TOO_MANY_LOOPS actually reaches the person
   * Value: fails_when=a new kind is given a copy-paste headline, which is how
   * the two limits came to say the same wrong thing in the first place
   * Value: why_new=the spec above checks each headline is non-EMPTY, which a
   * duplicate passes. `verdictAction.test.ts` pins distinctness for the
   * ACTIONS and there was no equivalent for the headlines, so the entire
   * user-visible point of this branch -- that a layout refused at rank 14 is
   * not told it has too many loops -- rested on nothing.
   * Value: seam=none
   * Value: no_claim=nothing about the wording itself. A headline may be
   * rewritten freely; it may not be a copy of another kind's.
   *
   * MUTATION PROOF, run against a relocated copy of `verdictAction.ts` --
   * imports rewritten, nothing else touched -- because this audit may not
   * write to `app/src/verdictAction.ts`: give TOO_BIG_TO_CHECK the
   * TOO_MANY_LOOPS headline and this fails with
   * `expected [ [ 'TOO_BIG_TO_CHECK', …(1) ] ] to deeply equal []` -- quoted
   * as vitest abbreviates it, the elided member being TOO_MANY_LOOPS. Exactly
   * one spec fails: every other spec in the register only asks whether the
   * copy is non-empty.
   */
  it('no two failures share a headline, so a refusal says which one it is', () => {
    const byCopy = new Map<string, string[]>();
    for (const [kind, text] of Object.entries(FAILURE_COPY)) {
      byCopy.set(text, [...(byCopy.get(text) ?? []), kind]);
    }
    const shared = [...byCopy.values()].filter((ks) => ks.length > 1).map((ks) => ks.sort());
    expect(shared).toEqual([]);
    // Named, because this is the pair the split exists for: at rank 14, inside
    // a ceiling of 20, "too many loops to rank" is simply untrue.
    expect(FAILURE_COPY.TOO_BIG_TO_CHECK).not.toBe(FAILURE_COPY.TOO_MANY_LOOPS);
  });
});

/**
 * A FILLER ZERO IS NOT A MEASUREMENT.
 *
 * Value: protects=nothing claims a loop closes unless the engine measured it
 * Value: fails_when=`gapKnown` is set on a refusal, or dropped on the solved
 * path
 * Value: why_new=`EMPTY` fills `gapMm` with 0 on every refusal, and
 * `VerdictLine` rendered " The loop does close; that does not help." whenever
 * `rank > 0 && gapMm === 0`. Measured through `viewOf` at rank 7 with one
 * clash: TOO_MANY_LOOPS, TOO_BIG_TO_CHECK, NUMERIC and HEADING_MISMATCH all
 * rendered it -- the last while the engine had just determined the track does
 * NOT come back aligned. The existing `rank > 0` guard was added after a user
 * reported the same sentence over a layout with no loop; it fixed the rank-0
 * case and left every rank-positive refusal asserting closure.
 * Value: seam=none
 * Value: no_claim=the sentence itself lives in `VerdictLine.tsx` and cannot
 * be rendered here. This pins the flag it is now keyed on.
 */
describe('gapKnown separates a measured gap from a filler', () => {
  /*
   * MUTATION PROOF, run: set `gapKnown: true` in `EMPTY` and this fails with
   * `expected true to be false // Object.is equality` on NO_CYCLE, the first
   * refusal in the loop.
   */
  it('is false on every refusal, where gapMm is only a filler', () => {
    for (const reason of [
      'NO_CYCLE',
      'TOO_MANY_LOOPS',
      'TOO_BIG_TO_CHECK',
      'HEADING_MISMATCH',
      'NUMERIC',
    ] as const) {
      const v = viewOf(refused({ reason, rank: 7 }));
      expect(v.gapKnown, reason).toBe(false);
      expect(v.gapMm, reason).toBe(0);
    }
    // The clash path too, which is where the sentence was actually rendered.
    const c = viewOf(refused({ rank: 7, clashes: [clash()] }));
    expect(c.kind).toBe('IMPOSSIBLE');
    expect(c.gapKnown).toBe(false);
  });

  /*
   * MUTATION PROOF, run: delete `gapKnown: true` from `base` and this fails
   * with `expected undefined to be true`. UNDEFINED, not false: `base` does
   * not spread `EMPTY`, so the property goes missing rather than reverting to
   * a default.
   *
   * tsc DOES also object: three TS2741s, one per `{ ...base, kind }` return
   * in `viewOf`. No line numbers here on purpose. An earlier version of this
   * note claimed tsc did not object at all and offered that as the reason the
   * spec exists; the version that repaired it then cited three line numbers
   * that were themselves wrong by two. A citation that cannot rot is the only
   * one worth writing. The real reason is narrower: tsc catches the
   * property going missing, and this catches it being present and WRONG,
   * which is the `EMPTY`-spread mutation above.
   */
  it('is true on the solved path, where the engine traced the cycles', () => {
    const tight = cycle({ gapMm: 1.0, withinGive: true });
    for (const v of [
      viewOf(solved({ closesExactly: true })),
      viewOf(solved({ closesExactly: false, withinBound: true, worst: tight, cycles: [tight] })),
    ]) {
      expect(v.gapKnown).toBe(true);
    }
  });
});

/*
 * THE GAP IN PIECES (task X6) RIDES ON EXCEEDS ONLY.
 *
 * `repair.ts` decides whether one straight closes the one failing loop; this
 * pins that the view carries that answer through on the one verdict it
 * belongs to, and drops it everywhere else. A pieces sentence under
 * IMPOSSIBLE would tell a builder to add a straight to a layout that cannot
 * be built for a different reason.
 *
 * MUTATION PROOF, run: in `viewOf`, set `pieces` from `result.repair` on the
 * `base` object instead of only on the EXCEEDS return. Fails with
 * `IMPOSSIBLE: expected { direction: 'short', …(3) } to be null`.
 */
describe('the gap in pieces', () => {
  const A3 = getPart('A3') as StraightPart;
  const repair = { direction: 'short' as const, part: A3, partNumber: null };
  const failing = cycle({ gapMm: 72, giveMm: 8, withinGive: false });

  it('is carried on EXCEEDS, by name and length', () => {
    const v = viewOf(
      solved({ closesExactly: false, withinBound: false, worst: failing, cycles: [failing], repair }),
    );
    expect(v.kind).toBe('EXCEEDS');
    expect(v.pieces).toEqual({ direction: 'short', name: 'Middle straight', lengthMm: 72, partNumber: null });
  });

  it('is dropped on every other verdict', () => {
    const impossible = viewOf(
      solved({ closesExactly: false, withinBound: false, worst: failing, cycles: [failing], repair, clashes: [clash()] }),
    );
    expect(impossible.kind, 'IMPOSSIBLE').toBe('IMPOSSIBLE');
    expect(impossible.pieces, 'IMPOSSIBLE').toBeNull();
    expect(viewOf(solved({ repair })).pieces, 'EXACT').toBeNull();
    expect(viewOf(null).pieces, 'NOTHING').toBeNull();
  });

  it('is null on EXCEEDS when the engine proved nothing', () => {
    const v = viewOf(solved({ closesExactly: false, withinBound: false, worst: failing, cycles: [failing] }));
    expect(v.kind).toBe('EXCEEDS');
    expect(v.pieces).toBeNull();
  });
});
