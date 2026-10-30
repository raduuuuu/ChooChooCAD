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


  // RULES 4 AND 5 ARE RETIRED (design review 8A, 2026-10-30). 'estimated-give'
  // said the give total was a guess; the total is gone, and where each
  // joint's bend limit comes from is now said once, in the limits note the
  // verdict carries (engine/src/joints/bendWords.ts, design 5A).
  // 'axial-only-give' said joint rotation was not modelled; it is now
  // (docs/designs/joint-bend.md), so the disclosure would be false.


  return issues;
}
