/**
 * EVERY PAGE OF THE SITE A SEARCH ENGINE IS SHOWN, AS ONE LIST (owner,
 * 2026-11-22). The build script writes it, the sitemap is made from
 * it and every "all pages" test walks it, so a new kind of page cannot be
 * left out of any of them.
 *
 *   layoutPage.ts ─┐
 *   whyPage.ts    ─┤
 *   listPage.ts   ─┼─▶ site(): pages, files  ─┬─▶ scripts/layoutPages.ts writes each `file`
 *   (the home     ─┘                        ├─▶ sitemap(pages)
 *    page, by address only)                 ├─▶ published.ts, compared both ways by the test
 *                                           └─▶ tests: brand words, the counter, one heading
 *
 * The home page is `app/index.html`, written by hand and built by Vite: it
 * is listed by address, with no `html`. Pages nobody should land on from a
 * search (the photo guide, the contributor brief) are not here.
 */

import { coloursOf } from './drawing.js';
import { layoutPages, layoutPath, picturePath, type LayoutPage } from './layoutPage.js';
import { listHtml } from './listPage.js';
import { PAGES_CHANGED, SITE } from './shell.js';
import { WHY_CHANGED, WHY_PATH, whyHtml } from './whyPage.js';

export interface Page {
  /** The address, from the site's root. */
  readonly path: string;
  /** Where the build writes it, under `app/`; null for a page this module does not build. */
  readonly file: string | null;
  readonly html: string | null;
  /** The sitemap's date for it: when what it says last changed, written by hand (shell.ts). */
  readonly changed: string;
  /** Its own picture file, from the site's root, listed with it in the sitemap. */
  readonly picture?: string;
}

/** A file the build writes that is not a page: a layout's picture. */
export interface SiteFile {
  /** Where the build writes it, under `app/`. */
  readonly file: string;
  readonly content: string;
}

export interface Site {
  readonly pages: readonly Page[];
  /** The layout pages' own details, for the tests that count pieces and follow links. */
  readonly layouts: readonly LayoutPage[];
  /** The picture files, written into `app/public/` so each keeps its address through the build. */
  readonly files: readonly SiteFile[];
}

/** `tokensCss` is `app/src/tokens.css` as text: a picture file carries its colours as values. */
export async function site(tokensCss: string): Promise<Site> {
  const layouts = await layoutPages(coloursOf(tokensCss));
  const pages: Page[] = [
    { path: '/', file: null, html: null, changed: PAGES_CHANGED },
    { path: '/layouts/', file: 'layouts/index.html', html: listHtml(layouts), changed: PAGES_CHANGED },
    ...layouts.map((l) => ({
      path: layoutPath(l.slug),
      file: `layouts/${l.slug}.html`,
      html: l.html,
      changed: PAGES_CHANGED,
      picture: picturePath(l.slug),
    })),
    { path: WHY_PATH, file: fileOf(WHY_PATH), html: whyHtml(), changed: WHY_CHANGED },
  ];
  const files = layouts.map((l) => ({ file: `public${picturePath(l.slug)}`, content: `${l.picture}\n` }));
  return { pages, layouts, files };
}

/** The sitemap: every page, with the date its words last changed and its picture when it has one. */
export function sitemap(pages: readonly Page[]): string {
  const picture = (p: Page) => (p.picture === undefined ? '' : `<image:image><image:loc>${SITE}${p.picture}</image:loc></image:image>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.changed}</lastmod>${picture(p)}</url>`).join('\n')}
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

/** Every picture a sitemap lists for this site, as a path from its root. */
export function picturesIn(map: string): string[] {
  return [...map.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)]
    .map((m) => m[1]!)
    .filter((u) => u.startsWith(SITE))
    .map((u) => u.slice(SITE.length));
}

/** The files of this site a built page points at: its pictures, and the picture a pasted link shows. */
export function picturesOf(html: string): string[] {
  const shown = [...html.matchAll(/<img src="(\/[^"]+)"/g)].map((m) => m[1]!);
  const preview = [...html.matchAll(/<meta property="og:image" content="([^"]+)"/g)].map((m) => m[1]!).filter((u) => u.startsWith(SITE)).map((u) => u.slice(SITE.length));
  return [...shown, ...preview];
}
