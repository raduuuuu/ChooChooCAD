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
 * A SECOND SOURCE (owner, 2026-11-22): layouts built by hand and frozen as
 * links (`frozenLayouts.ts`), for the shapes a chain of pieces cannot be: a
 * figure eight, a siding, a bridge over a second loop. They go through the
 * same gate and one more, `refusal`: nothing loose, nothing open, no raised
 * track whose supports nobody checked, and only pieces a page may rest on.
 *
 * WHAT A PAGE OWES ITS READER BEYOND "IT CLOSES" (owner, 2026-11-22):
 * - a piece nobody has measured is marked in the list, and the page says
 *   what the check rested on in the app's own words (`sizesLine`);
 * - the count is track only; a joint where two sockets meet needs a
 *   male-male adapter, said beside the count and in the list;
 * - a block that holds raised track is listed with the pieces.
 *
 * THE PICTURE is a file of its own (`/layouts/<slug>.svg`, written by the
 * build), not a drawing inside the page: a search engine lists picture
 * files, not markup. The picture a pasted link shows is a PNG beside it,
 * drawn by hand with `scripts/ogImage.ts` and committed.
 */

import { BUILT_IN } from '../../../engine/data/library.js';
import { STRUCTURE_WORDS } from '../../../engine/data/structureSeeds.js';
import type { Graph } from '../../../engine/src/graph/model.js';
import { isUnverified, shortCode, type Part } from '../../../engine/src/parts/schema.js';
import { FROZEN_LAYOUTS, NOT_FOR_PAGES } from '../frozenLayouts.js';
import { sizesLine } from '../linkWords.js';
import { PRESETS } from '../presets.js';
import { presetGraph, verdictOf } from '../presetVerdict.js';
import { decodeLink, encodeLink } from '../shareLink.js';
import { cmUp, trackExtent } from '../tableModel.js';
import { draw, drawing, renderOf, resolve, type Colours } from './drawing.js';
import { esc, PAGES_CHANGED, shell, SITE } from './shell.js';
import { WHY_PATH } from './whyPage.js';

export interface LayoutPage {
  /** The file name without its extension, and the last part of the address. */
  readonly slug: string;
  readonly label: string;
  /** Where it comes from: one of the app's ready layouts, or a layout frozen as a link. */
  readonly source: 'preset' | 'frozen';
  /** When what it shows last changed, for the sitemap. */
  readonly changed: string;
  /** Part id to how many the layout uses, in first-use order. */
  readonly pieces: ReadonlyMap<string, number>;
  /** Its pieces of track and wood. An adapter is not one (owner, 2026-11-22). */
  readonly pieceCount: number;
  /** Joints where two sockets meet, each needing a male-male adapter. */
  readonly adapters: number;
  /** Placed pieces whose size nobody has measured, counting repeats, as the verdict counts them. */
  readonly unmeasured: number;
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

/** "a 10-piece", "an 8-piece": the count as it is said, with its article. */
export const aCount = (n: number) => `${/^(8|11|18)/.test(String(n)) ? 'an' : 'a'} ${n}-piece`;

/** What a page says the picture shows; the picture's own words, for a reader who cannot see it. */
export const pictureAlt = (label: string, count: number, shape: 'loop' | 'layout' = 'loop') =>
  `${label}: ${aCount(count)} ${shape} of wooden train track, seen from overhead`;

/**
 * WHAT A PIECE IS CALLED IN A COUNT: one, and several. A structure keeps the
 * word the app's sentences use for it; a piece with several roads is a
 * switch when roads share a heel, a crossing when they are all straight, and
 * otherwise a double curve; a built piece is named by the last word of its
 * own name when that is a kind of building.
 */
const plural = (word: string) => (word.endsWith('s') ? word : word.endsWith('ch') ? `${word}es` : `${word}s`);
const BUILDINGS: readonly string[] = ['station', 'bridge', 'tunnel'];
export function kindWord(part: Part): string {
  const structure = STRUCTURE_WORDS[part.id]?.word;
  if (structure) return structure;
  if (part.kind === 'curve') return 'curve';
  if (part.kind === 'buffer') return 'buffer';
  if (part.kind === 'block') return 'block';
  if (part.kind === 'multi-road') {
    if (part.ports.some((p) => p.kind === 'heel')) return 'switch';
    return part.roads.every((r) => r.shape.kind === 'straight') ? 'crossing' : 'double curve';
  }
  const last = part.name.toLowerCase().split(/\s+/).at(-1)!;
  return part.decoratedFrom === undefined && part.decor !== undefined && BUILDINGS.includes(last) ? last : 'straight piece';
}

/** The pieces counted by kind, the most numerous first; a tie keeps first-use order. */
export function kindsOf(graph: Graph): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const p of graph.pieces) {
    const kind = kindWord(resolve(p.partId));
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => [n === 1 ? kind : plural(kind), n] as const);
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

const BUILT_IN_IDS: ReadonlySet<string> = new Set(BUILT_IN.map((p) => p.id));

/**
 * WHY A LAYOUT GETS NO PAGE, or null when it may have one. A page says the
 * layout closes and lists what it takes, so every way that sentence or that
 * list could mislead is a refusal (owner, 2026-11-22):
 *
 *   the verdict is not EXACT      it does not close with nothing to force
 *   an end is left free           track that goes nowhere, even off a loop that closes
 *   a run is open                 the same, for a run with no loop in it
 *   raised track, supports unread the check cannot say it is held up, so the list of pieces may be short
 *   a piece no page may rest on   `NOT_FOR_PAGES`, or a piece the library does not hold
 */
export function refusal(graph: Graph): string | null {
  const view = verdictOf(graph);
  if (view.kind !== 'EXACT') return `the verdict is ${view.kind}`;
  if (view.openRuns > 0) return 'a run of track is open';
  if (renderOf(graph).ports.some((p) => p.free)) return 'an end is left free';
  if (view.raised) return 'raised track whose supports are not checked';
  const barred = graph.pieces.find((p) => NOT_FOR_PAGES.includes(p.partId) || !BUILT_IN_IDS.has(p.partId));
  return barred ? `it uses ${barred.partId}, which no page may rest on` : null;
}

/** A layout a page can be made from, whichever list it came from. */
export interface Source {
  readonly label: string;
  readonly slug: string;
  readonly source: 'preset' | 'frozen';
  readonly changed: string;
  /** What it is, in a sentence, when it is more than a loop. */
  readonly note?: string;
  readonly graph: Graph;
  readonly fragment: string;
}

/** "3 male-male adapters". */
const adapterWords = (n: number) => `<span class="num">${n}</span> male-male ${n === 1 ? 'adapter' : 'adapters'}`;

function pageHtml(src: Source, page: Omit<LayoutPage, 'html'>, shape: readonly [number, number]): string {
  const { label, slug } = src;
  const count = page.pieceCount;
  // A chain from the app's own list is one loop; a frozen layout may be several, or a loop with a spur.
  const what = src.source === 'preset' ? 'loop' : 'layout';
  const exact = page.unmeasured === 0;
  const rows = [
    ...[...page.pieces].map(([id, n]) => {
      const part = resolve(id);
      return `<li><span class="num">${n}</span> × ${esc(part.name)} (<span class="num">${esc(shortCode(part))}</span>)${isUnverified(part) ? ' <span class="unmeasured">*</span>' : ''}</li>`;
    }),
    ...(page.adapters > 0 ? [`<li>${adapterWords(page.adapters)}, where two sockets meet</li>`] : []),
  ].join('\n');
  const plus = page.adapters > 0 ? `, plus ${adapterWords(page.adapters)}` : '';
  const title = `${label}: ${aCount(count)} wooden train track layout that closes | ChooChooCAD`;
  const closes = exact ? 'closes exactly' : 'closes';
  const description = `${label}: ${aCount(count)} wooden toy-train track ${what} that ${closes}${exact ? '' : ' in the planner’s check'}. See the pieces it takes and open it in the planner.`;
  const meets =
    what === 'loop'
      ? 'Its two ends meet with nothing to force.'
      : exact
        ? 'Every loop in it closes with nothing to force.'
        : 'Every loop in it closes with nothing to force, in the sizes the check used.';
  return shell(
    title,
    description,
    layoutPath(slug),
    `<h1>${esc(label)}: ${aCount(count)} wooden train track ${what} that ${closes}</h1>
<p>${src.note ? `${esc(src.note)} ` : ''}This layout takes <span class="num">${count}</span> pieces of wooden toy-train track${plus}. ${meets}</p>
<div class="floor"><img src="${picturePath(slug)}" alt="${esc(pictureAlt(label, count, what))}" width="${shape[0]}" height="${shape[1]}"></div>
<p>On the floor it is <span class="num">${page.floorCm[0]} × ${page.floorCm[1]}</span> cm: ${kindsText(page.kinds)}. Open it in the planner to check it against your own table.</p>
<h2>The pieces it takes</h2>
<ul>
${rows}
</ul>
${exact ? '' : '<p class="note"><span class="unmeasured">*</span> A size nobody has measured.</p>\n'}<p class="note">${esc(sizesLine(page.unmeasured, page.pieceCount))}</p>
<p><a class="open" href="/${page.fragment}">Open this layout in the planner</a></p>
<h2>What checked it</h2>
<p>ChooChooCAD checked this ${what} with exact arithmetic, not by eye. <a href="${WHY_PATH}">Why a loop closes, and why one will not</a>.</p>
<p><a href="./">More layouts that close</a></p>`,
    breadcrumbs(label, slug),
    { path: previewPath(slug), alt: pictureAlt(label, count, what) },
  );
}

/** The page for one layout. Asks nothing: `refusal` decides whether it is built. */
export function pageOf(src: Source, fileColours: Colours): LayoutPage {
  const { graph, label } = src;
  const what = src.source === 'preset' ? 'loop' : 'layout';
  const pieces = new Map<string, number>();
  for (const p of graph.pieces) pieces.set(p.partId, (pieces.get(p.partId) ?? 0) + 1);
  const picture = draw(graph, `${label}, ${aCount(graph.pieces.length)} ${what} of wooden train track`, fileColours, { ground: true });
  const page: Omit<LayoutPage, 'html'> = {
    slug: src.slug,
    label,
    source: src.source,
    changed: src.changed,
    pieces,
    pieceCount: graph.pieces.length,
    adapters: verdictOf(graph).adapterCount,
    unmeasured: graph.pieces.filter((p) => isUnverified(resolve(p.partId))).length,
    fragment: src.fragment,
    drawing: drawing(graph, label),
    picture: picture.svg,
    floorCm: floorCmOf(graph),
    kinds: kindsOf(graph),
  };
  return { ...page, html: pageHtml(src, page, [Math.round(picture.widthMm), Math.round(picture.heightMm)]) };
}

/** The app's ready layouts, each as the layout its button builds. */
async function presetSources(): Promise<Source[]> {
  const out: Source[] = [];
  for (const preset of PRESETS) {
    const graph = presetGraph(preset);
    out.push({ label: preset.label, slug: slugOf(preset.label), source: 'preset', changed: PAGES_CHANGED, graph, fragment: await encodeLink(graph) });
  }
  return out;
}

/** The frozen layouts, each opened from its link. A link that no longer opens stops the build, naming the layout. */
export async function frozenSources(): Promise<Source[]> {
  const out: Source[] = [];
  for (const f of FROZEN_LAYOUTS) {
    const read = await decodeLink(f.fragment);
    if (!read.ok) throw new Error(`the frozen layout "${f.slug}" no longer opens: ${read.reason}`);
    const changed = f.changed > PAGES_CHANGED ? f.changed : PAGES_CHANGED;
    out.push({ label: f.name, slug: f.slug, source: 'frozen', changed, note: f.note, graph: read.graph, fragment: f.fragment });
  }
  return out;
}

/**
 * A page for every ready layout that closes, in the order the app offers
 * them, then one for every frozen layout that may have one. `fileColours`
 * are the colours as values, for the picture files (the script and the tests
 * read them from `tokens.css`).
 */
export async function layoutPages(fileColours: Colours): Promise<readonly LayoutPage[]> {
  const sources = [...(await presetSources()), ...(await frozenSources())];
  const slugs = sources.map((s) => s.slug);
  const twice = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (twice !== undefined) throw new Error(`two layouts share the address "${twice}"`);
  return sources.filter((s) => refusal(s.graph) === null).map((s) => pageOf(s, fileColours));
}
