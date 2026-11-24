import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../../engine/data/library.js';
import { isMeasured } from '../../../engine/data/measured.js';
import { PART_ORIGINS } from '../../../engine/data/origins.js';
import { SYSTEM_NAME, type Brand, type Part } from '../../../engine/src/parts/schema.js';
import { brandWords, TERMS } from '../../../engine/data/brandWords.js';
import { AppName } from '../AppName.js';
import { MeasuredTick } from '../PartPreview.js';
import { PRESETS } from '../presets.js';
import { decodeLink } from '../shareLink.js';
import { coloursOf, draw, PAGE_COLOURS } from './drawing.js';
import { floorCmOf, kindsOf, picturePath, previewPath } from './layoutPage.js';
import { listHtml } from './listPage.js';
import { PUBLISHED } from './published.js';
import { EXPLANATION, HOME_DATA, HOME_DESCRIPTION, HOME_TITLE, jsonLd, MARK, PAGES_CHANGED, SITE, TICK } from './shell.js';
import { markOf, MODELS_ID, modelsHtml, rowHtml, rowsForDigest, sizeGroups, SIZES_CHANGED, SIZES_DIGEST, SIZES_PATH, sizesOf, textOf } from './sizesPage.js';
import { addressesIn, fileOf, picturesIn, picturesOf, site, sitemap } from './site.js';
import { EXAMPLES, exampleGraph, WHY_PATH } from './whyPage.js';
import { presetGraph, verdictOf } from '../presetVerdict.js';

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
    // The home page, the list, each layout, the why page and the page of sizes.
    expect(all.pages.length).toBe(built.pages.length + 4);
    for (const page of all.pages) {
      expect(page.changed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(map).toContain(`<url><loc>${SITE}${page.path}</loc><lastmod>${page.changed}</lastmod>`);
    }
    // A page with a date of its own (the why page, the sizes) is never dated before the shell every page shares.
    expect(all.pages.every((p) => p.changed >= PAGES_CHANGED)).toBe(true);
    expect(all.pages.filter((p) => p.path === '/' || p.path.startsWith('/layouts/')).every((p) => p.changed === PAGES_CHANGED)).toBe(true);
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
      // No drawing in the page itself: the one `<svg>` is the identity line's mark.
      expect(page.html.replace(MARK, '')).not.toContain('<svg');
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
    // The drawings, without the identity line's mark.
    const drawings = [...list.replace(MARK, '').matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(drawings.length).toBe(built.pages.length);
    expect(drawings.flatMap((d) => d.match(/\d+\.\d{2,}/g) ?? [])).toEqual([]);
    expect(new TextEncoder().encode(list).length).toBeLessThan(150_000);
  });

  /*
   * WHY A LOOP WILL NOT CLOSE: three loops, each filed under the verdict the
   * solver gives it, each quoted in the verdict's own words (owner,
   * 2026-11-22). Nothing on the page about them is written by hand that the
   * engine can say.
   * Fails when:
   * - an example stops showing what it is filed under (the "bends" loop given
   *   two long straights, so it closes): `expected 'EXACT' to be 'NEEDS_GIVE'`;
   * - a verdict's sentence is typed into the page (`verdict.bend.line`
   *   replaced by `'Tight.'`): `to contain 'The planner says: <strong>This works. Closes exa…'`;
   * - a gap is typed in (`'{gap}'` replaced by `72` in an example's words):
   *   `to contain 'Now one side is 162 mm shorter'`, the "beyond" loop's own figure.
   */
  it('shows three loops on the why page, each with the verdict the solver gives it, in its words', () => {
    const page = htmls.find((p) => p.path === WHY_PATH)!.html;
    expect(EXAMPLES.map((e) => e.kind)).toEqual(['EXACT', 'NEEDS_GIVE', 'EXCEEDS']);
    for (const e of EXAMPLES) {
      const verdict = verdictOf(exampleGraph(e));
      expect(verdict.kind, e.id).toBe(e.kind);
      expect(page).toContain(`The planner says: <strong>${verdict.bend!.line}</strong>`);
      expect(page).toContain(`<h2>${e.heading}</h2>`);
    }
    // The solver's own gaps: a medium straight is 72 mm shorter than a long one, a mini one 162 mm.
    expect(verdictOf(exampleGraph(EXAMPLES[1]!)).gapMm).toBe(72);
    expect(page).toContain('One side is now 72 mm shorter');
    expect(page).toContain('Now one side is 162 mm shorter');
    expect(page).not.toContain('{gap}');
    // Three drawings, and the identity line's mark.
    expect((page.replace(MARK, '').match(/<svg /g) ?? []).length).toBe(3);
    expect(JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page)![1]!)['@type']).toBe('Article');
    // Other systems are named by what sets them apart, never by a maker (the brand-word spec walks this page too).
    expect(page).toContain('“Small-peg” and “Look-alike”');
  });

  /*
   * THE EXPLANATION LIVES ON ONE PAGE. It was three paragraphs repeated on
   * every layout page and the list, which a search engine reads as filler;
   * each now carries one line and a link.
   * Fails when: a layout page gets the paragraphs back (`EXPLANATION` mapped
   * into pageHtml again): `expected '<!doctype html>…' not to contain 'A loop is checked with exact arithme…'`.
   */
  it('keeps the explanation off the layout pages and the list, which link to the why page', () => {
    const others = htmls.filter((p) => p.path !== WHY_PATH);
    // The list, each layout and the page of sizes.
    expect(others.length).toBe(built.pages.length + 2);
    for (const { path, html } of others) {
      for (const paragraph of EXPLANATION) expect(html, path).not.toContain(paragraph);
      expect(html, path).toContain(`<a href="${WHY_PATH}">`);
    }
    expect(readFileSync(join(appDir, 'index.html'), 'utf8')).toContain(`<a href="${WHY_PATH}">`);
  });

  /*
   * THE PAGE OF SIZES LISTS EVERY PIECE ONCE, IN THE LIBRARY'S OWN FIGURES
   * (owner, 2026-11-22). The figures are worked out here a second way, from
   * the part records, never from the page's own lines.
   * Fails when:
   * - a kind is left out of the groups (the 'Buffer stops' group deleted):
   *   `expected [ 'A', 'A1', 'A2', 'A3', 'AT', …(66) ] to deeply equal [ 'A', 'A1', 'A2', 'A3', 'AT', …(68) ]`;
   * - a curve's radius is written to the inner edge under the centre's name
   *   (`centrelineRadiusMm(part)` to `part.innerRadiusMm` in `sizesOf`):
   *   `E: expected '182 mm radius, 45°' to contain '202 mm'`;
   * - a road is dropped (`part.roads.slice(1)` in `sizesOf`):
   *   `L: expected '202 mm radius, 45° curved road' to contain '144 mm'`;
   * - a row is built but not written (`g.rows.slice(1)` in `groupHtml`):
   *   `expected 64 to be 73`;
   * - the note that an S-bend's curve is approximate is dropped from its
   *   section (`...(bends ? […] : [])` to `[]`): `expected 'Each line is one
   *   road through the pie…' to contain 'approximate'`.
   */
  it('lists every built-in piece once on the page of sizes, each figure the library’s', () => {
    const page = htmls.find((p) => p.path === SIZES_PATH)!.html;
    const groups = sizeGroups();
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.map((r) => r.partId).sort()).toEqual(BUILT_IN.map((p) => p.id).sort());
    expect(page.split('<tr role="row"><th role="rowheader"').length - 1).toBe(BUILT_IN.length);
    const figuresOf = (p: Part): number[] => {
      if (p.kind === 'straight' || p.kind === 'buffer') return [p.lengthMm];
      if (p.kind === 'curve') return [p.innerRadiusMm + p.plankWidthMm / 2];
      if (p.kind === 'block') return [p.body[0]!.lengthMm, p.body[0]!.widthMm];
      return p.roads.flatMap((r) =>
        r.shape.kind === 'arc'
          ? [r.shape.innerRadiusMm + p.plankWidthMm / 2, ...(r.shape.leadMm ? [r.shape.leadMm] : [])]
          : r.shape.kind === 's-bend'
            ? [r.shape.lengthMm, Math.abs(r.shape.offsetMm)]
            : [r.shape.lengthMm],
      );
    };
    const anglesOf = (p: Part): number[] =>
      p.kind === 'curve' ? [p.arcSteps * 22.5] : p.kind === 'multi-road' ? p.roads.flatMap((r) => (r.shape.kind === 'arc' ? [r.shape.arcSteps * 22.5] : [])) : [];
    for (const part of BUILT_IN) {
      const row = rows.find((r) => r.partId === part.id)!;
      expect(page, part.id).toContain(rowHtml(row));
      const said = sizesOf(part).map(textOf).join(' | ');
      for (const n of figuresOf(part)) expect(said, part.id).toContain(`${n} mm`);
      for (const a of anglesOf(part)) expect(said, part.id).toContain(`${a}°`);
      expect(row.name).toBe(part.name);
    }
    // An S-bend's shape between its exact ends is drawn, not measured: said once, in its section's note.
    const bends = groups.filter((g) => g.rows.some((r) => r.sizes.some((l) => textOf(l).includes('S-bend'))));
    expect(bends.map((g) => g.heading)).toEqual(['Switches and crossings']);
    for (const g of bends) expect(textOf(g.note ?? [])).toContain('approximate');
  });

  /*
   * EACH ROW CARRIES THE PALETTE'S MARK, AND A PIECE TAKEN FROM A PRINTABLE
   * DESIGN KEEPS ITS CREDIT (AGENTS.md "Names and sources"; design review
   * D16, D18): the credit and link once under "Printable models", a marker in
   * the row, and no link anywhere else in a row.
   * Fails when:
   * - the two lesser marks are swapped (`'Unverified' : 'Published'` to
   *   `'Published' : 'Unverified'` in `markOf`): `A2: expected 'Unverified' to be 'Published'`;
   * - the measured tick is not read (`isMeasured(part) ?` taken out of
   *   `markOf`): `A: expected 'Published' to be 'Measured'`;
   * - the tick is left off a measured row (`${TICK} ` cut from `markHtml`):
   *   `A: expected '<tr role="row"><th role="rowheader" s…' to contain 'class="mark is-measured"><svg class="…'`;
   * - a model's pieces lose their entry (`held.pieces.push(r)` removed from
   *   `modelsHtml`): `N: expected '<li><a href="https://makerworld.com/e…' to contain 'Ramp <span class="code num">N</span>'`;
   * - the row's marker is dropped (`if (r.origin) lines.push(…)` removed):
   *   `N: expected '<tr role="row"><th role="rowheader" s…' to contain 'href="#printable-models"'`;
   * - a row prints the library's id in place of the card's code (`code:
   *   part.id` in `rowOf`): the list of such codes is no longer empty (17
   *   of them), and the brand-word pin fails with it.
   */
  it('marks each size measured, published or unverified, and credits the printable designs once', () => {
    const rows = sizeGroups().flatMap((g) => g.rows);
    const models = modelsHtml(rows).split('\n').filter((l) => l.startsWith('<li>'));
    const seen = new Set<string>();
    for (const part of BUILT_IN) {
      const row = rows.find((r) => r.partId === part.id)!;
      const want = isMeasured(part) ? 'Measured' : part.dimensions.status === 'unverified' ? 'Unverified' : 'Published';
      expect(markOf(part), part.id).toBe(want);
      expect(rowHtml(row), part.id).toContain(`class="mark is-${want.toLowerCase()}">${want === 'Measured' ? `${TICK} ` : ''}${want}</td>`);
      seen.add(want);
      const origin = PART_ORIGINS[part.id];
      if (origin) {
        expect(rowHtml(row), part.id).toContain(`href="#${MODELS_ID}"`);
        const entry = models.find((l) => l.includes(`href="https://makerworld.com/en/models/${origin.modelId}"`)) ?? '';
        expect(entry, part.id).toContain(`Model by ${origin.creator} on ${origin.site}</a>`);
        expect(entry, part.id).toContain(`${part.name} <span class="code num">${row.code}</span>`);
      } else expect(rowHtml(row), part.id).not.toContain('href=');
      // A row itself never links off the site.
      expect(rowHtml(row), part.id).not.toContain('https://');
    }
    expect([...seen].sort()).toEqual(['Measured', 'Published', 'Unverified']);
    // No row prints an id that spells its system: the code is the palette's.
    const prefixes = (Object.keys(SYSTEM_NAME) as Brand[]).map((b) => `${b}-`);
    expect(rows.map((r) => r.code).filter((c) => prefixes.some((x) => c.startsWith(x)))).toEqual([]);
    expect(BUILT_IN.some((p) => prefixes.some((x) => p.id.startsWith(x)))).toBe(true);
  });

  /*
   * THE READER CAME FOR ONE NUMBER (design review 2026-11-24, D3, D4, D5, D8,
   * D9): the tables come before the explanation, every section can be jumped
   * to, a kind runs shortest first, and a length says what it is measured
   * between.
   * Fails when:
   * - the tables go back after the explanation (`groups.map(groupHtml)` moved
   *   to follow the "About these sizes" block): `expected 14328 to be less
   *   than 13369`, the first table now starting after the key to the marks;
   * - a section loses its address (`id="${g.id}"` cut from the `<h2>`):
   *   `straights: expected '<!doctype html>…' to contain '<h2 id="straights">'`;
   * - the rows keep the library's order (`bySize(parts)` to `[...parts]` in
   *   `group`): `Straights: expected [ 54, 108, 144, 216, 72, 54, 54, …(4) ] to deeply equal [ 54, 54, 54, 72, 108, 108, 108, …(4) ]`;
   * - the note on what a length is measured between is dropped
   *   (`[LENGTH_NOTE]` cut from the Straights group): `expected '' to contain 'A peg is not counted'`.
   */
  it('puts the figures first on the page of sizes, each section a jump away and shortest first', () => {
    const page = htmls.find((p) => p.path === SIZES_PATH)!.html;
    const groups = sizeGroups();
    expect(page.indexOf('<table')).toBeGreaterThan(0);
    expect(page.indexOf('<table')).toBeLessThan(page.indexOf('<strong>Measured</strong>'));
    expect(page.indexOf('<nav')).toBeLessThan(page.indexOf('<table'));
    for (const id of [...groups.map((g) => g.id), MODELS_ID, 'about-these-sizes']) {
      expect(page, id).toContain(`<li><a href="#${id}">`);
      expect(page, id).toContain(`<h2 id="${id}">`);
    }
    for (const g of groups) expect(page, g.id).toContain(`<table role="table" class="sizes" aria-labelledby="${g.id}">`);
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    // Shortest first within a kind: a straight by its length, a curve by its radius and then its angle.
    for (const g of groups) {
      const parts = g.rows.map((r) => resolve(r.partId));
      const lengths = parts.flatMap((p) => (p.kind === 'straight' ? [p.lengthMm] : []));
      expect(lengths, g.heading).toEqual([...lengths].sort((a, b) => a - b));
      const curves = parts.flatMap((p) => (p.kind === 'curve' ? [p.innerRadiusMm * 1000 + p.arcSteps] : []));
      expect(curves, g.heading).toEqual([...curves].sort((a, b) => a - b));
    }
    expect(groups.find((g) => g.heading === 'Straights')!.rows.length).toBeGreaterThan(5);
    expect(textOf(groups.find((g) => g.heading === 'Straights')!.note ?? [])).toContain('A peg is not counted');
    // The plank's half width, as the Curves note says it, and the count of curves in a circle.
    expect(textOf(groups.find((g) => g.heading === 'Curves')!.note ?? [])).toContain(`${resolve('E').plankWidthMm / 2} mm less. 8 curves of 45° make a full circle.`);
    // Where "Unverified" is explained, a reader with the piece is shown how to photograph it; the guide is a page of the site.
    expect(page).toContain('<a href="/photo-guide.html">');
    expect(readFileSync(join(appDir, 'photo-guide.html'), 'utf8')).toContain('<h1>');
  });

  /*
   * EVERY FIGURE IS SET AS A MEASUREMENT, UNIT AND ALL (DESIGN.md rule 4;
   * design review D12, D13), and a piece's angle is written as its name
   * writes it.
   * Fails when:
   * - a figure is written as plain words (`lineHtml` returning `esc(b.num)`
   *   for a figure): `expected [ '54 mm', '54 mm', '54 mm', …(127) ] to deeply equal []`;
   * - an angle is given a decimal it does not have (`${steps * 22.5}°` to
   *   `${(steps * 22.5).toFixed(1)}°`): `expected '<main class="page">…' to contain '<span class="num">45°</span>'`,
   *   and the first pin's `E: expected '202 mm radius, 45.0°' to contain '45°'`.
   */
  it('sets every figure on the page of sizes in the measurement face, with its unit', () => {
    const page = htmls.find((p) => p.path === SIZES_PATH)!.html;
    const body = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    // A piece's name is a name, not a measurement, wherever it appears ("Small-peg curve, 22.5°").
    const names = BUILT_IN.map((p) => p.name).sort((a, b) => b.length - a.length);
    const unnamed = names.reduce((text, name) => text.split(name).join(''), body);
    const loose = unnamed.replace(/<span class="num">[^<]*<\/span>/g, '').match(/\d[\d.]*\s?(mm|°)/g) ?? [];
    expect(loose).toEqual([]);
    expect(body).toContain('<span class="num">144 mm</span>');
    expect(body).toContain('<span class="num">45°</span>');
    expect(page).not.toContain('45.0°');
  });

  /*
   * THE DATE A READER SEES IS NEVER OLDER THAN THE FIGURES (design review
   * D10). `SIZES_DIGEST` is the rows as they stood on `SIZES_CHANGED`.
   *
   * WHEN THIS FAILS because a piece was added or a size corrected: set
   * `SIZES_CHANGED` in pages/sizesPage.ts to today, and `SIZES_DIGEST` to
   * the "received" value this prints.
   * Fails when: any row changes without the date (the long straight given
   * 217mm in engine/data/generic.ts): `expected '…' to be '…'`, two digests.
   */
  it('shows the date the sizes last changed, and holds it to the rows', () => {
    const page = htmls.find((p) => p.path === SIZES_PATH)!.html;
    expect(createHash('sha256').update(rowsForDigest()).digest('hex').slice(0, 16)).toBe(SIZES_DIGEST);
    expect(SIZES_CHANGED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [y, m, d] = SIZES_CHANGED.split('-').map(Number);
    const words = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    expect(page).toContain(`Sizes last changed <time datetime="${SIZES_CHANGED}">${words}</time>.`);
    expect(page).toContain(`"dateModified":"${SIZES_CHANGED}"`);
  });

  /*
   * WHAT EVERY STATIC PAGE WEARS (DESIGN.md rules 9, 10 and 15; design review
   * D6, D7, D14, D15, D17): the planner's mark, drawn as the planner draws
   * it; a visited link in the soft ink; a 44px tap area on a touch screen;
   * and a table of sizes that stacks on a phone without shrinking its type.
   * The stylesheet is read as text (CLAUDE.md): it proves the rule, not the pixel.
   * Fails when:
   * - the page's mark drifts from the planner's (a figure changed in `MARK`
   *   in shell.ts): `expected '<svg class="app-name-mark" width="18"…' to be '<svg class="app-name-mark" width="18"…'`;
   * - the mark is left off the identity line (`${MARK}` cut from `shell`):
   *   `/layouts/: expected +0 to be 1`;
   * - a visited link keeps the full ink (`a:visited` rule removed): `expected null not to be null`;
   * - the touch floor is dropped (`min-height: 44px` cut from the coarse
   *   pointer block): `expected '…' to match /min-height:\s*44px/`;
   * - the phone table shrinks its type again (`font-size: 0.875rem` put in
   *   the 30rem block): `expected '…' not to match /font-size/`;
   * - the jump list wraps on a phone again (its `flex-wrap: nowrap` rule cut
   *   from the 30rem block), pushing the first figure off the first screen:
   *   `expected '@media (max-width: 30rem) {…' to match /\.jump\s*\{\s*flex-wrap:\s*nowrap;\s*overflow-x:\s*auto/`.
   */
  it('gives every static page the planner’s mark, a visited ink, a touch floor and a table that stacks', () => {
    const drawn = /<svg[\s\S]*?<\/svg>/.exec(renderToStaticMarkup(createElement(AppName)))![0];
    expect(MARK).toBe(drawn);
    expect(TICK).toBe(renderToStaticMarkup(createElement(MeasuredTick)));
    for (const { path, html } of htmls) expect(html.split(`<div class="identity">${MARK}<a href="/">ChooChooCAD</a>`).length - 1, path).toBe(1);
    const page = htmls.find((p) => p.path === SIZES_PATH)!.html;
    const style = /<style>([\s\S]*?)<\/style>/.exec(page)![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
    /** The body of an `@media` block, to its closing brace at the start of a line. */
    const block = (query: string) => {
      const from = style.indexOf(`@media ${query} {`);
      expect(from, query).toBeGreaterThan(-1);
      return style.slice(from, style.indexOf('\n  }', from));
    };
    expect(/\n\s*a:visited\s*\{\s*color:\s*var\(--ink-soft\);\s*\}/.exec(style)).not.toBeNull();
    const touch = block('(pointer: coarse)');
    expect(touch).toMatch(/\n\s*a\s*\{\s*padding-block:\s*0\.85rem;\s*\}/);
    expect(touch).toMatch(/min-height:\s*44px/);
    const phone = block('(max-width: 30rem)');
    expect(phone).toMatch(/\.sizes tbody tr\s*\{\s*display:\s*grid/);
    expect(phone).not.toMatch(/font-size/);
    // The jump list is one line on a phone, so the first figure is on the first screen.
    expect(phone).toMatch(/\.jump\s*\{\s*flex-wrap:\s*nowrap;\s*overflow-x:\s*auto/);
    const print = block('print');
    expect(print).toMatch(/\.jump, \.also, \.open\s*\{\s*display:\s*none/);
    expect(print).toMatch(/\.sizes tr\s*\{\s*break-inside:\s*avoid/);
  });

  /*
   * THE PAGE OF SIZES CAN BE REACHED: the list, the why page and the home
   * page's no-script text each link to it.
   * Fails when: the link is taken off the list page (`<a href="${SIZES_PATH}">…</a>`
   * cut from listHtml): `/layouts/: expected '<!doctype html>…' to contain '<a href="/sizes/">'`.
   */
  it('links to the page of sizes from the list, the why page and the home page', () => {
    for (const path of ['/layouts/', WHY_PATH]) expect(htmls.find((p) => p.path === path)!.html, path).toContain(`<a href="${SIZES_PATH}">`);
    expect(readFileSync(join(appDir, 'index.html'), 'utf8')).toContain(`<a href="${SIZES_PATH}">`);
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
