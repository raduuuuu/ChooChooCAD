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
 *
 * WHAT ONLY THIS SITE CAN SAY ABOUT A LAYOUT (owner, 2026-11-22): its size on
 * the floor, from the engine's own placement, and its pieces counted by
 * kind. No "fits a table" sentence: no table size is anyone's but the
 * reader's, and the planner checks theirs.
 *
 * THE PICTURE is a file of its own (`/layouts/<slug>.svg`, written by the
 * build), not a drawing inside the page: a search engine lists picture
 * files, not markup. The picture a pasted link shows is a PNG beside it,
 * drawn by hand with `scripts/ogImage.ts` and committed.
 */

import type { Graph } from '../../../engine/src/graph/model.js';
import { CATALOGUE_SIZES } from '../linkWords.js';
import { PRESETS } from '../presets.js';
import { closesExactly, presetGraph } from '../presetVerdict.js';
import { encodeLink } from '../shareLink.js';
import { cmUp, trackExtent } from '../tableModel.js';
import { draw, drawing, renderOf, resolve, type Colours } from './drawing.js';
import { esc, shell, SITE } from './shell.js';
import { WHY_PATH } from './whyPage.js';

export interface LayoutPage {
  /** The file name without its extension, and the last part of the address. */
  readonly slug: string;
  readonly label: string;
  /** Part id to how many the layout uses, in first-use order. */
  readonly pieces: ReadonlyMap<string, number>;
  readonly pieceCount: number;
  /** The link that opens this layout in the app, from its `#`. */
  readonly fragment: string;
  /** The layout as inline SVG, for the list. */
  readonly drawing: string;
  /** Its picture file: a drawing that stands alone, on the floor's colour. */
  readonly picture: string;
  /** Its size on the floor in whole centimetres, rounded up, longer side first. */
  readonly floorCm: readonly [number, number];
  /** Its pieces counted by kind, in the words the page uses, most first. */
  readonly kinds: readonly (readonly [string, number])[];
  readonly html: string;
}

/** The address of a layout's picture file, and of the picture a pasted link shows. */
export const picturePath = (slug: string) => `/layouts/${slug}.svg`;
export const previewPath = (slug: string) => `/layouts/${slug}.png`;

/** What a page says the picture shows; the picture's own words, for a reader who cannot see it. */
export const pictureAlt = (label: string, count: number) => `${label}: a ${count}-piece loop of wooden train track, seen from overhead`;

/** A kind of piece in a count: one, and several. A ramp or a bridge is a straight piece that climbs. */
const KIND_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  curve: ['curve', 'curves'],
  straight: ['straight piece', 'straight pieces'],
  'multi-road': ['switch or crossing', 'switches and crossings'],
  buffer: ['buffer', 'buffers'],
  block: ['block', 'blocks'],
};

/** The pieces counted by kind, the most numerous first; a tie keeps first-use order. */
export function kindsOf(graph: Graph): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const p of graph.pieces) {
    const kind = resolve(p.partId).kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => [KIND_WORDS[kind]![n === 1 ? 0 : 1], n] as const);
}

/** "8 curves and 2 straight pieces". */
const kindsText = (kinds: readonly (readonly [string, number])[]) => {
  const parts = kinds.map(([word, n]) => `<span class="num">${n}</span> ${word}`);
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)!}`;
};

/** The layout's size on the floor, plank edges included, in whole centimetres rounded up, longer side first. */
export function floorCmOf(graph: Graph): readonly [number, number] {
  const extent = trackExtent(renderOf(graph).segments, (id) => resolve(id).plankWidthMm / 2);
  if (extent === null) throw new Error('a layout with no track has no size');
  const sides = [cmUp(extent.maxX - extent.minX), cmUp(extent.maxY - extent.minY)].sort((a, b) => b - a);
  return [sides[0]!, sides[1]!];
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

interface Facts {
  readonly pieces: ReadonlyMap<string, number>;
  readonly fragment: string;
  /** The picture's shape, so the page holds its place before it loads. */
  readonly shape: readonly [number, number];
  readonly floorCm: readonly [number, number];
  readonly kinds: readonly (readonly [string, number])[];
}

function pageHtml(label: string, slug: string, graph: Graph, { pieces, fragment, shape, floorCm, kinds }: Facts): string {
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
<div class="floor"><img src="${picturePath(slug)}" alt="${esc(pictureAlt(label, count))}" width="${shape[0]}" height="${shape[1]}"></div>
<p>On the floor it is <span class="num">${floorCm[0]} × ${floorCm[1]}</span> cm: ${kindsText(kinds)}. Open it in the planner to check it against your own table.</p>
<h2>The pieces it takes</h2>
<ul>
${rows}
</ul>
<p class="note">${esc(CATALOGUE_SIZES)}</p>
<p><a class="open" href="/${fragment}">Open this layout in the planner</a></p>
<h2>What checked it</h2>
<p>ChooChooCAD checked this loop with exact arithmetic, not by eye. <a href="${WHY_PATH}">Why a loop closes, and why one will not</a>.</p>
<p><a href="./">More layouts that close</a></p>`,
    breadcrumbs(label, slug),
    { path: previewPath(slug), alt: pictureAlt(label, count) },
  );
}

/**
 * A page for every ready layout that closes, in the order the app offers them.
 * `fileColours` are the colours as values, for the picture files (the script
 * and the tests read them from `tokens.css`).
 */
export async function layoutPages(fileColours: Colours): Promise<readonly LayoutPage[]> {
  const pages: LayoutPage[] = [];
  for (const preset of PRESETS) {
    const graph = presetGraph(preset);
    if (!closesExactly(graph)) continue;
    const slug = slugOf(preset.label);
    const pieces = new Map<string, number>();
    for (const p of graph.pieces) pieces.set(p.partId, (pieces.get(p.partId) ?? 0) + 1);
    const fragment = await encodeLink(graph);
    const picture = draw(graph, `${preset.label}, a ${graph.pieces.length}-piece loop of wooden train track`, fileColours, { ground: true });
    const floorCm = floorCmOf(graph);
    const kinds = kindsOf(graph);
    pages.push({
      slug,
      label: preset.label,
      pieces,
      pieceCount: graph.pieces.length,
      fragment,
      drawing: drawing(graph, preset.label),
      picture: picture.svg,
      floorCm,
      kinds,
      html: pageHtml(preset.label, slug, graph, {
        pieces,
        fragment,
        shape: [Math.round(picture.widthMm), Math.round(picture.heightMm)],
        floorCm,
        kinds,
      }),
    });
  }
  return pages;
}
