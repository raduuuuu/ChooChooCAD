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
import {
  BUILT_IN,
  loadSubmissions,
  makeResolver,
  resolveLibrary,
  saveSubmissions,
  SUBMISSIONS_STORAGE_KEY,
  type Submission,
} from '../data/library.js';
import { brandFit } from '../data/thirdParty.js';
import { layoutTrust } from '../src/joints/trust.js';
import {
  CONFLICTS,
  CURVE_ARC_STEPS,
  CURVE_RADII_OURS,
  BRIO_PIECE_TABLE,
  RESOLVED,
  STRAIGHT_LENGTHS,
} from '../data/sources.js';
import { equals, isZero, scale, toXY } from '../src/geom/cyclotomic.js';
import { displacement } from '../src/geom/pose.js';
import { computeResidual, totalGiveMm } from '../src/solver/residual.js';
import { findPolarityViolations } from '../src/feasible.js';
import { solveLayout } from '../src/solver/result.js';
import { evaluateLayout } from '../src/joints/evaluate.js';
import { centrelineRadiusMm, isUncorroborated, isUnverified } from '../src/parts/schema.js';
import type { Layout, Part } from '../src/parts/schema.js';

const loop = (ids: string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: true,
});

const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);

describe('exact forward kinematics', () => {
  it('a 45-degree curve lands at (r/sqrt2, r - r/sqrt2) for ITS OWN radius', () => {
    // Derived from the part, not from a literal. This tests the GEOMETRY and
    // stays correct if the radius datum is ever corrected; pinning the datum
    // itself is one test, in 'catalogue data matches its published source'.
    for (const id of ['E', 'E1']) {
      const part = getPart(id) as Extract<Part, { kind: 'curve' }>;
      const r = centrelineRadiusMm(part);
      const [x, y] = toXY(displacement(part, 0, 'left'));
      expect(x, id).toBeCloseTo(r / Math.SQRT2, 9);
      expect(y, id).toBeCloseTo(r - r / Math.SQRT2, 9);
    }
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
    // A3 is half of A, added 2026-10-09. The source notes it is the ONLY
    // division of A, which is why gaps between A1 and A2 are hard to resolve.
    expect(equals(run('A3', 2), run('A', 1))).toBe(true);
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

  /*
   * THE GIVE TOTAL IGNORES ROTATION, WHICH IS WHAT RULE 5 CLAIMS.
   *
   * Value: protects=`totalGiveMm` counts axial slack ONLY, which is the premise
   * that both the unconditional `axial-only-give` disclosure and the EXCEEDS
   * headline's word "modelled" rest on
   * Value: fails_when=a give calculation starts counting `angularMaxDeg`, at
   * which point rule 5 is disclosing an omission the engine no longer makes --
   * `trust.ts` says exactly that ("the rule stops being true only when the
   * engine starts reading `angularMaxDeg`, and deleting it is then part of that
   * change"), and this spec is what forces that deletion to happen in the same
   * change rather than leaving a false caveat on screen
   * Value: why_new=`angularMaxDeg` had ONE assertion in the whole repo, that it
   * is finite ('never returns a non-finite number', below). Nothing pinned that
   * it does not reach the total, so the premise of an unconditional
   * user-facing disclosure was unprotected
   * Value: seam=none. `totalGiveMm` takes a plain `Joint[]`, so the angular
   * field is varied on the joints directly rather than through part data, where
   * `looksLikePart`'s degree ceiling would clamp it first
   * Value: no_claim=nothing about whether ignoring rotation is RIGHT, which
   * needs CALIBRATION.md Q2's measurement, and nothing about the direction of
   * the resulting error, which `trust.ts` deliberately refuses to state
   *
   * MUTATION PROOF, run: add the angular term to `totalGiveMm`'s reduce
   * (`sum + j.axialMaxMm + j.angularMaxDeg`) and this fails with
   * `expected 7.999999999999999 to be 23.000000000000004 // Object.is
   * equality` -- the zero-factor pass, where the angular term vanishes and the
   * total does not.
   *
   * NOT EXCLUSIVE, AND THAT WAS MEASURED RATHER THAN ASSUMED. Two specs in
   * this describe go red with it: 'total give is the sum over joints' and
   * 'documents that the band is narrow for SMALL layouts', both because they
   * pin a FIGURE (6.4mm, under 10mm) for a fixed layout. That is the reason
   * this spec is still worth its line. Those two are repaired by editing the
   * expected number, which a reasonable editor landing CALIBRATION.md Q2 would
   * do without ever reading `trust.ts`; this one cannot be repaired that way,
   * because the property it asserts is the omission rule 5 discloses. Its
   * failure is the instruction to delete rule 5 in the same change.
   */
  it('the give total is insensitive to the angular budget rule 5 discloses', () => {
    const r = solveLayout(loop([...rep('E', 4), 'D', ...rep('E', 4), 'A']));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // A number being DISCARDED, not a missing one: every joint carries a real
    // non-zero angular budget, which is why the omission is worth disclosing.
    expect(r.joints.length).toBeGreaterThan(0);
    for (const j of r.joints) expect(j.angularMaxDeg).toBeGreaterThan(0);

    const baseline = totalGiveMm(r.joints);
    for (const factor of [0, 10, 1000]) {
      const varied = r.joints.map((j) => ({
        ...j,
        angularMaxDeg: j.angularMaxDeg * factor,
      }));
      expect(totalGiveMm(varied)).toBe(baseline);
    }
    // And the total is the axial sum with nothing else folded into it.
    expect(baseline).toBe(r.joints.reduce((sum, j) => sum + j.axialMaxMm, 0));
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
    expect(r.reason).toBe('NO_CYCLE');
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
 * Task K2: the catalogue's absolute dimensions, pinned to ONE place.
 *
 * Before this, every absolute figure was pinned to nothing. The relation tests
 * below are exact and still pass, but a relation holds for a whole family of
 * values: scale every straight by 10% and they all still pass. The curve radius
 * looked pinned by four tests and was not; each restated 182 as its own expected
 * value, so the number was pinned to itself. Mutation proved it: changing the
 * datum and the literals together kept the suite green.
 *
 * So the published figures live in `engine/data/sources.ts` with a citation
 * each, and this is the ONLY test that compares the catalogue against them.
 * Correcting a figure is one edit there, and this test is what tells you.
 */
describe('catalogue data matches its published source', () => {
  it('every straight length matches the published figure exactly', () => {
    for (const [id, mm] of Object.entries(STRAIGHT_LENGTHS)) {
      const part = getPart(id);
      expect(part.kind, id).toBe('straight');
      expect((part as Extract<Part, { kind: 'straight' }>).lengthMm, id).toBe(mm);
    }
  });

  it('every curve arc matches the published 45-degree division', () => {
    for (const [id, steps] of Object.entries(CURVE_ARC_STEPS)) {
      const part = getPart(id) as Extract<Part, { kind: 'curve' }>;
      expect(part.arcSteps, id).toBe(steps);
      expect(part.arcSteps * 22.5, id).toBe(45);
    }
  });

  it('curve radii match OUR recorded values, which are DISPUTED', () => {
    // Deliberately pinned to our own values rather than the source, because the
    // two disagree and the conflict is unresolved. This test exists so that
    // changing a radius is a visible, single-line decision rather than a silent
    // edit. See CONFLICTS in sources.ts.
    for (const [id, mm] of Object.entries(CURVE_RADII_OURS)) {
      expect((getPart(id) as Extract<Part, { kind: 'curve' }>).innerRadiusMm, id).toBe(mm);
    }
  });

  it('records every resolved conflict with its verbatim source', () => {
    // Was: assert conflicts EXIST. All three resolved on 2026-10-09 from the
    // primary source, so this now pins the resolutions. CONFLICTS is empty and
    // stays named, so "nothing unresolved" is explicit rather than absent.
    expect(CONFLICTS).toHaveLength(0);
    expect(RESOLVED.length).toBe(3);
    for (const r of RESOLVED) {
      expect(r.status).toBe('published');
      expect(r.conflict).toBeDefined();
      expect(r.conflict!.ours).not.toBe(r.conflict!.theirs);
      expect(r.conflict!.note).toMatch(/RESOLVED/);
      expect(r.source).toContain('woodenrailway.info');
    }
  });

  it('the centreline derivation matches the published inner and outer radii', () => {
    // The whole correction in one assertion. The source states the E curve's
    // inner radius as 182 and its outer as 222; the centreline is the midpoint,
    // and the plank width is the difference. If any of the three drifts apart
    // from the others, this fails.
    const e = getPart('E') as Extract<Part, { kind: 'curve' }>;
    const INNER = 182;
    const OUTER = 222;
    expect(e.innerRadiusMm).toBe(INNER);
    expect(e.plankWidthMm).toBe(OUTER - INNER);
    expect(centrelineRadiusMm(e)).toBe((INNER + OUTER) / 2);
    expect(centrelineRadiusMm(e)).toBe(202);
  });

  it('the profile figures come from one published sentence and agree', () => {
    // "40mm wide and 12mm high, with two 6mm wide grooves that are 3mm deep,
    //  spaced 20mm apart, measuring 26mm from center to center."
    for (const p of BRIO_PARTS) {
      expect(p.plankWidthMm, p.id).toBe(40);
      expect(p.plankThicknessMm, p.id).toBe(12);
      expect(p.gaugeWidthMm, p.id).toBe(26);
      // 20mm apart + 6mm wide = 26mm centre to centre. The sentence is
      // self-consistent, and this is what makes it trustworthy.
      expect(p.gaugeWidthMm, p.id).toBe(20 + 6);
      // And the grooves must fit inside the plank, with wood left on each side.
      expect(p.gaugeWidthMm + 6, p.id).toBeLessThan(p.plankWidthMm);
    }
  });

});

/**
 * The plank is wider than the gauge. Still true, but the story was backwards.
 *
 * Original note, 2026-10-08: "the 40mm gauge is the spacing of the rail grooves,
 * which sit inboard of the plank's edges, so the plank is strictly wider", and a
 * 44mm plank width was estimated on that basis.
 *
 * CORRECTED 2026-10-09 from the primary source. The 40mm was the PLANK WIDTH all
 * along, under the name `gaugeWidthMm`. The real gauge is 26mm. So the invented
 * 44mm was an estimate of a number already in the file, and the inequality this
 * test asserts held only by accident at 44 > 40. It now holds for the right
 * reason at 40 > 26, with both figures published.
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
 * Multi-brand catalogue: provenance is enforced, not just written down.
 *
 * The catalogue holds BRIO parts whose figures are published and third-party
 * parts whose figures are not. The engine's exactness is arithmetic, not
 * evidence: a layout of unverified parts gets an exact answer about numbers
 * nobody stands behind. These tests make the distinction structural.
 */
describe('the trust register: what the verdict is worth', () => {
  const lib = resolveLibrary([]);
  const r = makeResolver(lib);
  const layoutOf = (ids: string[]): Layout => ({
    placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
    closed: true,
  });
  const kinds = (ids: string[]) =>
    layoutTrust(layoutOf(ids), r, brandFit).map((t) => t.kind);

  it('an empty layout has nothing to distrust', () => {
    expect(layoutTrust(layoutOf([]), r, brandFit)).toHaveLength(0);
  });

  it('a pure BRIO layout discloses the estimated give and the axial-only bound', () => {
    // Everything else about it is published. This is the best case the product
    // currently has, and it still is not silent -- about TWO different things.
    //
    // This spec read `toEqual(['estimated-give'])` until rule 5 landed. The
    // old assertion was not wrong, it was incomplete: it pinned that the best
    // case still discloses something, and silently also pinned that the
    // axial-only omission was disclosed NOWHERE.
    //
    // `toEqual` RATHER THAN `arrayContaining`, AND THE ORDER IS LOAD-BEARING.
    // Do not relax this to a containment check. `VerdictLine.tsx` sorts the
    // register serious-first with a STABLE sort, so relative order among the
    // non-serious kinds decides which one survives `TRUST_INLINE_LIMIT`.
    // `axial-only-give` is emitted last here, which is why it is the first
    // disclosure truncated on any layout carrying four issues. Emission order
    // is therefore a real contract between this file and the renderer, and a
    // containment check would drop it silently.
    //
    // MUTATION PROOF, run: deleting rule 5's `issues.push` fails this with
    // `expected [ 'estimated-give' ] to deeply equal [ 'estimated-give',
    // 'axial-only-give' ]`. That is also how this spec read before the rule.
    expect(kinds(rep('E', 8))).toEqual(['estimated-give', 'axial-only-give']);
  });

  /*
   * THE X3 TRAP, which is the whole reason rule 5 is not part of rule 4.
   *
   * Rule 4 is gated on `calibrationStatus !== 'measured'`. Task X3 measures the
   * joint give, which flips every part to 'measured' and correctly silences
   * rule 4. Before rule 5 existed the axial-only caveat was silenced with it,
   * so the single act of measuring the give would have DELETED the disclosure
   * that the give is only half-modelled -- at the exact moment the figure
   * started carrying the authority of a measurement.
   *
   * MUTATION PROOF, run: wrap rule 5's `issues.push` in
   * `if (parts.some((p) => p.slop.calibrationStatus !== 'measured'))`, the
   * same guard rule 4 uses, and this fails with
   * `expected [] to include 'axial-only-give'`. The register is EMPTY under
   * the mutation, which is the finding stated as plainly as it can be: eight
   * published BRIO curves with a measured give would have had nothing at all
   * said about them.
   */
  it('a fully measured library still discloses that the bound is axial-only', () => {
    const measuredGive = lib.map((part) => ({
      ...part,
      slop: { ...part.slop, calibrationStatus: 'measured' as const },
    }));
    const k = layoutTrust(layoutOf(rep('E', 8)), makeResolver(measuredGive), brandFit)
      .map((t) => t.kind);
    // Measuring the give retires rule 4, as it should.
    expect(k).not.toContain('estimated-give');
    // It does not retire what the give omits.
    expect(k).toContain('axial-only-give');
  });

  it('the axial-only disclosure names rotation, not calibration', () => {
    /*
     * The two registers must not say the same thing in different words: rule 4
     * is about how good the number is, rule 5 about what it counts. If rule 5
     * ever starts talking about measurement it has collapsed back into rule 4
     * and the X3 trap reopens with both rules still present.
     *
     * MUTATION PROOF, run: change rule 5's copy from "rotating is not
     * modelled" to "play is not measured" and this fails with
     * `expected 'The give total counts pull-apart slac...' to match /rotat/i`.
     */
    const axial = layoutTrust(layoutOf(rep('E', 8)), r, brandFit)
      .find((t) => t.kind === 'axial-only-give')!;
    expect(axial.detail).toMatch(/rotat/i);
    expect(axial.detail).not.toMatch(/measure/i);
  });

  it('an unmeasured third-party part is disclosed as exact-about-an-estimate', () => {
    const k = kinds(['A', 'PLAYTIVE-110']);
    expect(k).toContain('unverified-size');
    const issue = layoutTrust(layoutOf(['A', 'PLAYTIVE-110']), r, brandFit)
      .find((t) => t.kind === 'unverified-size')!;
    expect(issue.detail).toContain('PLAYTIVE-110');
    expect(issue.detail).toMatch(/exact about an estimate/);
  });

  it('brands that do not physically join are disclosed, naming why', () => {
    const issue = layoutTrust(layoutOf(['A', 'IKEA-150']), r, brandFit)
      .find((t) => t.kind === 'brands-do-not-join');
    expect(issue).toBeDefined();
    expect(issue!.detail).toContain('BRIO');
    expect(issue!.detail).toContain('IKEA');
    // The reason travels with the claim, not just the claim.
    expect(issue!.detail.length).toBeGreaterThan(60);
  });

  it('a brand pair with no source is NOT disclosed as not joining', () => {
    // 'unknown' must not be reported as a failure. Absence of evidence is not
    // evidence, in either direction.
    expect(brandFit('BRIO', 'PLAYTIVE').fit).toBe('unknown');
    expect(kinds(['A', 'PLAYTIVE-110'])).not.toContain('brands-do-not-join');
  });

  it('a user measurement downgrades unverified to single-source, not to silent', () => {
    const measured = resolveLibrary([{
      submissionId: 'sub-t', at: '2026-10-09T10:00:00Z',
      part: {
        ...(BUILT_IN.find((p) => p.id === 'IKEA-150') as Extract<Part, { kind: 'straight' }>),
        lengthMm: 148,
        dimensions: { status: 'user-measured', source: 'test', corroborations: 1 },
      },
    }]);
    const k = layoutTrust(layoutOf(['A', 'IKEA-150']), makeResolver(measured), brandFit)
      .map((t) => t.kind);
    // Measuring it removes the strongest caveat and leaves the honest weaker one.
    expect(k).not.toContain('unverified-size');
    expect(k).toContain('single-source');
    // The brands still do not join; measuring a piece does not change its pegs.
    expect(k).toContain('brands-do-not-join');
  });

  it('every issue carries a sentence a user could act on', () => {
    for (const ids of [rep('E', 8), ['A', 'IKEA-150'], ['A', 'PLAYTIVE-110']]) {
      for (const t of layoutTrust(layoutOf(ids), r, brandFit)) {
        expect(t.detail.length, t.kind).toBeGreaterThan(20);
        expect(t.detail.trim().endsWith('.'), t.kind).toBe(true);
      }
    }
  });
});

describe('the library: tiers, and a seed a user can correct', () => {
  const seed = BUILT_IN.find((p) => p.id === 'IKEA-150')!;

  const submission = (lengthMm: number, status: 'user-measured' | 'community', at: string): Submission => ({
    submissionId: 'sub-test-' + at,
    at,
    part: {
      ...(seed as Extract<Part, { kind: 'straight' }>),
      lengthMm,
      dimensions: { status, source: 'test', submittedAt: at, corroborations: 1 },
    },
  });

  it('with no submissions the library is exactly the built-ins', () => {
    expect(resolveLibrary([]).map((p) => p.id).sort()).toEqual(BUILT_IN.map((p) => p.id).sort());
  });

  it('a user measurement OVERRIDES an unverified seed', () => {
    // The whole point of seeds. The shipped figure for an IKEA straight is a
    // 3D-print model title; a user with the piece in their hand beats it.
    expect(seed.dimensions.status).toBe('unverified');
    const lib = resolveLibrary([submission(148, 'user-measured', '2026-10-09T10:00:00Z')]);
    const got = lib.find((p) => p.id === 'IKEA-150') as Extract<Part, { kind: 'straight' }>;
    expect(got.lengthMm).toBe(148);
    expect(got.dimensions.status).toBe('user-measured');
    // And it does not duplicate the part.
    expect(lib.filter((p) => p.id === 'IKEA-150')).toHaveLength(1);
  });

  it('a user measurement outranks a community submission', () => {
    const lib = resolveLibrary([
      submission(151, 'community', '2026-10-09T12:00:00Z'),
      submission(148, 'user-measured', '2026-10-09T10:00:00Z'),
    ]);
    const got = lib.find((p) => p.id === 'IKEA-150') as Extract<Part, { kind: 'straight' }>;
    // Despite being OLDER, the user measurement wins: trust beats recency.
    expect(got.lengthMm).toBe(148);
  });

  it('at equal trust the newer submission wins, because that is self-correction', () => {
    const lib = resolveLibrary([
      submission(148, 'user-measured', '2026-10-09T10:00:00Z'),
      submission(149, 'user-measured', '2026-10-09T18:00:00Z'),
    ]);
    const got = lib.find((p) => p.id === 'IKEA-150') as Extract<Part, { kind: 'straight' }>;
    expect(got.lengthMm).toBe(149);
  });

  it('a submission can NOT quietly beat a published BRIO figure by being newer', () => {
    // Trust ordering, not recency. A community submission must not silently
    // replace a published reference figure for an existing BRIO part.
    const brio = getPart('A') as Extract<Part, { kind: 'straight' }>;
    const lib = resolveLibrary([{
      submissionId: 'sub-x', at: '2030-01-01T00:00:00Z',
      part: { ...brio, lengthMm: 999, dimensions: { status: 'community', source: 'test' } },
    }]);
    expect((lib.find((p) => p.id === 'A') as Extract<Part, { kind: 'straight' }>).lengthMm).toBe(144);
  });

  it('a brand-new submitted part is ADDED, not merged', () => {
    const lib = resolveLibrary([{
      submissionId: 'sub-new', at: '2026-10-09T10:00:00Z',
      part: {
        ...(seed as Extract<Part, { kind: 'straight' }>),
        id: 'IKEA-99', name: 'Lillabo tiny', lengthMm: 99,
        dimensions: { status: 'user-measured', source: 'test', corroborations: 1 },
      },
    }]);
    expect(lib).toHaveLength(BUILT_IN.length + 1);
    expect(lib.some((p) => p.id === 'IKEA-99')).toBe(true);
  });

  it('the resolver reaches submitted parts, so the engine can place them', () => {
    const sub = submission(148, 'user-measured', '2026-10-09T10:00:00Z');
    const r = makeResolver(resolveLibrary([sub]));
    expect((r('IKEA-150') as Extract<Part, { kind: 'straight' }>).lengthMm).toBe(148);
    expect(() => r('NOPE')).toThrow(/unknown part id/);
  });

  it('one submitted measurement is uncorroborated, and says so', () => {
    const lib = resolveLibrary([submission(148, 'user-measured', '2026-10-09T10:00:00Z')]);
    const got = lib.find((p) => p.id === 'IKEA-150')!;
    // Best available source AND still one person's word. Both are true, and the
    // UI needs to be able to say the second part.
    expect(isUnverified(got)).toBe(false);
    expect(isUncorroborated(got)).toBe(true);
    expect(isUncorroborated(getPart('A'))).toBe(false);  // published
  });
});

describe('the BRIO piece registry is complete and honest', () => {
  it('records all 28 pieces from the source table', () => {
    expect(BRIO_PIECE_TABLE).toHaveLength(28);
    for (const r of BRIO_PIECE_TABLE) {
      expect(r.ids.length, r.ids).toBeGreaterThan(0);
      expect(r.name.length, r.ids).toBeGreaterThan(0);
      // Every piece has at least one dimension, or it is not a track piece.
      expect(r.lengthMm !== undefined || r.innerRadiusMm !== undefined, r.ids).toBe(true);
    }
  });

  it('every piece marked in-catalogue is actually in the catalogue', () => {
    // Guards the registry against drifting out of step with the data, which is
    // how a "complete" list quietly stops being one.
    const held = new Set(BRIO_PARTS.map((p) => p.id));
    for (const r of BRIO_PIECE_TABLE) {
      if (r.blocker !== 'in-catalogue') continue;
      const ids = r.ids.split(',').map((x) => x.trim());
      // At least one id of the row is held. B/C variants are retired, and the
      // ramp tracks row is addable-but-undecided, so not every id must be held.
      const anyHeld = ids.some((id) => held.has(id)) || r.ids === 'U, V';
      expect(anyHeld, r.ids).toBe(true);
    }
  });

  it('T and X are flagged approximate, which is why exact switches are impossible', () => {
    const approx = BRIO_PIECE_TABLE.filter((r) => r.blocker === 'approximate-radius');
    expect(approx.map((r) => r.ids).sort()).toEqual(['T', 'X']);
    for (const r of approx) {
      expect(r.innerRadiusMm).toBe(88);
      expect(r.note).toMatch(/APPROXIMATE/);
    }
  });

  it('the pieces that break the 18mm rule are recorded as such', () => {
    // F/G at 150 and H1 at 116. Both exactly representable as integers, both
    // off BRIO's own increment lattice, so a layout using them cannot be
    // resolved with ordinary BRIO straights.
    for (const ids of ['F, G', 'H1']) {
      const row = BRIO_PIECE_TABLE.find((r) => r.ids === ids);
      expect(row, ids).toBeDefined();
      expect(row!.lengthMm! % 18, ids).not.toBe(0);
      expect(row!.note, ids).toMatch(/multiple of 18/);
    }
    // And every length the catalogue actually holds IS on the 18mm lattice.
    for (const p of BRIO_PARTS) {
      if (p.kind === 'straight') expect(p.lengthMm % 18, p.id).toBe(0);
    }
  });
});

describe('multi-brand catalogue provenance', () => {
  it('every part declares where its dimensions came from', () => {
    for (const p of BUILT_IN) {
      expect(p.dimensions, p.id).toBeDefined();
      expect(p.dimensions.source.length, p.id).toBeGreaterThan(10);
      expect(['published', 'community-measured', 'unverified']).toContain(p.dimensions.status);
    }
  });

  it('every BRIO part is published and every third-party part is not', () => {
    for (const p of BUILT_IN) {
      if (p.brand === 'BRIO') {
        expect(p.dimensions.status, p.id).toBe('published');
        expect(isUnverified(p), p.id).toBe(false);
      } else {
        // The honest state of the world: nobody publishes piece dimensions for
        // IKEA Lillabo or Lidl Playtive. If that ever changes, upgrade the part
        // and this assertion changes with it, deliberately.
        expect(isUnverified(p), p.id).toBe(true);
      }
    }
  });

  it('third-party ids are brand-prefixed, so nothing collides with BRIO', () => {
    const ids = BUILT_IN.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of BUILT_IN) {
      if (p.brand !== 'BRIO') expect(p.id, p.id).toContain('-');
    }
  });

  it('every third-party length is a whole millimetre, so it stays exact', () => {
    // The inch hazard: US brands round to fractions of an inch, and 25.4mm is
    // not an integer, so such a part could not live in Z[zeta16] at all. IKEA
    // and Playtive are metric, which is why they CAN be added at all. This
    // guards the boundary rather than assuming it.
    for (const p of BUILT_IN) {
      if (p.kind !== 'straight') continue;
      expect(Number.isInteger(p.lengthMm), p.id).toBe(true);
    }
  });

  it('no third-party CURVE exists, because no radius is published for one', () => {
    // Angles are known for both brands and are on the 22.5-degree lattice, but
    // no source states a radius. Adding a curve would mean inventing the one
    // number that decides the geometry.
    for (const p of BUILT_IN) {
      if (p.brand !== 'BRIO') expect(p.kind, p.id).toBe('straight');
    }
  });

  it('brand fit records that BRIO and IKEA do not join', () => {
    // The most useful fact the research produced, and the one a user actually
    // needs: these pieces do not physically connect.
    expect(brandFit('BRIO', 'IKEA').fit).toBe('does-not-join');
    expect(brandFit('IKEA', 'BRIO').fit).toBe('does-not-join');   // symmetric
    expect(brandFit('BRIO', 'BRIO').fit).toBe('joins');
    // Unsourced combinations are 'unknown', never optimistically 'joins'.
    expect(brandFit('BRIO', 'PLAYTIVE').fit).toBe('unknown');
    expect(brandFit('BRIO', 'HAPE').fit).toBe('unknown');
    for (const a of ['BRIO', 'IKEA', 'PLAYTIVE'] as const) {
      expect(brandFit(a, a).fit).toBe('joins');
      expect(brandFit(a, a).why.length).toBeGreaterThan(0);
    }
  });

  it('a layout mixing brands that do not join is detectable', () => {
    // Not yet surfaced in the verdict; that is K4's trust register. This pins
    // that the data needed to surface it is present and correct.
    const mixed = ['A', 'IKEA-150'];
    const brands = new Set(mixed.map((id) => getPart(id).brand));
    expect(brands.size).toBe(2);
    const pairs = [...brands].flatMap((a) => [...brands].map((b) => brandFit(a, b).fit));
    expect(pairs).toContain('does-not-join');
  });
});

/**
 * Which dimensions can change a verdict, and which only change the drawing.
 *
 * Discovered 2026-10-09 while correcting the curve radii from an inner radius to
 * a centreline radius, a change of +20mm on both curves. Every fixture's residual
 * came out byte-identical, which looked like the correction had done nothing.
 *
 * It is a provable property, not luck. A left arc of angle t from heading h
 * displaces by i*r*(e^ih - e^i(h+t)), and a straight does not change the
 * heading, so consecutive curves chain and the sum telescopes. For a
 * heading-closed loop the first and last headings agree, so the curves of ONE
 * radius contribute exactly zero. With two radius classes the two telescoped
 * sums are negatives of each other, T2 = -T1, so the total is i*(r1 - r2)*T1.
 *
 * Therefore: a heading-closed layout's residual depends on the straight lengths
 * and on the DIFFERENCE between curve radii. It never depends on a radius in
 * absolute terms.
 *
 * Why that matters for data errors. Getting both radii wrong by the same amount
 * is invisible to every verdict, which is exactly what had happened and why no
 * test caught it for three days. Getting ONE radius wrong changes verdicts
 * immediately. So the dangerous transcription error is an asymmetric one, and
 * the absolute values are only load-bearing for what gets DRAWN, and for
 * switches, whose geometry the source says derives from these radii.
 */
describe('verdicts depend on radius DIFFERENCES, not absolute radii', () => {
  const shifted = (dE: number, dE1: number) => (id: string): Part => {
    const p = getPart(id);
    if (p.kind !== 'curve') return p;
    return { ...p, innerRadiusMm: p.innerRadiusMm + (id === 'E' ? dE : dE1) };
  };
  const residual = (ids: string[], resolve: (id: string) => Part) =>
    computeResidual(loop(ids), resolve).exact.join(',');

  const mixed = 'A2 E E E1 E A1 E E1 E E'.split(' ');   // 6 x E and 2 x E1
  const singleRadius = rep('E', 8);

  it('shifting BOTH radii equally leaves every residual identical', () => {
    for (const ids of [mixed, singleRadius, [...rep('E', 4), 'D', ...rep('E', 4), 'D']]) {
      const base = residual(ids, getPart);
      expect(residual(ids, shifted(20, 20)), ids.join(' ')).toBe(base);
      expect(residual(ids, shifted(500, 500)), ids.join(' ')).toBe(base);
      expect(residual(ids, shifted(-7, -7)), ids.join(' ')).toBe(base);
    }
  });

  it('shifting ONE radius changes a mixed-radius layout', () => {
    // The asymmetric error is the dangerous one. This is the regression that
    // would have caught the original inner-versus-centreline mistake had only
    // one curve been transcribed with the wrong convention.
    const base = residual(mixed, getPart);
    expect(residual(mixed, shifted(20, 0))).not.toBe(base);
    expect(residual(mixed, shifted(0, -7))).not.toBe(base);
  });

  it('a single-radius layout is indifferent to its own radius', () => {
    // Which is why the 8-curve circle and the stadium could never have caught
    // the error, and why they were the wrong fixtures to trust for it.
    const base = residual(singleRadius, getPart);
    expect(residual(singleRadius, shifted(20, 0))).toBe(base);
    expect(residual(singleRadius, shifted(500, 0))).toBe(base);
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
    // An open chain fails earlier, at NO_CYCLE, so check the predicate directly.
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

/*
 * Value: protects=loadSubmissions keeps every row that parses and drops only the bad ones, round-trips through saveSubmissions, and survives a non-array or unparseable blob
 * Value: fails_when=one malformed row discards the whole set (the chain loader's rule, which this file's comment deliberately rejects), or a kept row stops reaching resolveLibrary
 * Value: why_new=analytic.test.ts covers resolveLibrary's tier arithmetic with hand-built submissions; nothing anywhere reads them back out of storage
 * Value: seam=none
 * Value: no_claim=nothing about sharing, moderation or a server (storage is local today) and nothing about quota throws on save
 *
 * Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
 */
describe('submissions survive storage per ROW, because a measurement is not a layout', () => {
  const seed = BUILT_IN.find((p) => p.id === 'IKEA-150')!;
  const sub = (lengthMm: number, submissionId: string): Submission => ({
    submissionId,
    at: '2026-01-01T00:00:00.000Z',
    part: {
      ...(seed as Extract<Part, { kind: 'straight' }>),
      lengthMm,
      dimensions: {
        status: 'user-measured',
        source: 'measured by this user',
        submittedAt: '2026-01-01T00:00:00.000Z',
        corroborations: 1,
      },
    },
  });

  function withStore<T>(seedStore: Record<string, string>, body: () => T): T {
    const store = new Map<string, string>(Object.entries(seedStore));
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

  it('one unreadable row does NOT take the other measurements with it', () => {
    /*
     * The decided difference from the layout loader, in its own words: a bad
     * chain costs a layout you can rebuild in a minute, a bad submission costs
     * calipers work you cannot. MUTATION (run): turning the per-row `continue`
     * statements in loadSubmissions into `return []` empties this list, which
     * is one typo'd row deleting every measurement the user ever took.
     */
    const blob = JSON.stringify([
      sub(151, 'sub-good-1'),
      'not even an object',
      { submissionId: 'sub-no-at', part: sub(152, 'x').part },
      { ...sub(-5, 'sub-bad-length') },
      sub(153, 'sub-good-2'),
    ]);
    const kept = withStore({ [SUBMISSIONS_STORAGE_KEY]: blob }, () => loadSubmissions());
    expect(kept.map((s) => s.submissionId)).toEqual(['sub-good-1', 'sub-good-2']);
  });

  it('a row that survives storage still reaches the resolved library', () => {
    // Loading is only half the promise: the kept measurement has to be the one
    // the engine then places. MUTATION (run): having loadSubmissions return
    // `[]` leaves the resolved length at the unverified seed's figure.
    const blob = JSON.stringify([sub(151, 'sub-good-1')]);
    const kept = withStore({ [SUBMISSIONS_STORAGE_KEY]: blob }, () => loadSubmissions());
    const resolved = resolveLibrary(kept).find((p) => p.id === seed.id)!;
    expect((resolved as Extract<Part, { kind: 'straight' }>).lengthMm).toBe(151);
    expect(isUnverified(resolved)).toBe(false);
  });

  it('saveSubmissions writes what loadSubmissions reads, under one owned key', () => {
    // The two halves agreeing is the whole reason SUBMISSIONS_STORAGE_KEY is
    // exported rather than retyped. MUTATION (run): making saveSubmissions
    // write under `STORAGE_KEY + '.v2'` fails this, because the read no longer
    // finds the write. RENAMING the constant does NOT fail it and the comment
    // used to claim it would -- both halves import the one constant, which is
    // the point of it, so a rename moves them together.
    const round = withStore({}, () => {
      saveSubmissions([sub(151, 'sub-a'), sub(152, 'sub-b')]);
      return loadSubmissions();
    });
    expect(round.map((s) => s.submissionId)).toEqual(['sub-a', 'sub-b']);
  });

  it('a blob that is not a list, or not JSON at all, is empty rather than a crash', () => {
    // The error boundary reads this on the way up from a crash, so throwing
    // here would replace the crash screen with a second crash.
    expect(withStore({ [SUBMISSIONS_STORAGE_KEY]: '{"not":"a list"}' }, () => loadSubmissions())).toEqual([]);
    expect(withStore({ [SUBMISSIONS_STORAGE_KEY]: '{not json' }, () => loadSubmissions())).toEqual([]);
    expect(withStore({}, () => loadSubmissions())).toEqual([]);
  });
});
