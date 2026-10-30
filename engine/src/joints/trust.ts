/**
 * What a layout's verdict cannot be trusted about, and why.
 *
 * Separate from the verdict itself on purpose. `evaluateLayout` answers "does
 * this close, and can the joints absorb the gap", which is arithmetic over the
 * numbers it was given. This answers "how much are those numbers worth", which
 * the arithmetic cannot see.
 *
 * It exists because the library now holds parts from sources of very different
 * quality. An exact closure computed from a 3D-print model title is exact about
 * nothing. Showing EXACT on such a layout without saying so would be the
 * grey-is-not-green rule broken from the other direction: claiming more than
 * was checked.
 *
 * One shared implementation, like the verdict, so the canvas, the verdict line
 * and anything later cannot drift on what counts as trustworthy.
 */

import { isMultiRoad, isUncorroborated, isUnverified, type Brand, type Layout, type Part } from '../parts/schema.js';

export interface TrustIssue {
  readonly kind:
    | 'unverified-size'
    | 'single-source'
    | 'brands-do-not-join'
    | 'estimated-give'
    | 'axial-only-give'
    | 'modelled-switch';
  /** One sentence, user-facing, naming the specific cause. */
  readonly detail: string;
}

export interface BrandFitLookup {
  (a: Brand, b: Brand): { fit: string; why: string };
}

/**
 * Collect every reason this layout's verdict is worth less than it looks.
 *
 * `brandFit` is injected rather than imported so the engine keeps no dependency
 * on the third-party data file, which is app-level content.
 */
export function layoutTrust(
  layout: Layout,
  resolve: (id: string) => Part,
  brandFit: BrandFitLookup,
): readonly TrustIssue[] {
  const issues: TrustIssue[] = [];
  if (layout.placements.length === 0) return issues;

  const parts = layout.placements.map((p) => resolve(p.partId));

  // 1. Sizes nobody measured. The strongest caveat: the geometry is a guess.
  const unverified = [...new Set(parts.filter(isUnverified).map((p) => p.id))];
  if (unverified.length > 0) {
    issues.push({
      kind: 'unverified-size',
      detail:
        `${unverified.join(', ')} ${unverified.length === 1 ? 'has a size' : 'have sizes'} ` +
        'nobody has measured, so this answer is exact about an estimate.',
    });
  }

  // 2. Sizes resting on one person's word. Weaker than 1, still worth saying.
  /*
   * A MULTI-ROAD PIECE IS MODELLED, WHATEVER ITS SOURCE SAYS (task T3b; eng
   * review D7 widened it from switches to every multi-road piece).
   *
   * Unconditional on `DimensionStatus` on purpose. A switch or a crossing is
   * written as straight and arc roads between listed ends; whether a real
   * piece is that shape is a property of the MODEL, and no figure in
   * `dimensions` can vouch for it. A row promoted to 'published' tomorrow
   * would still be drawn this way, so hanging this off the unverified branch
   * would make it vanish exactly when the numbers got better and the model
   * did not.
   *
   * Keyed on the kind (`isMultiRoad`), not on a list of ids, so a piece added
   * later carries it without anyone remembering to.
   */
  const modelled = parts.filter(isMultiRoad);
  if (modelled.length > 0) {
    issues.push({
      kind: 'modelled-switch',
      detail:
        modelled.length === 1
          ? "This piece's geometry is modelled, not measured."
          : "These pieces' geometry is modelled, not measured.",
    });
  }

  const single = [...new Set(
    parts.filter((p) => !isUnverified(p) && isUncorroborated(p)).map((p) => p.id),
  )];
  if (single.length > 0) {
    issues.push({
      kind: 'single-source',
      detail: `${single.join(', ')} rests on one measurement, not a published figure.`,
    });
  }

  // 3. Brands that do not physically connect. The verdict can be geometrically
  // perfect and the track still will not go together.
  const brands = [...new Set(parts.map((p) => p.brand))];
  for (let i = 0; i < brands.length; i++) {
    for (let j = i + 1; j < brands.length; j++) {
      const { fit, why } = brandFit(brands[i]!, brands[j]!);
      if (fit === 'does-not-join') {
        issues.push({
          kind: 'brands-do-not-join',
          detail: `${brands[i]} and ${brands[j]} track do not physically join. ${why}`,
        });
      }
    }
  }

  // 4. The joint give is still estimated. Always true today, and the reason the
  // verdict copy says "may well seat" rather than "will".
  //
  // This used to be a paragraph under the palette, five screen inches from the
  // verdict it qualifies, where it read as a footnote about the product rather
  // than a caveat on THIS result.
  //
  // It must stay true in EVERY verdict state, because this register rides with
  // all of them. A first attempt folded in the necessary-versus-sufficient
  // sentence ("the gap could fit inside the total give, not that it will"),
  // which is the right point but only about NEEDS_GIVE; on an EXCEEDS verdict
  // it read as contradicting the verdict directly above it. That sentence now
  // lives in the NEEDS_GIVE copy, where it is true, and this one says the
  // thing that holds everywhere: the number is a guess.
  if (parts.some((p) => p.slop.calibrationStatus !== 'measured')) {
    issues.push({
      kind: 'estimated-give',
      detail:
        'Joint give is estimated, not measured, so the give total and any verdict ' +
        'resting on it are provisional.',
    });
  }

  // 5. The give bound counts AXIAL slack only. UNCONDITIONAL, and that is the
  // entire reason it is a separate rule from 4.
  //
  // `totalGiveMm` (`solver/residual.ts:135`) sums `axialMaxMm` and nothing
  // else. `angularMaxDeg` is computed per joint and written onto every one of
  // them (`residual.ts:111`) and read by no give calculation anywhere; the
  // only other reference in the repo asserts it is finite. The graph path
  // agrees: `weldGiveMm` (`graph/model.ts:224`) returns `Math.max(slopA,
  // slopB)` with no angular term. So the bound ignores a real effect, and
  // `CALIBRATION.md` argues it is the LARGER of the two: lever arms around
  // 300mm against axial budgets "around 1mm", so a joint's small rotation
  // moves a far end much further than its pull-apart does.
  //
  // WHY NOT FOLDED INTO RULE 4. Rule 4 is gated on `calibrationStatus !==
  // 'measured'`, so the day a real axial figure is measured (task X3) rule 4
  // correctly falls silent. Before this rule existed the axial-only caveat
  // fell silent WITH it, which is exactly backwards: a measured axial budget
  // makes the angular omission more misleading, not less, because the number
  // then carries the authority of a measurement while still describing half
  // the give. Rule 4 is about how good the number is; this is about what the
  // number counts.
  //
  // It is unconditional because no part data can make it false. `angularDeg`
  // is already populated (0.8mm axial beside 1.5 degrees in `ESTIMATED_SLOP`),
  // so this is a number being discarded rather than a missing one. The rule
  // stops being true only when the engine starts reading `angularMaxDeg`, and
  // deleting it is then part of that change.
  //
  // The copy deliberately does NOT say the verdict above it may be wrong. A
  // first attempt at rule 4 made that mistake and read as contradicting the
  // verdict it qualified; this states what the model omits and lets the
  // reader draw the inference.
  //
  // IT ALSO DOES NOT SAY WHICH WAY THE ERROR RUNS. An earlier version ended
  // "so the real give may be larger than this figure", which asserts a
  // DIRECTION taken from `CALIBRATION.md`'s lever-arm argument -- and that
  // document hedges it as "If that is right". Stating it as fact was the same
  // overclaim this register exists to prevent, one level down. The direction
  // needs the measurement; the omission does not, so only the omission is
  // claimed here.
  //
  // This is no longer load-bearing for the verdict's honesty. The EXCEEDS
  // headline now scopes its own claim to the modelled give, so if this note is
  // truncated out of the inline list it leaves no contradiction behind it --
  // which is why `TRUST_INLINE_LIMIT` stays at 2.
  issues.push({
    kind: 'axial-only-give',
    detail:
      'The give total counts pull-apart slack only, and the play from joints ' +
      'rotating is not modelled.',
  });

  return issues;
}
