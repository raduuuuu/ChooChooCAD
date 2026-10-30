/**
 * A LAYOUT WITH A MULTI-ROAD PIECE SAYS IT IS MODELLED (task T3b; eng review
 * D7 widened it from switches to crossings and every multi-road piece).
 *
 * Value: protects=any layout holding a switch or crossing carries the
 * disclosure that the piece's geometry is modelled, not measured, whatever its
 * dimension source
 * Value: fails_when=the disclosure is dropped, hung off the unverified branch
 * so a better-sourced piece loses it, or detected by something narrower than
 * the multi-road kind
 * Value: why_new=switches entered the library as seeds on 2026-10-22; until
 * then the state was unreachable and nothing emitted it
 * Value: seam=`layoutTrust` takes a resolver, so a switch can be promoted to
 * 'published' here without touching the catalogue
 * Value: no_claim=nothing about how the line is drawn, which
 * `app/src/verdictRegion.test.ts` owns
 */

import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../data/library.js';
import { brandFit } from '../data/thirdParty.js';
import { layoutTrust } from '../src/joints/trust.js';
import type { Layout, Part } from '../src/parts/schema.js';

const layout = (ids: readonly string[]): Layout => ({
  placements: ids.map((partId) => ({ partId, turn: 'left' as const })),
  closed: false,
});
const trustOf = (ids: readonly string[], parts: readonly Part[] = BUILT_IN) =>
  layoutTrust(layout(ids), makeResolver(parts), brandFit);
const kinds = (ids: readonly string[], parts?: readonly Part[]) => trustOf(ids, parts).map((t) => t.kind);

describe('the modelled-switch disclosure', () => {
  /*
   * MUTATION PROOF, run: delete the `modelled-switch` push from
   * `layoutTrust`. Fails with `expected undefined to be 'This piece\'s
   * geometry is modelled, n…'`, and takes the next three specs with it.
   */
  it('is emitted, in the plan\'s words, for a layout holding one switch', () => {
    const t = trustOf(['L', 'E', 'E']).find((x) => x.kind === 'modelled-switch');
    expect(t?.detail).toBe("This piece's geometry is modelled, not measured.");
  });

  /*
   * EVERY MULTI-ROAD PIECE, not only switches (eng review D7). A crossing is
   * straight roads between listed ends, as much the engine's model as a
   * switch is.
   *
   * MUTATION PROOF, run: key the note on `p.kind === 'multi-road' &&
   * p.ports.length === 3`. Fails with `expected undefined to be 'This piece\'s
   * geometry is modelled, n…'`.
   */
  it('is emitted for a layout whose only multi-road piece is the H crossing', () => {
    const t = trustOf(['H', 'A']).find((x) => x.kind === 'modelled-switch');
    expect(t?.detail).toBe("This piece's geometry is modelled, not measured.");
  });

  /*
   * UNCONDITIONAL ON THE SOURCE. The seeds are `unverified`, so a disclosure
   * hung off that branch would pass the spec above and vanish the day a
   * switch is measured, while the model stayed exactly as unproven.
   *
   * MUTATION PROOF, run: change the filter to
   * `parts.filter((p) => isMultiRoad(p) && isUnverified(p))`. Fails with
   * `expected [ 'estimated-give', 'axial-only-give' ] to include
   * 'modelled-switch'`.
   */
  it('stays when the switch is promoted to a published source', () => {
    const published = BUILT_IN.map((p) =>
      p.id === 'L' ? { ...p, dimensions: { status: 'published' as const, source: 'test' } } : p,
    );
    const k = kinds(['L'], published);
    expect(k).not.toContain('unverified-size'); // the control: the promotion took
    expect(k).toContain('modelled-switch');
  });

  /*
   * MUTATION PROOF, run: swap the two sentences in `layoutTrust`. Fails with
   * `expected 'This piece\'s geometry is modelled, n…' to be 'These pieces\'
   * geometry is modelled, …'`; the two singular specs above fail too.
   */
  it('speaks in the plural for more than one switch, even two of the same part', () => {
    const t = trustOf(['L', 'L']).find((x) => x.kind === 'modelled-switch');
    expect(t?.detail).toBe("These pieces' geometry is modelled, not measured.");
  });

  it('is absent from a layout with no switch', () => {
    expect(kinds(['E', 'E', 'A'])).not.toContain('modelled-switch');
  });
});
