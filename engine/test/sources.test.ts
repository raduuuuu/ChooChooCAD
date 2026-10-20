/**
 * Task K2: the ONLY place the catalogue is compared against its published source.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS THE ONLY ONE
 *
 * WHAT WAS ACTUALLY HERE BEFORE, checked rather than assumed. The plan's
 * description of this task predates `sources.ts` and says every absolute
 * dimension was pinned to nothing. That was no longer true. `STRAIGHT_LENGTHS`,
 * `CURVE_RADII_OURS` and `CURVE_ARC_STEPS` already existed and
 * `analytic.test.ts` already compared the catalogue against them, so straight
 * lengths, curve radii and arc steps were genuinely pinned. Three narrower
 * things were wrong:
 *
 *  1. The three shared profile figures were NOT pinned to a citation. 40, 12
 *     and 26 lived in `brio.ts` as private consts and in `analytic.test.ts` as
 *     literal expectations, while `sources.ts` held them only as PROSE inside
 *     `RESOLVED[2].conflict.note`. Nothing compared the catalogue to a source,
 *     and correcting a published figure had no single place to be corrected.
 *  2. The centreline check declared `INNER = 182` and `OUTER = 222` as its own
 *     local literals, so it pinned those two numbers to themselves.
 *  3. The comparison was scattered. `trustBoundary.test.ts` restated 182 in a
 *     six-case provenance loop and `switches.test.ts` restated 108 in a
 *     fixture, so a dimension change in `brio.ts` failed several files and a
 *     working pin was indistinguishable from collateral damage.
 *
 * The relation tests in `analytic.test.ts` stay where they are and are not a
 * substitute for any of this: a relation holds for a whole family of values, so
 * scale every straight by 10% and A1 = 2*A2, D = 2*A1 and 2*D = 3*A all still
 * hold.
 *
 * The repair has two halves and needs both:
 *
 *  1. The published figures live ONCE, in `engine/data/sources.ts`, with a
 *     citation each.
 *  2. `brio.ts` keeps its OWN private copies and does NOT import them.
 *
 * Half 2 looks like duplication and is the thing that makes the pin bite. If
 * the catalogue imported the source constants, both sides of every comparison
 * below would be the same object and no assertion here could ever fail. Two
 * independent transcriptions, compared once, is the only arrangement that can
 * catch a bad one.
 *
 * The comparison lives here and NOWHERE else, so that a failure names the
 * defect. `analytic.test.ts` previously carried these assertions with 40, 12
 * and 26 written out as literals, which meant mutating a dimension in `brio.ts`
 * failed that file whether or not any pin worked, and confounded this task's
 * own proof. Those assertions moved here; `trustBoundary.test.ts` lost its
 * literal 182 the same way.
 *
 * MUTATION PROOF, thirteen RUN 2026-10-20, failures as OBSERVED. Catalogue
 * side, editing `engine/data/brio.ts`:
 *
 *   E `innerRadiusMm` 182 -> 183     2 specs, both here
 *   `PLANK_WIDTH_MM` 40 -> 41        2 specs, both here
 *   `PLANK_THICKNESS_MM` 12 -> 13    1 spec, here
 *   `GAUGE_WIDTH_MM` 26 -> 27        1 spec, here
 *   `GROOVE_WIDTH_MM` 6 -> 7         1 spec, here
 *   A1 `lengthMm` 108 -> 109         3 specs: 1 here, 2 in `analytic.test.ts`
 *   E `arcSteps` 2 -> 3              45 specs across 12 files, 1 of them here
 *
 * Source side, editing `engine/data/sources.ts`, which is the direction that
 * matters for correcting a published figure:
 *
 *   `TRACK_PROFILE.plankWidthMm` 40 -> 41       3 specs, all here
 *   `STRAIGHT_LENGTHS.A1` 108 -> 109            1 spec, here
 *   `CURVE_OUTER_RADII.E` 222 -> 223            1 spec, here
 *   `TRACK_PROFILE.grooveSpacingMm` 20 -> 21    2 specs, both here
 *   `TRACK_PROFILE.grooveDepthMm` 3 -> 4        1 spec, here
 *
 * And the structural one, editing `engine/data/brio.ts` to `import
 * { TRACK_PROFILE } from './sources.js'` and read `plankWidthMm` from it, which
 * is how a future tidy-up would most plausibly arrive:
 *
 *   catalogue imports the source    1 spec, the independence guard, and
 *                                   NOTHING ELSE
 *
 * That last line is the one worth reading twice. Under it the profile pin
 * STAYED GREEN, because both sides of the comparison had become the same
 * constant, and so would every mutation proof above it. One spec stood between
 * a plausible cleanup and a file full of assertions that cannot fail.
 *
 * THREE OF THESE FOUND REAL DEFECTS, which is the only reason to run them.
 * `grooveDepthMm` 3 -> 4 originally failed NOTHING: its only guard was
 * `grooveDepthMm < plankThicknessMm`, and 4 is still under 12, so a wrong depth
 * passed unnoticed until the verbatim-sentence spec was added. The independence
 * mutation failed nothing until its guard was added. And the first version of
 * `trustBoundary.test.ts`'s radius check compared `getPart('E')` with the object
 * `resolveLibrary` returns, which is the SAME object when a forgery is rejected,
 * so that assertion could not fail either.
 *
 * Two of those need reading rather than counting:
 *
 * The A1 length also fails "published straight-length relations hold exactly"
 * and "the pieces that break the 18mm rule are recorded as such", both in
 * `analytic.test.ts`. Both were checked: neither restates 108. The first derives
 * A1 = 2*A2 from the part data, the second asserts every catalogue straight sits
 * on the 18mm lattice, and 109 violates both as a matter of fact. They are
 * independent published claims, not copies of this one.
 *
 * The arcSteps mutation fails widely because an arc angle is not merely a
 * transcribed number: a 67.5-degree curve breaks every closure in the suite.
 * That coverage is real and is not collateral noise.
 *
 * WHAT THIS REPLACED, also measured. Before this task the radius mutation
 * failed 8 specs across 2 files: 2 in `analytic.test.ts` and 6 in
 * `trustBoundary.test.ts`, where a loop asserting that a forged submission
 * cannot override part E restated 182 as its expected radius. Six failures in a
 * provenance test told you nothing about the radius being pinned, and the
 * centreline check that failed alongside them declared `INNER` and `OUTER` as
 * its own local literals. The profile figures were worse off: 40, 12 and 26
 * existed in `brio.ts` as private consts and in `analytic.test.ts` as literal
 * expectations, and in `sources.ts` only as PROSE inside a conflict note, so
 * there was no single place to correct one and nothing compared the catalogue
 * to a citation at all.
 *
 * NOTHING HERE IS A MEASUREMENT. Every figure is a published third-party
 * number, status `published` at best, and the provenance question flagged over
 * `brio.ts` applies to all of it. This file proves transcription fidelity, not
 * that real track has these dimensions.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIO_PARTS, getPart } from '../data/brio.js';
import {
  CONFLICTS,
  CURVE_ARC_CITATION,
  CURVE_ARC_STEPS,
  CURVE_OUTER_RADII,
  CURVE_RADII_OURS,
  PROFILE_CITATION,
  RESOLVED,
  STRAIGHT_CITATION,
  STRAIGHT_LENGTHS,
  TRACK_PROFILE,
} from '../data/sources.js';
import { centrelineRadiusMm, type Part } from '../src/parts/schema.js';

type Straight = Extract<Part, { kind: 'straight' }>;
type Curve = Extract<Part, { kind: 'curve' }>;

const straights = (): readonly Straight[] =>
  BRIO_PARTS.filter((p): p is Straight => p.kind === 'straight');
const curves = (): readonly Curve[] =>
  BRIO_PARTS.filter((p): p is Curve => p.kind === 'curve');

describe('every catalogue dimension is pinned to its cited source', () => {
  it("every straight's length matches the published figure exactly", () => {
    for (const part of straights()) {
      expect(STRAIGHT_LENGTHS[part.id], `${part.id} has no source entry`)
        .toBe(part.lengthMm);
    }
  });

  it("every curve's inner radius matches the published figure", () => {
    for (const part of curves()) {
      expect(CURVE_RADII_OURS[part.id], `${part.id} has no source entry`)
        .toBe(part.innerRadiusMm);
    }
  });

  it("every curve's arc matches the published 45-degree division", () => {
    for (const part of curves()) {
      expect(CURVE_ARC_STEPS[part.id], `${part.id} has no source entry`)
        .toBe(part.arcSteps);
      // The citation's convention is the claim being checked, not decoration:
      // "curved track divides the circle into eight 45-degree arcs". A step is
      // 22.5 degrees, so two steps is one eighth of a turn.
      expect(part.arcSteps * 22.5, part.id).toBe(360 / 8);
    }
  });

  it('every part carries the published profile figures from the source', () => {
    for (const p of BRIO_PARTS) {
      expect(p.plankWidthMm, p.id).toBe(TRACK_PROFILE.plankWidthMm);
      expect(p.plankThicknessMm, p.id).toBe(TRACK_PROFILE.plankThicknessMm);
      expect(p.gaugeWidthMm, p.id).toBe(TRACK_PROFILE.gaugeWidthMm);
      expect(p.grooveWidthMm, p.id).toBe(TRACK_PROFILE.grooveWidthMm);
    }
  });

  /*
   * COVERAGE, not a formality. Every assertion above iterates the CATALOGUE and
   * looks each part up in the source, so a part added to `brio.ts` with no
   * source entry fails by looking up `undefined`. This closes the other
   * direction: a figure deleted from `sources.ts` while the catalogue keeps its
   * own private copy would otherwise leave nothing to notice.
   */
  it('the source lists exactly the parts the catalogue holds, both ways', () => {
    const catalogueStraights = straights().map((p) => p.id).sort();
    const catalogueCurves = curves().map((p) => p.id).sort();
    expect(Object.keys(STRAIGHT_LENGTHS).sort()).toEqual(catalogueStraights);
    expect(Object.keys(CURVE_RADII_OURS).sort()).toEqual(catalogueCurves);
    expect(Object.keys(CURVE_ARC_STEPS).sort()).toEqual(catalogueCurves);
  });
});

describe('the catalogue and the source stay independent', () => {
  /*
   * THE ONE ASSERTION THAT PROTECTS EVERY OTHER ASSERTION IN THIS FILE.
   *
   * Every comparison here works by reading a figure from `brio.ts` and the same
   * figure from `sources.ts` and checking they agree. That only means something
   * while the two are transcribed independently. The moment `brio.ts` imports
   * `TRACK_PROFILE` or `STRAIGHT_LENGTHS` from here, both sides of every
   * comparison resolve to one constant, every spec in this file passes by
   * identity, and so does every mutation proof run against `brio.ts`, because
   * the catalogue would simply read the edited value back.
   *
   * That change would look like an obvious tidy-up. It would be invisible: the
   * suite would stay green, the coverage report would stay at 100%, and the
   * mutation records in the header above would still appear to hold while
   * proving nothing. Until this spec existed, a prose docblock was the only
   * thing standing in the way.
   *
   * Read as TEXT, like the stylesheet checks in
   * `app/src/trackCanvasPolarity.test.ts`, because the thing under test is the
   * absence of an edge in the module graph, which a runtime value cannot show.
   * It is a blunt check: it proves no import statement names this module, not
   * that no figure was copied by hand, which is exactly what we want copied.
   */
  it('brio.ts does not import this file, directly or by any path', () => {
    const catalogue = readFileSync(
      new URL('../data/brio.ts', import.meta.url),
      'utf8',
    );
    const importedModules = [...catalogue.matchAll(/from\s+'([^']+)'/g)]
      .map((m) => m[1]!);
    expect(importedModules.length).toBeGreaterThan(0);
    for (const spec of importedModules) {
      expect(spec, 'brio.ts must transcribe the figures, never import them')
        .not.toMatch(/sources(\.js)?$/);
    }
  });
});

describe('the published sentences are self-consistent', () => {
  /*
   * The first two specs check the SOURCE against itself, which is the one case
   * where a figure may legitimately be compared with other figures in the same
   * file: the profile sentence states the gauge twice, once directly and once
   * as the sum of its parts, so a bad transcription has to be bad twice over to
   * pass. The third, the centreline, reaches into the CATALOGUE as well, which
   * is why this comment no longer claims otherwise.
   */
  it('the gauge equals the groove spacing plus one groove width', () => {
    expect(TRACK_PROFILE.gaugeWidthMm).toBe(
      TRACK_PROFILE.grooveSpacingMm + TRACK_PROFILE.grooveWidthMm,
    );
  });

  it('the grooves fit inside the plank with wood left on each side', () => {
    expect(TRACK_PROFILE.gaugeWidthMm + TRACK_PROFILE.grooveWidthMm)
      .toBeLessThan(TRACK_PROFILE.plankWidthMm);
    expect(TRACK_PROFILE.grooveDepthMm)
      .toBeLessThan(TRACK_PROFILE.plankThicknessMm);
  });

  it('the groove figures match the verbatim sentence word for word', () => {
    /*
     * ADDED after a mutation found nothing. `grooveDepthMm` 3 -> 4 left the
     * whole suite green: its only guard was the inequality above, and 4 is
     * still less than 12, so a wrong depth passed unnoticed. An inequality a
     * wrong value satisfies is not a pin.
     *
     * The catalogue holds no groove depth or spacing, so there is nothing on
     * that side to compare against. The citation itself is the second witness:
     * `RESOLVED[2].conflict.note` quotes the source sentence verbatim, and it
     * was transcribed separately from these numeric fields, so matching the
     * numbers against the prose is not circular. Mutate any of the three and
     * the sentence stops containing it.
     */
    const note = RESOLVED[2]!.conflict!.note;
    expect(note).toContain(
      `two ${TRACK_PROFILE.grooveWidthMm}mm wide grooves that are ` +
        `${TRACK_PROFILE.grooveDepthMm}mm deep`,
    );
    expect(note).toContain(`spaced ${TRACK_PROFILE.grooveSpacingMm}mm apart`);
    expect(note).toContain(
      `${TRACK_PROFILE.gaugeWidthMm}mm from center to center`,
    );
  });

  it('the centreline is derived from the published inner and outer radii', () => {
    // The whole 2026-10-09 correction in one assertion, now with both radii
    // read from the source instead of declared locally. The source states E's
    // inner radius as 182 and its outer as 222; their difference is the plank
    // width and their midpoint is the centreline. If any of the three drifts
    // apart from the others, this fails.
    const e = getPart('E') as Curve;
    // Named presence checks rather than `!`. A missing entry used to throw a
    // TypeError on `undefined`, which reports a crash instead of the defect.
    const inner = CURVE_RADII_OURS['E'];
    const outer = CURVE_OUTER_RADII['E'];
    expect(inner, 'E has no inner radius in the source').toBe(e.innerRadiusMm);
    expect(typeof outer, 'E has no outer radius in the source').toBe('number');
    expect(outer! - inner!).toBe(TRACK_PROFILE.plankWidthMm);
    expect(centrelineRadiusMm(e)).toBe((inner! + outer!) / 2);
  });

  it('only E publishes an outer radius, and E1 is never inferred', () => {
    /*
     * The source states E's outer radius and never states E1's. The page also
     * warns that the printed LARGE curve diameter "does not appear to
     * correspond to any actual measurements on the track", so a missing figure
     * here must stay missing. Deriving E1's outer radius as inner + plankWidth
     * would look harmless and would be a number nobody published, which is the
     * one thing this file exists to prevent. The two-way key test above covers
     * the other three maps; this covers the one it cannot, because its key set
     * is deliberately NOT the catalogue's curve set.
     */
    expect(Object.keys(CURVE_OUTER_RADII)).toEqual(['E']);
    for (const id of Object.keys(CURVE_OUTER_RADII)) {
      expect(curves().map((c) => c.id), `${id} is not a catalogue curve`)
        .toContain(id);
    }
  });
});

describe('every figure declares where it came from', () => {
  it('every BRIO part is published, and says which pages', () => {
    for (const p of BRIO_PARTS) {
      // The pin that matters for the verdict: `published` is the best status
      // anything here can claim, and the trust register reads this field to
      // decide whether a layout's answer may be called exact.
      expect(p.dimensions.status, p.id).toBe('published');
      expect(p.dimensions.source, p.id).toContain('woodenrailway.info');
    }
  });

  it('no catalogue figure claims to have been measured', () => {
    // Guard against the one upgrade nobody is entitled to make. Nothing in
    // this file has had calipers on it, and `user-measured` outranks
    // `published` in DIMENSION_TRUST, so a stray upgrade here would silently
    // promote a third-party transcription above a real measurement.
    for (const p of BRIO_PARTS) {
      expect(p.dimensions.status, p.id).not.toBe('user-measured');
      expect(p.slop.calibrationStatus, p.id).not.toBe('measured');
    }
  });

  it('each citation names its page and its convention', () => {
    for (const c of [STRAIGHT_CITATION, CURVE_ARC_CITATION, PROFILE_CITATION]) {
      expect(c.status).toBe('published');
      expect(c.source).toContain('woodenrailway.info');
      // A figure without a stated convention is not re-checkable: 182 means
      // nothing until you know it is an inner radius and not a centreline,
      // which is exactly the error that shipped on 2026-10-08.
      expect(c.convention!.length).toBeGreaterThan(0);
    }
  });
});

describe('the resolved conflicts keep their verbatim evidence', () => {
  /*
   * Moved here from `analytic.test.ts` with one change: it asserted
   * `expect(r.conflict).toBeDefined()`, which this project's conventions
   * forbid, and which passed for a conflict whose two values were identical.
   * Each resolution is now checked for the thing that makes it a resolution.
   */
  it('nothing is unresolved, and that is stated rather than absent', () => {
    expect(CONFLICTS).toEqual([]);
  });

  it('each resolution records both values and quotes its source', () => {
    expect(RESOLVED.length).toBe(3);
    for (const r of RESOLVED) {
      expect(r.status).toBe('published');
      expect(r.source).toContain('woodenrailway.info');
      expect(r.conflict!.ours).not.toBe(r.conflict!.theirs);
      expect(r.conflict!.note).toMatch(/RESOLVED/);
      // The quoted sentence is the evidence. A resolution that paraphrases is
      // a decision someone made, not a figure anyone can re-check.
      expect(r.conflict!.note).toMatch(/Verbatim:/);
    }
  });

  it('the resolution that fixed the profile still matches the exported figures', () => {
    // RESOLVED[2] is where the three shared figures lived as PROSE before this
    // task exported them. The prose stays as the audit trail, so it has to keep
    // agreeing with the values now in TRACK_PROFILE.
    const profile = RESOLVED[2]!;
    expect(profile.conflict!.theirs).toBe(TRACK_PROFILE.gaugeWidthMm);
    expect(profile.conflict!.ours).toBe(TRACK_PROFILE.plankWidthMm);
    expect(profile.conflict!.note).toContain(
      `${TRACK_PROFILE.plankWidthMm}mm wide and ${TRACK_PROFILE.plankThicknessMm}mm high`,
    );
  });
});
