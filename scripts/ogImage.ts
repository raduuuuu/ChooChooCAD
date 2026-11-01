/**
 * THE LINK PREVIEW PICTURE (share plan, design 12A): the Stadium in beech on
 * paper, the wordmark in ink, 1200×630. Drawn by the app's own engine and
 * colour tokens, so it is the track a friend will see.
 *
 *   bun scripts/ogImage.ts > og.html
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
 *     --screenshot=app/public/og.png "file://$PWD/og.html"
 *
 * Kept as a script, not a build step: the picture changes only when the look
 * does, and a PNG in `public/` needs no browser at build time.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILT_IN, makeResolver } from '../engine/data/library.js';
import { placeAll } from '../engine/src/graph/frames.js';
import { portsOf, type Piece } from '../engine/src/graph/model.js';
import { renderGraph } from '../engine/src/graph/render.js';
import { decodeLink } from '../app/src/shareLink.js';
import { seamLines, segmentPath } from '../app/src/trackPath.js';

/** The frozen Stadium link (app/src/shareLink.frozen.test.ts). */
const STADIUM = '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw';
const EDGE_MM = 1.2;

const tokens = readFileSync(join(import.meta.dir, '..', 'app', 'src', 'tokens.css'), 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`).exec(tokens);
  if (!m) throw new Error(`no --${name} in tokens.css`);
  return m[1]!;
};

const r = await decodeLink(STADIUM);
if (!r.ok) throw new Error(`the Stadium link no longer decodes: ${r.reason}`);
const graph = r.graph;
const resolve = makeResolver(BUILT_IN);
const ports = (p: Piece) => portsOf(resolve(p.partId), p.turn);
const render = renderGraph(graph, ports, resolve, placeAll(graph, ports));
const part = resolve(graph.pieces[0]!.partId);

const xs = render.segments.flatMap((s) => [s.from.x, s.to.x]);
const ys = render.segments.flatMap((s) => [s.from.y, s.to.y]);
const pad = 80;
const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];

const layers = [
  { w: part.plankWidthMm, c: token('track-edge') },
  { w: part.plankWidthMm - 2 * EDGE_MM, c: token('track-fill') },
  ...(part.grooveWidthMm !== undefined
    ? [
        { w: part.gaugeWidthMm + part.grooveWidthMm, c: token('track-groove') },
        { w: part.gaugeWidthMm - part.grooveWidthMm, c: token('track-fill') },
      ]
    : []),
];
const plankOf = new Map(graph.pieces.map((p) => [p.pieceId, resolve(p.partId).plankWidthMm]));
const seams = seamLines(graph.welds, render.ports, (id) => plankOf.get(id)!, new Set());
const paths = render.segments.map(segmentPath);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="540" height="${Math.round((540 * (y1 - y0)) / (x1 - x0))}">
  <g transform="translate(0 ${y0 + y1}) scale(1 -1)">
    ${layers.map((l) => paths.map((d) => `<path d="${d}" fill="none" stroke="${l.c}" stroke-width="${l.w}"/>`).join('')).join('\n    ')}
    ${seams.map((s) => `<line x1="${s.from[0]}" y1="${s.from[1]}" x2="${s.to[0]}" y2="${s.to[1]}" stroke="${token('seam')}" stroke-width="2"/>`).join('')}
  </g>
</svg>`;

const logo = readFileSync(join(import.meta.dir, '..', 'app', 'public', 'favicon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '');

console.log(`<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: Plex; src: url('${join(import.meta.dir, '..', 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', 'ibm-plex-sans-latin-600-normal.woff2')}'); font-weight: 600; }
  @font-face { font-family: Plex; src: url('${join(import.meta.dir, '..', 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', 'ibm-plex-sans-latin-400-normal.woff2')}'); font-weight: 400; }
  html, body { margin: 0; width: 1200px; height: 630px; background: ${token('paper')}; color: ${token('ink')}; font-family: Plex, sans-serif; overflow: hidden; }
  main { display: flex; align-items: center; height: 100%; padding: 0 72px; gap: 56px; box-sizing: border-box; }
  .words { flex: 1; }
  .name { display: flex; align-items: center; gap: 18px; font-size: 56px; font-weight: 600; letter-spacing: -0.01em; }
  .name svg { width: 64px; height: 64px; }
  .line { margin-top: 20px; font-size: 30px; line-height: 1.35; color: ${token('ink-soft')}; max-width: 18ch; }
  .floor { background: ${token('floor')}; border: 1px solid ${token('rule')}; padding: 24px; display: flex; }
</style></head>
<body><main>
  <div class="words">
    <div class="name">${logo}ChooChooCAD</div>
    <div class="line">Plan a wooden railway, check it fits, build it piece by piece.</div>
  </div>
  <div class="floor">${svg}</div>
</main></body></html>`);
