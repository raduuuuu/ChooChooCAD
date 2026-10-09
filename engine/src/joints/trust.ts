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

import { isUncorroborated, isUnverified, type Brand, type Layout, type Part } from '../parts/schema.js';

export interface TrustIssue {
  readonly kind: 'unverified-size' | 'single-source' | 'brands-do-not-join' | 'estimated-give';
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
  if (parts.some((p) => p.slop.calibrationStatus !== 'measured')) {
    issues.push({
      kind: 'estimated-give',
      detail: 'Joint give is estimated, not measured.',
    });
  }

  return issues;
}
