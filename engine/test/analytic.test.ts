/**
 * Analytic tier: layouts whose correct answer is known in advance.
 *
 * This tier exists because no other test can catch a mapping error. If a joint
 * is wired to the wrong constraint, the solver solves the wrong problem
 * perfectly: property tests still pass (the wrong answer is still
 * deterministic, order-independent and finite), fuzzing still passes (still
 * well-formed, still terminates), and only physically building track would
 * notice, slowly and confounded with calibration error.
 *
 * These fixtures are free and instant, and a failure here points unambiguously
 * at the geometry or the mapping rather than at a measurement.
 */

import { describe, expect, it } from 'vitest';
import { BRIO_PARTS, getPart } from '../data/brio.js';
import { equals, isZero, scale, toXY } from '../src/geom/cyclotomic.js';
import { displacement } from '../src/geom/pose.js';
import { computeResidual } from '../src/solver/residual.js';
import { findPolarityViolations } from '../src/feasible.js';
import { solveLayout } from '../src/solver/result.js';
import { evaluateLayout } from '../src/joints/evaluate.js';
import type { Layout, Part } from '../src/parts/schema.js';

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);

describe('exact forward kinematics', () => {
  it('one E curve lands at (91*sqrt2, 182 - 91*sqrt2)', () => {
    const d = displacement(getPart('E'), 0, 'left');
    const [x, y] = toXY(d);
    expect(x).toBeCloseTo(91 * Math.SQRT2, 9);
    expect(y).toBeCloseTo(182 - 91 * Math.SQRT2, 9);
    expect(x).toBeCloseTo(128.69343417595164, 9);
    expect(y).toBeCloseTo(53.30656582404836, 9);
  });

  it('a right E curve mirrors a left one', () => {
    const [lx, ly] = toXY(displacement(getPart('E'), 0, 'left'));
    const [rx, ry] = toXY(displacement(getPart('E'), 0, 'right'));
    expect(rx).toBeCloseTo(lx, 9);
    expect(ry).toBeCloseTo(-ly, 9);
  });

  it('published straight-length relations hold exactly', () => {
    // A1 = 2*A2, D = 2*A1, 2*D = 3*A (woodenrailway Track Math). Along one
    // heading, n copies of a straight must equal the longer straight exactly,
    // so this is a check on the transcribed part data as much as the geometry.
    const run = (id: string, n: number) => scale(displacement(getPart(id), 0), n);
    expect(equals(run('A2', 2), run('A1', 1))).toBe(true);
    expect(equals(run('A1', 2), run('D', 1))).toBe(true);
    expect(equals(run('D', 2), run('A', 3))).toBe(true);
  });
});

describe('exact closures: residual is the zero element, not a small float', () => {
  it('8 x E forms a full circle and closes exactly', () => {
    const res = computeResidual(loop(rep('E', 8)), getPart);
    expect(isZero(res.exact)).toBe(true);
    expect(res.closesExactly).toBe(true);
    expect(res.gapMm).toBe(0);
    expect(res.headingMismatchSteps).toBe(0);
  });

  it('8 x E1 also closes exactly (radius is irrelevant to closure)', () => {
    const res = computeResidual(loop(rep('E1', 8)), getPart);
    expect(isZero(res.exact)).toBe(true);
    expect(res.gapMm).toBe(0);
  });

  it('stadium 4E + D + 4E + D closes exactly', () => {
    const res = computeResidual(
      loop([...rep('E', 4), 'D', ...rep('E', 4), 'D']),
      getPart,
    );
    expect(isZero(res.exact)).toBe(true);
    expect(res.gapMm).toBe(0);
    expect(res.headingMismatchSteps).toBe(0);
  });

  it('stadium with A instead of D does NOT close, and the gap is exactly 72mm', () => {
    const res = computeResidual(
      loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']),
      getPart,
    );
    expect(isZero(res.exact)).toBe(false);
    expect(res.gapMm).toBeCloseTo(72, 9); // 216 - 144
    expect(res.headingMismatchSteps).toBe(0);
  });
});
describe('the bound: a gap cannot exceed the give', () => {
  it('an exact closure needs no give at all', () => {
    const r = solveLayout(loop(rep('E', 8)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.closesExactly).toBe(true);
    expect(r.gapMm).toBeCloseTo(0, 9);
    expect(r.withinBound).toBe(true);
  });

  it('reads EXACT and surfaces that the give is estimated, never silently measured', () => {
    const r = solveLayout(loop(rep('E', 8)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = evaluateLayout(r, 'estimated');
    expect(e.verdict).toBe('EXACT');
    expect(e.reasons.some((s) => s.includes('estimated'))).toBe(true);
  });

  it('total give is the sum over joints, so it scales with piece count', () => {
    const eight = solveLayout(loop(rep('E', 8)));
    const sixteen = solveLayout(loop(rep('E', 16)));
    expect(eight.ok && sixteen.ok).toBe(true);
    if (!eight.ok || !sixteen.ok) return;
    expect(eight.joints).toHaveLength(8);
    expect(sixteen.joints).toHaveLength(16);
    // 0.8mm one-sided per joint, from ESTIMATED_SLOP.
    expect(eight.totalGiveMm).toBeCloseTo(6.4, 9);
    expect(sixteen.totalGiveMm).toBeCloseTo(12.8, 9);
  });

  it('a 72mm gap exceeds the give and is a definite no', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gapMm).toBeCloseTo(72, 9);
    expect(r.withinBound).toBe(false);
    expect(evaluateLayout(r, 'estimated').verdict).toBe('EXCEEDS');
  });

  it('a 504mm gap exceeds it by far', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', 'D', 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gapMm).toBeCloseTo(504, 9); // 648 - 144
    expect(r.withinBound).toBe(false);
  });

  /**
   * Honest limitation, asserted so it cannot drift unnoticed.
   *
   * With the current guessed give of 0.8mm per joint, a ten-joint layout offers
   * 8mm in total, while real gaps on this lattice arrive in part-length steps:
   * 54mm, 72mm, 216mm. So for SMALL layouts the hedged middle band is nearly
   * empty and almost everything is either exact or a definite no.
   *
   * It is the opposite at scale, because give accumulates with joint count
   * while the gap does not: a 641-piece layout with a 54mm gap has 512mm of
   * give and sits comfortably inside the bound. Measured, not assumed.
   *
   * That asymmetry is the honest shape of a NECESSARY condition. Being inside
   * the bound says the gap could fit if any joint could absorb any share of
   * it, which the geometry does not guarantee. The verdict copy says "may well
   * seat", never "will".
   */
  it('documents that the band is narrow for SMALL layouts under the guessed give', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalGiveMm).toBeLessThan(10);
    expect(r.gapMm / r.totalGiveMm).toBeGreaterThan(5);
  });

  it('rejects a heading mismatch outright: give cannot rotate the track', () => {
    const r = solveLayout(loop(rep('E', 7))); // 315 degrees
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('HEADING_MISMATCH');
  });

  it('rejects an open chain', () => {
    const r = solveLayout({ placements: [{ partId: 'E' }], closed: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('OPEN_CHAIN');
  });
});

describe('bound contract', () => {
  it('is deterministic: the same layout gives the same verdict', () => {
    const l = loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']);
    expect(JSON.stringify(solveLayout(l))).toBe(JSON.stringify(solveLayout(l)));
  });

  /**
   * Where you cut a closed loop is an arbitrary bookkeeping choice, so rotating
   * the piece order must not change what the product says.
   *
   * This is now asserted EXACTLY, at every cut point, with no tolerance. The
   * old minimax LP could only manage this to about 5e-3, and at 42 pieces the
   * spread reached 6.4e-2 and flipped the verdict between FAIL and TIGHT
   * depending on which piece came first. The bound is a sum over joints, and
   * addition does not care about order, so gauge dependence is impossible here
   * rather than merely small.
   */
  it('is order-independent EXACTLY, at every cut point', () => {
    const base = [...rep('E', 4), 'D', ...rep('E', 4), 'A'];
    const first = solveLayout(loop(base));
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    for (let off = 1; off < base.length; off++) {
      const rot = [...base.slice(off), ...base.slice(0, off)];
      const r = solveLayout(loop(rot));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.gapMm).toBeCloseTo(first.gapMm, 9);
      expect(r.totalGiveMm).toBe(first.totalGiveMm);
      expect(r.withinBound).toBe(first.withinBound);
      expect(evaluateLayout(r, 'estimated').verdict).toBe(
        evaluateLayout(first, 'estimated').verdict,
      );
    }
  });

  it('never returns a non-finite number, and a failure is never silently skipped', () => {
    let checked = 0;
    for (const ids of [
      rep('E', 8),
      [...rep('E', 4), 'D', ...rep('E', 4), 'D'],
      [...rep('E', 4), 'D', ...rep('E', 4), 'A'],
      [...rep('E', 8), 'A2'],
    ]) {
      const r = solveLayout(loop(ids));
      // Every fixture here must be checkable. The old version of this test did
      // `if (!r.ok) continue`, which silently passed a hard solver failure.
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(Number.isFinite(r.gapMm)).toBe(true);
      expect(Number.isFinite(r.totalGiveMm)).toBe(true);
      for (const j of r.joints) {
        expect(Number.isFinite(j.axialMaxMm)).toBe(true);
        expect(Number.isFinite(j.angularMaxDeg)).toBe(true);
      }
      checked++;
    }
    expect(checked).toBe(4);
  });

  it('an unknown layout is never mistaken for a passing one', () => {
    const open = solveLayout({ placements: [{ partId: 'E' }], closed: false });
    const e = evaluateLayout(open, 'estimated');
    expect(e.verdict).toBe('UNKNOWN');
    expect(e.verdict).not.toBe('EXACT');
  });
});

/**
 * Task U2: the plank is wider than the gauge.
 *
 * This exists because the project already got it wrong once. The first design
 * review proposed using `gaugeWidthMm` as the drawn plank width; the 40mm gauge
 * is the spacing of the rail grooves, which sit inboard of the plank's edges, so
 * the plank is strictly wider. Encoding the relation as a test means the
 * conflation cannot come back quietly when the catalogue grows.
 */
describe('plank width is a part property, and is not the gauge', () => {
  it('every part records a plank strictly wider than its gauge', () => {
    for (const p of BRIO_PARTS) {
      expect(Number.isFinite(p.plankWidthMm), p.id).toBe(true);
      expect(p.plankWidthMm, p.id).toBeGreaterThan(p.gaugeWidthMm);
    }
  });

  it('it is a per-part constant, so it cannot vary with layout size', () => {
    // The defect being prevented: the canvas scaled stroke width by viewBox
    // extent, so the same piece drew ~20% thicker in a 40-piece layout than in
    // a 4-piece one. A per-part field has no layout input to vary with.
    const e = getPart('E');
    expect(getPart('E').plankWidthMm).toBe(e.plankWidthMm);
    expect(e.plankWidthMm).toBeGreaterThan(0);
  });

  it('is still estimated, so nothing may derive a verdict from it', () => {
    // The guard is social, not mechanical: assert the slop budget this part
    // DOES carry is estimated, so the verdict path stays hedged either way.
    for (const p of BRIO_PARTS) {
      expect(p.slop.calibrationStatus).not.toBe('measured');
    }
  });
});

/**
 * Task C2 / plan line 3189: two ends of the same kind cannot be joined.
 *
 * Append-only placement cannot produce this, because every piece faces the same
 * way, so there is no fixture in the real catalogue that exercises it. That is
 * precisely the gap: the condition was unmodelled and a layout containing it
 * returned EXACT. These use an injected resolver with a DOUBLE-PEG part, which
 * is the only way to reach the state today and is exactly what decision D8's
 * declared welds will make reachable by clicking.
 */
describe('connector polarity', () => {
  /** 'PP' has a peg at both ends. Everything else is a standard BRIO curve. */
  const doublePeg = (id: string): Part => {
    const base = getPart('E');
    if (id !== 'PP') return base;
    return { ...base, id: 'PP', ends: { start: 'peg', end: 'peg' } };
  };

  const circleWithDoublePeg = (at: number): Layout => ({
    placements: Array.from({ length: 8 }, (_, i) => ({
      partId: i === at ? 'PP' : 'E',
      turn: 'left' as const,
    })),
    closed: true,
  });

  it('the real catalogue has no violation anywhere, open or closed', () => {
    const fixtures: Layout[] = [
      loop(rep('E', 8)),
      loop([...rep('E', 4), 'D', ...rep('E', 4), 'D']),
      { placements: rep('A', 3).map((partId) => ({ partId })), closed: false },
    ];
    for (const f of fixtures) {
      const r = solveLayout(f);
      if (r.ok) expect(r.polarityViolations).toHaveLength(0);
    }
  });

  it('a double-peg piece is refused even though the loop closes exactly', () => {
    const layout = circleWithDoublePeg(3);
    const r = solveLayout(layout, doublePeg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The false pass, stated: geometry is identical to the exact circle.
    expect(r.closesExactly).toBe(true);
    // Its peg end meets piece 4's socket, which is fine. Its PEG START meets
    // piece 2's peg end, which is not. Exactly one violation.
    expect(r.polarityViolations).toHaveLength(1);
    expect(r.polarityViolations[0]!.between).toEqual(['E', 'PP']);
    expect(r.polarityViolations[0]!.polarity).toBe('peg');
    const e = evaluateLayout(r, 'estimated');
    expect(e.verdict).toBe('IMPOSSIBLE');
    expect(e.verdict).not.toBe('EXACT');
  });

  it('the seam is checked too, not just interior joints', () => {
    // Double-peg piece LAST: its start meets piece 6's peg (interior), and its
    // own peg end meets piece 0's socket across the seam (fine). Put it FIRST
    // instead and the seam itself carries the violation.
    const first = solveLayout(circleWithDoublePeg(0), doublePeg);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const seam = first.polarityViolations.find((v) => v.jointIndex === 7);
    expect(seam).toBeDefined();
    expect(seam!.between).toEqual(['E', 'PP']);
  });

  it('an open chain has one fewer joint to check, and no phantom seam', () => {
    const open: Layout = { placements: [{ partId: 'PP' }, { partId: 'PP' }], closed: false };
    const r = solveLayout(open, doublePeg);
    // An open chain fails earlier, at OPEN_CHAIN, so check the predicate directly.
    expect(r.ok).toBe(false);
    const violations = findPolarityViolations(open, doublePeg);
    // One joint only (between the two pieces), and it IS a violation: peg to peg.
    expect(violations).toHaveLength(1);
    expect(violations[0]!.jointIndex).toBe(0);
  });
});

/**
 * Task C4: a layout can close exactly and still be impossible.
 *
 * These two fixtures were the engine's known FALSE PASSES. Both have a zero
 * residual and a correct heading, so every closure test in this file passed them
 * and the verdict line said "This works. Closes exactly." Sixteen large curves
 * run round the same circle twice; eight left plus eight right touch at a single
 * tangency point where three joints land on one position.
 *
 * The check is integer position equality, so these assertions carry no epsilon
 * and no tolerance. The pair COUNTS are asserted exactly, because a change in
 * them means the adjacency or seam exclusions moved.
 */
describe('coincident connectors are a definite refusal', () => {
  const eightLeftEightRight: Layout = {
    placements: Array.from({ length: 16 }, (_, i) => ({
      partId: 'E',
      turn: i < 8 ? ('left' as const) : ('right' as const),
    })),
    closed: true,
  };

  it('sixteen large curves close exactly and are still IMPOSSIBLE', () => {
    const r = solveLayout(loop(rep('E', 16)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The false pass, stated: closure is perfect.
    expect(r.closesExactly).toBe(true);
    expect(r.gapMm).toBeCloseTo(0, 9);
    // And the layout cannot be built.
    expect(r.clashes).toHaveLength(9);
    const e = evaluateLayout(r, 'estimated');
    expect(e.verdict).toBe('IMPOSSIBLE');
    expect(e.verdict).not.toBe('EXACT');
    expect(e.reasons.some((x) => x.includes('does close exactly'))).toBe(true);
  });

  it('the eight-left eight-right tangency is IMPOSSIBLE', () => {
    const r = solveLayout(eightLeftEightRight);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.closesExactly).toBe(true);
    // Three joints at one position: connectors 0, 8 and 16. The seam pair
    // (0, 16) is excluded, leaving 0~8 and 8~16.
    expect(r.clashes).toHaveLength(2);
    expect(r.clashes.map((c) => `${c.a}~${c.b}`)).toEqual(['0~8', '8~16']);
    expect(evaluateLayout(r, 'estimated').verdict).toBe('IMPOSSIBLE');
  });

  it('every layout that really is assemblable stays clean', () => {
    const clean: Array<[string, Layout]> = [
      ['circle', loop(rep('E', 8))],
      ['stadium', loop([...rep('E', 4), 'D', ...rep('E', 4), 'D'])],
      ['near miss', loop([...rep('E', 4), 'D', ...rep('E', 4), 'A'])],
    ];
    for (const [name, layout] of clean) {
      const r = solveLayout(layout);
      expect(r.ok, name).toBe(true);
      if (!r.ok) continue;
      expect(r.clashes, name).toHaveLength(0);
      expect(evaluateLayout(r, 'estimated').verdict, name).not.toBe('IMPOSSIBLE');
    }
  });

  it('IMPOSSIBLE outranks EXACT, and never claims to be a full overlap check', () => {
    const r = solveLayout(loop(rep('E', 16)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = evaluateLayout(r, 'estimated');
    expect(e.verdict).toBe('IMPOSSIBLE');
    // The limitation is disclosed in the verdict itself, not only in a comment.
    expect(e.reasons.some((x) => x.includes('mid-span'))).toBe(true);
  });
});

/**
 * Fix C3 / finding F1: a joint has two sides.
 *
 * Every BRIO part currently shares one ESTIMATED_SLOP, so a one-sided read and
 * a pair-wise read agree on every real fixture and no existing test could tell
 * them apart. These use an injected resolver with DIFFERING budgets, which is
 * the only way to see the difference, and they assert it BOTH WAYS ROUND: the
 * answer must not depend on which of the two pieces was listed first.
 */
describe('joint budgets come from the mating pair', () => {
  const LOOSE = 2.0;
  const TIGHT = 0.5;

  /** Eight E curves, but the piece at `looseAt` has a looser budget. */
  const resolverWithOneLoosePiece = (looseId: string) => (id: string): Part => {
    const base = getPart('E');
    return {
      ...base,
      id,
      slop: {
        axialMm: id === looseId ? LOOSE : TIGHT,
        angularDeg: id === looseId ? 4 : 1,
        calibrationStatus: 'estimated' as const,
      },
    };
  };

  /** A circle of eight 45-degree curves, with one piece given a distinct id. */
  const circleWithOneDistinct = (distinctId: string, at: number): Layout => ({
    placements: Array.from({ length: 8 }, (_, i) => ({
      partId: i === at ? distinctId : 'E',
      turn: 'left' as const,
    })),
    closed: true,
  });

  it('a joint touching the loose piece gets the loose budget, not the tight one', () => {
    const layout = circleWithOneDistinct('LOOSE', 3);
    const res = computeResidual(layout, resolverWithOneLoosePiece('LOOSE'));
    expect(res.joints).toHaveLength(8);

    const touching = res.joints.filter((j) => j.between.includes('LOOSE'));
    // Piece 3 has a joint on each side of it, so exactly two joints touch it.
    expect(touching).toHaveLength(2);
    for (const j of touching) expect(j.axialMaxMm).toBeCloseTo(LOOSE, 9);

    const notTouching = res.joints.filter((j) => !j.between.includes('LOOSE'));
    expect(notTouching).toHaveLength(6);
    for (const j of notTouching) expect(j.axialMaxMm).toBeCloseTo(TIGHT, 9);
  });

  it('the pair-wise answer is the same whichever side comes first', () => {
    // The same physical circle, with the loose piece in two different slots.
    // A one-sided read gives one joint the loose budget; a pair-wise read gives
    // two. Both placements must agree, because the joint is the same joint.
    const a = computeResidual(circleWithOneDistinct('LOOSE', 0), resolverWithOneLoosePiece('LOOSE'));
    const b = computeResidual(circleWithOneDistinct('LOOSE', 5), resolverWithOneLoosePiece('LOOSE'));
    const giveA = a.joints.reduce((s, j) => s + j.axialMaxMm, 0);
    const giveB = b.joints.reduce((s, j) => s + j.axialMaxMm, 0);
    expect(giveA).toBeCloseTo(giveB, 9);
    // 2 joints at LOOSE, 6 at TIGHT. A one-sided read would total 7*TIGHT+LOOSE.
    expect(giveA).toBeCloseTo(2 * LOOSE + 6 * TIGHT, 9);
    expect(giveA).not.toBeCloseTo(7 * TIGHT + LOOSE, 9);
  });

  it('the closing seam mates the last piece to the first, not to itself', () => {
    // The loose piece is LAST. Its joints are the seam (last-to-first) and the
    // one before it. A wrap-around bug would show up here and nowhere else.
    const res = computeResidual(circleWithOneDistinct('LOOSE', 7), resolverWithOneLoosePiece('LOOSE'));
    const seam = res.joints[res.joints.length - 1]!;
    expect(seam.between).toEqual(['LOOSE', 'E']);
    expect(seam.axialMaxMm).toBeCloseTo(LOOSE, 9);
    expect(res.joints.filter((j) => j.between.includes('LOOSE'))).toHaveLength(2);
  });
});
