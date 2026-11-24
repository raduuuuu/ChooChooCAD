/**
 * THE SIZE OF EVERY PIECE (`/sizes/`; owner, 2026-11-22; design review,
 * 2026-11-24). The app holds a table of piece sizes, each marked for how far
 * it can be trusted, and until this page it could only be read one card at a
 * time inside the planner.
 *
 *   BUILT_IN ──▶ sizeGroups(): one row per piece, shortest first within its kind
 *                   │  sizes: a line per road, the figure first, in the library's own numbers
 *                   │  mark: the palette's three (measured, published, unverified)
 *                   │  origin: the printable model a piece was taken from, where the app credits one
 *                   └──▶ sizesHtml(): heading, jump list, a table per group,
 *                        the printable models, then what the marks mean
 *
 * NOTHING HERE IS A FIGURE WRITTEN BY HAND: every number is read from the
 * library the checker uses, so the page cannot disagree with a verdict.
 *
 * THE READER CAME FOR ONE NUMBER (design review D3, D11): the tables come
 * straight after the heading, a line leads with its figure, and anything true
 * of a whole kind (what a length is measured between, the inner-edge radius,
 * an S-bend's approximate curve) is said once in that kind's note.
 *
 * WHAT A ROW NEVER SHOWS (AGENTS.md "Names and sources"): the internal part
 * id, since some old ids spell a maker's name (the code is the palette's
 * `shortCode`, which drops it), and where a figure came from. A piece taken
 * from one printable design keeps its credit and link, as the palette shows
 * it: listed once under "Printable models", with a marker in the row (D16).
 */

import { BUILT_IN, isStructure, makeResolver } from '../../../engine/data/library.js';
import { isMeasured } from '../../../engine/data/measured.js';
import { originOf, originUrl, type PartOrigin } from '../../../engine/data/origins.js';
import { TOLERANCE_MM } from '../../../engine/data/photoReadings.js';
import { SYSTEM_NAME, centrelineRadiusMm, isUnverified, shortCode, type Part, type RoadShape } from '../../../engine/src/parts/schema.js';
import { esc, shell, SITE, SIZES_PATH, TICK } from './shell.js';
import { WHY_PATH } from './whyPage.js';

export { SIZES_PATH };
/**
 * When a size on this page last changed: shown on the page and given to the
 * sitemap. `SIZES_DIGEST` is the rows as they were on that day; the test
 * works it out again and fails when a row has changed, so the date a reader
 * sees is never older than the figures (design review D10). Raise both together.
 */
export const SIZES_CHANGED = '2026-11-24';
export const SIZES_DIGEST = '7cde3acf2797149d';
export const SIZES_TITLE = 'Wooden train track dimensions: the length, radius and angle of every piece | ChooChooCAD';
const DESCRIPTION =
  'The size of every wooden toy-train track piece the planner knows, in millimetres: the length of each straight, the radius and angle of each curve, the roads of each switch and crossing, each marked measured, published or unverified.';

/** The palette's three signs, as words: its tick, no sign, and its star. */
export type Mark = 'Measured' | 'Published' | 'Unverified';

/** A piece of a line: words, or a figure with its unit, which is set as a measurement (DESIGN.md rule 4). */
export type Bit = string | { readonly num: string };
export type Line = readonly Bit[];

export interface SizeRow {
  /** The library's id, for the tests. Never printed. */
  readonly partId: string;
  /** The code on the piece's palette card. */
  readonly code: string;
  readonly name: string;
  /** One line per road, or one for the whole piece. */
  readonly sizes: readonly Line[];
  readonly mark: Mark;
  /** The printable model this piece was taken from, where the app credits one. */
  readonly origin?: PartOrigin;
}

export interface SizeGroup {
  readonly heading: string;
  /** Its address on the page, after the `#`. */
  readonly id: string;
  /** What is true of every piece under the heading. */
  readonly note?: Line;
  readonly rows: readonly SizeRow[];
}

const resolve = makeResolver(BUILT_IN);

const mm = (n: number): Bit => ({ num: `${n} mm` });
/** An arc's angle: its count of 22.5-degree steps, exact, written as the piece names write it (DESIGN.md rule 4). */
const degrees = (steps: number): Bit => ({ num: `${steps * 22.5}°` });
const count = (n: number): Bit => ({ num: String(n) });

/** A line as plain words, for the tests and the digest. */
export const textOf = (line: Line) => line.map((b) => (typeof b === 'string' ? b : b.num)).join('');
const lineHtml = (line: Line) => line.map((b) => (typeof b === 'string' ? esc(b) : `<span class="num">${esc(b.num)}</span>`)).join('');

/** One road of a piece with several, the figure first. */
function roadLine(shape: RoadShape, plankWidthMm: number): Line {
  if (shape.kind === 'straight') return [mm(shape.lengthMm), ' straight road'];
  if (shape.kind === 's-bend') return [mm(shape.lengthMm), ' S-bend, moving the track ', mm(Math.abs(shape.offsetMm)), ' sideways'];
  const arc: Line = [mm(centrelineRadiusMm({ innerRadiusMm: shape.innerRadiusMm, plankWidthMm })), ' radius, ', degrees(shape.arcSteps), ' curved road'];
  return shape.leadMm ? [mm(shape.leadMm), ' straight, then ', ...arc] : arc;
}

/** Equal lines said once, with their count: a crossing's two roads, a Y switch's two curves. */
function counted(lines: readonly Line[]): Line[] {
  const seen = new Map<string, { line: Line; n: number }>();
  for (const line of lines) {
    const key = textOf(line);
    seen.set(key, { line, n: (seen.get(key)?.n ?? 0) + 1 });
  }
  return [...seen.values()].map(({ line, n }) => (n === 1 ? line : [count(n), ' × ', ...line]));
}

/** What passes under a raised road, where the library holds the opening. */
function under(part: Part): Line[] {
  if (part.kind !== 'straight') return [];
  if (part.hump) return [[mm(part.hump.clearanceMm), ` clear for track passing under${part.hump.clearanceEstimated ? ' (an estimate)' : ''}`]];
  if (part.deckClearanceMm !== undefined) return [[mm(part.deckClearanceMm), ' clear for track passing under']];
  return [];
}

export function sizesOf(part: Part): Line[] {
  const like: Line[] = part.decoratedFrom === undefined ? [] : [[`works like ${shortCode(resolve(part.decoratedFrom))}, ${resolve(part.decoratedFrom).name}`]];
  if (part.kind === 'curve') return [[mm(centrelineRadiusMm(part)), ' radius, ', degrees(part.arcSteps)], ...like];
  if (part.kind === 'multi-road') return [...counted(part.roads.map((r) => roadLine(r.shape, part.plankWidthMm))), ...like];
  if (part.kind === 'block') {
    const foot = part.body[0]!;
    return [[mm(foot.lengthMm), ' long, ', mm(foot.widthMm), ' wide']];
  }
  if (part.kind === 'buffer') return [[mm(part.lengthMm), ' long']];
  const level: Line[] = part.rise !== undefined ? [['rises one level']] : part.deck !== undefined ? [['its road is one level up']] : part.hump ? [['goes up one level and comes back down']] : [];
  return [[mm(part.lengthMm), ' long'], ...level, ...under(part), ...like];
}

export const markOf = (part: Part): Mark => (isMeasured(part) ? 'Measured' : isUnverified(part) ? 'Unverified' : 'Published');

function rowOf(part: Part): SizeRow {
  const origin = originOf(part);
  return { partId: part.id, code: shortCode(part), name: part.name, sizes: sizesOf(part), mark: markOf(part), ...(origin ? { origin } : {}) };
}

/** A built piece that is not a decorated plain one: it has wood of its own, or is drawn in detail. */
const isBuilt = (p: Part) => p.decoratedFrom === undefined && (isStructure(p) || p.decor !== undefined);
const isRamp = (p: Part) => p.kind === 'straight' && p.rise !== undefined;

/**
 * SHORTEST FIRST (design review D5): a table of sizes is read by size. Within
 * a group the kinds keep the palette's order (straights, curves, then pieces
 * with several roads), and each kind runs by its length, or its radius and
 * then its angle. Pieces with several roads have no one size to sort by and
 * keep the library's order, which keeps a switch beside its peg-heel twin.
 */
const KIND_ORDER: readonly Part['kind'][] = ['straight', 'curve', 'multi-road', 'buffer', 'block'];
function sizeKey(p: Part): number {
  if (p.kind === 'straight' || p.kind === 'buffer') return p.lengthMm;
  if (p.kind === 'curve') return centrelineRadiusMm(p) * 1000 + p.arcSteps;
  return 0;
}
const bySize = (parts: readonly Part[]): Part[] =>
  parts
    .map((part, at) => ({ part, at }))
    .sort((a, b) => KIND_ORDER.indexOf(a.part.kind) - KIND_ORDER.indexOf(b.part.kind) || sizeKey(a.part) - sizeKey(b.part) || a.at - b.at)
    .map((x) => x.part);

const idOf = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const LENGTH_NOTE = 'A length runs from one end face of the wood to the other. A peg is not counted.';

/** Every built-in piece once, under the kind a person would look for it by. */
export function sizeGroups(): SizeGroup[] {
  const generic = BUILT_IN.filter((p) => p.brand === 'GENERIC');
  const plain = generic.filter((p) => !isBuilt(p) && p.decoratedFrom === undefined);
  const others = [...new Set(BUILT_IN.filter((p) => p.brand !== 'GENERIC').map((p) => p.brand))];
  const curves = plain.filter((p) => p.kind === 'curve');
  const several = plain.filter((p) => p.kind === 'multi-road');
  const bends = several.some((p) => p.kind === 'multi-road' && p.roads.some((r) => r.shape.kind === 's-bend'));
  // The plank every Generic piece is cut from, and the curve a circle is counted in.
  const plank = resolve('D');
  const curve = resolve('E');
  if (curve.kind !== 'curve') throw new Error('the large curve is no longer a curve');
  const group = (heading: string, parts: readonly Part[], note?: Line): SizeGroup => ({ heading, id: idOf(heading), ...(note ? { note } : {}), rows: bySize(parts).map(rowOf) });
  const groups: SizeGroup[] = [
    group('Straights', plain.filter((p) => p.kind === 'straight' && !isRamp(p)), [LENGTH_NOTE]),
    group('Curves', curves, [
      'A radius is given to the middle of the track. To the inner edge of the wood it is ',
      mm(plank.plankWidthMm / 2),
      ' less. ',
      count(16 / curve.arcSteps),
      ' curves of ',
      degrees(curve.arcSteps),
      ' make a full circle.',
    ]),
    group('Ramps', plain.filter(isRamp)),
    group('Switches and crossings', several, [
      'Each line is one road through the piece. A switch with a peg at its heel has the same roads as the one with a socket.',
      ...(bends ? [' The two ends of an S-bend are exact; the curve between them is approximate.'] : []),
    ]),
    group('Buffer stops', plain.filter((p) => p.kind === 'buffer')),
    group('Bridges, stations and supports', generic.filter(isBuilt)),
    group('Decorated pieces', generic.filter((p) => p.decoratedFrom !== undefined), ['Each has the track of a plain piece, with decoration on it.']),
    ...others.map((b) =>
      group(`${SYSTEM_NAME[b]} track`, BUILT_IN.filter((p) => p.brand === b), [
        'Nobody publishes sizes for this system. These figures come from printed reproductions, and the planner treats each as an estimate.',
      ]),
    ),
  ];
  return groups.filter((g) => g.rows.length > 0);
}

export const MODELS_ID = 'printable-models';
const ABOUT_ID = 'about-these-sizes';

/** The mark's cell: the word always, the planner's tick on a measured figure, soft ink on an unverified one (D18; DESIGN.md rule 1: no colour). */
const markHtml = (m: Mark) => `<td role="cell" class="mark is-${m.toLowerCase()}">${m === 'Measured' ? `${TICK} ` : ''}${m}</td>`;

/** A row. The roles are written out because a phone lays the row out as a grid, which would otherwise drop the table from what a screen reader hears (D15). */
export function rowHtml(r: SizeRow): string {
  const lines = r.sizes.map(lineHtml);
  // Outside the heading cell, so it is not read out with every cell of the row (D16).
  if (r.origin) lines.push(`<a class="also" href="#${MODELS_ID}">Printable model</a>`);
  return `<tr role="row"><th role="rowheader" scope="row">${esc(r.name)} <span class="code num">${esc(r.code)}</span></th><td role="cell" class="size">${lines.join('<br>')}</td>${markHtml(r.mark)}</tr>`;
}

const groupHtml = (g: SizeGroup) => `<h2 id="${g.id}">${esc(g.heading)}</h2>${g.note ? `\n<p>${lineHtml(g.note)}</p>` : ''}
<table role="table" class="sizes" aria-labelledby="${g.id}">
<thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Piece</th><th role="columnheader" scope="col">Size</th><th role="columnheader" scope="col">The figure is</th></tr></thead>
<tbody role="rowgroup">
${g.rows.map(rowHtml).join('\n')}
</tbody>
</table>`;

/** The credits (D16): each printable model once, with the pieces taken from it, a maker's models together. */
export function modelsHtml(rows: readonly SizeRow[]): string {
  const byModel = new Map<string, { origin: PartOrigin; pieces: SizeRow[] }>();
  for (const r of rows) {
    if (!r.origin) continue;
    const held = byModel.get(r.origin.modelId) ?? { origin: r.origin, pieces: [] };
    held.pieces.push(r);
    byModel.set(r.origin.modelId, held);
  }
  const models = [...byModel.values()].sort((a, b) => a.origin.creator.localeCompare(b.origin.creator));
  return `<h2 id="${MODELS_ID}">Printable models</h2>
<p>These pieces were drawn from a design that can be printed. The link is where to print one; it is not where the size comes from.</p>
<ul class="models">
${models
  .map(
    (m) =>
      `<li><a href="${esc(originUrl(m.origin))}" rel="noopener noreferrer">Model by ${esc(m.origin.creator)} on ${esc(m.origin.site)}</a>: ${m.pieces
        .map((p) => `${esc(p.name)} <span class="code num">${esc(p.code)}</span>`)
        .join(', ')}</li>`,
  )
  .join('\n')}
</ul>`;
}

/** `2026-11-24` as a person reads it. */
function dateWords(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** What the test holds the date to: every row as it is shown, without the library's id. */
export const rowsForDigest = () => JSON.stringify(sizeGroups().map((g) => [g.heading, g.rows.map((r) => [r.code, r.name, r.sizes.map(textOf), r.mark])]));

export function sizesHtml(): string {
  const groups = sizeGroups();
  const rows = groups.flatMap((g) => g.rows);
  const marked = (m: Mark) => rows.filter((r) => r.mark === m).length;
  const plank = resolve('D');
  if (plank.grooveWidthMm === undefined) throw new Error('the long straight has no groove width to state');
  const jump = [...groups.map((g) => ({ id: g.id, label: g.heading })), { id: MODELS_ID, label: 'Printable models' }, { id: ABOUT_ID, label: 'About these sizes' }];
  return shell(
    SIZES_TITLE,
    DESCRIPTION,
    SIZES_PATH,
    `<h1>Wooden train track dimensions</h1>
<p>The size of each of the ${lineHtml([count(rows.length)])} pieces the planner knows, in millimetres, each marked for how far the figure can be trusted.</p>
<nav aria-label="Sections of this page"><ul class="jump">
${jump.map((j) => `<li><a href="#${j.id}">${esc(j.label)}</a></li>`).join('\n')}
</ul></nav>
${groups.map(groupHtml).join('\n')}
${modelsHtml(rows)}
<h2 id="${ABOUT_ID}">About these sizes</h2>
<p>These are the sizes the planner checks a layout with. A few millimetres decide whether a loop closes, so each figure says how far it can be trusted.</p>
<ul>
<li><strong>Measured</strong> (${lineHtml([count(marked('Measured'))])} pieces): checked against a real piece, and within ${lineHtml([mm(TOLERANCE_MM)])} of it.</li>
<li><strong>Published</strong> (${lineHtml([count(marked('Published'))])}): a figure a published reference states.</li>
<li><strong>Unverified</strong> (${lineHtml([count(marked('Unverified'))])}): a figure in circulation that nobody has measured. The planner says so whenever a layout uses one. Have one of these pieces? <a href="/photo-guide.html">How to photograph it so its size can be read</a>.</li>
</ul>
<p>Generic track is a plank ${lineHtml([mm(plank.plankWidthMm), ' wide and ', mm(plank.plankThicknessMm), ' thick, with two grooves ', mm(plank.grooveWidthMm), ' wide whose centres are ', mm(plank.gaugeWidthMm), ' apart.'])}</p>
<p class="note">Sizes last changed <time datetime="${SIZES_CHANGED}">${dateWords(SIZES_CHANGED)}</time>.</p>
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
