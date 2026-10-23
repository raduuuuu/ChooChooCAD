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
  giveMm: 1.5,
  withinGive: true,
  ...over,
});

/**
 * The Near-miss shape: 72mm of gap against 8mm of modelled give.
 *
 * Returns the SOLVED branch, not the `GraphResult` union, so a caller can
 * spread it and override `cycles`/`worst`. `verdictView.test.ts`'s `solved()`
 * narrows the same way. Typed as the union, the spread fails to narrow and
 * `tsc` rejects both the added `cycles` key and any read of `worst`.
 */
const exceedsResult = (): Extract<GraphResult, { ok: true }> => {
  const worst = cycle({ gapMm: 72, giveMm: 8, withinGive: false });
  return {
    ok: true,
    closesExactly: false,
    gapMm: 72,
    totalGiveMm: 8,
    withinBound: false,
    rank: 1,
    cycles: [worst],
    worst,
    clashes: [],
    overlaps: [],
    polarityViolations: [],
    residuals: [],
    repair: null,
  };
};

const impossibleResult = (): Extract<GraphResult, { ok: true }> => {
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
    clashes: [{ a: { pieceId: 'p1', port: 0 }, b: { pieceId: 'p2', port: 1 }, at: [0, 0] }],
    overlaps: [],
    polarityViolations: [],
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
const CLAIMS_PHYSICAL_NON_FIT = /(won[''’]t|will not|does ?n[o']t|cannot|can[''’]t)\s+(fit|go together|seat|be built)/i;

describe('the EXCEEDS headline states what was checked and no more', () => {
  const html = render(exceedsResult());

  /*
   * MUTATION PROOF, run: restore the previous headline, which opened
   * "Won't fit. Needs 72mm absorbed, but the joints give only 8mm in total."
   * TWO specs in this describe fail, this one and the scope one below:
   *   expected '<div class="verdict verdict-fail" rol…' not to match
   *     /(won[''’]t|will not|does ?n[o']t|can…/i
   *   expected '<div class="verdict verdict-fail" rol…' to match
   *     /Exceeds the modelled/
   * Vitest truncates both sides of the message, which is why the markup and
   * the pattern are quoted here exactly as a reader will see them rather than
   * expanded.
   */
  it('does not assert that the track physically will not fit', () => {
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
  });

  /*
   * The numbers were never in doubt and are the useful part of the verdict.
   * Removing the certainty must not turn the sentence into a vague one.
   *
   * MUTATION PROOF, run: replace the `{e.giveMm.toFixed(0)}mm` span in the
   * EXCEEDS branch with the words "some amount" and exactly this spec fails:
   *   expected '<div class="verdict verdict-fail" rol…' to contain '8mm'
   */
  it('keeps both millimetre figures', () => {
    expect(html).toContain('72mm');
    expect(html).toContain('8mm');
  });

  /*
   * The scope word is what makes the claim true: the gap IS past the figure the
   * engine modelled, and that is all the arithmetic established. So the LEADING
   * claim is pinned, not merely the presence of the word somewhere.
   *
   * THIS SPEC WAS WEAK AND THE MUTATION CAUGHT IT. It first read
   * `expect(html).toMatch(/modelled/i)`, and changing the leading claim from
   * "Exceeds the modelled give" to "Exceeds the give" left it GREEN, because
   * the tail of the same sentence says "are modelled to give" and satisfied the
   * regex on its own. A spec that passes under the mutation it documents is the
   * defect this repo has shipped four times; the fix is to assert the thing the
   * comment claims.
   *
   * Pinning the opening words is deliberate rather than lazy: DESIGN.md rule 2
   * puts the whole severity signal in the sentence for a print or colour-blind
   * reader, so the first words ARE the contract and a reword should force a
   * re-read of this spec.
   *
   * MUTATION PROOF, run: change "Exceeds the modelled give" to "Exceeds the
   * give" and this fails with `expected '<div class="verdict verdict-fail"
   * rol…' to match /Exceeds the modelled/`.
   */
  it('scopes the leading claim to the modelled give', () => {
    expect(html).toMatch(/Exceeds the modelled/);
  });

  /*
   * WHICH LOOP THE FIGURES DESCRIBE, on the sentence that was just reworded.
   *
   * Value: protects=the EXCEEDS headline keeps saying how many loops failed
   * when a layout holds more than one, so "needs 72mm" is never read as the
   * whole layout's gap
   * Value: fails_when=a reword of this sentence drops `{loopNote}`, which is a
   * live risk precisely because this headline is the part of the file under
   * active edit -- this change rewrote every other word of it
   * Value: why_new=`verdictView.test.ts` owns `failingLoops` and `rank` as view
   * MODEL fields. No test rendered the phrase, on this branch or any other, so
   * the sentence could lose it with every spec in the repo green
   * Value: seam=`renderToStaticMarkup`, as above
   * Value: no_claim=nothing about the single-loop case beyond its silence,
   * which is asserted here only as the control, and nothing about NEEDS_GIVE,
   * which interpolates the same note and is not what this change touched
   *
   * MUTATION PROOF, run: delete `{loopNote}` from the EXCEEDS branch's
   * sentence and exactly this spec fails:
   *   expected '<div class="verdict verdict-fail" rol…' to match
   *     /2<\/spa…/
   * Vitest truncates the pattern as well as the markup, so both sides of that
   * message are quoted here as a reader will actually see them.
   */
  it('names how many loops failed when the layout holds more than one', () => {
    const one = exceedsResult();
    const multi: GraphResult = {
      ...one,
      rank: 3,
      cycles: [one.worst!, cycle({ withinGive: false }), cycle({ withinGive: true })],
    };
    expect(render(multi)).toMatch(/2<\/span> of <span class="num">3<\/span> loops/);
    // The single-loop control: the phrase is omitted rather than padded to a
    // constant shape, so its absence here is the thing that makes the
    // assertion above about rank and not about the sentence always ending so.
    expect(render(one)).not.toMatch(/loops\./);
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
 * THE QUALIFICATION SURVIVES TRUNCATION, because it is no longer in the list.
 *
 * `TRUST_INLINE_LIMIT` is 2 and the sort is serious-first, so a layout with two
 * serious issues pushes BOTH give notes into a non-interactive count that no UI
 * can open until task U7a ships. That was a real defect while the give
 * qualification lived only in the register: on exactly the layouts whose
 * dimensions are least trustworthy, the caveat was unreadable.
 *
 * It stopped being a defect when the EXCEEDS headline took the scope word.
 * These cases pin that, which is the guarantee the review bought: the register
 * may be truncated to nothing and the verdict still will not overclaim.
 */
describe('the give qualification does not depend on the trust list', () => {
  const exceeds = exceedsResult();

  it('a pure BRIO layout shows both give notes and no overflow', () => {
    const html = render(exceeds, trustFor(['E', 'E', 'E', 'E']));
    expect(liCount(html)).toBe(2);
    expect(overflow(html)).toBeNull();
  });

  /*
   * This is the case that made the old arrangement wrong, and it is now
   * harmless. Four issues, two serious, so neither give note can be shown.
   *
   * MUTATION PROOF, run: raise `TRUST_INLINE_LIMIT` to 3 and exactly this spec
   * fails:
   *   expected 3 to be 2 // Object.is equality
   * Which is the review's own rejected remedy caught by its replacement: the
   * limit is no longer load-bearing, so moving it is now a behaviour change
   * with a spec against it rather than a fix.
   */
  it('a BRIO plus IKEA layout truncates BOTH give notes, and the headline still scopes its claim', () => {
    const trust = trustFor(['A', 'IKEA-150']);
    const kinds = trust.map((t) => t.kind);
    // Four issues, two of them serious, so neither give note can be shown.
    expect(kinds).toContain('unverified-size');
    expect(kinds).toContain('brands-do-not-join');
    expect(kinds).toContain('estimated-give');
    expect(kinds).toContain('axial-only-give');

    const html = render(exceeds, trust);
    expect(liCount(html)).toBe(2);
    expect(overflow(html)).toMatch(/2<\/span> more/);
    expect(html).not.toContain('pull-apart slack only');

    // The point: the caveat is gone from the list and the claim is still scoped.
    expect(html).toMatch(/Exceeds the modelled/);
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
  });

  /*
   * THE X3 TRAP AT THE RENDER LEVEL. `engine/test/analytic.test.ts` pins that
   * the register still emits the axial note when every part reports a measured
   * give; this pins that a builder can READ it, which is the half that matters
   * to them.
   *
   * MUTATION PROOF, run: re-gate rule 5 in `engine/src/joints/trust.ts` on
   * `calibrationStatus !== 'measured'`, the same guard rule 4 uses, and exactly
   * this spec fails:
   *   expected +0 to be 1 // Object.is equality
   * Zero disclosures rendered: measuring the give would have deleted the
   * statement that the give is only half-modelled.
   */
  it('a fully measured library still shows the axial-only note', () => {
    const html = render(exceeds, trustFor(['E', 'E', 'E', 'E'], true));
    expect(liCount(html)).toBe(1);
    expect(html).toContain('pull-apart slack only');
    expect(html).not.toContain('estimated, not measured');
  });

  /*
   * THE OVERFLOW SENTENCE, WHICH RULE 5 MADE REACHABLE ON ORDINARY LAYOUTS.
   *
   * Value: protects=a layout that rule 5 pushed from two disclosures to three
   * tells the builder a third exists, in the singular, instead of dropping it
   * silently
   * Value: fails_when=the unconditional axial note stops being emitted, so the
   * count falls back to two and the sentence disappears entirely; or the
   * singular/plural ternary inverts and a builder reads "1 more notes"
   * Value: why_new=`verdict-more` is asserted at a hidden count of 2 ('a BRIO
   * plus IKEA layout...') and of 0 ('an empty layout...'), never at 1. Before
   * rule 5 this layout carried exactly two issues and rendered NO overflow, so
   * the element itself is new on this layout and arrived untested
   * Value: seam=`renderToStaticMarkup`, as above
   * Value: no_claim=nothing about the truncation being the right design -- the
   * full list needs task U7a -- and nothing about WHICH note is hidden, which
   * the emission-order spec in `engine/test/analytic.test.ts` owns
   *
   * BRIO PLUS PLAYTIVE RATHER THAN IKEA, on purpose. `brandFit` records that
   * pair as 'unknown' rather than 'does-not-join', so there is no second
   * serious issue and the hidden count lands on exactly one.
   *
   * MUTATION PROOF, run: invert the singular/plural ternary in
   * `VerdictLine.tsx` to `hidden === 1 ? 'notes' : 'note'` and exactly this
   * spec fails:
   *   expected 'and <span class="num">1</span> more n…' to match
   *     /1<\/span> more note\b/
   * Deleting rule 5's `issues.push` instead fails it on the kinds line above,
   * with `expected [ 'unverified-size', 'estimated-give' ] to deeply equal [
   * 'unverified-size', …(2) ]` -- and takes the three sibling specs in this
   * describe with it, which is the correct blast radius for removing the rule.
   */
  it('a layout with three disclosures counts the hidden one in the singular', () => {
    const trust = trustFor(['E', 'PLAYTIVE-60']);
    expect(trust.map((t) => t.kind)).toEqual([
      'unverified-size',
      'estimated-give',
      'axial-only-give',
    ]);

    const html = render(exceeds, trust);
    expect(liCount(html)).toBe(2);
    expect(overflow(html)).toMatch(/1<\/span> more note\b/);
    expect(overflow(html)).not.toMatch(/notes/);
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
 * MUTATION PROOF, run: in the EXCEEDS branch, render the pieces sentence in
 * place of the measurement (delete the "Needs ... in total." text). This
 * spec fails with `expected '<div class="verdict verdict-fail" rol…' to
 * contain '8mm'`, and so does 'keeps both millimetre figures' above.
 * Inverting the short/too-long ternary fails the too-long case with
 * `expected '<div class="verdict verdict-fail" rol…' to match /\) too long\./`.
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
    expect(html).toMatch(/This loop is one Middle straight \(<span class="num">72mm<\/span>\) short\./);
    expect(html).toMatch(/Exceeds the modelled/);
    expect(html).toContain('8mm');
    expect(html).not.toMatch(CLAIMS_PHYSICAL_NON_FIT);
    // The measurement comes first; the pieces sentence follows it.
    expect(html.indexOf('in total.')).toBeLessThan(html.indexOf('This loop is'));
  });

  it('says too long when removing the straight closes the loop', () => {
    expect(pieces({ direction: 'long' })).toMatch(/\) too long\./);
  });

  it('appends the part number only when one is given', () => {
    const html = pieces({ name: 'Short straight', lengthMm: 108, partNumber: '33334' });
    expect(html).toMatch(/Short straight \(<span class="num">108mm<\/span>, part <span class="num">33334<\/span>\) short\./);
    expect(pieces({})).not.toContain(', part');
  });

  it('is absent when the engine proved nothing', () => {
    expect(render(exceedsResult())).not.toContain('This loop is');
  });
});
