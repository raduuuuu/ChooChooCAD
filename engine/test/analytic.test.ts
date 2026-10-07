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
import { getPart } from '../data/brio.js';
import { equals, isZero, scale, toXY } from '../src/geom/cyclotomic.js';
import { displacement } from '../src/geom/pose.js';
import { computeResidual } from '../src/solver/residual.js';
import { solveLayout } from '../src/solver/result.js';
import { evaluateJoint } from '../src/joints/evaluate.js';
import type { Layout } from '../src/parts/schema.js';

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

describe('the LP distributes slop, and says no when it cannot', () => {
  it('an exact closure uses zero slop on every joint', () => {
    const r = solveLayout(loop(rep('E', 8)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.closesExactly).toBe(true);
    expect(r.worstRatio).toBeCloseTo(0, 9);
    for (const u of r.usage) {
      expect(Math.abs(u.axialMm)).toBeLessThan(1e-6);
      expect(Math.abs(u.angularDeg)).toBeLessThan(1e-6);
    }
  });

  it('every joint reads PASS on an exact closure', () => {
    const r = solveLayout(loop(rep('E', 8)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const evals = r.usage.map((u, i) => evaluateJoint(u, r.joints[i]!, 'estimated'));
    expect(evals.every((e) => e.verdict === 'PASS')).toBe(true);
    // Estimated tolerances must be surfaced, never silently treated as measured.
    expect(evals.every((e) => e.reasons.some((s) => s.includes('estimated')))).toBe(true);
  });

  it('a 72mm gap consumes real slop', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gapMm).toBeCloseTo(72, 9);
    expect(r.worstRatio).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`  [72mm gap] worstRatio = ${r.worstRatio.toFixed(4)}`);
  });

  it('a 504mm gap is far beyond any slop budget', () => {
    const r = solveLayout(
      loop([...rep('E', 4), 'D', 'D', 'D', ...rep('E', 4), 'A']),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gapMm).toBeCloseTo(504, 9); // 648 - 144
    expect(r.worstRatio).toBeGreaterThan(1);
    // eslint-disable-next-line no-console
    console.log(`  [504mm gap] worstRatio = ${r.worstRatio.toFixed(4)}`);
  });

  it('rejects a heading mismatch outright: slop cannot rotate the track', () => {
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

describe('solver contract', () => {
  it('is deterministic: the same layout gives the same verdict', () => {
    const l = loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']);
    const a = solveLayout(l);
    const b = solveLayout(l);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  /**
   * Where you cut a closed loop is an arbitrary choice, so rotating the piece
   * order must not change what the product tells the user.
   *
   * The VERDICT is gauge-independent and asserted strictly. The exact worst
   * ratio is not: it plateaus at a ~1.9e-3 spread no matter how many refinement
   * passes run (see the limitation note in refine.ts). That is 0.003 degrees of
   * a 1.5-degree budget, on a budget nobody has measured yet, so asserting it
   * to six decimal places would be false precision rather than correctness.
   */
  const GAUGE_SPREAD_TOLERANCE = 5e-3;

  it('is order-independent in verdict, and within tolerance in ratio', () => {
    const base = [...rep('E', 4), 'D', ...rep('E', 4), 'A'];
    const rotated = [...base.slice(3), ...base.slice(0, 3)];
    const a = solveLayout(loop(base));
    const b = solveLayout(loop(rotated));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    // What the user sees must not depend on the cut.
    expect(b.worstRatio > 1).toBe(a.worstRatio > 1);
    // And the numbers must agree to a physically meaningful tolerance.
    expect(Math.abs(b.worstRatio - a.worstRatio)).toBeLessThan(GAUGE_SPREAD_TOLERANCE);
  });

  it('refinement actually closes the gap it set out to close', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gapMm).toBeCloseTo(72, 9);       // nominal gap, exact
    expect(r.remainingMm).toBeLessThan(1e-6); // after slop, closed
    expect(r.passes).toBeLessThanOrEqual(8);
    // eslint-disable-next-line no-console
    console.log(`  [refine] 72mm gap closed in ${r.passes} passes, ${r.remainingMm.toExponential(2)}mm left, worstRatio ${r.worstRatio.toFixed(4)}`);
  });

  it('never returns a non-finite number in a solved result', () => {
    for (const ids of [
      rep('E', 8),
      [...rep('E', 4), 'D', ...rep('E', 4), 'D'],
      [...rep('E', 4), 'D', ...rep('E', 4), 'A'],
      [...rep('E', 8), 'A2'],
    ]) {
      const r = solveLayout(loop(ids));
      if (!r.ok) continue;
      expect(Number.isFinite(r.worstRatio)).toBe(true);
      expect(Number.isFinite(r.gapMm)).toBe(true);
      for (const u of r.usage) {
        expect(Number.isFinite(u.axialMm)).toBe(true);
        expect(Number.isFinite(u.angularDeg)).toBe(true);
        expect(Number.isFinite(u.ratio)).toBe(true);
      }
    }
  });
});
