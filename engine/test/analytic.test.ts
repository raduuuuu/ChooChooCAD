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
import { evaluateLayout } from '../src/joints/evaluate.js';
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
