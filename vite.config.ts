import { execSync } from 'node:child_process';
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
function buildVersion(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  root: 'app',
  plugins: [react()],
  server: { port: 5173 },
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
});
