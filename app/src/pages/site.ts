/**
 * EVERY PAGE OF THE SITE A SEARCH ENGINE IS SHOWN, AS ONE LIST (owner,
 * 2026-11-22). The build script writes it, the sitemap is made from
 * it and every "all pages" test walks it, so a new kind of page cannot be
 * left out of any of them.
 *
 *   layoutPage.ts ─┐
 *   listPage.ts   ─┼─▶ sitePages(): Page[] ─┬─▶ scripts/layoutPages.ts writes each `file`
 *   (the home     ─┘                        ├─▶ sitemap(pages)
 *    page, by address only)                 ├─▶ published.ts, compared both ways by the test
 *                                           └─▶ tests: brand words, the counter, one heading
 *
 * The home page is `app/index.html`, written by hand and built by Vite: it
 * is listed by address, with no `html`. Pages nobody should land on from a
 * search (the photo guide, the contributor brief) are not here.
 */

import { layoutPages, layoutPath, type LayoutPage } from './layoutPage.js';
import { listHtml } from './listPage.js';
import { PAGES_CHANGED, SITE } from './shell.js';

export interface Page {
  /** The address, from the site's root. */
  readonly path: string;
  /** Where the build writes it, under `app/`; null for a page this module does not build. */
  readonly file: string | null;
  readonly html: string | null;
  /** The sitemap's date for it: when what it says last changed, written by hand (shell.ts). */
  readonly changed: string;
}

export interface Site {
  readonly pages: readonly Page[];
  /** The layout pages' own details, for the tests that count pieces and follow links. */
  readonly layouts: readonly LayoutPage[];
}

export async function site(): Promise<Site> {
  const layouts = await layoutPages();
  const pages: Page[] = [
    { path: '/', file: null, html: null, changed: PAGES_CHANGED },
    { path: '/layouts/', file: 'layouts/index.html', html: listHtml(layouts), changed: PAGES_CHANGED },
    ...layouts.map((l) => ({ path: layoutPath(l.slug), file: `layouts/${l.slug}.html`, html: l.html, changed: PAGES_CHANGED })),
  ];
  return { pages, layouts };
}

/** The sitemap: every page, with the date its words last changed. */
export function sitemap(pages: readonly Page[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.changed}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/** The file an address is served from, under the built site: a folder's address is its `index.html`. */
export const fileOf = (path: string) => (path.endsWith('/') ? `${path}index.html` : path).replace(/^\//, '');

/** Every address in a sitemap that belongs to this site, as a path from its root (scripts/siteCheck.ts reads the built one). */
export function addressesIn(map: string): string[] {
  return [...map.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1]!)
    .filter((u) => u.startsWith(SITE))
    .map((u) => u.slice(SITE.length));
}
