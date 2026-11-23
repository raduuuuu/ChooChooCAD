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
export const PAGES_CHANGED = '2026-11-23';

/** The page of sizes, here because the other kinds of page link to it. */
export const SIZES_PATH = '/sizes/';

/** The home page's title and description (`app/index.html` carries the same words; the test compares them). */
export const HOME_TITLE = 'ChooChooCAD: will your wooden train track layout close?';
export const HOME_DESCRIPTION =
  'A free planner for wooden toy-train track. Lay out the pieces and it says whether the loop closes, before you build it on the floor.';

/**
 * What the app is, in words a page can carry with no script. The home page's
 * no-script text and the why page open with the first; no layout or list
 * page repeats them (they link to the why page).
 */
export const EXPLANATION: readonly string[] = [
  'ChooChooCAD is a free planner for wooden toy-train track. You lay pieces out on a canvas, and on every change it says whether the layout will work: whether each loop closes, whether it closes only by using the play in the joints, and whether any track overlaps.',
  'A loop is checked with exact arithmetic, not by eye. "Closes exactly" means the two ends meet with nothing to force, in the piece sizes the check used. When a size has not been measured, the app says so.',
  'It also handles ramps and bridges, counts the pieces you own, shows the layout in 3D, and steps through the build piece by piece.',
];

export const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  .floor svg, .floor img { display: block; width: 100%; height: auto; max-height: 22rem; }
  .floor img { object-fit: contain; }
  .open { display: inline-block; min-height: 44px; padding: 0.6rem 1rem; border: 1px solid var(--ink); text-decoration: none; font-weight: 600; }
  .note { color: var(--ink-soft); }
  .list { list-style: none; padding: 0; display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
  .list a { display: block; }
  .sizes { width: 100%; border-collapse: collapse; margin: 0 0 1rem; }
  .sizes th, .sizes td { text-align: left; vertical-align: top; padding: 0.45rem 0.75rem 0.45rem 0; border-bottom: 1px solid var(--rule); }
  .sizes thead th { font-size: 0.85rem; font-weight: 600; color: var(--ink-soft); }
  .sizes tbody th { font-weight: 600; width: 36%; }
  .sizes td:last-child, .sizes th:last-child { width: 6.5rem; padding-right: 0; }
  .sizes .size { font-variant-numeric: tabular-nums; }
  .sizes .code { color: var(--ink-soft); font-weight: 400; }
  .sizes .credit { display: block; font-size: 0.85rem; font-weight: 400; }
  @media (max-width: 30rem) { .sizes { font-size: 0.875rem; } .sizes th, .sizes td { padding-right: 0.5rem; } .sizes tbody th { width: 34%; } .sizes td:last-child, .sizes th:last-child { width: 5.2rem; } }
`;

/** The picture a pasted link shows: 1200 by 630, as chats and social sites expect. */
export interface Preview {
  /** From the site's root. */
  readonly path: string;
  readonly alt: string;
}

/** The shared one, for a page with no picture of its own (`scripts/ogImage.ts` draws it). */
export const SITE_PREVIEW: Preview = { path: '/og.png', alt: 'A stadium-shaped loop of wooden track next to the ChooChooCAD name.' };

export function shell(title: string, description: string, path: string, body: string, data?: unknown, preview: Preview = SITE_PREVIEW): string {
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
<meta property="og:image" content="${SITE}${preview.path}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(preview.alt)}">
<meta name="twitter:card" content="summary_large_image">
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
