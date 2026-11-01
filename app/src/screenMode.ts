/**
 * WHICH SCREEN, AND WHAT IT MAY DO (share plan, eng D65, D66, D68, D70, D71;
 * design 3A, 19A).
 *
 *                     link?  ─yes─▶ link     (somebody else's, read-only)
 *                       │no
 *            stored or adopted?
 *              │yes                     │no
 *      narrow? ─no─▶ edit         narrow? ─no─▶ example (editable; first edit adopts)
 *         │yes                      │yes
 *         ▼                         ▼
 *        view (own, read-only)     example (read-only on a phone)
 *
 * Derived on every render (D70): turning a tablet across 620px changes the
 * mode, never the graph. `stored` is read once at mount; `adopted` becomes
 * true at the first change to the example's layout, or Start my own.
 *
 * `saveLayout` gates ONLY the saved-layout key (D68): the example is not
 * saved until it is yours, while the box, the table and your parts save as
 * always. `ownBuild` picks the build-progress slot by ownership, never by
 * width (D71): your own layout uses brio.build.v0, a link or the example
 * not yet adopted uses brio.build.link.v0.
 */

export type ScreenMode = 'edit' | 'link' | 'example' | 'view';

export interface ScreenInput {
  readonly link: boolean;
  /** A layout of this browser's own was there at mount (layoutStore's holdsOwnLayout). */
  readonly stored: boolean;
  /** The narrow query matches (NARROW_QUERY). */
  readonly narrow: boolean;
  /** The first-visit example has been edited, or set aside for an empty floor. */
  readonly adopted: boolean;
}

export interface Screen {
  readonly mode: ScreenMode;
  /** Whether an action may change the layout (D21's guard in `dispatch`). */
  readonly canEdit: boolean;
  /** Whether the layout autosaves. Other stores are not gated here. */
  readonly saveLayout: boolean;
  /** Whether build progress goes to the user's own slot. */
  readonly ownBuild: boolean;
}

export function screenMode({ link, stored, narrow, adopted }: ScreenInput): Screen {
  if (link) return { mode: 'link', canEdit: false, saveLayout: false, ownBuild: false };
  const own = stored || adopted;
  if (own) return narrow ? { mode: 'view', canEdit: false, saveLayout: true, ownBuild: true } : { mode: 'edit', canEdit: true, saveLayout: true, ownBuild: true };
  return { mode: 'example', canEdit: !narrow, saveLayout: false, ownBuild: false };
}
