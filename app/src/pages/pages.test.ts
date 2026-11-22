import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../../engine/data/library.js';
import { brandWords, TERMS } from '../../../engine/data/brandWords.js';
import { PRESETS } from '../presets.js';
import { decodeLink } from '../shareLink.js';
import { listHtml } from './listPage.js';
import { PUBLISHED } from './published.js';
import { EXPLANATION, HOME_DATA, HOME_DESCRIPTION, HOME_TITLE, jsonLd, PAGES_CHANGED, SITE } from './shell.js';
import { addressesIn, fileOf, site, sitemap } from './site.js';

/*
 * THE PAGES A SEARCH ENGINE READS (plan 2026-11-14, E1; owner,
 * 2026-11-22). Each pin names the change that makes it fail, and each was
 * run (CLAUDE.md).
 */

const resolve = makeResolver(BUILT_IN);
const all = await site();
/** The layout pages, with their pieces and links. */
const built = { pages: all.layouts };
/** Every page this module builds, as its HTML. */
const htmls = all.pages.flatMap((p) => (p.html === null ? [] : [{ path: p.path, html: p.html }]));
const appDir = join(import.meta.dirname, '..', '..');
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Which ready layouts close, from a SECOND witness: what each preset declares
 * (`expect`), which `presets.test.ts` holds to the solver. `layoutPages.ts`
 * never reads `expect`; it asks the verdict.
 */
const closing = PRESETS.filter((p) => p.expect === 'exact');

describe('layout pages', () => {
  /*
   * Fails when: the `if (!closesExactly(graph)) continue;` line in
   * pages/layoutPage.ts is deleted. Near miss then gets a page saying it "closes
   * exactly", and this reports one slug more than the layouts that close.
   */
  it('gives a page to every ready layout that closes, and to no other', () => {
    expect(closing.length).toBeGreaterThan(0);
    expect(closing.length).toBeLessThan(PRESETS.length);
    expect(built.pages.map((p) => p.slug)).toEqual(closing.map((p) => slug(p.label)));
  });

  /*
   * Fails when: the count written beside a piece is off by one
   * (`<span class="num">${n + 1}</span>` in pageHtml). Counted here from the
   * preset's own list, not from the page's map.
   */
  it('lists the pieces the layout takes, with the counts its preset has', () => {
    for (const page of built.pages) {
      const preset = PRESETS.find((p) => p.label === page.label)!;
      const want = new Map<string, number>();
      for (const id of preset.pieces) want.set(id, (want.get(id) ?? 0) + 1);
      for (const [id, n] of want) {
        expect(page.html, `${page.label} ${id}`).toContain(
          `<li><span class="num">${n}</span> × ${resolve(id).name} (<span class="num">${id}</span>)</li>`,
        );
      }
      expect(page.html).toContain(`takes <span class="num">${preset.pieces.length}</span> pieces`);
    }
  });

  /*
   * Fails when: the link is encoded from another layout (`encodeLink(EMPTY_GRAPH)`
   * in pages/layoutPage.ts): the decoded pieces are then none.
   */
  it('links each page to the same layout, opened in the app', async () => {
    for (const page of built.pages) {
      const preset = PRESETS.find((p) => p.label === page.label)!;
      expect(page.html).toContain(`href="/${page.fragment}"`);
      const back = await decodeLink(page.fragment);
      expect(back.ok).toBe(true);
      if (!back.ok) continue;
      expect(back.graph.pieces.map((p) => p.partId).sort()).toEqual([...preset.pieces].sort());
    }
  });

  /*
   * Fails when: a maker's name is written into EXPLANATION or a page (AGENTS.md,
   * "Never name a track brand"). The second expectation is the control: the same
   * check does catch a term when one is there.
   */
  it('names no track brand anywhere a page shows', () => {
    // Every page the site lists, not only the layouts: a new kind of page is checked the day it is listed.
    expect(htmls.length).toBe(all.pages.length - 1);
    const text = [...htmls.map((p) => p.html), ...EXPLANATION, HOME_TITLE, HOME_DESCRIPTION].join('\n');
    expect(brandWords(text)).toEqual([]);
    expect(brandWords(`${text}\n${TERMS[0]}`)).toHaveLength(1);
  });

  /*
   * Fails when: HOME_TITLE or HOME_DESCRIPTION is edited without app/index.html
   * (or the other way round). The home page is a hand-written file, so this is
   * what keeps its words and the pages' the same.
   */
  it('keeps the home page saying what the pages say', () => {
    const home = readFileSync(join(appDir, 'index.html'), 'utf8');
    expect(home).toContain(`<title>${HOME_TITLE}</title>`);
    expect(home).toContain(`<meta name="description" content="${HOME_DESCRIPTION}" />`);
    expect(home).toContain(`<meta property="og:title" content="${HOME_TITLE}" />`);
    expect(home).toContain(`<meta property="og:description" content="${HOME_DESCRIPTION}" />`);
    expect(home).toContain('<a href="/layouts/">');
  });

  /*
   * Fails when: a page is left out of the sitemap (drop a page from `site()`'s
   * list: the guard below fails first), the date is dropped from an entry
   * (`<lastmod>` removed in `sitemap`: `expected ... to contain
   * '<lastmod>2026-11-22</lastmod></url>'`), or robots.txt stops naming it.
   * The dates are WRITTEN ones: the same sitemap comes out on any day.
   */
  it('lists every page in the sitemap with the date its words changed, and robots.txt names the sitemap', () => {
    const map = sitemap(all.pages);
    expect(all.pages.length).toBe(built.pages.length + 2);
    for (const page of all.pages) {
      expect(page.changed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(map).toContain(`<url><loc>${SITE}${page.path}</loc><lastmod>${page.changed}</lastmod></url>`);
    }
    expect(all.pages.every((p) => p.changed === PAGES_CHANGED)).toBe(true);
    const robots = readFileSync(join(appDir, 'public', 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  /*
   * THE PIECE COUNT IN THE WORDS PEOPLE TYPE (owner, 2026-11-22).
   * Fails when: the count is taken out of the title (`a ${count}-piece` cut
   * from `title` in pageHtml): `expected '<!doctype html>…' to contain
   * '<title>Circle: a 8-piece wooden train…'`.
   */
  it('says the piece count in each layout page’s title, description and heading', () => {
    for (const page of built.pages) {
      const n = PRESETS.find((p) => p.label === page.label)!.pieces.length;
      expect(page.html).toContain(`<title>${page.label}: a ${n}-piece wooden train track layout that closes | ChooChooCAD</title>`);
      expect(page.html).toContain(`<meta name="description" content="${page.label}: a ${n}-piece `);
      expect(page.html).toContain(`<h1>${page.label}: a ${n}-piece wooden train track loop that closes exactly</h1>`);
    }
  });

  /*
   * FEWEST PIECES FIRST, THE COUNT BEFORE THE NAME. Handed
   * the layouts in reverse, because the app already offers them in count
   * order and a list that sorted nothing would look sorted.
   * Fails when: the sort is removed from `byPieceCount` (`[...pages]` alone):
   * `expected [ 18, 16, 12, … ] to deeply equal [ 8, 10, 12, … ]`.
   */
  it('lists the layouts fewest pieces first, each count before its name', () => {
    const html = listHtml([...built.pages].reverse());
    const counts = [...html.matchAll(/<span class="num">(\d+)<\/span> pieces: /g)].map((m) => Number(m[1]));
    expect(counts).toEqual([...built.pages.map((p) => p.pieceCount)].sort((a, b) => a - b));
    expect(counts.length).toBe(built.pages.length);
  });

  /*
   * STRUCTURED DATA A SEARCH ENGINE CAN PARSE.
   * Fails when:
   * - a layout page's data names another type (`'@type': 'ItemList'` in
   *   `breadcrumbs`): `expected 'ItemList' to be 'BreadcrumbList'`;
   * - `HOME_DATA` is edited without app/index.html: `expected '<!doctype
   *   html>…' to contain '<script type="application/ld+json">…'`.
   */
  it('gives each page structured data that parses and names what the page is', () => {
    const dataOf = (html: string) => {
      const found = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(found.length).toBe(1);
      return JSON.parse(found[0]![1]!) as { '@type': string; itemListElement: { name: string; item?: string; url?: string }[] };
    };
    const list = dataOf(htmls.find((p) => p.path === '/layouts/')!.html);
    expect(list['@type']).toBe('ItemList');
    expect(list.itemListElement.map((i) => i.url)).toEqual(
      [...built.pages].sort((a, b) => a.pieceCount - b.pieceCount).map((p) => `${SITE}/layouts/${p.slug}.html`),
    );
    for (const page of built.pages) {
      const crumbs = dataOf(page.html);
      expect(crumbs['@type']).toBe('BreadcrumbList');
      expect(crumbs.itemListElement.map((i) => i.item)).toEqual([`${SITE}/`, `${SITE}/layouts/`, `${SITE}/layouts/${page.slug}.html`]);
      expect(crumbs.itemListElement[2]!.name).toBe(page.label);
    }
    expect(readFileSync(join(appDir, 'index.html'), 'utf8')).toContain(jsonLd(HOME_DATA));
    // A name can never close the tag: `<` leaves as an escape.
    expect(jsonLd({ name: '</script><b>' })).toBe('<script type="application/ld+json">{"name":"\\u003c/script>\\u003cb>"}</script>');
  });

  /*
   * EVERY STATIC PAGE COUNTS ITS VISITS, ONCE, AND THE README SAYS SO (owner,
   * 2026-11-22).
   * Fails when:
   * - the tag is left out of the shell (`${counter()}` removed): `/layouts/: expected +0 to be 1`;
   * - README goes back to saying only the editor counts: `expected '# ChooChooCAD…'
   *   to contain 'Every page of the site counts visits'`.
   */
  it('loads the visit counter once on every page it builds, and the README says every page counts', () => {
    expect(htmls.length).toBeGreaterThan(1);
    for (const { path, html } of htmls) {
      expect(html.split('src="/count.js"').length - 1, path).toBe(1);
      expect(html, path).toContain('<script data-goatcounter="https://raduuuuu.goatcounter.com/count" async src="/count.js"></script>');
      expect((html.match(/<h1>/g) ?? []).length, path).toBe(1);
    }
    const readme = readFileSync(join(appDir, '..', 'README.md'), 'utf8');
    expect(readme).toContain('Every page of the site counts visits');
    expect(readme).toContain('`/layouts/`');
  });

  /*
   * NO PUBLISHED ADDRESS DISAPPEARS, AND NONE SHIPS UNLISTED (owner, 2026-11-22).
   * Fails when:
   * - a layout is renamed (`label: 'Bean'` to `'Kidney'` in presets.ts):
   *   `expected [ '/', '/layouts/', …(7) ] to deeply equal [ '/', '/layouts/', …(7) ]`, the two lists differing in that one address;
   * - an address is dropped from the list (a line cut from PUBLISHED): the
   *   same expectation, `…(7) ] to deeply equal [ '/', '/layouts/', …(6) ]`.
   */
  it('builds every address ever published, and lists every address it builds', () => {
    const builds = all.pages.map((p) => p.path);
    expect([...builds].sort()).toEqual([...PUBLISHED].sort());
    expect(new Set(PUBLISHED).size).toBe(PUBLISHED.length);
    // Each page is written where its address is served from.
    for (const page of all.pages) if (page.file !== null) expect(page.file).toBe(fileOf(page.path));
  });

  /*
   * WHAT THE AFTER-BUILD CHECK READS (scripts/siteCheck.ts, through site.ts): a folder's
   * address is its index file, and only this site's addresses count.
   * Fails when: `fileOf` stops adding `index.html` to a folder's address:
   * `expected '' to be 'index.html'` here, and the guard above fails too
   * (`expected 'layouts/index.html' to be 'layouts/'`).
   */
  it('maps each sitemap address to the file that serves it', () => {
    expect(fileOf('/')).toBe('index.html');
    expect(fileOf('/layouts/')).toBe('layouts/index.html');
    expect(fileOf('/layouts/bean.html')).toBe('layouts/bean.html');
    expect(addressesIn(sitemap(all.pages))).toEqual(all.pages.map((p) => p.path));
    expect(addressesIn('<loc>https://elsewhere.example/x</loc>')).toEqual([]);
  });
});
