/**
 * THE VERDICT HEADLINE CLAIMS ONLY WHAT THE ARITHMETIC ESTABLISHED.
 *
 * Value: protects=the EXCEEDS headline and its action never assert that track
 * physically will not go together, because the give figure behind that claim is
 * not a proven upper bound; and IMPOSSIBLE keeps its definite claim, which IS
 * sound
 * Value: fails_when=the headline reacquires "won't fit" or an equivalent, the
 * action reacquires "the gap is larger than the joints can take up", the
 * millimetre figures are dropped, or the fix leaks into IMPOSSIBLE and softens
 * a refusal that is genuinely definite
 * Value: why_new=nothing rendered `VerdictLine` before. `verdictView.test.ts`
 * owns the view MODEL (which kind is chosen) and `verdictAction.test.ts` owns
 * the action register's structure, but no test read the sentence a builder
 * actually sees, which is where the overclaim lived
 * Value: seam=`renderToStaticMarkup` needs no DOM, so the component renders in
 * this node environment. It cannot dispatch an event, so this reads markup
 * rather than interacting
 * Value: no_claim=nothing about whether the give bound is sound, which needs
 * CALIBRATION.md Q2; nothing about colour or the glyph, which DESIGN.md rules 1
 * and 2 own and which `app.css` renders
 *
 * WHY THIS EXISTS. `engine/src/solver/residual.ts:36-42` states the engine's
 * own condition for its one definite verdict: it "is only sound if the give
 * figure is an upper bound on the give really available", and understating give
 * "would turn the one definite verdict this engine makes into a false one,
 * which is the worst failure mode here". Nothing establishes that upper bound.
 * `residual.ts:110` takes `Math.max` of two per-part summaries, which avoids
 * the smaller estimate without proving a real peg and socket cannot exceed
 * both, and the angular budget is written onto every joint and summed nowhere.
 * DESIGN.md rule 3 already forbade claiming more than was checked; NEEDS_GIVE
 * was hedged for that reason and EXCEEDS was not.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CycleReport } from '../../engine/src/graph/cycles.js';
import type { RunBend } from '../../engine/src/graph/bendRun.js';
import type { GraphResult } from '../../engine/src/graph/solve.js';
import { viewOf } from './verdictView.js';
import { VerdictLine } from './VerdictLine.js';
import { ACTION_FOR_VERDICT } from './verdictAction.js';
import { layoutTrust, type TrustIssue } from '../../engine/src/joints/trust.js';
import { resolveLibrary, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import type { Layout } from '../../engine/src/parts/schema.js';

const ZERO_CYC = [0, 0, 0, 0, 0, 0, 0, 0] as const;

const cycle = (over: Partial<CycleReport> = {}): CycleReport => ({
  welds: [0, 1],
  pieces: ['p1', 'p2'],
  gap: [...ZERO_CYC] as unknown as CycleReport['gap'],
  gapMm: 0,
  standaloneLambda: null,
  ...over,
});

/** A looped run's bend, as the engine reports it. All BRIO unless `others` is given. */
const runBend = (status: RunBend['status'], lambda: number, over: Partial<RunBend> = {}): RunBend => ({
  pieces: ['p1', 'p2'],
  status,
  lambda,
  stretchMm: 1,
  leftoverMm: 0,
  turnedSteps: 0,
  standalone: [lambda],
  why: null,
  work: 0,
  movesMm: 3,
  others: [],
  brio: true,
  atLeast: false,
  ...over,
});

/**
 * A near miss beyond the tested bend: 72mm of gap, needing 1.6 times the BRIO
 * limit at the worst joint.
 *
 * Returns the SOLVED branch, not the `GraphResult` union, so a caller can
 * spread it and override `cycles`/`worst`. `verdictView.test.ts`'s `solved()`
 * narrows the same way. Typed as the union, the spread fails to narrow and
 * `tsc` rejects both the added `cycles` key and any read of `worst`.
 */
const exceedsResult = (): Extract<GraphResult, { ok: true }> => {
  const worst = cycle({ gapMm: 72, standaloneLambda: 1.6 });
  const lead = runBend('beyond', 1.6);
  return {
    ok: true,
    closesExactly: false,
    gapMm: 72,
    bend: [lead],
    lead,
    withinBound: false,
    rank: 1,
    cycles: [worst],
    worst,
    clashes: [],
    overlaps: [],
    polarityViolations: [],
    adapterJoints: [],
    levelMismatches: [],
    thirdLevels: [],
    bridges: [],
    raised: false,
    runs: { count: 1, open: 0, loops: [{ firstPiece: 1, pieces: [], headingBroken: false }] },
    residuals: [],
    repair: null,
  };
};

const impossibleResult = (): Extract<GraphResult, { ok: true }> => {
  const worst = cycle();
  const lead = runBend('exact', 0);
  return {
    ok: true,
    closesExactly: true,
    gapMm: 0,
    bend: [lead],
    lead,
    withinBound: true,
    rank: 1,
    cycles: [worst],
    worst,
    clashes: [{ a: { pieceId: 'p1', port: 0 }, b: { pieceId: 'p2', port: 1 }, at: [0, 0] }],
    overlaps: [],
    polarityViolations: [],
    adapterJoints: [],
    levelMismatches: [],
    thirdLevels: [],
    bridges: [],
    raised: false,
    runs: { count: 1, open: 0, loops: [{ firstPiece: 1, pieces: [], headingBroken: false }] },
    residuals: [],
    repair: null,
  };
};

const render = (result: GraphResult, trust: readonly TrustIssue[] = []): string =>
  renderToStaticMarkup(createElement(VerdictLine, { view: viewOf(result), trust } as never));

const LIB = resolveLibrary([]);

/** The real register, for a layout of these part ids. */
const trustFor = (ids: readonly string[], measuredGive = false): readonly TrustIssue[] => {
  const parts = measuredGive
    ? LIB.map((part) => ({ ...part, slop: { ...part.slop, calibrationStatus: 'measured' as const } }))
    : LIB;
  const layout = {
    placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
    closed: true,
  } as Layout;
  return layoutTrust(layout, makeResolver(parts), brandFit);
};

const liCount = (html: string): number => html.split('<li').length - 1;
const overflow = (html: string): string | null =>
  html.match(/<p class="verdict-more">(.*?)<\/p>/)?.[1] ?? null;

/*
 * A CLAIM ABOUT THE WORLD, not about the model. These are the forms that say
 * the track will not go together, as opposed to saying the gap is past a
 * figure the engine computed. The predicate is deliberately broader than the
 * one string that used to be here, so a reworded overclaim is caught too.
 */
//
// THE APOSTROPHE IS MATCHED ESCAPED TOO. renderToStaticMarkup writes a straight
// ' as &#x27;, so the first version of this pattern never matched "Won't fit"
// typed with a straight quote: measured on 2026-10-30 by putting exactly that
// in front of the beyond headline, with every spec green.
const CLAIMS_PHYSICAL_NON_FIT = /(won(['’]|&#x27;)t|will not|does ?n(['’o]|&#x27;)t|cannot|can(['’]|&#x27;)t)\s+(fit|go together|seat|be built)/i;

describe('the EXCEEDS headline states what was checked and no more', () => {
  const html = render(exceedsResult());

  /*
   * MUTATION PROOF, run: restore the previous headline, which opened
   * "Won't fit." in front of the beyond headline (bendWords.ts) and this fails
   * with:
   *   expected '<div class="verdict verdict-fail" rol…' not to match
   *     /(won(['’]|&#x27;)t|will not|does ?n(…/i
   * Vitest truncates both sides of the message, which is why the markup and
   * the pattern are quoted here exactly as a reader will see them rather than
   * expanded.
   */
  it('does not assert that the track physically will not fit', () => {
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
  });

  /*
   * The figure was never in doubt and is the useful part of the verdict.
   * Removing the certainty must not turn the sentence into a vague one: the
   * bend the worst joint needs stays, in degrees, in the number face
   * (DESIGN.md rule 4, as amended).
   *
   * MUTATION PROOF, run: the `num` segment in `BendLine` rendered as plain
   * text fails with `expected '<div class="verdict verdict-fail" rol…' to
   * contain '<span class="num">4.3°</span>'`.
   */
  it('keeps the bend figure, in degrees, in the number face', () => {
    // 1.6 x the 2.687-degree limit, rounded up: 4.3.
    expect(html).toContain('<span class="num">4.3°</span>');
  });

  /*
   * The scope word is what makes the claim true: the loop needs more bend
   * than the TESTED joints were shown to do, which is all the model knows
   * (design 1A). Pinned on the opening words, because DESIGN.md rule 2 puts
   * the whole severity signal in the sentence for a print or colour-blind
   * reader.
   *
   * MUTATION PROOF, run: change "Beyond the ${tested} bend" to "Beyond the
   * bend" in bendWords.ts and this fails with `expected '<div class="verdict
   * verdict-fail" rol…' to match /Beyond the tested bend/`.
   */
  it('scopes the leading claim to the tested bend, and hedges it', () => {
    expect(html).toMatch(/Beyond the tested bend/);
    expect(html).toContain('It may still go together; only building it will tell.');
  });

  /*
   * WHICH RUN THE FIGURE DESCRIBES, when a layout holds more than one (design
   * 3A): the worst run leads and the line says how many of them are beyond.
   *
   * MUTATION PROOF, run: drop `{words.runs && ...}` from `BendLine` and this
   * fails with `expected '<div class="verdict verdict-fail" rol…' to contain
   * 'In 1 of 2 track runs.'`.
   */
  it('names how many runs are beyond when the layout holds more than one', () => {
    const one = exceedsResult();
    const multi: GraphResult = { ...one, rank: 2, bend: [one.lead!, runBend('closes', 0.5)] };
    expect(render(multi)).toContain('In 1 of 2 track runs.');
    // The single-run control: the phrase is omitted rather than padded.
    expect(render(one)).not.toMatch(/track runs/);
  });
});

describe('the fix does not leak into the verdict that IS definite', () => {
  /*
   * IMPOSSIBLE means two connectors occupy one place, or a joint cannot mate.
   * That is a fact about the layout's own geometry, not a comparison against an
   * estimated budget, so it keeps its definite claim. Softening it would be the
   * opposite error: hedging something the engine really does know.
   *
   * MUTATION PROOF, run: change the IMPOSSIBLE clash branch's "Can't be
   * built." to "May not be buildable." and exactly this spec fails:
   *   expected '<div class="verdict verdict-fail" rol…' to match
   *     /(won[''’]t|will not|does ?n[o']t|can…/i
   * Note the message quotes the MARKUP, not the mutated phrase: the assertion
   * reads the whole rendered string, so a prediction naming the new wording
   * would have been wrong.
   */
  it('IMPOSSIBLE still states a definite refusal', () => {
    expect(render(impossibleResult())).toMatch(CLAIMS_PHYSICAL_NON_FIT);
  });
});

describe('the action register suggests without restating the claim', () => {
  /*
   * The action is a SUGGESTION: `verdictAction.ts`'s own rule is that no action
   * may promise an outcome, and `verdictAction.test.ts` enforces that for
   * forward promises ("will fit", "will work"). A restatement of the verdict's
   * premise slips past that, which is how "The gap is larger than the joints
   * can take up." survived there.
   *
   * MUTATION PROOF, run: restore that sentence to `ACTION_FOR_VERDICT.EXCEEDS`
   * and exactly this spec fails:
   *   expected 'Change a straight for a different len…' not to match
   *     /larger than the joints|than the join…/i
   */
  it('does not restate the give comparison as a fact', () => {
    expect(ACTION_FOR_VERDICT.EXCEEDS).not.toMatch(/larger than the joints|than the joints can take/i);
  });

  /* The suggestion itself must survive the deletion. */
  it('still tells the builder what to change', () => {
    expect(ACTION_FOR_VERDICT.EXCEEDS).toMatch(/straight|curve/i);
  });
});


/*
 * THE LIMITS NOTE DOES NOT DEPEND ON THE TRUST LIST (design 2A, 5A).
 *
 * `TRUST_INLINE_LIMIT` is 2 and the sort is serious-first, so a layout with
 * several serious issues pushes the rest into a count. Where the joints'
 * bend limit comes from is not in that list: it leads the notes block and is
 * never capped, so a truncated register cannot hide it. (The give notes that
 * used to ride in the list were retired, design review 8A.)
 */
describe('the limits note does not depend on the trust list', () => {
  const exceeds = exceedsResult();
  const LIMITS = '<p class="verdict-limits">A built loop needed BRIO joints to bend 2.7°.</p>';

  it('a pure BRIO layout has no disclosures, and still says where the limit comes from', () => {
    const html = render(exceeds, trustFor(['E', 'E', 'E', 'E']));
    expect(liCount(html)).toBe(0);
    expect(overflow(html)).toBeNull();
    expect(html).toContain(LIMITS);
  });

  /*
   * Three disclosures, all serious: two shown, one counted, and the limits
   * note still there, outside the cap.
   *
   * MUTATION PROOF, run: raise `TRUST_INLINE_LIMIT` to 3 and this fails with
   * `expected 3 to be 2`; and `{bend && <BendNotes words={bend} />}` removed
   * from `notesFor` fails the pure-BRIO spec above with `expected '<div
   * class="verdict verdict-fail" rol…' to contain '<p class="verdict-limits">A
   * built loo…'`.
   */
  it('a switch plus IKEA layout truncates the list, and the limits note stays', () => {
    const trust = trustFor(['L', 'IKEA-150']);
    expect(trust.map((t) => t.kind)).toEqual(['unverified-size', 'modelled-switch', 'brands-do-not-join']);
    const html = render(exceeds, trust);
    expect(liCount(html)).toBe(2);
    expect(overflow(html)).toMatch(/1<\/span> more note\b/);
    expect(overflow(html)).not.toMatch(/notes/);
    expect(html).toContain(LIMITS);
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
  });

  it('an empty layout renders no disclosure block at all', () => {
    const html = render(exceeds, trustFor([]));
    expect(liCount(html)).toBe(0);
    expect(overflow(html)).toBeNull();
  });
});

/*
 * THE GAP IN PIECES JOINS THE SCOPED CLAIM; IT DOES NOT REPLACE IT (task X6).
 *
 * The plan froze the pieces form as "Won't fit. This loop is one Middle
 * straight (72mm) short." The first two words are the overclaim the specs
 * above exist to forbid, so the sentence is appended to the scoped headline
 * instead, and the measurement stays.
 *
 * It claims only what repair.ts proves: that one straight closes the loop
 * EXACTLY (design 10A), so the sentence says so.
 *
 * MUTATION PROOF, run: inverting the short/too-long ternary fails the
 * too-long case with `expected '<div class="verdict verdict-fail" rol…' to
 * match /\) too long: take it out and the loop closes exactly\./`.
 */
describe('the gap in pieces', () => {
  const pieces = (over: Partial<NonNullable<ReturnType<typeof viewOf>['pieces']>>) =>
    renderToStaticMarkup(
      createElement(VerdictLine, {
        view: {
          ...viewOf(exceedsResult()),
          pieces: { direction: 'short', name: 'Middle straight', lengthMm: 72, partNumber: null, ...over },
        },
      } as never),
    );

  it('names the straight and its length after the measurement, and keeps the scope', () => {
    const html = pieces({});
    expect(html).toMatch(/This loop is one Middle straight \(<span class="num">72mm<\/span>\) short: add it and the loop closes exactly\./);
    expect(html).toMatch(/Beyond the tested bend/);
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
    // The measurement comes first; the pieces sentence follows it.
    expect(html.indexOf('at a joint.')).toBeLessThan(html.indexOf('This loop is'));
  });

  it('says too long when removing the straight closes the loop', () => {
    expect(pieces({ direction: 'long' })).toMatch(/\) too long: take it out and the loop closes exactly\./);
  });

  it('appends the part number only when one is given', () => {
    const html = pieces({ name: 'Short straight', lengthMm: 108, partNumber: '33334' });
    expect(html).toMatch(/Short straight \(<span class="num">108mm<\/span>, part <span class="num">33334<\/span>\) short:/);
    expect(pieces({})).not.toContain(', part');
  });

  it('is absent when the engine proved nothing', () => {
    expect(render(exceedsResult())).not.toContain('This loop is');
  });
});
