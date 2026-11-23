/**
 * THE LIST OF LAYOUTS THAT CLOSE (`/layouts/`), fewest pieces first, each
 * with its count said before its name: the count is what a person holding a
 * box of track searches by (owner, 2026-11-22).
 */

import { layoutPath, type LayoutPage } from './layoutPage.js';
import { esc, shell, SITE, SIZES_PATH } from './shell.js';
import { WHY_PATH } from './whyPage.js';

/** Fewest pieces first; layouts with the same count keep the order the app offers them in. */
export const byPieceCount = (pages: readonly LayoutPage[]): readonly LayoutPage[] =>
  [...pages].sort((a, b) => a.pieceCount - b.pieceCount);

export function listHtml(pages: readonly LayoutPage[]): string {
  const ordered = byPieceCount(pages);
  const items = ordered
    .map(
      (p) =>
        `<li><a href="./${p.slug}.html"><div class="floor">${p.drawing}</div><span class="num">${p.pieceCount}</span> pieces: ${esc(p.label)}</a></li>`,
    )
    .join('\n');
  return shell(
    'Wooden train track layouts that close | ChooChooCAD',
    'Wooden toy-train track layouts checked to close exactly, each with the pieces it takes. Open any of them in the planner and change it.',
    '/layouts/',
    `<h1>Wooden train track layouts that close</h1>
<p>Each of these loops was checked by ChooChooCAD, a free planner for wooden toy-train track: its two ends meet with nothing to force. Open any of them in the planner and change it. <a href="${WHY_PATH}">Why a loop closes, and why one will not</a>. <a href="${SIZES_PATH}">The size of every piece</a>.</p>
<p><a class="open" href="/">Plan your own layout</a></p>
<h2>Ready layouts</h2>
<ul class="list">
${items}
</ul>`,
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Wooden train track layouts that close',
      itemListElement: ordered.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${p.label}, ${p.pieceCount} pieces`,
        url: `${SITE}${layoutPath(p.slug)}`,
      })),
    },
  );
}
