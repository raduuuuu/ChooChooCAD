/**
 * WHAT EVERY STATIC PAGE SHARES (owner, 2026-11-22): the head,
 * the identity line, the look, the visit counter and the words about the app.
 *
 *   a page kind ──▶ shell(title, description, path, body, data?) ──▶ one HTML file
 *
 * The counter (owner, 2026-11-22: "Count the static pages too") is the
 * same reviewed script the editor loads (`app/public/count.js`), as a plain
 * tag: a static page has no layout in its address to keep back, so it sets
 * no path of its own, and the script itself sends nothing from a local
 * address. README, "What the site sends", says what a visit carries.
 *
 * No React and no file access here, so the tests need no DOM.
 */

import { counterTag, GOATCOUNTER_CODE } from '../linkFragment.js';

/** Where the site lives. The CNAME in `app/public/` says the same. */
export const SITE = 'https://woodentrain.world';

/**
 * When what every page says last changed, as the sitemap's date.
 * A WRITTEN date, never the build's: every merge deploys, and a date
 * that moves on every deploy tells a search engine nothing. Raise it in the
 * pull request that changes the words or the markup of every page.
 */
export const PAGES_CHANGED = '2026-11-22';

/** The home page's title and description (`app/index.html` carries the same words; the test compares them). */
export const HOME_TITLE = 'ChooChooCAD: will your wooden train track layout close?';
export const HOME_DESCRIPTION =
  'A free planner for wooden toy-train track. Lay out the pieces and it says whether the loop closes, before you build it on the floor.';

/** What the app is, in words a page can carry with no script. One copy, used by every page. */
export const EXPLANATION: readonly string[] = [
  'ChooChooCAD is a free planner for wooden toy-train track. You lay pieces out on a canvas, and on every change it says whether the layout will work: whether each loop closes, whether it closes only by using the play in the joints, and whether any track overlaps.',
  'A loop is checked with exact arithmetic, not by eye. "Closes exactly" means the two ends meet with nothing to force, in the piece sizes the check used. When a size has not been measured, the app says so.',
  'It also handles ramps and bridges, counts the pieces you own, shows the layout in 3D, and steps through the build piece by piece.',
];

export const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const explanation = () => EXPLANATION.map((p) => `<p>${esc(p)}</p>`).join('\n');

/**
 * Structured data for a search engine (schema.org, as JSON-LD). Serialised,
 * never pasted, and `<` written as an escape so no name can close the tag.
 */
export const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** The home page's structured data: the app, as a free web application. `app/index.html` carries the same tag. */
export const HOME_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'ChooChooCAD',
  url: `${SITE}/`,
  description: HOME_DESCRIPTION,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any',
  isAccessibleForFree: true,
} as const;

/** The counter's tag, or nothing when there is no site code. */
function counter(): string {
  const tag = counterTag(GOATCOUNTER_CODE, true);
  return tag ? `<script data-goatcounter="${esc(tag.endpoint)}" async src="${tag.src}"></script>\n` : '';
}

const STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 1rem/1.5 var(--font-ui); }
  /* The column is on .page, not body: the built stylesheet lands after this block and resets body's margin. */
  .page { margin: 0 auto; max-width: 44rem; padding: 1.5rem 1rem 3rem; }
  .identity { display: flex; gap: 0.6rem; align-items: baseline; margin-bottom: 2rem; }
  .identity a { color: inherit; font-weight: 600; text-decoration: none; }
  .identity span { color: var(--ink-soft); }
  h1 { font-size: 1.6rem; line-height: 1.25; font-weight: 600; margin: 0 0 0.75rem; }
  h2 { font-size: 1.1rem; font-weight: 600; margin: 2rem 0 0.5rem; }
  p, li { margin: 0 0 0.6rem; }
  ul { padding-left: 1.2rem; margin: 0 0 1rem; }
  a { color: var(--ink); }
  .num { font-family: var(--font-data); font-variant-numeric: tabular-nums; }
  .floor { background: var(--floor); border: 1px solid var(--rule); padding: 1rem; margin: 1rem 0; }
  .floor svg { display: block; width: 100%; height: auto; max-height: 22rem; }
  .open { display: inline-block; min-height: 44px; padding: 0.6rem 1rem; border: 1px solid var(--ink); text-decoration: none; font-weight: 600; }
  .note { color: var(--ink-soft); }
  .list { list-style: none; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
  .list a { display: block; }
`;

export function shell(title: string, description: string, path: string, body: string, data?: unknown): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ChooChooCAD">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og.png">
<link rel="stylesheet" href="../src/tokens.css">
<style>${STYLE}</style>
${data === undefined ? '' : `${jsonLd(data)}\n`}</head>
<body>
<main class="page">
<div class="identity"><a href="/">ChooChooCAD</a><span>wooden railway layouts</span></div>
${body}
</main>
${counter()}</body>
</html>
`;
}
