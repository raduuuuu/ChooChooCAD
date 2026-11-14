import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandWords, TERMS } from '../../engine/data/brandWords.js';
import { solveLayout } from '../../engine/src/solver/result.js';
import { EXPLANATION, HOME_DESCRIPTION, HOME_TITLE, layoutPages, sitemap, SITE } from './layoutPages.js';
import { PRESETS, presetLayout } from './presets.js';
import { decodeLink } from './shareLink.js';

/*
 * THE PAGES A SEARCH ENGINE READS (plan 2026-11-14, E1). Each pin names the
 * change that makes it fail, and each was run (CLAUDE.md).
 */

const resolve = makeResolver(BUILT_IN);
const built = await layoutPages();
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * Which ready layouts close, from a SECOND witness: the chain solver, which
 * `layoutPages.ts` never calls (it asks the graph solver through `viewOf`).
 */
const closing = PRESETS.filter((p) => {
  const r = solveLayout(presetLayout(p), resolve);
  return r.ok && r.gapMm === 0;
});

describe('layout pages', () => {
  /*
   * Fails when: the `if (!closesExactly(graph)) continue;` line in
   * layoutPages.ts is deleted. Near miss then gets a page saying it "closes
   * exactly", and this reports three slugs where two are expected.
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
   * in layoutPages): the decoded pieces are then none.
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
    const text = [built.index, ...built.pages.map((p) => p.html), ...EXPLANATION, HOME_TITLE, HOME_DESCRIPTION].join('\n');
    expect(brandWords(text)).toEqual([]);
    expect(brandWords(`${text}\n${TERMS[0]}`)).toHaveLength(1);
  });

  /*
   * Fails when: HOME_TITLE or HOME_DESCRIPTION is edited without app/index.html
   * (or the other way round). The home page is a hand-written file, so this is
   * what keeps its words and the pages' the same.
   */
  it('keeps the home page saying what the pages say', () => {
    const home = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8');
    expect(home).toContain(`<title>${HOME_TITLE}</title>`);
    expect(home).toContain(`<meta name="description" content="${HOME_DESCRIPTION}" />`);
    expect(home).toContain(`<meta property="og:title" content="${HOME_TITLE}" />`);
    expect(home).toContain(`<meta property="og:description" content="${HOME_DESCRIPTION}" />`);
    expect(home).toContain('<a href="/layouts/">');
  });

  /*
   * Fails when: a page is left out of the sitemap (drop `...pages.map(...)`
   * from `sitemap`), or robots.txt stops naming it.
   */
  it('lists every page in the sitemap, and robots.txt names the sitemap', () => {
    const map = sitemap(built.pages);
    for (const path of ['/', '/layouts/', ...built.pages.map((p) => `/layouts/${p.slug}.html`)]) {
      expect(map).toContain(`<loc>${SITE}${path}</loc>`);
    }
    const robots = readFileSync(join(import.meta.dirname, '..', 'public', 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
