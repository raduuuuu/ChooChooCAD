/**
 * THE PAGES A SEARCH ENGINE CAN READ (plan 2026-11-14, E1, owner D1 and D6).
 *
 * The app is one page that is blank until its script runs, so nothing on the
 * web says what it answers. This builds plain HTML: one page per ready layout
 * that closes exactly, and a list of them with a short explanation. Written
 * into `app/layouts/` by `scripts/layoutPages.ts` before every build, so the
 * pages are made from the same `PRESETS` the app offers and cannot drift.
 *
 *   PRESETS ──▶ editorReducer 'preset' ──▶ graph ──▶ solveGraph ──▶ viewOf
 *                                            │                        │
 *                                            │              EXACT? ───┤ no: NO PAGE
 *                                            ▼                        ▼ yes
 *                                   encodeLink (opens in the app)   page + drawing
 *
 * WHICH LAYOUTS GET A PAGE is the verdict's answer, never a list of names: a
 * page says "closes exactly", and only `viewOf(...).kind === 'EXACT'` earns
 * that sentence. Near miss has no page because the solver says it misses.
 *
 * No React and no file access here, so the test needs no DOM.
 */

import { BUILT_IN, makeResolver } from '../../engine/data/library.js';
import { brandFit } from '../../engine/data/thirdParty.js';
import { placeAll } from '../../engine/src/graph/frames.js';
import { portsOf, type Graph, type Piece } from '../../engine/src/graph/model.js';
import { renderGraph } from '../../engine/src/graph/render.js';
import { solveGraph } from '../../engine/src/graph/solve.js';
import { initialEditor, reduce } from './editorReducer.js';
import { EMPTY_GRAPH } from './layoutModel.js';
import { CATALOGUE_SIZES } from './linkWords.js';
import { PRESETS, type Preset } from './presets.js';
import { encodeLink } from './shareLink.js';
import { seamLines, segmentPath } from './trackPath.js';
import { viewOf } from './verdictView.js';

/** Where the site lives. The CNAME in `app/public/` says the same. */
export const SITE = 'https://woodentrain.world';

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

export interface LayoutPage {
  /** The file name without its extension, and the last part of the address. */
  readonly slug: string;
  readonly label: string;
  /** Part id to how many the layout uses, in first-use order. */
  readonly pieces: ReadonlyMap<string, number>;
  readonly pieceCount: number;
  /** The link that opens this layout in the app, from its `#`. */
  readonly fragment: string;
  readonly html: string;
}

const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);

/** The layout a preset builds, through the same reducer step the app's button takes. */
export function presetGraph(preset: Preset): Graph {
  return reduce(initialEditor(EMPTY_GRAPH, ports), { kind: 'preset', ids: preset.pieces }, ports).graph;
}

/** The verdict's own answer for a layout, classified exactly as the screen does. */
export function closesExactly(graph: Graph): boolean {
  const placement = placeAll(graph, ports);
  const render = renderGraph(graph, ports, resolve, placement);
  const slop = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).slop.axialMm]));
  const result = solveGraph(
    graph,
    ports,
    resolve,
    (id: string) => slop.get(id) ?? 0,
    placement,
    { parts: BUILT_IN, brandFit },
    render.segments,
    render.bodies,
  );
  return viewOf(result).kind === 'EXACT';
}

const slugOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The track as an inline drawing, in the app's own colours (the tokens the page links). */
function drawing(graph: Graph, label: string): string {
  const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
  const part = resolve(graph.pieces[0]!.partId);
  const xs = render.segments.flatMap((s) => [s.from.x, s.to.x]);
  const ys = render.segments.flatMap((s) => [s.from.y, s.to.y]);
  // A curve bulges past its ends, so the frame takes a plank and a half all round.
  const pad = part.plankWidthMm * 1.5 + 40;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const edge = 1.2;
  const layers: { w: number; c: string }[] = [
    { w: part.plankWidthMm, c: '--track-edge' },
    { w: part.plankWidthMm - 2 * edge, c: '--track-fill' },
    ...(part.grooveWidthMm !== undefined
      ? [
          { w: part.gaugeWidthMm + part.grooveWidthMm, c: '--track-groove' },
          { w: part.gaugeWidthMm - part.grooveWidthMm, c: '--track-fill' },
        ]
      : []),
  ];
  const plankOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).plankWidthMm]));
  const seams = seamLines(graph.welds, render.ports, (id) => plankOf.get(id)!, new Set());
  const paths = render.segments.map(segmentPath);
  const strokes = layers
    .map((l) => paths.map((d) => `<path d="${d}" fill="none" style="stroke:var(${l.c})" stroke-width="${l.w}"/>`).join(''))
    .join('');
  const lines = seams
    .map((s) => `<line x1="${s.from[0]}" y1="${s.from[1]}" x2="${s.to[0]}" y2="${s.to[1]}" style="stroke:var(--seam)" stroke-width="2"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${esc(label)}: the track seen from straight overhead"><g transform="translate(0 ${y0 + y1}) scale(1 -1)">${strokes}${lines}</g></svg>`;
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

function shell(title: string, description: string, path: string, body: string): string {
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
</head>
<body>
<main class="page">
<div class="identity"><a href="/">ChooChooCAD</a><span>wooden railway layouts</span></div>
${body}
</main>
</body>
</html>
`;
}

const explanation = () => EXPLANATION.map((p) => `<p>${esc(p)}</p>`).join('\n');

function pageHtml(label: string, slug: string, graph: Graph, pieces: ReadonlyMap<string, number>, fragment: string): string {
  const count = graph.pieces.length;
  const rows = [...pieces]
    .map(([id, n]) => `<li><span class="num">${n}</span> × ${esc(resolve(id).name)} (<span class="num">${esc(id)}</span>)</li>`)
    .join('\n');
  const title = `${label}: a wooden train track layout that closes | ChooChooCAD`;
  const description = `${label}: ${count} pieces of wooden toy-train track in a loop that closes exactly. See the pieces it takes and open it in the planner.`;
  return shell(
    title,
    description,
    `/layouts/${slug}.html`,
    `<h1>${esc(label)}: a wooden train track loop that closes exactly</h1>
<p>This layout takes <span class="num">${count}</span> pieces of wooden toy-train track. Its two ends meet with nothing to force.</p>
<div class="floor">${drawing(graph, label)}</div>
<h2>The pieces it takes</h2>
<ul>
${rows}
</ul>
<p class="note">${esc(CATALOGUE_SIZES)}</p>
<p><a class="open" href="/${fragment}">Open this layout in the planner</a></p>
<h2>What checked it</h2>
${explanation()}
<p><a href="./">More layouts that close</a></p>`,
  );
}

function indexHtml(pages: readonly LayoutPage[], drawings: ReadonlyMap<string, string>): string {
  const items = pages
    .map(
      (p) =>
        `<li><a href="./${p.slug}.html"><div class="floor">${drawings.get(p.slug)!}</div>${esc(p.label)}, <span class="num">${p.pieceCount}</span> pieces</a></li>`,
    )
    .join('\n');
  return shell(
    'Wooden train track layouts that close | ChooChooCAD',
    'Wooden toy-train track layouts checked to close exactly, each with the pieces it takes. Open any of them in the planner and change it.',
    '/layouts/',
    `<h1>Wooden train track layouts that close</h1>
${explanation()}
<p><a class="open" href="/">Plan your own layout</a></p>
<h2>Ready layouts</h2>
<ul class="list">
${items}
</ul>`,
  );
}

/** Every page, the list first. `index` is the list's HTML; `pages` one per layout that closes. */
export async function layoutPages(): Promise<{ readonly index: string; readonly pages: readonly LayoutPage[] }> {
  const pages: LayoutPage[] = [];
  const drawings = new Map<string, string>();
  for (const preset of PRESETS) {
    const graph = presetGraph(preset);
    if (!closesExactly(graph)) continue;
    const slug = slugOf(preset.label);
    const pieces = new Map<string, number>();
    for (const p of graph.pieces) pieces.set(p.partId, (pieces.get(p.partId) ?? 0) + 1);
    const fragment = await encodeLink(graph);
    drawings.set(slug, drawing(graph, preset.label));
    pages.push({
      slug,
      label: preset.label,
      pieces,
      pieceCount: graph.pieces.length,
      fragment,
      html: pageHtml(preset.label, slug, graph, pieces, fragment),
    });
  }
  return { index: indexHtml(pages, drawings), pages };
}

/** The sitemap: the app, the list and every layout page. */
export function sitemap(pages: readonly LayoutPage[]): string {
  const urls = ['/', '/layouts/', ...pages.map((p) => `/layouts/${p.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`;
}
