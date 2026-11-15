/**
 * WHICH SCREEN, AND WHAT IT MAY DO (share plan, eng D65, D66, D68, D70, D71;
 * design 3A, 19A).
 *
 *                     link?  ─yes─▶ link     (somebody else's, read-only on every screen)
 *                       │no
 *            stored or adopted?
 *              │yes                     │no
 *             edit                     example (editable; first edit adopts)
 *
 * THE SCREEN'S SIZE IS NOT ASKED (plan 2026-11-14, E4; eng ED2). A phone edits
 * too, in its own shell, which App chooses by rendering it; what a screen MAY
 * do depends only on whose layout it is. There was a `view` mode, your own
 * layout read-only on a narrow screen: it went with the phone's editor.
 *
 * Derived on every render (D70). `stored` is read once at mount; `adopted`
 * becomes true at the first change to the example's layout, or Start my own.
 *
 * `saveLayout` gates ONLY the saved-layout key (D68): the example is not
 * saved until it is yours, while the box, the table and your parts save as
 * always. `ownBuild` picks the build-progress slot by ownership, never by
 * width (D71): your own layout uses generic.build.v0, a link or the example
 * not yet adopted uses generic.build.link.v0.
 */

export type ScreenMode = 'edit' | 'link' | 'example';

export interface ScreenInput {
  readonly link: boolean;
  /** A layout of this browser's own was there at mount (layoutStore's holdsOwnLayout). */
  readonly stored: boolean;
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

export function screenMode({ link, stored, adopted }: ScreenInput): Screen {
  if (link) return { mode: 'link', canEdit: false, saveLayout: false, ownBuild: false };
  if (stored || adopted) return { mode: 'edit', canEdit: true, saveLayout: true, ownBuild: true };
  return { mode: 'example', canEdit: true, saveLayout: false, ownBuild: false };
}
