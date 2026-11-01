/**
 * NOTHING BUT storage.ts WRITES TO BROWSER STORAGE (share plan, eng D31).
 *
 * Value: protects=a write added later anywhere in the app or engine cannot
 * walk around the read-only session a shared link runs in
 * Value: fails_when=a production file calls `setItem`, `removeItem` or
 * `clear` on `localStorage` (also through `window.` or `globalThis.`, or with
 * a string key in brackets), outside engine/data/storage.ts
 * Value: why_new=the session only protects writes that go through it
 * Value: seam=none; read with the TypeScript parser, not a regex, because four
 * regex versions of an import guard were defeated in this repo
 * (`engine/test/sources.test.ts`)
 * Value: no_claim=writes made through an aliased reference
 * (`const s = localStorage; s.setItem(...)`); none exist, and a review would
 * see one
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const OWNER = 'engine/data/storage.ts';
const WRITES = new Set(['setItem', 'removeItem', 'clear']);

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

/** `localStorage`, `window.localStorage` or `globalThis.localStorage`. */
const isLocalStorage = (e: ts.Expression): boolean =>
  (ts.isIdentifier(e) && e.text === 'localStorage') ||
  (ts.isPropertyAccessExpression(e) && e.name.text === 'localStorage');

/** Every storage write in `text`, as `file:line`. */
export function storageWrites(file: string, text: string): string[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    let method: string | null = null;
    let target: ts.Expression | null = null;
    if (ts.isPropertyAccessExpression(n)) {
      method = n.name.text;
      target = n.expression;
    } else if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) {
      method = n.argumentExpression.text;
      target = n.expression;
    }
    if (method !== null && target !== null && WRITES.has(method) && isLocalStorage(target)) {
      out.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe('storage writes', () => {
  it('the detector finds every spelling it is meant to', () => {
    const probe = [
      'localStorage.setItem("k", "v");',
      'window.localStorage.removeItem("k");',
      'globalThis.localStorage.clear();',
      'localStorage["setItem"]("k", "v");',
      'localStorage.getItem("k");',
    ].join('\n');
    expect(storageWrites('probe.ts', probe)).toEqual(['probe.ts:1', 'probe.ts:2', 'probe.ts:3', 'probe.ts:4']);
  });

  /*
   * MUTATION PROOF, run: `viewChoice.ts`'s `saveView` writing with
   * `localStorage.setItem(VIEW_STORAGE_KEY, view)` again: `expected [
   * 'app/src/viewChoice.ts:22' ] to deeply equal []`.
   */
  it('happen only in engine/data/storage.ts', () => {
    const files = [...sources('app/src'), ...sources('engine')].filter((f) => f !== OWNER);
    const found = files.flatMap((f) => storageWrites(f, readFileSync(join(ROOT, f), 'utf8')));
    expect(found).toEqual([]);
    // And the owner really is where the writes live, so this cannot pass by reading nothing.
    expect(storageWrites(OWNER, readFileSync(join(ROOT, OWNER), 'utf8')).length).toBeGreaterThan(0);
  });
});
