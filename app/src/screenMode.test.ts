/**
 * EVERY SCREEN, EVERY PERMISSION (share plan, eng D65, D68, D71; plan
 * 2026-11-14, E4, eng ED2).
 *
 * Value: protects=the three inputs decide one of three screens, and each
 * screen's edit, layout-save and build-slot permissions, for all eight
 * combinations; the screen's size is not an input
 * Value: fails_when=a link edits or saves, the example saves the layout
 * before it is yours, or your own layout or the example cannot be edited
 * Value: why_new=the screen was link-or-editor until the share plan; a narrow
 * screen was read-only until a phone got its own editor
 * Value: seam=the pure function
 * Value: no_claim=what each screen draws (firstVisit.dom.test.tsx,
 * phoneShell.dom.test.tsx)
 */

import { describe, expect, it } from 'vitest';
import { screenMode, type Screen } from './screenMode.js';

const LINK: Screen = { mode: 'link', canEdit: false, saveLayout: false, ownBuild: false };
const EDIT: Screen = { mode: 'edit', canEdit: true, saveLayout: true, ownBuild: true };
const EXAMPLE: Screen = { mode: 'example', canEdit: true, saveLayout: false, ownBuild: false };

// link, stored, adopted → screen
const TABLE: readonly [boolean, boolean, boolean, Screen][] = [
  ...[false, true].flatMap((stored) => [false, true].map((adopted) => [true, stored, adopted, LINK] as [boolean, boolean, boolean, Screen])),
  [false, false, false, EXAMPLE],
  [false, false, true, EDIT],
  [false, true, false, EDIT],
  [false, true, true, EDIT],
];

describe('screenMode', () => {
  it('covers all eight combinations', () => {
    expect(new Set(TABLE.map((r) => r.slice(0, 3).join())).size).toBe(8);
  });

  /*
   * MUTATION PROOFS, run:
   * - a link given `canEdit: true`: `expected { mode: 'link', canEdit: true,
   *   …(2) } to deeply equal { mode: 'link', canEdit: false, …(2) }`.
   * - the example given `saveLayout: true`: the same shape, for the example.
   */
  it.each(TABLE)('link %s, stored %s, adopted %s', (link, stored, adopted, want) => {
    expect(screenMode({ link, stored, adopted })).toEqual(want);
  });
});
