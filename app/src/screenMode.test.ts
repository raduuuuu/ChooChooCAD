/**
 * EVERY SCREEN, EVERY PERMISSION (share plan, eng D65, D68, D71).
 *
 * Value: protects=the four inputs decide one of four screens, and each
 * screen's edit, layout-save and build-slot permissions, for all sixteen
 * combinations
 * Value: fails_when=a phone can edit, a link or the example saves the layout,
 * a link edits, or width moves the build slot
 * Value: why_new=the screen was link-or-editor until now
 * Value: seam=the pure function
 * Value: no_claim=what each screen draws (firstVisit.dom.test.tsx)
 */

import { describe, expect, it } from 'vitest';
import { screenMode, type Screen } from './screenMode.js';

const LINK: Screen = { mode: 'link', canEdit: false, saveLayout: false, ownBuild: false };
const EDIT: Screen = { mode: 'edit', canEdit: true, saveLayout: true, ownBuild: true };
const VIEW: Screen = { mode: 'view', canEdit: false, saveLayout: true, ownBuild: true };
const EXAMPLE_WIDE: Screen = { mode: 'example', canEdit: true, saveLayout: false, ownBuild: false };
const EXAMPLE_PHONE: Screen = { mode: 'example', canEdit: false, saveLayout: false, ownBuild: false };

// link, stored, narrow, adopted → screen
const TABLE: readonly [boolean, boolean, boolean, boolean, Screen][] = [
  ...[false, true].flatMap((stored) =>
    [false, true].flatMap((narrow) => [false, true].map((adopted) => [true, stored, narrow, adopted, LINK] as [boolean, boolean, boolean, boolean, Screen])),
  ),
  [false, false, false, false, EXAMPLE_WIDE],
  [false, false, true, false, EXAMPLE_PHONE],
  [false, false, false, true, EDIT],
  [false, false, true, true, VIEW],
  [false, true, false, false, EDIT],
  [false, true, true, false, VIEW],
  [false, true, false, true, EDIT],
  [false, true, true, true, VIEW],
];

describe('screenMode', () => {
  it('covers all sixteen combinations', () => {
    expect(new Set(TABLE.map((r) => r.slice(0, 4).join())).size).toBe(16);
  });

  /*
   * MUTATION PROOF, run: the phone example given `canEdit: true` (the wide
   * one's value): `expected { Object (mode, canEdit, ...) } to deeply equal
   * { mode: 'example', …(3) }`.
   */
  it.each(TABLE)('link %s, stored %s, narrow %s, adopted %s', (link, stored, narrow, adopted, want) => {
    expect(screenMode({ link, stored, narrow, adopted })).toEqual(want);
  });
});
