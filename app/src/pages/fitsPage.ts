/**
 * WHICH MAKES OF TRACK FIT TOGETHER (`/which-track-fits/`; owner,
 * 2026-11-26). People ask this by a maker's name, and every other page of
 * this site answers by trait only.
 *
 * THE ONE PLACE A MAKER IS NAMED (AGENTS.md, "Names and sources", the
 * exception of 2026-11-26). The names are in `MAKE` below and nowhere else:
 * not in the app, the library, another page or a test. `NAMED_WORDS` is what
 * the page may say; the test holds the page to it and every other page to
 * none, and the repo checkup allows these words in this file alone.
 *
 *   library.ts (the pieces of each system) ──┐
 *   measured.ts, schema.ts (how far a size   ├─▶ one section per make: how many
 *     can be trusted)                        │   pieces, and how many are Measured,
 *   thirdParty.ts brandFit (what is          │   Published, Unverified
 *     documented about two systems joining) ─┴─▶ one row per pair: the verdict
 *
 * NOTHING IS CLAIMED THAT NOBODY CHECKED (owner, 2026-11-26: "what was
 * checked"). A pair's verdict is `brandFit`'s, never a sentence written
 * here; a row says what the verdict rests on in the page of sizes' own
 * three words, and nothing on this page was tested by joining real pieces,
 * which the page says before the table.
 */

import { BUILT_IN } from '../../../engine/data/library.js';
import { brandFit } from '../../../engine/data/thirdParty.js';
import { SYSTEM_NAME, type Brand, type BrandFit } from '../../../engine/src/parts/schema.js';
import { esc, FITS_PATH, shell, SITE, SIZES_PATH } from './shell.js';
import { markOf, type Mark } from './sizesPage.js';

export { FITS_PATH };
/** When this page's words last changed, for the sitemap. Raise it when they do. */
export const FITS_CHANGED = '2026-11-26';
export const FITS_TITLE = 'Do BRIO, IKEA and Lidl wooden train tracks fit together? | ChooChooCAD';
const DESCRIPTION =
  'Whether wooden train track from BRIO, IKEA (Lillabo) and Lidl (Playtive) joins, said only as far as anyone has checked: what was measured, what was published and what is not known.';

/** The systems the planner holds pieces for, in the order the page takes them. */
export const SYSTEMS = ['GENERIC', 'IKEA', 'PLAYTIVE'] as const satisfies readonly Brand[];
export type System = (typeof SYSTEMS)[number];

/** The maker's words this page may say, lower case: the makes of `MAKE` and no other (the test compares it with the list of brand words). */
export const NAMED_WORDS: readonly string[] = ['brio', 'ikea', 'lillabo', 'playtive', 'lidl'];

interface Make {
  /** The name a person searches by. */
  readonly name: string;
  /** How its track is sold, when that is under another name. */
  readonly sold: string;
  /** Where the planner's sizes for it come from, as far as the library's own notes go. */
  readonly sizes: string;
}

export const MAKE: Readonly<Record<System, Make>> = {
  GENERIC: {
    name: 'BRIO',
    sold: '',
    sizes:
      'The lengths and radii come from a published reference for this track, not from the maker and not from measuring here. A piece is marked Measured only once a real one has been checked against its figure.',
  },
  IKEA: {
    name: 'IKEA',
    sold: 'sold as Lillabo',
    sizes:
      'The maker publishes no piece sizes. The figures here were read from printed copies of the track, which is the best that exists and is not a measurement of a real piece.',
  },
  PLAYTIVE: {
    name: 'Playtive',
    sold: 'sold by Lidl',
    sizes:
      'The maker publishes no piece sizes. The planner holds straights only, read from printed copies; no curve radius for this track is known well enough to use.',
  },
};

/** What `brandFit` documents, in the page's words. */
export const FIT_WORDS: Readonly<Record<BrandFit, string>> = {
  joins: 'Joins',
  tight: 'Joins, tightly',
  'does-not-join': 'Reported not to join',
  unknown: 'Not known',
};

export interface Pair {
  readonly a: System;
  readonly b: System;
  /** What is behind the verdict, in a sentence a parent can act on. */
  readonly why: string;
}

/** Every pair of two different systems, once. The verdict is not here: it is `brandFit`'s. */
export const PAIRS: readonly Pair[] = [
  {
    a: 'GENERIC',
    b: 'IKEA',
    why: 'The IKEA peg and socket are smaller. A published guide to this track says joining the two may be impossible without damaging a piece, and owners report the same.',
  },
  {
    a: 'GENERIC',
    b: 'PLAYTIVE',
    why: 'Playtive track is sold as fitting BRIO, and some owners say it does. No measurement supports it either way.',
  },
  { a: 'IKEA', b: 'PLAYTIVE', why: 'Nothing published says either way.' },
];

/** What a pair's verdict rests on, in the page of sizes' words: nothing here was measured, and what is not known rests on nothing. */
export const basisOf = (fit: BrandFit): Mark => (fit === 'unknown' ? 'Unverified' : 'Published');

/** How many of a system's pieces carry each mark. */
export function marksOf(system: System): Readonly<Record<Mark, number>> {
  const counts: Record<Mark, number> = { Measured: 0, Published: 0, Unverified: 0 };
  for (const part of BUILT_IN) if (part.brand === system) counts[markOf(part)] += 1;
  return counts;
}

const num = (n: number) => `<span class="num">${n}</span>`;

function pairRow(p: Pair): string {
  const { fit } = brandFit(p.a, p.b);
  const basis = basisOf(fit);
  return `<tr role="row"><th role="rowheader" scope="row">${esc(MAKE[p.a].name)} with ${esc(MAKE[p.b].name)}</th><td role="cell" class="size"><strong>${esc(FIT_WORDS[fit])}.</strong> ${esc(p.why)}</td><td role="cell" class="mark is-${basis.toLowerCase()}">${basis}</td></tr>`;
}

function makeSection(system: System): string {
  const make = MAKE[system];
  const marks = marksOf(system);
  const total = marks.Measured + marks.Published + marks.Unverified;
  const sold = make.sold ? ` (${esc(make.sold)})` : '';
  return `<h2 id="${system.toLowerCase()}">${esc(make.name)}${sold}</h2>
<p>In the planner this track is called “${esc(SYSTEM_NAME[system])}”. It holds ${num(total)} pieces for it: ${num(marks.Measured)} Measured, ${num(marks.Published)} Published and ${num(marks.Unverified)} Unverified.</p>
<p>${esc(make.sizes)}</p>`;
}

export function fitsHtml(): string {
  const names = SYSTEMS.map((s) => MAKE[s].name);
  return shell(
    FITS_TITLE,
    DESCRIPTION,
    FITS_PATH,
    `<h1>Do BRIO, IKEA and Lidl wooden train tracks fit together?</h1>
<p>What is known, pair by pair. Nothing in this table was tested here by joining real pieces; the last column says what each line rests on.</p>
<h2 id="pairs">Which makes join</h2>
<table role="table" class="sizes" aria-labelledby="pairs">
<thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Makes</th><th role="columnheader" scope="col">What is known</th><th role="columnheader" scope="col">It rests on</th></tr></thead>
<tbody role="rowgroup">
${PAIRS.map(pairRow).join('\n')}
</tbody>
</table>
<ul>
<li><strong>Published</strong>: a published guide or owners’ reports say so. Nobody here has tried it.</li>
<li><strong>Unverified</strong>: no measurement and no dependable report either way.</li>
</ul>
<p>Even where two makes join, a loop that closes with one can come out a few millimetres off with pieces from another: there is no shared standard, and each maker’s sizes differ a little.</p>
${SYSTEMS.map(makeSection).join('\n')}
<h2>How to settle it for your own track</h2>
<p>Own two of these makes? Try one joint by hand: a peg that will not go into the socket without force is the answer, and forcing it can split the wood. To find out whether a whole loop closes, <a href="${SIZES_PATH}">the size of every piece</a> the planner holds is listed with its mark, and a piece you measure yourself can replace an unverified figure.</p>
<p><a class="open" href="/">Plan your own layout</a></p>
<p><a href="/why-a-loop-will-not-close/">Why a wooden train track loop will not close</a></p>
<p class="note">${names.map(esc).join(', ')}, Lillabo and Lidl are trademarks of their owners. ChooChooCAD is an independent project, not affiliated with, endorsed by or sponsored by any of them; their names are used only to say which track a line is about.</p>`,
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Do BRIO, IKEA and Lidl wooden train tracks fit together?',
      description: DESCRIPTION,
      url: `${SITE}${FITS_PATH}`,
      dateModified: FITS_CHANGED,
    },
  );
}
