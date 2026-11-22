import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../../engine/data/library.js';
import { brandWords, TERMS } from '../../../engine/data/brandWords.js';
import { PRESETS } from '../presets.js';
import { decodeLink } from '../shareLink.js';
import { coloursOf, draw, PAGE_COLOURS } from './drawing.js';
import { floorCmOf, kindsOf, picturePath, previewPath } from './layoutPage.js';
import { listHtml } from './listPage.js';
import { PUBLISHED } from './published.js';
import { EXPLANATION, HOME_DATA, HOME_DESCRIPTION, HOME_TITLE, jsonLd, PAGES_CHANGED, SITE } from './shell.js';
import { addressesIn, fileOf, picturesIn, picturesOf, site, sitemap } from './site.js';
import { presetGraph } from '../presetVerdict.js';

/*
 * THE PAGES A SEARCH ENGINE READS (plan 2026-11-14, E1; owner,
 * 2026-11-22). Each pin names the change that makes it fail, and each was
 * run (CLAUDE.md).
 */

const resolve = makeResolver(BUILT_IN);
const appDir = join(import.meta.dirname, '..', '..');
const tokens = readFileSync(join(appDir, 'src', 'tokens.css'), 'utf8');
const all = await site(tokens);
/** The layout pages, with their pieces and links. */
const built = { pages: all.layouts };
/** Every page this module builds, as its HTML. */
const htmls = all.pages.flatMap((p) => (p.html === null ? [] : [{ path: p.path, html: p.html }]));
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
   * '<url><loc>https://woodentrain.world/<…'`), or robots.txt stops naming it.
   * The dates are WRITTEN ones: the same sitemap comes out on any day.
   */
  it('lists every page in the sitemap with the date its words changed, and robots.txt names the sitemap', () => {
    const map = sitemap(all.pages);
    expect(all.pages.length).toBe(built.pages.length + 2);
    for (const page of all.pages) {
      expect(page.changed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(map).toContain(`<url><loc>${SITE}${page.path}</loc><lastmod>${page.changed}</lastmod>`);
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

  /*
   * A PICTURE FILE PER LAYOUT (owner, 2026-11-22: "Give every layout its own
   * picture file"; "SVG files, hand-drawn previews"). A search engine lists
   * picture files, not drawings inside a page, so the page shows a file, the
   * build writes it where its address stays fixed, and the sitemap names it.
   * Fails when:
   * - the page goes back to a drawing inside it (`<div class="floor">${l.drawing}`
   *   in place of the `<img>`): `to contain '<img src="/layouts/circle.svg"…'`;
   * - the file is drawn with the page's colours (`PAGE_COLOURS` handed to
   *   `draw` for the file): `expected '<svg xmlns=…' not to contain 'var('`;
   * - the picture is left out of the sitemap (`picture` dropped from the
   *   page in site.ts): `expected [] to deeply equal [ '/layouts/circle.svg', … ]`.
   */
  it('shows each layout as a picture file that stands alone and is in the sitemap', () => {
    for (const page of built.pages) {
      expect(all.files.map((f) => f.file)).toContain(`public${picturePath(page.slug)}`);
      const file = all.files.find((f) => f.file === `public${picturePath(page.slug)}`);
      expect(file!.content).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="/);
      expect(file!.content).not.toContain('var(');
      expect(file!.content).toContain(`style="fill:${coloursOf(tokens).floor}"`);
      expect(file!.content).toContain(`aria-label="${page.label}, a ${page.pieceCount}-piece loop of wooden train track`);
      const [, w, h] = /viewBox="\S+ \S+ (\S+) (\S+)"/.exec(file!.content)!;
      expect(page.html).toContain(
        `<img src="${picturePath(page.slug)}" alt="${page.label}: a ${page.pieceCount}-piece loop of wooden train track, seen from overhead" width="${Math.round(Number(w))}" height="${Math.round(Number(h))}">`,
      );
      expect(page.html).not.toContain('<svg');
    }
    expect(all.files.length).toBe(built.pages.length);
    expect(picturesIn(sitemap(all.pages))).toEqual(built.pages.map((p) => picturePath(p.slug)));
    // The drawing inside a list still takes the page's colours, which follow the tokens the page links.
    expect(draw(presetGraph(PRESETS[0]!), 'x', PAGE_COLOURS).svg).toContain('stroke:var(--track-edge)');
  });

  /*
   * THE PICTURE A PASTED LINK SHOWS: one per layout page, 1200 by 630, drawn
   * by hand (`bun scripts/ogImage.ts --all`) and committed. Its size is read
   * from the file's own header.
   * Fails when:
   * - a layout page has no committed picture (app/public/layouts/bean.png
   *   deleted, run): `ENOENT: no such file or directory`;
   * - a layout page points at the shared picture again (the `preview` handed
   *   to `shell` dropped): `to contain '<meta property="og:image" content="https://woodentrain.world/layouts/circle.png">'`.
   * no_claim: that the picture still shows the layout as it is now; that is
   * looked at when a layout or the look changes.
   */
  it('gives each layout page its own committed link preview, 1200 by 630', () => {
    for (const page of built.pages) {
      const png = readFileSync(join(appDir, 'public', previewPath(page.slug)));
      expect([...png.subarray(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], page.slug).toEqual([1200, 630]);
      expect(page.html).toContain(`<meta property="og:image" content="${SITE}${previewPath(page.slug)}">`);
      expect(picturesOf(page.html)).toEqual([picturePath(page.slug), previewPath(page.slug)]);
    }
    const list = htmls.find((p) => p.path === '/layouts/')!.html;
    expect(list).toContain(`<meta property="og:image" content="${SITE}/og.png">`);
    expect(picturesOf(list)).toEqual(['/og.png']);
  });

  /*
   * THE SIZE ON THE FLOOR AND THE PIECES BY KIND (owner, 2026-11-22). The
   * two sizes below are a SECOND witness, worked by hand from the catalogue
   * figures: the large curve's centreline radius is 202 mm and a plank is
   * 40 mm wide, so the Circle is 2 × 202 + 40 = 444 mm across, 45 cm rounded
   * up; the Stadium is that across and 444 + 216 = 660 mm long.
   * Fails when:
   * - the plank's own width is left out (`() => 0` as the half width in
   *   floorCmOf): `expected [ 41, 41 ] to deeply equal [ 45, 45 ]`;
   * - a size is rounded down (`Math.floor(mm / 10)` in place of cmUp):
   *   `expected [ 44, 44 ] to deeply equal [ 45, 45 ]`;
   * - the kinds lose their order (`.sort` cut from kindsOf): `expected [ [ 'straight
   *   piece', 1 ], …(1) ] to deeply equal [ [ 'curves', 2 ], …(1) ]`.
   */
  it('says each layout’s size on the floor and its pieces by kind', () => {
    const of = (label: string) => built.pages.find((p) => p.label === label)!;
    expect(of('Circle').floorCm).toEqual([45, 45]);
    expect(of('Stadium').floorCm).toEqual([66, 45]);
    expect(of('Circle').html).toContain('On the floor it is <span class="num">45 × 45</span> cm: <span class="num">8</span> curves. Open it in the planner');
    expect(of('Stadium').html).toContain('<span class="num">66 × 45</span> cm: <span class="num">8</span> curves and <span class="num">2</span> straight pieces.');
    for (const page of built.pages) {
      expect(page.floorCm[0]).toBeGreaterThanOrEqual(page.floorCm[1]);
      expect(page.floorCm).toEqual(floorCmOf(presetGraph(PRESETS.find((p) => p.label === page.label)!)));
      expect(page.kinds.reduce((n, [, k]) => n + k, 0)).toBe(page.pieceCount);
      expect(page.kinds.map(([, k]) => k)).toEqual([...page.kinds.map(([, k]) => k)].sort((a, b) => b - a));
    }
    // Every ready layout uses its curves first and has more of them, so the order is shown on a made-up run of track.
    const piece = (partId: string, i: number) => ({ pieceId: `p${i}`, partId, turn: 'left' as const });
    expect(kindsOf({ pieces: ['D', 'E', 'E'].map(piece), welds: [], anchors: new Map() })).toEqual([
      ['curves', 2],
      ['straight piece', 1],
    ]);
  });

  /*
   * A LIST THAT STAYS SMALL. Every number in a drawing is written to a tenth
   * of a millimetre and each layer is one path, so the list of layouts was
   * 68 kB for seven and is under 30; it must stay loadable as layouts are added.
   * Fails when: the numbers go back to the solver's digits (`tenths(` taken
   * off the paths in `draw`): `expected [ '59.16443020031738', … ] to deeply equal []`.
   */
  it('writes a drawing’s numbers to a tenth of a millimetre, and keeps the list under 150 kB', () => {
    const list = htmls.find((p) => p.path === '/layouts/')!.html;
    const drawings = [...list.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(drawings.length).toBe(built.pages.length);
    expect(drawings.flatMap((d) => d.match(/\d+\.\d{2,}/g) ?? [])).toEqual([]);
    expect(new TextEncoder().encode(list).length).toBeLessThan(150_000);
  });

  /*
   * THE FILE THAT PROVES THE SITE IS OURS TO A SEARCH CONSOLE (owner,
   * 2026-11-22). The console checks for it again from time to time, so it
   * stays for good: removing it un-verifies the site.
   * Fails when: the file is deleted or its one line is changed: `ENOENT: no
   * such file or directory` (deleted, run).
   */
  it('keeps the search console’s ownership file, word for word', () => {
    const name = 'google806ff9dd19cd1bff.html';
    expect(readFileSync(join(appDir, 'public', name), 'utf8')).toBe(`google-site-verification: ${name}`);
  });
});
