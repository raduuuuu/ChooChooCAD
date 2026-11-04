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
export const GOATCOUNTER_CODE = '';

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
