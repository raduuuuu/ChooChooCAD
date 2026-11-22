/**
 * ONE PAGE PER READY LAYOUT THAT CLOSES (plan 2026-11-14, E1). Made from the same `PRESETS` the app offers, so a page cannot
 * drift from the layout it shows.
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
 * The piece count is in the title and the first heading in the words people
 * type ("a 10-piece layout"; owner, 2026-11-22).
 */

import type { Graph } from '../../../engine/src/graph/model.js';
import { CATALOGUE_SIZES } from '../linkWords.js';
import { PRESETS } from '../presets.js';
import { closesExactly, presetGraph } from '../presetVerdict.js';
import { encodeLink } from '../shareLink.js';
import { drawing, resolve } from './drawing.js';
import { esc, explanation, shell, SITE } from './shell.js';

export interface LayoutPage {
  /** The file name without its extension, and the last part of the address. */
  readonly slug: string;
  readonly label: string;
  /** Part id to how many the layout uses, in first-use order. */
  readonly pieces: ReadonlyMap<string, number>;
  readonly pieceCount: number;
  /** The link that opens this layout in the app, from its `#`. */
  readonly fragment: string;
  /** The layout as inline SVG, for the list as well. */
  readonly drawing: string;
  readonly html: string;
}

const slugOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The address of a layout's page, from the site's root. */
export const layoutPath = (slug: string) => `/layouts/${slug}.html`;

/** Where the page sits: the home page, the list, the layout. */
const breadcrumbs = (label: string, slug: string) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'ChooChooCAD', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Layouts that close', item: `${SITE}/layouts/` },
    { '@type': 'ListItem', position: 3, name: label, item: `${SITE}${layoutPath(slug)}` },
  ],
});

function pageHtml(label: string, slug: string, graph: Graph, pieces: ReadonlyMap<string, number>, fragment: string, svg: string): string {
  const count = graph.pieces.length;
  const rows = [...pieces]
    .map(([id, n]) => `<li><span class="num">${n}</span> × ${esc(resolve(id).name)} (<span class="num">${esc(id)}</span>)</li>`)
    .join('\n');
  const title = `${label}: a ${count}-piece wooden train track layout that closes | ChooChooCAD`;
  const description = `${label}: a ${count}-piece wooden toy-train track loop that closes exactly. See the pieces it takes and open it in the planner.`;
  return shell(
    title,
    description,
    layoutPath(slug),
    `<h1>${esc(label)}: a ${count}-piece wooden train track loop that closes exactly</h1>
<p>This layout takes <span class="num">${count}</span> pieces of wooden toy-train track. Its two ends meet with nothing to force.</p>
<div class="floor">${svg}</div>
<h2>The pieces it takes</h2>
<ul>
${rows}
</ul>
<p class="note">${esc(CATALOGUE_SIZES)}</p>
<p><a class="open" href="/${fragment}">Open this layout in the planner</a></p>
<h2>What checked it</h2>
${explanation()}
<p><a href="./">More layouts that close</a></p>`,
    breadcrumbs(label, slug),
  );
}

/** A page for every ready layout that closes, in the order the app offers them. */
export async function layoutPages(): Promise<readonly LayoutPage[]> {
  const pages: LayoutPage[] = [];
  for (const preset of PRESETS) {
    const graph = presetGraph(preset);
    if (!closesExactly(graph)) continue;
    const slug = slugOf(preset.label);
    const pieces = new Map<string, number>();
    for (const p of graph.pieces) pieces.set(p.partId, (pieces.get(p.partId) ?? 0) + 1);
    const fragment = await encodeLink(graph);
    const svg = drawing(graph, preset.label);
    pages.push({
      slug,
      label: preset.label,
      pieces,
      pieceCount: graph.pieces.length,
      fragment,
      drawing: svg,
      html: pageHtml(preset.label, slug, graph, pieces, fragment, svg),
    });
  }
  return pages;
}
