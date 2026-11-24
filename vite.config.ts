import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * The build identifier the crash repro prints (task K5).
 *
 * package.json carries no version and this is not released software, so the
 * commit is the only honest answer to "which build was this". Falls back to
 * 'unknown' rather than to a plausible-looking number: a wrong version in a
 * crash report sends whoever reads it to the wrong source.
 */
/** The app's version, from package.json (engine/tools/version.ts says how it moves). */
const APP_NUMBER = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;

function buildVersion(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

/*
 * The layout pages (plan 2026-11-14, E1): `scripts/layoutPages.ts` writes them
 * into app/layouts/ before every build, one per ready layout that closes, plus
 * their list, the page on why a loop will not close and the page of sizes. Each is built as its
 * own page, like the photo guide. Read from the folders, not listed here, so a
 * new ready layout needs no edit to this file.
 */
function layoutInputs(): Record<string, string> {
  // Each folder the script writes pages into; a page's name in the build is its folder and file.
  const dirs = ['layouts', 'why-a-loop-will-not-close', 'sizes'];
  return Object.fromEntries(
    dirs.flatMap((name) => {
      const dir = `app/${name}`;
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith('.html'))
        .map((f) => [`${name}-${f.slice(0, -'.html'.length)}`, `${dir}/${f}`]);
    }),
  );
}

export default defineConfig({
  root: 'app',
  plugins: [react()],
  server: { port: 5173 },
  // The photo guide is a second page, served at /photo-guide.html with the
  // app's own tokens and fonts (community-pieces plan, design D11).
  build: { rollupOptions: { input: { index: 'app/index.html', guide: 'app/photo-guide.html', ...layoutInputs() } } },
  // The number people see ("1.4.2"), and the number with its commit for a crash report ("1.4.2+e198b4d").
  define: { __APP_NUMBER__: JSON.stringify(APP_NUMBER), __APP_VERSION__: JSON.stringify(`${APP_NUMBER}+${buildVersion()}`) },
});
