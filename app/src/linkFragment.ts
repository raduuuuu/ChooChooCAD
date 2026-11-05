/**
 * Any version of a shared-layout fragment (share plan, eng D17). Its own tiny
 * module so the editor can recognise a link without loading the decoder,
 * which arrives only when a link is opened (LinkRoute is a lazy chunk).
 */
export const LINK_FRAGMENT = /^#v(\d+)\./;

/*
 * VISITS ONLY, AND A SHARED LAYOUT NEVER LEAVES THE BROWSER (plan
 * 2026-11-01, P4 and R4; eng X3; wired by the app-focus review, D8).
 *
 *   main.tsx ──counterTag(code, PROD)──▶ null: no counter at all (dev, or no code)
 *            └─▶ <script src="/count.js" data-goatcounter=endpoint>
 *                  count.js (our reviewed copy) ──▶ p = countedPath(…) ──▶ GoatCounter
 *
 * The path is set here, never read by the counter: a layout lives in the
 * address's fragment (`#v1.…`), so every address the link route takes is
 * counted as `/shared-link` and the fragment itself is never sent.
 */

/** The GoatCounter site code, public (the NAME in NAME.goatcounter.com). Empty: no counter. */
export const GOATCOUNTER_CODE = 'raduuuuu';

/** The path a visit is counted under: `/shared-link` for any shared layout, else the page's path. */
export function countedPath(hash: string, pathname: string): string {
  return LINK_FRAGMENT.test(hash) ? '/shared-link' : pathname || '/';
}

/** The callback count.js asks for its path: this page's counted path, whatever it is handed. */
export const counterPath = (): string => countedPath(location.hash, location.pathname);

/** The counter to insert, or null: only in a production build, and only with a well-formed code. */
export function counterTag(code: string, production: boolean): { readonly src: string; readonly endpoint: string } | null {
  if (!production || !/^[a-z0-9][a-z0-9-]*$/.test(code)) return null;
  return { src: '/count.js', endpoint: `https://${code}.goatcounter.com/count` };
}

/*
 * WHAT PEOPLE DO, BY NAME ONLY (owner, 2026-11-05: "what people do in the
 * app", reversing 2026-11-01's "visits only"). Each action is a fixed name
 * from this list, sent as a GoatCounter event: nothing about the layout, no
 * piece count, no text the user typed, and no page title (which names a
 * shared layout's piece count). Without a counter (dev, no code) it does nothing.
 */
export const ACTIONS = {
  share: 'Shared a link',
  'build-it': 'Opened build mode',
  'view-3d': 'Switched to 3D',
  preset: 'Placed a preset',
  'your-box': 'Opened Your box',
  'add-part': 'Added a part',
  'save-file': 'Saved to a file',
  'open-file': 'Opened a layout file',
  'open-in-editor': 'Opened a link in the editor',
  works: 'Own layout first said "This works"',
} as const;
export type Action = keyof typeof ACTIONS;

/** The event GoatCounter is given for `action`: its fixed path and title, and nothing else of the page. */
export const actionEvent = (action: Action) => ({ path: `action/${action}`, title: ACTIONS[action], referrer: '', event: true }) as const;

/** Count `action`, if there is a counter on this page. Never throws. */
export function countAction(action: Action): void {
  try {
    window.goatcounter?.count?.(actionEvent(action));
  } catch {
    // Counting is never worth an error in the app.
  }
}
