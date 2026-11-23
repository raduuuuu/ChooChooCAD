/**
 * THE SIZE OF EVERY PIECE (`/sizes/`; owner, 2026-11-22). The app holds a
 * table of piece sizes, each marked for how far it can be trusted, and until
 * this page it could only be read one card at a time inside the planner.
 *
 *   BUILT_IN ──▶ sizeGroups(): one row per piece, in the palette's order of kinds
 *                   │  sizes: a line per road, in the library's own figures
 *                   │  mark: the palette's three (measured, published, unverified)
 *                   │  origin: the printable model's credit, where the app shows one
 *                   └──▶ sizesHtml(): one table per group
 *
 * NOTHING HERE IS A FIGURE WRITTEN BY HAND: every number is read from the
 * library the checker uses, so the page cannot disagree with a verdict.
 *
 * WHAT A ROW NEVER SHOWS (AGENTS.md "Names and sources"): the internal part
 * id, since some old ids spell a maker's name (the code is the palette's
 * `shortCode`, which drops it), and where a figure came from, except the
 * credit and link of a piece taken from one printable design
 * (`engine/data/origins.ts`), exactly as the palette shows it.
 *
 * One row shape per kind of road: a straight is its length; a curve its
 * radius and angle; a piece with several roads one line per road, a lead-in
 * and an S-bend's "approximate" kept; a buffer or a block its overall size.
 */

import { BUILT_IN, isStructure, makeResolver } from '../../../engine/data/library.js';
import { isMeasured } from '../../../engine/data/measured.js';
import { originOf, originUrl, type PartOrigin } from '../../../engine/data/origins.js';
import { TOLERANCE_MM } from '../../../engine/data/photoReadings.js';
import { SYSTEM_NAME, centrelineRadiusMm, isUnverified, shortCode, type Part, type RoadShape } from '../../../engine/src/parts/schema.js';
import { esc, shell, SITE, SIZES_PATH } from './shell.js';
import { WHY_PATH } from './whyPage.js';

export { SIZES_PATH };
/** When this page's words or the library's figures last changed, for the sitemap. Raise it when they do. */
export const SIZES_CHANGED = '2026-11-23';
export const SIZES_TITLE = 'Wooden train track dimensions: the length, radius and angle of every piece | ChooChooCAD';
const DESCRIPTION =
  'The size of every wooden toy-train track piece the planner knows, in millimetres: the length of each straight, the radius and angle of each curve, the roads of each switch and crossing, each marked measured, published or unverified.';

/** The palette's three signs, as words: its tick, no sign, and its star. */
export type Mark = 'Measured' | 'Published' | 'Unverified';

export interface SizeRow {
  /** The library's id, for the tests. Never printed. */
  readonly partId: string;
  /** The code on the piece's palette card. */
  readonly code: string;
  readonly name: string;
  /** One line per road, or one for the whole piece. */
  readonly sizes: readonly string[];
  readonly mark: Mark;
  /** The printable model this piece was taken from, where the app credits one. */
  readonly origin?: PartOrigin;
}

export interface SizeGroup {
  readonly heading: string;
  /** What is true of every piece under the heading. */
  readonly note?: string;
  readonly rows: readonly SizeRow[];
}

const resolve = makeResolver(BUILT_IN);

const mm = (n: number) => `${n} mm`;
/** An arc's angle: its count of 22.5-degree steps. */
const degrees = (steps: number) => `${steps * 22.5}°`;

/** One road of a piece with several, in the library's figures. */
function roadLine(shape: RoadShape, plankWidthMm: number): string {
  if (shape.kind === 'straight') return `straight road, ${mm(shape.lengthMm)}`;
  if (shape.kind === 's-bend') {
    return `S-bend, ${mm(shape.lengthMm)} long, shifting the track ${mm(Math.abs(shape.offsetMm))} sideways; the ends are exact, the curve between them is approximate`;
  }
  const arc = `radius ${mm(centrelineRadiusMm({ innerRadiusMm: shape.innerRadiusMm, plankWidthMm }))}, ${degrees(shape.arcSteps)}`;
  return shape.leadMm ? `curved road, ${mm(shape.leadMm)} straight, then ${arc}` : `curved road, ${arc}`;
}

/** Equal lines said once, with their count: a crossing's two roads, a Y switch's two curves. */
function counted(lines: readonly string[]): string[] {
  const seen = new Map<string, number>();
  for (const l of lines) seen.set(l, (seen.get(l) ?? 0) + 1);
  return [...seen].map(([line, n]) => (n === 1 ? line : `${n} × ${line}`));
}

/** What passes under a raised road, where the library holds the opening. */
function under(part: Part): string[] {
  if (part.kind !== 'straight') return [];
  if (part.hump) return [`track passes under, ${mm(part.hump.clearanceMm)} clear${part.hump.clearanceEstimated ? ' (an estimate)' : ''}`];
  if (part.deckClearanceMm !== undefined) return [`track passes under, ${mm(part.deckClearanceMm)} clear`];
  return [];
}

export function sizesOf(part: Part): string[] {
  const like = part.decoratedFrom === undefined ? [] : [`works like ${shortCode(resolve(part.decoratedFrom))}, ${resolve(part.decoratedFrom).name}`];
  if (part.kind === 'curve') {
    return [`radius ${mm(centrelineRadiusMm(part))} to the middle of the track (${mm(part.innerRadiusMm)} to the inner edge), ${degrees(part.arcSteps)}`, ...like];
  }
  if (part.kind === 'multi-road') return [...counted(part.roads.map((r) => roadLine(r.shape, part.plankWidthMm))), ...like];
  if (part.kind === 'block') return [`${part.sizeLabel} mm`];
  if (part.kind === 'buffer') return [`${mm(part.lengthMm)} long`];
  const level = part.rise !== undefined ? ['rises one level'] : part.deck !== undefined ? ['its road is one level up'] : part.hump ? ['goes up one level and comes back down'] : [];
  return [`${mm(part.lengthMm)} long`, ...level, ...under(part), ...like];
}

export const markOf = (part: Part): Mark => (isMeasured(part) ? 'Measured' : isUnverified(part) ? 'Unverified' : 'Published');

function rowOf(part: Part): SizeRow {
  const origin = originOf(part);
  return { partId: part.id, code: shortCode(part), name: part.name, sizes: sizesOf(part), mark: markOf(part), ...(origin ? { origin } : {}) };
}

/** A built piece that is not a decorated plain one: it has wood of its own, or is drawn in detail. */
const isBuilt = (p: Part) => p.decoratedFrom === undefined && (isStructure(p) || p.decor !== undefined);
const isRamp = (p: Part) => p.kind === 'straight' && p.rise !== undefined;

/** Every built-in piece once, under the kind a person would look for it by. */
export function sizeGroups(): SizeGroup[] {
  const generic = BUILT_IN.filter((p) => p.brand === 'GENERIC');
  const plain = generic.filter((p) => !isBuilt(p) && p.decoratedFrom === undefined);
  const others = [...new Set(BUILT_IN.filter((p) => p.brand !== 'GENERIC').map((p) => p.brand))];
  const groups: SizeGroup[] = [
    { heading: 'Straights', rows: plain.filter((p) => p.kind === 'straight' && !isRamp(p)).map(rowOf) },
    { heading: 'Curves', note: 'Eight 45° curves make a full circle.', rows: plain.filter((p) => p.kind === 'curve').map(rowOf) },
    { heading: 'Ramps', rows: plain.filter(isRamp).map(rowOf) },
    {
      heading: 'Switches and crossings',
      note: 'Each line is one road through the piece. A switch with a peg at its heel has the same roads as the one with a socket.',
      rows: plain.filter((p) => p.kind === 'multi-road').map(rowOf),
    },
    { heading: 'Buffer stops', rows: plain.filter((p) => p.kind === 'buffer').map(rowOf) },
    { heading: 'Bridges, stations and supports', rows: generic.filter(isBuilt).map(rowOf) },
    {
      heading: 'Decorated pieces',
      note: 'Each has the track of a plain piece, with decoration on it.',
      rows: generic.filter((p) => p.decoratedFrom !== undefined).map(rowOf),
    },
    ...others.map((b) => ({
      heading: `${SYSTEM_NAME[b]} track`,
      note: 'Nobody publishes sizes for this system. These figures come from printed reproductions, and the planner treats each as an estimate.',
      rows: BUILT_IN.filter((p) => p.brand === b).map(rowOf),
    })),
  ];
  return groups.filter((g) => g.rows.length > 0);
}

/** The credit of a piece taken from one printable design, as a link to its model page. */
const credit = (o: PartOrigin) =>
  `<span class="credit"><a href="${esc(originUrl(o))}" rel="noopener noreferrer">Printable model by ${esc(o.creator)} on ${esc(o.site)}</a></span>`;

export function rowHtml(r: SizeRow): string {
  return `<tr><th scope="row">${esc(r.name)} <span class="code num">${esc(r.code)}</span>${r.origin ? credit(r.origin) : ''}</th><td class="size">${r.sizes.map(esc).join('<br>')}</td><td>${r.mark}</td></tr>`;
}

const groupHtml = (g: SizeGroup) => `<h2>${esc(g.heading)}</h2>${g.note ? `\n<p>${esc(g.note)}</p>` : ''}
<table class="sizes">
<thead><tr><th scope="col">Piece</th><th scope="col">Size</th><th scope="col">The figure is</th></tr></thead>
<tbody>
${g.rows.map(rowHtml).join('\n')}
</tbody>
</table>`;

export function sizesHtml(): string {
  const groups = sizeGroups();
  const rows = groups.flatMap((g) => g.rows);
  const count = (m: Mark) => rows.filter((r) => r.mark === m).length;
  // The plank every Generic piece is cut from, read off the long straight.
  const plank = resolve('D');
  return shell(
    SIZES_TITLE,
    DESCRIPTION,
    SIZES_PATH,
    `<h1>Wooden train track dimensions</h1>
<p>These are the sizes the planner checks a layout with, in millimetres, for all <span class="num">${rows.length}</span> pieces it knows. A few millimetres decide whether a loop closes, so each figure says how far it can be trusted.</p>
<ul>
<li><strong>Measured</strong> (<span class="num">${count('Measured')}</span> pieces): checked against a real piece, and within <span class="num">${TOLERANCE_MM}</span> mm of it.</li>
<li><strong>Published</strong> (<span class="num">${count('Published')}</span>): a figure a published reference states.</li>
<li><strong>Unverified</strong> (<span class="num">${count('Unverified')}</span>): a figure in circulation that nobody has measured. The planner says so whenever a layout uses one.</li>
</ul>
<p>Generic track is a plank <span class="num">${plank.plankWidthMm}</span> mm wide and <span class="num">${plank.plankThicknessMm}</span> mm thick, with two grooves <span class="num">${plank.grooveWidthMm ?? ''}</span> mm wide whose centres are <span class="num">${plank.gaugeWidthMm}</span> mm apart. A curve’s radius is given here to the middle of the track; a figure given to the inner edge of the wood is <span class="num">${plank.plankWidthMm / 2}</span> mm less.</p>
${groups.map(groupHtml).join('\n')}
<h2>Check a layout with these sizes</h2>
<p>The planner adds these figures up round every loop and says whether the ends meet. <a href="${WHY_PATH}">Why a loop closes, and why one will not</a>.</p>
<p><a class="open" href="/">Plan your own layout</a></p>
<p><a href="/layouts/">Layouts that close, with the pieces each takes</a></p>`,
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Wooden train track dimensions',
      description: DESCRIPTION,
      url: `${SITE}${SIZES_PATH}`,
      dateModified: SIZES_CHANGED,
    },
  );
}
