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
 * MUTATION PROOF, thirteen runs on 2026-10-20, failures as OBSERVED. Catalogue
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
 * THREE REAL DEFECTS CAME OUT OF THIS, which is the only reason to run them.
 * Two were found by the mutations listed above; the third was found separately
 * and is not one of the thirteen runs.
 * `grooveDepthMm` 3 -> 4 originally failed NOTHING: its only guard was
 * `grooveDepthMm < plankThicknessMm`, and 4 is still under 12, so a wrong depth
 * passed unnoticed until the verbatim-sentence spec was added. The independence
 * mutation failed nothing until its guard was added. And the first version of
 * `trustBoundary.test.ts`'s radius check compared `getPart('E')` with the object
 * `resolveLibrary` returns, which is the SAME object when a forgery is rejected,
 * so that assertion could not fail either.
 *
 * Two of the thirteen runs above need reading rather than counting:
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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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
   * That change would look like an obvious tidy-up, and it would be invisible:
   * the suite would stay green and the mutation records in the header above
   * would still appear to hold while proving nothing. Until this spec existed, a
   * prose docblock was the only thing standing in the way.
   *
   * Read as TEXT, like the stylesheet checks in
   * `app/src/trackCanvasPolarity.test.ts`, because the thing under test is the
   * absence of an edge in the module graph, which a runtime value cannot show:
   * by the time a spec runs, the catalogue's parts already hold whichever number
   * they were built from.
   *
   * WHAT IT DOES NOT CATCH, listed in full because the first version of this
   * spec was titled "directly or by any path" and three reviewers pointed out
   * that it checked neither, and the second version named only the first gap
   * below while implying it was the whole list.
   *
   *   1. A TRANSITIVE coupling. It reads `brio.ts`'s own import lines only.
   *      `brio.ts` imports `./thirdParty.js` (its only non-type import), so if
   *      that module, or anything it imports, ever re-exported from here, this
   *      spec would stay green. Checked 2026-10-20: `thirdParty.ts` imports
   *      only `../src/parts/schema.js`, so no such path exists today.
   *   2. `require('./sources.js')` and `import x = require('./sources.js')`.
   *      Neither matches the scan, which looks for `from` or `import` followed
   *      by a quoted string. This codebase is ESM throughout, so neither form
   *      appears, but the scan would not stop one.
   *   3. A directory specifier such as `./sources/index.js`. The exclusion is
   *      anchored at the end of the path, so a folder named `sources` would
   *      pass. No such folder exists.
   *   4. A specifier assembled at runtime, such as
   *      `import(base + '/sources.js')`. Nothing short of a graph walk sees
   *      that one.
   *
   * COMMENTS ARE STRIPPED FIRST, and that is not cosmetic. The second version
   * of this spec scanned raw text, and an independent reviewer defeated it with
   * one line of valid TypeScript:
   *
   *     import { CURVE_RADII_OURS } from /* published radii *\/ './sources.js';
   *
   * The pattern looks for `from` or `import` followed by a quoted string, and a
   * block comment between them means the specifier is never captured. Verified
   * end to end before this repair: with that import in place, the catalogue
   * reading E1's radius from here, and the source's E1 changed from 90 to 91,
   * the ENTIRE SUITE PASSED while the shipped centreline for E1 moved from 110
   * to 111.
   *
   * PARSED, NOT PATTERN-MATCHED, and that took four tries to accept. Versions
   * one to four of this spec were regexes, and every one was defeated:
   *
   *   1. single-quoted `from` only      double quotes, bare and dynamic
   *                                     imports, `.ts` suffixes all walked past
   *   2. widened specifier pattern      a block comment between `from` and the
   *                                     quote hid the import completely
   *   3. plus comment stripping         `/*` inside a line comment or a string
   *                                     opened a comment that ran to the next
   *                                     `*\/` and DELETED the real import, and
   *                                     `//` inside a string ate the next line
   *   4. plus a path-segment anchor     backtick dynamic imports, `?raw`
   *                                     queries, `.mjs`, and `./Sources.js`
   *                                     (the same file on this macOS dev box)
   *
   * Each patch closed the demonstrated hole and opened another, which is this
   * repository's logged pattern rather than bad luck. The question "does this
   * module import that one" is a question about syntax, and the exact answer
   * comes from a parser. TypeScript is already a dependency here, since `tsc`
   * runs for typecheck, so using its parser adds nothing to install and ends
   * the cycle instead of extending it.
   *
   * WHAT IT STILL CANNOT SEE, and this list is now short because the parser
   * handles the rest: a specifier assembled at runtime, such as
   * `import(base + '/sources.js')`, has no literal to read; and a TRANSITIVE
   * coupling through another module is out of scope, since this reads one
   * file's own import list. `brio.ts`'s only value import is `./thirdParty.js`,
   * checked 2026-10-20 to import nothing but `../src/parts/schema.js`.
   *
   * PROVED BY ATTACK, 19 probes RUN against this spec on 2026-10-20, each one
   * injected into `brio.ts` and then reverted. All sixteen couplings are
   * caught, including every form that beat a regex version:
   *
   *   plain static import, a comment between `from` and the quote, `/*` opened
   *   inside a line comment with the import between it and a later `*\/`,
   *   `/*` and `*\/` inside string literals, `//` inside a string on the
   *   import's own line, double quotes, a bare side-effect import, a
   *   re-export, `export *`, `.mjs`, a `?raw` query, `./Sources.js` (the same
   *   file on a case-insensitive filesystem), a backtick dynamic import,
   *   `require`, the directory form `./sources/index.js`, and the
   *   parent-relative spelling `../data/sources.js`.
   *
   * And the false-positive direction, which three probes confirm stays quiet:
   * `./resources.js`, `./datasources.js` and the real sibling
   * `../src/parts/schema.js` are not flagged.
   */
  it('brio.ts has no import of this file, in any syntactic form', () => {
    const cataloguePath = fileURLToPath(
      new URL('../data/brio.ts', import.meta.url),
    );
    const source = ts.createSourceFile(
      cataloguePath,
      readFileSync(cataloguePath, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
    );

    /*
     * Collect every module specifier the PARSER recognises: static imports
     * (including `import type` and bare side-effect imports), re-exports, the
     * `import x = require(...)` form, and dynamic `import(...)` with a literal
     * argument, which covers backticks because a no-substitution template is a
     * string literal to the parser.
     */
    const specifiers: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        specifiers.push(node.moduleSpecifier.text);
      }
      if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        ts.isStringLiteralLike(node.moduleReference.expression)
      ) {
        specifiers.push(node.moduleReference.expression.text);
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require')) &&
        node.arguments[0] !== undefined &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        specifiers.push((node.arguments[0] as ts.StringLiteralLike).text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    // If this ever reads zero, the parse silently failed and the spec proves
    // nothing. brio.ts has imports; a count of zero is the broken-scan signal.
    expect(specifiers.length, 'parsed no imports at all, so this spec is blind')
      .toBeGreaterThan(0);

    /*
     * RESOLVED against the filesystem, not matched as a name. Comparing the
     * final path segment looked sufficient and was not: `./sources/index.js`
     * yields `index`, and turning `sources.ts` into `sources/index.ts` is an
     * ordinary refactor that would have walked straight past such a check.
     *
     * So each specifier is resolved relative to `brio.ts`, lowercased (because
     * `./Sources.js` is the same file on a case-insensitive filesystem),
     * stripped of any query or fragment and of any JS/TS extension, and then
     * compared with THIS module's own resolved path. A hit is the exact file or
     * anything inside a directory that replaced it. `./resources.js` and
     * `./datasources.js` resolve elsewhere and cannot collide.
     */
    const target = resolve(dirname(cataloguePath), 'sources').toLowerCase();
    for (const raw of specifiers) {
      const bare = raw.split('?')[0]!.split('#')[0]!;
      const resolved = resolve(dirname(cataloguePath), bare)
        .toLowerCase()
        .replace(/\.(m|c)?[jt]sx?$/, '');
      const isThisModule =
        resolved === target || resolved.startsWith(`${target}/`);
      expect(
        isThisModule,
        `brio.ts must transcribe the figures, never import them (${raw})`,
      ).toBe(false);
    }
  });
});

describe('the published sentences are self-consistent', () => {
  /*
   * Most of these check the SOURCE against itself or against its own audit
   * trail, which is the one case where a figure may legitimately be compared
   * with other figures in the same file: the profile sentence states the gauge
   * twice, once directly and once as the sum of its parts, so a one-sided
   * transcription error has to be made twice to pass. The centreline spec is
   * the exception and reaches into the CATALOGUE as well. No ordinals here on
   * purpose: the first version of this comment said "the third, the centreline"
   * and a later spec inserted above it made that wrong.
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
     * that side to compare against. The quoted sentence is the second witness:
     * it was transcribed separately from these numeric fields, so a one-sided
     * edit of either breaks the match.
     *
     * EXACTLY WHAT THIS CATCHES, because the first version of this comment
     * claimed more. It catches a typo or a one-sided edit: change the field or
     * change the quote and they disagree. It does NOT catch a misreading of the
     * source written into BOTH places, and it is not evidence of transcription
     * fidelity against the page itself, which nothing in this repository
     * checks. `grooveDepthMm` and `grooveSpacingMm` have no catalogue
     * counterpart, so this spec is the only check they have anywhere.
     *
     * Matched on a digit boundary rather than as a bare substring. Measured,
     * because the first version of this comment gave an example the code
     * cannot exhibit: it claimed `20mm apart` would be satisfied by
     * `120mm apart`, which is false, since the needle is `spaced 20mm apart`
     * and the space before the digits already separates them. The boundary is
     * load-bearing for exactly one of the three needles, the gauge: a bare
     * `26mm from center to center` IS satisfied by `126mm from center to
     * center`, and with the boundary it is not. The other two needles begin
     * with a letter-and-space prefix, which gives the same protection for
     * free; the helper is applied to all three for uniformity, not because it
     * does work on each.
     *
     * A LOOKBEHIND, after two weaker attempts. `(^|[^0-9])` let a decimal
     * point through, so rewriting the quote to `measuring 1.26mm from center to
     * center` passed. Adding the dot to the class still let `1,26mm` (a
     * European decimal), `-26mm`, `$26mm` and `a26mm` through. The lookbehind
     * rejects a preceding word character, dot, comma, dollar or hyphen, so the
     * needle has to start a real token.
     *
     * Found by a stable predicate rather than `RESOLVED[2]`, so reordering the
     * audit trail fails this spec by name instead of throwing on an index.
     */
    const profile = RESOLVED.find((r) =>
      r.conflict?.note.includes('from center to center'),
    );
    expect(profile, 'no resolved conflict quotes the profile sentence')
      .toBeTruthy();
    const note = profile!.conflict!.note;
    const atDigitBoundary = (text: string): RegExp =>
      new RegExp(`(?<![\\w.,$-])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    expect(note).toMatch(
      atDigitBoundary(
        `two ${TRACK_PROFILE.grooveWidthMm}mm wide grooves that are ` +
          `${TRACK_PROFILE.grooveDepthMm}mm deep`,
      ),
    );
    expect(note).toMatch(
      atDigitBoundary(`spaced ${TRACK_PROFILE.grooveSpacingMm}mm apart`),
    );
    expect(note).toMatch(
      atDigitBoundary(`${TRACK_PROFILE.gaugeWidthMm}mm from center to center`),
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
    expect(inner, "E's source radius is missing or disagrees with the catalogue")
      .toBe(e.innerRadiusMm);
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
      /*
       * Pinned to the exact value, not merely away from 'measured'.
       * `CalibrationStatus` has THREE members ('measured' | 'published' |
       * 'estimated'), so `not.toBe('measured')` let a BRIO part's give drift to
       * 'published' with nothing failing. Nothing in the verdict path treats
       * 'published' give as measured, so that was not an outright upgrade, but
       * the spec read as a protection it only half provided.
       */
      expect(p.slop.calibrationStatus, p.id).toBe('estimated');
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
