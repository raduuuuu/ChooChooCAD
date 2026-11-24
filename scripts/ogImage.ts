/**
 * THE LINK PREVIEW PICTURES (share plan, design 12A; layout pages, owner
 * 2026-11-22): what a chat shows when an address of the site is pasted into
 * it, 1200×630. Drawn by the app's own engine and colour tokens, through the
 * one drawing function the pages use, so it is the track a friend will see.
 *
 *   bun scripts/ogImage.ts > og.html          the home page's: the Stadium and the wordmark
 *   bun scripts/ogImage.ts stadium > s.html   one layout's: its name, its count, its size
 *   bun scripts/ogImage.ts --all              every layout's, straight to app/public/layouts/<slug>.png
 *
 * The first two print a page; a desktop browser takes its picture:
 *
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 \
 *     --screenshot=app/public/og.png "file://$PWD/og.html"
 *
 * `--all` runs that browser itself (CHROME names another binary). Kept as a
 * script run by hand, not a build step: the pictures change only when a
 * layout or the look does, and a PNG in `public/` needs no browser at build
 * time. They are committed, listed in `.github/checkup-allow.json`, and
 * `app/src/pages/pages.test.ts` fails when a layout page has none.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coloursOf, draw, tokenOf } from '../app/src/pages/drawing.js';
import { aCount, layoutPages, previewPath, type LayoutPage } from '../app/src/pages/layoutPage.js';
import { decodeLink } from '../app/src/shareLink.js';

/** The frozen Stadium link (app/src/shareLink.frozen.test.ts). */
const STADIUM = '#v1.hcy5DcAwDEPRXVy78H30yRSC9l8j3-xSBIEKPoCEzCzcIWaP33n99K8dsBQzl-DJIhVUpYqa1FCXOhrSQFOaaEkLbWmfvwi6Pw';

const root = join(import.meta.dir, '..');
const tokens = readFileSync(join(root, 'app', 'src', 'tokens.css'), 'utf8');
const token = (name: string) => tokenOf(tokens, name);
const colours = coloursOf(tokens);
const font = (weight: number) => join(root, 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', `ibm-plex-sans-latin-${weight}-normal.woff2`);
const logo = readFileSync(join(root, 'app', 'public', 'favicon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/, '');

async function graphOf(fragment: string) {
  const r = await decodeLink(fragment);
  if (!r.ok) throw new Error(`the link no longer decodes: ${r.reason}`);
  return r.graph;
}

const page = (words: string, svg: string) => `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @font-face { font-family: Plex; src: url('${font(600)}'); font-weight: 600; }
  @font-face { font-family: Plex; src: url('${font(400)}'); font-weight: 400; }
  html, body { margin: 0; width: 1200px; height: 630px; background: ${token('paper')}; color: ${token('ink')}; font-family: Plex, sans-serif; overflow: hidden; }
  main { display: flex; align-items: center; height: 100%; padding: 0 72px; gap: 56px; box-sizing: border-box; }
  .words { flex: 1; }
  .name { display: flex; align-items: center; gap: 18px; font-size: 56px; font-weight: 600; letter-spacing: -0.01em; }
  .name svg { width: 64px; height: 64px; }
  .line { margin-top: 20px; font-size: 27px; line-height: 1.4; color: ${token('ink-soft')}; max-width: 22ch; text-wrap: balance; }
  .mark { display: flex; align-items: center; gap: 12px; margin-top: 40px; font-size: 24px; font-weight: 600; }
  .mark svg { width: 32px; height: 32px; }
  .floor { background: ${token('floor')}; border: 1px solid ${token('rule')}; padding: 24px; display: flex; }
  .floor svg { max-height: 480px; width: auto; max-width: 540px; }
</style></head>
<body><main>
  <div class="words">${words}</div>
  <div class="floor">${svg}</div>
</main></body></html>`;

/** The home page's picture. */
async function homeHtml(): Promise<string> {
  const svg = draw(await graphOf(STADIUM), 'A stadium-shaped loop of wooden track', colours, { padMm: 80, widthPx: 540 }).svg;
  return page(
    `<div class="name">${logo}ChooChooCAD</div>
    <div class="line">Lay out the pieces and it says whether the loop closes, before you build it on the floor.</div>`,
    svg,
  );
}

/** One layout's picture: its name, what it is, how big, and whose site this is. */
async function layoutHtml(l: LayoutPage): Promise<string> {
  const svg = draw(await graphOf(l.fragment), l.label, colours, { padMm: 80, widthPx: 540 }).svg;
  return page(
    `<div class="name">${l.label}</div>
    <div class="line">${aCount(l.pieceCount).replace(/^a/, 'A')} wooden train track layout that closes. ${l.floorCm[0]} × ${l.floorCm[1]} cm on the floor.</div>
    <div class="mark">${logo}ChooChooCAD</div>`,
    svg,
  );
}

const arg = process.argv[2];
if (arg === undefined) {
  console.log(await homeHtml());
} else {
  const layouts = await layoutPages(colours);
  if (arg === '--all') {
    const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const dir = mkdtempSync(join(tmpdir(), 'layout-pictures-'));
    for (const l of layouts) {
      const html = join(dir, `${l.slug}.html`);
      const png = join(root, 'app', 'public', previewPath(l.slug));
      writeFileSync(html, await layoutHtml(l));
      const run = Bun.spawnSync([
        chrome,
        '--headless=new',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1200,630',
        `--screenshot=${png}`,
        `file://${html}`,
      ]);
      if (run.exitCode !== 0) throw new Error(`the browser could not draw ${l.slug}: ${run.stderr.toString().slice(0, 300)}`);
      console.log(`drew app/public${previewPath(l.slug)}`);
    }
  } else {
    const l = layouts.find((x) => x.slug === arg);
    if (!l) throw new Error(`no layout page called "${arg}": ${layouts.map((x) => x.slug).join(', ')}`);
    console.log(await layoutHtml(l));
  }
}
